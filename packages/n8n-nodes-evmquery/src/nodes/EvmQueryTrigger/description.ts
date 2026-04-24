import {
	chainField,
	contextField,
	contractsField,
	expressionField,
} from "../EvmQuery/actions/query";

import type { INodeProperties, INodeTypeDescription } from "n8n-workflow";

/**
 * Strip `displayOptions` from a field descriptor — both at the top level
 * and on any inner `options[].values[]` entries. The shared field objects
 * in `EvmQuery/actions/query/shared.ts` carry gates like
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
 * Top-level description for the `EvmQueryTrigger` polling node.
 *
 * Icon is referenced from the sibling `EvmQuery` directory so we don't
 * maintain two copies; n8n resolves `file:` paths relative to the compiled
 * .js location, and `gulpfile.js` already globs `src/nodes/**\/*.svg`.
 */
export const description: INodeTypeDescription = {
	displayName: "evmquery Trigger",
	name: "evmQueryTrigger",
	icon: "file:../EvmQuery/evmquery.svg",
	group: ["trigger"],
	version: 1,
	subtitle: '={{$parameter["chainId"]}}: {{$parameter["expression"]}}',
	description:
		"Fire a workflow when a CEL expression's on-chain value changes. Polls evmquery on a schedule and emits only on an actual value change (ignoring meta fields like block number and credits).",
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
