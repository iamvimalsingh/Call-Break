# 05. Rules & Scoring Engine

## Call Break Rules (`src/core/rules/rulesEngine.ts`)

### 1. Lead Suit & Play Rules
1. **Leading a Trick**: The lead player may play any legal card in their hand.
2. **Mandatory Lead Suit Following**:
   - If a player holds one or more cards matching the lead suit, they **MUST** play a card of that lead suit.
3. **Must-Beat in Lead Suit**:
   - When following the lead suit, if the player holds a card of that suit with a higher rank than the current highest lead-suit card on the table, they **MUST** play a higher card (if available in their hand).
4. **Trumping (Playing Spades)**:
   - If a player has **no cards** of the lead suit:
     - They must play a Spade (trump card) if they possess one.
     - If Spades have already been played to the trick, they must play a higher Spade than the current highest Spade if capable.
5. **Discarding**:
   - If a player has neither lead suit cards nor Spades, they may discard any arbitrary card from any other suit (which cannot win the trick).

### 2. Trick Winner Evaluation
- If any Spades (trump) were played: The highest-ranking Spade card wins the trick.
- If no Spades were played: The highest-ranking card of the lead suit wins the trick.
- The trick winner leads the subsequent trick.

---

## Scoring Engine (`src/core/scoring/scoringEngine.ts`)

### South Asian Standard Rules
- **Round Bidding**: Each player makes an initial call/bid between **1 and 13** tricks based on their dealt 13-card hand. (Total table bid typically ranges from 8 to 12).
- **Made / Exceeded Bid**:
  $$\text{Score} = \text{Bid} + (\text{Tricks Won} - \text{Bid}) \times 0.1$$
  *Example*: A player bids 3 and wins 5 tricks $\rightarrow 3 + (5 - 3) \times 0.1 = +3.2$ points.
- **Failed Bid (Undertrick)**:
  $$\text{Score} = -\text{Bid}$$
  *Example*: A player bids 4 and wins 3 tricks $\rightarrow -4.0$ points.

### Match Victory (5 Rounds)
- A full match spans **5 consecutive rounds**.
- The dealer token advances clockwise after each round.
- Cumulative match scores are tallied across all 5 rounds. The player with the highest total points at the conclusion of Round 5 is declared the Match Winner.
