# 04. Game Engine & Deck Management

## Deck Specification
- **Deck Composition**: Exactly 52 standard playing cards (No Jokers).
- **Suits**: 4 suits (`SPADES ♠`, `HEARTS ♥`, `DIAMONDS ♦`, `CLUBS ♣`).
- **Ranks**: 13 ranks (`TWO: 2` through `ACE: 14`).
- **Trump Suit**: `SPADES ♠` is permanently fixed as the exclusive trump suit for all rounds in Call Break.

---

## Shuffling & Dealing Engine (`src/core/deck/deckEngine.ts`, `src/core/random/prng.ts`)

1. **Deterministic Fisher-Yates Shuffle**:
   - Implemented via uniform pseudo-random number generator (`prng.ts`).
   - Supports optional deterministic seeds for test repeatability and simulation verification.

2. **Distribution Protocol**:
   - Exactly 13 cards are dealt to each of the 4 players (`SOUTH: Human`, `WEST: Bot`, `NORTH: Bot`, `EAST: Bot`).
   - Total cards distributed = 52.

3. **Dealing Animation Sequencing**:
   - Configured in `src/core/animation/animationConfig.ts`.
   - Cards are dealt in clockwise order starting from the player to the left of the dealer.
   - Dealt hand cards are staggered smoothly (35ms per card) to convey an authentic table deal feeling.

4. **Hand Sorting**:
   - The human player's hand is automatically organized by suit (`♠ Spades`, `♥ Hearts`, `♣ Clubs`, `♦ Diamonds`) and sorted in descending rank order (Ace down to 2) for immediate scanning.
