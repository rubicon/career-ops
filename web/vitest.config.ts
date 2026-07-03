import path from "node:path";
import { defineConfig } from "vitest/config";

// Route/lib tests run in Node (they touch node:fs and spawn the resolver CLI).
// The @/ alias mirrors tsconfig "paths" so tests import exactly like the app.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
