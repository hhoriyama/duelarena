import type { PrismaClient, User } from '@prisma/client';
import {
  DiscordUser,
  buildAvatarUrl,
  getDisplayName,
} from './discord-oauth';

/**
 * Discordユーザー情報からアプリのユーザーを upsert する
 */
export async function upsertUserFromDiscord(
  prisma: PrismaClient,
  discordUser: DiscordUser,
): Promise<User> {
  const username = getDisplayName(discordUser);
  const avatarUrl = buildAvatarUrl(discordUser);

  return prisma.user.upsert({
    where: { discordId: discordUser.id },
    create: {
      discordId: discordUser.id,
      username,
      avatarUrl,
    },
    update: {
      username,
      avatarUrl,
    },
  });
}

/**
 * ユーザーをパブリック情報に変換する
 */
export function toUserPublic(user: User) {
  return {
    id: user.id,
    discordId: user.discordId,
    username: user.username,
    avatarUrl: user.avatarUrl,
    currentRating: user.currentRating,
    highestRating: user.highestRating,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    averageStarRating: user.averageStarRating,
    matchCount: user.matchCount,
  };
}
