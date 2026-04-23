import { NodeApiError } from "n8n-workflow";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { evmQueryRequest } from "./request";

import type { IExecuteFunctions, INode } from "n8n-workflow";

const fakeNode: INode = {
	id: "test-node-id",
	name: "evmquery",
	type: "n8n-nodes-base.evmQuery",
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

/**
 * Builds a minimal IExecuteFunctions-like context with stubbed helpers so the
 * transport can be exercised without booting n8n. Only the members the
 * transport actually reads are populated.
 */
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

		return Promise.resolve(overrides?.response ?? {});
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

describe("evmQueryRequest", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("composes base URL + path and forwards method/body", async () => {
		const ctx = buildCtx({ response: { ok: true } });
		const out = await evmQueryRequest(ctx, {
			method: "POST",
			path: "/query",
			body: { query: "sol_address(0x0)", vars: [] },
		});
		expect(out).toEqual({ ok: true });
		expect(ctx.__httpMock).toHaveBeenCalledTimes(1);
		const [auth, req] = ctx.__httpMock.mock.calls[0]!;
		expect(auth).toBe("evmQueryApi");
		expect(req).toMatchObject({
			method: "POST",
			url: "https://api.evmquery.com/api/v1/query",
			body: { query: "sol_address(0x0)", vars: [] },
			json: true,
		});
	});

	it("forwards qs when provided", async () => {
		const ctx = buildCtx();
		await evmQueryRequest(ctx, {
			method: "GET",
			path: "/chains",
			qs: { limit: 50 },
		});
		const [, req] = ctx.__httpMock.mock.calls[0]!;
		expect(req.qs).toEqual({ limit: 50 });
	});

	it("wraps HTTP errors in a NodeApiError", async () => {
		const raw = Object.assign(new Error("HTTP 429"), {
			response: { status: 429, body: {} },
			httpCode: "429",
		});
		const ctx = buildCtx({ throws: raw });
		await expect(
			evmQueryRequest(ctx, { method: "GET", path: "/usage" }),
		).rejects.toBeInstanceOf(NodeApiError);
	});
});
