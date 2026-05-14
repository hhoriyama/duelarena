import { PrismaClient } from '@prisma/client';

/**
 * 結合テスト用の Prisma クライアント。
 * .env.test の DATABASE_URL を参照する。
 */
export const testPrisma = new PrismaClient({
  log: ['error'],
});

/**
 * 全テーブルを TRUNCATE する（高速・依存順無視で動作）。
 *
 * 各テストの beforeEach で呼ぶこと。
 */
export async function resetDb(): Promise<void> {
  // PostgreSQLの CASCADE 付き TRUNCATE で依存関係を一気に処理
  await testPrisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "RatingHistory",
      "MatchReport",
      "StarRating",
      "Report",
      "RecentOpponent",
      "Dispute",
      "QueueEntry",
      "Ban",
      "SeasonTitle",
      "Match",
      "Season",
      "User"
    RESTART IDENTITY CASCADE
  `);
}
