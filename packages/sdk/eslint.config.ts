import {
	base,
	configFiles,
	stylistic,
	vitest,
} from "@abinnovision/eslint-config-base";
import { defineConfig } from "eslint/config";

export default defineConfig([
	{ ignores: ["src/generated/**", "dist/**"] },
	{ extends: [base, vitest, stylistic] },
	{ files: ["*.{c,m,}{t,j}s"], extends: [configFiles] },
]);
