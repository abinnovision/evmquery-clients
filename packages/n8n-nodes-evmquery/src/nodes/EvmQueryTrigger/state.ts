import { createHash } from "node:crypto";

/**
 * Stable, BigInt-safe stringification used to diff poll results and to key
 * `getWorkflowStaticData('node')` entries.
 *
 * - Object keys are emitted in sorted order so key reordering doesn't look
 *   like a value change.
 * - BigInt is wrapped as `{ __bigint__: <decimal string> }` because
 *   `JSON.stringify` throws on BigInt natively. Using a tagged wrapper also
 *   prevents a user string like `"1000"` from being treated as equal to
 *   `1000n`.
 * - `undefined` and functions are dropped by `JSON.stringify` (as usual).
 * - `Date` is coerced to its ISO string via the default `toJSON`; the
 *   evmquery API returns only JSON primitives so we don't need custom
 *   handling for it.
 *
 * The output is opaque — only equality comparison and hashing are meaningful.
 */
function canonicalize(value: unknown): string {
	return JSON.stringify(value, (_key, raw: unknown) => {
		if (typeof raw === "bigint") {
			return { __bigint__: raw.toString() };
		}

		if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
			const source = raw as Record<string, unknown>;
			const sorted: Record<string, unknown> = {};
			for (const k of Object.keys(source).sort()) {
				sorted[k] = source[k];
			}

			return sorted;
		}

		return raw;
	});
}

interface FingerprintParams {
	chain: string;
	expression: string;
	contracts: Record<string, { address: string }>;
	contextTypes: Record<string, string>;
	contextValues: Record<string, unknown>;
}

/**
 * SHA-1 over the canonicalized parameters. Used as a stable key inside
 * `getWorkflowStaticData('node')` so that editing any watched parameter —
 * chain, expression, contracts, context types, or context values —
 * invalidates the stored last-value. Without this, changing the expression
 * would let a stale cursor from the previous formula suppress the first
 * legitimate fire.
 */
function paramFingerprint(p: FingerprintParams): string {
	const canonical = canonicalize({
		chain: p.chain,
		expression: p.expression,
		contracts: p.contracts,
		contextTypes: p.contextTypes,
		contextValues: p.contextValues,
	});

	return createHash("sha1").update(canonical).digest("hex");
}

export { canonicalize, paramFingerprint };
export type { FingerprintParams };
