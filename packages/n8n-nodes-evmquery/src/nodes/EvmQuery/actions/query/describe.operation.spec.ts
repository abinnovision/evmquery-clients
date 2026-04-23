import { describe, expect, it, vi } from "vitest";

import { executeQueryDescribe } from "./describe.operation";

import type { IExecuteFunctions, INode } from "n8n-workflow";

const fakeNode: INode = {
	id: "test-node-id",
	name: "evmquery",
	type: "n8n-nodes-base.evmQuery",
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

function buildCtx(params: {
	chainId: string;
	contracts?: unknown;
	context?: unknown;
	response?: unknown;
}): IExecuteFunctions & { __httpMock: ReturnType<typeof vi.fn> } {
	const httpMock = vi.fn(() => Promise.resolve(params.response ?? {}));
	const ctx = {
		getNode: () => fakeNode,
		getNodeParameter: vi.fn((name: string, _i: number, fallback?: unknown) => {
			if (name === "chainId") {
				return params.chainId;
			}

			if (name === "contracts") {
				return params.contracts ?? fallback ?? {};
			}

			if (name === "context") {
				return params.context ?? fallback ?? {};
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

describe("query.describe operation", () => {
	it("posts to /query/describe with chain and normalized contracts", async () => {
		const ctx = buildCtx({
			chainId: "evm_base",
			contracts: {
				entries: [
					{
						name: "Token",
						address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
					},
				],
			},
			response: { contracts: {}, context: {} },
		});

		await executeQueryDescribe.call(ctx, 0);

		const [auth, req] = ctx.__httpMock.mock.calls[0]!;
		expect(auth).toBe("evmQueryApi");
		expect(req).toMatchObject({
			method: "POST",
			url: "https://api.evmquery.com/api/v1/query/describe",
			body: {
				chain: "evm_base",
				schema: {
					contracts: {
						Token: {
							address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
						},
					},
				},
			},
		});
	});

	it("includes context types only when non-empty", async () => {
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			contracts: { entries: [{ name: "Token", address: "0x1" }] },
			context: { entries: [{ name: "holder", type: "sol_address" }] },
			response: {},
		});

		await executeQueryDescribe.call(ctx, 0);

		const [, req] = ctx.__httpMock.mock.calls[0]!;
		expect(req.body).toEqual({
			chain: "evm_ethereum",
			schema: {
				contracts: { Token: { address: "0x1" } },
				context: { holder: "sol_address" },
			},
		});
	});

	it("omits the context key entirely when no context types are supplied", async () => {
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			contracts: { entries: [{ name: "Token", address: "0x1" }] },
			response: {},
		});

		await executeQueryDescribe.call(ctx, 0);

		const [, req] = ctx.__httpMock.mock.calls[0]!;
		expect(req.body).toEqual({
			chain: "evm_ethereum",
			schema: { contracts: { Token: { address: "0x1" } } },
		});
	});

	it("returns the describe response verbatim", async () => {
		const response = {
			contracts: {
				Token: {
					methods: {
						balanceOf: { inputs: ["sol_address"], output: "sol_int" },
					},
				},
			},
			context: {},
		};
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			contracts: { entries: [{ name: "Token", address: "0x1" }] },
			response,
		});

		const out = await executeQueryDescribe.call(ctx, 0);

		expect(out).toEqual(response);
	});
});
