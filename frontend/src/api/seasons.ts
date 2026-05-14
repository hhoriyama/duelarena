import { apiFetch } from './client';
import type { UserPublic } from '../types/user';

export interface SeasonInfo {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  isActive: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  user: UserPublic;
}

export interface MonthlyTopWinner {
  user: UserPublic;
  wins: number;
}

export interface SeasonTitleEntry {
  title: string;
  rank: number;
  seasonName: string;
  seasonEndedAt: string;
}

export async function fetchCurrentSeason(): Promise<SeasonInfo> {
  return apiFetch<SeasonInfo>('/api/seasons/current');
}

export async function fetchLeaderboard(limit = 50): Promise<{ entries: LeaderboardEntry[] }> {
  return apiFetch<{ entries: LeaderboardEntry[] }>(
    `/api/seasons/leaderboard?limit=${limit}`,
  );
}

export async function fetchMonthlyStats(
  year: number,
  month: number,
): Promise<{ yearMonth: string; topWinners: MonthlyTopWinner[] }> {
  return apiFetch(`/api/seasons/monthly?year=${year}&month=${month}`);
}

export async function fetchMyTitles(): Promise<{ titles: SeasonTitleEntry[] }> {
  return apiFetch<{ titles: SeasonTitleEntry[] }>('/api/seasons/me/titles');
}
