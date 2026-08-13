import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    environmentOptions: {
      happyDOM: {
        url: "https://mastodon.archive.org",
      },
    },
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
});
