import { describe, expect, it, vi } from "vitest";

import { executeListChains } from "./list.operation";

import type { IExecuteFunctions, INode } from "n8n-workflow";

const fakeNode: INode = {
	id: "test-node-id",
	name: "evmquery",
	type: "n8n-nodes-base.evmQuery",
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

function buildCtx(overrides?: {
	response?: unknown;
	throws?: Error;
}): IExecuteFunctions & {
	__httpMock: ReturnType<typeof vi.fn>;
} {
	const httpMock = vi.fn(() => {
		if (overrides?.throws !== undefined) {
			return Promise.reject(overrides.throws);
		}

		return Promise.resolve(overrides?.response ?? { chains: [] });
	});
	const ctx = {
		getNode: () => fakeNode,
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

describe("chain.list operation", () => {
	it("returns one item per chain from GET /chains", async () => {
		const ctx = buildCtx({
			response: {
				chains: [
					{ id: "evm_ethereum", evmChainId: 1, name: "Ethereum" },
					{ id: "evm_base", evmChainId: 8453, name: "Base" },
				],
			},
		});

		const out = await executeListChains.call(ctx, 0);

		expect(out).toEqual([
			{ id: "evm_ethereum", evmChainId: 1, name: "Ethereum" },
			{ id: "evm_base", evmChainId: 8453, name: "Base" },
		]);

		const [auth, req] = ctx.__httpMock.mock.calls[0]!;
		expect(auth).toBe("evmQueryApi");
		expect(req).toMatchObject({
			method: "GET",
			url: "https://api.evmquery.com/api/v1/chains",
		});
	});

	it("returns an empty array when the API reports no chains", async () => {
		const ctx = buildCtx({ response: { chains: [] } });
		const out = await executeListChains.call(ctx, 0);
		expect(out).toEqual([]);
	});
});
