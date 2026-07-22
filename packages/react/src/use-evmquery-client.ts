import { useContext } from "react";

import { EvmqueryContext } from "./context";

import type { EvmqueryClient } from "@evmquery/sdk";

/**
 * Returns the `EvmqueryClient` provided by the nearest `EvmqueryProvider`.
 * Throws if no provider is present in the tree.
 */
export const useEvmqueryClient = (): EvmqueryClient => {
	const client = useContext(EvmqueryContext);

	if (!client) {
		throw new Error(
			"useEvmqueryClient must be used within an <EvmqueryProvider>",
		);
	}

	return client;
};
