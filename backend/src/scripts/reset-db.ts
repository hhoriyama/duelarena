import 'dotenv/config';
import { prisma } from '../lib/prisma';

/**
 * DBの全データを削除する（テーブル構造・マイグレーションは残す）。
 * リリース前にテストデータを一掃してクリーンな状態にするための運用スクリプト。
 *
 * 実行方法（backend ディレクトリで）:
 *   npm run db:reset -- --yes
 *
 * 安全装置: `--yes` を付けないと確認だけ表示して何もしない。
 * 接続先(DATABASE_URL)のホストも表示するので、本番/テストを取り違えないこと。
 */

// 外部キーの子→親の順で削除する（この順序なら制約違反にならない）
async function main() {
  const confirmed = process.argv.includes('--yes');

  const dbHost = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').host;
    } catch {
      return '(不明)';
    }
  })();

  console.log('==============================================');
  console.log(' デュエルアリーナ DB リセット');
  console.log(`  接続先: ${dbHost}`);
  console.log('==============================================');

  // 削除前の件数を表示
  const before = {
    ユーザー: await prisma.user.count(),
    試合: await prisma.match.count(),
    キュー: await prisma.queueEntry.count(),
  };
  console.log('現在のデータ:', before);

  if (!confirmed) {
    console.log('');
    console.log('※ これは確認モードです。まだ何も削除していません。');
    console.log('  本当に全データを削除するには、次のように実行してください:');
    console.log('    npm run db:reset -- --yes');
    await prisma.$disconnect();
    return;
  }

  console.log('');
  console.log('全データを削除します…');

  // 子テーブルから順に削除
  await prisma.starRating.deleteMany();
  await prisma.report.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.recentOpponent.deleteMany();
  await prisma.botOutbox.deleteMany();
  await prisma.ratingHistory.deleteMany();
  await prisma.matchReport.deleteMany();
  await prisma.queueEntry.deleteMany();
  await prisma.ban.deleteMany();
  await prisma.seasonTitle.deleteMany();
  await prisma.match.deleteMany();
  await prisma.season.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();

  console.log('完了しました。DBは空の状態です。');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('リセット中にエラーが発生しました:', err);
  await prisma.$disconnect();
  process.exit(1);
});
