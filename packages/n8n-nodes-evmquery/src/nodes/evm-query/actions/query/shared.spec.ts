import { describe, expect, it } from "vitest";

import {
	parseContextTypes,
	parseContextValues,
	parseContracts,
} from "./shared";

describe("parseContracts", () => {
	it("normalizes the UI fixedCollection shape", () => {
		const input = {
			entries: [
				{
					name: "Token",
					address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				},
				{ name: "Pool", address: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640" },
			],
		};
		expect(parseContracts(input)).toEqual({
			Token: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
			Pool: { address: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640" },
		});
	});

	it("accepts a nested AI JSON object as input", () => {
		const input = {
			Token: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
		};
		expect(parseContracts(input)).toEqual(input);
	});

	it("accepts the flat AI shape { Name: address }", () => {
		const input = { Token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" };
		expect(parseContracts(input)).toEqual({
			Token: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
		});
	});

	it("parses a JSON string from $fromAI", () => {
		const input = JSON.stringify({
			Token: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
		});
		expect(parseContracts(input)).toEqual({
			Token: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
		});
	});

	it("returns an empty object for undefined, null, '' and malformed inputs", () => {
		expect(parseContracts(undefined)).toEqual({});
		expect(parseContracts(null)).toEqual({});
		expect(parseContracts("")).toEqual({});
		expect(parseContracts("not json")).toEqual({});
	});

	it("drops entries missing name or address", () => {
		expect(
			parseContracts({
				entries: [
					{ name: "Ok", address: "0x1" },
					{ name: "", address: "0x2" },
					{ name: "NoAddr" },
					{ address: "0x3" },
				],
			}),
		).toEqual({ "": { address: "0x2" }, Ok: { address: "0x1" } });
	});
});

describe("parseContextTypes", () => {
	it("normalizes the UI fixedCollection shape", () => {
		const input = {
			entries: [
				{ name: "holder", type: "sol_address" },
				{ name: "amount", type: "sol_int" },
			],
		};
		expect(parseContextTypes(input)).toEqual({
			holder: "sol_address",
			amount: "sol_int",
		});
	});

	it("accepts an AI JSON object { name: type }", () => {
		expect(parseContextTypes({ holder: "sol_address" })).toEqual({
			holder: "sol_address",
		});
	});

	it("accepts list<> sol types", () => {
		expect(
			parseContextTypes({
				entries: [{ name: "addrs", type: "list<sol_address>" }],
			}),
		).toEqual({ addrs: "list<sol_address>" });
	});

	it("drops unknown types rather than forwarding them to the API", () => {
		expect(
			parseContextTypes({ entries: [{ name: "x", type: "uint256" }] }),
		).toEqual({});
		expect(parseContextTypes({ x: "mystery" })).toEqual({});
	});

	it("returns an empty object for missing / empty input", () => {
		expect(parseContextTypes(undefined)).toEqual({});
		expect(parseContextTypes({})).toEqual({});
		expect(parseContextTypes("")).toEqual({});
	});
});

describe("parseContextValues (list<*> coercion)", () => {
	/*
	 * These tests pin down the two user paths documented on the Value field:
	 * typing a JSON literal (Fixed mode) and piping an array in from
	 * upstream (Expression mode / $fromAI). If a future refactor loses
	 * either path, the test signal lands before the UX regression ships.
	 */

	it("parses a JSON-string list into an actual array (Fixed-mode UI path)", () => {
		const types = { holders: "list<sol_address>" as const };
		const values = parseContextValues(
			{
				entries: [
					{
						name: "holders",
						type: "list<sol_address>",
						value: '["0xabc","0xdef"]',
					},
				],
			},
			types,
		);
		expect(values).toEqual({ holders: ["0xabc", "0xdef"] });
	});

	it("passes an actual array through untouched (Expression-mode / $fromAI path)", () => {
		const types = { tokenIds: "list<sol_int>" as const };
		const values = parseContextValues(
			{
				entries: [
					{ name: "tokenIds", type: "list<sol_int>", value: [1, 2, 3] },
				],
			},
			types,
		);
		expect(values).toEqual({ tokenIds: [1, 2, 3] });
	});

	it("falls back to the raw string for malformed JSON (server-side validator handles it)", () => {
		const types = { holders: "list<sol_address>" as const };
		const values = parseContextValues(
			{
				entries: [
					{
						name: "holders",
						type: "list<sol_address>",
						value: "0xabc,0xdef",
					},
				],
			},
			types,
		);
		expect(values).toEqual({ holders: "0xabc,0xdef" });
	});

	it("accepts an AI JSON object { name: [...] } for list types", () => {
		const types = { addrs: "list<sol_address>" as const };
		const values = parseContextValues({ addrs: ["0x1", "0x2"] }, types);
		expect(values).toEqual({ addrs: ["0x1", "0x2"] });
	});

	it("omits list entries whose value is an empty string", () => {
		const types = { holders: "list<sol_address>" as const };
		const values = parseContextValues(
			{
				entries: [{ name: "holders", type: "list<sol_address>", value: "" }],
			},
			types,
		);
		expect(values).toEqual({});
	});

	it("leaves scalar coercion unchanged when list entries coexist", () => {
		const types = {
			holders: "list<sol_address>" as const,
			flag: "bool" as const,
		};
		const values = parseContextValues(
			{
				entries: [
					{
						name: "holders",
						type: "list<sol_address>",
						value: '["0x1","0x2"]',
					},
					{ name: "flag", type: "bool", value: "true" },
				],
			},
			types,
		);
		expect(values).toEqual({ holders: ["0x1", "0x2"], flag: true });
	});
});
