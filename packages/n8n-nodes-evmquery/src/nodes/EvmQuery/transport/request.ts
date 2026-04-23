import { mapEvmQueryError } from "./errors";

import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from "n8n-workflow";

/**
 * Any of the n8n execution contexts that expose `getCredentials`,
 * `getNode`, and `helpers.httpRequestWithAuthentication`. Used so a single
 * transport can be called from `execute`, `loadOptions`, and future hooks.
 */
type EvmQueryContext =
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IHookFunctions;

interface EvmQueryRequestOptions {
	method: "GET" | "POST";
	/** Path appended to the credential's baseUrl (must start with "/"). */
	path: string;
	body?: IDataObject;
	qs?: IDataObject;
}

const DEFAULT_BASE_URL = "https://api.evmquery.com/api";

/**
 * Thin wrapper around `httpRequestWithAuthentication` that injects the
 * evmquery credential, resolves the base URL, and translates any HTTP
 * failure into a `NodeApiError` via `mapEvmQueryError`.
 *
 * Every evmquery operation goes through this, so error messages stay
 * consistent across the node and the AI tool surface.
 */
async function evmQueryRequest<T = unknown>(
	ctx: EvmQueryContext,
	options: EvmQueryRequestOptions,
): Promise<T> {
	const credentials = await ctx.getCredentials("evmQueryApi");
	const baseUrl =
		typeof credentials["baseUrl"] === "string" && credentials["baseUrl"]
			? credentials["baseUrl"]
			: DEFAULT_BASE_URL;

	const requestOptions: IHttpRequestOptions = {
		method: options.method,
		url: `${baseUrl}${options.path}`,
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

export { evmQueryRequest };
export type { EvmQueryContext, EvmQueryRequestOptions };
