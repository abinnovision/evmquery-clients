import type { EvmQueryPreset } from "./types";

/**
 * Preset cookbook. These recipes back the README cookbook today and will
 * power an in-node preset dropdown in v2 — authoring a new preset is a pure
 * data change, no code wiring required.
 *
 * Each preset describes user-facing inputs (`inputs`) and a `build` block
 * that expands into the node parameters via n8n expressions.
 */
export const presets: readonly EvmQueryPreset[] = [
	{
		id: "erc20-balance",
		label: "ERC-20 balance",
		description: "Read an ERC-20 balance for a single holder",
		inputs: [
			{
				name: "tokenAddress",
				displayName: "Token address",
				type: "string",
				required: true,
			},
			{
				name: "holder",
				displayName: "Holder address",
				type: "string",
				required: true,
			},
		],
		build: {
			contracts: { Token: "={{ $input.tokenAddress }}" },
			contextTypes: { holder: "sol_address" },
			contextValues: { holder: "={{ $input.holder }}" },
			expression: "Token.balanceOf(holder)",
		},
	},
	{
		id: "native-balance",
		label: "Native balance",
		description: "Read the native (gas) balance of an account",
		inputs: [
			{
				name: "account",
				displayName: "Account",
				type: "string",
				required: true,
			},
		],
		build: {
			contracts: {},
			contextTypes: { account: "sol_address" },
			contextValues: { account: "={{ $input.account }}" },
			expression: "account.balance()",
		},
	},
	{
		id: "nft-owner",
		label: "NFT owner",
		description: "Resolve the current owner of an ERC-721 token id",
		inputs: [
			{
				name: "collection",
				displayName: "Collection address",
				type: "string",
				required: true,
			},
			{
				name: "tokenId",
				displayName: "Token id",
				type: "number",
				required: true,
			},
		],
		build: {
			contracts: { Collection: "={{ $input.collection }}" },
			contextTypes: { tokenId: "sol_int" },
			contextValues: { tokenId: "={{ $input.tokenId }}" },
			expression: "Collection.ownerOf(tokenId)",
		},
	},
];
