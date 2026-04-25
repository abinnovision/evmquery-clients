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
	IPollFunctions,
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
 * Parsed inputs to a `POST /query` call. Both the Execute action and the
 * EvmQueryTrigger poll path read node parameters and then hand off to
 * `runQueryExecute` with this shape — the action adds preset expansion and
 * output shaping around it, the trigger adds value-diffing state.
 */
interface QueryExecuteParams {
	chain: string;
	expression: string;
	contracts: Record<string, { address: string }>;
	contextTypes: Record<string, SolType>;
	contextValues: Record<string, unknown>;
	timeoutMs?: number;
}

/**
 * Pure request-assembly + transport for `POST /query`. Takes already-parsed
 * params (no node parameter reads, no output shaping) so it can be called
 * from any n8n context — `IExecuteFunctions` for the action node,
 * `IPollFunctions` for the trigger node.
 *
 * Request envelope:
 *   { chain, expression, schema: { contracts, context? },
 *     context?: <runtime values>, options?: { timeoutMs } }
 */
async function runQueryExecute(
	ctx: IExecuteFunctions | IPollFunctions,
	params: QueryExecuteParams,
): Promise<QueryExecuteResponse> {
	const schema: IDataObject = { contracts: params.contracts };
	if (Object.keys(params.contextTypes).length > 0) {
		schema["context"] = params.contextTypes;
	}

	const body: IDataObject = {
		chain: params.chain,
		expression: params.expression,
		schema,
	};
	if (Object.keys(params.contextValues).length > 0) {
		body["context"] = params.contextValues;
	}

	if (
		typeof params.timeoutMs === "number" &&
		Number.isFinite(params.timeoutMs) &&
		params.timeoutMs > 0
	) {
		body["options"] = { timeoutMs: params.timeoutMs };
	}

	return await evmQueryRequest<QueryExecuteResponse>(ctx, {
		method: "POST",
		path: "/query",
		body,
	});
}

/**
 * Query.Execute → POST /query. Reads node parameters (including preset
 * expansion), delegates the actual HTTP call to `runQueryExecute`, and
 * post-processes per `outputFormat` so AI Agents can consume a flat object
 * while power users can still opt into the full envelope.
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

	const response = await runQueryExecute(this, {
		chain,
		expression,
		contracts,
		contextTypes,
		contextValues,
		timeoutMs: optionsRaw.timeoutMs,
	});

	if (outputFormat === "raw") {
		return response as unknown as IDataObject;
	}

	return toSimpleOutput(response);
}

export { executeFields, executeQueryExecute, runQueryExecute };
export type { QueryExecuteParams, QueryExecuteResponse };
