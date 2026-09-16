/**
 * Authoritative Server Game Controller
 * Wraps LocalGameController and GameStateStore for real-time multiplayer room matches.
 * Performs server-side card shuffling, rules enforcement, trick resolution, and AI bot play.
 */

import { Card, Rank } from '../../src/models/card';
import { PlayerPosition, PlayerType, PlayerState } from '../../src/models/player';
import {
  GameMode,
  GameState,
  GameStatus,
  PlayedCard,
  CompletedTrick,
  RoundScoreRecord,
  PlayerRoundScore,
  MatchResult,
} from '../../src/models/gameState';
import { GameEvent } from '../../src/models/events';
import { TurnTimerPayload } from '../../src/models/multiplayer';
import { CardEngine } from '../../src/core/deck/CardEngine';
import { sortHand } from '../../src/core/deck/cardUtils';
import { CallBreakRulesEngine } from '../../src/core/rules/CallBreakRulesEngine';
import { ScoringEngine } from '../../src/core/scoring/ScoringEngine';
import { MediumBotStrategy } from '../../src/core/bot/MediumBotStrategy';
import { BiddingContext, PlayCardContext } from '../../src/core/contracts/IBotStrategy';
import { GameStateStore } from '../../src/core/state/gameStore';
import { LocalGameController } from '../../src/core/controller/LocalGameController';
import { createInitialGameState } from '../../src/core/state/initialState';

// Standard active turn timers: 20s main action time + 10s extra time (30s total).
// The host receives an additional 20s extra time allowance (50s total).
// The 45-second timer is strictly reserved for the disconnect/reconnect window in RoomManager.
export const MAIN_TURN_SECONDS = 20;
export const EXTRA_TURN_SECONDS = 10;
export const HOST_EXTRA_TURN_SECONDS = 20;

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
  private readonly timeoutTakeoverListeners: ((position: PlayerPosition) => void)[] = [];

  private botTimer: NodeJS.Timeout | null = null;
  private turnTimerInterval: NodeJS.Timeout | null = null;
  private roundTransitionTimer: NodeJS.Timeout | null = null;
  private currentTimerPlayer: PlayerPosition | null = null;
  private remainingSeconds: number = MAIN_TURN_SECONDS;
  private isExtraTime: boolean = false;
  private isMatchTurnProgressionStarted: boolean = false;
  private unsubscribeStore: (() => void) | null = null;
  private hostPositionProvider: ((position: PlayerPosition) => boolean) | null = null;

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

  public onTimeoutTakeover(listener: (position: PlayerPosition) => void): () => void {
    this.timeoutTakeoverListeners.push(listener);
    return () => {
      const idx = this.timeoutTakeoverListeners.indexOf(listener);
      if (idx >= 0) this.timeoutTakeoverListeners.splice(idx, 1);
    };
  }

  /**
   * Sets the authoritative host check provider from RoomManager.
   */
  public setHostPositionProvider(provider: ((position: PlayerPosition) => boolean) | null): void {
    this.hostPositionProvider = provider;
  }

  /**
   * Checks whether the specified position is the authoritative human host.
   * A bot can NEVER be considered a host human.
   */
  public isHostPosition(position: PlayerPosition): boolean {
    const player = this.store.getState().players[position];
    if (!player || player.type === PlayerType.BOT) {
      return false;
    }
    return this.hostPositionProvider ? this.hostPositionProvider(position) : false;
  }

  /**
   * Returns extra turn duration: 10s for normal players, 30s (10s + 20s) for the human host.
   */
  public getExtraTurnSeconds(position: PlayerPosition): number {
    return this.isHostPosition(position)
      ? EXTRA_TURN_SECONDS + HOST_EXTRA_TURN_SECONDS
      : EXTRA_TURN_SECONDS;
  }

  private notifyTimeoutTakeover(position: PlayerPosition): void {
    for (const listener of this.timeoutTakeoverListeners) {
      try {
        listener(position);
      } catch (err) {
        console.error('Error in timeout takeover listener:', err);
      }
    }
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
   * STRICT MULTIPLAYER FAIRNESS GUARD:
   * GameMode is set to ONLINE_MULTIPLAYER, ensuring 100% unweighted uniform random
   * cryptographic Fisher-Yates dealing with zero card bias or player favoritism.
   */
  public initializeMatch(
    players: Record<PlayerPosition, PlayerSetupInfo>,
    totalRounds: number = 5,
    autoStartProgression: boolean = false
  ): void {
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
        totalRounds: totalRounds === 10 ? 10 : 5,
        enableRebiddingRule: true,
      },
      players: configuredPlayers,
    };

    this.isMatchTurnProgressionStarted = false;
    this.store.reset(nextState);
    this.controller.startRound();
    if (autoStartProgression) {
      this.startTurnProgression();
    }
  }

  /**
   * Starts turn progression / bot stepping after clients have confirmed readiness.
   * Safe to call multiple times (idempotent).
   */
  public startTurnProgression(): void {
    if (this.isMatchTurnProgressionStarted) return;
    this.isMatchTurnProgressionStarted = true;
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
      this.handlePostActionState();
    }
    return success;
  }

  public nextRound(): boolean {
    this.clearRoundTransitionTimer();
    const state = this.store.getState();
    if (state.status !== GameStatus.ROUND_ENDED || state.currentRound >= state.config.totalRounds) {
      return false;
    }
    const success = this.controller.nextRound();
    if (success) {
      this.advanceTurnOrStepBot();
    }
    return success;
  }

  /**
   * Alias for nextRound() to advance to the next round.
   */
  public startNextRound(): boolean {
    return this.nextRound();
  }

  /**
   * Resets and clears any pending automatic round transition timer.
   */
  public clearRoundTransitionTimer(): void {
    if (this.roundTransitionTimer) {
      clearTimeout(this.roundTransitionTimer);
      this.roundTransitionTimer = null;
    }
  }

  /**
   * Schedules authoritative server-side auto-transition to the next round after displaying the round summary.
   */
  private scheduleNextRoundAutoTransition(delayMs: number = 4000): void {
    this.clearRoundTransitionTimer();
    this.roundTransitionTimer = setTimeout(() => {
      this.roundTransitionTimer = null;
      const state = this.store.getState();
      if (state.status === GameStatus.ROUND_ENDED && state.currentRound < state.config.totalRounds) {
        this.startNextRound();
      }
    }, delayMs);
  }

  /**
   * Handles post-card-play and post-bot-step state inspection for round ends and trick resolutions.
   */
  private handlePostActionState(): void {
    const state = this.store.getState();

    // 1. If round ended (completed 13 tricks)
    if (state.status === GameStatus.ROUND_ENDED) {
      this.clearTurnTimer();
      try {
        this.controller.completeRound();
      } catch (err) {
        console.error('Error completing round scoring:', err);
      }
      const scoredState = this.store.getState();
      if (scoredState.status === GameStatus.ROUND_ENDED && scoredState.currentRound < scoredState.config.totalRounds) {
        this.scheduleNextRoundAutoTransition(4000);
      }
      return;
    }

    // 2. If match reached completion
    if (state.status === GameStatus.MATCH_FINISHED) {
      this.clearTurnTimer();
      this.clearRoundTransitionTimer();
      return;
    }

    // 3. Fallback for decoupled modes where trick reaches 4 cards without immediate resolution
    if (state.currentTrick.cards.length === 4) {
      this.clearTurnTimer();
      this.scheduleTrickResolution();
      return;
    }

    // 4. Continue game flow to next turn or bot
    this.advanceTurnOrStepBot();
  }

  /**
   * Starts or restarts the turn timer for the given active human player:
   * Main time: 20s
   * Extra time: 10s (Non-host) or 30s (Host, which is 10s + 20s)
   * Total allowance: 30s (Non-host) or 50s (Host)
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
          // 20s main time expired -> activate Extra Time
          // (10s for non-host human, 30s for host human)
          this.isExtraTime = true;
          const extraSeconds = this.getExtraTurnSeconds(position);
          this.remainingSeconds = extraSeconds;
          this.broadcastTimerTick(position, extraSeconds, extraSeconds, true);
        }
      } else {
        const extraSeconds = this.getExtraTurnSeconds(position);
        // If host role was transferred mid-extra-time, clamp remainingSeconds immediately
        if (this.remainingSeconds > extraSeconds) {
          this.remainingSeconds = extraSeconds;
        }

        if (this.remainingSeconds > 0) {
          this.broadcastTimerTick(position, this.remainingSeconds, extraSeconds, true);
        } else {
          // Extra time expired (Total 30s for non-host, 50s for host) -> Auto-timeout move
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
   * Executes authoritative auto-timeout action when total allowance (30s non-host, 50s host) expires:
   * 1. Converts the seat's controller state to isBot: true (PlayerType.BOT) keeping cards, bid, and tricks intact.
   * 2. Requests an optimal legal move from the strong bot strategy (with lowest legal card as emergency fallback).
   * 3. Plays that move immediately without stalling.
   * 4. Subsequent turns for this seat continue automatically under bot control.
   */
  private handleTurnTimeout(position: PlayerPosition): void {
    const state = this.store.getState();
    if (state.currentPlayer !== position) return;

    // 1. Convert Seat to Bot Control:
    // Transition seat's player state to PlayerType.BOT, keeping ID, name, hand, bid, tricks won, score intact
    const existingPlayer = state.players[position];
    if (existingPlayer && existingPlayer.type !== PlayerType.BOT) {
      const updatedPlayer: PlayerState = {
        ...existingPlayer,
        type: PlayerType.BOT,
      };
      this.store.reset({
        ...state,
        players: {
          ...state.players,
          [position]: updatedPlayer,
        },
      });
      // Bind strong bot strategy to this seat for all subsequent turns
      this.controller.bindBotStrategy(position, new MediumBotStrategy());
      this.notifyTimeoutTakeover(position);
    }

    // 2. Play legal bid or card immediately using strong bot strategy
    const currentState = this.store.getState();
    const player = currentState.players[position];
    if (!player) return;

    if (currentState.status === GameStatus.BIDDING) {
      let safeBid = 1;
      try {
        const existingBids: Record<PlayerPosition, number | null> = {
          [PlayerPosition.SOUTH]: currentState.players[PlayerPosition.SOUTH].currentBid,
          [PlayerPosition.WEST]: currentState.players[PlayerPosition.WEST].currentBid,
          [PlayerPosition.NORTH]: currentState.players[PlayerPosition.NORTH].currentBid,
          [PlayerPosition.EAST]: currentState.players[PlayerPosition.EAST].currentBid,
        };
        const strategy = new MediumBotStrategy();
        const decided = strategy.decideBid(player.hand, {
          position,
          dealer: currentState.dealer,
          existingBids,
          trumpSuit: currentState.config.trumpSuit,
        });
        safeBid = typeof decided === 'number' ? decided : 1;
      } catch {
        safeBid = 1;
      }
      const finalBid = Math.max(currentState.config.minBid, Math.min(currentState.config.maxBid, safeBid || 1));
      this.submitBid(position, finalBid);
    } else if (currentState.status === GameStatus.PLAYING) {
      const rulesEngine = new CallBreakRulesEngine();
      const legalMoves = rulesEngine.getLegalMoves(player.hand, currentState.currentTrick, currentState.config.trumpSuit);
      if (legalMoves.length > 0) {
        let cardToPlay: Card | null = null;
        try {
          const remainingCardsCount: Record<PlayerPosition, number> = {
            [PlayerPosition.SOUTH]: currentState.players[PlayerPosition.SOUTH].hand.length,
            [PlayerPosition.WEST]: currentState.players[PlayerPosition.WEST].hand.length,
            [PlayerPosition.NORTH]: currentState.players[PlayerPosition.NORTH].hand.length,
            [PlayerPosition.EAST]: currentState.players[PlayerPosition.EAST].hand.length,
          };
          const context: PlayCardContext = {
            position,
            hand: player.hand,
            legalMoves,
            currentTrick: currentState.currentTrick,
            trumpSuit: currentState.config.trumpSuit,
            playerBid: player.currentBid ?? 1,
            playerTricksWon: player.tricksWon,
            remainingCardsCount,
            completedTricks: currentState.completedTricks,
          };
          const strategy = new MediumBotStrategy();
          const decision = strategy.decideCardPlay(context);
          if (decision && legalMoves.some((c) => c.suit === decision.suit && c.rank === decision.rank)) {
            cardToPlay = decision;
          }
        } catch {
          cardToPlay = null;
        }

        // Emergency fallback if strategy fails: lowest legal card
        if (!cardToPlay) {
          const sorted = [...legalMoves].sort((a, b) => a.value - b.value);
          cardToPlay = sorted[0];
        }

        this.playCard(position, cardToPlay);
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
        this.botTimer = null;
        const didStep = this.controller.stepBotTurn();
        if (didStep) {
          this.handlePostActionState();
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
      this.botTimer = null;
      this.controller.resolveTrick();
      const state = this.store.getState();
      if (state.status === GameStatus.ROUND_ENDED) {
        try {
          this.controller.completeRound();
        } catch (err) {
          console.error('Error completing round scoring in trick resolution:', err);
        }
        const scoredState = this.store.getState();
        if (scoredState.status === GameStatus.ROUND_ENDED && scoredState.currentRound < scoredState.config.totalRounds) {
          this.scheduleNextRoundAutoTransition(4000);
        }
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
    const totalSec = this.isExtraTime
      ? this.getExtraTurnSeconds(this.currentTimerPlayer)
      : MAIN_TURN_SECONDS;

    return {
      position: this.currentTimerPlayer,
      rawPosition: this.currentTimerPlayer,
      remainingSec: this.remainingSeconds,
      totalSec,
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

    // Assign MediumBotStrategy
    this.controller.bindBotStrategy(position, new MediumBotStrategy());

    // CRITICAL ANTI-STALL LOGIC:
    // If this seat was currently taking a turn:
    // DO NOT wait for timer timeouts or leave the table frozen!
    // Within 500ms, trigger the bot move/bid immediately so the trick advances.
    if (state.currentPlayer === position) {
      this.clearTurnTimer();
      if (this.botTimer) {
        clearTimeout(this.botTimer);
        this.botTimer = null;
      }

      this.botTimer = setTimeout(() => {
        const cur = this.store.getState();
        if (cur.currentPlayer === position) {
          if (cur.status === GameStatus.BIDDING) {
            this.controller.executeBotBid(position);
            this.advanceTurnOrStepBot();
          } else if (cur.status === GameStatus.PLAYING) {
            const legalMoves = this.controller.getLegalMovesForPlayer(position);
            if (legalMoves.length > 0) {
              const sorted = [...legalMoves].sort((a, b) => a.value - b.value);
              this.playCard(position, sorted[0]);
            } else {
              const didStep = this.controller.stepBotTurn();
              if (didStep) {
                if (this.store.getState().currentTrick.cards.length === 4) {
                  this.scheduleTrickResolution();
                } else {
                  this.advanceTurnOrStepBot();
                }
              }
            }
          }
        }
      }, 500);
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
        ? sortHand(p.hand)
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

    // Rotate roundScores records so client-side modal scores match perspective player positions
    const rotatedRoundScores: readonly RoundScoreRecord[] = state.roundScores.map((record) => {
      const rotatedScores: Record<PlayerPosition, PlayerRoundScore> = {
        [PlayerPosition.SOUTH]: {
          ...record.scores[POSITIONS[(0 + clientIdx) % 4]],
          playerPosition: PlayerPosition.SOUTH,
        },
        [PlayerPosition.WEST]: {
          ...record.scores[POSITIONS[(1 + clientIdx) % 4]],
          playerPosition: PlayerPosition.WEST,
        },
        [PlayerPosition.NORTH]: {
          ...record.scores[POSITIONS[(2 + clientIdx) % 4]],
          playerPosition: PlayerPosition.NORTH,
        },
        [PlayerPosition.EAST]: {
          ...record.scores[POSITIONS[(3 + clientIdx) % 4]],
          playerPosition: PlayerPosition.EAST,
        },
      };
      return {
        ...record,
        scores: rotatedScores,
      };
    });

    // Rotate matchResult if finalized
    const rotatedMatchResult: MatchResult | null = state.matchResult
      ? {
          ...state.matchResult,
          winnerPosition: mapPosition(state.matchResult.winnerPosition),
          winnerPositions: state.matchResult.winnerPositions.map(mapPosition),
          finalScores: rotatedCumulativeScores,
          rankings: state.matchResult.rankings.map((r) => ({
            ...r,
            position: mapPosition(r.position),
          })),
        }
      : null;

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
      roundScores: rotatedRoundScores,
      cumulativeScores: rotatedCumulativeScores,
      matchResult: rotatedMatchResult,
    };
  }

  public destroy(): void {
    this.clearTurnTimer();
    this.clearRoundTransitionTimer();
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
