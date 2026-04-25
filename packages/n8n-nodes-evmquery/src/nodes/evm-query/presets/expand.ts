import { presets } from "./presets";

import type { SolType } from "../actions/query";

/**
 * Expansion result mirrors the four local variables the custom-UI path
 * derives from Contracts / Expression / Context fields, so the downstream
 * request-assembly code in the executor can stay preset-agnostic.
 */
interface ExpandedPreset {
	contracts: Record<string, { address: string }>;
	contextTypes: Record<string, SolType>;
	contextValues: Record<string, unknown>;
	expression: string;
}

/**
 * A preset's `build.contracts` and `build.contextValues` values are n8n
 * expression templates of the shape `={{ $input.<inputName> }}`. At runtime
 * we do NOT rely on n8n to evaluate these — the preset inputs live as
 * independent node params — so we parse out the input name here and look
 * up the value explicitly.
 */
const INPUT_TEMPLATE_RE = /^=\{\{\s*\$input\.(\w+)\s*\}\}$/;

function extractInputName(template: string, context: string): string {
	const match = INPUT_TEMPLATE_RE.exec(template);
	if (match === null || match[1] === undefined) {
		throw new Error(
			`Preset template "${template}" in ${context} is not of the expected \`={{ $input.<name> }}\` shape`,
		);
	}

	return match[1];
}

/**
 * Resolve a preset into the `{ contracts, contextTypes, contextValues,
 * expression }` quadruple. The caller supplies `getInput` — usually a thin
 * closure over n8n's `getNodeParameter` that maps input names through
 * `paramKey` — so this module stays free of n8n runtime dependencies and
 * can be unit-tested in isolation.
 */
export function expandPreset(
	presetId: string,
	getInput: (inputName: string) => unknown,
): ExpandedPreset {
	const preset = presets.find((p) => p.id === presetId);
	if (preset === undefined) {
		throw new Error(`Unknown preset: "${presetId}"`);
	}

	const contracts: Record<string, { address: string }> = {};
	for (const [contractName, template] of Object.entries(
		preset.build.contracts,
	)) {
		const inputName = extractInputName(template, `contracts.${contractName}`);
		const raw = getInput(inputName);
		if (typeof raw !== "string" || raw.trim() === "") {
			throw new Error(
				`Preset "${preset.label}" requires "${inputName}" (as an address) but it was empty`,
			);
		}

		contracts[contractName] = { address: raw };
	}

	const contextValues: Record<string, unknown> = {};
	for (const [varName, template] of Object.entries(
		preset.build.contextValues,
	)) {
		const inputName = extractInputName(template, `contextValues.${varName}`);
		const raw = getInput(inputName);
		if (raw === undefined || raw === null || raw === "") {
			throw new Error(
				`Preset "${preset.label}" requires "${inputName}" but it was empty`,
			);
		}

		contextValues[varName] = raw;
	}

	return {
		contracts,
		contextTypes: { ...preset.build.contextTypes },
		contextValues,
		expression: preset.build.expression,
	};
}

export type { ExpandedPreset };
