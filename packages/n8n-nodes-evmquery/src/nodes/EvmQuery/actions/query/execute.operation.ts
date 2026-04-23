import {
	parseContextTypes,
	parseContextValues,
	parseContracts,
} from "./shared";
import { expandPreset, PRESET_CUSTOM, presetParamKey } from "../../presets";
import { evmQueryRequest } from "../../transport/request";

import type { SolType } from "./shared";
import type {
	GenericValue,
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
} from "n8n-workflow";

/**
 * Execute-specific fields live on the shared operation selector — expression,
 * output format, and options are common across Execute/Validate, so they
 * belong in `./shared.ts`. The empty `executeFields` export keeps the
 * dispatcher wiring symmetrical.
 */
const executeFields: INodeProperties[] = [];

interface QueryExecuteResponse {
	result: { value: unknown; type: string };
	meta?: {
		blockNumber?: number;
		totalCalls?: number;
		totalRounds?: number;
	} | null;
	performance?: { latencyMs?: number } | null;
	credits?: { consumed?: number } | null;
}

/**
 * Shapes a Simple-mode output for downstream nodes / AI callers. Object
 * results are spread at the top level so fields like `name` or `symbol` are
 * directly addressable; scalar results are wrapped under `value`. Meta is
 * always attached under `$meta` to avoid colliding with user field names.
 * All envelope side-car fields are accessed defensively — the API may omit
 * `meta` / `performance` / `credits` entirely depending on the query (e.g.
 * pure constant expressions that do no on-chain reads).
 */
function toSimpleOutput(response: QueryExecuteResponse): IDataObject {
	const meta: IDataObject = {
		type: response.result.type,
		blockNumber: response.meta?.blockNumber,
		credits: response.credits?.consumed,
		rounds: response.meta?.totalRounds,
		onChainCalls: response.meta?.totalCalls,
		latencyMs: response.performance?.latencyMs,
	};

	const value = response.result.value;
	if (value !== null && typeof value === "object" && !Array.isArray(value)) {
		return { ...(value as IDataObject), $meta: meta };
	}

	return { value: value as GenericValue, $meta: meta };
}

/**
 * Query.Execute → POST /query. Assembles the full evmquery request envelope:
 *
 *   { chain, expression, schema: { contracts, context? },
 *     context?: <runtime values>, options?: { timeoutMs } }
 *
 * Output is post-processed per `outputFormat` so AI Agents can consume a
 * flat object while power users can still opt into the full envelope.
 */
async function executeQueryExecute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const chain = this.getNodeParameter("chainId", itemIndex) as string;
	const presetId = this.getNodeParameter(
		"preset",
		itemIndex,
		PRESET_CUSTOM,
	) as string;
	const optionsRaw = this.getNodeParameter("options", itemIndex, {}) as {
		timeoutMs?: number;
		outputFormat?: "simple" | "raw";
	};
	const outputFormat = optionsRaw.outputFormat ?? "simple";

	let contracts: Record<string, { address: string }>;
	let contextTypes: Record<string, SolType>;
	let contextValues: Record<string, unknown>;
	let expression: string;

	if (presetId !== PRESET_CUSTOM) {
		/*
		 * Preset path: pull each preset input from its namespaced node param
		 * (`preset_<safeId>_<inputName>`) and let the preset template decide
		 * contracts, context shape, and expression. The rest of the
		 * request-assembly path below stays identical to the custom path.
		 */
		const expanded = expandPreset(presetId, (inputName) =>
			this.getNodeParameter(presetParamKey(presetId, inputName), itemIndex, ""),
		);
		contracts = expanded.contracts;
		contextTypes = expanded.contextTypes;
		contextValues = expanded.contextValues;
		expression = expanded.expression;
	} else {
		expression = this.getNodeParameter("expression", itemIndex) as string;
		const contractsRaw = this.getNodeParameter("contracts", itemIndex, {});
		const contextRaw = this.getNodeParameter("context", itemIndex, {});

		contracts = parseContracts(contractsRaw);
		contextTypes = parseContextTypes(contextRaw);
		contextValues = parseContextValues(contextRaw, contextTypes);
	}

	const schema: IDataObject = { contracts };
	if (Object.keys(contextTypes).length > 0) {
		schema["context"] = contextTypes;
	}

	const body: IDataObject = { chain, expression, schema };
	if (Object.keys(contextValues).length > 0) {
		body["context"] = contextValues;
	}

	if (
		typeof optionsRaw.timeoutMs === "number" &&
		Number.isFinite(optionsRaw.timeoutMs) &&
		optionsRaw.timeoutMs > 0
	) {
		body["options"] = { timeoutMs: optionsRaw.timeoutMs };
	}

	const response = await evmQueryRequest<QueryExecuteResponse>(this, {
		method: "POST",
		path: "/query",
		body,
	});

	if (outputFormat === "raw") {
		return response as unknown as IDataObject;
	}

	return toSimpleOutput(response);
}

export { executeFields, executeQueryExecute };
