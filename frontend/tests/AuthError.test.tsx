import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthErrorPage } from '../src/pages/AuthError';

describe('AuthErrorPage', () => {
  it('エラーメッセージとログイン画面へのリンクが表示', () => {
    render(
      <MemoryRouter>
        <AuthErrorPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'ログインに失敗しました' }),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /ログイン画面/ });
    expect(link).toHaveAttribute('href', '/login');
  });
});
