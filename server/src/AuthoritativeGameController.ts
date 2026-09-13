/**
 * Authoritative Server Game Controller
 * Wraps LocalGameController and GameStateStore for real-time multiplayer room matches.
 * Performs server-side card shuffling, rules enforcement, trick resolution, and AI bot play.
 */

import { Card, Rank } from '../../src/models/card';
import { PlayerPosition, PlayerType, PlayerState } from '../../src/models/player';
import { GameMode, GameState, GameStatus, PlayedCard } from '../../src/models/gameState';
import { GameEvent } from '../../src/models/events';
import { CardEngine } from '../../src/core/deck/CardEngine';
import { CallBreakRulesEngine } from '../../src/core/rules/CallBreakRulesEngine';
import { ScoringEngine } from '../../src/core/scoring/ScoringEngine';
import { MediumBotStrategy } from '../../src/core/bot/MediumBotStrategy';
import { GameStateStore } from '../../src/core/state/gameStore';
import { LocalGameController } from '../../src/core/controller/LocalGameController';
import { createInitialGameState } from '../../src/core/state/initialState';

const POSITIONS: readonly PlayerPosition[] = [
  PlayerPosition.SOUTH,
  PlayerPosition.WEST,
  PlayerPosition.NORTH,
  PlayerPosition.EAST,
];

export interface PlayerSetupInfo {
  id: string;
  name: string;
  isBot: boolean;
  position: PlayerPosition;
}

export class AuthoritativeGameController {
  private readonly store: GameStateStore;
  private readonly controller: LocalGameController;
  private readonly eventListeners: ((event: GameEvent) => void)[] = [];
  private readonly stateListeners: ((state: GameState) => void)[] = [];
  private botTimer: NodeJS.Timeout | null = null;
  private unsubscribeStore: (() => void) | null = null;

  constructor() {
    this.store = new GameStateStore(createInitialGameState(GameMode.ONLINE_MULTIPLAYER));
    this.controller = new LocalGameController(this.store, {
      cardEngine: new CardEngine(),
      rulesEngine: new CallBreakRulesEngine(),
      scoringEngine: new ScoringEngine(),
      botStrategy: new MediumBotStrategy(),
    });

    this.unsubscribeStore = this.store.subscribe((state) => {
      for (const listener of this.stateListeners) {
        try {
          listener(state);
        } catch (err) {
          console.error('Error in state listener:', err);
        }
      }
    });

    const unsubEvents = this.store.subscribeToEvents((event) => {
      for (const listener of this.eventListeners) {
        try {
          listener(event);
        } catch (err) {
          console.error('Error in event listener:', err);
        }
      }
    });

    const origUnsub = this.unsubscribeStore;
    this.unsubscribeStore = () => {
      origUnsub();
      unsubEvents();
    };
  }

  public onEvent(listener: (event: GameEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const idx = this.eventListeners.indexOf(listener);
      if (idx >= 0) this.eventListeners.splice(idx, 1);
    };
  }

  public onStateChange(listener: (state: GameState) => void): () => void {
    this.stateListeners.push(listener);
    return () => {
      const idx = this.stateListeners.indexOf(listener);
      if (idx >= 0) this.stateListeners.splice(idx, 1);
    };
  }

  public getState(): GameState {
    return this.store.getState();
  }

  /**
   * Initializes a multiplayer match with assigned players and starts Round 1.
   */
  public initializeMatch(players: Record<PlayerPosition, PlayerSetupInfo>): void {
    const rawState = createInitialGameState(GameMode.ONLINE_MULTIPLAYER);

    const configuredPlayers: Record<PlayerPosition, PlayerState> = {
      [PlayerPosition.SOUTH]: {
        ...rawState.players.SOUTH,
        id: players[PlayerPosition.SOUTH].id,
        name: players[PlayerPosition.SOUTH].name,
        type: players[PlayerPosition.SOUTH].isBot ? PlayerType.BOT : PlayerType.HUMAN,
      },
      [PlayerPosition.WEST]: {
        ...rawState.players.WEST,
        id: players[PlayerPosition.WEST].id,
        name: players[PlayerPosition.WEST].name,
        type: players[PlayerPosition.WEST].isBot ? PlayerType.BOT : PlayerType.HUMAN,
      },
      [PlayerPosition.NORTH]: {
        ...rawState.players.NORTH,
        id: players[PlayerPosition.NORTH].id,
        name: players[PlayerPosition.NORTH].name,
        type: players[PlayerPosition.NORTH].isBot ? PlayerType.BOT : PlayerType.HUMAN,
      },
      [PlayerPosition.EAST]: {
        ...rawState.players.EAST,
        id: players[PlayerPosition.EAST].id,
        name: players[PlayerPosition.EAST].name,
        type: players[PlayerPosition.EAST].isBot ? PlayerType.BOT : PlayerType.HUMAN,
      },
    };

    const nextState: GameState = {
      ...rawState,
      players: configuredPlayers,
    };

    this.store.reset(nextState);
    this.controller.startRound();
    this.scheduleBotStep();
  }

  public submitBid(position: PlayerPosition, bid: number): boolean {
    const success = this.controller.submitBid(position, bid);
    if (success) {
      this.scheduleBotStep();
    }
    return success;
  }

  public playCard(position: PlayerPosition, card: Card): boolean {
    const success = this.controller.playCard(position, card);
    if (success) {
      const current = this.store.getState();
      if (current.currentTrick.cards.length === 4) {
        this.scheduleTrickResolution();
      } else {
        this.scheduleBotStep();
      }
    }
    return success;
  }

  public nextRound(): boolean {
    const success = this.controller.nextRound();
    if (success) {
      this.scheduleBotStep();
    }
    return success;
  }

  private scheduleBotStep(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }

    const state = this.store.getState();
    if (state.status === GameStatus.BIDDING || state.status === GameStatus.PLAYING) {
      if (state.currentTrick.cards.length === 4) {
        return;
      }

      this.botTimer = setTimeout(() => {
        const didStep = this.controller.stepBotTurn();
        if (didStep) {
          const currentState = this.store.getState();
          if (currentState.currentTrick.cards.length === 4) {
            this.scheduleTrickResolution();
          } else {
            this.scheduleBotStep();
          }
        }
      }, 550);
    }
  }

  private scheduleTrickResolution(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }

    this.botTimer = setTimeout(() => {
      this.controller.resolveTrick();
      const state = this.store.getState();
      if (state.status === GameStatus.ROUND_ENDED) {
        this.controller.completeRound();
      } else {
        this.scheduleBotStep();
      }
    }, 1100);
  }

  /**
   * Generates a client-perspective GameState for the player at clientRawPos.
   * Maps client's raw position to SOUTH so client's own hand is rendered at the bottom,
   * with other 3 players rotated clockwise around the table.
   * Also masks opponents' hand cards for anti-cheat protection.
   */
  public getPerspectiveState(clientRawPos: PlayerPosition): GameState {
    const state = this.store.getState();
    const clientIdx = POSITIONS.indexOf(clientRawPos);

    const mapPosition = (rawPos: PlayerPosition): PlayerPosition => {
      const rawIdx = POSITIONS.indexOf(rawPos);
      const mappedIdx = (rawIdx - clientIdx + 4) % 4;
      return POSITIONS[mappedIdx];
    };

    // Rotate players
    const rotatedPlayers: Record<PlayerPosition, PlayerState> = {
      [PlayerPosition.SOUTH]: {} as PlayerState,
      [PlayerPosition.WEST]: {} as PlayerState,
      [PlayerPosition.NORTH]: {} as PlayerState,
      [PlayerPosition.EAST]: {} as PlayerState,
    };

    for (const rawPos of POSITIONS) {
      const p = state.players[rawPos];
      const mappedPos = mapPosition(rawPos);
      const isClientSelf = rawPos === clientRawPos;

      const handForClient: readonly Card[] = isClientSelf
        ? p.hand
        : p.hand.map((_, i) => ({
            id: `masked_${p.id}_${i}`,
            suit: state.config.trumpSuit,
            rank: Rank.TWO,
            value: 2,
          }));

      rotatedPlayers[mappedPos] = {
        ...p,
        position: mappedPos,
        hand: handForClient,
      };
    }

    // Rotate current trick cards
    const rotatedTrickCards: readonly PlayedCard[] = state.currentTrick.cards.map((tc) => ({
      card: tc.card,
      playedAt: tc.playedAt,
      playerPosition: mapPosition(tc.playerPosition),
    }));

    // Rotate cumulative scores
    const rotatedCumulativeScores: Record<PlayerPosition, number> = {
      [PlayerPosition.SOUTH]: state.cumulativeScores[POSITIONS[(0 + clientIdx) % 4]],
      [PlayerPosition.WEST]: state.cumulativeScores[POSITIONS[(1 + clientIdx) % 4]],
      [PlayerPosition.NORTH]: state.cumulativeScores[POSITIONS[(2 + clientIdx) % 4]],
      [PlayerPosition.EAST]: state.cumulativeScores[POSITIONS[(3 + clientIdx) % 4]],
    };

    return {
      ...state,
      currentPlayer: mapPosition(state.currentPlayer),
      dealer: mapPosition(state.dealer),
      players: rotatedPlayers,
      currentTrick: {
        ...state.currentTrick,
        leader: mapPosition(state.currentTrick.leader),
        winner: state.currentTrick.winner ? mapPosition(state.currentTrick.winner) : null,
        cards: rotatedTrickCards,
      },
      cumulativeScores: rotatedCumulativeScores,
    };
  }

  public destroy(): void {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
  }
}
