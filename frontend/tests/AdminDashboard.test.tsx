import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AdminDashboardPage } from '../src/pages/admin/AdminDashboard';
import * as adminApi from '../src/api/admin';

vi.mock('../src/api/admin', () => ({
  fetchAdminDashboard: vi.fn(),
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

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(adminApi.fetchAdminDashboard).mockReset();
  });

  it('読み込み中は表示が出る', () => {
    vi.mocked(adminApi.fetchAdminDashboard).mockReturnValue(new Promise(() => {}));
    render(<AdminDashboardPage />, { wrapper });
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('統計値が描画される', async () => {
    vi.mocked(adminApi.fetchAdminDashboard).mockResolvedValue({
      totalUsers: 100,
      bannedUsers: 2,
      activeUsers: 80,
      matchesInProgress: 3,
      matchesPendingToss: 1,
      matchesWaitingApproval: 2,
      matchesDisputed: 1,
      queueSize: 5,
      matchesToday: 25,
    });
    render(<AdminDashboardPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('100')).toBeInTheDocument();
    });
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('紛争数・BAN数があるとアクセント色のスタイル', async () => {
    vi.mocked(adminApi.fetchAdminDashboard).mockResolvedValue({
      totalUsers: 10,
      bannedUsers: 1,
      activeUsers: 8,
      matchesInProgress: 0,
      matchesPendingToss: 0,
      matchesWaitingApproval: 0,
      matchesDisputed: 2,
      queueSize: 0,
      matchesToday: 0,
    });
    const { container } = render(<AdminDashboardPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText('紛争中')).toBeInTheDocument();
    });
    // アクセントクラスが当たっている要素が存在する
    expect(container.querySelectorAll('.border-arena-accent').length).toBeGreaterThan(0);
  });
});
