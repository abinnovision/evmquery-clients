import { listChainsFields } from "./actions/chain";
import {
	chainField,
	contextField,
	contractsField,
	describeFields,
	executeFields,
	expressionField,
	optionsField,
	validateFields,
} from "./actions/query";
import { getUsageFields } from "./actions/usage";
import { presetField, presetInputFields, withHideOnPreset } from "./presets";

import type { INodeProperties, INodeTypeDescription } from "n8n-workflow";

/*
 * Single, flat operation selector.
 *
 * We intentionally skip the n8n `resource` layer: five operations doesn't
 * justify the extra navigation level, and users approaching the node think
 * in verbs ("execute a query", "list chains") rather than API resources.
 * The action palette groups these five entries under one heading, which
 * matches how small community nodes tend to present themselves.
 */
const operationField: INodeProperties = {
	displayName: "Operation",
	name: "operation",
	type: "options",
	noDataExpression: true,
	default: "execute",
	options: [
		{
			name: "Execute Query",
			value: "execute",
			action: "Execute a query",
			description:
				"Read EVM smart-contract state: token balances, metadata, ownership, arbitrary view-function calls",
		},
		{
			name: "Validate Query",
			value: "validate",
			action: "Validate a query",
			description:
				"Type-check an expression and estimate credit cost without executing",
		},
		{
			name: "Describe Schema",
			value: "describe",
			action: "Describe a contract schema",
			description:
				"Inspect a chain's contracts and return the methods, argument types, and context variables available to expressions",
		},
		{
			name: "List Chains",
			value: "listChains",
			action: "List EVM chains",
			description:
				"Return every EVM chain evmquery supports, including its internal ID and EVM chain ID",
		},
		{
			name: "Get Usage",
			value: "getUsage",
			action: "Get current credit usage",
			description:
				"Return the organization's current credit balance, tier, and billing period",
		},
	],
};

/**
 * Top-level n8n node description. Operation-specific property blocks are
 * spliced in from `./actions/*` so the node executor (EvmQuery.node.ts) can
 * stay a thin router and each action keeps its UI and executor together.
 */
export const description: INodeTypeDescription = {
	displayName: "evmquery",
	name: "evmQuery",
	group: ["input"],
	version: 1,
	subtitle: '={{$parameter["operation"]}}',
	description:
		"Read on-chain data from any supported EVM chain using CEL expressions",
	defaults: { name: "evmquery" },
	inputs: ["main"] as never,
	outputs: ["main"] as never,
	credentials: [{ name: "evmQueryApi", required: true }],
	properties: [
		operationField,
		presetField,
		chainField,
		withHideOnPreset(expressionField),
		withHideOnPreset(contractsField),
		withHideOnPreset(contextField),
		...presetInputFields,
		optionsField,
		...describeFields,
		...executeFields,
		...validateFields,
		...listChainsFields,
		...getUsageFields,
	],
};
