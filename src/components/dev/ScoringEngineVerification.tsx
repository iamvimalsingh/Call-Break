/**
 * Phase 4 Call Break Scoring Engine Development Verification Component
 * Developer diagnostic panel for interactive testing of:
 * - Single-player bid & tricksWon evaluation (overtricks vs failed-bid penalties)
 * - Standard Call Break scoring policy vs configurable custom policy
 * - 4-player round score calculation (tricks sum = 13)
 * - 5-round match score accumulation and tie detection
 * Development-only diagnostic panel.
 */

import React, { useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PlayerPosition } from '../../models/player';
import {
  ScoringEngine,
  StandardCallBreakScoringPolicy,
  ConfigurableScoringPolicy,
} from '../../core/scoring';
import { RoundScoringInput } from '../../core/contracts/IScoringEngine';

export const ScoringEngineVerification: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Single player tester
  const [testBid, setTestBid] = useState<number>(4);
  const [testTricks, setTestTricks] = useState<number>(5);
  const [overtrickWeight, setOvertrickWeight] = useState<number>(0.1);

  // Round simulation state
  const [roundScoresLog, setRoundScoresLog] = useState<string[]>([]);
  const [lastRoundResult, setLastRoundResult] = useState<{
    roundNumber: number;
    scores: Record<string, { bid: number; tricks: number; score: number; cumulative: number }>;
  } | null>(null);

  const engine = new ScoringEngine(
    new ConfigurableScoringPolicy({
      overtrickValue: overtrickWeight,
    })
  );

  const calculateQuickScore = (b: number, t: number): number => {
    try {
      return engine.calculatePlayerScore(b, t);
    } catch {
      return 0;
    }
  };

  const handleSimulateFourPlayerRound = () => {
    try {
      const input: RoundScoringInput = {
        roundNumber: 1,
        playerResults: [
          { position: PlayerPosition.SOUTH, bid: 4, tricksWon: 5 }, // 4.1
          { position: PlayerPosition.WEST, bid: 3, tricksWon: 2 },  // -3.0
          { position: PlayerPosition.NORTH, bid: 3, tricksWon: 3 }, // 3.0
          { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },  // 3.0
        ],
        previousCumulativeScores: {
          [PlayerPosition.SOUTH]: 0,
          [PlayerPosition.WEST]: 0,
          [PlayerPosition.NORTH]: 0,
          [PlayerPosition.EAST]: 0,
        },
      };

      const record = engine.calculateRoundScores(input);
      const snapshot: Record<string, { bid: number; tricks: number; score: number; cumulative: number }> = {};
      const logs: string[] = ['Calculated 4-Player Round 1 Scores:'];

      for (const pos of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
        const item = record.scores[pos];
        snapshot[pos] = {
          bid: item.bid,
          tricks: item.tricksWon,
          score: item.roundScore,
          cumulative: item.cumulativeScore,
        };
        logs.push(
          `✓ ${pos}: Bid ${item.bid}, Won ${item.tricksWon} tricks → Score ${item.roundScore > 0 ? '+' : ''}${item.roundScore} (Total: ${item.cumulativeScore})`
        );
      }

      setLastRoundResult({ roundNumber: 1, scores: snapshot });
      setRoundScoresLog(logs);
    } catch (err: any) {
      setRoundScoresLog([`Error: ${err.message}`]);
    }
  };

  const handleSimulateFiveRoundMatch = () => {
    try {
      let cumulative: Record<PlayerPosition, number> = {
        [PlayerPosition.SOUTH]: 0,
        [PlayerPosition.WEST]: 0,
        [PlayerPosition.NORTH]: 0,
        [PlayerPosition.EAST]: 0,
      };

      const rounds = [
        [
          { position: PlayerPosition.SOUTH, bid: 4, tricksWon: 5 },
          { position: PlayerPosition.WEST, bid: 3, tricksWon: 2 },
          { position: PlayerPosition.NORTH, bid: 3, tricksWon: 3 },
          { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },
        ],
        [
          { position: PlayerPosition.SOUTH, bid: 3, tricksWon: 4 },
          { position: PlayerPosition.WEST, bid: 4, tricksWon: 4 },
          { position: PlayerPosition.NORTH, bid: 2, tricksWon: 2 },
          { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },
        ],
        [
          { position: PlayerPosition.SOUTH, bid: 2, tricksWon: 2 },
          { position: PlayerPosition.WEST, bid: 3, tricksWon: 3 },
          { position: PlayerPosition.NORTH, bid: 5, tricksWon: 5 },
          { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },
        ],
        [
          { position: PlayerPosition.SOUTH, bid: 5, tricksWon: 5 },
          { position: PlayerPosition.WEST, bid: 2, tricksWon: 1 },
          { position: PlayerPosition.NORTH, bid: 3, tricksWon: 4 },
          { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },
        ],
        [
          { position: PlayerPosition.SOUTH, bid: 3, tricksWon: 3 },
          { position: PlayerPosition.WEST, bid: 3, tricksWon: 3 },
          { position: PlayerPosition.NORTH, bid: 4, tricksWon: 4 },
          { position: PlayerPosition.EAST, bid: 3, tricksWon: 3 },
        ],
      ];

      const records = [];
      const logs: string[] = ['5-Round Match Simulation:'];

      for (let r = 1; r <= 5; r++) {
        const record = engine.calculateRoundScores({
          roundNumber: r,
          playerResults: rounds[r - 1],
          previousCumulativeScores: cumulative,
        });
        records.push(record);

        for (const pos of [PlayerPosition.SOUTH, PlayerPosition.WEST, PlayerPosition.NORTH, PlayerPosition.EAST]) {
          cumulative[pos] = record.scores[pos].cumulativeScore;
        }
        logs.push(
          `Round ${r} complete: SOUTH=${cumulative.SOUTH}, WEST=${cumulative.WEST}, NORTH=${cumulative.NORTH}, EAST=${cumulative.EAST}`
        );
      }

      const matchResult = engine.calculateMatchResult(cumulative, records);
      logs.push(
        `✓ Match Final: Winner = ${matchResult.winnerPosition} (${matchResult.rankings[0].score} pts), Tie = ${matchResult.isTie}`
      );
      setRoundScoresLog(logs);
    } catch (err: any) {
      setRoundScoresLog([`Error: ${err.message}`]);
    }
  };

  const handleSimulateTie = () => {
    try {
      const tiedScores: Record<PlayerPosition, number> = {
        [PlayerPosition.SOUTH]: 15.2,
        [PlayerPosition.WEST]: 8.0,
        [PlayerPosition.NORTH]: 11.0,
        [PlayerPosition.EAST]: 15.2, // Tied!
      };
      const res = engine.calculateMatchResult(tiedScores);
      setRoundScoresLog([
        'Tie Demonstration Scenario:',
        `SOUTH: 15.2, EAST: 15.2 (Equal Highest)`,
        `✓ isTie: ${res.isTie}`,
        `✓ winnerPositions: [${res.winnerPositions.join(', ')}]`,
        `✓ Standard ranking: Rank 1 shared between ${res.winnerPositions.join(' and ')}`,
      ]);
    } catch (err: any) {
      setRoundScoresLog([`Error: ${err.message}`]);
    }
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 my-3 text-stone-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-stone-100">
            Phase 4 Scoring Engine Live Verification
          </h3>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800">
            Active
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
          title="Toggle Details"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4 text-xs">
          {/* Interactive Single-Player Calculator */}
          <div className="bg-stone-950 p-3 rounded-lg border border-stone-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-stone-400 font-medium">Interactive Single-Player Point Calculator</span>
              <span className="text-[11px] font-mono text-stone-500">
                Formula: {testTricks >= testBid ? `Bid + (Tricks - Bid) × ${overtrickWeight}` : `-Bid`}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-center">
              <div>
                <label className="text-[10px] text-stone-500 uppercase block">Bid (1-13)</label>
                <input
                  type="number"
                  min={1}
                  max={13}
                  value={testBid}
                  onChange={(e) => setTestBid(Math.max(1, Math.min(13, parseInt(e.target.value) || 1)))}
                  className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-stone-500 uppercase block">Tricks Won (0-13)</label>
                <input
                  type="number"
                  min={0}
                  max={13}
                  value={testTricks}
                  onChange={(e) => setTestTricks(Math.max(0, Math.min(13, parseInt(e.target.value) || 0)))}
                  className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-stone-500 uppercase block">Overtrick Weight</label>
                <select
                  value={overtrickWeight}
                  onChange={(e) => setOvertrickWeight(parseFloat(e.target.value))}
                  className="w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value={0.1}>0.1 (Standard)</option>
                  <option value={0.2}>0.2 (Custom)</option>
                  <option value={0.5}>0.5 (High)</option>
                </select>
              </div>

              <div className="bg-stone-900/90 p-2 rounded border border-stone-800 text-center">
                <span className="text-[10px] text-stone-500 block uppercase">Game Points</span>
                <span
                  className={`text-sm font-mono font-bold ${
                    testTricks >= testBid ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {calculateQuickScore(testBid, testTricks) > 0 ? '+' : ''}
                  {calculateQuickScore(testBid, testTricks).toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Simulation Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={handleSimulateFourPlayerRound}
              className="px-3 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-400" />
              <span>Score 4-Player Round</span>
            </button>

            <button
              onClick={handleSimulateFiveRoundMatch}
              className="px-3 py-2 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Simulate 5-Round Match</span>
            </button>

            <button
              onClick={handleSimulateTie}
              className="px-3 py-2 rounded-lg bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 border border-amber-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Test Tie Resolution</span>
            </button>
          </div>

          {/* Diagnostic Execution Log */}
          {roundScoresLog.length > 0 && (
            <div className="bg-stone-950 p-3 rounded-lg border border-stone-800 font-mono text-[11px] text-stone-300 space-y-1">
              <div className="text-stone-500 text-[10px] uppercase font-bold tracking-wider mb-1">
                Scoring Engine Diagnostic Log
              </div>
              {roundScoresLog.map((log, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{log}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
