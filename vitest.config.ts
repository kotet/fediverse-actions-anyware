import { defineConfig } from "vitest/config";

export default defineConfig({
  // Tests run against the development build, which carries the mocks.
  define: { FAA_INCLUDE_MOCKS: "true" },
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
