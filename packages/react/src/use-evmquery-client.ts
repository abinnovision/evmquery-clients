import { useContext } from "react";

import { EvmqueryContext } from "./context";

import type { EvmQueryClient } from "@evmquery/sdk";

/**
 * Returns the `EvmQueryClient` provided by the nearest `EvmqueryProvider`.
 * Throws if no provider is present in the tree.
 */
export const useEvmqueryClient = (): EvmQueryClient => {
	const client = useContext(EvmqueryContext);

	if (!client) {
		throw new Error(
			"useEvmqueryClient must be used within an <EvmqueryProvider>",
		);
	}

	return client;
};
