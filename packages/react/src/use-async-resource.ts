import { useCallback, useEffect, useRef, useState } from "react";

import type { EvmQueryResource } from "./types";

const isAbortError = (err: unknown): boolean =>
	(err instanceof DOMException && err.name === "AbortError") ||
	(err instanceof Error && err.name === "AbortError");

/**
 * Internal hook backing all public query hooks. Runs `runner` on mount and
 * whenever `deps` change, tracking loading/data/error state and exposing a
 * stable `refetch` for manual re-runs (works even when `enabled` is false).
 *
 * Aborts the in-flight request on cleanup and ignores results from
 * superseded runs or updates after unmount.
 */
export const useAsyncResource = <T>(
	runner: (signal: AbortSignal) => Promise<T>,
	deps: readonly unknown[],
	options?: { enabled?: boolean },
): EvmQueryResource<T> => {
	const enabled = options?.enabled ?? true;

	const [data, setData] = useState<T | undefined>(undefined);
	const [error, setError] = useState<Error | undefined>(undefined);
	const [isLoading, setIsLoading] = useState(false);

	const runnerRef = useRef(runner);
	runnerRef.current = runner;

	const mountedRef = useRef(true);
	const runIdRef = useRef(0);
	const controllerRef = useRef<AbortController | null>(null);

	useEffect(() => {
		mountedRef.current = true;

		return () => {
			mountedRef.current = false;
			controllerRef.current?.abort();
		};
	}, []);

	const execute = useCallback(() => {
		controllerRef.current?.abort();

		const controller = new AbortController();
		controllerRef.current = controller;

		const runId = ++runIdRef.current;

		setIsLoading(true);

		runnerRef
			.current(controller.signal)
			.then((result) => {
				if (!mountedRef.current || runIdRef.current !== runId) {
					return;
				}

				setData(result);
				setError(undefined);
				setIsLoading(false);
			})
			.catch((err: unknown) => {
				if (!mountedRef.current || runIdRef.current !== runId) {
					return;
				}

				if (isAbortError(err)) {
					setIsLoading(false);

					return;
				}

				setError(err instanceof Error ? err : new Error(String(err)));
				setIsLoading(false);
			});
	}, []);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		execute();

		return () => {
			controllerRef.current?.abort();
		};
	}, [enabled, execute, ...deps]);

	const refetch = useCallback(() => {
		execute();
	}, [execute]);

	return { data, error, isLoading, refetch };
};
