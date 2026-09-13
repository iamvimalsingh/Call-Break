/**
 * Player Statistics Calculation Service
 * Derives comprehensive player statistics purely from completed match history.
 * Does NOT maintain mutable duplicate counters that can drift.
 * Phase 9 Home, Match History & Player Statistics
 */

import { PlayerPosition } from '../../models/player';
import { MatchHistoryRecord } from '../history/historyTypes';
import { PlayerOverallStatistics } from './statisticsTypes';

export class StatisticsService {
  /**
   * Calculates overall player statistics for a target position (default SOUTH).
   */
  public static calculate(
    matches: readonly MatchHistoryRecord[],
    userPosition: PlayerPosition = PlayerPosition.SOUTH
  ): PlayerOverallStatistics {
    if (!matches || matches.length === 0) {
      return {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        winRate: 0,
        totalScore: 0,
        averageFinalScore: 0,
        highestFinalScore: 0,
        lowestFinalScore: 0,
        totalTricksWon: 0,
        averageTricksPerMatch: 0,
        highestTricksInMatch: 0,
        totalBids: 0,
        averageBid: 0,
        totalTricksAgainstBids: 0,
        successfulContracts: 0,
        failedContracts: 0,
        contractSuccessRate: 0,
        rankDistribution: { 1: 0, 2: 0, 3: 0, 4: 0 },
        bestWinStreak: 0,
        currentStreak: { type: 'NONE', count: 0 },
      };
    }

    let wins = 0;
    let losses = 0;
    let ties = 0;
    let totalScore = 0;
    let highestFinalScore = -Infinity;
    let lowestFinalScore = Infinity;

    let totalTricksWon = 0;
    let highestTricksInMatch = 0;

    let totalBidsCount = 0;
    let sumOfBids = 0;
    let successfulContracts = 0;
    let failedContracts = 0;

    const rankDistribution = { 1: 0, 2: 0, 3: 0, 4: 0 };

    for (const match of matches) {
      const userScore = match.finalScores[userPosition] ?? 0;
      totalScore += userScore;

      if (userScore > highestFinalScore) highestFinalScore = userScore;
      if (userScore < lowestFinalScore) lowestFinalScore = userScore;

      // Win / Loss / Tie analysis
      if (match.isTie && match.winnerPositions.includes(userPosition)) {
        ties++;
      } else if (match.winnerPosition === userPosition) {
        wins++;
      } else {
        losses++;
      }

      // Finish rank distribution
      const userRankEntry = match.rankings.find((r) => r.position === userPosition);
      if (userRankEntry && userRankEntry.rank in rankDistribution) {
        rankDistribution[userRankEntry.rank as 1 | 2 | 3 | 4]++;
      } else if (match.winnerPosition === userPosition) {
        rankDistribution[1]++;
      } else {
        rankDistribution[4]++;
      }

      // Trick & Round analysis
      let matchTricksWon = 0;
      for (const round of match.rounds) {
        const pRound = round.scores[userPosition];
        if (pRound) {
          matchTricksWon += pRound.tricksWon;
          totalTricksWon += pRound.tricksWon;

          totalBidsCount++;
          sumOfBids += pRound.bid;

          if (pRound.tricksWon >= pRound.bid) {
            successfulContracts++;
          } else {
            failedContracts++;
          }
        }
      }

      if (matchTricksWon > highestTricksInMatch) {
        highestTricksInMatch = matchTricksWon;
      }
    }

    // Streaks calculation based on chronological order (oldest to newest)
    const chronologicalMatches = [...matches].sort((a, b) => a.completedAt - b.completedAt);
    let bestWinStreak = 0;
    let runningWinStreak = 0;
    let currentStreakType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
    let currentStreakCount = 0;

    for (const match of chronologicalMatches) {
      const isWin = match.winnerPosition === userPosition;
      if (isWin) {
        runningWinStreak++;
        if (runningWinStreak > bestWinStreak) {
          bestWinStreak = runningWinStreak;
        }
        if (currentStreakType === 'WIN') {
          currentStreakCount++;
        } else {
          currentStreakType = 'WIN';
          currentStreakCount = 1;
        }
      } else {
        runningWinStreak = 0;
        if (currentStreakType === 'LOSS') {
          currentStreakCount++;
        } else {
          currentStreakType = 'LOSS';
          currentStreakCount = 1;
        }
      }
    }

    const totalMatches = matches.length;
    const winRate = totalMatches > 0 ? Number(((wins / totalMatches) * 100).toFixed(1)) : 0;
    const averageFinalScore = totalMatches > 0 ? Number((totalScore / totalMatches).toFixed(1)) : 0;
    const averageTricksPerMatch = totalMatches > 0 ? Number((totalTricksWon / totalMatches).toFixed(1)) : 0;
    const averageBid = totalBidsCount > 0 ? Number((sumOfBids / totalBidsCount).toFixed(1)) : 0;
    const contractSuccessRate = totalBidsCount > 0 ? Number(((successfulContracts / totalBidsCount) * 100).toFixed(1)) : 0;

    return {
      totalMatches,
      wins,
      losses,
      ties,
      winRate,
      totalScore: Number(totalScore.toFixed(1)),
      averageFinalScore,
      highestFinalScore: highestFinalScore === -Infinity ? 0 : Number(highestFinalScore.toFixed(1)),
      lowestFinalScore: lowestFinalScore === Infinity ? 0 : Number(lowestFinalScore.toFixed(1)),
      totalTricksWon,
      averageTricksPerMatch,
      highestTricksInMatch,
      totalBids: totalBidsCount,
      averageBid,
      totalTricksAgainstBids: totalTricksWon,
      successfulContracts,
      failedContracts,
      contractSuccessRate,
      rankDistribution,
      bestWinStreak,
      currentStreak: {
        type: currentStreakType,
        count: currentStreakCount,
      },
    };
  }
}
