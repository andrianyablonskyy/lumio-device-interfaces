import { defineConfig } from 'vitest/config';

// Interface + data structure regression: schemas, examples, specs, test vectors, reference code. No services needed.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts']
  }
});
