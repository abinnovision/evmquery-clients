import {
	chainField,
	contextField,
	contractsField,
	expressionField,
} from "../evm-query/actions/query";

import type { INodeProperties, INodeTypeDescription } from "n8n-workflow";

/**
 * Strip `displayOptions` from a field descriptor — both at the top level
 * and on any inner `options[].values[]` entries. The shared field objects
 * in `evm-query/actions/query/shared.ts` carry gates like
 * `show: { "/operation": ["execute", ...] }` so they only render for the
 * action node's relevant operations; `contextField` additionally gates its
 * `Value` column the same way. The trigger has no operation selector, so
 * any such gate would hide the field (or inner column) entirely. We render
 * everything unconditionally instead.
 */
function always<T extends INodeProperties>(field: T): T {
	const { displayOptions: _outer, ...rest } = field;
	const stripped = rest as INodeProperties;

	if (Array.isArray(stripped.options)) {
		stripped.options = stripped.options.map((group) => {
			if (
				"values" in group &&
				Array.isArray((group as { values?: unknown }).values)
			) {
				const collection = group as { values: INodeProperties[] };

				return {
					...group,
					values: collection.values.map((v) => {
						const { displayOptions: _inner, ...vRest } = v;

						return vRest;
					}),
				};
			}

			return group;
		});
	}

	return stripped as T;
}

/**
 * Minimal trigger-scoped options. We deliberately omit `outputFormat` — the
 * trigger has its own fixed output shape (`value`, `previousValue`,
 * `blockNumber`, `type`) and the full API envelope would leak
 * non-deterministic fields (credits, latency) that would confuse
 * change-detection consumers.
 *
 * `emitOn` lives here so the main UI stays minimal: the default (Value
 * Change) is what almost everyone wants, and "Every Poll" is an advanced
 * escape hatch that users can reach via "Add option".
 */
const optionsField: INodeProperties = {
	displayName: "Options",
	name: "options",
	type: "collection",
	placeholder: "Add option",
	default: {},
	options: [
		{
			displayName: "Emit On",
			name: "emitOn",
			type: "options",
			default: "change",
			options: [
				{
					name: "Value Change",
					value: "change",
					description:
						"Only fire when the value differs from the last successful poll",
				},
				{
					name: "Every Poll",
					value: "everyPoll",
					description:
						"Fire on every successful poll regardless of whether the value changed",
				},
			],
			description:
				"When to emit a workflow execution. Default only fires on an actual value change.",
		},
		{
			displayName: "Timeout (Ms)",
			name: "timeoutMs",
			type: "number",
			default: 0,
			typeOptions: { minValue: 0 },
			description:
				"Server-side evaluation timeout in milliseconds. Leave empty for the evmquery default.",
		},
	],
};

/**
 * Top-level description for the `EvmQueryTrigger` polling node. The `icon`
 * field is set on the node class itself (in `EvmQueryTrigger.node.ts`) so
 * the @n8n/community-nodes/icon-validation lint rule — which only inspects
 * the class file's AST and does not follow imports — can see it.
 */
export const description: INodeTypeDescription = {
	displayName: "evmquery Trigger",
	name: "evmQueryTrigger",
	group: ["trigger"],
	version: 1,
	subtitle: '={{$parameter["chainId"]}}: {{$parameter["expression"]}}',
	description:
		"Trigger a workflow when a CEL expression's on-chain value changes on any supported EVM chain",
	eventTriggerDescription: "when the expression's on-chain value changes",
	defaults: { name: "evmquery Trigger" },
	polling: true,
	inputs: [] as never,
	outputs: ["main"] as never,
	credentials: [{ name: "evmQueryApi", required: true }],
	properties: [
		always(chainField),
		always(expressionField),
		always(contractsField),
		always(contextField),
		optionsField,
	],
};
