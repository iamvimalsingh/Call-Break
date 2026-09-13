/**
 * Player Statistics Types & Calculation Models
 * Pure derived statistics layer computed directly from completed match history.
 * Phase 9 Home, Match History & Player Statistics
 */

export interface PlayerOverallStatistics {
  // Matches
  readonly totalMatches: number;
  readonly wins: number;
  readonly losses: number;
  readonly ties: number;
  readonly winRate: number; // Percentage 0 to 100

  // Scoring
  readonly totalScore: number;
  readonly averageFinalScore: number;
  readonly highestFinalScore: number;
  readonly lowestFinalScore: number;

  // Tricks
  readonly totalTricksWon: number;
  readonly averageTricksPerMatch: number;
  readonly highestTricksInMatch: number;

  // Bidding & Contracts
  readonly totalBids: number;
  readonly averageBid: number;
  readonly totalTricksAgainstBids: number;
  readonly successfulContracts: number; // tricksWon >= bid
  readonly failedContracts: number;     // tricksWon < bid
  readonly contractSuccessRate: number; // Percentage 0 to 100

  // Finish Distribution & Streaks
  readonly rankDistribution: {
    readonly 1: number;
    readonly 2: number;
    readonly 3: number;
    readonly 4: number;
  };
  readonly bestWinStreak: number;
  readonly currentStreak: {
    readonly type: 'WIN' | 'LOSS' | 'NONE';
    readonly count: number;
  };
}
