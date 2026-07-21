import { useContext } from "react";

import { EvmQueryContext } from "./context";

import type { EvmQueryClient } from "@evmquery/sdk";

/**
 * Returns the `EvmQueryClient` provided by the nearest `EvmQueryProvider`.
 * Throws if no provider is present in the tree.
 */
export const useEvmQueryClient = (): EvmQueryClient => {
	const client = useContext(EvmQueryContext);

	if (!client) {
		throw new Error(
			"useEvmQueryClient must be used within an <EvmQueryProvider>",
		);
	}

	return client;
};
