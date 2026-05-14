import { Client, GatewayIntentBits } from 'discord.js';
import { env } from '../config/env';

let _client: Client | null = null;
let _initPromise: Promise<Client | null> | null = null;

/**
 * Discord Bot を初期化する。
 *
 * - DISCORD_BOT_TOKEN が未設定なら何もせず null を返す（=Discord連携無効モード）
 * - 既に初期化済みなら同じインスタンスを返す
 */
export async function initDiscordBot(): Promise<Client | null> {
  if (_client?.isReady()) return _client;
  if (_initPromise) return _initPromise;

  if (!env.DISCORD_BOT_TOKEN) {
    console.warn(
      '[discord] DISCORD_BOT_TOKEN が未設定です。Discord連携機能は無効になります。',
    );
    return null;
  }

  _initPromise = new Promise<Client | null>((resolve) => {
    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    client.once('ready', () => {
      console.log(`[discord] Bot logged in as ${client.user?.tag}`);
      _client = client;
      resolve(client);
    });

    client.login(env.DISCORD_BOT_TOKEN).catch((err) => {
      console.error('[discord] ログイン失敗:', err);
      _initPromise = null;
      resolve(null);
    });
  });

  return _initPromise;
}

export function getDiscordClient(): Client | null {
  return _client;
}

/**
 * テスト用：内部状態をリセットする
 */
export function _resetForTest(): void {
  _client = null;
  _initPromise = null;
}
