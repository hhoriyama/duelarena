import type { HistoryResult, MatchStatus } from '../api/matches';

export function statusLabel(status: MatchStatus): string {
  switch (status) {
    case 'PENDING_TOSS':
      return '承認待ち';
    case 'IN_PROGRESS':
      return '対戦中';
    case 'WAITING_APPROVAL':
      return '承認待ち';
    case 'DISPUTED':
      return '紛争中';
    case 'COMPLETED':
      return '完了';
    case 'CANCELLED':
      return 'キャンセル';
    case 'DRAW':
      return '引き分け';
    case 'INTERRUPTED':
      return '中断';
  }
}

export function resultLabel(result: HistoryResult): string {
  switch (result) {
    case 'WIN':
      return '勝利';
    case 'LOSS':
      return '敗北';
    case 'DRAW':
      return '引き分け';
    case 'TOSSED_BY_ME':
      return '自分がトス';
    case 'TOSSED_BY_OPPONENT':
      return '相手がトス';
    case 'OTHER':
      return 'その他';
  }
}

export function resultColorClass(result: HistoryResult): string {
  switch (result) {
    case 'WIN':
      return 'text-emerald-400';
    case 'LOSS':
      return 'text-rose-400';
    case 'TOSSED_BY_ME':
      return 'text-rose-400';
    case 'TOSSED_BY_OPPONENT':
      return 'text-emerald-400';
    case 'DRAW':
    case 'OTHER':
      return 'text-arena-subtext';
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}
