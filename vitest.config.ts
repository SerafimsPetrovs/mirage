import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    env: { DATABASE_URL: "file:./test.db" },
    globalSetup: ["./vitest.setup.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/lib/test-server-only.ts"),
    },
  },
});
