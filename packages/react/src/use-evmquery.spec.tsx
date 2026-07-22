import { isEvmQueryError } from "@evmquery/sdk";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EvmqueryProvider } from "./provider";
import { useEvmquery } from "./use-evmquery";

import type { QueryExecuteRequestDto } from "@evmquery/sdk";
import type { ReactElement, ReactNode } from "react";

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
		...init,
	});

const deferred = <T,>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason?: unknown) => void;
} => {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
};

const createWrapper = (
	fetchMock: FetchMock,
	apiKey?: string,
): ((props: { children: ReactNode }) => ReactElement) => {
	const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
		<EvmqueryProvider apiKey={apiKey} fetch={fetchMock}>
			{children}
		</EvmqueryProvider>
	);

	return Wrapper;
};

/*
 * Flushes pending microtasks (and a macrotask tick) for assertions that a
 * hook did *not* transition state, where `waitFor` has nothing to wait on.
 */
const flushMicrotasks = async (): Promise<void> => {
	await act(async () => {
		await new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	});
};

const QUERY_INPUT: QueryExecuteRequestDto = {
	chain: "ethereum",
	expression: "usdc.totalSupply()",
	schema: {
		contracts: {
			usdc: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
		},
	},
};

const QUERY_INPUT_B: QueryExecuteRequestDto = {
	...QUERY_INPUT,
	expression: "usdc.decimals()",
};

const QUERY_RESPONSE = {
	result: { value: "1000000", type: "sol_int" },
	meta: { blockNumber: "19000000", totalCalls: 1, totalRounds: 1 },
	performance: { latencyMs: 42 },
	credits: { consumed: 1 },
};

describe("useEvmquery", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = vi.fn<typeof fetch>();
	});

	it("auto-fetches on mount and posts the input to /query", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(QUERY_RESPONSE));

		const { result } = renderHook(() => useEvmquery(QUERY_INPUT), {
			wrapper: createWrapper(fetchMock),
		});

		expect(result.current.isLoading).toBe(true);

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.data).toEqual(QUERY_RESPONSE);
		const request = fetchMock.mock.calls[0]?.[0] as Request;
		expect(request.method).toBe("POST");
		expect(request.url).toContain("/query");
		expect(await request.clone().json()).toEqual(QUERY_INPUT);
	});

	it("re-fetches when the input expression changes", async () => {
		fetchMock.mockResolvedValue(jsonResponse(QUERY_RESPONSE));

		const { rerender } = renderHook(
			({ input }: { input: QueryExecuteRequestDto }) => useEvmquery(input),
			{
				wrapper: createWrapper(fetchMock),
				initialProps: { input: QUERY_INPUT },
			},
		);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		rerender({ input: QUERY_INPUT_B });

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});

		const secondRequest = fetchMock.mock.calls[1]?.[0] as Request;
		expect(await secondRequest.clone().json()).toEqual(QUERY_INPUT_B);
	});

	it("does not fetch on mount when enabled is false", async () => {
		const { result } = renderHook(
			() => useEvmquery(QUERY_INPUT, { enabled: false }),
			{ wrapper: createWrapper(fetchMock) },
		);

		await flushMicrotasks();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(result.current.isLoading).toBe(false);
		expect(result.current.data).toBeUndefined();
	});

	it("fetches once enabled flips to true", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(QUERY_RESPONSE));

		const { result, rerender } = renderHook(
			({ enabled }: { enabled: boolean }) =>
				useEvmquery(QUERY_INPUT, { enabled }),
			{
				wrapper: createWrapper(fetchMock),
				initialProps: { enabled: false },
			},
		);

		await flushMicrotasks();
		expect(fetchMock).not.toHaveBeenCalled();

		rerender({ enabled: true });

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(result.current.data).toEqual(QUERY_RESPONSE);
	});

	it("fetches when refetch is called while disabled", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(QUERY_RESPONSE));

		const { result } = renderHook(
			() => useEvmquery(QUERY_INPUT, { enabled: false }),
			{ wrapper: createWrapper(fetchMock) },
		);

		act(() => {
			result.current.refetch();
		});

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.data).toEqual(QUERY_RESPONSE);
		const request = fetchMock.mock.calls[0]?.[0] as Request;
		expect(request.method).toBe("POST");
		expect(request.url).toContain("/query");
	});
});

describe("error handling", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = vi.fn<typeof fetch>();
	});

	it("surfaces an EvmQueryError when the response is not OK", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "invalid request" }), {
				status: 400,
				statusText: "Bad Request",
				headers: { "Content-Type": "application/json" },
			}),
		);

		const { result } = renderHook(() => useEvmquery(QUERY_INPUT), {
			wrapper: createWrapper(fetchMock),
		});

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(isEvmQueryError(result.current.error)).toBe(true);
		expect(result.current.data).toBeUndefined();
	});

	it("surfaces a network failure (fetch rejection) as an error", async () => {
		fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

		const { result } = renderHook(() => useEvmquery(QUERY_INPUT), {
			wrapper: createWrapper(fetchMock),
		});

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.error).toBeInstanceOf(TypeError);
		expect(result.current.data).toBeUndefined();
	});
});

describe("auth header scoping", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = vi.fn<typeof fetch>();
	});

	it("sends x-api-key on the /query request", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(QUERY_RESPONSE));

		const { result } = renderHook(() => useEvmquery(QUERY_INPUT), {
			wrapper: createWrapper(fetchMock, "pk_test"),
		});

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		const request = fetchMock.mock.calls[0]?.[0] as Request;
		expect(request.headers.get("x-api-key")).toBe("pk_test");
	});
});

describe("client identity changes", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = vi.fn<typeof fetch>();
	});

	it("refetches an auto-fetching useEvmquery when the provider creates a new client", async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse(QUERY_RESPONSE));
		fetchMock.mockResolvedValueOnce(jsonResponse(QUERY_RESPONSE));

		let apiKey = "pk_a";
		const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
			<EvmqueryProvider apiKey={apiKey} fetch={fetchMock}>
				{children}
			</EvmqueryProvider>
		);

		const { rerender } = renderHook(() => useEvmquery(QUERY_INPUT), {
			wrapper: Wrapper,
		});

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		apiKey = "pk_b";
		rerender();

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});
	});

	it("does not auto-fire the lazy useEvmquery when the client changes while disabled", async () => {
		let apiKey = "pk_a";
		const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
			<EvmqueryProvider apiKey={apiKey} fetch={fetchMock}>
				{children}
			</EvmqueryProvider>
		);

		const { rerender } = renderHook(
			() => useEvmquery(QUERY_INPUT, { enabled: false }),
			{ wrapper: Wrapper },
		);

		await flushMicrotasks();
		expect(fetchMock).not.toHaveBeenCalled();

		apiKey = "pk_b";
		rerender();

		await flushMicrotasks();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("abort behavior", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = vi.fn<typeof fetch>();
	});

	it("aborts the superseded request when the input changes before it resolves", async () => {
		const first = deferred<Response>();
		const second = deferred<Response>();
		fetchMock.mockImplementationOnce(() => first.promise);
		fetchMock.mockImplementationOnce(() => second.promise);

		const { result, rerender } = renderHook(
			({ input }: { input: QueryExecuteRequestDto }) => useEvmquery(input),
			{
				wrapper: createWrapper(fetchMock),
				initialProps: { input: QUERY_INPUT },
			},
		);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});
		const firstRequest = fetchMock.mock.calls[0]?.[0] as Request;
		expect(firstRequest.signal.aborted).toBe(false);

		rerender({ input: QUERY_INPUT_B });

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2);
		});
		expect(firstRequest.signal.aborted).toBe(true);

		second.resolve(jsonResponse(QUERY_RESPONSE));
		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});
		expect(result.current.data).toEqual(QUERY_RESPONSE);

		// The superseded first request resolving afterwards must be ignored.
		first.resolve(
			jsonResponse({
				result: { value: "999", type: "sol_int" },
				meta: { blockNumber: "1", totalCalls: 1, totalRounds: 1 },
				performance: { latencyMs: 1 },
				credits: { consumed: 1 },
			}),
		);
		await flushMicrotasks();

		expect(result.current.data).toEqual(QUERY_RESPONSE);
	});

	it("aborts the in-flight request on unmount without throwing", async () => {
		const pending = deferred<Response>();
		fetchMock.mockImplementationOnce(() => pending.promise);

		const { unmount } = renderHook(() => useEvmquery(QUERY_INPUT), {
			wrapper: createWrapper(fetchMock),
		});

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});
		const request = fetchMock.mock.calls[0]?.[0] as Request;
		expect(request.signal.aborted).toBe(false);

		unmount();
		expect(request.signal.aborted).toBe(true);

		// Resolving after unmount must not throw or update any state.
		await act(async () => {
			pending.resolve(jsonResponse(QUERY_RESPONSE));
			await Promise.resolve();
			await Promise.resolve();
		});
	});

	it("swallows AbortError and clears isLoading when disabling mid-flight", async () => {
		const pending = deferred<Response>();
		fetchMock.mockImplementationOnce(() => pending.promise);

		const { result, rerender } = renderHook(
			({ enabled }: { enabled: boolean }) =>
				useEvmquery(QUERY_INPUT, { enabled }),
			{
				wrapper: createWrapper(fetchMock),
				initialProps: { enabled: true },
			},
		);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});
		expect(result.current.isLoading).toBe(true);
		const request = fetchMock.mock.calls[0]?.[0] as Request;

		// Disabling mid-flight aborts the (still latest, non-superseded) run.
		rerender({ enabled: false });
		expect(request.signal.aborted).toBe(true);

		// The aborted fetch rejects, exercising the isAbortError branch.
		pending.reject(new DOMException("Aborted", "AbortError"));

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});
		expect(result.current.error).toBeUndefined();
		expect(result.current.data).toBeUndefined();
	});
});
