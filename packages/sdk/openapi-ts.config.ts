import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
	input: "https://api.evmquery.com/api/docs-json",
	output: {
		path: "src/generated",
		postProcess: ["prettier"],
	},
	plugins: [
		{ name: "@hey-api/client-fetch" },
		{ name: "@hey-api/typescript", enums: "typescript" },
		{ name: "@hey-api/sdk" },
	],
});
