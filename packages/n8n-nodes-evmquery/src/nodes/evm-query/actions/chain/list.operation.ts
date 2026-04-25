import { evmQueryRequest } from "../../transport/request";

import type {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
} from "n8n-workflow";

/**
 * No operation-specific fields — Chain.List takes no input. The empty export
 * keeps the action surface uniform with Usage.Get and the forthcoming Query.*
 * operations so `description.ts` can splice them in consistently.
 */
export const listChainsFields: INodeProperties[] = [];

export interface ChainsResponse {
	chains: Array<{ id: string; evmChainId: number; name: string }>;
}

/**
 * Chain.List → one n8n item per supported chain. We intentionally unwrap the
 * `{ chains: [...] }` envelope because downstream workflow steps (IF, Set,
 * Loop) are easier to author when each chain is its own item.
 */
export async function executeListChains(
	this: IExecuteFunctions,
	_itemIndex: number,
): Promise<IDataObject[]> {
	const response = await evmQueryRequest<ChainsResponse>(this, {
		method: "GET",
		path: "/chains",
	});

	return response.chains.map((chain) => ({ ...chain }) satisfies IDataObject);
}
