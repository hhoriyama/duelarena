import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { LeaderboardPage } from '../src/pages/Leaderboard';
import * as seasonsApi from '../src/api/seasons';
import * as useAuthMod from '../src/hooks/useAuth';

vi.mock('../src/api/seasons', () => ({
  fetchCurrentSeason: vi.fn(),
  fetchLeaderboard: vi.fn(),
  fetchMonthlyStats: vi.fn(),
}));

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

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

describe('LeaderboardPage', () => {
  beforeEach(() => {
    vi.mocked(useAuthMod.useAuth).mockReturnValue({
      user: null,
      isAdmin: false,
      isLoading: false,
      error: null,
    });
  });

  it('シーズン情報が表示される', async () => {
    vi.mocked(seasonsApi.fetchCurrentSeason).mockResolvedValue({
      id: 's1',
      name: 'シーズン1',
      startAt: '2026-01-01T00:00:00Z',
      endAt: '2026-04-01T00:00:00Z',
      isActive: true,
    });
    vi.mocked(seasonsApi.fetchLeaderboard).mockResolvedValue({ entries: [] });
    vi.mocked(seasonsApi.fetchMonthlyStats).mockResolvedValue({
      yearMonth: '2026-05',
      topWinners: [],
    });

    render(<LeaderboardPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'シーズン1' })).toBeInTheDocument();
    });
  });

  it('対戦経験者がいない場合の表示', async () => {
    vi.mocked(seasonsApi.fetchCurrentSeason).mockResolvedValue({
      id: 's1',
      name: 'シーズン1',
      startAt: '2026-01-01T00:00:00Z',
      endAt: '2026-04-01T00:00:00Z',
      isActive: true,
    });
    vi.mocked(seasonsApi.fetchLeaderboard).mockResolvedValue({ entries: [] });
    vi.mocked(seasonsApi.fetchMonthlyStats).mockResolvedValue({
      yearMonth: '2026-05',
      topWinners: [],
    });
    render(<LeaderboardPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('対戦経験者がまだいません')).toBeInTheDocument();
    });
  });

  it('リーダーボードのユーザーが並んで表示される', async () => {
    vi.mocked(seasonsApi.fetchCurrentSeason).mockResolvedValue({
      id: 's1',
      name: 'シーズン1',
      startAt: '2026-01-01T00:00:00Z',
      endAt: '2026-04-01T00:00:00Z',
      isActive: true,
    });
    vi.mocked(seasonsApi.fetchLeaderboard).mockResolvedValue({
      entries: [
        {
          rank: 1,
          user: {
            id: 'u1',
            discordId: '111',
            username: 'Top',
            avatarUrl: 'a.png',
            currentRating: 2000,
            highestRating: 2100,
            wins: 10,
            losses: 2,
            draws: 0,
            averageStarRating: null,
            matchCount: 12,
          },
        },
        {
          rank: 2,
          user: {
            id: 'u2',
            discordId: '222',
            username: 'Second',
            avatarUrl: 'b.png',
            currentRating: 1800,
            highestRating: 1900,
            wins: 8,
            losses: 4,
            draws: 0,
            averageStarRating: null,
            matchCount: 12,
          },
        },
      ],
    });
    vi.mocked(seasonsApi.fetchMonthlyStats).mockResolvedValue({
      yearMonth: '2026-05',
      topWinners: [],
    });

    render(<LeaderboardPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('Top')).toBeInTheDocument();
    });
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('2000')).toBeInTheDocument();
    expect(screen.getByText('1800')).toBeInTheDocument();
  });

  it('自分の行に「あなた」表示が出る', async () => {
    vi.mocked(useAuthMod.useAuth).mockReturnValue({
      user: {
        id: 'me',
        discordId: '999',
        username: 'Me',
        avatarUrl: 'a.png',
        currentRating: 1500,
        highestRating: 1500,
        wins: 0,
        losses: 0,
        draws: 0,
        averageStarRating: null,
        matchCount: 0,
      },
      isAdmin: false,
      isLoading: false,
      error: null,
    });
    vi.mocked(seasonsApi.fetchCurrentSeason).mockResolvedValue({
      id: 's1',
      name: 'シーズン1',
      startAt: '2026-01-01T00:00:00Z',
      endAt: '2026-04-01T00:00:00Z',
      isActive: true,
    });
    vi.mocked(seasonsApi.fetchLeaderboard).mockResolvedValue({
      entries: [
        {
          rank: 1,
          user: {
            id: 'me',
            discordId: '999',
            username: 'Me',
            avatarUrl: 'a.png',
            currentRating: 1500,
            highestRating: 1500,
            wins: 1,
            losses: 0,
            draws: 0,
            averageStarRating: null,
            matchCount: 1,
          },
        },
      ],
    });
    vi.mocked(seasonsApi.fetchMonthlyStats).mockResolvedValue({
      yearMonth: '2026-05',
      topWinners: [],
    });

    render(<LeaderboardPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('あなた')).toBeInTheDocument();
    });
  });
});
