/**
 * Phase 5 Bot Intelligence & Strategy Engine Development Verification Component
 * Developer diagnostic panel for interactive testing of:
 * - Hand strength evaluation and bidding breakdown
 * - Difficulty selection (EASY / MEDIUM / HARD / EXPERT)
 * - Legal move analysis, lead/follow/trump/discard decisions
 * - Transparent reasoning labels for bot card selection
 * - 13-trick simulation driver
 * Development-only diagnostic panel.
 */

import React, { useState } from 'react';
import {
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Play,
  RotateCcw,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { Card, Rank, Suit } from '../../models/card';
import { PlayerPosition } from '../../models/player';
import { TrickState, GameMode } from '../../models/gameState';
import { createCard } from '../../core/deck/cardUtils';
import { CardEngine } from '../../core/deck/CardEngine';
import { CallBreakRulesEngine } from '../../core/rules/CallBreakRulesEngine';
import { ScoringEngine } from '../../core/scoring/ScoringEngine';
import { LocalGameController } from '../../core/controller/LocalGameController';
import { GameStateStore } from '../../core/state/gameStore';
import { createInitialGameState } from '../../core/state/initialState';
import {
  BotDifficulty,
  BiddingContext,
  PlayCardContext,
  HandEvaluation,
  CardPlayDecision,
} from '../../core/contracts/IBotStrategy';
import {
  BotStrategyFactory,
  MediumBotStrategy,
} from '../../core/bot';

const PRESET_HANDS: { label: string; cards: Card[] }[] = [
  {
    label: 'Monster Spades (High Honors)',
    cards: [
      createCard(Suit.SPADES, Rank.ACE),
      createCard(Suit.SPADES, Rank.KING),
      createCard(Suit.SPADES, Rank.QUEEN),
      createCard(Suit.SPADES, Rank.JACK),
      createCard(Suit.HEARTS, Rank.ACE),
      createCard(Suit.HEARTS, Rank.KING),
      createCard(Suit.DIAMONDS, Rank.ACE),
      createCard(Suit.CLUBS, Rank.ACE),
      createCard(Suit.CLUBS, Rank.TEN),
      createCard(Suit.HEARTS, Rank.FOUR),
      createCard(Suit.DIAMONDS, Rank.SIX),
      createCard(Suit.CLUBS, Rank.THREE),
      createCard(Suit.DIAMONDS, Rank.TWO),
    ],
  },
  {
    label: 'Balanced Hand (3 Spades + Honors)',
    cards: [
      createCard(Suit.SPADES, Rank.KING),
      createCard(Suit.SPADES, Rank.EIGHT),
      createCard(Suit.SPADES, Rank.FOUR),
      createCard(Suit.HEARTS, Rank.ACE),
      createCard(Suit.HEARTS, Rank.JACK),
      createCard(Suit.HEARTS, Rank.FIVE),
      createCard(Suit.DIAMONDS, Rank.QUEEN),
      createCard(Suit.DIAMONDS, Rank.TEN),
      createCard(Suit.DIAMONDS, Rank.THREE),
      createCard(Suit.CLUBS, Rank.KING),
      createCard(Suit.CLUBS, Rank.SEVEN),
      createCard(Suit.CLUBS, Rank.TWO),
      createCard(Suit.HEARTS, Rank.TWO),
    ],
  },
  {
    label: 'Weak Hand (No Spades / Low Cards)',
    cards: [
      createCard(Suit.HEARTS, Rank.TWO),
      createCard(Suit.HEARTS, Rank.THREE),
      createCard(Suit.HEARTS, Rank.FIVE),
      createCard(Suit.HEARTS, Rank.SIX),
      createCard(Suit.DIAMONDS, Rank.TWO),
      createCard(Suit.DIAMONDS, Rank.THREE),
      createCard(Suit.DIAMONDS, Rank.FOUR),
      createCard(Suit.CLUBS, Rank.TWO),
      createCard(Suit.CLUBS, Rank.THREE),
      createCard(Suit.CLUBS, Rank.FIVE),
      createCard(Suit.CLUBS, Rank.SIX),
      createCard(Suit.DIAMONDS, Rank.SEVEN),
      createCard(Suit.HEARTS, Rank.FOUR),
    ],
  },
  {
    label: 'Heart Void with Low Trump',
    cards: [
      createCard(Suit.SPADES, Rank.TWO),
      createCard(Suit.SPADES, Rank.FIVE),
      createCard(Suit.SPADES, Rank.NINE),
      createCard(Suit.DIAMONDS, Rank.ACE),
      createCard(Suit.DIAMONDS, Rank.JACK),
      createCard(Suit.DIAMONDS, Rank.EIGHT),
      createCard(Suit.DIAMONDS, Rank.FOUR),
      createCard(Suit.CLUBS, Rank.ACE),
      createCard(Suit.CLUBS, Rank.TEN),
      createCard(Suit.CLUBS, Rank.SIX),
      createCard(Suit.CLUBS, Rank.FOUR),
      createCard(Suit.CLUBS, Rank.THREE),
      createCard(Suit.CLUBS, Rank.TWO),
    ],
  },
];

export const BotStrategyVerification: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState<BotDifficulty>(BotDifficulty.MEDIUM);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(1);
  const [simLog, setSimLog] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const rulesEngine = new CallBreakRulesEngine();
  const currentHand = PRESET_HANDS[selectedPresetIndex].cards;
  const currentStrategy = BotStrategyFactory.create(selectedDifficulty);

  // Evaluate Hand for Bidding
  const biddingContext: BiddingContext = {
    position: PlayerPosition.WEST,
    dealer: PlayerPosition.SOUTH,
    existingBids: {
      [PlayerPosition.SOUTH]: 3,
      [PlayerPosition.WEST]: null,
      [PlayerPosition.NORTH]: null,
      [PlayerPosition.EAST]: null,
    },
    trumpSuit: Suit.SPADES,
  };

  const handEval: HandEvaluation = currentStrategy.evaluateHand(currentHand, biddingContext);
  const rawBid = currentStrategy.decideBid(currentHand, biddingContext);
  const recommendedBid = typeof rawBid === 'number' ? rawBid : 1;

  // Trick scenario 1: Lead
  const leadContext: PlayCardContext = {
    position: PlayerPosition.WEST,
    hand: currentHand,
    legalMoves: currentHand,
    currentTrick: {
      trickNumber: 1,
      leader: PlayerPosition.WEST,
      leadSuit: null,
      cards: [],
      winner: null,
    },
    trumpSuit: Suit.SPADES,
    playerBid: recommendedBid,
    playerTricksWon: 0,
    remainingCardsCount: { SOUTH: 13, WEST: 13, NORTH: 13, EAST: 13 },
  };
  const leadDecision: CardPlayDecision = currentStrategy.decideCardPlayWithDetails(leadContext);

  // Trick scenario 2: Following Suit (South led Heart 8)
  const followTrick: TrickState = {
    trickNumber: 2,
    leader: PlayerPosition.SOUTH,
    leadSuit: Suit.HEARTS,
    cards: [
      {
        playerPosition: PlayerPosition.SOUTH,
        card: createCard(Suit.HEARTS, Rank.EIGHT),
        playedAt: 1,
      },
    ],
    winner: null,
  };
  const followLegalMoves = rulesEngine.getLegalMoves(currentHand, followTrick, Suit.SPADES);
  const followContext: PlayCardContext = {
    position: PlayerPosition.WEST,
    hand: currentHand,
    legalMoves: followLegalMoves,
    currentTrick: followTrick,
    trumpSuit: Suit.SPADES,
    playerBid: recommendedBid,
    playerTricksWon: 0,
    remainingCardsCount: { SOUTH: 12, WEST: 13, NORTH: 13, EAST: 13 },
  };
  const followDecision: CardPlayDecision = currentStrategy.decideCardPlayWithDetails(followContext);

  const handleRunFull13TrickSim = () => {
    setIsSimulating(true);
    const logs: string[] = [];

    try {
      const store = new GameStateStore(createInitialGameState(GameMode.OFFLINE_BOTS));
      const cardEngine = new CardEngine();
      const scoringEngine = new ScoringEngine();
      const controller = new LocalGameController(store, {
        cardEngine,
        rulesEngine,
        scoringEngine,
      });

      controller.startRound();
      logs.push(`Round 1 started. Dealing complete (13 cards/player).`);

      // Bidding
      for (let i = 0; i < 4; i++) {
        const expected = rulesEngine.getExpectedBiddingPlayer(store.getState());
        if (!expected) break;
        if (expected === PlayerPosition.SOUTH) {
          controller.submitBid(PlayerPosition.SOUTH, 3);
          logs.push(`Human [SOUTH] bid: 3`);
        } else {
          controller.executeBotBid(expected);
          const bid = store.getState().players[expected].currentBid;
          logs.push(`Bot [${expected}] bid: ${bid}`);
        }
      }

      // Playing 13 tricks
      for (let t = 1; t <= 13; t++) {
        for (let c = 0; c < 4; c++) {
          const st = store.getState();
          const active = st.currentPlayer;
          const hand = st.players[active].hand;
          const legals = rulesEngine.getLegalMoves(hand, st.currentTrick, Suit.SPADES);

          if (active === PlayerPosition.SOUTH) {
            controller.playCard(PlayerPosition.SOUTH, legals[0]);
          } else {
            const decision = currentStrategy.decideCardPlay({
              position: active,
              hand,
              legalMoves: legals,
              currentTrick: st.currentTrick,
              trumpSuit: Suit.SPADES,
              playerBid: st.players[active].currentBid ?? 1,
              playerTricksWon: st.players[active].tricksWon,
              remainingCardsCount: {
                SOUTH: st.players.SOUTH.hand.length,
                WEST: st.players.WEST.hand.length,
                NORTH: st.players.NORTH.hand.length,
                EAST: st.players.EAST.hand.length,
              },
              completedTricks: st.completedTricks,
            });
            const cardToPlay = 'id' in decision ? decision : legals[0];
            controller.playCard(active, cardToPlay);
          }
        }
      }

      controller.completeRound();
      const finalState = store.getState();
      const scores = finalState.roundScores[0].scores;

      logs.push(
        `Round complete! Scores: SOUTH=${scores.SOUTH}, WEST=${scores.WEST}, NORTH=${scores.NORTH}, EAST=${scores.EAST}`
      );
      logs.push(
        `Tricks won: SOUTH=${finalState.players.SOUTH.tricksWon}, WEST=${finalState.players.WEST.tricksWon}, NORTH=${finalState.players.NORTH.tricksWon}, EAST=${finalState.players.EAST.tricksWon} (Total 13)`
      );
      setSimLog(logs);
    } catch (err: unknown) {
      logs.push(`Error in simulation: ${err instanceof Error ? err.message : String(err)}`);
      setSimLog(logs);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <section
      id="dev-bot-strategy-verification"
      className="border border-stone-800 rounded-lg p-4 bg-stone-900/60 text-xs space-y-4 text-stone-300"
    >
      <header
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-emerald-400" />
          <h4 className="text-sm font-semibold text-stone-100">
            Phase 5: Bot Intelligence & Strategy Inspector
          </h4>
          <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-[10px] text-emerald-300 font-mono">
            STRATEGY LAYER
          </span>
        </div>
        <button
          type="button"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          className="text-stone-400 hover:text-stone-200"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </header>

      {isExpanded && (
        <div className="space-y-4 pt-2">
          {/* Controls: Difficulty & Preset Hand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                Bot Difficulty
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[BotDifficulty.EASY, BotDifficulty.MEDIUM, BotDifficulty.HARD].map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setSelectedDifficulty(diff)}
                    className={`px-2 py-1.5 rounded font-mono text-[11px] border transition-colors ${
                      selectedDifficulty === diff
                        ? 'bg-emerald-950 border-emerald-600 text-emerald-200 font-semibold'
                        : 'bg-stone-800/80 border-stone-700 text-stone-400 hover:bg-stone-800'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-stone-400 mb-1">
                Hand Test Fixture
              </label>
              <select
                value={selectedPresetIndex}
                onChange={(e) => setSelectedPresetIndex(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-stone-950 border border-stone-700 rounded text-stone-200 text-xs focus:outline-none focus:border-emerald-500"
              >
                {PRESET_HANDS.map((preset, idx) => (
                  <option key={preset.label} value={idx}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Hand Evaluation Breakdown */}
          <div className="p-3 bg-stone-950/80 rounded border border-stone-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-200 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-emerald-400" />
                Hand Strength Evaluation & Bid
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-stone-400">Bid:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-700 text-emerald-200 font-bold text-sm font-mono">
                  {recommendedBid}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-stone-900 p-2 rounded border border-stone-800">
                <div className="text-stone-400 text-[10px]">Estimated Tricks</div>
                <div className="text-emerald-300 font-bold">{handEval.estimatedTricks.toFixed(2)}</div>
              </div>
              <div className="bg-stone-900 p-2 rounded border border-stone-800">
                <div className="text-stone-400 text-[10px]">Spade Strength</div>
                <div className="text-stone-200">{handEval.spadeStrength.toFixed(2)}</div>
              </div>
              <div className="bg-stone-900 p-2 rounded border border-stone-800">
                <div className="text-stone-400 text-[10px]">High Card Honors</div>
                <div className="text-stone-200">{handEval.highCardStrength.toFixed(2)}</div>
              </div>
              <div className="bg-stone-900 p-2 rounded border border-stone-800">
                <div className="text-stone-400 text-[10px]">Distribution Bonus</div>
                <div className="text-stone-200">
                  +{(handEval.lengthBonus + handEval.voidBonus).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Decision Diagnostics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Scenario 1: Leading */}
            <div className="p-3 bg-stone-950/80 rounded border border-stone-800 space-y-1.5">
              <div className="text-xs font-semibold text-stone-200 flex items-center justify-between">
                <span>Leading Trick (1st to play)</span>
                <span className="text-emerald-400 font-mono text-[10px]">TRICK 1</span>
              </div>
              <div className="text-[11px] text-stone-400">
                Play:{' '}
                <span className="font-bold text-amber-300">
                  {leadDecision.card.rank} of {leadDecision.card.suit}
                </span>
              </div>
              <div className="text-[10px] text-stone-300 italic bg-stone-900 px-2 py-1 rounded border border-stone-800">
                &ldquo;{leadDecision.reasoning}&rdquo;
              </div>
            </div>

            {/* Scenario 2: Following Suit */}
            <div className="p-3 bg-stone-950/80 rounded border border-stone-800 space-y-1.5">
              <div className="text-xs font-semibold text-stone-200 flex items-center justify-between">
                <span>Follow Lead (Table has ♥8)</span>
                <span className="text-amber-400 font-mono text-[10px]">
                  {followLegalMoves.length} Legal
                </span>
              </div>
              <div className="text-[11px] text-stone-400">
                Play:{' '}
                <span className="font-bold text-amber-300">
                  {followDecision.card.rank} of {followDecision.card.suit}
                </span>
              </div>
              <div className="text-[10px] text-stone-300 italic bg-stone-900 px-2 py-1 rounded border border-stone-800">
                &ldquo;{followDecision.reasoning}&rdquo;
              </div>
            </div>
          </div>

          {/* 13-Trick Full Simulation */}
          <div className="pt-2 border-t border-stone-800">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-stone-300">
                Automated 13-Trick Match Simulation
              </div>
              <button
                type="button"
                onClick={handleRunFull13TrickSim}
                disabled={isSimulating}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium text-xs transition-colors"
              >
                <Play className="w-3 h-3" />
                {isSimulating ? 'Simulating...' : 'Run Simulation'}
              </button>
            </div>

            {simLog.length > 0 && (
              <div className="max-h-36 overflow-y-auto font-mono text-[10px] p-2 bg-black/80 rounded border border-stone-800 text-stone-300 space-y-0.5">
                {simLog.map((log, i) => (
                  <div key={i} className="leading-tight">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
