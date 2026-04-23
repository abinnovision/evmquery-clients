import { executeListChains } from "./actions/chain";
import {
	executeQueryDescribe,
	executeQueryExecute,
	executeQueryValidate,
} from "./actions/query";
import { executeGetUsage } from "./actions/usage";
import { description } from "./description";
import { methods } from "./methods";

import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from "n8n-workflow";
import type { IDataObject } from "n8n-workflow";

/**
 * Builds the per-item output envelope n8n expects. We always return one or
 * more `INodeExecutionData` wrappers per input item so downstream nodes see
 * consistent pairing behaviour.
 */
function toExecutionData(
	result: IDataObject | IDataObject[],
	itemIndex: number,
): INodeExecutionData[] {
	const payloads = Array.isArray(result) ? result : [result];

	return payloads.map((json) => ({ json, pairedItem: { item: itemIndex } }));
}

export class EvmQuery implements INodeType {
	public description: INodeTypeDescription = description;

	public methods = methods;

	/**
	 * Thin dispatcher. Each operation lives in `./actions/*` and returns
	 * either a single `IDataObject` (one-item) or `IDataObject[]` (fan-out).
	 * We apply itemwise continueOnFail handling so the node plays well with
	 * batched inputs and error workflows.
	 */
	public async execute(
		this: IExecuteFunctions,
	): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		/*
		 * Sequential processing is intentional: each op makes an authenticated
		 * HTTP call, and running them concurrently would defeat evmquery's
		 * per-key rate limit and make per-item error handling much harder.
		 */
		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter("operation", i);

			try {
				if (operation === "listChains") {
					// eslint-disable-next-line no-await-in-loop -- see loop comment
					const result = await executeListChains.call(this, i);
					returnData.push(...toExecutionData(result, i));

					continue;
				}

				if (operation === "getUsage") {
					// eslint-disable-next-line no-await-in-loop -- see loop comment
					const result = await executeGetUsage.call(this, i);
					returnData.push(...toExecutionData(result, i));

					continue;
				}

				if (operation === "describe") {
					// eslint-disable-next-line no-await-in-loop -- see loop comment
					const result = await executeQueryDescribe.call(this, i);
					returnData.push(...toExecutionData(result, i));

					continue;
				}

				if (operation === "execute") {
					// eslint-disable-next-line no-await-in-loop -- see loop comment
					const result = await executeQueryExecute.call(this, i);
					returnData.push(...toExecutionData(result, i));

					continue;
				}

				if (operation === "validate") {
					// eslint-disable-next-line no-await-in-loop -- see loop comment
					const result = await executeQueryValidate.call(this, i);
					returnData.push(...toExecutionData(result, i));

					continue;
				}

				/*
				 * Unknown operation — fall through to an error so the UI surfaces
				 * a clear message instead of silently returning nothing.
				 */
				throw new Error(`Unsupported operation: ${operation}`);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});

					continue;
				}

				throw error;
			}
		}

		return [returnData];
	}
}
