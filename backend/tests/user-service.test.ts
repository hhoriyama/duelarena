import { describe, it, expect } from 'vitest';
import { toUserPublic } from '../src/services/user-service';

describe('toUserPublic', () => {
  it('ユーザーオブジェクトから公開情報のみを抽出する', () => {
    const user = {
      id: 'user-1',
      discordId: '12345',
      username: 'Taro',
      avatarUrl: 'https://example.com/a.png',
      currentRating: 1500,
      highestRating: 1600,
      wins: 3,
      losses: 1,
      draws: 0,
      matchCount: 4,
      consecutiveTossCount: 0,
      averageStarRating: 4.5,
      isBanned: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const pub = toUserPublic(user);
    expect(pub).toEqual({
      id: 'user-1',
      discordId: '12345',
      username: 'Taro',
      avatarUrl: 'https://example.com/a.png',
      currentRating: 1500,
      highestRating: 1600,
      wins: 3,
      losses: 1,
      draws: 0,
      averageStarRating: 4.5,
      matchCount: 4,
    });
    // 非公開フィールドは含まない
    expect(pub).not.toHaveProperty('isBanned');
    expect(pub).not.toHaveProperty('consecutiveTossCount');
  });
});
