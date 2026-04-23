import { describe, expect, it } from "vitest";

import { presets } from "./presets";
import { SOL_TYPES } from "../actions/query";

import type { EvmQueryPreset } from "./types";

/**
 * Runtime validator that mirrors the `EvmQueryPreset` interface. Keeping a
 * single source of truth as a test lets us tolerate authors adding presets
 * without touching Zod / ajv / anything heavy — the shape is small.
 */
function isValidPreset(value: unknown): value is EvmQueryPreset {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const preset = value as Record<string, unknown>;

	if (typeof preset["id"] !== "string" || preset["id"] === "") {
		return false;
	}

	if (typeof preset["label"] !== "string" || preset["label"] === "") {
		return false;
	}

	if (!Array.isArray(preset["inputs"])) {
		return false;
	}

	for (const input of preset["inputs"] as unknown[]) {
		if (typeof input !== "object" || input === null) {
			return false;
		}

		const row = input as Record<string, unknown>;
		if (typeof row["name"] !== "string" || row["name"] === "") {
			return false;
		}

		if (typeof row["displayName"] !== "string" || row["displayName"] === "") {
			return false;
		}

		if (
			row["type"] !== "string" &&
			row["type"] !== "number" &&
			row["type"] !== "collection"
		) {
			return false;
		}
	}

	const build = preset["build"];
	if (typeof build !== "object" || build === null) {
		return false;
	}

	const buildRow = build as Record<string, unknown>;
	if (typeof buildRow["expression"] !== "string") {
		return false;
	}

	for (const key of ["contracts", "contextTypes", "contextValues"] as const) {
		const entry = buildRow[key];
		if (typeof entry !== "object" || entry === null) {
			return false;
		}
	}

	const contextTypes = buildRow["contextTypes"] as Record<string, unknown>;
	for (const value of Object.values(contextTypes)) {
		if (
			typeof value !== "string" ||
			!(SOL_TYPES as readonly string[]).includes(value)
		) {
			return false;
		}
	}

	return true;
}

describe("preset cookbook", () => {
	it("is declared as a readonly array", () => {
		expect(Array.isArray(presets)).toBe(true);
	});

	it("ships empty in v1 (cookbook lives in the README)", () => {
		expect(presets).toEqual([]);
	});

	it("validates every exported preset against the EvmQueryPreset shape", () => {
		for (const preset of presets) {
			expect(isValidPreset(preset)).toBe(true);
		}
	});

	it("accepts a well-formed reference example", () => {
		const sample: EvmQueryPreset = {
			id: "erc20-balance",
			label: "ERC-20 balance",
			inputs: [
				{ name: "tokenAddress", displayName: "Token", type: "string" },
				{ name: "holder", displayName: "Holder", type: "string" },
			],
			build: {
				contracts: { Token: "={{ $input.tokenAddress }}" },
				contextTypes: { holder: "sol_address" },
				contextValues: { holder: "={{ $input.holder }}" },
				expression: "Token.balanceOf(holder)",
			},
		};
		expect(isValidPreset(sample)).toBe(true);
	});

	it("rejects a preset with an unknown sol type", () => {
		const bad = {
			id: "bad",
			label: "Bad",
			inputs: [],
			build: {
				contracts: {},
				contextTypes: { x: "uint256" },
				contextValues: {},
				expression: "1",
			},
		};
		expect(isValidPreset(bad)).toBe(false);
	});

	it("rejects a preset missing required fields", () => {
		expect(isValidPreset({ id: "", label: "" })).toBe(false);
		expect(isValidPreset(null)).toBe(false);
	});
});
