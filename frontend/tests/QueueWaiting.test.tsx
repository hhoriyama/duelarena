import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QueueWaitingPage } from '../src/pages/QueueWaiting';

// useSocket のモック
const listeners: Record<string, Array<(payload: unknown) => void>> = {};
const emitMock = vi.fn();
const offMock = vi.fn();
const onMock = vi.fn((event: string, cb: (payload: unknown) => void) => {
  listeners[event] = listeners[event] ?? [];
  listeners[event].push(cb);
});

function trigger(event: string, payload?: unknown) {
  for (const cb of listeners[event] ?? []) cb(payload);
}

vi.mock('../src/hooks/useSocket', () => ({
  useSocket: () => ({
    socket: {
      emit: emitMock,
      on: onMock,
      off: offMock,
    },
    connected: true,
    error: null,
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('QueueWaitingPage', () => {
  beforeEach(() => {
    Object.keys(listeners).forEach((k) => delete listeners[k]);
    emitMock.mockClear();
    offMock.mockClear();
    onMock.mockClear();
    mockNavigate.mockClear();
  });

  it('マウント時に queue:enter を emit する', () => {
    render(<QueueWaitingPage />, { wrapper });
    expect(emitMock).toHaveBeenCalledWith('queue:enter');
  });

  it('queue:entered を受信すると待機画面に切り替わる', async () => {
    render(<QueueWaitingPage />, { wrapper });
    act(() => {
      trigger('queue:entered', { enteredAt: new Date().toISOString() });
    });
    await waitFor(() => {
      expect(screen.getByText('対戦相手を探しています')).toBeInTheDocument();
    });
    // 許容レート差表示
    expect(screen.getByText(/±100/)).toBeInTheDocument();
  });

  it('match:found を受信すると /match/:id へ navigate する', () => {
    render(<QueueWaitingPage />, { wrapper });
    act(() => {
      trigger('match:found', {
        matchId: 'm-abc',
        opponent: {
          id: 'opp',
          discordId: '1',
          username: 'Opp',
          avatarUrl: '',
          currentRating: 1500,
          highestRating: 1500,
          wins: 0,
          losses: 0,
          draws: 0,
          averageStarRating: null,
          matchCount: 0,
        },
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      '/match/m-abc',
      expect.objectContaining({ state: expect.any(Object) }),
    );
  });

  it('queue:timeout でタイムアウト画面に切り替わる', async () => {
    render(<QueueWaitingPage />, { wrapper });
    act(() => {
      trigger('queue:entered', { enteredAt: new Date().toISOString() });
    });
    act(() => {
      trigger('queue:timeout');
    });
    await waitFor(() => {
      expect(screen.getByText('マッチング失敗')).toBeInTheDocument();
    });
  });

  it('queue:error でエラー表示', async () => {
    render(<QueueWaitingPage />, { wrapper });
    act(() => {
      trigger('queue:error', { message: 'テストエラー' });
    });
    await waitFor(() => {
      expect(screen.getByText(/テストエラー/)).toBeInTheDocument();
    });
  });

  it('キャンセルボタンで queue:leave emit + navigate', async () => {
    render(<QueueWaitingPage />, { wrapper });
    act(() => {
      trigger('queue:entered', { enteredAt: new Date().toISOString() });
    });
    await waitFor(() => screen.getByText('キャンセル'));
    fireEvent.click(screen.getByText('キャンセル'));
    expect(emitMock).toHaveBeenCalledWith('queue:leave');
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
