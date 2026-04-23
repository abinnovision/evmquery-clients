import { describe, expect, it, vi } from "vitest";

import { executeQueryExecute } from "./execute.operation";

import type { IExecuteFunctions, INode } from "n8n-workflow";

const fakeNode: INode = {
	id: "test-node-id",
	name: "evmquery",
	type: "n8n-nodes-base.evmQuery",
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

interface CtxParams {
	chainId: string;
	expression: string;
	outputFormat?: "simple" | "raw";
	contracts?: unknown;
	context?: unknown;
	options?: unknown;
	response?: unknown;
	preset?: string;
	presetInputs?: Record<string, unknown>;
}

function buildCtx(
	params: CtxParams,
): IExecuteFunctions & { __httpMock: ReturnType<typeof vi.fn> } {
	const httpMock = vi.fn(() => Promise.resolve(params.response ?? {}));
	const ctx = {
		getNode: () => fakeNode,
		getNodeParameter: vi.fn((name: string, _i: number, fallback?: unknown) => {
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

			if (name === "preset") {
				return params.preset ?? fallback ?? "custom";
			}

			if (name.startsWith("preset_")) {
				/*
				 * The executor reads preset inputs via
				 * `preset_<safeId>_<inputName>`. For test ergonomics we key
				 * `presetInputs` on just the inputName — the suffix after the
				 * last underscore — so fixtures stay readable.
				 */
				const inputName = name.slice(name.lastIndexOf("_") + 1);

				return params.presetInputs?.[inputName] ?? fallback ?? "";
			}

			if (name === "options") {
				/*
				 * outputFormat now lives inside the `options` collection so it
				 * hides behind "Add option" in the UI. Merge the legacy
				 * top-level test shorthand into the collection payload.
				 */
				const base =
					(params.options as Record<string, unknown> | undefined) ??
					(fallback as Record<string, unknown> | undefined) ??
					{};

				return params.outputFormat !== undefined
					? { ...base, outputFormat: params.outputFormat }
					: base;
			}

			return fallback;
		}),
		getCredentials: vi.fn(() =>
			Promise.resolve({
				apiKey: "k_test",
			}),
		),
		helpers: {
			httpRequestWithAuthentication: httpMock,
		},
	} as unknown as IExecuteFunctions & { __httpMock: typeof httpMock };
	ctx.__httpMock = httpMock;

	return ctx;
}

const envelopeWithObjectValue = {
	result: {
		value: { name: "USD Coin", symbol: "USDC", decimals: 6 },
		type: "sol_struct",
	},
	meta: { blockNumber: 19500000, totalCalls: 3, totalRounds: 1 },
	performance: { latencyMs: 142 },
	credits: { consumed: 3 },
};

const envelopeWithScalarValue = {
	result: { value: "12345000000", type: "sol_int" },
	meta: { blockNumber: 19500001, totalCalls: 1, totalRounds: 1 },
	performance: { latencyMs: 80 },
	credits: { consumed: 1 },
};

describe("query.execute operation", () => {
	it("posts to /query with the assembled envelope", async () => {
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			expression: "Token.balanceOf(holder)",
			contracts: { entries: [{ name: "Token", address: "0x1" }] },
			context: {
				entries: [{ name: "holder", type: "sol_address", value: "0xabc" }],
			},
			response: envelopeWithScalarValue,
		});

		await executeQueryExecute.call(ctx, 0);

		const [auth, req] = ctx.__httpMock.mock.calls[0]!;
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

	it("omits context keys when no context variables are declared", async () => {
		const ctx = buildCtx({
			chainId: "evm_base",
			expression: "1 + 1",
			response: envelopeWithScalarValue,
		});

		await executeQueryExecute.call(ctx, 0);

		const [, req] = ctx.__httpMock.mock.calls[0]!;
		expect(req.body).not.toHaveProperty("context");
		expect(req.body.schema).not.toHaveProperty("context");
	});

	it("forwards timeoutMs when supplied and positive", async () => {
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			expression: "1",
			options: { timeoutMs: 5000 },
			response: envelopeWithScalarValue,
		});

		await executeQueryExecute.call(ctx, 0);

		const [, req] = ctx.__httpMock.mock.calls[0]!;
		expect(req.body.options).toEqual({ timeoutMs: 5000 });
	});

	it("drops timeoutMs when zero or negative", async () => {
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			expression: "1",
			options: { timeoutMs: 0 },
			response: envelopeWithScalarValue,
		});

		await executeQueryExecute.call(ctx, 0);

		const [, req] = ctx.__httpMock.mock.calls[0]!;
		expect(req.body).not.toHaveProperty("options");
	});

	it("simple mode spreads object results and attaches $meta", async () => {
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			expression: "Token.metadata()",
			outputFormat: "simple",
			response: envelopeWithObjectValue,
		});

		const out = await executeQueryExecute.call(ctx, 0);

		expect(out).toEqual({
			name: "USD Coin",
			symbol: "USDC",
			decimals: 6,
			$meta: {
				type: "sol_struct",
				blockNumber: 19500000,
				credits: 3,
				rounds: 1,
				onChainCalls: 3,
				latencyMs: 142,
			},
		});
	});

	it("simple mode wraps scalar results under `value`", async () => {
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			expression: "Token.balanceOf(holder)",
			outputFormat: "simple",
			response: envelopeWithScalarValue,
		});

		const out = await executeQueryExecute.call(ctx, 0);

		expect(out).toEqual({
			value: "12345000000",
			$meta: {
				type: "sol_int",
				blockNumber: 19500001,
				credits: 1,
				rounds: 1,
				onChainCalls: 1,
				latencyMs: 80,
			},
		});
	});

	it("raw mode returns the full envelope verbatim", async () => {
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			expression: "Token.metadata()",
			outputFormat: "raw",
			response: envelopeWithObjectValue,
		});

		const out = await executeQueryExecute.call(ctx, 0);

		expect(out).toEqual(envelopeWithObjectValue);
	});

	it("expands the erc20-balance preset into the custom request shape", async () => {
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			expression: "unused-when-preset-active",
			preset: "erc20-balance",
			presetInputs: {
				tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				holder: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
			},
			response: envelopeWithScalarValue,
		});

		await executeQueryExecute.call(ctx, 0);

		const [, req] = ctx.__httpMock.mock.calls[0]!;
		expect(req.body).toMatchObject({
			chain: "evm_ethereum",
			expression: "Token.balanceOf(holder)",
			schema: {
				contracts: {
					Token: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
				},
				context: { holder: "sol_address" },
			},
			context: { holder: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" },
		});
	});

	it("expands the native-balance preset without contracts", async () => {
		const ctx = buildCtx({
			chainId: "evm_base",
			expression: "unused",
			preset: "native-balance",
			presetInputs: { account: "0xabc" },
			response: envelopeWithScalarValue,
		});

		await executeQueryExecute.call(ctx, 0);

		const [, req] = ctx.__httpMock.mock.calls[0]!;
		expect(req.body).toMatchObject({
			chain: "evm_base",
			expression: "chain.balance(account)",
			schema: {
				contracts: {},
				context: { account: "sol_address" },
			},
			context: { account: "0xabc" },
		});
	});

	it("coerces string booleans in context values via parseContextValues", async () => {
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			expression: "flag ? 1 : 0",
			context: {
				entries: [{ name: "flag", type: "bool", value: "true" }],
			},
			response: envelopeWithScalarValue,
		});

		await executeQueryExecute.call(ctx, 0);

		const [, req] = ctx.__httpMock.mock.calls[0]!;
		expect(req.body.context).toEqual({ flag: true });
	});
});
