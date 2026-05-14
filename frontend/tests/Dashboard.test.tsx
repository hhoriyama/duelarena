import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DashboardPage } from '../src/pages/Dashboard';
import type { UserPublic } from '../src/types/user';

// useAuth フックをモック化（実APIを叩かないように）
vi.mock('../src/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '../src/hooks/useAuth';

// fetchActiveMatch をモック化（API呼ばないように）
vi.mock('../src/api/matches', () => ({
  fetchActiveMatch: vi.fn().mockResolvedValue({ matchId: null, status: null }),
}));

const baseUser: UserPublic = {
  id: 'user-1',
  discordId: '12345',
  username: 'Taro',
  avatarUrl: 'https://example.com/a.png',
  currentRating: 1500,
  highestRating: 1600,
  wins: 3,
  losses: 1,
  draws: 0,
  averageStarRating: null,
  matchCount: 4,
};

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient();
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset();
  });

  it('userが無いとき何も描画されない', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isAdmin: false,
      isLoading: false,
      error: null,
    });
    const { container } = render(<DashboardPage />, { wrapper });
    expect(container.textContent).toBe('');
  });

  it('ユーザー名・レート・勝敗・勝率を表示する', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: baseUser,
      isAdmin: false,
      isLoading: false,
      error: null,
    });
    render(<DashboardPage />, { wrapper });
    expect(screen.getByRole('heading', { name: 'Taro' })).toBeInTheDocument();
    expect(screen.getByText('1500')).toBeInTheDocument();
    expect(screen.getByText('1600')).toBeInTheDocument();
    expect(screen.getByText('3 / 1')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });

  it('isAdmin=true で「管理者」バッジが表示される', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: baseUser,
      isAdmin: true,
      isLoading: false,
      error: null,
    });
    render(<DashboardPage />, { wrapper });
    expect(screen.getByText('管理者')).toBeInTheDocument();
  });

  it('isAdmin=false では「管理者」バッジが表示されない', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: baseUser,
      isAdmin: false,
      isLoading: false,
      error: null,
    });
    render(<DashboardPage />, { wrapper });
    expect(screen.queryByText('管理者')).not.toBeInTheDocument();
  });

  it('対戦未経験のユーザーは勝率が "-" 表示', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { ...baseUser, wins: 0, losses: 0 },
      isAdmin: false,
      isLoading: false,
      error: null,
    });
    render(<DashboardPage />, { wrapper });
    expect(screen.getByText('-%')).toBeInTheDocument();
  });
});
