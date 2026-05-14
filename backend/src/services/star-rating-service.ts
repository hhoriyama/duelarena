import type { PrismaClient } from '@prisma/client';
import { isValidStar, recalculateAverage } from './star-rating-core';

/**
 * 試合の相手に星評価をつける
 *
 * - 試合は COMPLETED でなければエラー（紛争中・進行中は不可）
 * - 自分が参加していない試合は不可
 * - 同じ試合に2回評価することは不可（@@unique([matchId, raterId])）
 * - 受信側ユーザーの平均評価を更新
 */
export async function rateOpponent(
  prisma: PrismaClient,
  matchId: string,
  raterId: string,
  stars: number,
): Promise<{ ratedId: string; newAverage: number }> {
  if (!isValidStar(stars)) {
    throw new Error('星評価は1〜5の整数で指定してください');
  }

  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.status !== 'COMPLETED' && match.status !== 'DRAW') {
      throw new Error(`このステータスでは評価できません: ${match.status}`);
    }
    if (raterId !== match.player1Id && raterId !== match.player2Id) {
      throw new Error('参加者ではありません');
    }
    const ratedId = raterId === match.player1Id ? match.player2Id : match.player1Id;

    // 既に評価済みなら拒否
    const existing = await tx.starRating.findUnique({
      where: { matchId_raterId: { matchId, raterId } },
    });
    if (existing) {
      throw new Error('既に評価済みです');
    }

    await tx.starRating.create({
      data: { matchId, raterId, ratedId, stars },
    });

    // 受信側の平均を再計算
    const ratedUser = await tx.user.findUniqueOrThrow({ where: { id: ratedId } });
    const ratedReceived = await tx.starRating.findMany({
      where: { ratedId },
    });
    const count = ratedReceived.length;
    const newAverage = recalculateAverage(
      ratedUser.averageStarRating,
      count - 1, // 今追加したレコードを除く
      stars,
    );

    await tx.user.update({
      where: { id: ratedId },
      data: { averageStarRating: newAverage },
    });

    return { ratedId, newAverage };
  });
}
