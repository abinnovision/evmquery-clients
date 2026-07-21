import { useAsyncResource } from "./use-async-resource";
import { useEvmQueryClient } from "./use-evm-query-client";

import type { EvmQueryHookOptions, EvmQueryResource } from "./types";
import type {
	ChainsResponseDto,
	QueryDescribeRequestDto,
	QueryDescribeResponseDto,
	QueryExecuteRequestDto,
	QueryExecuteResponseDto,
	QueryValidateRequestDto,
	QueryValidateResponseDto,
	UsageStatsResponseDto,
} from "@evmquery/sdk";

/**
 * Fetches the list of chains supported by evmquery. Auto-fetches on mount.
 */
export const useChains = (
	options?: EvmQueryHookOptions,
): EvmQueryResource<ChainsResponseDto> => {
	const client = useEvmQueryClient();

	return useAsyncResource(
		/*
		 * With throwOnError, the client rejects on non-OK responses AND on
		 * network/abort failures, so `data` is always present once the
		 * promise resolves (TypeScript confirms this, no assertion needed).
		 */
		async (signal) =>
			(await client.listChains({ signal, throwOnError: true })).data,
		[client],
		options,
	);
};

/**
 * Fetches usage statistics for the current API key. Auto-fetches on mount.
 */
export const useUsage = (
	options?: EvmQueryHookOptions,
): EvmQueryResource<UsageStatsResponseDto> => {
	const client = useEvmQueryClient();

	return useAsyncResource(
		/*
		 * With throwOnError, the client rejects on non-OK responses AND on
		 * network/abort failures, so `data` is always present once the
		 * promise resolves (TypeScript confirms this, no assertion needed).
		 */
		async (signal) => (await client.usage({ signal, throwOnError: true })).data,
		[client],
		options,
	);
};

/**
 * Validates a query expression. Auto-fetches on mount and whenever `input` changes.
 */
export const useValidateExpression = (
	input: QueryValidateRequestDto,
	options?: EvmQueryHookOptions,
): EvmQueryResource<QueryValidateResponseDto> => {
	const client = useEvmQueryClient();
	const key = JSON.stringify(input);

	return useAsyncResource(
		/*
		 * With throwOnError, the client rejects on non-OK responses AND on
		 * network/abort failures, so `data` is always present once the
		 * promise resolves (TypeScript confirms this, no assertion needed).
		 */
		async (signal) =>
			(await client.validate({ body: input, signal, throwOnError: true })).data,
		[client, key],
		options,
	);
};

/**
 * Describes the schema available for a query. Auto-fetches on mount and whenever `input` changes.
 */
export const useDescribeSchema = (
	input: QueryDescribeRequestDto,
	options?: EvmQueryHookOptions,
): EvmQueryResource<QueryDescribeResponseDto> => {
	const client = useEvmQueryClient();
	const key = JSON.stringify(input);

	return useAsyncResource(
		/*
		 * With throwOnError, the client rejects on non-OK responses AND on
		 * network/abort failures. The assertion below is still needed because
		 * `QueryDescribeResponseDto` is generated as `unknown` upstream, so
		 * TypeScript can't itself prove `data` is defined here.
		 */
		async (signal) =>
			(await client.describe({ body: input, signal, throwOnError: true }))
				.data!,
		[client, key],
		options,
	);
};

/**
 * Executes a query. Lazy by default (credit-safety, since executing a query
 * consumes credits), opt in with `enabled: true` or trigger manually via
 * the returned `refetch`.
 */
export const useEvmQuery = (
	input: QueryExecuteRequestDto,
	options?: EvmQueryHookOptions,
): EvmQueryResource<QueryExecuteResponseDto> => {
	const client = useEvmQueryClient();
	const key = JSON.stringify(input);
	const enabled = options?.enabled ?? false;

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
