import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReportDialog } from '../src/components/ReportDialog';
import * as reviewsApi from '../src/api/reviews';

vi.mock('../src/api/reviews', () => ({
  reportUser: vi.fn(),
}));

describe('ReportDialog', () => {
  beforeEach(() => {
    vi.mocked(reviewsApi.reportUser).mockReset();
  });

  it('open=false なら描画されない', () => {
    const { container } = render(
      <ReportDialog matchId="m1" open={false} onClose={() => {}} />,
    );
    expect(container.textContent).toBe('');
  });

  it('open=true でタイトルとボタンが表示される', () => {
    render(<ReportDialog matchId="m1" open={true} onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: '通報する' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '通報する' })).toBeInTheDocument();
  });

  it('説明文が空のまま送信するとエラーメッセージ', async () => {
    render(<ReportDialog matchId="m1" open={true} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '通報する' }));
    await waitFor(() => {
      expect(screen.getByText('内容を記入してください')).toBeInTheDocument();
    });
    expect(reviewsApi.reportUser).not.toHaveBeenCalled();
  });

  it('送信成功で onSuccess と onClose が呼ばれる', async () => {
    vi.mocked(reviewsApi.reportUser).mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(
      <ReportDialog
        matchId="m1"
        open={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/状況を/), {
      target: { value: 'チート行為あり' },
    });
    fireEvent.click(screen.getByRole('button', { name: '通報する' }));
    await waitFor(() => {
      expect(reviewsApi.reportUser).toHaveBeenCalledWith(
        'm1',
        'OTHER',
        'チート行為あり',
        [],
      );
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('エビデンスURLは改行区切りでパースされる', async () => {
    vi.mocked(reviewsApi.reportUser).mockResolvedValue(undefined);
    render(
      <ReportDialog matchId="m1" open={true} onClose={() => {}} onSuccess={() => {}} />,
    );
    fireEvent.change(screen.getByPlaceholderText(/状況を/), {
      target: { value: 'x' },
    });
    fireEvent.change(screen.getByPlaceholderText(/スクショ/), {
      target: { value: 'https://a.com\nhttps://b.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '通報する' }));
    await waitFor(() => {
      expect(reviewsApi.reportUser).toHaveBeenCalledWith('m1', 'OTHER', 'x', [
        'https://a.com',
        'https://b.com',
      ]);
    });
  });

  it('API失敗時にエラーメッセージが表示される', async () => {
    vi.mocked(reviewsApi.reportUser).mockRejectedValue(new Error('API失敗'));
    render(<ReportDialog matchId="m1" open={true} onClose={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/状況を/), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: '通報する' }));
    await waitFor(() => {
      expect(screen.getByText('API失敗')).toBeInTheDocument();
    });
  });

  it('キャンセルで onClose が呼ばれる', () => {
    const onClose = vi.fn();
    render(<ReportDialog matchId="m1" open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onClose).toHaveBeenCalled();
  });
});
