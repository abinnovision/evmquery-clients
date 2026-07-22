import { createEvmqueryClient } from "@evmquery/sdk";
import { createElement, useMemo } from "react";

import { EvmqueryContext } from "./context";

import type { ReactElement, PropsWithChildren } from "react";

export interface EvmqueryProviderProps extends PropsWithChildren {
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
 * Provides an `EvmqueryClient` instance to all descendant hooks via context.
 */
export const EvmqueryProvider = ({
	apiKey,
	baseUrl,
	headers,
	fetch: customFetch,
	children,
}: EvmqueryProviderProps): ReactElement => {
	const client = useMemo(
		() =>
			createEvmqueryClient({
				apiKey,
				baseUrl,
				headers,
				fetch: customFetch,
			}),
		[apiKey, baseUrl, headers, customFetch],
	);

	return createElement(EvmqueryContext.Provider, { value: client }, children);
};
