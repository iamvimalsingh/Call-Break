# 02. Architecture Overview

## Architectural Paradigm
The Call Break codebase is structured around a **Unidirectional Data Flow + Functional Core State Machine** architecture, cleanly separating game rules, AI decision-making, game coordination, storage, and presentation.

```
┌────────────────────────────────────────────────────────┐
│                   React UI View Layer                  │
│   (GameShell, GameTable, HumanHand, CenterPlayArea)    │
└───────────────────────────▲────────────────────────────┘
                            │ Subscribes to State / Dispatches Events
┌───────────────────────────┴────────────────────────────┐
│              Game Controller & State Machine           │
│           (GameController, Action Dispatcher)          │
└──────────▲──────────────────▲──────────────────▲───────┘
           │                  │                  │
┌──────────┴────────┐  ┌──────┴────────┐  ┌──────┴───────┐
│   Rules Engine    │  │ Scoring Engine│  │  Bot Engine  │
│ (Legal moves,     │  │ (Points, bids,│  │ (Heuristics, │
│  Trick evaluation)│  │  Overtricks)  │  │  Personalities)
└───────────────────┘  └───────────────┘  └──────────────┘
           │                  │                  │
┌──────────┴──────────────────┴──────────────────┴───────┐
│              Domain Models & Contracts                 │
│         (Card, Player, Trick, GameState, Events)       │
└────────────────────────────────────────────────────────┘
```

---

## Key Design Principles

1. **Pure Functional Rules Engine (`src/core/rules/`)**:
   - Evaluates trick winners, lead suit enforcement, trump priorities, and legal moves deterministically.
   - Zero side-effects; inputs are pure immutable game state snapshots.

2. **Isolated Controller & State Machine (`src/core/controller/`)**:
   - Manages asynchronous game flow: dealing, bidding, turn progression, AI delay timers, trick resolution, and round transitions.
   - Decoupled from React components via subscriber callbacks.

3. **Sealed Information Barrier for AI Bots (`src/core/bot/`)**:
   - Bots receive filtered state perspectives (`BotGameState`) containing only public board state and their own private hand.
   - No access to other players' concealed cards.

4. **Layered Persistence & Statistics (`src/core/persistence/`, `src/core/statistics/`)**:
   - Automatic game state serialization to `localStorage`.
   - Comprehensive match history, personal bests, win-rates, and bid accuracy metrics.

5. **4-Zone Viewport Responsive UI (`src/components/table/`)**:
   - Table felt divided into 4 non-overlapping viewport flex zones.
   - Sized from available viewport dimensions with mathematically derived card spacing.
