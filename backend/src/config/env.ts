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
  DISCORD_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:3001/api/auth/discord/callback'),

  ADMIN_DISCORD_IDS: z.string().default(''),

  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  PORT: Number(parsed.PORT),
  ADMIN_DISCORD_IDS: parsed.ADMIN_DISCORD_IDS
    ? parsed.ADMIN_DISCORD_IDS.split(',').map((s) => s.trim()).filter(Boolean)
    : [],
};

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
