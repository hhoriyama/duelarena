import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PrivateRoute } from '../src/components/PrivateRoute';
import * as useAuthMod from '../src/hooks/useAuth';

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

const meUser = {
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
};

describe('PrivateRoute', () => {
  beforeEach(() => {
    vi.mocked(useAuthMod.useAuth).mockReset();
  });

  it('isLoading 中はローディング表示', () => {
    vi.mocked(useAuthMod.useAuth).mockReturnValue({
      user: null,
      isAdmin: false,
      isLoading: true,
      error: null,
    });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <PrivateRoute>
                <div>protected</div>
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('user がいないと /login へリダイレクト', () => {
    vi.mocked(useAuthMod.useAuth).mockReturnValue({
      user: null,
      isAdmin: false,
      isLoading: false,
      error: null,
    });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <PrivateRoute>
                <div>protected</div>
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('user がいれば children を描画', () => {
    vi.mocked(useAuthMod.useAuth).mockReturnValue({
      user: meUser,
      isAdmin: false,
      isLoading: false,
      error: null,
    });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <PrivateRoute>
                <div>protected content</div>
              </PrivateRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });
});
