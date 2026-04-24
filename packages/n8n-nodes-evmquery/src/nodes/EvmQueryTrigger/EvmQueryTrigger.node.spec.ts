import { beforeEach, describe, expect, it, vi } from "vitest";

import { EvmQueryTrigger } from "./EvmQueryTrigger.node";

import type {
	IDataObject,
	INode,
	INodeExecutionData,
	IPollFunctions,
} from "n8n-workflow";

const fakeNode: INode = {
	id: "test-trigger-id",
	name: "evmquery-trigger",
	type: "n8n-nodes-base.evmQueryTrigger",
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

interface PollParams {
	chainId: string;
	expression: string;
	contracts?: unknown;
	context?: unknown;
	emitOn?: "change" | "everyPoll";
	options?: Record<string, unknown>;
	/** Default "trigger" — set "manual" to simulate the editor's Fetch Test Event button. */
	mode?: string;
}

interface MockCtx {
	ctx: IPollFunctions;
	httpMock: ReturnType<typeof vi.fn>;
	staticData: Record<string, unknown>;
	warnMock: ReturnType<typeof vi.fn>;
	responses: unknown[];
}

/**
 * Builds an `IPollFunctions`-shaped mock with shared static data across
 * successive poll calls. Each call pops the next queued response; after the
 * queue is exhausted the last response is reused so single-response tests
 * stay terse.
 *
 * `responses` may contain either a plain object (resolved) or an Error
 * (rejected) to exercise the transport-failure branch.
 */
function buildCtx(params: PollParams, responses: unknown[]): MockCtx {
	const staticData: Record<string, unknown> = {};
	const warnMock = vi.fn();
	let callIdx = 0;
	const httpMock = vi.fn(() => {
		const next =
			callIdx < responses.length
				? responses[callIdx++]
				: responses[responses.length - 1];
		if (next instanceof Error) {
			return Promise.reject(next);
		}

		return Promise.resolve(next);
	});

	const ctx = {
		getNode: () => fakeNode,
		getMode: () => params.mode ?? "trigger",
		getNodeParameter: vi.fn((name: string, fallback?: unknown) => {
			if (name === "chainId") {
				return params.chainId;
			}

			if (name === "expression") {
				return params.expression;
			}

			if (name === "contracts") {
				return params.contracts ?? fallback ?? {};
			}

			if (name === "context") {
				return params.context ?? fallback ?? {};
			}

			if (name === "options") {
				/*
				 * `emitOn` now lives inside the Options collection. Keep the
				 * top-level `emitOn` shorthand for test ergonomics by merging
				 * it into the collection payload here.
				 */
				const base =
					params.options ??
					(fallback as Record<string, unknown> | undefined) ??
					{};

				return params.emitOn !== undefined
					? { ...base, emitOn: params.emitOn }
					: base;
			}

			return fallback;
		}),
		getCredentials: vi.fn(() => Promise.resolve({ apiKey: "k_test" })),
		getWorkflowStaticData: vi.fn(() => staticData),
		logger: {
			warn: warnMock,
			debug: vi.fn(),
			info: vi.fn(),
			error: vi.fn(),
			verbose: vi.fn(),
		},
		helpers: {
			httpRequestWithAuthentication: httpMock,
			returnJsonArray: (data: IDataObject | IDataObject[]) => {
				const arr = Array.isArray(data) ? data : [data];

				return arr.map((json) => ({ json })) as INodeExecutionData[];
			},
		},
	} as unknown as IPollFunctions;

	return { ctx, httpMock, staticData, warnMock, responses };
}

const envelope = (value: unknown, blockNumber = 19500000): unknown => ({
	result: { value, type: typeof value === "object" ? "sol_struct" : "sol_int" },
	meta: { blockNumber, totalCalls: 1, totalRounds: 1 },
	performance: { latencyMs: 80 },
	credits: { consumed: 1 },
});

const baseParams: PollParams = {
	chainId: "evm_ethereum",
	expression: "Token.balanceOf(holder)",
	contracts: { entries: [{ name: "Token", address: "0x1" }] },
	context: {
		entries: [{ name: "holder", type: "sol_address", value: "0xabc" }],
	},
};

describe("evmQueryTrigger.poll", () => {
	const trigger = new EvmQueryTrigger();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("manual mode emits the current value and leaves static data untouched", async () => {
		const { ctx, staticData } = buildCtx({ ...baseParams, mode: "manual" }, [
			envelope("1000"),
		]);

		const result = await trigger.poll.call(ctx);

		expect(result).not.toBeNull();
		expect(result?.[0]?.[0]?.json).toMatchObject({
			value: "1000",
			previousValue: null,
			blockNumber: 19500000,
			type: "sol_int",
		});
		/*
		 * Manual mode must not seed the production cursor — otherwise
		 * clicking Test once would suppress the first real fire after
		 * activation.
		 */
		expect(staticData).toEqual({});
	});

	it("seeds state silently on the first poll — initial value never emits", async () => {
		const { ctx, staticData } = buildCtx(baseParams, [envelope("1000")]);

		const result = await trigger.poll.call(ctx);

		expect(result).toBeNull();
		expect(Object.keys(staticData)).toHaveLength(1);
	});

	it("does not fire when the value is unchanged across two polls", async () => {
		const { ctx } = buildCtx(baseParams, [envelope("1000"), envelope("1000")]);

		await trigger.poll.call(ctx);
		const second = await trigger.poll.call(ctx);

		expect(second).toBeNull();
	});

	it("fires with previousValue when the value changes", async () => {
		const { ctx } = buildCtx(baseParams, [
			envelope("1000"),
			envelope("2000", 19500001),
		]);

		await trigger.poll.call(ctx);
		const second = await trigger.poll.call(ctx);

		expect(second).not.toBeNull();
		expect(second?.[0]?.[0]?.json).toMatchObject({
			value: "2000",
			previousValue: "1000",
			blockNumber: 19500001,
		});
	});

	it("diffs struct results whole-value: any field change fires", async () => {
		const structA = envelope({ reserve0: "100", reserve1: "200" });
		const structB = envelope({ reserve0: "100", reserve1: "200" });
		const structC = envelope({ reserve0: "100", reserve1: "999" });

		const { ctx } = buildCtx(baseParams, [structA, structB, structC]);

		/*
		 * Poll 1 seeds state. Poll 2 returns the identical struct — no fire.
		 * Poll 3 flips one field — fires with the full previous struct.
		 */
		expect(await trigger.poll.call(ctx)).toBeNull();
		expect(await trigger.poll.call(ctx)).toBeNull();
		const third = await trigger.poll.call(ctx);
		expect(third).not.toBeNull();
		expect(third?.[0]?.[0]?.json).toMatchObject({
			value: { reserve0: "100", reserve1: "999" },
			previousValue: { reserve0: "100", reserve1: "200" },
		});
	});

	it("does not fire on struct key-reordering alone", async () => {
		const structA = envelope({ reserve0: "100", reserve1: "200" });
		const structB = envelope({ reserve1: "200", reserve0: "100" });

		const { ctx } = buildCtx(baseParams, [structA, structB]);

		expect(await trigger.poll.call(ctx)).toBeNull();
		expect(await trigger.poll.call(ctx)).toBeNull();
	});

	it("returns null and preserves state on transport error", async () => {
		const { ctx, staticData, warnMock } = buildCtx(baseParams, [
			envelope("1000"),
			new Error("boom"),
			envelope("1000"),
		]);

		// First poll: seed state silently.
		expect(await trigger.poll.call(ctx)).toBeNull();
		const before = JSON.parse(JSON.stringify(staticData)) as Record<
			string,
			unknown
		>;

		const errored = await trigger.poll.call(ctx);
		expect(errored).toBeNull();
		expect(warnMock).toHaveBeenCalledWith(expect.stringContaining("evmquery"));
		expect(staticData).toEqual(before);

		/*
		 * A successful follow-up with the same value as the seed must not
		 * fire — the error did not reset the cursor.
		 */
		const recovered = await trigger.poll.call(ctx);
		expect(recovered).toBeNull();
	});

	it("fires on every poll when emitOn is everyPoll", async () => {
		const { ctx } = buildCtx({ ...baseParams, emitOn: "everyPoll" }, [
			envelope("1000"),
			envelope("1000"),
			envelope("1000"),
		]);

		expect(await trigger.poll.call(ctx)).not.toBeNull();
		expect(await trigger.poll.call(ctx)).not.toBeNull();
		expect(await trigger.poll.call(ctx)).not.toBeNull();
	});

	it("renders the Context Variables Value column on the trigger", () => {
		/*
		 * Guard against regressing the `always()` helper: the shared
		 * `contextField` gates its `Value` inner column on `/operation`,
		 * and the trigger has no operation selector. If the inner-field
		 * `displayOptions` isn't stripped, the Value column silently
		 * disappears and `parseContextValues` always returns `{}`.
		 */
		const trigger = new EvmQueryTrigger();
		const contextProp = trigger.description.properties.find(
			(p) => p.name === "context",
		);
		const groups = (contextProp?.options ?? []) as Array<{
			name: string;
			values?: Array<{ name: string; displayOptions?: unknown }>;
		}>;
		const entries = groups.find((g) => g.name === "entries");
		const valueField = entries?.values?.find((v) => v.name === "value");

		expect(valueField).toBeDefined();
		expect(valueField?.displayOptions).toBeUndefined();
	});

	it("sends the same /query envelope as the execute action", async () => {
		const { ctx, httpMock } = buildCtx(baseParams, [envelope("1000")]);

		await trigger.poll.call(ctx);

		const [auth, req] = httpMock.mock.calls[0]!;
		expect(auth).toBe("evmQueryApi");
		expect(req).toMatchObject({
			method: "POST",
			url: "https://api.evmquery.com/api/v1/query",
			body: {
				chain: "evm_ethereum",
				expression: "Token.balanceOf(holder)",
				schema: {
					contracts: { Token: { address: "0x1" } },
					context: { holder: "sol_address" },
				},
				context: { holder: "0xabc" },
			},
		});
	});
});
