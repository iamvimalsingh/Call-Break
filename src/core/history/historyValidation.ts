/**
 * History Validation & Schema Sanitization
 * Safely parses, validates, and recovers from corrupted or invalid history payloads.
 * Phase 9 Home, Match History & Player Statistics
 */

import { PlayerPosition } from '../../models/player';
import { HISTORY_SCHEMA_VERSION, MatchHistoryRecord, RoundHistoryRecord } from './historyTypes';

const VALID_POSITIONS = new Set<string>([
  PlayerPosition.SOUTH,
  PlayerPosition.WEST,
  PlayerPosition.NORTH,
  PlayerPosition.EAST,
]);

/**
 * Validates whether an unknown value conforms strictly to MatchHistoryRecord schema.
 */
export function isValidHistoryRecord(item: unknown): item is MatchHistoryRecord {
  if (!item || typeof item !== 'object') {
    return false;
  }

  const candidate = item as Record<string, any>;

  // Schema version check
  if (candidate.version !== HISTORY_SCHEMA_VERSION) {
    return false;
  }

  // Required fields
  if (typeof candidate.matchId !== 'string' || candidate.matchId.trim() === '') {
    return false;
  }

  if (typeof candidate.completedAt !== 'number' || isNaN(candidate.completedAt) || candidate.completedAt <= 0) {
    return false;
  }

  if (typeof candidate.totalRounds !== 'number' || candidate.totalRounds < 1 || candidate.totalRounds > 10) {
    return false;
  }

  if (!VALID_POSITIONS.has(candidate.winnerPosition)) {
    return false;
  }

  if (!Array.isArray(candidate.winnerPositions) || candidate.winnerPositions.length === 0) {
    return false;
  }

  for (const pos of candidate.winnerPositions) {
    if (!VALID_POSITIONS.has(pos)) return false;
  }

  if (typeof candidate.isTie !== 'boolean') {
    return false;
  }

  // Check final scores
  if (!candidate.finalScores || typeof candidate.finalScores !== 'object') {
    return false;
  }
  for (const pos of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
    if (typeof candidate.finalScores[pos] !== 'number' || isNaN(candidate.finalScores[pos])) {
      return false;
    }
  }

  // Check rankings
  if (!Array.isArray(candidate.rankings) || candidate.rankings.length !== 4) {
    return false;
  }
  for (const r of candidate.rankings) {
    if (!r || typeof r !== 'object') return false;
    if (!VALID_POSITIONS.has(r.position)) return false;
    if (typeof r.score !== 'number' || isNaN(r.score)) return false;
    if (typeof r.rank !== 'number' || r.rank < 1 || r.rank > 4) return false;
  }

  // Check rounds
  if (!Array.isArray(candidate.rounds) || candidate.rounds.length === 0) {
    return false;
  }
  for (const round of candidate.rounds) {
    if (!isValidRound(round)) {
      return false;
    }
  }

  return true;
}

function isValidRound(round: unknown): round is RoundHistoryRecord {
  if (!round || typeof round !== 'object') return false;
  const r = round as Record<string, any>;

  if (typeof r.roundNumber !== 'number' || r.roundNumber < 1) return false;
  if (!VALID_POSITIONS.has(r.dealer)) return false;
  if (!r.scores || typeof r.scores !== 'object') return false;

  for (const pos of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
    const s = r.scores[pos];
    if (!s || typeof s !== 'object') return false;
    if (typeof s.bid !== 'number' || s.bid < 1 || s.bid > 13) return false;
    if (typeof s.tricksWon !== 'number' || s.tricksWon < 0 || s.tricksWon > 13) return false;
    if (typeof s.roundScore !== 'number' || isNaN(s.roundScore)) return false;
    if (typeof s.cumulativeScore !== 'number' || isNaN(s.cumulativeScore)) return false;
  }

  return true;
}

/**
 * Sanitizes an array of records loaded from storage.
 * Gracefully drops corrupt items without throwing or crashing the application.
 */
export function sanitizeHistoryRecords(raw: unknown): MatchHistoryRecord[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const validRecords: MatchHistoryRecord[] = [];
  const seenMatchIds = new Set<string>();

  for (const item of raw) {
    if (isValidHistoryRecord(item)) {
      if (!seenMatchIds.has(item.matchId)) {
        seenMatchIds.add(item.matchId);
        validRecords.push(item);
      }
    }
  }

  // Always return sorted newest first
  return validRecords.sort((a, b) => b.completedAt - a.completedAt);
}
