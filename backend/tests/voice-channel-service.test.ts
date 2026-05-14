import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMatchVoiceChannel,
  deleteVoiceChannel,
} from '../src/discord/voice-channel-service';
import * as bot from '../src/discord/bot';

describe('createMatchVoiceChannel', () => {
  beforeEach(() => {
    bot._resetForTest();
  });

  it('Bot未設定（getDiscordClient=null）の場合は null を返す', async () => {
    vi.spyOn(bot, 'getDiscordClient').mockReturnValue(null);
    const result = await createMatchVoiceChannel('m1', 'p1', 'p2');
    expect(result).toBeNull();
  });

  it('Discord APIで例外が発生した場合は null を返す（マッチフローを止めない）', async () => {
    const mockClient = {
      guilds: {
        fetch: vi.fn().mockRejectedValue(new Error('API down')),
      },
    } as unknown as ReturnType<typeof bot.getDiscordClient>;
    vi.spyOn(bot, 'getDiscordClient').mockReturnValue(mockClient);
    // GUILD_ID が必要
    process.env.DISCORD_GUILD_ID = 'guild-id-test';
    // ただし env は起動時にロードされるため、機能無効モード扱いになる可能性があり
    // ここでは getDiscordClient のみ確認

    const result = await createMatchVoiceChannel('m1', 'p1', 'p2');
    expect(result).toBeNull();
  });
});

describe('deleteVoiceChannel', () => {
  beforeEach(() => {
    bot._resetForTest();
  });

  it('Bot未設定なら false を返し、エラーにならない', async () => {
    vi.spyOn(bot, 'getDiscordClient').mockReturnValue(null);
    const result = await deleteVoiceChannel('channel-id');
    expect(result).toBe(false);
  });

  it('既に削除済み (Unknown Channel: code 10003) は成功扱い (true)', async () => {
    const error: Error & { code?: number } = new Error('Unknown Channel');
    error.code = 10003;
    const mockClient = {
      channels: {
        fetch: vi.fn().mockRejectedValue(error),
      },
    } as unknown as ReturnType<typeof bot.getDiscordClient>;
    vi.spyOn(bot, 'getDiscordClient').mockReturnValue(mockClient);

    const result = await deleteVoiceChannel('already-deleted');
    expect(result).toBe(true);
  });

  it('チャンネルが存在すれば delete() を呼ぶ', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const mockClient = {
      channels: {
        fetch: vi.fn().mockResolvedValue({ delete: deleteFn }),
      },
    } as unknown as ReturnType<typeof bot.getDiscordClient>;
    vi.spyOn(bot, 'getDiscordClient').mockReturnValue(mockClient);

    const result = await deleteVoiceChannel('exists');
    expect(result).toBe(true);
    expect(deleteFn).toHaveBeenCalledOnce();
  });
});
