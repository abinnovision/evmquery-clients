import { NodeApiError } from "n8n-workflow";

import type { INode, JsonObject } from "n8n-workflow";

interface FriendlyError {
	message: string;
	description: string;
}

/**
 * Extracts the HTTP status code from the heterogeneous error shapes that
 * n8n's `httpRequestWithAuthentication` can throw. We try the common places
 * (response.status, httpCode, statusCode) before giving up.
 */
function extractStatus(error: unknown): number | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}

	const record = error as Record<string, unknown>;
	const response = record["response"] as Record<string, unknown> | undefined;
	if (response && typeof response["status"] === "number") {
		return response["status"];
	}

	if (typeof record["httpCode"] === "string") {
		const n = Number.parseInt(record["httpCode"], 10);
		if (Number.isFinite(n)) {
			return n;
		}
	}

	if (typeof record["statusCode"] === "number") {
		return record["statusCode"];
	}

	return undefined;
}

/**
 * Extracts the parsed response body (when present). Falls back to the raw
 * error so NodeApiError's own pretty-printer has something to work with.
 */
function extractBody(error: unknown): JsonObject {
	if (typeof error !== "object" || error === null) {
		return { error: String(error) };
	}

	const record = error as Record<string, unknown>;
	const response = record["response"] as Record<string, unknown> | undefined;
	if (
		response &&
		typeof response["body"] === "object" &&
		response["body"] !== null
	) {
		return response["body"] as JsonObject;
	}

	return record as JsonObject;
}

/**
 * Produces a human-friendly message + description tuple for each status class
 * we care about. Falls through to a generic fallback for anything else.
 */
function friendlyMessage(
	status: number | undefined,
	body: JsonObject,
): FriendlyError {
	const serverMessage =
		(body["message"] as string | undefined) ??
		(body["error"] as string | undefined);

	if (status === 400) {
		return {
			message: "Bad request to evmquery",
			description:
				serverMessage ??
				"The request payload was invalid. Use Query.Validate to sanity-check the query and variables.",
		};
	}

	if (status === 401) {
		return {
			message: "Invalid evmquery API key",
			description:
				"Check the credential's API key and rotate or regenerate it from the evmquery dashboard if needed.",
		};
	}

	if (status === 403) {
		return {
			message: "Access forbidden by evmquery",
			description:
				serverMessage ??
				"The API key lacks permission for this operation, or the plan quota has been exceeded.",
		};
	}

	if (status === 429) {
		return {
			message: "evmquery rate limit exceeded",
			description:
				"Your plan's rate limit has been reached. Inspect /usage or slow down the request rate before retrying.",
		};
	}

	if (status !== undefined && status >= 500) {
		return {
			message: `evmquery service error (${String(status)})`,
			description:
				"The evmquery API reported a server-side error. Retry may succeed; otherwise contact support.",
		};
	}

	return {
		message: "evmquery request failed",
		description: serverMessage ?? "An unexpected error occurred.",
	};
}

/**
 * Maps any error thrown by evmquery's HTTP transport into a NodeApiError
 * with a stable message/description/httpCode shape. Centralizing this keeps
 * every operation (Query.Execute, Chain.List, etc.) surfacing consistent
 * diagnostics in the n8n UI.
 */
export function mapEvmQueryError(node: INode, error: unknown): NodeApiError {
	const status = extractStatus(error);
	const body = extractBody(error);
	const { message, description } = friendlyMessage(status, body);

	return new NodeApiError(node, body, {
		message,
		description,
		httpCode: status !== undefined ? String(status) : undefined,
	});
}
