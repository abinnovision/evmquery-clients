import type { INodeProperties } from "n8n-workflow";

const SOL_TYPES = [
	"sol_int",
	"sol_address",
	"bool",
	"string",
	"bytes",
	"list<sol_int>",
	"list<sol_address>",
	"list<bool>",
	"list<string>",
	"list<bytes>",
] as const;

type SolType = (typeof SOL_TYPES)[number];

/**
 * Query-shaped display options — chain / contracts / context fields are
 * meaningful for the three query operations (execute, validate, describe)
 * but not for list-chains or get-usage.
 */
const showForQuery = {
	show: { "/operation": ["execute", "validate", "describe"] },
};

/**
 * Visible-on-Execute-or-Validate helper. Used to hide the Value column on
 * Describe, where runtime values are ignored (only types are sent).
 */
const showForEvaluated = {
	show: { "/operation": ["execute", "validate"] },
};

/**
 * Shared field: Chain dropdown. Feeds from the dynamic `listChains`
 * loadOptions method with a static fallback so the UI never renders empty.
 */
const chainField: INodeProperties = {
	displayName: "Chain Name or ID",
	name: "chainId",
	type: "options",
	typeOptions: { loadOptionsMethod: "listChains" },
	default: "evm_ethereum",
	required: true,
	description:
		'EVM chain to query. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	displayOptions: showForQuery,
};

/**
 * Shared field: Contracts. Fixed collection of named contract rows. An AI
 * caller can also pass a JSON object via `$fromAI` and the executor
 * normalizes both shapes via `parseContracts`.
 */
const contractsField: INodeProperties = {
	displayName: "Contracts",
	name: "contracts",
	type: "fixedCollection",
	typeOptions: { multipleValues: true, sortable: true },
	placeholder: "Add contract",
	default: {},
	description:
		"Named contract references used inside the expression or resolved during describe",
	displayOptions: showForQuery,
	options: [
		{
			name: "entries",
			displayName: "Contract",
			values: [
				{
					displayName: "Name",
					name: "name",
					type: "string",
					default: "",
					required: true,
					description:
						"Identifier referenced in the CEL expression (for example, `Token`)",
				},
				{
					displayName: "Address",
					name: "address",
					type: "string",
					default: "",
					required: true,
					placeholder: "0x…",
					description: "EIP-55 checksummed contract address",
				},
			],
		},
	],
};

/**
 * Shared field: Context variables (name + type + optional runtime value).
 * Describe reads only the type half; Execute / Validate read both. The Value
 * column is hidden on Describe via inner-field `displayOptions` so the UX
 * stays clean without forcing the user to re-enter type info when they
 * switch operations.
 */
const contextField: INodeProperties = {
	displayName: "Context Variables",
	name: "context",
	type: "fixedCollection",
	typeOptions: { multipleValues: true, sortable: true },
	placeholder: "Add context variable",
	default: {},
	description:
		"Named variables declared in the schema and optionally bound to runtime values. The expression references them via the `vars` map.",
	displayOptions: showForQuery,
	options: [
		{
			name: "entries",
			displayName: "Context Variable",
			values: [
				{
					displayName: "Name",
					name: "name",
					type: "string",
					default: "",
					required: true,
				},
				{
					displayName: "Type",
					name: "type",
					type: "options",
					default: "sol_address",
					options: SOL_TYPES.map((t) => ({ name: t, value: t })),
					required: true,
				},
				{
					displayName: "Value",
					name: "value",
					type: "string",
					default: "",
					description:
						'Runtime value. For `bool` use `true`/`false`; for `list<*>` pass a JSON array (for example, `["0x1","0x2"]`).',
					displayOptions: showForEvaluated,
				},
			],
		},
	],
};

/**
 * Shared field: CEL expression. Only visible for execute / validate — describe
 * infers the schema without evaluating anything. The `rows: 4` hint is a
 * deliberate nudge: expressions are routinely multi-line (e.g. conditional
 * returns) and a single-line input encourages the user to paste minified CEL.
 */
const expressionField: INodeProperties = {
	displayName: "Expression",
	name: "expression",
	type: "string",
	typeOptions: { rows: 4 },
	default: "",
	required: true,
	placeholder: "Token.balanceOf(holder)",
	description:
		'CEL expression to evaluate. Contracts and context variables are referenced by name. See the <a href="https://docs.evmquery.com">evmquery docs</a> for the full CEL surface.',
	displayOptions: {
		show: { "/operation": ["execute", "validate"] },
	},
};

/**
 * Shared field: Advanced options. Kept as an n8n `collection` so any future
 * knobs (block tag, retries) can be added without disrupting the main UI.
 * `outputFormat` lives here (not as a top-level field) so the default path
 * — Simple — is invisible to users who don't care, while power users can
 * still opt into the Raw envelope via "Add option".
 */
const optionsField: INodeProperties = {
	displayName: "Options",
	name: "options",
	type: "collection",
	placeholder: "Add option",
	default: {},
	displayOptions: {
		show: { "/operation": ["execute", "validate"] },
	},
	options: [
		{
			displayName: "Output Format",
			name: "outputFormat",
			type: "options",
			default: "simple",
			options: [
				{
					name: "Simple",
					value: "simple",
					description:
						"Unwrap `result.value`; attach `$meta` with block, credits, rounds, and on-chain call counts",
				},
				{
					name: "Raw",
					value: "raw",
					description: "Return the full API envelope verbatim",
				},
			],
			description:
				"Shape of the returned data. Only applies to Execute; Validate always returns the full validation envelope.",
			displayOptions: { show: { "/operation": ["execute"] } },
		},
		{
			displayName: "Timeout (Ms)",
			name: "timeoutMs",
			type: "number",
			default: 0,
			typeOptions: { minValue: 0 },
			description:
				"Server-side evaluation timeout in milliseconds. Leave empty for the evmquery default.",
		},
	],
};

/**
 * Coerce an arbitrary param value into a parsed object when n8n's AI Agent
 * fed it in via `$fromAI` as a JSON string.
 */
function coerceObject(raw: unknown): Record<string, unknown> | undefined {
	if (raw === undefined || raw === null) {
		return undefined;
	}

	if (typeof raw === "string") {
		const trimmed = raw.trim();
		if (trimmed === "") {
			return undefined;
		}

		try {
			const parsed = JSON.parse(trimmed) as unknown;

			return typeof parsed === "object" && parsed !== null
				? (parsed as Record<string, unknown>)
				: undefined;
		} catch {
			return undefined;
		}
	}

	if (typeof raw === "object") {
		return raw as Record<string, unknown>;
	}

	return undefined;
}

/**
 * Normalizes a Contracts parameter into the evmquery API's expected shape:
 * `{ <name>: { address: "0x…" } }`. Accepts either the UI fixedCollection
 * layout (`{ entries: [{ name, address }] }`) or an AI-provided JSON object
 * (either `{ Name: { address } }` or the flat `{ Name: "0x…" }`).
 */
function parseContracts(raw: unknown): Record<string, { address: string }> {
	const root = coerceObject(raw);
	if (!root) {
		return {};
	}

	const result: Record<string, { address: string }> = {};

	if (Array.isArray(root["entries"])) {
		for (const entry of root["entries"]) {
			if (typeof entry !== "object" || entry === null) {
				continue;
			}

			const row = entry as { name?: unknown; address?: unknown };
			if (typeof row.name === "string" && typeof row.address === "string") {
				result[row.name] = { address: row.address };
			}
		}

		return result;
	}

	for (const [name, value] of Object.entries(root)) {
		if (typeof value === "string") {
			result[name] = { address: value };

			continue;
		}

		if (typeof value === "object" && value !== null) {
			const addr = (value as { address?: unknown }).address;
			if (typeof addr === "string") {
				result[name] = { address: addr };
			}
		}
	}

	return result;
}

const isSolType = (v: unknown): v is SolType =>
	typeof v === "string" && (SOL_TYPES as readonly string[]).includes(v);

/**
 * Normalizes a Context parameter into `schema.context` type declarations.
 * Works on both the unified `context` fixedCollection (ignoring the Value
 * column) and an AI JSON object (`{ name: solType }`). Unknown types are
 * dropped so the server-side validator produces a clean error instead of
 * the n8n node leaking garbage into the request.
 */
function parseContextTypes(raw: unknown): Record<string, SolType> {
	const root = coerceObject(raw);
	if (!root) {
		return {};
	}

	const result: Record<string, SolType> = {};

	if (Array.isArray(root["entries"])) {
		for (const entry of root["entries"]) {
			if (typeof entry !== "object" || entry === null) {
				continue;
			}

			const row = entry as { name?: unknown; type?: unknown };
			if (typeof row.name === "string" && isSolType(row.type)) {
				result[row.name] = row.type;
			}
		}

		return result;
	}

	for (const [name, value] of Object.entries(root)) {
		if (isSolType(value)) {
			result[name] = value;
		}
	}

	return result;
}

/**
 * Coerces a raw UI value into the JSON shape the API expects for the given
 * sol type. The coercion is conservative: we only do the minimum necessary
 * to avoid sending obvious type mismatches (booleans-as-strings, lists
 * encoded as JSON strings). Everything else — including address checksums
 * and big-int precision — is delegated to the server.
 */
function coerceValue(rawValue: unknown, type: SolType): unknown {
	if (type === "bool") {
		if (typeof rawValue === "boolean") {
			return rawValue;
		}

		if (typeof rawValue === "string") {
			const lower = rawValue.trim().toLowerCase();
			if (lower === "true" || lower === "1") {
				return true;
			}

			if (lower === "false" || lower === "0") {
				return false;
			}
		}

		return rawValue;
	}

	if (type.startsWith("list<")) {
		if (Array.isArray(rawValue)) {
			return rawValue;
		}

		if (typeof rawValue === "string" && rawValue.trim() !== "") {
			try {
				const parsed = JSON.parse(rawValue) as unknown;

				return Array.isArray(parsed) ? parsed : rawValue;
			} catch {
				return rawValue;
			}
		}

		return rawValue;
	}

	return rawValue;
}

/**
 * Extracts the runtime values half of the Context Variables collection.
 * Requires the parsed types map so it can apply per-type coercion (bool,
 * list<*>). Only emits entries whose type is known — stray values without a
 * declared type would be dropped by the API anyway.
 */
function parseContextValues(
	raw: unknown,
	types: Record<string, SolType>,
): Record<string, unknown> {
	const root = coerceObject(raw);
	if (!root) {
		return {};
	}

	const result: Record<string, unknown> = {};

	if (Array.isArray(root["entries"])) {
		for (const entry of root["entries"]) {
			if (typeof entry !== "object" || entry === null) {
				continue;
			}

			const row = entry as {
				name?: unknown;
				type?: unknown;
				value?: unknown;
			};
			if (typeof row.name !== "string" || row.value === undefined) {
				continue;
			}

			const type = types[row.name];
			if (type === undefined) {
				continue;
			}

			if (typeof row.value === "string" && row.value === "") {
				continue;
			}

			result[row.name] = coerceValue(row.value, type);
		}

		return result;
	}

	for (const [name, value] of Object.entries(root)) {
		const type = types[name];
		if (type === undefined) {
			continue;
		}

		result[name] = coerceValue(value, type);
	}

	return result;
}

export {
	chainField,
	contextField,
	contractsField,
	expressionField,
	optionsField,
	parseContextTypes,
	parseContextValues,
	parseContracts,
	SOL_TYPES,
};
export type { SolType };
