import { describe, expect, it, vi } from "vitest";

import { listChains, STATIC_CHAINS } from "./loadOptions";

import type { ILoadOptionsFunctions, INode } from "n8n-workflow";

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
}): ILoadOptionsFunctions & { __httpMock: ReturnType<typeof vi.fn> } {
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
	} as unknown as ILoadOptionsFunctions & { __httpMock: typeof httpMock };
	ctx.__httpMock = httpMock;

	return ctx;
}

describe("listChains loadOptions", () => {
	it("maps /chains response to alphabetically-sorted n8n options", async () => {
		const ctx = buildCtx({
			response: {
				chains: [
					{ id: "evm_base", evmChainId: 8453, name: "Base" },
					{ id: "evm_ethereum", evmChainId: 1, name: "Ethereum" },
					{ id: "evm_arbitrum", evmChainId: 42161, name: "Arbitrum" },
				],
			},
		});

		const options = await listChains.call(ctx);

		expect(options).toEqual([
			{ name: "Arbitrum (42161)", value: "evm_arbitrum" },
			{ name: "Base (8453)", value: "evm_base" },
			{ name: "Ethereum (1)", value: "evm_ethereum" },
		]);
	});

	it("falls back to the static chain list on network error", async () => {
		const ctx = buildCtx({ throws: new Error("network down") });

		const options = await listChains.call(ctx);

		expect(options).toEqual([...STATIC_CHAINS]);
	});

	it("falls back to static chains on HTTP error responses", async () => {
		const raw = Object.assign(new Error("HTTP 500"), {
			response: { status: 500, body: {} },
			httpCode: "500",
		});
		const ctx = buildCtx({ throws: raw });

		const options = await listChains.call(ctx);

		expect(options.length).toBeGreaterThan(0);
		expect(options.map((o) => o.value)).toContain("evm_ethereum");
	});
});
