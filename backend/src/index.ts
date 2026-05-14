import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { attachSocketServer } from './sockets';
import { initDiscordBot } from './discord/bot';

async function main() {
  // Discord Bot の起動（未設定なら no-op）
  await initDiscordBot();

  const app = createApp();
  const httpServer = createServer(app);
  attachSocketServer(httpServer);

  httpServer.listen(env.PORT, () => {
    console.log(`🎮 Duel Arena backend listening on http://localhost:${env.PORT}`);
    console.log(`   Frontend URL: ${env.FRONTEND_URL}`);
    console.log(`   Env: ${env.NODE_ENV}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
