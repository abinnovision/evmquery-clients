import { describe, expect, it } from "vitest";

import { canonicalize, paramFingerprint } from "./state";

describe("canonicalize", () => {
	it("emits keys in sorted order regardless of insertion order", () => {
		expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
	});

	it("sorts nested object keys too", () => {
		const a = canonicalize({ outer: { b: 1, a: 2 }, z: 3 });
		const b = canonicalize({ z: 3, outer: { a: 2, b: 1 } });
		expect(a).toBe(b);
	});

	it("preserves array order", () => {
		expect(canonicalize([1, 2, 3])).not.toBe(canonicalize([3, 2, 1]));
	});

	it("serializes BigInt without throwing", () => {
		expect(() => canonicalize(10n ** 18n)).not.toThrow();
	});

	it("distinguishes a BigInt from its decimal string representation", () => {
		expect(canonicalize(1000n)).not.toBe(canonicalize("1000"));
	});

	it("treats equal BigInts as equal", () => {
		expect(canonicalize(10n ** 18n)).toBe(canonicalize(10n ** 18n));
	});

	it("handles nested BigInts inside structures", () => {
		const a = canonicalize({ reserve0: 100n, reserve1: 200n });
		const b = canonicalize({ reserve1: 200n, reserve0: 100n });
		expect(a).toBe(b);
	});
});

describe("paramFingerprint", () => {
	const baseline = {
		chain: "evm_ethereum",
		expression: "Token.balanceOf(holder)",
		contracts: {
			Token: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
		},
		contextTypes: { holder: "sol_address" },
		contextValues: { holder: "0xabc" },
	};

	it("is stable across repeated calls", () => {
		expect(paramFingerprint(baseline)).toBe(paramFingerprint(baseline));
	});

	it("is insensitive to input key order", () => {
		const reordered: typeof baseline = {
			expression: "Token.balanceOf(holder)",
			contextValues: { holder: "0xabc" },
			chain: "evm_ethereum",
			contracts: {
				Token: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
			},
			contextTypes: { holder: "sol_address" },
		};
		expect(paramFingerprint(reordered)).toBe(paramFingerprint(baseline));
	});

	it("changes when the expression changes", () => {
		expect(
			paramFingerprint({ ...baseline, expression: "Token.totalSupply()" }),
		).not.toBe(paramFingerprint(baseline));
	});

	it("changes when the chain changes", () => {
		expect(paramFingerprint({ ...baseline, chain: "evm_base" })).not.toBe(
			paramFingerprint(baseline),
		);
	});

	it("changes when a context value changes", () => {
		expect(
			paramFingerprint({
				...baseline,
				contextValues: { holder: "0xdef" },
			}),
		).not.toBe(paramFingerprint(baseline));
	});
});
