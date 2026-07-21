/**
 * Serializes a query input to a cache key; `JSON.stringify` key order
 * is not stable across equivalent objects.
 */
export const toQueryKey = (input: unknown): string =>
	`query|${JSON.stringify(input)}`;
