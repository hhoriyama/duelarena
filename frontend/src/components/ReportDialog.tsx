import { useState } from 'react';
import { reportUser, type ReportCategory } from '../api/reviews';

interface Props {
  matchId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORY_OPTIONS: Array<{ value: ReportCategory; label: string }> = [
  { value: 'CHEAT', label: 'チート / 不正行為' },
  { value: 'HARASSMENT', label: '暴言 / 嫌がらせ' },
  { value: 'NO_SHOW', label: '不参加 / 放置' },
  { value: 'OTHER', label: 'その他' },
];

export function ReportDialog({ matchId, open, onClose, onSuccess }: Props) {
  const [category, setCategory] = useState<ReportCategory>('OTHER');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit() {
    if (description.trim().length === 0) {
      setError('内容を記入してください');
      return;
    }
    setError(null);
    setSubmitting(true);
    const evidenceUrls = evidence
      .split(/[\n\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await reportUser(matchId, category, description, evidenceUrls);
      onSuccess?.();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-arena-surface border border-arena-border rounded-2xl p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">通報する</h3>

        <label className="block text-sm text-arena-subtext mb-1">カテゴリ</label>
        <select
          className="w-full bg-arena-bg border border-arena-border rounded p-2 mb-4"
          value={category}
          onChange={(e) => setCategory(e.target.value as ReportCategory)}
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label className="block text-sm text-arena-subtext mb-1">詳細</label>
        <textarea
          className="w-full bg-arena-bg border border-arena-border rounded p-2 mb-4"
          rows={4}
          maxLength={2000}
          value={description}
          placeholder="状況を詳しく教えてください"
          onChange={(e) => setDescription(e.target.value)}
        />

        <label className="block text-sm text-arena-subtext mb-1">
          エビデンスURL（任意・改行区切りで複数可）
        </label>
        <textarea
          className="w-full bg-arena-bg border border-arena-border rounded p-2 mb-4 text-sm"
          rows={3}
          placeholder="https://... のスクショURLなど"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
        />

        {error && <p className="text-arena-accent text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 bg-arena-border hover:bg-arena-border/80 text-arena-text font-semibold py-2 rounded"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-rose-700 hover:bg-rose-800 disabled:bg-arena-border text-white font-bold py-2 rounded"
          >
            {submitting ? '送信中...' : '通報する'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReportDialog;
