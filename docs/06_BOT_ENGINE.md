# 06. Bot Engine & AI Heuristics

## Overview (`src/core/bot/`)
The game features 3 autonomous AI bots occupying the West, North, and East seats. The bots operate under strict zero-cheating constraints: they have access only to their own dealt hand and public table cards (played cards, trick history, bids).

---

## 1. Bot Personalities (`src/core/bot/botProfiles.ts`)

| Personality | Seat (Default) | Play Style Characteristics |
|---|---|---|
| **Aggressive (Shark)** | North | Bids high on strong suits, aggressively trumps high to secure tricks early, drives trump depletion. |
| **Conservative (Shield)**| West | Bids cautiously, preserves trumps for endgame, avoids risking marginal overtricks. |
| **Balanced (Tactician)** | East | Calculates probability-based trick expectations, balances trump retention with tempo. |

---

## 2. Bidding Algorithm (`src/core/bot/botEngine.ts`)

Bids are calculated using a weighted heuristic:
1. **High Card Power (Aces & Kings)**: Aces add $+1.0$ expected trick, protected Kings add $+0.75$ trick, Queens add $+0.5$ if supported.
2. **Spade Trump Strength**: High Spades (A, K, Q, J) and length bonuses for 4+ Spades.
3. **Suit Shortness / Void Power**: Voids in non-Spade suits provide $+0.8$ trick due to early ruffing potential; singletons add $+0.4$.
4. **Personality Bias Adjustment**: Applied to round bid up/down depending on difficulty level (Easy, Medium, Hard). Minimum allowed bid is always 1.

---

## 3. Trick Play Heuristics (`src/core/bot/botStrategies.ts`)

1. **When Leading**:
   - High card cash-out (leading Ace of a solid suit to lock in tricks).
   - Long-suit establishment to exhaust opponents.
   - Low spade lead when partner/tempo control is desired.
2. **When Following Suit**:
   - Winning cheaply (playing the lowest winning card that beats current highest).
   - Ducking (playing the lowest card when winning is impossible or disadvantageous).
3. **When Trumping (Ruffing)**:
   - Overtrumping opponents with minimum necessary Spade rank.
   - Throwing away useless low off-suit cards if overtrumping requires sacrificing an Ace of Spades.
4. **Rule Enforcement Guarantee**:
   - All AI decisions are filtered through `RulesEngine.getLegalMoves()`. It is mathematically impossible for a bot to emit an illegal move.
