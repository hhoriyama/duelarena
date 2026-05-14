import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthSuccessPage } from '../src/pages/AuthSuccess';

describe('AuthSuccessPage', () => {
  it('マウント時に / へリダイレクトする', async () => {
    const qc = new QueryClient();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/auth/success']}>
          <Routes>
            <Route path="/auth/success" element={<AuthSuccessPage />} />
            <Route path="/" element={<div>home</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(container.textContent).toContain('home');
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me'] });
  });
});
