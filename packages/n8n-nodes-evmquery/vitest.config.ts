import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "n8n-nodes-evmquery#unit",
		include: ["src/**/*.spec.ts"],
		typecheck: { enabled: true, include: ["src/**/*.spec.ts"] },
	},
});
