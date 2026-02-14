import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
    pool: 'forks',
    env: {
      DATABASE_URL: 'file:./dev.db',
      JWT_SECRET: 'test-secret-key',
    },
  },
});
