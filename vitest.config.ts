import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests share one DATABASE_URL and truncate tables in setup —
    // run files sequentially so they can't clobber each other.
    fileParallelism: false,
  },
});
