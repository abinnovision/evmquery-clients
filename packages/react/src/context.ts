import { createContext } from "react";

import type { EvmQueryClient } from "@evmquery/sdk";

/**
 * Holds the `EvmQueryClient` instance provided by `EvmQueryProvider`.
 * Not exported from the package root; consumers use `useEvmQueryClient`.
 */
export const EvmQueryContext = createContext<EvmQueryClient | null>(null);
