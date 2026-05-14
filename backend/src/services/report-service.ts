import type { PrismaClient, ReportCategory } from '@prisma/client';

const VALID_CATEGORIES: ReportCategory[] = ['CHEAT', 'HARASSMENT', 'NO_SHOW', 'OTHER'];

const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_EVIDENCE_URLS = 5;

/**
 * 試合相手を通報する
 *
 * - 試合は COMPLETED / DRAW / DISPUTED で報告可能
 * - 通報者は試合参加者のみ
 * - 同じ試合に対する重複通報は許容（複数の問題を別々に通報できる）
 */
export async function createReport(
  prisma: PrismaClient,
  matchId: string,
  reporterId: string,
  category: ReportCategory,
  description: string,
  evidenceUrls: string[] = [],
): Promise<{ id: string }> {
  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error(`不正なカテゴリ: ${category}`);
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`説明は${MAX_DESCRIPTION_LENGTH}文字以内にしてください`);
  }
  if (evidenceUrls.length > MAX_EVIDENCE_URLS) {
    throw new Error(`エビデンスURLは${MAX_EVIDENCE_URLS}件まで`);
  }

  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: matchId } });
    if (!match) throw new Error('Match not found');
    if (
      match.status !== 'COMPLETED' &&
      match.status !== 'DRAW' &&
      match.status !== 'DISPUTED' &&
      match.status !== 'CANCELLED'
    ) {
      throw new Error(`このステータスでは通報できません: ${match.status}`);
    }
    if (reporterId !== match.player1Id && reporterId !== match.player2Id) {
      throw new Error('参加者ではありません');
    }
    const targetId = reporterId === match.player1Id ? match.player2Id : match.player1Id;

    const report = await tx.report.create({
      data: {
        matchId,
        reporterId,
        targetId,
        category,
        description,
        evidenceUrls,
      },
    });
    return { id: report.id };
  });
}
