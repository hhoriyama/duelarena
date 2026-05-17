import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { attachSocketServer } from './sockets';
import { initDiscordBot } from './discord/bot';

async function main() {
  // サーバーを先に起動してヘルスチェックに応答できるようにする
  const app = createApp();
  const httpServer = createServer(app);
  attachSocketServer(httpServer);

  httpServer.listen(env.PORT, () => {
    console.log(`🎮 Duel Arena backend listening on http://localhost:${env.PORT}`);
    console.log(`   Frontend URL: ${env.FRONTEND_URL}`);
    console.log(`   Env: ${env.NODE_ENV}`);
  });

  // Discord Bot はバックグラウンドで初期化（完了を待たない）
  initDiscordBot().catch((err) => {
    console.error('[discord] Bot initialization failed:', err);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
