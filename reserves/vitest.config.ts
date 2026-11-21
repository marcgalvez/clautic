import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    fileParallelism: false, // les proves d'integració comparteixen la BD de proves
    testTimeout: 20000,
  },
});
