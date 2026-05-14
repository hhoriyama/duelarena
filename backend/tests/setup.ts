// テスト実行前に環境変数を設定する
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';
process.env.DISCORD_CLIENT_ID = 'test-client-id';
process.env.DISCORD_CLIENT_SECRET = 'test-client-secret';
process.env.DISCORD_REDIRECT_URI = 'http://localhost:3001/api/auth/discord/callback';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.ADMIN_DISCORD_IDS = '111,222';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
