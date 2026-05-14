// shared/types.ts と同期する想定の型定義
// （プロジェクト構成上、共有packageとして抽出予定）

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
  isAdmin: boolean;
}
