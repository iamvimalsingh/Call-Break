/**
 * Central Browser-Safe Test Suite Registry
 * Aggregates client-side Architecture, Card Engine, Rules Engine, Scoring, Bot Strategy, and offline flow tests.
 * STRICTLY BROWSER-SAFE: Contains zero server or database imports so no server/db code enters the Vite client bundle.
 */

import { TestHarness } from './testHarness';
import { buildArchitectureTestSuite } from './architecture.test';
import { buildCardEngineTestSuite } from './cardEngine.test';
import { buildRulesEngineTestSuite } from './rulesEngine.test';
import { buildScoringEngineTestSuite } from './scoringEngine.test';
import { buildBotStrategyTestSuite } from './botStrategy.test';
import { buildOfflineGameFlowTestSuite } from './offlineGameFlow.test';
import { buildPhase7ComplianceTestSuite } from './phase7Compliance.test';
import { buildPhase9HistoryStatsTestSuite } from './phase9HistoryStats.test';
import { buildPhase10SettingsTutorialTestSuite } from './phase10SettingsTutorial.test';
import { buildPhase11SaveResumeTestSuite } from './phase11SaveResume.test';
import { buildPhase12QASimulatorTestSuite } from './phase12QASimulator.test';
import { buildPhase14NetlifyPWATestSuite } from './phase14NetlifyPWA.test';
import { buildSoloWeightedDealTestSuite } from './soloWeightedDeal.test';
import { buildPreferredRoomIdTestSuite } from './preferredRoomIdStorage.test';
import { buildPlayerSeatPrefixTestSuite } from './playerSeatPrefix.test';

export function buildCompleteTestSuite(): TestHarness {
  const composite = new TestHarness();
  composite.include(buildArchitectureTestSuite());
  composite.include(buildCardEngineTestSuite());
  composite.include(buildRulesEngineTestSuite());
  composite.include(buildScoringEngineTestSuite());
  composite.include(buildBotStrategyTestSuite());
  composite.include(buildOfflineGameFlowTestSuite());
  composite.include(buildPhase7ComplianceTestSuite());
  composite.include(buildPhase9HistoryStatsTestSuite());
  composite.include(buildPhase10SettingsTutorialTestSuite());
  composite.include(buildPhase11SaveResumeTestSuite());
  composite.include(buildPhase12QASimulatorTestSuite());
  composite.include(buildPhase14NetlifyPWATestSuite());
  composite.include(buildSoloWeightedDealTestSuite());
  composite.include(buildPreferredRoomIdTestSuite());
  composite.include(buildPlayerSeatPrefixTestSuite());
  return composite;
}

export { buildArchitectureTestSuite } from './architecture.test';
export { buildCardEngineTestSuite } from './cardEngine.test';
export { buildRulesEngineTestSuite } from './rulesEngine.test';
export { buildScoringEngineTestSuite } from './scoringEngine.test';
export { buildBotStrategyTestSuite } from './botStrategy.test';
export { buildOfflineGameFlowTestSuite } from './offlineGameFlow.test';
export { buildPhase7ComplianceTestSuite } from './phase7Compliance.test';
export { buildPhase9HistoryStatsTestSuite } from './phase9HistoryStats.test';
export { buildPhase10SettingsTutorialTestSuite } from './phase10SettingsTutorial.test';
export { buildPhase11SaveResumeTestSuite } from './phase11SaveResume.test';
export { buildPhase12QASimulatorTestSuite } from './phase12QASimulator.test';
export { buildPhase14NetlifyPWATestSuite } from './phase14NetlifyPWA.test';
export { buildSoloWeightedDealTestSuite } from './soloWeightedDeal.test';
export { buildPreferredRoomIdTestSuite } from './preferredRoomIdStorage.test';
export { buildPlayerSeatPrefixTestSuite } from './playerSeatPrefix.test';
export * from './testHarness';
