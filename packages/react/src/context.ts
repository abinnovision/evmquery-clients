import { createContext } from "react";

import type { EvmqueryClient } from "@evmquery/sdk";

/**
 * Holds the `EvmqueryClient` instance provided by `EvmqueryProvider`.
 * Not exported from the package root; consumers use `useEvmqueryClient`.
 */
export const EvmqueryContext = createContext<EvmqueryClient | null>(null);
