/**
 * Centralized Game State Store Contract
 * Prevents game state from being scattered across UI components.
 * Phase 1 Architecture Foundation
 */

import { GameState } from '../../models/gameState';
import { GameEvent, GameEventListener } from '../../models/events';

export interface IGameStateStore {
  /**
   * Retrieves the current immutable game state.
   */
  getState(): GameState;

  /**
   * Registers a subscriber for state transitions.
   * Returns an unsubscribe function.
   */
  subscribe(listener: (state: GameState) => void): () => void;

  /**
   * Registers an event listener for discrete gameplay events (e.g. for audio, animations).
   * Returns an unsubscribe function.
   */
  subscribeToEvents(listener: GameEventListener): () => void;

  /**
   * Updates state with an immutable state transition.
   */
  setState(updater: (prevState: GameState) => GameState, event?: GameEvent): void;

  /**
   * Resets the store to initial or specified state.
   */
  reset(state?: GameState): void;

  /**
   * Restores a previously saved in-progress game state and emits MATCH_RESTORED event.
   */
  restore?(state: GameState): void;
}

