import type { EvmQueryPreset } from "./types";

/**
 * Preset cookbook. v1 ships empty — the README documents these recipes in
 * prose, and v2 will wire them into an in-node preset dropdown. Leaving the
 * list here (with the examples below kept as reference comments) means we
 * can light up the UI later without migrating data.
 *
 * Each preset describes user-facing inputs (`inputs`) and a `build` block
 * that expands into the node parameters via n8n expressions. Authoring a new
 * preset is purely a data change — no code wiring required.
 *
 * ----- Reference examples (do not remove) ---------------------------------
 *
 * ERC-20 Balance
 * --------------
 * {
 *   id: "erc20-balance",
 *   label: "ERC-20 balance",
 *   description: "Read an ERC-20 balance for a single holder",
 *   inputs: [
 *     { name: "tokenAddress", displayName: "Token address", type: "string", required: true },
 *     { name: "holder",       displayName: "Holder address", type: "string", required: true },
 *   ],
 *   build: {
 *     contracts: { Token: "={{ $input.tokenAddress }}" as `={{ $input.${string} }}` },
 *     contextTypes: { holder: "sol_address" },
 *     contextValues: { holder: "={{ $input.holder }}" as `={{ $input.${string} }}` },
 *     expression: "Token.balanceOf(holder)",
 *   },
 * }
 *
 * Native Balance
 * --------------
 * {
 *   id: "native-balance",
 *   label: "Native balance",
 *   description: "Read the native (gas) balance of an account",
 *   inputs: [
 *     { name: "account", displayName: "Account", type: "string", required: true },
 *   ],
 *   build: {
 *     contracts: {},
 *     contextTypes: { account: "sol_address" },
 *     contextValues: { account: "={{ $input.account }}" as `={{ $input.${string} }}` },
 *     expression: "chain.balance(account)",
 *   },
 * }
 *
 * NFT Owner
 * ---------
 * {
 *   id: "nft-owner",
 *   label: "NFT owner",
 *   description: "Resolve the current owner of an ERC-721 token id",
 *   inputs: [
 *     { name: "collection", displayName: "Collection address", type: "string", required: true },
 *     { name: "tokenId",    displayName: "Token id",           type: "number", required: true },
 *   ],
 *   build: {
 *     contracts: { Collection: "={{ $input.collection }}" as `={{ $input.${string} }}` },
 *     contextTypes: { tokenId: "sol_int" },
 *     contextValues: { tokenId: "={{ $input.tokenId }}" as `={{ $input.${string} }}` },
 *     expression: "Collection.ownerOf(tokenId)",
 *   },
 * }
 */
const presets: readonly EvmQueryPreset[] = [];

export { presets };
