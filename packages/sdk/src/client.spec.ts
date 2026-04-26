import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEvmQueryClient, EvmQueryError, isEvmQueryError } from "./index";

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
		...init,
	});

const captureRequest = (fetchMock: FetchMock): Request => {
	expect(fetchMock).toHaveBeenCalledTimes(1);
	const arg = fetchMock.mock.calls[0]?.[0];
	expect(arg).toBeInstanceOf(Request);

	return arg as Request;
};

describe("createEvmQueryClient", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = vi.fn<typeof fetch>();
	});

	describe("listChains", () => {
		it("performs a GET request against the default base URL", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({
					chains: [{ id: "ethereum", evmChainId: 1, name: "Ethereum" }],
				}),
			);
			const client = createEvmQueryClient({ fetch: fetchMock });

			const { data } = await client.listChains();

			const request = captureRequest(fetchMock);
			expect(request.method).toBe("GET");
			expect(request.url).toBe("https://api.evmquery.com/api/v1/chains");
			expect(data).toEqual({
				chains: [{ id: "ethereum", evmChainId: 1, name: "Ethereum" }],
			});
		});
	});

	describe("query", () => {
		it("posts the body and returns the parsed response", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({
					result: { value: "1000000", type: "sol_int" },
					meta: { blockNumber: "19000000", totalCalls: 1, totalRounds: 1 },
					performance: { latencyMs: 42 },
					credits: { consumed: 1 },
				}),
			);
			const client = createEvmQueryClient({
				apiKey: "test-key",
				fetch: fetchMock,
			});

			const body = {
				chain: "ethereum",
				expression: "usdc.totalSupply()",
				schema: {
					contracts: {
						usdc: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
					},
				},
			};
			const { data } = await client.query({ body });

			const request = captureRequest(fetchMock);
			expect(request.method).toBe("POST");
			expect(request.url).toBe("https://api.evmquery.com/api/v1/query");
			expect(request.headers.get("authorization")).toBe("Bearer test-key");
			expect(request.headers.get("content-type")).toBe("application/json");
			expect(await request.clone().json()).toEqual(body);
			expect(data?.result).toEqual({ value: "1000000", type: "sol_int" });
			expect(data?.credits.consumed).toBe(1);
		});
	});

	describe("validate", () => {
		it("posts the validation body and returns the inferred type", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({
					valid: true,
					type: "sol_int",
					estimatedCredits: 1,
				}),
			);
			const client = createEvmQueryClient({ fetch: fetchMock });

			const { data } = await client.validate({
				body: {
					chain: "ethereum",
					expression: "usdc.totalSupply()",
					schema: {
						contracts: {
							usdc: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
						},
					},
				},
			});

			const request = captureRequest(fetchMock);
			expect(request.url).toBe(
				"https://api.evmquery.com/api/v1/query/validate",
			);
			expect(data).toEqual({
				valid: true,
				type: "sol_int",
				estimatedCredits: 1,
			});
		});
	});

	describe("schema describe", () => {
		it("posts the schema describe body", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({ contracts: { usdc: { methods: [] } } }),
			);
			const client = createEvmQueryClient({ fetch: fetchMock });

			const { data } = await client.describe({
				body: {
					chain: "ethereum",
					schema: {
						contracts: {
							usdc: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
						},
					},
				},
			});

			const request = captureRequest(fetchMock);
			expect(request.url).toBe(
				"https://api.evmquery.com/api/v1/query/describe",
			);
			expect(data).toEqual({ contracts: { usdc: { methods: [] } } });
		});
	});

	describe("usage", () => {
		it("performs a GET request and returns the usage snapshot", async () => {
			fetchMock.mockResolvedValueOnce(
				jsonResponse({
					credits: { used: 100, allowance: 1000, remaining: 900 },
					tier: "pro",
					periodStart: "2026-04-01",
					periodEnd: "2026-04-30",
				}),
			);
			const client = createEvmQueryClient({ fetch: fetchMock });

			const { data } = await client.usage();

			const request = captureRequest(fetchMock);
			expect(request.method).toBe("GET");
			expect(request.url).toBe("https://api.evmquery.com/api/v1/usage");
			expect(data?.credits.remaining).toBe(900);
			expect(data?.tier).toBe("pro");
		});
	});

	describe("client options", () => {
		it("honors the baseUrl override", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ chains: [] }));
			const client = createEvmQueryClient({
				baseUrl: "https://staging.evmquery.local/api/v1",
				fetch: fetchMock,
			});

			await client.listChains();

			const request = captureRequest(fetchMock);
			expect(request.url).toBe("https://staging.evmquery.local/api/v1/chains");
		});

		it("merges custom headers and apiKey into every request", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ chains: [] }));
			const client = createEvmQueryClient({
				apiKey: "secret-token",
				fetch: fetchMock,
				headers: { "X-Trace-Id": "trace-123" },
			});

			await client.listChains();

			const request = captureRequest(fetchMock);
			expect(request.headers.get("authorization")).toBe("Bearer secret-token");
			expect(request.headers.get("x-trace-id")).toBe("trace-123");
		});

		it("does not set an Authorization header when apiKey is absent", async () => {
			fetchMock.mockResolvedValueOnce(jsonResponse({ chains: [] }));
			const client = createEvmQueryClient({ fetch: fetchMock });

			await client.listChains();

			const request = captureRequest(fetchMock);
			expect(request.headers.get("authorization")).toBeNull();
		});
	});

	describe("error handling", () => {
		it("throws EvmQueryError with the JSON body on non-OK responses", async () => {
			fetchMock.mockResolvedValueOnce(
				new Response(
					JSON.stringify({ message: "invalid expression", code: "E_PARSE" }),
					{
						status: 400,
						statusText: "Bad Request",
						headers: { "Content-Type": "application/json" },
					},
				),
			);
			const client = createEvmQueryClient({ fetch: fetchMock });

			const promise = client.query({
				body: {
					chain: "ethereum",
					expression: "broken(",
					schema: { contracts: {} },
				},
			});

			await expect(promise).rejects.toBeInstanceOf(EvmQueryError);
			await expect(promise).rejects.toMatchObject({
				status: 400,
				statusText: "Bad Request",
				body: { message: "invalid expression", code: "E_PARSE" },
			});
		});

		it("falls back to the response text when the body is not JSON", async () => {
			fetchMock.mockResolvedValueOnce(
				new Response("rate limited", {
					status: 429,
					statusText: "Too Many Requests",
				}),
			);
			const client = createEvmQueryClient({ fetch: fetchMock });

			const error: unknown = await client
				.query({
					body: {
						chain: "ethereum",
						expression: "usdc.totalSupply()",
						schema: { contracts: {} },
					},
				})
				.then(
					() => new Error("expected EvmQueryError to be thrown"),
					(reason: unknown) => reason,
				);

			expect(isEvmQueryError(error)).toBe(true);
			expect((error as EvmQueryError).status).toBe(429);
			expect((error as EvmQueryError).body).toBe("rate limited");
		});
	});
});
