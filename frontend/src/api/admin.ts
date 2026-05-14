import { apiFetch } from './client';
import type { UserPublic } from '../types/user';

export interface AdminDashboardStats {
  totalUsers: number;
  bannedUsers: number;
  activeUsers: number;
  matchesInProgress: number;
  matchesPendingToss: number;
  matchesWaitingApproval: number;
  matchesDisputed: number;
  queueSize: number;
  matchesToday: number;
}

export interface AdminUser extends UserPublic {
  isBanned: boolean;
}

export interface DisputeListItem {
  id: string;
  matchId: string;
  description: string;
  evidenceUrls: string[];
  raisedById: string;
  createdAt: string;
  player1: UserPublic;
  player2: UserPublic;
  reports: Array<{ reporterId: string; reportedWinnerId: string }>;
}

export async function fetchAdminDashboard(): Promise<AdminDashboardStats> {
  return apiFetch<AdminDashboardStats>('/api/admin/dashboard');
}

export async function searchAdminUsers(q: string): Promise<{ users: AdminUser[] }> {
  return apiFetch<{ users: AdminUser[] }>(
    `/api/admin/users/search?q=${encodeURIComponent(q)}`,
  );
}

export async function banAdminUser(userId: string, reason: string): Promise<void> {
  await apiFetch(`/api/admin/users/${userId}/ban`, {
    method: 'POST',
    body: { reason },
  });
}

export async function unbanAdminUser(userId: string): Promise<void> {
  await apiFetch(`/api/admin/users/${userId}/unban`, { method: 'POST' });
}

export async function adjustAdminRating(
  userId: string,
  rating: number,
  reason: string,
): Promise<void> {
  await apiFetch(`/api/admin/users/${userId}/adjust-rating`, {
    method: 'POST',
    body: { rating, reason },
  });
}

export async function fetchOpenDisputes(): Promise<{ disputes: DisputeListItem[] }> {
  return apiFetch<{ disputes: DisputeListItem[] }>('/api/admin/disputes');
}

export async function resolveDispute(
  disputeId: string,
  resolution: { winnerId: string } | { cancel: true },
): Promise<void> {
  await apiFetch(`/api/admin/disputes/${disputeId}/resolve`, {
    method: 'POST',
    body: resolution,
  });
}
