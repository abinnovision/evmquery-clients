import {
	base,
	configFiles,
	stylistic,
	vitest,
} from "@abinnovision/eslint-config-base";
import { n8nCommunityNodesPlugin } from "@n8n/eslint-plugin-community-nodes";
import { defineConfig } from "eslint/config";

export default defineConfig([
	{ extends: [base, vitest, stylistic] },
	{
		extends: [n8nCommunityNodesPlugin.configs.recommended],
		files: ["src/**/*.ts"],
		ignores: ["src/**/*.spec.ts"],
	},
	{ files: ["*.{c,m,}{t,j}s"], extends: [configFiles] },
]);
