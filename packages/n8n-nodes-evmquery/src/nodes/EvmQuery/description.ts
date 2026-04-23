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
			action: "Execute a CEL query",
			description:
				"Read EVM smart-contract state via a CEL expression (token balances, metadata, ownership, arbitrary view-function calls). Returns the typed result in one call.",
		},
		{
			name: "Validate Query",
			value: "validate",
			action: "Validate a CEL query",
			description:
				"Type-check a CEL expression and estimate credit cost without executing. Use when you want to confirm an expression is well-formed before running.",
		},
		{
			name: "Describe Schema",
			value: "describe",
			action: "Describe contract schema",
			description:
				"Inspect a chain's contracts and return the methods, argument types, and context variables available to CEL. Use before Execute when unsure which methods a contract exposes.",
		},
		{
			name: "List Chains",
			value: "listChains",
			action: "List supported EVM chains",
			description:
				"Return every EVM chain evmquery supports, including its internal ID and EVM chain ID",
		},
		{
			name: "Get Usage",
			value: "getUsage",
			action: "Get credit usage snapshot",
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
	icon: "file:evmquery.svg",
	group: ["transform"],
	version: 1,
	subtitle: '={{$parameter["operation"]}}',
	description:
		"Query EVM smart contracts (Ethereum, Base, BNB) via CEL expressions — balances, metadata, ownership, arbitrary reads.",
	defaults: { name: "evmquery" },
	inputs: ["main"] as never,
	outputs: ["main"] as never,
	credentials: [{ name: "evmQueryApi", required: true }],
	usableAsTool: true,
	properties: [
		operationField,
		chainField,
		contractsField,
		expressionField,
		contextField,
		optionsField,
		...describeFields,
		...executeFields,
		...validateFields,
		...listChainsFields,
		...getUsageFields,
	],
};
