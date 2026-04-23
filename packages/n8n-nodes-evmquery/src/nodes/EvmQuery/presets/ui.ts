import { presets } from "./presets";

import type { INodeProperties } from "n8n-workflow";

/**
 * Sentinel value used by the Preset selector to mean "I'll author the query
 * myself". Kept as a constant so the executor and the displayOptions `hide`
 * machinery can't accidentally drift.
 */
const CUSTOM = "custom";

/**
 * Flat list of preset ids — fed into `displayOptions.hide` on the
 * custom-query fields so they disappear as soon as any named recipe is
 * active, and used as a lookup set by the executor.
 */
const PRESET_IDS: string[] = presets.map((p) => p.id);

/**
 * Compute the n8n node parameter key for a preset input. The prefix keeps
 * preset inputs namespaced away from top-level fields (`chainId`,
 * `expression`), and the per-preset id segment prevents collisions when two
 * recipes happen to declare the same input name (e.g. `account`). Non-
 * alphanumeric characters in the preset id are folded to `_` because n8n
 * param keys are referenced by expression like `$parameter["…"]`.
 */
function paramKey(presetId: string, inputName: string): string {
	const safeId = presetId.replace(/[^a-zA-Z0-9]/g, "_");

	return `preset_${safeId}_${inputName}`;
}

/**
 * Top-level Preset selector. Execute-only by design: Validate is unnecessary
 * because preset expressions are well-formed by construction, and Describe
 * is a schema-introspection path that doesn't evaluate expressions.
 */
const presetField: INodeProperties = {
	displayName: "Preset",
	name: "preset",
	type: "options",
	noDataExpression: true,
	default: CUSTOM,
	description:
		"Pick a ready-made recipe for common queries, or choose Custom expression to author your own",
	displayOptions: { show: { "/operation": ["execute"] } },
	options: [
		{
			name: "Custom Expression",
			value: CUSTOM,
			description: "Write your own query using the Expression field",
		},
		...presets.map((p) => ({
			name: p.label,
			value: p.id,
			description: p.description ?? "",
		})),
	],
};

/**
 * Flattened list of per-preset input fields. Each preset input becomes one
 * `INodeProperties` entry gated on both `/operation = execute` and the
 * specific preset id, so only the active recipe's fields render. Only
 * `string` and `number` input types are materialized for v1 — `collection`
 * is reserved for a later preset shape and would need a richer UI block.
 */
const presetInputFields: INodeProperties[] = presets.flatMap((preset) =>
	preset.inputs
		.filter((input) => input.type === "string" || input.type === "number")
		.map<INodeProperties>((input) => ({
			displayName: input.displayName,
			name: paramKey(preset.id, input.name),
			type: input.type,
			default: input.type === "number" ? 0 : "",
			required: input.required === true,
			...(input.placeholder !== undefined
				? { placeholder: input.placeholder }
				: {}),
			...(input.description !== undefined
				? { description: input.description }
				: {}),
			displayOptions: {
				show: {
					"/operation": ["execute"],
					"/preset": [preset.id],
				},
			},
		})),
);

/**
 * Non-mutating helper that adds a `hide: { /preset: <all preset ids> }`
 * clause to an existing field's `displayOptions`. Applied to the custom-
 * query fields (Contracts, Expression, Context Variables) so they collapse
 * whenever the user picks a named recipe.
 *
 * Any pre-existing `hide` entries on the field are preserved.
 */
function withHideOnPreset<T extends INodeProperties>(field: T): T {
	const existing = field.displayOptions ?? {};
	const existingHide = existing.hide ?? {};

	return {
		...field,
		displayOptions: {
			...existing,
			hide: { ...existingHide, "/preset": PRESET_IDS },
		},
	};
}

export {
	CUSTOM,
	paramKey,
	presetField,
	presetInputFields,
	PRESET_IDS,
	withHideOnPreset,
};
