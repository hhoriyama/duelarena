import type { PrismaClient } from '@prisma/client';
import { isEventOpen, getEventOpenedAt } from './settings';

/**
 * イベント戦の順位表。
 * 「最後に /event open した時点」以降の EVENT 試合（勝者確定分）を集計する。
 */

export interface EventStanding {
  discordId: string;
  username: string;
  avatarUrl: string;
  wins: number;
  losses: number;
}

export interface EventSummary {
  open: boolean;
  openedAt: string | null;
  standings: EventStanding[];
}

export async function getEventSummary(prisma: PrismaClient): Promise<EventSummary> {
  const [open, openedAt] = await Promise.all([
    isEventOpen(prisma),
    getEventOpenedAt(prisma),
  ]);
  if (!openedAt) return { open, openedAt: null, standings: [] };

  const matches = await prisma.match.findMany({
    where: {
      mode: 'EVENT',
      status: 'COMPLETED',
      winnerId: { not: null },
      startedAt: { gte: openedAt },
    },
    include: { player1: true, player2: true },
  });

  const map = new Map<string, EventStanding>();
  const touch = (u: {
    id: string;
    discordId: string;
    username: string;
    avatarUrl: string;
  }): EventStanding => {
    let s = map.get(u.id);
    if (!s) {
      s = {
        discordId: u.discordId,
        username: u.username,
        avatarUrl: u.avatarUrl,
        wins: 0,
        losses: 0,
      };
      map.set(u.id, s);
    }
    return s;
  };

  for (const m of matches) {
    const p1 = touch(m.player1);
    const p2 = touch(m.player2);
    if (m.winnerId === m.player1Id) {
      p1.wins += 1;
      p2.losses += 1;
    } else {
      p2.wins += 1;
      p1.losses += 1;
    }
  }

  const standings = [...map.values()].sort(
    (a, b) => b.wins - a.wins || a.losses - b.losses || a.username.localeCompare(b.username),
  );
  return { open, openedAt: openedAt.toISOString(), standings };
}
