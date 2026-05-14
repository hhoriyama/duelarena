import { defineConfig } from 'vitest/config';

/**
 * 結合テスト用設定。
 *
 * 起動前提:
 *   1. docker compose -f docker-compose.test.yml up -d
 *   2. cp backend/.env.test.example backend/.env.test
 *   3. cd backend && DATABASE_URL=... npx prisma migrate deploy
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/integration/setup.ts'],
    include: ['tests/integration/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true }, // テスト間でDBを共有するため逐次実行
    },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
