import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "utils/**/*.ts", "components/**/*.tsx"],
      thresholds: {
        lines: 2,
      },
    },
  },
});
