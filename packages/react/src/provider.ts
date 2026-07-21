import { createEvmQueryClient } from "@evmquery/sdk";
import { createElement, useMemo } from "react";

import { EvmQueryContext } from "./context";

import type { ReactElement, PropsWithChildren } from "react";

export interface EvmQueryProviderProps extends PropsWithChildren {
	/**
	 * API key sent as the `X-API-Key` header on authenticated endpoints.
	 */
	apiKey?: string;

	/**
	 * Override the API base URL. Defaults to `https://api.evmquery.com/api/v1`.
	 */
	baseUrl?: string;

	/**
	 * Additional headers merged into every request.
	 *
	 * Should be referentially stable (e.g. memoized) so the underlying
	 * client is not recreated on every render.
	 */
	headers?: Record<string, string>;

	/**
	 * Custom fetch implementation. Useful for proxies, retry middleware, or testing.
	 *
	 * Should be referentially stable (e.g. memoized) so the underlying
	 * client is not recreated on every render.
	 */
	fetch?: typeof fetch;
}

/**
 * Provides an `EvmQueryClient` instance to all descendant hooks via context.
 */
export const EvmQueryProvider = ({
	apiKey,
	baseUrl,
	headers,
	fetch: customFetch,
	children,
}: EvmQueryProviderProps): ReactElement => {
	const client = useMemo(
		() =>
			createEvmQueryClient({
				apiKey,
				baseUrl,
				headers,
				fetch: customFetch,
			}),
		[apiKey, baseUrl, headers, customFetch],
	);

	return createElement(EvmQueryContext.Provider, { value: client }, children);
};
