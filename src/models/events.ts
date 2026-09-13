/**
 * Game Events for decoupled state updates and external subscriptions
 * Phase 1 Architecture Foundation
 */

import { Card } from './card';
import { PlayerPosition } from './player';
import { CompletedTrick, MatchResult, RoundScoreRecord } from './gameState';

export type GameEvent =
  | { type: 'MATCH_INITIALIZED'; payload: { matchId: string } }
  | { type: 'ROUND_STARTED'; payload: { roundNumber: number; dealer: PlayerPosition } }
  | { type: 'CARDS_DEALT'; payload: { handsCount: number } }
  | { type: 'BID_REQUESTED'; payload: { playerPosition: PlayerPosition; minBid: number; maxBid: number } }
  | { type: 'BID_PLACED'; payload: { playerPosition: PlayerPosition; bid: number } }
  | { type: 'TURN_STARTED'; payload: { playerPosition: PlayerPosition } }
  | { type: 'CARD_PLAYED'; payload: { playerPosition: PlayerPosition; card: Card } }
  | { type: 'TRICK_COMPLETED'; payload: { trick: CompletedTrick } }
  | { type: 'ROUND_COMPLETED'; payload: { roundNumber: number; roundScore: RoundScoreRecord } }
  | { type: 'MATCH_COMPLETED'; payload: { result: MatchResult } }
  | { type: 'MATCH_RESTORED'; payload: { matchId: string; roundNumber: number } };

export type GameEventListener = (event: GameEvent) => void;
