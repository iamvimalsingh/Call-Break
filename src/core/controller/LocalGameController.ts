/**
 * Local Game Controller Implementation
 * Coordinates local match flow while delegating to future engine modules.
 * Strictly decoupled from UI and framework layers.
 * Phase 1 Architecture Foundation
 */

import { Card } from '../../models/card';
import { PlayerPosition, PlayerType } from '../../models/player';
import { GameMode, GameState, GameStatus } from '../../models/gameState';
import { IGameController } from '../contracts/IGameController';
import { IGameStateStore } from '../contracts/IGameStateStore';
import { ICardEngine } from '../contracts/ICardEngine';
import { IRulesEngine } from '../contracts/IRulesEngine';
import { IScoringEngine } from '../contracts/IScoringEngine';
import { BiddingContext, IBotStrategy, PlayCardContext } from '../contracts/IBotStrategy';
import { IPersistenceAdapter } from '../contracts/IPersistenceAdapter';
import { MediumBotStrategy } from '../bot/MediumBotStrategy';
import { createInitialGameState } from '../state/initialState';
import { sharedLocalStorageAdapter } from '../../services/storage/LocalStorageAdapter';

export class LocalGameController implements IGameController {
  public readonly store: IGameStateStore;
  
  // Modular engine injections (Phase 2, 3, 4, 5, 6)
  private cardEngine: ICardEngine | null = null;
  private rulesEngine: IRulesEngine | null = null;
  private scoringEngine: IScoringEngine | null = null;
  private botStrategies: Map<PlayerPosition, IBotStrategy> = new Map();
  private defaultBotStrategy: IBotStrategy = new MediumBotStrategy();
  private persistenceAdapter: IPersistenceAdapter | null = null;
  private readonly rebidListeners: ((totalBids: number, message: string) => void)[] = [];

  constructor(
    store: IGameStateStore,
    deps?: {
      cardEngine?: ICardEngine;
      rulesEngine?: IRulesEngine;
      scoringEngine?: IScoringEngine;
      botStrategy?: IBotStrategy;
      botStrategies?: Partial<Record<PlayerPosition, IBotStrategy>>;
      persistenceAdapter?: IPersistenceAdapter;
    }
  ) {
    this.store = store;
    if (deps?.cardEngine) this.cardEngine = deps.cardEngine;
    if (deps?.rulesEngine) this.rulesEngine = deps.rulesEngine;
    if (deps?.scoringEngine) this.scoringEngine = deps.scoringEngine;
    if (deps?.botStrategy) this.defaultBotStrategy = deps.botStrategy;
    if (deps?.botStrategies) {
      for (const [pos, strat] of Object.entries(deps.botStrategies)) {
        if (strat) {
          this.botStrategies.set(pos as PlayerPosition, strat);
        }
      }
    }
    if (deps?.persistenceAdapter) {
      this.persistenceAdapter = deps.persistenceAdapter;
    } else if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      this.persistenceAdapter = sharedLocalStorageAdapter;
    }
  }

  /**
   * Automatically persists active game state to persistence adapter at state boundaries.
   * Clears saved state when match is finished or uninitialized (IDLE).
   */
  private persistState(state: GameState): void {
    if (!this.persistenceAdapter) return;
    if (state.status === GameStatus.IDLE || state.status === GameStatus.MATCH_FINISHED) {
      this.persistenceAdapter.clearSavedGame().catch(() => {});
    } else {
      this.persistenceAdapter.saveGame(state).catch(() => {});
    }
  }

  /**
   * Registers or updates the Card Engine when implemented in Phase 2.
   */
  public bindCardEngine(engine: ICardEngine): void {
    this.cardEngine = engine;
  }

  /**
   * Registers or updates the Rules Engine when implemented in Phase 3.
   */
  public bindRulesEngine(engine: IRulesEngine): void {
    this.rulesEngine = engine;
  }

  /**
   * Registers or updates the Scoring Engine implemented in Phase 4.
   */
  public bindScoringEngine(engine: IScoringEngine): void {
    this.scoringEngine = engine;
  }

  /**
   * Registers or updates Bot Strategies when implemented in Phase 5.
   */
  public bindBotStrategy(position: PlayerPosition, strategy: IBotStrategy): void {
    this.botStrategies.set(position, strategy);
  }

  /**
   * Registers persistence adapter when implemented in Phase 6.
   */
  public bindPersistenceAdapter(adapter: IPersistenceAdapter): void {
    this.persistenceAdapter = adapter;
  }

  /**
   * Subscribes to re-bid events triggered when sum(bids) <= 8.
   */
  public onRebid(listener: (totalBids: number, message: string) => void): () => void {
    this.rebidListeners.push(listener);
    return () => {
      const idx = this.rebidListeners.indexOf(listener);
      if (idx >= 0) this.rebidListeners.splice(idx, 1);
    };
  }

  /**
   * Restores a previously saved in-progress match from the persistence adapter into the store.
   * Returns true if restored successfully, false otherwise.
   */
  public async restoreSavedGame(): Promise<boolean> {
    if (!this.persistenceAdapter) {
      return false;
    }
    try {
      const saved = await this.persistenceAdapter.loadSavedGame();
      if (!saved) {
        return false;
      }
      const sanitizedPlayers =
        saved.mode === GameMode.OFFLINE_BOTS
          ? {
              ...saved.players,
              [PlayerPosition.SOUTH]: { ...saved.players[PlayerPosition.SOUTH], name: 'You' },
              [PlayerPosition.WEST]: { ...saved.players[PlayerPosition.WEST], name: 'West Player' },
              [PlayerPosition.NORTH]: { ...saved.players[PlayerPosition.NORTH], name: 'North Player' },
              [PlayerPosition.EAST]: { ...saved.players[PlayerPosition.EAST], name: 'East Player' },
            }
          : saved.players;

      const sanitizedSaved: GameState = {
        ...saved,
        config: {
          ...saved.config,
          enableRebiddingRule: false,
        },
        players: sanitizedPlayers,
      };
      if (typeof this.store.restore === 'function') {
        this.store.restore(sanitizedSaved);
      } else {
        this.store.setState(() => sanitizedSaved, {
          type: 'MATCH_RESTORED',
          payload: {
            matchId: sanitizedSaved.matchId,
            roundNumber: sanitizedSaved.currentRound,
          },
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks whether a valid in-progress saved game exists.
   */
  public async hasSavedGame(): Promise<boolean> {
    if (!this.persistenceAdapter) return false;
    try {
      const saved = await this.persistenceAdapter.loadSavedGame();
      return saved !== null;
    } catch {
      return false;
    }
  }

  /**
   * Clears any saved in-progress game.
   */
  public async clearSavedGame(): Promise<boolean> {
    if (!this.persistenceAdapter) return false;
    try {
      return await this.persistenceAdapter.clearSavedGame();
    } catch {
      return false;
    }
  }

  /**
   * Explicitly persists the current store state if in-progress.
   */
  public async saveCurrentGame(): Promise<boolean> {
    if (!this.persistenceAdapter) return false;
    try {
      return await this.persistenceAdapter.saveGame(this.store.getState());
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the current saved in-progress game state without loading it into the store.
   */
  public async getSavedGame(): Promise<GameState | null> {
    if (!this.persistenceAdapter) return null;
    try {
      return await this.persistenceAdapter.loadSavedGame();
    } catch {
      return null;
    }
  }

  public initMatch(mode: GameMode = GameMode.OFFLINE_BOTS, enableRebiddingRule: boolean = false, totalRounds: number = 5): void {
    const rawState = createInitialGameState(mode);
    const userSavedName = typeof window !== 'undefined' ? (localStorage.getItem('cb_player_name') || '').trim() : '';
    const southBase = userSavedName && !/^(host|player|you)$/i.test(userSavedName) ? userSavedName : 'Host';
    const finalSouthName = `${southBase} (You)`;

    const players =
      mode === GameMode.OFFLINE_BOTS
        ? {
            [PlayerPosition.SOUTH]: {
              ...rawState.players[PlayerPosition.SOUTH],
              name: 'You',
            },
            [PlayerPosition.WEST]: {
              ...rawState.players[PlayerPosition.WEST],
              name: 'West Player',
            },
            [PlayerPosition.NORTH]: {
              ...rawState.players[PlayerPosition.NORTH],
              name: 'North Player',
            },
            [PlayerPosition.EAST]: {
              ...rawState.players[PlayerPosition.EAST],
              name: 'East Player',
            },
          }
        : {
            ...rawState.players,
            [PlayerPosition.SOUTH]: {
              ...rawState.players.SOUTH,
              name: finalSouthName,
            },
          };

    const freshState: GameState = {
      ...rawState,
      config: {
        ...rawState.config,
        totalRounds: totalRounds === 10 ? 10 : 5,
        ...(enableRebiddingRule ? { enableRebiddingRule: true } : {}),
      },
      players,
    };
    this.store.reset(freshState);
    this.persistState(freshState);
  }

  /**
   * Starts a completely fresh match and immediately initializes Round 1.
   */
  public startNewMatch(mode: GameMode = GameMode.OFFLINE_BOTS, enableRebiddingRule: boolean = false, totalRounds: number = 5): void {
    this.initMatch(mode, enableRebiddingRule, totalRounds);
    this.startRound();
  }

  public startRound(): void {
    const current = this.store.getState();
    if (current.status === GameStatus.DEALING || current.status === GameStatus.PLAYING) {
      return;
    }

    if (this.cardEngine && this.rulesEngine) {
      const initializedState = this.rulesEngine.initializeRound(current, this.cardEngine);
      this.store.setState(() => initializedState, {
        type: 'ROUND_STARTED',
        payload: {
          roundNumber: initializedState.currentRound,
          dealer: initializedState.dealer,
        },
      });
      this.persistState(initializedState);
      return;
    }

    this.store.setState(
      (prev) => ({
        ...prev,
        status: GameStatus.DEALING,
        lastActionMessage: `Round ${prev.currentRound} of 5 initiated. Awaiting Phase 2 Card Engine dealing.`,
      }),
      {
        type: 'ROUND_STARTED',
        payload: {
          roundNumber: current.currentRound,
          dealer: current.dealer,
        },
      }
    );
    this.persistState(this.store.getState());
  }

  public submitBid(position: PlayerPosition, bid: number): boolean {
    const current = this.store.getState();

    // If fully managed by Rules Engine
    if (this.rulesEngine) {
      const validation = this.rulesEngine.validateBid(bid, position, current);
      if (!validation.isValid) {
        return false;
      }

      const nextState = this.rulesEngine.applyBid(current, position, bid);
      this.store.setState(() => nextState, {
        type: 'BID_PLACED',
        payload: { playerPosition: position, bid },
      });

      // Special Callbreak Rule: Check if all 4 bids are placed and sum(bids) <= 8
      if (
        nextState.config.enableRebiddingRule &&
        this.rulesEngine.isRebidRequired &&
        this.rulesEngine.isRebidRequired(nextState)
      ) {
        const totalBids = this.rulesEngine.getTotalBids(nextState);
        const rebidMessage = `Total bids = ${totalBids} (≤ 8). Minimum bid total not reached. Re-bidding round!`;

        if (this.cardEngine) {
          const redealtState = this.rulesEngine.redealRound(nextState, this.cardEngine);
          this.store.setState(() => redealtState, {
            type: 'ROUND_STARTED',
            payload: {
              roundNumber: redealtState.currentRound,
              dealer: redealtState.dealer,
            },
          });
          this.persistState(redealtState);
          for (const listener of this.rebidListeners) {
            try {
              listener(totalBids, rebidMessage);
            } catch (err) {
              console.error('Error in rebid listener:', err);
            }
          }
          return true;
        }
      }

      this.persistState(nextState);
      return true;
    }

    // Fallback basic bounds check (Phase 1 decoupled testing mode without RulesEngine)
    if (bid < current.config.minBid || bid > current.config.maxBid) {
      return false;
    }

    this.store.setState(
      (prev) => {
        const player = prev.players[position];
        if (!player) return prev;

        return {
          ...prev,
          players: {
            ...prev.players,
            [position]: {
              ...player,
              currentBid: bid,
            },
          },
          lastActionMessage: `${player.name} bid ${bid} tricks.`,
        };
      },
      {
        type: 'BID_PLACED',
        payload: { playerPosition: position, bid },
      }
    );
    this.persistState(this.store.getState());

    return true;
  }

  public playCard(position: PlayerPosition, card: Card): boolean {
    const current = this.store.getState();

    // If fully managed by Rules Engine
    if (this.rulesEngine) {
      const validation = this.rulesEngine.isLegalPlay(current, position, card);
      if (!validation.isValid) {
        return false;
      }

      const nextState = this.rulesEngine.applyCardPlay(current, position, card);
      this.store.setState(() => nextState, {
        type: 'CARD_PLAYED',
        payload: { playerPosition: position, card },
      });
      this.persistState(nextState);
      return true;
    }

    // Fallback basic validation (Phase 1 decoupled testing mode without RulesEngine)
    if (current.status !== GameStatus.PLAYING) {
      return false;
    }

    this.store.setState(
      (prev) => ({
        ...prev,
        lastActionMessage: `${prev.players[position]?.name ?? position} played ${card.rank} of ${card.suit}.`,
      }),
      {
        type: 'CARD_PLAYED',
        payload: { playerPosition: position, card },
      }
    );
    this.persistState(this.store.getState());

    return true;
  }

  public resolveTrick(): void {
    const current = this.store.getState();
    if (this.rulesEngine && current.currentTrick.cards.length === 4) {
      const nextState = this.rulesEngine.resolveCurrentTrick(current);
      const lastCompletedTrick = nextState.completedTricks[nextState.completedTricks.length - 1];
      this.store.setState(() => nextState, {
        type: 'TRICK_COMPLETED',
        payload: {
          trick: lastCompletedTrick,
        },
      });
      this.persistState(nextState);
      return;
    }

    this.store.setState((prev) => ({
      ...prev,
      lastActionMessage: 'Trick resolution triggered.',
    }));
  }

  public completeRound(): void {
    const current = this.store.getState();
    if (this.scoringEngine) {
      const nextState = this.scoringEngine.applyRoundScoresToState(current);
      const latestRoundScore = nextState.roundScores[nextState.roundScores.length - 1];

      this.store.setState(() => nextState, {
        type: 'ROUND_COMPLETED',
        payload: {
          roundNumber: current.currentRound,
          roundScore: latestRoundScore,
        },
      });

      if (nextState.status === GameStatus.MATCH_FINISHED && nextState.matchResult) {
        this.store.setState((prev) => prev, {
          type: 'MATCH_COMPLETED',
          payload: {
            result: nextState.matchResult,
          },
        });
      }
      this.persistState(nextState);
      return;
    }

    this.store.setState((prev) => ({
      ...prev,
      status: GameStatus.ROUND_ENDED,
      lastActionMessage: `Round ${prev.currentRound} complete. Awaiting scoring calculation.`,
    }));
    this.persistState(this.store.getState());
  }

  public resetMatch(): void {
    this.initMatch();
  }

  /**
   * Transitions to the next round (2 to 5):
   * 1. Verifies current round is complete and scored
   * 2. Increments round number
   * 3. Initializes fresh round via RulesEngine & CardEngine (dealer rotation, fresh deal)
   * 4. Preserves cumulative scores and previous round records
   */
  public nextRound(): boolean {
    const current = this.store.getState();
    if (current.status !== GameStatus.ROUND_ENDED) {
      return false;
    }

    if (current.currentRound >= current.config.totalRounds) {
      return false;
    }

    const nextRoundNumber = current.currentRound + 1;
    const stateForNextRound: GameState = {
      ...current,
      currentRound: nextRoundNumber,
    };

    if (this.cardEngine && this.rulesEngine) {
      const initializedState = this.rulesEngine.initializeRound(
        stateForNextRound,
        this.cardEngine
      );
      this.store.setState(() => initializedState, {
        type: 'ROUND_STARTED',
        payload: {
          roundNumber: initializedState.currentRound,
          dealer: initializedState.dealer,
        },
      });
      this.persistState(initializedState);
      return true;
    }

    return false;
  }

  /**
   * Retrieves authoritative legal moves for a given player position from the RulesEngine.
   */
  public getLegalMovesForPlayer(position: PlayerPosition): readonly Card[] {
    const current = this.store.getState();
    const player = current.players[position];
    if (!player || !this.rulesEngine) {
      return [];
    }
    return this.rulesEngine.getLegalMoves(
      player.hand,
      current.currentTrick,
      current.config.trumpSuit
    );
  }

  /**
   * Retrieves the configured bot strategy for the player position,
   * falling back to the default strategy if not specifically assigned.
   */
  public getBotStrategy(position: PlayerPosition): IBotStrategy {
    return this.botStrategies.get(position) ?? this.defaultBotStrategy;
  }

  /**
   * Determines if the specified player position is managed by a bot.
   */
  public isBotPlayer(position: PlayerPosition): boolean {
    const current = this.store.getState();
    const player = current.players[position];
    if (player) {
      return player.type === PlayerType.BOT;
    }
    return position !== PlayerPosition.SOUTH;
  }

  /**
   * Executes an automated bid for a bot player during BIDDING phase.
   */
  public executeBotBid(position: PlayerPosition): boolean {
    const current = this.store.getState();
    if (current.status !== GameStatus.BIDDING) {
      return false;
    }

    if (this.rulesEngine) {
      const expected = this.rulesEngine.getExpectedBiddingPlayer(current);
      if (expected !== position) {
        return false;
      }
    }

    const playerState = current.players[position];
    if (!playerState || playerState.currentBid !== null) {
      return false;
    }

    const strategy = this.getBotStrategy(position);
    const existingBids: Record<PlayerPosition, number | null> = {
      [PlayerPosition.SOUTH]: current.players.SOUTH.currentBid,
      [PlayerPosition.WEST]: current.players.WEST.currentBid,
      [PlayerPosition.NORTH]: current.players.NORTH.currentBid,
      [PlayerPosition.EAST]: current.players.EAST.currentBid,
    };

    const context: BiddingContext = {
      position,
      dealer: current.dealer,
      existingBids,
      trumpSuit: current.config.trumpSuit,
    };

    const bidResult = strategy.decideBid(playerState.hand, context);
    const bid = typeof bidResult === 'number' ? bidResult : 1;

    return this.submitBid(position, bid);
  }

  /**
   * Executes an automated card play for a bot player during PLAYING phase.
   */
  public executeBotCardPlay(position: PlayerPosition): boolean {
    const current = this.store.getState();
    if (current.status !== GameStatus.PLAYING) {
      return false;
    }

    if (current.currentPlayer !== position) {
      return false;
    }

    if (current.currentTrick.cards.length >= 4) {
      return false;
    }

    const playerState = current.players[position];
    if (!playerState || playerState.hand.length === 0) {
      return false;
    }

    const legalMoves = this.rulesEngine
      ? this.rulesEngine.getLegalMoves(
          playerState.hand,
          current.currentTrick,
          current.config.trumpSuit
        )
      : playerState.hand;

    if (legalMoves.length === 0) {
      return false;
    }

    const remainingCardsCount: Record<PlayerPosition, number> = {
      [PlayerPosition.SOUTH]: current.players.SOUTH.hand.length,
      [PlayerPosition.WEST]: current.players.WEST.hand.length,
      [PlayerPosition.NORTH]: current.players.NORTH.hand.length,
      [PlayerPosition.EAST]: current.players.EAST.hand.length,
    };

    const context: PlayCardContext = {
      position,
      hand: playerState.hand,
      legalMoves,
      currentTrick: current.currentTrick,
      trumpSuit: current.config.trumpSuit,
      playerBid: playerState.currentBid ?? 1,
      playerTricksWon: playerState.tricksWon,
      remainingCardsCount,
      completedTricks: current.completedTricks,
    };

    const strategy = this.getBotStrategy(position);
    const cardResult = strategy.decideCardPlay(context);
    const cardToPlay = 'id' in cardResult ? cardResult : legalMoves[0];

    return this.playCard(position, cardToPlay);
  }

  /**
   * Advances the match if the current turn belongs to a bot or if a trick is ready for resolution.
   * Returns true if an action was performed; false if waiting for human input or match not active.
   */
  public stepBotTurn(): boolean {
    const current = this.store.getState();

    // 1. If currently in BIDDING phase:
    if (current.status === GameStatus.BIDDING) {
      const expectedBidder = this.rulesEngine
        ? this.rulesEngine.getExpectedBiddingPlayer(current)
        : null;
      if (expectedBidder && this.isBotPlayer(expectedBidder)) {
        return this.executeBotBid(expectedBidder);
      }
      return false;
    }

    // 2. If currently in PLAYING phase:
    if (current.status === GameStatus.PLAYING) {
      // If trick has 4 cards, resolve it
      if (current.currentTrick.cards.length === 4) {
        this.resolveTrick();
        return true;
      }

      if (this.isBotPlayer(current.currentPlayer)) {
        return this.executeBotCardPlay(current.currentPlayer);
      }
      return false;
    }

    // 3. If round ended and scoring engine is ready, complete round
    if (current.status === GameStatus.ROUND_ENDED && this.scoringEngine) {
      const alreadyScored = current.roundScores.some(
        (r) => r.roundNumber === current.currentRound
      );
      if (!alreadyScored) {
        this.completeRound();
        return true;
      }
      return false;
    }

    return false;
  }
}
