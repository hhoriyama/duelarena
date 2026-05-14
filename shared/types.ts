// フロント・バック共通の型定義

export interface UserPublic {
  id: string;
  discordId: string;
  username: string;
  avatarUrl: string;
  currentRating: number;
  highestRating: number;
  wins: number;
  losses: number;
  draws: number;
  averageStarRating: number | null;
  matchCount: number;
}

export interface MeResponse {
  user: UserPublic;
}

export type MatchStatus =
  | 'PENDING_TOSS'
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'DISPUTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DRAW'
  | 'INTERRUPTED';

export type RatingChangeReason =
  | 'MATCH'
  | 'TOSS_RECEIVED'
  | 'TOSS_PENALTY'
  | 'SEASON_RESET'
  | 'ADMIN_ADJUST';
