import { EvmqueryError } from "./errors";
import { type Client, createClient } from "./generated/client";
import * as sdk from "./generated/sdk.gen";

const DEFAULT_BASE_URL = "https://api.evmquery.com/api/v1";

const ALIASES = {
	listChains: sdk.chainsControllerListChains,
	query: sdk.queryControllerExecuteQuery,
	validate: sdk.queryControllerValidateExpression,
	describe: sdk.queryControllerDescribeSchema,
	usage: sdk.usageControllerGetUsageStats,
} as const;

type Aliases = typeof ALIASES;

type SdkCallable = (options: Record<string, unknown>) => unknown;

export interface EvmqueryClientOptions {
	/**
	 * API key sent as the `X-API-Key` header on authenticated endpoints.
	 */
	apiKey?: string;

	/**
	 * Override the API base URL. Defaults to `https://api.evmquery.com/api/v1`.
	 */
	baseUrl?: string;

	/**
	 * Custom fetch implementation. Useful for proxies, retry middleware, or testing.
	 */
	fetch?: typeof fetch;

	/**
	 * Additional headers merged into every request.
	 */
	headers?: Record<string, string>;
}

export type EvmqueryClient = { client: Client } & {
	[K in keyof Aliases]: Aliases[K];
};

/**
 * Creates a new EvmqueryClient instance with the given options.
 *
 * @param options Configuration options for the client, including API key, base URL, custom fetch, and additional headers.
 */
export const createEvmqueryClient = (
	options: EvmqueryClientOptions = {},
): EvmqueryClient => {
	const client = createClient({
		baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
		// Surface interceptor errors as promise rejections, not on `error`.
		throwOnError: true,
		...(options.fetch ? { fetch: options.fetch } : {}),
		...(options.apiKey ? { auth: options.apiKey } : {}),
		headers: { ...options.headers },
	});

	// Add a response interceptor to throw EvmqueryError on non-OK responses
	client.interceptors.response.use(async (response) => {
		if (!response.ok) {
			throw await EvmqueryError.fromResponse(response);
		}

		return response;
	});

	const bound: Record<string, unknown> = { client };
	for (const [alias, fn] of Object.entries(ALIASES)) {
		const callable = fn as unknown as SdkCallable;
		bound[alias] = (callOptions: Record<string, unknown> = {}) =>
			callable({ client, ...callOptions });
	}

	return bound as EvmqueryClient;
};
