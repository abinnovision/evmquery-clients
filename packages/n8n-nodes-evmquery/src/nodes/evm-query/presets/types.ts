import type { SolType } from "../actions/query";

/**
 * A single user-facing input that backs a preset. The `name` is the key the
 * template's `={{ $input.<name> }}` expressions resolve against.
 */
export interface PresetInput {
	name: string;
	displayName: string;
	type: "string" | "number" | "collection";
	placeholder?: string;
	description?: string;
	required?: boolean;
}

/**
 * A ready-to-run evmquery query bundled with its user-facing inputs. Presets
 * are authored in `./presets.ts` and currently power the README cookbook;
 * v2 will expose them as a node-side preset dropdown without needing to
 * migrate the data shape.
 *
 * The `build` block uses n8n expression strings (`={{ $input.<name> }}`) so
 * values plug straight into the node parameters at runtime.
 */
export interface EvmQueryPreset {
	id: string;
	label: string;
	description?: string;
	inputs: PresetInput[];
	build: {
		contracts: Record<string, `={{ $input.${string} }}`>;
		contextTypes: Record<string, SolType>;
		contextValues: Record<string, `={{ $input.${string} }}`>;
		expression: string;
	};
}
