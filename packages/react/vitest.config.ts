import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "react#unit",
		environment: "jsdom",
		include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
		typecheck: {
			enabled: true,
			include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
		},
	},
});
