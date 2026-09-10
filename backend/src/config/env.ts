import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3001'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1).optional(),

  JWT_SECRET: z.string().min(1).default('dev-secret-change-me'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_GUILD_ID: z.string().optional(),
  DISCORD_VOICE_CATEGORY_ID: z.string().optional(),

  // Bot（duelarena-bot）とBackend間の共有サービストークン。未設定なら /api/bot/* は拒否。
  BOT_API_SECRET: z.string().optional(),
  // テスト用: 直近対戦相手との再マッチ制限を無効化（'true' で無効化）。本番では設定しない。
  DISABLE_REMATCH_BLOCK: z.string().default('false'),
  // 常駐マッチングループの実行間隔（ms）
  MATCHMAKER_TICK_MS: z.string().default('15000'),
  MATCH_TIMEOUT_TICK_MS: z.string().default('30000'),
  DISCORD_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3001/api/auth/discord/callback'),

  ADMIN_DISCORD_IDS: z.string().default(''),

  // Web管理画面のログインパスワード。未設定なら管理ログイン無効。
  ADMIN_PASSWORD: z.string().optional(),

  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  PORT: Number(parsed.PORT),
  DISABLE_REMATCH_BLOCK: parsed.DISABLE_REMATCH_BLOCK === 'true',
  MATCHMAKER_TICK_MS: Number(parsed.MATCHMAKER_TICK_MS),
  MATCH_TIMEOUT_TICK_MS: Number(parsed.MATCH_TIMEOUT_TICK_MS),
  ADMIN_DISCORD_IDS: parsed.ADMIN_DISCORD_IDS
    ? parsed.ADMIN_DISCORD_IDS.split(',').map((s) => s.trim()).filter(Boolean)
    : [],
};

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
