import { createContext } from "react";

import type { EvmQueryClient } from "@evmquery/sdk";

/**
 * Holds the `EvmQueryClient` instance provided by `EvmqueryProvider`.
 * Not exported from the package root; consumers use `useEvmqueryClient`.
 */
export const EvmqueryContext = createContext<EvmQueryClient | null>(null);
