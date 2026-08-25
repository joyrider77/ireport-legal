import { fileURLToPath, URL } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/regression/**/*.test.ts"],
    environment: "node",
    globals: false,
    reporters: ["default"],
    pool: "forks",
    server: {
      deps: {
        inline: ["@caffeineai/object-storage", "@caffeineai/core-infrastructure"],
      },
    },
  },
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
  },
});
