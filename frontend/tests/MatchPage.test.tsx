import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatchPage } from '../src/pages/MatchPage';
import * as matchesApi from '../src/api/matches';
import type { UserPublic } from '../src/types/user';

// Socket と Auth をモック
const emitMock = vi.fn();
const onMock = vi.fn();
const offMock = vi.fn();

vi.mock('../src/hooks/useSocket', () => ({
  useSocket: () => ({
    socket: { emit: emitMock, on: onMock, off: offMock },
    connected: true,
    error: null,
  }),
}));

let currentUser: UserPublic | null = null;
vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: currentUser,
    isAdmin: false,
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../src/api/matches', async () => {
  const actual = await vi.importActual<typeof matchesApi>('../src/api/matches');
  return {
    ...actual,
    fetchMatch: vi.fn(),
  };
});

vi.mock('../src/api/reviews', () => ({
  rateOpponent: vi.fn().mockResolvedValue(undefined),
  reportUser: vi.fn().mockResolvedValue(undefined),
}));

const me: UserPublic = {
  id: 'me',
  discordId: '111',
  username: '自分',
  avatarUrl: 'https://example.com/me.png',
  currentRating: 1500,
  highestRating: 1500,
  wins: 0,
  losses: 0,
  draws: 0,
  averageStarRating: null,
  matchCount: 0,
};

const opp: UserPublic = {
  id: 'opp',
  discordId: '222',
  username: '相手',
  avatarUrl: 'https://example.com/opp.png',
  currentRating: 1500,
  highestRating: 1500,
  wins: 0,
  losses: 0,
  draws: 0,
  averageStarRating: null,
  matchCount: 0,
};

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/match/m1']}>
        <Routes>
          <Route path="/match/:matchId" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('MatchPage', () => {
  beforeEach(() => {
    currentUser = me;
    emitMock.mockClear();
    vi.mocked(matchesApi.fetchMatch).mockReset();
  });

  describe('PENDING_TOSS', () => {
    it('承認・トスボタンが表示される', async () => {
      vi.mocked(matchesApi.fetchMatch).mockResolvedValue({
        match: {
          id: 'm1',
          status: 'PENDING_TOSS',
          winnerId: null,
          tossById: null,
          player1Accepted: false,
          player2Accepted: false,
          acceptedAt: null,
          reportedAt: null,
          startedAt: new Date().toISOString(),
          endedAt: null,
          player1: me,
          player2: opp,
        },
        myRatingDelta: null,
        reports: [],
      });
      render(<MatchPage />, { wrapper });
      await waitFor(() => screen.getByText('⚔️ マッチ成立'));
      expect(screen.getByText('承認して対戦')).toBeInTheDocument();
      expect(screen.getByText('トス（拒否）')).toBeInTheDocument();
    });

    it('承認ボタンで match:accept を emit', async () => {
      vi.mocked(matchesApi.fetchMatch).mockResolvedValue({
        match: {
          id: 'm1',
          status: 'PENDING_TOSS',
          winnerId: null,
          tossById: null,
          player1Accepted: false,
          player2Accepted: false,
          acceptedAt: null,
          reportedAt: null,
          startedAt: new Date().toISOString(),
          endedAt: null,
          player1: me,
          player2: opp,
        },
        myRatingDelta: null,
        reports: [],
      });
      render(<MatchPage />, { wrapper });
      await waitFor(() => screen.getByText('承認して対戦'));
      fireEvent.click(screen.getByText('承認して対戦'));
      expect(emitMock).toHaveBeenCalledWith('match:accept', { matchId: 'm1' });
    });
  });

  describe('IN_PROGRESS', () => {
    it('未報告なら勝敗報告ボタンを表示', async () => {
      vi.mocked(matchesApi.fetchMatch).mockResolvedValue({
        match: {
          id: 'm1',
          status: 'IN_PROGRESS',
          winnerId: null,
          tossById: null,
          player1Accepted: true,
          player2Accepted: true,
          acceptedAt: new Date().toISOString(),
          reportedAt: null,
          startedAt: new Date().toISOString(),
          endedAt: null,
          player1: me,
          player2: opp,
        },
        myRatingDelta: null,
        reports: [],
      });
      render(<MatchPage />, { wrapper });
      await waitFor(() => screen.getByText('⚔️ 対戦中'));
      expect(screen.getByText('自分が勝った')).toBeInTheDocument();
      expect(screen.getByText('相手が勝った')).toBeInTheDocument();
    });

    it('既に報告していれば応答待ち表示', async () => {
      vi.mocked(matchesApi.fetchMatch).mockResolvedValue({
        match: {
          id: 'm1',
          status: 'IN_PROGRESS',
          winnerId: null,
          tossById: null,
          player1Accepted: true,
          player2Accepted: true,
          acceptedAt: new Date().toISOString(),
          reportedAt: null,
          startedAt: new Date().toISOString(),
          endedAt: null,
          player1: me,
          player2: opp,
        },
        myRatingDelta: null,
        reports: [
          {
            reporterId: 'me',
            reportedWinnerId: 'me',
            reportedAt: new Date().toISOString(),
          },
        ],
      });
      render(<MatchPage />, { wrapper });
      await waitFor(() => screen.getByText(/報告済み/));
    });
  });

  describe('WAITING_APPROVAL', () => {
    it('自分が報告した場合は応答待ち表示で承認ボタンなし', async () => {
      vi.mocked(matchesApi.fetchMatch).mockResolvedValue({
        match: {
          id: 'm1',
          status: 'WAITING_APPROVAL',
          winnerId: 'me',
          tossById: null,
          player1Accepted: true,
          player2Accepted: true,
          acceptedAt: new Date().toISOString(),
          reportedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          endedAt: null,
          player1: me,
          player2: opp,
        },
        myRatingDelta: null,
        reports: [
          {
            reporterId: 'me',
            reportedWinnerId: 'me',
            reportedAt: new Date().toISOString(),
          },
        ],
      });
      render(<MatchPage />, { wrapper });
      await waitFor(() => screen.getByText('📋 報告済み'));
      expect(screen.queryByText('承認する')).not.toBeInTheDocument();
    });

    it('相手が報告した場合は承認/反論/異議ボタンが表示', async () => {
      vi.mocked(matchesApi.fetchMatch).mockResolvedValue({
        match: {
          id: 'm1',
          status: 'WAITING_APPROVAL',
          winnerId: 'opp',
          tossById: null,
          player1Accepted: true,
          player2Accepted: true,
          acceptedAt: new Date().toISOString(),
          reportedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          endedAt: null,
          player1: me,
          player2: opp,
        },
        myRatingDelta: null,
        reports: [
          {
            reporterId: 'opp',
            reportedWinnerId: 'opp',
            reportedAt: new Date().toISOString(),
          },
        ],
      });
      render(<MatchPage />, { wrapper });
      await waitFor(() => screen.getByText('承認する'));
      expect(screen.getByText('自分が勝ったと報告')).toBeInTheDocument();
    });

    it('承認するボタンで match:approve を emit', async () => {
      vi.mocked(matchesApi.fetchMatch).mockResolvedValue({
        match: {
          id: 'm1',
          status: 'WAITING_APPROVAL',
          winnerId: 'opp',
          tossById: null,
          player1Accepted: true,
          player2Accepted: true,
          acceptedAt: new Date().toISOString(),
          reportedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          endedAt: null,
          player1: me,
          player2: opp,
        },
        myRatingDelta: null,
        reports: [
          {
            reporterId: 'opp',
            reportedWinnerId: 'opp',
            reportedAt: new Date().toISOString(),
          },
        ],
      });
      render(<MatchPage />, { wrapper });
      await waitFor(() => screen.getByText('承認する'));
      fireEvent.click(screen.getByText('承認する'));
      expect(emitMock).toHaveBeenCalledWith('match:approve', { matchId: 'm1' });
    });
  });

  describe('DISPUTED', () => {
    it('紛争中表示', async () => {
      vi.mocked(matchesApi.fetchMatch).mockResolvedValue({
        match: {
          id: 'm1',
          status: 'DISPUTED',
          winnerId: null,
          tossById: null,
          player1Accepted: true,
          player2Accepted: true,
          acceptedAt: new Date().toISOString(),
          reportedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          endedAt: null,
          player1: me,
          player2: opp,
        },
        myRatingDelta: null,
        reports: [],
      });
      render(<MatchPage />, { wrapper });
      await waitFor(() => screen.getByText('⚠️ 紛争中'));
    });
  });

  describe('COMPLETED', () => {
    it('結果画面（勝利）+ レート変動表示', async () => {
      vi.mocked(matchesApi.fetchMatch).mockResolvedValue({
        match: {
          id: 'm1',
          status: 'COMPLETED',
          winnerId: 'me',
          tossById: null,
          player1Accepted: true,
          player2Accepted: true,
          acceptedAt: new Date().toISOString(),
          reportedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          player1: me,
          player2: opp,
        },
        myRatingDelta: 16,
        reports: [],
      });
      render(<MatchPage />, { wrapper });
      await waitFor(() => screen.getByText('🏆 勝利！'));
      expect(screen.getByText('+16')).toBeInTheDocument();
      // 星評価UI
      expect(screen.getByLabelText('星評価')).toBeInTheDocument();
    });
  });
});
