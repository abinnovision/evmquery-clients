import { mapEvmQueryError } from "./errors";

import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
} from "n8n-workflow";

/**
 * Any of the n8n execution contexts that expose `getCredentials`,
 * `getNode`, and `helpers.httpRequestWithAuthentication`. Used so a single
 * transport can be called from `execute`, `loadOptions`, `poll`, and hooks.
 */
type EvmQueryContext =
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IPollFunctions
	| IHookFunctions;

interface EvmQueryRequestOptions {
	method: "GET" | "POST";
	/** Path appended to `EVMQUERY_BASE_URL` (must start with "/"). */
	path: string;
	body?: IDataObject;
	qs?: IDataObject;
}

/**
 * Base URL for all evmquery API calls. There is only one deployment, so this
 * is a compile-time constant rather than a credential field.
 */
const EVMQUERY_BASE_URL = "https://api.evmquery.com/api/v1";

/**
 * Thin wrapper around `httpRequestWithAuthentication` that injects the
 * evmquery credential and translates any HTTP failure into a `NodeApiError`
 * via `mapEvmQueryError`.
 *
 * Every evmquery operation goes through this, so error messages stay
 * consistent across the node and the AI tool surface.
 */
async function evmQueryRequest<T = unknown>(
	ctx: EvmQueryContext,
	options: EvmQueryRequestOptions,
): Promise<T> {
	const requestOptions: IHttpRequestOptions = {
		method: options.method,
		url: `${EVMQUERY_BASE_URL}${options.path}`,
		json: true,
	};
	if (options.body !== undefined) {
		requestOptions.body = options.body;
	}

	if (options.qs !== undefined) {
		requestOptions.qs = options.qs;
	}

	try {
		const response: unknown =
			await ctx.helpers.httpRequestWithAuthentication.call(
				ctx,
				"evmQueryApi",
				requestOptions,
			);

		return response as T;
	} catch (error) {
		throw mapEvmQueryError(ctx.getNode(), error);
	}
}

export { evmQueryRequest, EVMQUERY_BASE_URL };
export type { EvmQueryContext, EvmQueryRequestOptions };
