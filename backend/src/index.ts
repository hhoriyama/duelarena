import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import {
  startMatchmakerLoop,
  startMatchFinalizeLoop,
} from './services/matchmaker-loop';

// 未処理エラーを必ずログに残す
process.on('uncaughtException', (err) => {
  process.stderr.write(`[uncaughtException] ${err.stack ?? err.message}\n`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[unhandledRejection] ${String(reason)}\n`);
  process.exit(1);
});

async function main() {
  // サーバーを先に起動してヘルスチェックに応答できるようにする
  const app = createApp();
  const httpServer = createServer(app);

  httpServer.listen(env.PORT, () => {
    console.log(`🎮 Duel Arena backend listening on http://localhost:${env.PORT}`);
    console.log(`   Env: ${env.NODE_ENV}`);
  });

  // Bot版：Socket.IO は撤去。マッチングは常駐ループが駆動し、Discordへの通知は
  // outbox（Botがポーリング）で届ける。DESIGN.md §4/§5。
  // Discordチャンネルの生成・削除は Bot 側（duelarena-bot）が担うため、Backendは
  // discord.js を起動しない。
  startMatchmakerLoop(prisma);
  startMatchFinalizeLoop(prisma);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
