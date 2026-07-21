import { use, useCallback, useEffect, useRef, useState } from "react";

import { toQueryKey } from "./query-key";
import { useEvmQueryClient } from "./use-evm-query-client";

import type { EvmQuerySuspenseResource } from "./types";
import type {
	EvmQueryClient,
	QueryExecuteRequestDto,
	QueryExecuteResponseDto,
} from "@evmquery/sdk";

interface QueryMemo<T> {
	key: string;
	client: EvmQueryClient;
	token: number;
	controller: AbortController;
	promise: Promise<T>;
}

/**
 * Executes a query and suspends the nearest `<Suspense>` boundary until it
 * resolves, via React 19's native `use()`. Rejections propagate to the
 * nearest error boundary.
 *
 * There is no shared cache: each component instance memoizes its own
 * promise, keyed by `input` (JSON-serialized) and client identity, so
 * re-rendering with the same input reuses the same promise instead of
 * issuing a new request.
 */
export const useEvmQuerySuspense = (
	input: QueryExecuteRequestDto,
): EvmQuerySuspenseResource<QueryExecuteResponseDto> => {
	const client = useEvmQueryClient();
	const key = toQueryKey(input);
	const [refetchToken, setRefetchToken] = useState(0);

	const memoRef = useRef<QueryMemo<QueryExecuteResponseDto> | null>(null);

	if (
		!memoRef.current ||
		memoRef.current.key !== key ||
		memoRef.current.client !== client ||
		memoRef.current.token !== refetchToken
	) {
		const controller = new AbortController();

		memoRef.current = {
			key,
			client,
			token: refetchToken,
			controller,
			promise: client
				.query({ body: input, signal: controller.signal, throwOnError: true })
				.then((response) => response.data),
		};
	}

	const memo = memoRef.current;

	/*
	 * Best-effort, post-commit abort only. Cleanup runs when a committed
	 * render is superseded (key/client/refetchToken changed) or unmounts,
	 * aborting the PREVIOUS controller -- never the one backing the promise
	 * about to be read by `use()` below. A render that suspends before
	 * committing never runs this cleanup, so the in-flight request behind a
	 * still-pending `use()` cannot be cancelled from here; that gap is
	 * inherent to `use()`, not a bug.
	 */
	useEffect(() => {
		return () => {
			memo.controller.abort();
		};
	}, [memo]);

	const refetch = useCallback(() => {
		setRefetchToken((current) => current + 1);
	}, []);

	const data = use(memo.promise);

	return { data, refetch };
};
