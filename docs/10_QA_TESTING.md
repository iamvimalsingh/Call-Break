# 10. QA & Automated Testing Suite

## Test Infrastructure (`src/tests/`)
The project utilizes a custom TypeScript test harness (`testHarness.ts`) and headless simulation engine (`simulationRunner.ts`) requiring zero external test framework dependencies.

---

## 1. Test Suite Breakdown (150 Unit & Integration Tests)

| Suite File | Focus Area | Cases | Status |
|---|---|---|---|
| `cardEngine.test.ts` | Deck integrity, 52 cards, unique IDs, Fisher-Yates PRNG | 15 | ✅ 15/15 Pass |
| `rulesEngine.test.ts` | Lead suit following, must-beat, trumping, legal moves | 25 | ✅ 25/25 Pass |
| `scoringEngine.test.ts` | Made bids (+0.1), broken bids (-bid), round tallying | 20 | ✅ 20/20 Pass |
| `botStrategy.test.ts` | AI bid heuristics, valid card selections, difficulty tiers | 20 | ✅ 20/20 Pass |
| `architecture.test.ts` | Information sealing, immutable state, contract boundaries | 15 | ✅ 15/15 Pass |
| `phase7Compliance.test.ts` | Official Call Break rule compliance & edge cases | 15 | ✅ 15/15 Pass |
| `phase9HistoryStats.test.ts`| Match history recording, stats calculation, aggregates | 10 | ✅ 10/10 Pass |
| `phase10SettingsTutorial.test.ts` | Audio, speed, difficulty settings, tutorial logic | 10 | ✅ 10/10 Pass |
| `phase11SaveResume.test.ts`| LocalStorage persistence, match recovery, schema safety | 10 | ✅ 10/10 Pass |
| `phase12QASimulator.test.ts`| Headless match execution, 5-round state completion | 10 | ✅ 10/10 Pass |
| **Total** | **All Core Logic & Systems** | **150** | **✅ 150/150 Pass** |

---

## 2. Headless Simulation Engine (`simulationRunner.ts`)
- Runs 50 full 5-round matches (250 rounds, 3,250 tricks) headlessly in milliseconds.
- Continuously verifies the following **Core Invariants**:
  1. `illegalBotMoves === 0`: Every bot card played strictly satisfies `RulesEngine.isMoveLegal()`.
  2. `duplicateCardViolations === 0`: No card is played twice or duplicated.
  3. `cardConservationViolations === 0`: Total cards in play + hands always equals 52.
  4. `stateTransitionViolations === 0`: State transitions strictly follow FSM lifecycle.
  5. `deadlocksTimeouts === 0`: No infinite loops or stalled turns.
  6. `doubleScoringEvents === 0`: Each round and match is scored exactly once.

---

## 3. Running Verification Commands

```bash
# Run all unit tests and 50-game QA simulation:
npx tsx -e "import { buildCompleteTestSuite } from './src/tests'; import { runCallBreakSimulation } from './src/tests/simulationRunner'; async function run() { const suite = buildCompleteTestSuite(); const res = await suite.runAll(); console.log('Tests:', res.passed, '/', res.total); const sim = runCallBreakSimulation(50); console.log('Simulation (50 games):', sim); } run();"

# Type checking / Lint:
npm run lint

# Production Build:
npm run build
```
