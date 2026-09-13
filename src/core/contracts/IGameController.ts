/**
 * Game Controller Contract
 * Orchestrates match flow, round progression, turn dispatching, and engine coordination.
 * Decoupled from UI and rendering technology.
 * Phase 1 Architecture Foundation
 */

import { Card } from '../../models/card';
import { PlayerPosition } from '../../models/player';
import { GameMode, GameState } from '../../models/gameState';
import { IGameStateStore } from './IGameStateStore';

export interface IGameController {
  readonly store: IGameStateStore;

  /**
   * Initializes a new match with the chosen mode (offline bots, pass-and-play, or multiplayer).
   */
  initMatch(mode?: GameMode): void;

  /**
   * Starts a new round: sets up dealer rotation, triggers deck creation, shuffle, and dealing.
   */
  startRound(): void;

  /**
   * Submits a bid for the specified player position (1-13).
   */
  submitBid(position: PlayerPosition, bid: number): boolean;

  /**
   * Plays a card from the current player's hand.
   */
  playCard(position: PlayerPosition, card: Card): boolean;

  /**
   * Resolves the current completed trick, records winner, and advances to next lead.
   */
  resolveTrick(): void;

  /**
   * Computes round scoring, records round history, and transitions to next round or match finish.
   */
  completeRound(): void;

  /**
   * Resets or restarts the current match.
   */
  resetMatch(): void;

  /**
   * Executes a bid for a bot player position using registered or default bot strategy.
   */
  executeBotBid?(position: PlayerPosition): boolean;

  /**
   * Executes a card play for a bot player position using registered or default bot strategy.
   */
  executeBotCardPlay?(position: PlayerPosition): boolean;

  /**
   * Advances match turn if the active bidder or card player is a bot.
   * Returns true if a bot action or trick resolution was executed.
   */
  stepBotTurn?(): boolean;

  /**
   * Checks whether the specified position is played by a bot.
   */
  isBotPlayer?(position: PlayerPosition): boolean;
}
