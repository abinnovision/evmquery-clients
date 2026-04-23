/**
 * Shared TypeScript types for the evmquery n8n node. Kept minimal during the
 * scaffold stage; populated as actions are implemented.
 */

export type ChainId =
	| "evm_ethereum"
	| "evm_base"
	| "evm_bnb_mainnet"
	| (string & Record<never, never>);

export type SolType =
	| "sol_int"
	| "sol_address"
	| "bool"
	| "string"
	| "bytes"
	| "list<sol_int>"
	| "list<sol_address>"
	| "list<bool>"
	| "list<string>"
	| "list<bytes>";
