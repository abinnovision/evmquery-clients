import { parseContextTypes, parseContracts } from "./shared";
import { evmQueryRequest } from "../../transport/request";

import type {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
} from "n8n-workflow";

/**
 * Validate shares its property blocks with Execute (expression, context,
 * options) via `./shared.ts`, so `validateFields` stays empty.
 */
const validateFields: INodeProperties[] = [];

/**
 * Query.Validate → POST /query/validate with `{ chain, expression, schema }`.
 * Validate is cheap on the server (no execution), so we never forward
 * runtime context values — only the declared types matter here. The API
 * response `{ valid, type, estimatedCredits }` is returned verbatim.
 */
async function executeQueryValidate(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const chain = this.getNodeParameter("chainId", itemIndex) as string;
	const expression = this.getNodeParameter("expression", itemIndex) as string;
	const contractsRaw = this.getNodeParameter("contracts", itemIndex, {});
	const contextRaw = this.getNodeParameter("context", itemIndex, {});

	const contracts = parseContracts(contractsRaw);
	const contextTypes = parseContextTypes(contextRaw);

	const schema: IDataObject = { contracts };
	if (Object.keys(contextTypes).length > 0) {
		schema["context"] = contextTypes;
	}

	const response = await evmQueryRequest<IDataObject>(this, {
		method: "POST",
		path: "/query/validate",
		body: { chain, expression, schema } satisfies IDataObject,
	});

	return response;
}

export { executeQueryValidate, validateFields };
