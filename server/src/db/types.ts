/**
 * Database & Persistence Types
 * Strongly typed records and DTOs for Call Break PostgreSQL layer.
 */

import { PlayerPosition } from '../../../src/models/player';

export interface PlayerProfileRecord {
  player_id: string;
  anonymous_client_id: string;
  display_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface MatchRecord {
  match_id: string;
  game_type: string;
  room_code: string;
  total_rounds: number;
  status: 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED';
  started_at: Date;
  finished_at: Date | null;
  created_at: Date;
}

export interface MatchPlayerRecord {
  match_id: string;
  player_id: string | null;
  seat: PlayerPosition;
  is_host: boolean;
  is_bot: boolean;
  final_score: number | null;
  tricks_won: number;
  final_rank: number | null;
}

export interface MatchRoundRecord {
  match_id: string;
  round_number: number;
  dealer_seat: PlayerPosition;
  created_at: Date;
}

export interface MatchRoundPlayerRecord {
  match_id: string;
  round_number: number;
  player_id: string | null;
  seat: PlayerPosition;
  bid: number | null;
  tricks_won: number;
  round_score: number | null;
}

export interface CreateMatchDTO {
  matchId: string;
  roomCode: string;
  totalRounds: number;
  players: Array<{
    playerId?: string | null;
    anonymousClientId?: string;
    displayName: string;
    seat: PlayerPosition;
    isHost: boolean;
    isBot: boolean;
  }>;
}

export interface CompleteMatchPlayerDTO {
  seat: PlayerPosition;
  finalScore: number;
  tricksWon: number;
  finalRank: number;
}

export interface CompleteMatchDTO {
  matchId: string;
  finishedAt?: Date;
  playerResults: CompleteMatchPlayerDTO[];
}

export interface RecordRoundDTO {
  matchId: string;
  roundNumber: number;
  dealerSeat: PlayerPosition;
  players: Array<{
    seat: PlayerPosition;
    playerId?: string | null;
    bid: number | null;
    tricksWon: number;
    roundScore: number;
  }>;
}

export interface PersistenceStatus {
  enabled: boolean;
  connected: boolean;
  driver: 'postgres' | 'none';
  pendingQueueSize: number;
  lastError: string | null;
}

export type LeaderboardCategory = 'overall' | 'wins' | 'win_rate' | 'score' | 'tricks';
export type LeaderboardTimeframe = 'all' | 'monthly' | 'weekly';

export interface LeaderboardItemDTO {
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

export interface LeaderboardResponseDTO {
  category: LeaderboardCategory;
  timeframe: LeaderboardTimeframe;
  items: LeaderboardItemDTO[];
  totalCount: number;
  limit: number;
  offset: number;
  self?: {
    rank: number | null;
    entry: LeaderboardItemDTO | null;
  } | null;
}

export interface TopWinItemDTO {
  matchId: string;
  roomCode: string;
  gameType: string;
  totalRounds: number;
  finishedAt: Date;
  winnerSeat: PlayerPosition;
  winnerName: string;
  finalScore: number;
  winningMargin: number;
  tricksWon: number;
  participants: Array<{
    seat: PlayerPosition;
    displayName: string;
    isBot: boolean;
    finalScore: number;
    finalRank: number;
  }>;
}

export interface AchievementDTO {
  id: string;
  title: string;
  description: string;
  category: 'wins' | 'score' | 'mastery' | 'experience';
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  unlockedAt?: Date | null;
}
