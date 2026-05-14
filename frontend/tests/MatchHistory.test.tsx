import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MatchHistoryPage } from '../src/pages/MatchHistory';
import * as matchesApi from '../src/api/matches';

vi.mock('../src/api/matches', async () => {
  const actual = await vi.importActual<typeof matchesApi>('../src/api/matches');
  return {
    ...actual,
    fetchMatchHistory: vi.fn(),
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MatchHistoryPage', () => {
  beforeEach(() => {
    vi.mocked(matchesApi.fetchMatchHistory).mockReset();
  });

  it('履歴が空のとき「試合履歴がありません」と表示', async () => {
    vi.mocked(matchesApi.fetchMatchHistory).mockResolvedValue({ matches: [] });
    render(<MatchHistoryPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('まだ試合履歴がありません')).toBeInTheDocument();
    });
  });

  it('履歴が並んで表示される', async () => {
    vi.mocked(matchesApi.fetchMatchHistory).mockResolvedValue({
      matches: [
        {
          id: 'm1',
          status: 'COMPLETED',
          result: 'WIN',
          myRatingDelta: 16,
          opponent: {
            id: 'opp',
            discordId: '111',
            username: '相手A',
            avatarUrl: 'https://example.com/a.png',
            currentRating: 1500,
            highestRating: 1500,
            wins: 1,
            losses: 1,
            draws: 0,
            averageStarRating: null,
            matchCount: 2,
          },
          startedAt: '2026-01-01T10:00:00Z',
          endedAt: '2026-01-01T10:30:00Z',
        },
        {
          id: 'm2',
          status: 'COMPLETED',
          result: 'LOSS',
          myRatingDelta: -12,
          opponent: {
            id: 'opp2',
            discordId: '222',
            username: '相手B',
            avatarUrl: 'https://example.com/b.png',
            currentRating: 1600,
            highestRating: 1700,
            wins: 5,
            losses: 2,
            draws: 0,
            averageStarRating: 4.0,
            matchCount: 7,
          },
          startedAt: '2026-01-02T10:00:00Z',
          endedAt: '2026-01-02T10:30:00Z',
        },
      ],
    });
    render(<MatchHistoryPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('相手A')).toBeInTheDocument();
    });
    expect(screen.getByText('相手B')).toBeInTheDocument();
    expect(screen.getByText('+16')).toBeInTheDocument();
    expect(screen.getByText('-12')).toBeInTheDocument();
    expect(screen.getByText('勝利')).toBeInTheDocument();
    expect(screen.getByText('敗北')).toBeInTheDocument();
  });

  it('読み込み中表示', () => {
    vi.mocked(matchesApi.fetchMatchHistory).mockReturnValue(new Promise(() => {}));
    render(<MatchHistoryPage />, { wrapper });
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });
});
