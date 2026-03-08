import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		exclude: ["node_modules", "dist"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["src/cli/**", "src/**/*.test.ts"],
			thresholds: {
				branches: 80,
				functions: 80,
				lines: 80,
				statements: 80,
			},
		},
	},
});
