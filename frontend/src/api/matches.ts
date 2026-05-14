import { apiFetch } from './client';
import type { UserPublic } from '../types/user';

export type MatchStatus =
  | 'PENDING_TOSS'
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'DISPUTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DRAW'
  | 'INTERRUPTED';

export interface MatchDetail {
  id: string;
  status: MatchStatus;
  winnerId: string | null;
  tossById: string | null;
  player1Accepted: boolean;
  player2Accepted: boolean;
  acceptedAt: string | null;
  reportedAt: string | null;
  startedAt: string;
  endedAt: string | null;
  player1: UserPublic;
  player2: UserPublic;
}

export interface MatchReportEntry {
  reporterId: string;
  reportedWinnerId: string;
  reportedAt: string;
}

export interface MatchDetailResponse {
  match: MatchDetail;
  myRatingDelta: number | null;
  reports: MatchReportEntry[];
}

export type HistoryResult =
  | 'WIN'
  | 'LOSS'
  | 'DRAW'
  | 'TOSSED_BY_ME'
  | 'TOSSED_BY_OPPONENT'
  | 'OTHER';

export interface HistoryItem {
  id: string;
  status: MatchStatus;
  result: HistoryResult;
  myRatingDelta: number;
  opponent: UserPublic;
  startedAt: string;
  endedAt: string | null;
}

export async function fetchMatch(id: string): Promise<MatchDetailResponse> {
  return apiFetch<MatchDetailResponse>(`/api/matches/${id}`);
}

export async function fetchMatchHistory(limit = 20): Promise<{ matches: HistoryItem[] }> {
  return apiFetch<{ matches: HistoryItem[] }>(`/api/matches/me/history?limit=${limit}`);
}

export async function fetchActiveMatch(): Promise<{
  matchId: string | null;
  status: MatchStatus | null;
}> {
  return apiFetch<{ matchId: string | null; status: MatchStatus | null }>(
    '/api/matches/me/active',
  );
}
