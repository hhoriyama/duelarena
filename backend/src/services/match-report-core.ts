/**
 * 勝敗登録の純粋ロジック
 *
 * 仕様 §3.4（改訂版）:
 * - 報告は誰でも先にできる
 * - 1人だけ報告 → WAITING_APPROVAL（相手が承認/異議）
 * - 両者が報告して内容が一致 → そのまま確定（COMPLETED）
 * - 両者が報告して内容が不一致 → 紛争（DISPUTED）
 * - 承認は「相手の報告に同意する」アクション。自分の報告には承認できない
 */

export interface ReportRecord {
  reporterId: string;
  reportedWinnerId: string;
}

export type ReportOutcome =
  | { kind: 'WAITING'; winnerId: string }
  | { kind: 'COMPLETED'; winnerId: string }
  | { kind: 'DISPUTED' };

/**
 * 既存報告と新規報告から、試合の最終的な状態を決める
 *
 * @param existing  これまでの報告一覧（同一reporterからの重複は事前に排除されている前提）
 * @param incoming  これから記録される新規報告
 */
export function decideReportOutcome(
  existing: ReportRecord[],
  incoming: ReportRecord,
): ReportOutcome {
  // 既存報告が無ければ単独の WAITING
  if (existing.length === 0) {
    return { kind: 'WAITING', winnerId: incoming.reportedWinnerId };
  }

  // 既存に自分のがあれば、これは更新呼び出し（呼び出し元で弾く想定）
  // この関数では「2人以上から報告がある場合」を前提とする
  const others = existing.filter((r) => r.reporterId !== incoming.reporterId);
  if (others.length === 0) {
    // 自分しか報告していない → 待機継続
    return { kind: 'WAITING', winnerId: incoming.reportedWinnerId };
  }

  const allWinners = new Set<string>([
    ...others.map((r) => r.reportedWinnerId),
    incoming.reportedWinnerId,
  ]);

  if (allWinners.size === 1) {
    return { kind: 'COMPLETED', winnerId: incoming.reportedWinnerId };
  }
  return { kind: 'DISPUTED' };
}

/**
 * 承認可否：approverIdは「他人の報告」が存在し、自分はまだ報告していないこと
 */
export function canApprove(
  reports: ReportRecord[],
  approverId: string,
): boolean {
  if (reports.length === 0) return false; // 何の報告もない
  const myReport = reports.find((r) => r.reporterId === approverId);
  if (myReport) return false; // 既に自分が報告済み
  return true;
}
