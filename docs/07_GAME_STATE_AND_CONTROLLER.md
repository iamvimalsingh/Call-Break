# 07. Game State & Controller State Machine

## Finite State Machine Lifecycle (`src/core/controller/GameController.ts`)

```
               ┌──────────────┐
               │     IDLE     │
               └──────┬───────┘
                      │ startNewMatch() / startNewRound()
                      ▼
               ┌──────────────┐
               │   DEALING    │ (52 cards dealt to 4 players)
               └──────┬───────┘
                      │ Cards distributed
                      ▼
               ┌──────────────┐
        ┌─────►│   BIDDING    │ (Clockwise bids 1–13 from dealer+1)
        │      └──────┬───────┘
        │             │ All 4 bids placed
        │             ▼
        │      ┌──────────────┐
        │ ┌───►│   PLAYING    │ (Trick in progress: 4 cards played)
        │ │    └──────┬───────┘
        │ │           │ 4th card played to trick
        │ │           ▼
        │ │    ┌──────────────────┐
        │ └───-┤ TRICK_RESOLUTION │ (Award trick to winner, pause 1.2s)
        │      └──────┬───────────┘
        │             │ 13th trick completed
        │             ▼
        │      ┌──────────────────┐
        │      │ ROUND_RESOLUTION │ (Calculate points, update scorecards)
        │      └──────┬───────────┘
        │             │ Round < 5
        └─────────────┤
                      │ Round == 5 completed
                      ▼
               ┌──────────────┐
               │  MATCH_OVER  │ (Tally final results, crown Champion)
               └──────────────┘
```

---

## Asynchronous Flow & Bot Delays

1. **Turn Coordinator**:
   - Evaluates `state.currentPlayer`. If human (`SOUTH`), enables user interaction in `HumanHand.tsx` or `BiddingControls.tsx`.
   - If bot (`WEST`, `NORTH`, `EAST`), schedules asynchronous decision with configured thinking delay (400ms – 900ms depending on animation speed setting).

2. **Action Dispatcher**:
   - `submitBid(playerPos, bid)`: Validates and applies player's bid.
   - `playCard(playerPos, card)`: Verifies legality via `RulesEngine`, appends to `currentTrick`, emits sound event, and advances to next turn.
   - `resolveTrick()`: Determines trick winner, awards count, displays winner badge, and sets lead player for next trick.
   - `advanceToNextRound()`: Rotates dealer, shuffles, and resets trick counts.

3. **Event Subscription**:
   - React components subscribe via `useGameEngine()` hook.
   - State updates trigger instant re-renders with no mutable state leakage.
