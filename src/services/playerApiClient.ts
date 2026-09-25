/**
 * Player API Client
 * Secure client-side service for fetching player profile, match history, scorecards,
 * global leaderboards, top wins, and player achievements via HTTP requests.
 */

import { getOrCreatePersistentPlayerId, getStoredPlayerToken, setStoredPlayerToken } from './multiplayer/MultiplayerClient';

export interface PlayerProfileDashboard {
  profile: {
    player_id?: string;
    anonymous_client_id: string;
    display_name: string;
    created_at: string;
  } | null;
  stats: {
    totalMatches: number;
    wins: number;
    losses: number;
    winRate: number;
    totalScore: number;
    avgScore: number;
    bestScore: number;
    totalTricks: number;
    avgTricks: number;
  };
  matches: Array<{
    match: {
      match_id: string;
      room_code: string;
      total_rounds: number;
      status: string;
      started_at: string;
      finished_at: string;
    };
    playerRecord: {
      seat: string;
      final_score: number;
      tricks_won: number;
      final_rank: number;
    };
    participants: Array<{
      seat: string;
      is_bot: boolean;
      final_score: number;
      tricks_won: number;
      final_rank: number;
    }>;
  }>;
  enabled: boolean;
}

export type LeaderboardCategory = 'overall' | 'wins' | 'win_rate' | 'score' | 'tricks';
export type LeaderboardTimeframe = 'all' | 'monthly' | 'weekly';

export interface LeaderboardItem {
  rank: number;
  displayName: string;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
  totalScore: number;
  avgScore: number;
  bestScore: number;
  totalTricks: number;
  avgTricks: number;
  overallScore: number;
  isCurrentPlayer?: boolean;
}

export interface LeaderboardResponse {
  category: LeaderboardCategory;
  timeframe: LeaderboardTimeframe;
  items: LeaderboardItem[];
  totalCount: number;
  limit: number;
  offset: number;
  self?: {
    rank: number | null;
    entry: LeaderboardItem | null;
  } | null;
}

export interface TopWinItem {
  matchId: string;
  roomCode: string;
  gameType: string;
  totalRounds: number;
  finishedAt: string;
  winnerSeat: string;
  winnerName: string;
  finalScore: number;
  winningMargin: number;
  tricksWon: number;
  participants: Array<{
    seat: string;
    displayName: string;
    isBot: boolean;
    finalScore: number;
    finalRank: number;
  }>;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  category: 'wins' | 'score' | 'mastery' | 'experience';
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  unlockedAt?: string | null;
}

function getRequestHeaders(): Record<string, string> {
  const playerId = getOrCreatePersistentPlayerId();
  const token = getStoredPlayerToken();
  const headers: Record<string, string> = {
    'X-Player-ID': playerId,
  };
  if (token) {
    headers['X-Player-Token'] = token;
  }
  return headers;
}

function handleIssuedToken(res: Response): void {
  const issued = res.headers.get('X-Issued-Token');
  if (issued) {
    setStoredPlayerToken(issued);
  }
}

export const playerApiClient = {
  async getProfile(limit = 20, offset = 0): Promise<PlayerProfileDashboard | null> {
    try {
      const res = await fetch(`/api/player/profile?limit=${limit}&offset=${offset}`, {
        headers: getRequestHeaders(),
      });
      handleIssuedToken(res);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('[PlayerApiClient] Failed to fetch profile:', err);
      return null;
    }
  },

  async getScorecard(matchId: string): Promise<any | null> {
    try {
      const res = await fetch(`/api/player/scorecard/${matchId}`, {
        headers: getRequestHeaders(),
      });
      handleIssuedToken(res);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('[PlayerApiClient] Failed to fetch scorecard:', err);
      return null;
    }
  },

  async getLeaderboard(
    category: LeaderboardCategory = 'overall',
    timeframe: LeaderboardTimeframe = 'all',
    limit = 20,
    offset = 0
  ): Promise<LeaderboardResponse | null> {
    try {
      const res = await fetch(
        `/api/player/leaderboard?category=${category}&timeframe=${timeframe}&limit=${limit}&offset=${offset}`,
        {
          headers: getRequestHeaders(),
        }
      );
      handleIssuedToken(res);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('[PlayerApiClient] Failed to fetch leaderboard:', err);
      return null;
    }
  },

  async getTopWins(timeframe: LeaderboardTimeframe = 'all', limit = 20, offset = 0): Promise<TopWinItem[] | null> {
    try {
      const res = await fetch(`/api/player/top-wins?timeframe=${timeframe}&limit=${limit}&offset=${offset}`, {
        headers: getRequestHeaders(),
      });
      handleIssuedToken(res);
      if (!res.ok) return null;
      const json = await res.json();
      return json?.topWins || [];
    } catch (err) {
      console.warn('[PlayerApiClient] Failed to fetch top wins:', err);
      return null;
    }
  },

  async getAchievements(): Promise<AchievementItem[] | null> {
    try {
      const res = await fetch(`/api/player/achievements`, {
        headers: getRequestHeaders(),
      });
      handleIssuedToken(res);
      if (!res.ok) return null;
      const json = await res.json();
      return json?.achievements || [];
    } catch (err) {
      console.warn('[PlayerApiClient] Failed to fetch achievements:', err);
      return null;
    }
  },
};
