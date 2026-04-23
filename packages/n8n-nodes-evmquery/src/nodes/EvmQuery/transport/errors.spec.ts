import { NodeApiError } from "n8n-workflow";
import { describe, expect, it } from "vitest";

import { mapEvmQueryError } from "./errors";

import type { INode } from "n8n-workflow";

const fakeNode: INode = {
	id: "test-node-id",
	name: "evmquery",
	type: "n8n-nodes-base.evmQuery",
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

/**
 * Builds an error that mimics what n8n's httpRequestWithAuthentication throws
 * when the server returns a non-2xx response.
 */
function buildHttpError(
	status: number,
	body: Record<string, unknown>,
): Error & { response?: { status: number; body: unknown }; httpCode?: string } {
	const err = new Error(`HTTP ${String(status)}`) as Error & {
		response?: { status: number; body: unknown };
		httpCode?: string;
	};
	err.response = { status, body };
	err.httpCode = String(status);

	return err;
}

describe("mapEvmQueryError", () => {
	it("returns a NodeApiError for a 400 Bad Request", () => {
		const err = buildHttpError(400, { message: "query must be a string" });
		const mapped = mapEvmQueryError(fakeNode, err);
		expect(mapped).toBeInstanceOf(NodeApiError);
		expect(mapped.httpCode).toBe("400");
		expect(mapped.message).toMatch(/bad request/i);
		expect(mapped.description).toMatch(/query must be a string/);
	});

	it("returns a NodeApiError for a 401 Unauthorized", () => {
		const err = buildHttpError(401, { error: "invalid api key" });
		const mapped = mapEvmQueryError(fakeNode, err);
		expect(mapped.httpCode).toBe("401");
		expect(mapped.message).toMatch(/invalid.*api key/i);
	});

	it("returns a NodeApiError for a 403 Forbidden with quota hint", () => {
		const err = buildHttpError(403, { message: "plan quota exceeded" });
		const mapped = mapEvmQueryError(fakeNode, err);
		expect(mapped.httpCode).toBe("403");
		expect(mapped.message).toMatch(/forbidden/i);
		expect(mapped.description).toMatch(/quota/);
	});

	it("returns a NodeApiError for a 429 Rate Limit with /usage hint", () => {
		const err = buildHttpError(429, {});
		const mapped = mapEvmQueryError(fakeNode, err);
		expect(mapped.httpCode).toBe("429");
		expect(mapped.message).toMatch(/rate limit/i);
		expect(mapped.description).toMatch(/usage/);
	});

	it("returns a NodeApiError for a 500 server error with retry hint", () => {
		const err = buildHttpError(500, { error: "internal" });
		const mapped = mapEvmQueryError(fakeNode, err);
		expect(mapped.httpCode).toBe("500");
		expect(mapped.message).toMatch(/service error/i);
		expect(mapped.description).toMatch(/retry/i);
	});

	it("returns a NodeApiError for 503", () => {
		const err = buildHttpError(503, {});
		const mapped = mapEvmQueryError(fakeNode, err);
		expect(mapped.httpCode).toBe("503");
		expect(mapped.message).toMatch(/service error/i);
	});

	it("falls back to a generic error message when status is unknown", () => {
		const mapped = mapEvmQueryError(fakeNode, new Error("network down"));
		expect(mapped).toBeInstanceOf(NodeApiError);
		expect(mapped.message).toMatch(/evmquery request failed|network down/i);
	});
});
