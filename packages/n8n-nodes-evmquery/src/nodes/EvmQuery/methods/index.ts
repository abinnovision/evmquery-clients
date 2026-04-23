import { listChains } from "./loadOptions";

/**
 * n8n calls these via `INodeType.methods.loadOptions[methodName]`. Each
 * function is bound with `this: ILoadOptionsFunctions`, so they see the same
 * credentials/helpers surface as operations — we reuse the transport layer
 * for consistent error handling across load-options and execute paths.
 */
const methods = {
	loadOptions: {
		listChains,
	},
};

export { methods };
