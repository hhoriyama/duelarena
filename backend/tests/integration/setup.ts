import { config } from 'dotenv';
import path from 'path';
import { afterAll } from 'vitest';

// .env.test を最優先で読み込む（他のmoduleが参照する前に必要）
config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

if (!process.env.DATABASE_URL) {
  throw new Error('結合テストには DATABASE_URL の設定が必要です（.env.test）');
}
if (!process.env.DATABASE_URL.includes('test')) {
  throw new Error(
    `安全対策: DATABASE_URL に "test" が含まれていません。本番DBへの誤接続を防ぐためテストを中断します。\n` +
      `現在の値: ${process.env.DATABASE_URL}`,
  );
}

// テスト終了時にPrismaを切断
afterAll(async () => {
  const { testPrisma } = await import('./helpers/db');
  await testPrisma.$disconnect();
});
