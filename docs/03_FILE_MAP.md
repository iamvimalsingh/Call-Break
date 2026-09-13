# 03. Source File Map

```
/
├── public/
│   ├── favicon.svg               # Game favicon asset
│   ├── icon-192.png              # PWA manifest icons
│   ├── icon-512.png
│   ├── manifest.json             # PWA Web App Manifest
│   └── sw.js                     # Offline caching Service Worker
│
├── src/
│   ├── App.tsx                   # Top-level React mount & screen router
│   ├── main.tsx                  # React DOM entry point
│   ├── index.css                 # Tailwind CSS styles & font declarations
│   │
│   ├── models/                   # Domain types, interfaces & constants
│   │   ├── card.ts               # Suit, Rank, Card interfaces & configurations
│   │   ├── player.ts             # PlayerPosition, PlayerState, PlayerType
│   │   ├── gameState.ts          # GameStatus, RoundState, Trick, MatchState
│   │   ├── events.ts             # GameEvent types for controller messaging
│   │   └── index.ts              # Central models export barrel
│   │
│   ├── core/                     # Core Business Logic (Framework-Agnostic)
│   │   ├── animation/            # Animation curves, deal configs, reduced-motion hook
│   │   │   ├── animationConfig.ts
│   │   │   └── useReducedMotion.ts
│   │   ├── bot/                  # AI decision engines & personality strategies
│   │   │   ├── botEngine.ts      # Primary Bot Brain (Bid & Card selection)
│   │   │   ├── botStrategies.ts  # Heuristic algorithms (lead, follow, trumping)
│   │   │   └── botProfiles.ts    # Aggressive, Conservative, Balanced profiles
│   │   ├── contracts/            # Core system interfaces & contracts
│   │   ├── controller/           # Game orchestrator & asynchronous state machine
│   │   │   ├── GameController.ts # Turn coordinator, AI loop, round advancement
│   │   │   └── useGameEngine.ts  # React hook wrapping GameController
│   │   ├── deck/                 # Deck factory, card comparison & validation
│   │   │   └── deckEngine.ts
│   │   ├── history/              # Match & Round history tracking
│   │   │   └── historyManager.ts
│   │   ├── persistence/          # LocalStorage save/load/clear serialization
│   │   │   └── persistenceManager.ts
│   │   ├── random/               # Seedable PRNG & Fisher-Yates shuffle
│   │   │   └── prng.ts
│   │   ├── rules/                # Pure Call Break rules validation engine
│   │   │   └── rulesEngine.ts
│   │   ├── scoring/              # Call Break scoring (+bid, +0.1, -bid) engine
│   │   │   └── scoringEngine.ts
│   │   ├── settings/             # Game audio, animation speed & difficulty config
│   │   │   └── settingsManager.ts
│   │   ├── sound/                # Web Audio API procedural sound synthesizer
│   │   │   └── SoundManager.ts
│   │   ├── state/                # Immutable state update helpers
│   │   │   └── stateFactory.ts
│   │   └── statistics/           # Lifetime game, win rate & trick analytics
│   │       └── statisticsManager.ts
│   │
│   ├── components/               # React Presentation & UI Components
│   │   ├── common/               # Modal, Button, Badge generic components
│   │   ├── dev/                  # Development QA debug panel
│   │   ├── history/              # Match History viewer & round breakdown
│   │   ├── hud/                  # TableTopBar, BottomHUD, TurnIndicators
│   │   ├── layout/               # GameShell, Responsive Canvas wrapper
│   │   ├── pwa/                  # PWA offline indicator & install prompt banner
│   │   ├── settings/             # Settings dialog (Audio, Speed, AI Level)
│   │   ├── statistics/           # Statistics modal (Win rates, bids, charts)
│   │   ├── table/                # Core Playing Table Viewport
│   │   │   ├── GameTable.tsx     # 4-zone responsive table layout container
│   │   │   ├── CenterPlayArea.tsx# Circular trick arena & winner announcement
│   │   │   ├── PlayerSlot.tsx    # Player avatars, dealer token, trick count
│   │   │   ├── HumanHand.tsx     # 13-card hand tray with dynamic overlap
│   │   │   ├── CardView.tsx      # Authentic SVG/CSS card renderer
│   │   │   └── BiddingControls.tsx # 1-13 call selector
│   │   └── tutorial/             # Interactive Rules & Strategy guide
│   │
│   └── tests/                    # Automated Test Harness & Suites
│       ├── testHarness.ts        # Custom fast zero-dep unit test runner
│       ├── simulationRunner.ts   # 50-game automated headless QA simulator
│       ├── cardEngine.test.ts    # Deck, shuffling & validation tests
│       ├── rulesEngine.test.ts   # Suit following, trumping & legal moves tests
│       ├── scoringEngine.test.ts # Points, overtricks & match victory tests
│       ├── botStrategy.test.ts   # AI bidding & play legality tests
│       ├── architecture.test.ts  # Layer boundary & encapsulation tests
│       └── index.ts              # Master test suite runner
│
├── netlify.toml                  # Netlify production headers & redirects
├── package.json                  # Dependencies & scripts
└── vite.config.ts                # Vite build & bundler configuration
```
