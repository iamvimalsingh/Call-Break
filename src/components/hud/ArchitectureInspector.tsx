/**
 * Architecture & Systems Inspector Drawer
 * Provides visibility into all 8 architectural layers, interfaces, and test runner.
 * Phase 1 Architecture Foundation
 */

import React, { useState } from 'react';
import {
  X,
  Layers,
  CheckCircle,
  Play,
  Clock,
  ShieldCheck,
  Cpu,
  Database,
  Wifi,
  ScrollText,
  Calculator,
} from 'lucide-react';
import { buildCompleteTestSuite } from '../../tests';
import { TestSuiteSummary } from '../../tests/testHarness';
import { CardEngineVerification } from '../dev/CardEngineVerification';
import { RulesEngineVerification } from '../dev/RulesEngineVerification';
import { ScoringEngineVerification } from '../dev/ScoringEngineVerification';
import { BotStrategyVerification } from '../dev/BotStrategyVerification';
import { Phase7AuditVerification } from '../dev/Phase7AuditVerification';

interface ArchitectureInspectorProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LayerDefinition {
  id: string;
  name: string;
  phase: string;
  status: 'FOUNDATION_READY' | 'NEXT_PHASE' | 'PLANNED';
  contract: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const LAYERS: LayerDefinition[] = [
  {
    id: 'layer_ui',
    name: '1. Presentation / UI Layer',
    phase: 'Phase 1',
    status: 'FOUNDATION_READY',
    contract: 'GameShell, GameTable, PlayerSlot, HUD components',
    description: 'Decoupled presentation shell. Contains zero game rules, card math, or AI logic.',
    icon: Layers,
  },
  {
    id: 'layer_controller',
    name: '2. Game Controller Layer',
    phase: 'Phase 1',
    status: 'FOUNDATION_READY',
    contract: 'IGameController, LocalGameController',
    description: 'Orchestrates match initialization, round transitions, and turn coordination.',
    icon: Cpu,
  },
  {
    id: 'layer_state',
    name: '3. Game State Layer',
    phase: 'Phase 1',
    status: 'FOUNDATION_READY',
    contract: 'IGameStateStore, GameStateStore, GameState schema',
    description: 'Centralized immutable state management. Prevents state scattering across UI components.',
    icon: ShieldCheck,
  },
  {
    id: 'layer_cards',
    name: '4. Card / Deck Engine',
    phase: 'Phase 2',
    status: 'FOUNDATION_READY',
    contract: 'ICardEngine, CardEngine, IRandomSource',
    description: '52-card deck, suits, ranks, Fisher-Yates shuffle, dealing, hand sorting. 100% offline.',
    icon: ScrollText,
  },
  {
    id: 'layer_rules',
    name: '5. Call Break Rules Engine',
    phase: 'Phase 3',
    status: 'FOUNDATION_READY',
    contract: 'IRulesEngine, CallBreakRulesEngine',
    description: 'Call/bid phase, follow-suit validation, Spades trumping, trick winner resolution, round lifecycle.',
    icon: ShieldCheck,
  },
  {
    id: 'layer_scoring',
    name: '6. Call Break Scoring Engine',
    phase: 'Phase 4',
    status: 'FOUNDATION_READY',
    contract: 'IScoringEngine, IScoringPolicy, StandardCallBreakScoringPolicy',
    description: 'Configurable game points, overtricks (+0.1), failed bid penalty (-bid), 5-round match accumulation.',
    icon: Calculator,
  },
  {
    id: 'layer_bots',
    name: '7. Bot / AI Strategy Layer',
    phase: 'Phase 5',
    status: 'FOUNDATION_READY',
    contract: 'IBotStrategy, BotStrategyFactory, MediumBotStrategy, EasyBotStrategy',
    description: 'Offline heuristic bidding, conservative hand evaluation, follow-suit/trump/discard logic, and trick management.',
    icon: Cpu,
  },
  {
    id: 'layer_persistence',
    name: '8. Persistence Layer',
    phase: 'Phase 6',
    status: 'FOUNDATION_READY',
    contract: 'IPersistenceAdapter, LocalStorageAdapter, MemoryStorageAdapter',
    description: 'Storage abstraction for save/resume, match history, and statistics.',
    icon: Database,
  },
];

export const ArchitectureInspector: React.FC<ArchitectureInspectorProps> = ({
  isOpen,
  onClose,
}) => {
  const [testSummary, setTestSummary] = useState<TestSuiteSummary | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  if (!isOpen) return null;

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const suite = buildCompleteTestSuite();
      const summary = await suite.runAll();
      setTestSummary(summary);
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div
      id="drawer-architecture-backdrop"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="drawer-architecture-panel"
        className="w-full max-w-xl bg-stone-900 border-l border-stone-800 h-full flex flex-col text-stone-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-800 flex items-center justify-between bg-stone-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Architecture & Layer Inspector</h2>
              <p className="text-xs text-stone-400">Phase 1 & Phase 2 Foundation & Card Engine</p>
            </div>
          </div>
          <button
            id="btn-close-inspector"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* Phase 2 Card & Deck Engine Diagnostics */}
          <CardEngineVerification />

          {/* Phase 3 Call Break Rules Engine Diagnostics */}
          <RulesEngineVerification />

          {/* Phase 4 Call Break Scoring Engine Diagnostics */}
          <ScoringEngineVerification />

          {/* Phase 5 Bot Intelligence & Strategy Diagnostics */}
          <BotStrategyVerification />

          {/* Phase 7 Call Break Rules Compliance & Reliability Audit */}
          <Phase7AuditVerification />

          {/* Automated Test Suite Box */}
          <div className="p-4 rounded-xl bg-stone-950 border border-stone-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Automated Architecture, Deck, Rules, Scoring & Bot Test Suite
                </h3>
                <p className="text-xs text-stone-400">
                  Runs automated tests verifying contracts, 52-card deck, shuffle, dealing, 1–13 bidding range, follow-suit rules, trick resolution, scoring calculations, and bot intelligence strategy.
                </p>
              </div>
              <button
                id="btn-run-tests"
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {isRunningTests ? 'Testing...' : 'Run Tests'}
              </button>
            </div>

            {testSummary && (
              <div className="mt-3 pt-3 border-t border-stone-800/80 space-y-2.5">
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {testSummary.passed} Passed
                  </span>
                  {testSummary.failed > 0 && (
                    <span className="text-red-400 font-semibold">{testSummary.failed} Failed</span>
                  )}
                  <span className="text-stone-400 font-mono text-[11px] ml-auto">
                    {testSummary.totalDurationMs} ms
                  </span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {testSummary.results.map((r) => (
                    <div
                      key={r.id}
                      className="p-2 rounded-lg bg-stone-900/80 border border-stone-800 flex items-start justify-between text-xs"
                    >
                      <div>
                        <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-stone-800 text-stone-400 mr-1.5">
                          {r.category}
                        </span>
                        <span className="text-stone-300 font-medium">{r.description}</span>
                      </div>
                      <span className="text-emerald-400 text-[11px] font-mono shrink-0 ml-2">
                        {r.durationMs}ms ✓
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 8 Architectural Layers Specification */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              8 Core Architectural Layers
            </h3>

            <div className="space-y-2.5">
              {LAYERS.map((layer) => {
                const Icon = layer.icon;
                const isReady = layer.status === 'FOUNDATION_READY';
                const isNext = layer.status === 'NEXT_PHASE';

                return (
                  <div
                    key={layer.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isReady
                        ? 'bg-stone-950/60 border-stone-800'
                        : isNext
                        ? 'bg-emerald-950/20 border-emerald-800/50'
                        : 'bg-stone-950/30 border-stone-800/50 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${isNext ? 'text-emerald-400' : 'text-stone-400'}`} />
                        <span className="text-xs sm:text-sm font-semibold text-white">{layer.name}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-medium ${
                          isReady
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            : isNext
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                            : 'bg-stone-800 text-stone-400 border border-stone-700'
                        }`}
                      >
                        {layer.phase}
                      </span>
                    </div>

                    <p className="text-xs text-stone-400 mb-2 leading-relaxed">{layer.description}</p>

                    <div className="text-[11px] font-mono text-stone-500 bg-stone-900/80 px-2 py-1 rounded border border-stone-800 truncate">
                      Contract: <span className="text-stone-300">{layer.contract}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800 bg-stone-950 flex items-center justify-between">
          <span className="text-xs text-stone-400">Call Break (Lakdi) • Clean Architecture</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-stone-800 hover:bg-stone-700 text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
