# 14. Spark Developer Handoff

## Quick Reference for Successor Engineers

### 1. Architectural Invariants (DO NOT BREAK)
1. **Zero UI-to-Rules Coupling**: Never import React or UI components into `src/core/rules/`, `src/core/deck/`, or `src/core/scoring/`. The core logic must remain pure TypeScript.
2. **Deterministic Information Barrier**: Never expose `PlayerState.hand` of other players to `BotEngine`. Bots must only observe public cards and their own hand.
3. **4-Zone Viewport Sizing**: In `GameTable.tsx`, the game table layout is strictly partitioned into:
   - `#zone-north-player`
   - `#zone-middle-play` (with `CenterPlayArea` constrained by viewport height)
   - `#zone-south-container`
   - `#zone-hand` (with dynamic overlap scaling)
   Never add arbitrary hardcoded vertical pixel offsets that push the hand into the footer HUD.

---

### 2. Common Operations

| Task | Location / Command |
|---|---|
| **Run All Unit Tests** | `npx tsx -e "import { buildCompleteTestSuite } from './src/tests'; buildCompleteTestSuite().runAll().then(r => console.log(r));"` |
| **Run 50-Game QA Sim** | `npx tsx -e "import { runCallBreakSimulation } from './src/tests/simulationRunner'; console.log(runCallBreakSimulation(50));"` |
| **Check TypeScript Lint**| `npm run lint` |
| **Build Production** | `npm run build` |
| **Modify Bot Heuristics**| `src/core/bot/botStrategies.ts` & `src/core/bot/botProfiles.ts` |
| **Modify Scoring Rules** | `src/core/scoring/scoringEngine.ts` |
| **Adjust Table Sizing** | `src/components/table/GameTable.tsx` & `src/components/table/CenterPlayArea.tsx` |

---

### 3. State Invariants to Preserve
- Match always consists of 5 rounds (`RoundState.roundNumber` 1 through 5).
- Round always deals 52 cards across 4 players (13 each).
- Round always conducts 13 tricks of 4 cards each.
- Spades is the invariant Trump suit.
