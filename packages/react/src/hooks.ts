import { useAsyncResource } from "./use-async-resource";
import { useEvmQueryClient } from "./use-evm-query-client";

import type { EvmQueryHookOptions, EvmQueryResource } from "./types";
import type {
	QueryExecuteRequestDto,
	QueryExecuteResponseDto,
} from "@evmquery/sdk";

/**
 * Executes a query. Auto-fetches on mount and whenever `input` changes.
 * Gate with `{ enabled: false }` if the query should not run automatically
 * (executing a query consumes credits); trigger it later via `refetch`.
 */
export const useEvmQuery = (
	input: QueryExecuteRequestDto,
	options?: EvmQueryHookOptions,
): EvmQueryResource<QueryExecuteResponseDto> => {
	const client = useEvmQueryClient();
	const key = JSON.stringify(input);
	const enabled = options?.enabled ?? true;

	return useAsyncResource(
		/*
		 * With throwOnError, the client rejects on non-OK responses AND on
		 * network/abort failures, so `data` is always present once the
		 * promise resolves (TypeScript confirms this, no assertion needed).
		 */
		async (signal) =>
			(await client.query({ body: input, signal, throwOnError: true })).data,
		[client, key],
		{ enabled },
	);
};
