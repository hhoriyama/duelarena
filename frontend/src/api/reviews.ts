import { apiFetch } from './client';

export type ReportCategory = 'CHEAT' | 'HARASSMENT' | 'NO_SHOW' | 'OTHER';

export async function rateOpponent(matchId: string, stars: number): Promise<void> {
  await apiFetch(`/api/matches/${matchId}/star-rating`, {
    method: 'POST',
    body: { stars },
  });
}

export async function reportUser(
  matchId: string,
  category: ReportCategory,
  description: string,
  evidenceUrls: string[] = [],
): Promise<void> {
  await apiFetch(`/api/matches/${matchId}/report-user`, {
    method: 'POST',
    body: { category, description, evidenceUrls },
  });
}
