/**
 * QA Invariant Validator
 * Comprehensive invariant assertions covering Cards, Turns, Bids, Tricks,
 * Rounds, Scoring, and Information Boundaries.
 * Phase 12 Call Break (Lakdi) QA Harness
 */

import { Card, Rank, Suit } from '../../models/card';
import { GameState, GameStatus, TrickState, CompletedTrick, RoundScoreRecord } from '../../models/gameState';
import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../../models/player';
import { IRulesEngine } from '../../core/contracts/IRulesEngine';
import { InvariantViolation } from './QATypes';

export class QAInvariants {
  /**
   * Validates 52-card conservation and uniqueness across hands, current trick, and completed tricks.
   */
  public static checkCardConservation(state: GameState, contextDesc: string): InvariantViolation[] {
    const violations: InvariantViolation[] = [];
    const validSuits = new Set([Suit.SPADES, Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS]);
    const validRanks = new Set(Object.values(Rank));

    const cardSeen = new Map<string, string>(); // card.id -> location

    function inspectCard(card: Card, location: string): void {
      if (!card || typeof card !== 'object') {
        violations.push({
          category: 'INVALID_CARD',
          message: `Malformed card object at ${location} in ${contextDesc}`,
        });
        return;
      }

      if (!validSuits.has(card.suit) || !validRanks.has(card.rank)) {
        violations.push({
          category: 'INVALID_CARD',
          message: `Invalid suit (${String(card.suit)}) or rank (${String(card.rank)}) for card ${card.id} at ${location}`,
        });
      }

      if (cardSeen.has(card.id)) {
        violations.push({
          category: 'DUPLICATE_CARD',
          message: `Duplicate card ${card.id} detected at ${location}; previously found at ${cardSeen.get(card.id)}`,
        });
      } else {
        cardSeen.set(card.id, location);
      }
    }

    // Inspect player hands
    let totalHandCards = 0;
    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      const hand = state.players[pos]?.hand ?? [];
      totalHandCards += hand.length;
      for (const card of hand) {
        inspectCard(card, `Hand ${pos}`);
      }
    }

    // Inspect current trick (only if game is actively playing; at round end, completedTricks has all 52 cards)
    const isRoundEndedOrFinished =
      state.status === GameStatus.ROUND_ENDED || state.status === GameStatus.MATCH_FINISHED;

    const currentTrickCards = !isRoundEndedOrFinished ? (state.currentTrick?.cards ?? []) : [];
    for (const entry of currentTrickCards) {
      inspectCard(entry.card, `CurrentTrick (Trick #${state.currentTrick?.trickNumber})`);
    }

    // Inspect completed tricks
    let totalCompletedTrickCards = 0;
    for (const ct of state.completedTricks ?? []) {
      totalCompletedTrickCards += ct.cards.length;
      for (const entry of ct.cards) {
        inspectCard(entry.card, `CompletedTrick #${ct.trickNumber}`);
      }
    }

    const grandTotal = totalHandCards + currentTrickCards.length + totalCompletedTrickCards;
    if (grandTotal !== 52) {
      violations.push({
        category: 'CARD_CONSERVATION',
        message: `Card conservation violated at ${contextDesc}: expected 52 total cards accounted for, found ${grandTotal} (Hands: ${totalHandCards}, Current Trick: ${currentTrickCards.length}, Completed Tricks: ${totalCompletedTrickCards})`,
        round: state.currentRound,
        trick: state.currentTrick?.trickNumber,
      });
    }

    // Phase-specific distribution checks
    if (state.status === GameStatus.BIDDING) {
      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        const count = state.players[pos]?.hand?.length ?? 0;
        if (count !== 13) {
          violations.push({
            category: 'CARD_CONSERVATION',
            message: `Player ${pos} has ${count} cards during BIDDING, expected 13`,
            playerPosition: pos,
          });
        }
      }
    } else if (state.status === GameStatus.ROUND_ENDED) {
      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        const count = state.players[pos]?.hand?.length ?? 0;
        if (count !== 0) {
          violations.push({
            category: 'CARD_CONSERVATION',
            message: `Player ${pos} has ${count} cards remaining at ROUND_ENDED, expected 0`,
            playerPosition: pos,
          });
        }
      }
    }

    return violations;
  }

  /**
   * Validates active turn and clockwise progression invariants.
   */
  public static checkTurnProgression(
    prevState: GameState | null,
    nextState: GameState
  ): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    if (!CLOCKWISE_PLAYER_ORDER.includes(nextState.currentPlayer)) {
      violations.push({
        category: 'TURN_PROGRESSION',
        message: `Current player '${String(nextState.currentPlayer)}' is not a valid player position`,
      });
    }

    // If both states are in PLAYING mode
    if (prevState && prevState.status === GameStatus.PLAYING && nextState.status === GameStatus.PLAYING) {
      const prevTrick = prevState.currentTrick;
      const nextTrick = nextState.currentTrick;

      // Card played within same trick: must advance clockwise
      if (prevTrick && nextTrick && nextTrick.trickNumber === prevTrick.trickNumber) {
        if (nextTrick.cards.length === prevTrick.cards.length + 1) {
          const expectedNext = this.getNextClockwise(prevState.currentPlayer);
          if (nextTrick.cards.length < 4 && nextState.currentPlayer !== expectedNext) {
            violations.push({
              category: 'TURN_PROGRESSION',
              message: `Turn did not advance clockwise: expected ${expectedNext}, got ${nextState.currentPlayer}`,
            });
          }
        }
      }

      // Trick completed: next trick leader must equal previous trick winner
      if (nextState.completedTricks.length === prevState.completedTricks.length + 1) {
        const lastCompleted = nextState.completedTricks[nextState.completedTricks.length - 1];
        if (nextTrick && nextState.currentPlayer !== lastCompleted.winner) {
          violations.push({
            category: 'TURN_PROGRESSION',
            message: `Trick winner ${lastCompleted.winner} must lead next trick, but currentPlayer is ${nextState.currentPlayer}`,
          });
        }
      }
    }

    return violations;
  }

  /**
   * Validates bidding phase invariants.
   */
  public static checkBiddingInvariants(state: GameState): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    if (state.status === GameStatus.BIDDING) {
      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        const bid = state.players[pos]?.currentBid;
        if (bid !== null && bid !== undefined) {
          if (!Number.isInteger(bid) || bid < 1 || bid > 13) {
            violations.push({
              category: 'BID_VALIDITY',
              message: `Player ${pos} has invalid bid value ${bid} during BIDDING (must be integer 1-13)`,
              playerPosition: pos,
            });
          }
        }
      }
    } else if (state.status === GameStatus.PLAYING || state.status === GameStatus.ROUND_ENDED) {
      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        const bid = state.players[pos]?.currentBid;
        if (typeof bid !== 'number' || !Number.isInteger(bid) || bid < 1 || bid > 13) {
          violations.push({
            category: 'BID_VALIDITY',
            message: `Player ${pos} has missing or invalid bid value ${String(bid)} during ${state.status}`,
            playerPosition: pos,
          });
        }
      }
    }

    return violations;
  }

  /**
   * Validates a card play against RulesEngine and state consistency.
   */
  public static checkCardPlayLegality(
    stateBefore: GameState,
    player: PlayerPosition,
    card: Card,
    rulesEngine: IRulesEngine
  ): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    // Verify card was in player's hand
    const inHand = stateBefore.players[player]?.hand?.some((c) => c.id === card.id);
    if (!inHand) {
      violations.push({
        category: 'CARD_PLAY_LEGALITY',
        message: `Player ${player} attempted to play card ${card.id} which was not in their hand`,
        playerPosition: player,
      });
    }

    // Verify move legality with RulesEngine
    const validation = rulesEngine.isLegalPlay(stateBefore, player, card);
    if (!validation.isValid) {
      violations.push({
        category: 'CARD_PLAY_LEGALITY',
        message: `RulesEngine rejected play of ${card.id} by ${player}: ${validation.reason ?? 'Illegal play'}`,
        playerPosition: player,
      });
    }

    return violations;
  }

  /**
   * Validates trick state integrity and winner correctness.
   */
  public static checkTrickIntegrity(
    trick: TrickState,
    rulesEngine: IRulesEngine,
    trumpSuit: Suit
  ): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    if (trick.cards.length > 4) {
      violations.push({
        category: 'TRICK_INTEGRITY',
        message: `Trick #${trick.trickNumber} contains ${trick.cards.length} cards (max 4)`,
      });
    }

    if (trick.cards.length === 4) {
      if (!trick.winner) {
        violations.push({
          category: 'TRICK_INTEGRITY',
          message: `Trick #${trick.trickNumber} has 4 cards but no winner determined`,
        });
      } else {
        const leadSuit = trick.leadSuit ?? trick.cards[0]?.card.suit ?? trumpSuit;
        const expectedWinner = rulesEngine.determineTrickWinner(trick.cards, leadSuit, trumpSuit);
        if (trick.winner !== expectedWinner) {
          violations.push({
            category: 'TRICK_INTEGRITY',
            message: `Trick #${trick.trickNumber} winner mismatch: got ${trick.winner}, expected ${expectedWinner}`,
          });
        }
      }
    }

    return violations;
  }

  /**
   * Validates round invariants and match completion boundaries.
   */
  public static checkRoundIntegrity(state: GameState, expectedRound: number): InvariantViolation[] {
    const violations: InvariantViolation[] = [];

    if (state.currentRound !== expectedRound) {
      violations.push({
        category: 'ROUND_INTEGRITY',
        message: `Round number mismatch: expected ${expectedRound}, found ${state.currentRound}`,
      });
    }

    if (state.status === GameStatus.ROUND_ENDED) {
      if (state.completedTricks.length !== 13) {
        violations.push({
          category: 'ROUND_INTEGRITY',
          message: `Round ended with ${state.completedTricks.length} completed tricks (expected exactly 13)`,
        });
      }

      const totalTricksWon = CLOCKWISE_PLAYER_ORDER.reduce(
        (sum, p) => sum + (state.players[p]?.tricksWon ?? 0),
        0
      );
      if (totalTricksWon !== 13) {
        violations.push({
          category: 'ROUND_INTEGRITY',
          message: `Sum of player tricks won across round is ${totalTricksWon} (expected exactly 13)`,
        });
      }
    }

    // Match termination check
    if (state.currentRound === 5 && state.status === GameStatus.MATCH_FINISHED) {
      if (state.roundScores.length !== 5) {
        violations.push({
          category: 'ROUND_INTEGRITY',
          message: `Finished match has ${state.roundScores.length} round score records (expected 5)`,
        });
      }
      if (!state.matchResult) {
        violations.push({
          category: 'ROUND_INTEGRITY',
          message: `MATCH_FINISHED state is missing matchResult object`,
        });
      }
    }

    return violations;
  }

  public static getNextClockwise(position: PlayerPosition): PlayerPosition {
    const idx = CLOCKWISE_PLAYER_ORDER.indexOf(position);
    return CLOCKWISE_PLAYER_ORDER[(idx + 1) % CLOCKWISE_PLAYER_ORDER.length];
  }
}
