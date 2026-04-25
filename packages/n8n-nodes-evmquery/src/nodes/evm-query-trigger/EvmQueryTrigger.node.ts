import { description } from "./description";
import { canonicalize, paramFingerprint } from "./state";
import {
	parseContextTypes,
	parseContextValues,
	parseContracts,
	runQueryExecute,
} from "../evm-query/actions/query";
import { methods } from "../evm-query/methods";

import type { QueryExecuteResponse } from "../evm-query/actions/query";
import type {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
} from "n8n-workflow";

/**
 * Shape of the per-expression state we park in `getWorkflowStaticData`. We
 * store only what we need to diff the next poll — the canonical form of the
 * watched value — plus the block number for user telemetry. Storing the raw
 * value would duplicate the canonical form; storing the full envelope would
 * bloat static data, which n8n serializes with every workflow save.
 */
interface PolledState {
	serialized: string;
	blockNumber?: number;
}

/**
 * EvmQuery Trigger — polls an expression on a schedule and fires a workflow
 * execution only when `result.value` changes from poll to poll. Metadata
 * fields like block number, credits, and latency are intentionally excluded
 * from the diff so block-producing activity alone never triggers a fire.
 */
export class EvmQueryTrigger implements INodeType {
	/*
	 * `icon` is inlined here for the same reason as in `EvmQuery.node.ts`:
	 * @n8n/community-nodes/icon-validation only inspects the class file's AST
	 * and does not follow imports.
	 *
	 * `usableAsTool: true` exists only to satisfy the sibling
	 * @n8n/community-nodes/node-usable-as-tool rule, which fires on every node
	 * class regardless of whether it's a trigger. n8n's tool dispatch never
	 * invokes polling triggers as tools — they are workflow entry points — so
	 * the flag is harmless at runtime. The `INodeTypeDescription` type does
	 * not permit `false`, hence `true`.
	 */
	public description: INodeTypeDescription = {
		...description,
		icon: "file:../../icons/evmquery.svg",
		usableAsTool: true,
	};

	public methods = methods;

	public async poll(
		this: IPollFunctions,
	): Promise<INodeExecutionData[][] | null> {
		const chain = this.getNodeParameter("chainId") as string;
		const expression = this.getNodeParameter("expression") as string;
		const contractsRaw = this.getNodeParameter("contracts", {});
		const contextRaw = this.getNodeParameter("context", {});
		const optionsRaw = this.getNodeParameter("options", {}) as {
			timeoutMs?: number;
			emitOn?: "change" | "everyPoll";
		};
		const emitOn = optionsRaw.emitOn ?? "change";

		const contracts = parseContracts(contractsRaw);
		const contextTypes = parseContextTypes(contextRaw);
		const contextValues = parseContextValues(contextRaw, contextTypes);

		let response: QueryExecuteResponse;
		try {
			response = await runQueryExecute(this, {
				chain,
				expression,
				contracts,
				contextTypes,
				contextValues,
				timeoutMs: optionsRaw.timeoutMs,
			});
		} catch (error) {
			/*
			 * Transient failures (rate limit, RPC blip, temporary server error)
			 * must not clear state or fire. Swallow and log — n8n will poll
			 * again on the next tick. Persistent failures show up in n8n's
			 * execution log via the workflow-level error handler.
			 */
			this.logger.warn(
				`evmquery poll failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);

			return null;
		}

		const value = response.result.value;

		/*
		 * Manual mode (the editor's "Fetch Test Event" button) should always
		 * show the current value so users can verify their expression works
		 * and preview the output shape. Skip the change-detection branch
		 * and do NOT touch static data — otherwise clicking Test during
		 * development would seed the production cursor with a test-time
		 * value and suppress the first real fire after activation.
		 */
		if (this.getMode() === "manual") {
			return [
				this.helpers.returnJsonArray([
					{
						value: value as never,
						previousValue: null,
						blockNumber: response.meta?.blockNumber,
						type: response.result.type,
					},
				]),
			];
		}

		const serialized = canonicalize(value);

		const store = this.getWorkflowStaticData("node") as unknown as Record<
			string,
			PolledState | undefined
		>;
		const key = paramFingerprint({
			chain,
			expression,
			contracts,
			contextTypes,
			contextValues,
		});
		const prev = store[key];
		const firstRun = prev === undefined;

		if (emitOn === "change") {
			if (firstRun) {
				/*
				 * First successful poll always seeds state silently. The
				 * initial value is never a "change" — the user just
				 * activated the trigger — so firing here would produce a
				 * phantom event on every workflow restart.
				 */
				store[key] = {
					serialized,
					blockNumber: response.meta?.blockNumber,
				};

				return null;
			}

			if (prev.serialized === serialized) {
				return null;
			}
		}

		const previousValue =
			prev === undefined ? null : (JSON.parse(prev.serialized) as unknown);

		store[key] = { serialized, blockNumber: response.meta?.blockNumber };

		return [
			this.helpers.returnJsonArray([
				{
					value: value as never,
					previousValue: previousValue as never,
					blockNumber: response.meta?.blockNumber,
					type: response.result.type,
				},
			]),
		];
	}
}
