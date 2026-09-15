/**
 * Centralized GameStateStore Implementation
 * Strictly separates game state from UI components.
 * Independent of DOM and React frameworks.
 * Phase 1 Architecture Foundation
 */

import { GameMode, GameState } from '../../models/gameState';
import { GameEvent, GameEventListener } from '../../models/events';
import { IGameStateStore } from '../contracts/IGameStateStore';
import { createInitialGameState } from './initialState';

export class GameStateStore implements IGameStateStore {
  private currentState: GameState;
  private readonly stateSubscribers = new Set<(state: GameState) => void>();
  private readonly eventSubscribers = new Set<GameEventListener>();

  constructor(initialState?: GameState) {
    this.currentState = initialState ?? createInitialGameState();
  }

  public getState(): GameState {
    return this.currentState;
  }

  public subscribe(listener: (state: GameState) => void): () => void {
    this.stateSubscribers.add(listener);
    // Immediately emit current state on subscription
    listener(this.currentState);

    return () => {
      this.stateSubscribers.delete(listener);
    };
  }

  public subscribeToEvents(listener: GameEventListener): () => void {
    this.eventSubscribers.add(listener);
    return () => {
      this.eventSubscribers.delete(listener);
    };
  }

  public setState(updater: (prevState: GameState) => GameState, event?: GameEvent): void {
    const nextState = updater(this.currentState);
    if (nextState !== this.currentState) {
      this.currentState = nextState;
      this.notifyStateSubscribers();
    }

    if (event) {
      this.notifyEventSubscribers(event);
    }
  }

  public reset(state?: GameState): void {
    this.currentState = state ?? createInitialGameState();
    this.notifyStateSubscribers();
    this.notifyEventSubscribers({
      type: 'MATCH_INITIALIZED',
      payload: { matchId: this.currentState.matchId },
    });
  }

  /**
   * Restores a previously saved in-progress game state and notifies listeners.
   */
  public restore(state: GameState): void {
    this.currentState = state;
    this.notifyStateSubscribers();
    this.notifyEventSubscribers({
      type: 'MATCH_RESTORED',
      payload: { matchId: this.currentState.matchId, roundNumber: this.currentState.currentRound },
    });
  }

  private notifyStateSubscribers(): void {
    const frozenState = Object.freeze({ ...this.currentState });
    for (const listener of this.stateSubscribers) {
      try {
        listener(frozenState);
      } catch (err) {
        console.error('Error in GameState subscriber:', err);
      }
    }
  }

  private notifyEventSubscribers(event: GameEvent): void {
    for (const listener of this.eventSubscribers) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in GameEvent subscriber:', err);
      }
    }
  }
}

/**
 * Default singleton instance of the store for application lifecycle.
 */
export const sharedGameStore = new GameStateStore(
  createInitialGameState(GameMode.ONLINE_MULTIPLAYER)
);

