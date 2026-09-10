import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // 結合テスト(tests/integration/**)はDB前提のため既定の `npm test` からは除外し、
    // `npm run test:integration`（vitest.integration.config.ts, Postgres必須）で実行する。
    exclude: [...configDefaults.exclude, 'tests/integration/**'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/', '**/*.test.ts'],
    },
  },
});
