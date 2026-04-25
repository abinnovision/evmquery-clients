/**
 * Package-wide configuration constants. There is only one evmquery deployment,
 * so the API base URL is a compile-time constant rather than a credential
 * field. Centralised here so the credentials' test request and the runtime
 * transport stay in lock-step.
 */
export const EVMQUERY_BASE_URL = "https://api.evmquery.com/api/v1";
