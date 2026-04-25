import { parseContextTypes, parseContracts } from "./shared";
import { evmQueryRequest } from "../../transport/request";

import type {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
} from "n8n-workflow";

/**
 * Query.Describe has no operation-private fields — it reuses the shared
 * Chain + Contracts + Context Types inputs from `./shared.ts`. The empty
 * export keeps the dispatcher uniform with the other Query operations.
 */
export const describeFields: INodeProperties[] = [];

/**
 * Query.Describe → POST /query/describe with `{ chain, schema: { contracts,
 * context } }`. The `context` key is elided entirely when no context types
 * are supplied because the API treats an empty object as "no context" but
 * we'd rather not send a key that isn't meaningful.
 */
export async function executeQueryDescribe(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const chain = this.getNodeParameter("chainId", itemIndex) as string;
	const contractsRaw = this.getNodeParameter("contracts", itemIndex, {});
	const contextRaw = this.getNodeParameter("context", itemIndex, {});

	const contracts = parseContracts(contractsRaw);
	const contextTypes = parseContextTypes(contextRaw);

	const schema: IDataObject = { contracts };
	if (Object.keys(contextTypes).length > 0) {
		schema["context"] = contextTypes;
	}

	return await evmQueryRequest<IDataObject>(this, {
		method: "POST",
		path: "/query/describe",
		body: { chain, schema } satisfies IDataObject,
	});
}
