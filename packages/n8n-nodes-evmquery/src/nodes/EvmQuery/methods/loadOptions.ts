import { evmQueryRequest } from "../transport/request";

import type { ILoadOptionsFunctions, INodePropertyOptions } from "n8n-workflow";

/**
 * Static fallback used when `/chains` is unreachable (network error, fresh
 * credential with no test ping, etc.). Keeping at least the three canonical
 * mainnets means the chain dropdown is never empty, which the n8n UI renders
 * as a broken form field.
 */
const STATIC_CHAINS: readonly INodePropertyOptions[] = [
	{ name: "Ethereum (1)", value: "evm_ethereum" },
	{ name: "Base (8453)", value: "evm_base" },
	{ name: "BNB Smart Chain (56)", value: "evm_bnb_mainnet" },
];

interface ChainsResponse {
	chains: Array<{ id: string; evmChainId: number; name: string }>;
}

/**
 * `listChains` → feeds the dynamic Chain dropdown in Query.Execute / .Validate
 * / .Describe. Sorts alphabetically and falls back to a static list on any
 * failure so the UI remains usable.
 */
async function listChains(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	try {
		const response = await evmQueryRequest<ChainsResponse>(this, {
			method: "GET",
			path: "/chains",
		});

		const options = response.chains.map<INodePropertyOptions>((chain) => ({
			name: `${chain.name} (${String(chain.evmChainId)})`,
			value: chain.id,
		}));

		options.sort((a, b) => a.name.localeCompare(b.name));

		return options;
	} catch {
		return [...STATIC_CHAINS];
	}
}

export { listChains, STATIC_CHAINS };
