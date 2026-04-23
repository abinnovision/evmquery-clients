import { describe, expect, it, vi } from "vitest";

import { executeQueryValidate } from "./validate.operation";

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
	expression: string;
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

			if (name === "expression") {
				return params.expression;
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
				baseUrl: "https://api.evmquery.com/api",
			}),
		),
		helpers: {
			httpRequestWithAuthentication: httpMock,
		},
	} as unknown as IExecuteFunctions & { __httpMock: typeof httpMock };
	ctx.__httpMock = httpMock;

	return ctx;
}

describe("query.validate operation", () => {
	it("posts to /query/validate without runtime context values", async () => {
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			expression: "Token.balanceOf(holder)",
			contracts: { entries: [{ name: "Token", address: "0x1" }] },
			context: {
				entries: [{ name: "holder", type: "sol_address", value: "0xabc" }],
			},
			response: { valid: true, type: "sol_int", estimatedCredits: 1 },
		});

		await executeQueryValidate.call(ctx, 0);

		const [auth, req] = ctx.__httpMock.mock.calls[0]!;
		expect(auth).toBe("evmQueryApi");
		expect(req).toMatchObject({
			method: "POST",
			url: "https://api.evmquery.com/api/query/validate",
			body: {
				chain: "evm_ethereum",
				expression: "Token.balanceOf(holder)",
				schema: {
					contracts: { Token: { address: "0x1" } },
					context: { holder: "sol_address" },
				},
			},
		});
		expect(req.body).not.toHaveProperty("context");
	});

	it("omits schema.context when no context variables are declared", async () => {
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			expression: "1 + 1",
			contracts: { entries: [{ name: "Token", address: "0x1" }] },
			response: { valid: true, type: "sol_int", estimatedCredits: 0 },
		});

		await executeQueryValidate.call(ctx, 0);

		const [, req] = ctx.__httpMock.mock.calls[0]!;
		expect(req.body).toEqual({
			chain: "evm_ethereum",
			expression: "1 + 1",
			schema: { contracts: { Token: { address: "0x1" } } },
		});
	});

	it("returns the validate response verbatim", async () => {
		const response = {
			valid: false,
			type: null,
			estimatedCredits: 0,
			errors: ["unknown identifier 'Token'"],
		};
		const ctx = buildCtx({
			chainId: "evm_ethereum",
			expression: "Token.balanceOf(holder)",
			response,
		});

		const out = await executeQueryValidate.call(ctx, 0);

		expect(out).toEqual(response);
	});
});
