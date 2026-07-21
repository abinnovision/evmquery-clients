import { isEvmQueryError } from "@evmquery/sdk";
import {
	act,
	cleanup,
	render,
	renderHook,
	screen,
} from "@testing-library/react";
import { Component, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EvmqueryProvider } from "./provider";
import { useEvmqueryClient } from "./use-evmquery-client";
import { useEvmquerySuspense } from "./use-evmquery-suspense";

import type { EvmquerySuspenseResource } from "./types";
import type {
	QueryExecuteRequestDto,
	QueryExecuteResponseDto,
} from "@evmquery/sdk";
import type { ReactElement, ReactNode } from "react";

/*
 * Two testing-environment characteristics shape these tests:
 *
 * 1. React (development build) may render a component that suspends more
 *    than once before it ever commits -- it can discard an interrupted,
 *    never-committed attempt and retry from scratch, including re-running
 *    Hooks. So a single logical mount can call the underlying fetch mock
 *    more than once. Mocks must build a FRESH `Response` per call (a
 *    `Response` body can only be read once, so reusing one instance across
 *    calls makes the second read fail) and call-count assertions use
 *    *deltas* around a specific action (rerender, refetch, unmount) instead
 *    of an exact absolute count for an initial suspend.
 * 2. React's `use()` retry only reliably flushes to the DOM within the same
 *    `act(async () => { ... })` call that triggered the throw (the render
 *    or rerender that suspended); a later, separate `act`/`waitFor` call
 *    does not reliably pick up a retry from a fiber that suspended outside
 *    of it. So every assertion on post-resolution state wraps the
 *    triggering render call itself.
 *
 * A third characteristic rules out testing REJECTIONS through a full
 * `<Suspense>` + error-boundary DOM render: when a component's `use()`
 * promise rejects and that promise is freshly created (not cached across
 * attempts, per point 1 above), React's development build retries the
 * render to verify/report the error, which recreates another fresh,
 * not-yet-settled promise, which suspends again, which needs its own
 * verification retry once it rejects, and so on -- a confirmed, unbounded
 * (not just slow) loop under `act()`, reproduced with a minimal component
 * with no SDK/provider/error-boundary involved at all. So error propagation
 * below is verified one level down: through the exact expression the hook
 * evaluates (`client.query({ ..., throwOnError: true })`), without a
 * `<Suspense>` boundary in the way.
 */

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
		...init,
	});

/*
 * `act()` only runs its internal async flush loop (needed to let a
 * `use()` retry settle) when the callback returns a thenable. Wrapping
 * `fn` this way keeps that behavior without declaring an `async` function
 * that has no `await` inside it.
 */
const flush = (fn: () => void): Promise<void> =>
	act(() => {
		fn();

		return Promise.resolve();
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

interface ErrorBoundaryState {
	error: Error | undefined;
}

class ErrorBoundary extends Component<
	{ children: ReactNode },
	ErrorBoundaryState
> {
	public override state: ErrorBoundaryState = { error: undefined };

	public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	public override render(): ReactNode {
		if (this.state.error) {
			return <div data-testid="error">{this.state.error.message}</div>;
		}

		return this.props.children;
	}
}

const Harness = ({
	input,
	onRender,
}: {
	input: QueryExecuteRequestDto;
	onRender?: (
		resource: EvmquerySuspenseResource<QueryExecuteResponseDto>,
	) => void;
}): ReactElement => {
	const resource = useEvmquerySuspense(input);
	onRender?.(resource);

	return <div data-testid="data">{JSON.stringify(resource.data)}</div>;
};

const tree = (
	fetchMock: FetchMock,
	input: QueryExecuteRequestDto,
	onRender?: (
		resource: EvmquerySuspenseResource<QueryExecuteResponseDto>,
	) => void,
): ReactElement => (
	<EvmqueryProvider fetch={fetchMock}>
		<ErrorBoundary>
			<Suspense fallback={<div data-testid="fallback">Loading...</div>}>
				<Harness input={input} onRender={onRender} />
			</Suspense>
		</ErrorBoundary>
	</EvmqueryProvider>
);

describe("useEvmquerySuspense", () => {
	let fetchMock: FetchMock;

	beforeEach(() => {
		fetchMock = vi.fn<typeof fetch>();
	});

	afterEach(() => {
		cleanup();
	});

	it("renders the fallback while the query is in flight", () => {
		const pending = deferred<Response>();
		fetchMock.mockImplementation(() => pending.promise);

		render(tree(fetchMock, QUERY_INPUT));

		expect(screen.getByTestId("fallback")).toBeTruthy();
	});

	it("renders data once the query resolves", async () => {
		fetchMock.mockImplementation(() =>
			Promise.resolve(jsonResponse(QUERY_RESPONSE)),
		);

		await flush(() => {
			render(tree(fetchMock, QUERY_INPUT));
		});

		expect(screen.getByTestId("data").textContent).toBe(
			JSON.stringify(QUERY_RESPONSE),
		);
	});

	it("rejects with an EvmQueryError for a non-OK response (surfaced by use() to the error boundary)", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ message: "invalid request" }), {
				status: 400,
				statusText: "Bad Request",
				headers: { "Content-Type": "application/json" },
			}),
		);

		const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
			<EvmqueryProvider fetch={fetchMock}>{children}</EvmqueryProvider>
		);
		const { result } = renderHook(() => useEvmqueryClient(), { wrapper });

		const controller = new AbortController();
		const rejection = result.current
			.query({
				body: QUERY_INPUT,
				signal: controller.signal,
				throwOnError: true,
			})
			.then((response) => response.data);

		await expect(rejection).rejects.toSatisfy(isEvmQueryError);
	});

	it("rejects with the network error for a fetch failure (surfaced by use() to the error boundary)", async () => {
		fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

		const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
			<EvmqueryProvider fetch={fetchMock}>{children}</EvmqueryProvider>
		);
		const { result } = renderHook(() => useEvmqueryClient(), { wrapper });

		const controller = new AbortController();
		const rejection = result.current
			.query({
				body: QUERY_INPUT,
				signal: controller.signal,
				throwOnError: true,
			})
			.then((response) => response.data);

		await expect(rejection).rejects.toBeInstanceOf(TypeError);
	});

	it("reuses the same promise across re-renders with the same input", async () => {
		fetchMock.mockImplementation(() =>
			Promise.resolve(jsonResponse(QUERY_RESPONSE)),
		);

		let rerender: ReturnType<typeof render>["rerender"] | undefined;
		await flush(() => {
			({ rerender } = render(tree(fetchMock, QUERY_INPUT)));
		});

		const countAfterMount = fetchMock.mock.calls.length;

		await flush(() => {
			rerender?.(tree(fetchMock, { ...QUERY_INPUT }));
		});

		expect(fetchMock.mock.calls.length).toBe(countAfterMount);
	});

	it("re-suspends and issues a new request when the input changes, aborting the previous one", async () => {
		fetchMock.mockImplementation(() =>
			Promise.resolve(jsonResponse(QUERY_RESPONSE)),
		);

		let rerender: ReturnType<typeof render>["rerender"] | undefined;
		await flush(() => {
			({ rerender } = render(tree(fetchMock, QUERY_INPUT)));
		});

		const countAfterMount = fetchMock.mock.calls.length;
		const firstRequest = fetchMock.mock.calls[countAfterMount - 1]?.[0] as
			| Request
			| undefined;
		expect(firstRequest?.signal.aborted).toBe(false);

		await flush(() => {
			rerender?.(tree(fetchMock, QUERY_INPUT_B));
		});

		expect(fetchMock.mock.calls.length).toBeGreaterThan(countAfterMount);
		const secondRequest = fetchMock.mock.calls[
			fetchMock.mock.calls.length - 1
		]?.[0] as Request;
		expect(await secondRequest.clone().json()).toEqual(QUERY_INPUT_B);
		expect(firstRequest?.signal.aborted).toBe(true);
	});

	it("refetch() issues a new request and re-suspends", async () => {
		fetchMock.mockImplementation(() =>
			Promise.resolve(jsonResponse(QUERY_RESPONSE)),
		);

		let latest: EvmquerySuspenseResource<QueryExecuteResponseDto> | undefined;
		await flush(() => {
			render(
				tree(fetchMock, QUERY_INPUT, (resource) => {
					latest = resource;
				}),
			);
		});

		const countAfterMount = fetchMock.mock.calls.length;

		await flush(() => {
			latest?.refetch();
		});

		expect(fetchMock.mock.calls.length).toBeGreaterThan(countAfterMount);
		expect(screen.getByTestId("data").textContent).toBe(
			JSON.stringify(QUERY_RESPONSE),
		);
	});

	it("aborts the controller on unmount", async () => {
		fetchMock.mockImplementation(() =>
			Promise.resolve(jsonResponse(QUERY_RESPONSE)),
		);

		let unmount: ReturnType<typeof render>["unmount"] | undefined;
		await flush(() => {
			({ unmount } = render(tree(fetchMock, QUERY_INPUT)));
		});

		const request = fetchMock.mock.calls[
			fetchMock.mock.calls.length - 1
		]?.[0] as Request | undefined;
		expect(request?.signal.aborted).toBe(false);

		unmount?.();

		expect(request?.signal.aborted).toBe(true);
	});
});
