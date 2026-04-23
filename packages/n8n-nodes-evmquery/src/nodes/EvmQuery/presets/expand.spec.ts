import { describe, expect, it } from "vitest";

import { expandPreset } from "./expand";

describe("expandPreset", () => {
	it("expands erc20-balance into contracts, context, and expression", () => {
		const inputs = {
			tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			holder: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
		};

		const expanded = expandPreset(
			"erc20-balance",
			(name) => (inputs as Record<string, unknown>)[name],
		);

		expect(expanded.contracts).toEqual({
			Token: { address: inputs.tokenAddress },
		});
		expect(expanded.contextTypes).toEqual({ holder: "sol_address" });
		expect(expanded.contextValues).toEqual({ holder: inputs.holder });
		expect(expanded.expression).toBe("Token.balanceOf(holder)");
	});

	it("expands native-balance without contracts", () => {
		const expanded = expandPreset("native-balance", (name) =>
			name === "account" ? "0xabc" : undefined,
		);

		expect(expanded.contracts).toEqual({});
		expect(expanded.contextTypes).toEqual({ account: "sol_address" });
		expect(expanded.contextValues).toEqual({ account: "0xabc" });
		expect(expanded.expression).toBe("account.balance()");
	});

	it("expands nft-owner with a numeric token id", () => {
		const inputs = {
			collection: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
			tokenId: 7890,
		};

		const expanded = expandPreset(
			"nft-owner",
			(name) => (inputs as Record<string, unknown>)[name],
		);

		expect(expanded.contracts).toEqual({
			Collection: { address: inputs.collection },
		});
		expect(expanded.contextTypes).toEqual({ tokenId: "sol_int" });
		expect(expanded.contextValues).toEqual({ tokenId: inputs.tokenId });
		expect(expanded.expression).toBe("Collection.ownerOf(tokenId)");
	});

	it("throws when a required address input is missing", () => {
		expect(() => expandPreset("erc20-balance", () => "")).toThrow(
			/requires "tokenAddress"/,
		);
	});

	it("throws when a required context input is missing", () => {
		expect(() =>
			expandPreset("native-balance", (name) =>
				name === "account" ? "" : undefined,
			),
		).toThrow(/requires "account"/);
	});

	it("throws on an unknown preset id", () => {
		expect(() => expandPreset("does-not-exist", () => "")).toThrow(
			/Unknown preset/,
		);
	});
});
