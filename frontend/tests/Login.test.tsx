import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../src/pages/Login';

describe('LoginPage', () => {
  it('タイトルが表示される', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'デュエルアリーナ' })).toBeInTheDocument();
  });

  it('Discordログインボタンが /api/auth/discord へリンクしている', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /Discordでログイン/ });
    expect(link).toHaveAttribute('href');
    const href = link.getAttribute('href') ?? '';
    expect(href).toMatch(/\/api\/auth\/discord$/);
  });
});
