import { evmQueryRequest } from "../../transport/request";

import type {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
} from "n8n-workflow";

/**
 * Usage.Get takes no input.
 */
const getUsageFields: INodeProperties[] = [];

interface UsageStatsResponse {
	credits: { used: number; allowance: number; remaining: number };
	tier: string;
	periodStart: string;
	periodEnd: string;
}

/**
 * Usage.Get → a single n8n item representing the current credit snapshot.
 * Left in the API's native shape so workflows can alert on
 * `credits.remaining` without re-mapping.
 */
async function executeGetUsage(
	this: IExecuteFunctions,
	_itemIndex: number,
): Promise<IDataObject> {
	const response = await evmQueryRequest<UsageStatsResponse>(this, {
		method: "GET",
		path: "/usage",
	});

	return { ...response } satisfies IDataObject;
}

export { executeGetUsage, getUsageFields };
export type { UsageStatsResponse };
