/**
 * QA Single Game Runner
 * Orchestrates a complete 5-round Call Break match with granular invariant assertions
 * and deep diagnostic inspection.
 * Phase 12 Call Break (Lakdi) QA Harness
 */

import { GameStateStore } from '../../core/state/gameStore';
import { LocalGameController } from '../../core/controller/LocalGameController';
import { CardEngine } from '../../core/deck/CardEngine';
import { CallBreakRulesEngine } from '../../core/rules/CallBreakRulesEngine';
import { ScoringEngine } from '../../core/scoring/ScoringEngine';
import { MediumBotStrategy } from '../../core/bot/MediumBotStrategy';
import { DeterministicRandomSource } from '../../core/random/IRandomSource';
import { Card } from '../../models/card';
import { GameMode, GameStatus } from '../../models/gameState';
import { PlayerPosition, PlayerType, CLOCKWISE_PLAYER_ORDER } from '../../models/player';
import { QAInvariants } from './QAInvariants';
import { QAScoringVerifier } from './QAScoringVerifier';
import { QABotSafetyVerifier } from './QABotSafetyVerifier';
import { QAFailureReporter } from './QAFailureReporter';
import { GameRunOptions, GameRunResult, InvariantViolation } from './QATypes';

export class GameRunner {
  private rulesEngine: CallBreakRulesEngine;
  private scoringEngine: ScoringEngine;
  private botStrategy: MediumBotStrategy;

  constructor() {
    this.rulesEngine = new CallBreakRulesEngine();
    this.scoringEngine = new ScoringEngine();
    this.botStrategy = new MediumBotStrategy();
  }

  public runGame(options: GameRunOptions): GameRunResult {
    const startTime = Date.now();
    const rng = new DeterministicRandomSource(options.seed);
    const cardEngine = new CardEngine(rng);
    const store = new GameStateStore();
    const controller = new LocalGameController(store, {
      cardEngine,
      rulesEngine: this.rulesEngine,
      scoringEngine: this.scoringEngine,
    });

    const violations: InvariantViolation[] = [];
    let roundsCompleted = 0;
    let tricksCompleted = 0;
    let lastValidAction = 'INITIALIZATION';
    let failingAction = '';
    let caughtError: Error | null = null;

    try {
      controller.startNewMatch(GameMode.OFFLINE_BOTS);
      lastValidAction = 'START_NEW_MATCH';

      // Set all players to BOT for automated execution
      store.setState((prev) => {
        const updated = { ...prev.players };
        for (const pos of CLOCKWISE_PLAYER_ORDER) {
          updated[pos] = { ...updated[pos], type: PlayerType.BOT };
        }
        return { ...prev, players: updated };
      });

      // Execute 5 rounds
      for (let round = 1; round <= 5; round++) {
        let state = store.getState();

        // Round start invariant checks
        violations.push(
          ...QAInvariants.checkCardConservation(state, `Round ${round} Deal`),
          ...QAInvariants.checkRoundIntegrity(state, round),
          ...QAInvariants.checkBiddingInvariants(state)
        );

        // Phase A: Bidding
        let bidStep = 0;
        while (store.getState().status === GameStatus.BIDDING && bidStep++ < 20) {
          const cur = store.getState();
          const expected = this.rulesEngine.getExpectedBiddingPlayer(cur);
          if (!expected) break;

          const playerHand = cur.players[expected].hand;
          const biddingCtx = {
            position: expected,
            dealer: cur.dealer,
            existingBids: {
              SOUTH: cur.players.SOUTH.currentBid,
              WEST: cur.players.WEST.currentBid,
              NORTH: cur.players.NORTH.currentBid,
              EAST: cur.players.EAST.currentBid,
            },
            trumpSuit: cur.config.trumpSuit,
          };

          // Audit bot context
          violations.push(...QABotSafetyVerifier.verifyBiddingContext(biddingCtx));

          let chosenBid: number;
          if (options.customBids && options.customBids[expected] !== undefined) {
            chosenBid = options.customBids[expected];
          } else if (options.customBidStrategy === 'ALL_ONES') {
            chosenBid = 1;
          } else if (options.customBidStrategy === 'ALL_THIRTEENS') {
            chosenBid = 13;
          } else if (options.customBidStrategy === 'MIXED_EXTREMES') {
            chosenBid = (expected === PlayerPosition.SOUTH || expected === PlayerPosition.NORTH) ? 1 : 13;
          } else if (options.customBidStrategy === 'RANDOM_LEGAL') {
            // Random legal integer 1 to 13
            chosenBid = 1 + Math.floor(rng.next() * 13);
          } else {
            chosenBid = this.botStrategy.decideBid(playerHand, biddingCtx);
          }

          const bidValidation = this.rulesEngine.validateBid(chosenBid, expected, cur);
          if (!bidValidation.isValid) {
            violations.push({
              category: 'BID_VALIDITY',
              message: `Bid validation rejected ${chosenBid} for ${expected}: ${bidValidation.reason ?? ''}`,
              playerPosition: expected,
              round,
            });
          }

          failingAction = `SUBMIT_BID_${expected}_${chosenBid}`;
          const ok = controller.submitBid(expected, chosenBid);
          if (!ok) {
            throw new Error(`Controller failed to submit legal bid ${chosenBid} for ${expected}`);
          }
          lastValidAction = failingAction;
        }

        state = store.getState();
        violations.push(...QAInvariants.checkBiddingInvariants(state));

        if (state.status !== GameStatus.PLAYING) {
          throw new Error(`State did not transition to PLAYING after 4 bids in round ${round}`);
        }

        // Phase B: Playing 13 Tricks
        let playStep = 0;
        while (store.getState().status === GameStatus.PLAYING && playStep++ < 200) {
          const cur = store.getState();
          const activePlayer = cur.currentPlayer;

          // Conservation invariant check
          violations.push(...QAInvariants.checkCardConservation(cur, `Trick ${cur.currentTrick.trickNumber} Turn ${activePlayer}`));

          const legalMoves = controller.getLegalMovesForPlayer(activePlayer);
          if (legalMoves.length === 0) {
            throw new Error(`Player ${activePlayer} has 0 legal moves during trick ${cur.currentTrick.trickNumber}`);
          }

          const playCtx = {
            position: activePlayer,
            hand: cur.players[activePlayer].hand,
            legalMoves,
            currentTrick: cur.currentTrick,
            trumpSuit: cur.config.trumpSuit,
            playerBid: cur.players[activePlayer].currentBid ?? 1,
            playerTricksWon: cur.players[activePlayer].tricksWon,
            remainingCardsCount: {
              SOUTH: cur.players.SOUTH.hand.length,
              WEST: cur.players.WEST.hand.length,
              NORTH: cur.players.NORTH.hand.length,
              EAST: cur.players.EAST.hand.length,
            },
            completedTricks: cur.completedTricks,
          };

          violations.push(...QABotSafetyVerifier.verifyPlayCardContext(playCtx));

          const playDecision = this.botStrategy.decideCardPlay(playCtx);
          const chosenCard: Card =
            'card' in (playDecision as object)
              ? (playDecision as unknown as { card: Card }).card
              : (playDecision as unknown as Card);

          // Card play legality checks
          violations.push(
            ...QAInvariants.checkCardPlayLegality(cur, activePlayer, chosenCard, this.rulesEngine)
          );

          failingAction = `PLAY_CARD_${activePlayer}_${chosenCard.id}`;
          const tricksBefore = cur.completedTricks.length;
          const ok = controller.playCard(activePlayer, chosenCard);
          if (!ok) {
            throw new Error(`Controller failed to play card ${chosenCard.id} for ${activePlayer}`);
          }
          lastValidAction = failingAction;

          const afterState = store.getState();
          violations.push(...QAInvariants.checkTurnProgression(cur, afterState));

          if (afterState.completedTricks.length > tricksBefore) {
            tricksCompleted++;
            const lastCompleted = afterState.completedTricks[afterState.completedTricks.length - 1];
            violations.push(
              ...QAInvariants.checkTrickIntegrity(lastCompleted, this.rulesEngine, cur.config.trumpSuit)
            );
          }
        }

        state = store.getState();
        if (state.status !== GameStatus.ROUND_ENDED) {
          throw new Error(`Round ${round} did not finish with ROUND_ENDED, status: ${state.status}`);
        }

        violations.push(
          ...QAInvariants.checkCardConservation(state, `Round ${round} End`),
          ...QAInvariants.checkRoundIntegrity(state, round)
        );

        roundsCompleted++;

        // Phase C: Round Scoring
        const prevCumulative = { ...state.cumulativeScores };
        failingAction = `COMPLETE_ROUND_${round}`;
        controller.completeRound();
        lastValidAction = failingAction;

        const scoredState = store.getState();
        const latestRoundRecord = scoredState.roundScores[scoredState.roundScores.length - 1];

        // Verify scoring
        violations.push(
          ...QAScoringVerifier.verifyRoundScoring(
            state,
            latestRoundRecord,
            scoredState.cumulativeScores,
            prevCumulative
          )
        );

        // Next round transition if < 5
        if (round < 5) {
          failingAction = `NEXT_ROUND_${round + 1}`;
          const nextOk = controller.nextRound();
          if (!nextOk) {
            throw new Error(`Controller failed to advance to round ${round + 1}`);
          }
          lastValidAction = failingAction;

          // Ensure bot type maintained
          store.setState((prev) => {
            const updated = { ...prev.players };
            for (const pos of CLOCKWISE_PLAYER_ORDER) {
              updated[pos] = { ...updated[pos], type: PlayerType.BOT };
            }
            return { ...prev, players: updated };
          });
        }
      }

      // Final match assertions
      const finalState = store.getState();
      violations.push(...QAInvariants.checkRoundIntegrity(finalState, 5));

      if (finalState.matchResult) {
        violations.push(
          ...QAScoringVerifier.verifyMatchResult(finalState.cumulativeScores, finalState.matchResult)
        );
      }

      const hasFatalViolation = violations.some(
        (v) =>
          v.category === 'CARD_CONSERVATION' ||
          v.category === 'DUPLICATE_CARD' ||
          v.category === 'CARD_PLAY_LEGALITY' ||
          v.category === 'SCORING_CONSISTENCY'
      );

      const success = !hasFatalViolation && finalState.status === GameStatus.MATCH_FINISHED;

      return {
        seed: options.seed,
        matchId: finalState.matchId,
        success,
        roundsCompleted,
        tricksCompleted,
        violations,
        finalScores: finalState.cumulativeScores,
        winnerPosition: finalState.matchResult?.winnerPosition ?? null,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      caughtError = err;
      const diagState = store.getState();
      const diagnostics = QAFailureReporter.captureDiagnostics(
        options.seed,
        diagState,
        lastValidAction,
        failingAction,
        caughtError ?? 'Unknown exception',
        violations
      );

      return {
        seed: options.seed,
        matchId: diagState.matchId ?? 'unknown',
        success: false,
        roundsCompleted,
        tricksCompleted,
        violations,
        failureDiagnostics: diagnostics,
        finalScores: diagState.cumulativeScores ?? { SOUTH: 0, WEST: 0, NORTH: 0, EAST: 0 },
        winnerPosition: null,
        durationMs: Date.now() - startTime,
      };
    }
  }
}
