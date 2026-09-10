import type { PrismaClient } from '@prisma/client';

/**
 * アプリ全体の設定KV。
 * DBに持つことでBackend再起動を跨いで状態が維持される。
 */

const EVENT_OPEN_KEY = 'eventOpen';
const EVENT_OPENED_AT_KEY = 'eventOpenedAt';

export async function isEventOpen(prisma: PrismaClient): Promise<boolean> {
  const s = await prisma.setting.findUnique({ where: { key: EVENT_OPEN_KEY } });
  return s?.value === 'true';
}

export async function setEventOpen(prisma: PrismaClient, open: boolean): Promise<void> {
  await prisma.setting.upsert({
    where: { key: EVENT_OPEN_KEY },
    create: { key: EVENT_OPEN_KEY, value: String(open) },
    update: { value: String(open) },
  });
  // 開催開始の時刻を記録する（順位表の集計起点。開催のたびにリセットされる）
  if (open) {
    const now = new Date().toISOString();
    await prisma.setting.upsert({
      where: { key: EVENT_OPENED_AT_KEY },
      create: { key: EVENT_OPENED_AT_KEY, value: now },
      update: { value: now },
    });
  }
}

/** 最後にイベントを開始した日時。未開催なら null。 */
export async function getEventOpenedAt(prisma: PrismaClient): Promise<Date | null> {
  const s = await prisma.setting.findUnique({ where: { key: EVENT_OPENED_AT_KEY } });
  if (!s?.value) return null;
  const d = new Date(s.value);
  return Number.isNaN(d.getTime()) ? null : d;
}
