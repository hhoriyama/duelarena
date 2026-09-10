import type { PrismaClient, Prisma, OutboxType, Match } from '@prisma/client';

/**
 * Bot配信の送信箱（outbox）。DESIGN.md §5/§8。
 *
 * Backendは配信すべきイベントをここに積むだけ。Botがポーリングで取得・ack する。
 */

export interface OutboxPayload {
  playerDiscordIds?: string[];
  approverDiscordId?: string;
  winnerDiscordId?: string;
  winnerDelta?: number;
  loserDelta?: number;
  summary?: string;
  [k: string]: unknown;
}

/** 汎用enqueue。 */
export async function enqueueOutbox(
  prisma: PrismaClient,
  type: OutboxType,
  matchId: string | null,
  payload: OutboxPayload,
): Promise<void> {
  await prisma.botOutbox.create({
    data: { type, matchId, payload: payload as Prisma.InputJsonValue },
  });
}

/**
 * 試合イベントを、両プレイヤーのDiscord IDを詰めて enqueue する。
 */
export async function enqueueMatchEvent(
  prisma: PrismaClient,
  type: OutboxType,
  match: Pick<Match, 'id' | 'player1Id' | 'player2Id' | 'mode'>,
  extra: Omit<OutboxPayload, 'playerDiscordIds'> = {},
): Promise<void> {
  const [p1, p2] = await Promise.all([
    prisma.user.findUnique({ where: { id: match.player1Id }, select: { discordId: true } }),
    prisma.user.findUnique({ where: { id: match.player2Id }, select: { discordId: true } }),
  ]);
  const ids = [p1?.discordId, p2?.discordId].filter((x): x is string => Boolean(x));
  await enqueueOutbox(prisma, type, match.id, {
    playerDiscordIds: ids,
    mode: match.mode,
    ...extra,
  });
}

/** Discord内部ユーザーIDからdiscordIdを引く小ヘルパ。 */
export async function discordIdOf(
  prisma: PrismaClient,
  userId: string,
): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { discordId: true },
  });
  return u?.discordId ?? null;
}

/** 未配信イベントを取得（古い順）。 */
export async function getPendingOutbox(prisma: PrismaClient, limit = 50) {
  return prisma.botOutbox.findMany({
    where: { delivered: false },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

/** 指定IDを配信済みにする。 */
export async function ackOutbox(prisma: PrismaClient, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await prisma.botOutbox.updateMany({
    where: { id: { in: ids } },
    data: { delivered: true, deliveredAt: new Date() },
  });
}
