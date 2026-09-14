/**
 * Authoritative Server Game Controller
 * Wraps LocalGameController and GameStateStore for real-time multiplayer room matches.
 * Performs server-side card shuffling, rules enforcement, trick resolution, and AI bot play.
 */

import { Card, Rank } from '../../src/models/card';
import { PlayerPosition, PlayerType, PlayerState } from '../../src/models/player';
import { GameMode, GameState, GameStatus, PlayedCard, CompletedTrick } from '../../src/models/gameState';
import { GameEvent } from '../../src/models/events';
import { TurnTimerPayload } from '../../src/models/multiplayer';
import { CardEngine } from '../../src/core/deck/CardEngine';
import { CallBreakRulesEngine } from '../../src/core/rules/CallBreakRulesEngine';
import { ScoringEngine } from '../../src/core/scoring/ScoringEngine';
import { MediumBotStrategy } from '../../src/core/bot/MediumBotStrategy';
import { GameStateStore } from '../../src/core/state/gameStore';
import { LocalGameController } from '../../src/core/controller/LocalGameController';
import { createInitialGameState } from '../../src/core/state/initialState';

export const MAIN_TURN_SECONDS = 45;
export const EXTRA_TURN_SECONDS = 15;

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
  private readonly timerListeners: ((payload: TurnTimerPayload) => void)[] = [];
  private readonly rebidListeners: ((payload: { totalBids: number; message: string }) => void)[] = [];

  private botTimer: NodeJS.Timeout | null = null;
  private turnTimerInterval: NodeJS.Timeout | null = null;
  private currentTimerPlayer: PlayerPosition | null = null;
  private remainingSeconds: number = MAIN_TURN_SECONDS;
  private isExtraTime: boolean = false;
  private unsubscribeStore: (() => void) | null = null;

  constructor() {
    this.store = new GameStateStore(createInitialGameState(GameMode.ONLINE_MULTIPLAYER));
    this.controller = new LocalGameController(this.store, {
      cardEngine: new CardEngine(),
      rulesEngine: new CallBreakRulesEngine(),
      scoringEngine: new ScoringEngine(),
      botStrategy: new MediumBotStrategy(),
    });

    this.controller.onRebid((totalBids, message) => {
      for (const listener of this.rebidListeners) {
        try {
          listener({ totalBids, message });
        } catch (err) {
          console.error('Error in rebid listener:', err);
        }
      }
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

  public onTimerTick(listener: (payload: TurnTimerPayload) => void): () => void {
    this.timerListeners.push(listener);
    return () => {
      const idx = this.timerListeners.indexOf(listener);
      if (idx >= 0) this.timerListeners.splice(idx, 1);
    };
  }

  public onRebid(listener: (payload: { totalBids: number; message: string }) => void): () => void {
    this.rebidListeners.push(listener);
    return () => {
      const idx = this.rebidListeners.indexOf(listener);
      if (idx >= 0) this.rebidListeners.splice(idx, 1);
    };
  }

  private broadcastTimerTick(
    position: PlayerPosition,
    remaining: number,
    total: number,
    extra: boolean
  ): void {
    const payload: TurnTimerPayload = {
      position,
      rawPosition: position,
      remainingSec: remaining,
      totalSec: total,
      isExtraTime: extra,
    };
    for (const listener of this.timerListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error('Error in timer listener:', err);
      }
    }
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
      config: {
        ...rawState.config,
        enableRebiddingRule: true,
      },
      players: configuredPlayers,
    };

    this.store.reset(nextState);
    this.controller.startRound();
    this.advanceTurnOrStepBot();
  }

  public submitBid(position: PlayerPosition, bid: number): boolean {
    const success = this.controller.submitBid(position, bid);
    if (success) {
      this.advanceTurnOrStepBot();
    }
    return success;
  }

  public playCard(position: PlayerPosition, card: Card): boolean {
    const success = this.controller.playCard(position, card);
    if (success) {
      const current = this.store.getState();
      if (current.currentTrick.cards.length === 4) {
        this.clearTurnTimer();
        this.scheduleTrickResolution();
      } else {
        this.advanceTurnOrStepBot();
      }
    }
    return success;
  }

  public nextRound(): boolean {
    const success = this.controller.nextRound();
    if (success) {
      this.advanceTurnOrStepBot();
    }
    return success;
  }

  /**
   * Starts or restarts the 45s + 15s turn timer for the given active human player.
   */
  private startTurnTimer(position: PlayerPosition): void {
    this.clearTurnTimer();
    this.currentTimerPlayer = position;
    this.remainingSeconds = MAIN_TURN_SECONDS;
    this.isExtraTime = false;

    this.broadcastTimerTick(position, MAIN_TURN_SECONDS, MAIN_TURN_SECONDS, false);

    this.turnTimerInterval = setInterval(() => {
      this.remainingSeconds--;

      if (!this.isExtraTime) {
        if (this.remainingSeconds > 0) {
          this.broadcastTimerTick(position, this.remainingSeconds, MAIN_TURN_SECONDS, false);
        } else {
          // 45s main time expired -> activate 15s Extra Time
          this.isExtraTime = true;
          this.remainingSeconds = EXTRA_TURN_SECONDS;
          this.broadcastTimerTick(position, EXTRA_TURN_SECONDS, EXTRA_TURN_SECONDS, true);
        }
      } else {
        if (this.remainingSeconds > 0) {
          this.broadcastTimerTick(position, this.remainingSeconds, EXTRA_TURN_SECONDS, true);
        } else {
          // 15s extra time expired (Total 60s elapsed) -> Auto-timeout move
          this.clearTurnTimer();
          this.handleTurnTimeout(position);
        }
      }
    }, 1000);
  }

  /**
   * Resets and clears the turn timer interval, notifying listeners that timer stopped.
   */
  public clearTurnTimer(): void {
    if (this.turnTimerInterval) {
      clearInterval(this.turnTimerInterval);
      this.turnTimerInterval = null;
    }
    if (this.currentTimerPlayer) {
      this.broadcastTimerTick(this.currentTimerPlayer, 0, MAIN_TURN_SECONDS, false);
      this.currentTimerPlayer = null;
    }
  }

  /**
   * Executes authoritative auto-timeout action when 45s + 15s expires:
   * - Bidding Phase: Auto-submit safe bid calculated via MediumBotStrategy or bid 1.
   * - Playing Phase: Auto-play the lowest valid legal card from CallBreakRulesEngine.
   */
  private handleTurnTimeout(position: PlayerPosition): void {
    const state = this.store.getState();
    if (state.currentPlayer !== position) return;

    if (state.status === GameStatus.BIDDING) {
      const player = state.players[position];
      let safeBid = 1;
      try {
        const existingBids: Record<PlayerPosition, number | null> = {
          [PlayerPosition.SOUTH]: state.players[PlayerPosition.SOUTH].currentBid,
          [PlayerPosition.WEST]: state.players[PlayerPosition.WEST].currentBid,
          [PlayerPosition.NORTH]: state.players[PlayerPosition.NORTH].currentBid,
          [PlayerPosition.EAST]: state.players[PlayerPosition.EAST].currentBid,
        };
        const strategy = new MediumBotStrategy();
        safeBid = strategy.decideBid(player.hand, {
          position,
          dealer: state.dealer,
          existingBids,
          trumpSuit: state.config.trumpSuit,
        });
      } catch {
        safeBid = 1;
      }
      const finalBid = Math.max(state.config.minBid, Math.min(state.config.maxBid, safeBid || 1));
      this.submitBid(position, finalBid);
    } else if (state.status === GameStatus.PLAYING) {
      const player = state.players[position];
      const rulesEngine = new CallBreakRulesEngine();
      const legalMoves = rulesEngine.getLegalMoves(player.hand, state.currentTrick, state.config.trumpSuit);
      if (legalMoves.length > 0) {
        // Sort lowest rank/value card first
        const sorted = [...legalMoves].sort((a, b) => a.value - b.value);
        this.playCard(position, sorted[0]);
      }
    }
  }

  /**
   * Centralized turn driver: clears timers, evaluates active player,
   * schedules bot decision if BOT, or initiates 45s+15s timer if HUMAN.
   */
  private advanceTurnOrStepBot(): void {
    this.clearTurnTimer();
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }

    const state = this.store.getState();
    if (state.status === GameStatus.BIDDING || state.status === GameStatus.PLAYING) {
      if (state.currentTrick.cards.length === 4) {
        return;
      }

      const activePlayer = state.players[state.currentPlayer];
      if (activePlayer && activePlayer.type === PlayerType.BOT) {
        this.scheduleBotStep();
      } else if (activePlayer) {
        this.startTurnTimer(state.currentPlayer);
      }
    }
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
            this.advanceTurnOrStepBot();
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
        this.advanceTurnOrStepBot();
      }
    }, 1100);
  }

  /**
   * Returns current active turn timer payload if a turn timer is running.
   */
  public getCurrentTimer(): TurnTimerPayload | null {
    if (!this.currentTimerPlayer || this.remainingSeconds <= 0) {
      return null;
    }
    return {
      position: this.currentTimerPlayer,
      rawPosition: this.currentTimerPlayer,
      remainingSec: this.remainingSeconds,
      totalSec: this.isExtraTime ? EXTRA_TURN_SECONDS : MAIN_TURN_SECONDS,
      isExtraTime: this.isExtraTime,
    };
  }

  /**
   * Dynamically replaces an AI Bot seat with an incoming human player mid-match.
   * Seamlessly transfers the current round's dealt cards, bid, and won trick counts.
   */
  public takeoverBotSeat(
    position: PlayerPosition,
    newClientId: string,
    newPlayerName: string
  ): boolean {
    const state = this.store.getState();
    const existingPlayer = state.players[position];
    if (!existingPlayer) return false;

    const updatedPlayer: PlayerState = {
      ...existingPlayer,
      id: newClientId,
      name: newPlayerName || `Player ${position}`,
      type: PlayerType.HUMAN,
    };

    const nextPlayers: Record<PlayerPosition, PlayerState> = {
      ...state.players,
      [position]: updatedPlayer,
    };

    this.store.reset({
      ...state,
      players: nextPlayers,
    });

    // If this seat was currently taking a turn, switch from bot step to human turn timer immediately
    if (state.currentPlayer === position) {
      this.advanceTurnOrStepBot();
    }

    return true;
  }

  /**
   * Dynamically replaces a departing human player seat with an AI Bot mid-match.
   * Seamlessly preserves the player's dealt cards, bid, tricks won, and score.
   * Clears any active turn timer and immediately schedules bot automation.
   */
  public replacePlayerWithBot(position: PlayerPosition, botName?: string): boolean {
    const state = this.store.getState();
    const existingPlayer = state.players[position];
    if (!existingPlayer) return false;

    const defaultName = `Bot (${position.charAt(0).toUpperCase() + position.slice(1).toLowerCase()})`;
    const updatedPlayer: PlayerState = {
      ...existingPlayer,
      id: `bot_${position}`,
      name: botName || defaultName,
      type: PlayerType.BOT,
    };

    const nextPlayers: Record<PlayerPosition, PlayerState> = {
      ...state.players,
      [position]: updatedPlayer,
    };

    this.store.reset({
      ...state,
      players: nextPlayers,
    });

    // If this seat was currently taking a turn, clear human timer and trigger bot move immediately
    if (state.currentPlayer === position) {
      this.clearTurnTimer();
      this.advanceTurnOrStepBot();
    }

    return true;
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

    // Rotate completed tricks so trick winner and played cards match the client's perspective
    const rotatedCompletedTricks: readonly CompletedTrick[] = state.completedTricks.map((ct) => ({
      trickNumber: ct.trickNumber,
      leader: mapPosition(ct.leader),
      leadSuit: ct.leadSuit,
      cards: ct.cards.map((c) => ({
        card: c.card,
        playedAt: c.playedAt,
        playerPosition: mapPosition(c.playerPosition),
      })),
      winner: mapPosition(ct.winner),
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
      completedTricks: rotatedCompletedTricks,
      cumulativeScores: rotatedCumulativeScores,
    };
  }

  public destroy(): void {
    this.clearTurnTimer();
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
