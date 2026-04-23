import { describe, expect, it, vi } from "vitest";

import { executeGetUsage } from "./get.operation";

import type { IExecuteFunctions, INode } from "n8n-workflow";

const fakeNode: INode = {
	id: "test-node-id",
	name: "evmquery",
	type: "n8n-nodes-base.evmQuery",
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

function buildCtx(overrides?: { response?: unknown }): IExecuteFunctions & {
	__httpMock: ReturnType<typeof vi.fn>;
} {
	const httpMock = vi.fn(() => Promise.resolve(overrides?.response ?? {}));
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

describe("usage.get operation", () => {
	it("returns the usage snapshot as a single item preserving API shape", async () => {
		const snapshot = {
			credits: { used: 100, allowance: 10000, remaining: 9900 },
			tier: "starter",
			periodStart: "2026-04-01",
			periodEnd: "2026-04-30",
		};
		const ctx = buildCtx({ response: snapshot });

		const out = await executeGetUsage.call(ctx, 0);

		expect(out).toEqual(snapshot);

		const [auth, req] = ctx.__httpMock.mock.calls[0]!;
		expect(auth).toBe("evmQueryApi");
		expect(req).toMatchObject({
			method: "GET",
			url: "https://api.evmquery.com/api/v1/usage",
		});
	});
});
