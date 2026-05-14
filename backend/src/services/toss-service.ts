import type { PrismaClient, Match, User } from '@prisma/client';
import {
  TOSS_BONUS_FOR_RECEIVER,
  calculateTossPenalty,
  applyTossRatingChange,
} from './toss-core';

export interface AcceptResult {
  match: Match;
  bothAccepted: boolean;
}

/**
 * 試合のマッチ成立後（PENDING_TOSS）にユーザーが承認する
 *
 * - 自分のフラグを true にする
 * - 相手も承認済みなら status を IN_PROGRESS に進める
 */
export async function acceptMatch(
  prisma: PrismaClient,
  matchId: string,
  userId: string,
): Promise<AcceptResult> {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.status !== 'PENDING_TOSS') {
      throw new Error(`Cannot accept in status ${match.status}`);
    }
    const isPlayer1 = match.player1Id === userId;
    const isPlayer2 = match.player2Id === userId;
    if (!isPlayer1 && !isPlayer2) throw new Error('Not a participant');

    const updateData: {
      player1Accepted?: boolean;
      player2Accepted?: boolean;
      status?: 'IN_PROGRESS';
      acceptedAt?: Date;
    } = {};

    if (isPlayer1) updateData.player1Accepted = true;
    else updateData.player2Accepted = true;

    const otherAccepted = isPlayer1 ? match.player2Accepted : match.player1Accepted;
    const bothAccepted = otherAccepted; // 自分は今承認、相手も承認済みなら両者OK

    if (bothAccepted) {
      updateData.status = 'IN_PROGRESS';
      updateData.acceptedAt = new Date();
    }

    const updated = await tx.match.update({
      where: { id: matchId },
      data: updateData,
    });

    return { match: updated, bothAccepted };
  });
}

export interface TossResult {
  match: Match;
  tosser: User;
  receiver: User;
  tosserDelta: number;
  receiverDelta: number;
}

/**
 * 試合をトスする（マッチ成立後の不戦敗扱い）
 *
 * - tossById をセット、status を COMPLETED に
 * - トスした側に連続トスカウンタに応じたペナルティ
 * - 受諾側に +5
 * - レート履歴を記録
 */
export async function tossMatch(
  prisma: PrismaClient,
  matchId: string,
  userId: string,
): Promise<TossResult> {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (match.status !== 'PENDING_TOSS') {
      throw new Error(`Cannot toss in status ${match.status}`);
    }
    const isPlayer1 = match.player1Id === userId;
    const isPlayer2 = match.player2Id === userId;
    if (!isPlayer1 && !isPlayer2) throw new Error('Not a participant');

    const tosserId = userId;
    const receiverId = isPlayer1 ? match.player2Id : match.player1Id;

    const tosser = await tx.user.findUniqueOrThrow({ where: { id: tosserId } });
    const receiver = await tx.user.findUniqueOrThrow({ where: { id: receiverId } });

    // 連続トスカウンタを増やす
    const newConsecutive = tosser.consecutiveTossCount + 1;
    const penaltyDelta = calculateTossPenalty(newConsecutive);

    const tosserNewRating = applyTossRatingChange(tosser.currentRating, penaltyDelta);
    const receiverNewRating = receiver.currentRating + TOSS_BONUS_FOR_RECEIVER;

    // ユーザー更新
    const updatedTosser = await tx.user.update({
      where: { id: tosserId },
      data: {
        currentRating: tosserNewRating,
        consecutiveTossCount: newConsecutive,
        // highestRating は更新しない（減算のため）
      },
    });

    const updatedReceiver = await tx.user.update({
      where: { id: receiverId },
      data: {
        currentRating: receiverNewRating,
        highestRating: Math.max(receiver.highestRating, receiverNewRating),
      },
    });

    // レート履歴
    await tx.ratingHistory.createMany({
      data: [
        {
          userId: tosserId,
          matchId: match.id,
          ratingBefore: tosser.currentRating,
          ratingAfter: tosserNewRating,
          delta: penaltyDelta,
          reason: 'TOSS_PENALTY',
        },
        {
          userId: receiverId,
          matchId: match.id,
          ratingBefore: receiver.currentRating,
          ratingAfter: receiverNewRating,
          delta: TOSS_BONUS_FOR_RECEIVER,
          reason: 'TOSS_RECEIVED',
        },
      ],
    });

    // 試合更新
    const updatedMatch = await tx.match.update({
      where: { id: matchId },
      data: {
        tossById: tosserId,
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });

    return {
      match: updatedMatch,
      tosser: updatedTosser,
      receiver: updatedReceiver,
      tosserDelta: penaltyDelta,
      receiverDelta: TOSS_BONUS_FOR_RECEIVER,
    };
  });
}
