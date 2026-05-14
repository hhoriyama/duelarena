import { ChannelType, OverwriteType, PermissionsBitField } from 'discord.js';
import type { PrismaClient } from '@prisma/client';
import { getDiscordClient } from './bot';
import { env } from '../config/env';

/**
 * マッチ用のボイスチャンネルを生成する。
 *
 * - Bot未設定 / GUILD_ID未設定なら null を返す（=機能無効）
 * - 既存チャンネルが指定されていれば再利用（無駄な再作成を防ぐ）
 * - 2人のDiscordユーザーだけが閲覧・接続できる権限を設定
 *
 * @returns 作成されたチャンネルID。失敗時はnull
 */
export async function createMatchVoiceChannel(
  matchId: string,
  player1DiscordId: string,
  player2DiscordId: string,
): Promise<string | null> {
  const client = getDiscordClient();
  if (!client || !env.DISCORD_GUILD_ID) return null;

  try {
    const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID);
    const shortId = matchId.slice(0, 8);
    const botUserId = client.user?.id;
    if (!botUserId) {
      console.warn('[discord] Bot user ID 未取得');
      return null;
    }

    const channel = await guild.channels.create({
      name: `match-${shortId}`,
      type: ChannelType.GuildVoice,
      parent: env.DISCORD_VOICE_CATEGORY_ID ?? undefined,
      reason: `Duel Arena match ${matchId}`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          type: OverwriteType.Role,
          deny: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
          ],
        },
        // Bot自身を明示的に許可（@everyoneのdenyに巻き込まれて削除できなくなるのを防ぐ）
        {
          id: botUserId,
          type: OverwriteType.Member,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.Connect,
          ],
        },
        {
          id: player1DiscordId,
          type: OverwriteType.Member,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak,
          ],
        },
        {
          id: player2DiscordId,
          type: OverwriteType.Member,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak,
          ],
        },
      ],
    });
    console.log(`[discord] created channel ${channel.id} for match ${matchId}`);
    return channel.id;
  } catch (err) {
    console.error('[discord] createMatchVoiceChannel 失敗:', err);
    return null;
  }
}

/**
 * 指定したチャンネルを削除する
 */
export async function deleteVoiceChannel(channelId: string): Promise<boolean> {
  const client = getDiscordClient();
  if (!client) return false;
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel) {
      await channel.delete('Duel Arena match ended');
      console.log(`[discord] deleted channel ${channelId}`);
    }
    return true;
  } catch (err) {
    // 既に削除済みなら無視
    if ((err as { code?: number }).code === 10003) return true;
    console.error('[discord] deleteVoiceChannel 失敗:', err);
    return false;
  }
}

/**
 * マッチ成立時：VC生成 + DBにチャンネルID保存
 */
export async function setupMatchChannel(
  prisma: PrismaClient,
  matchId: string,
  player1DiscordId: string,
  player2DiscordId: string,
): Promise<string | null> {
  // 既にチャンネルがあれば再利用
  const existing = await prisma.match.findUnique({
    where: { id: matchId },
    select: { discordVoiceChannelId: true },
  });
  if (existing?.discordVoiceChannelId) return existing.discordVoiceChannelId;

  const channelId = await createMatchVoiceChannel(
    matchId,
    player1DiscordId,
    player2DiscordId,
  );
  if (channelId) {
    await prisma.match.update({
      where: { id: matchId },
      data: { discordVoiceChannelId: channelId },
    });
  }
  return channelId;
}

/**
 * マッチ終了時：VC削除 + DBのチャンネルIDをクリア
 */
export async function teardownMatchChannel(
  prisma: PrismaClient,
  matchId: string,
): Promise<void> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { discordVoiceChannelId: true },
  });
  if (!match?.discordVoiceChannelId) return;

  const ok = await deleteVoiceChannel(match.discordVoiceChannelId);
  if (ok) {
    await prisma.match.update({
      where: { id: matchId },
      data: { discordVoiceChannelId: null },
    });
  }
}
