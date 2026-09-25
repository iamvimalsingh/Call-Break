// server.ts
import dotenv from "dotenv";
import express2 from "express";
import http2 from "http";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";

// server/src/index.ts
import http from "http";
import express from "express";
import { WebSocketServer, WebSocket as WebSocket2 } from "ws";

// server/src/RoomManager.ts
import { WebSocket } from "ws";

// src/models/player.ts
var PlayerPosition = /* @__PURE__ */ ((PlayerPosition4) => {
  PlayerPosition4["SOUTH"] = "SOUTH";
  PlayerPosition4["WEST"] = "WEST";
  PlayerPosition4["NORTH"] = "NORTH";
  PlayerPosition4["EAST"] = "EAST";
  return PlayerPosition4;
})(PlayerPosition || {});
var CLOCKWISE_PLAYER_ORDER = Object.freeze([
  "SOUTH" /* SOUTH */,
  "WEST" /* WEST */,
  "NORTH" /* NORTH */,
  "EAST" /* EAST */
]);
var COUNTER_CLOCKWISE_PLAYER_ORDER = Object.freeze([
  "SOUTH" /* SOUTH */,
  "EAST" /* EAST */,
  "NORTH" /* NORTH */,
  "WEST" /* WEST */
]);

// src/models/card.ts
var Suit = /* @__PURE__ */ ((Suit3) => {
  Suit3["SPADES"] = "SPADES";
  Suit3["HEARTS"] = "HEARTS";
  Suit3["DIAMONDS"] = "DIAMONDS";
  Suit3["CLUBS"] = "CLUBS";
  return Suit3;
})(Suit || {});
var Rank = /* @__PURE__ */ ((Rank2) => {
  Rank2["TWO"] = "2";
  Rank2["THREE"] = "3";
  Rank2["FOUR"] = "4";
  Rank2["FIVE"] = "5";
  Rank2["SIX"] = "6";
  Rank2["SEVEN"] = "7";
  Rank2["EIGHT"] = "8";
  Rank2["NINE"] = "9";
  Rank2["TEN"] = "10";
  Rank2["JACK"] = "J";
  Rank2["QUEEN"] = "Q";
  Rank2["KING"] = "K";
  Rank2["ACE"] = "A";
  return Rank2;
})(Rank || {});
var RANK_VALUES = Object.freeze({
  ["2" /* TWO */]: 2,
  ["3" /* THREE */]: 3,
  ["4" /* FOUR */]: 4,
  ["5" /* FIVE */]: 5,
  ["6" /* SIX */]: 6,
  ["7" /* SEVEN */]: 7,
  ["8" /* EIGHT */]: 8,
  ["9" /* NINE */]: 9,
  ["10" /* TEN */]: 10,
  ["J" /* JACK */]: 11,
  ["Q" /* QUEEN */]: 12,
  ["K" /* KING */]: 13,
  ["A" /* ACE */]: 14
});
var SUIT_CONFIG = Object.freeze({
  ["SPADES" /* SPADES */]: {
    name: "Spades",
    symbol: "\u2660",
    color: "BLACK" /* BLACK */,
    isDefaultTrump: true
  },
  ["HEARTS" /* HEARTS */]: {
    name: "Hearts",
    symbol: "\u2665",
    color: "RED" /* RED */,
    isDefaultTrump: false
  },
  ["DIAMONDS" /* DIAMONDS */]: {
    name: "Diamonds",
    symbol: "\u2666",
    color: "RED" /* RED */,
    isDefaultTrump: false
  },
  ["CLUBS" /* CLUBS */]: {
    name: "Clubs",
    symbol: "\u2663",
    color: "BLACK" /* BLACK */,
    isDefaultTrump: false
  }
});

// src/core/random/IRandomSource.ts
var CryptoRandomSource = class {
  constructor() {
    this.uint32Buffer = new Uint32Array(1);
  }
  next() {
    const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : null;
    if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
      cryptoObj.getRandomValues(this.uint32Buffer);
      return this.uint32Buffer[0] / (4294967295 + 1);
    }
    return Math.random();
  }
  nextInt(min, max) {
    if (min > max) {
      throw new Error(`Invalid range: min (${min}) cannot be greater than max (${max})`);
    }
    if (min === max) {
      return min;
    }
    const range = max - min + 1;
    return min + Math.floor(this.next() * range);
  }
};
var DeterministicRandomSource = class {
  constructor(seed = 123456789) {
    this.initialSeed = Math.floor(seed);
    this.state = this.initialSeed >>> 0;
    if (this.state === 0) {
      this.state = 1831565813;
    }
  }
  getSeed() {
    return this.initialSeed;
  }
  reset(seed) {
    const s = seed !== void 0 ? Math.floor(seed) : this.initialSeed;
    this.state = s >>> 0;
    if (this.state === 0) {
      this.state = 1831565813;
    }
  }
  next() {
    let z = this.state += 1831565813;
    z = Math.imul(z ^ z >>> 15, z | 1);
    z ^= z + Math.imul(z ^ z >>> 7, z | 61);
    this.state = z >>> 0;
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  }
  nextInt(min, max) {
    if (min > max) {
      throw new Error(`Invalid range: min (${min}) cannot be greater than max (${max})`);
    }
    if (min === max) {
      return min;
    }
    const range = max - min + 1;
    return min + Math.floor(this.next() * range);
  }
};

// src/core/deck/cardUtils.ts
var CardValidationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "CardValidationError";
  }
};
function sortHand(hand) {
  if (!hand || !Array.isArray(hand)) {
    return Object.freeze([]);
  }
  const suitPriority = {
    ["SPADES" /* SPADES */]: 0,
    ["HEARTS" /* HEARTS */]: 1,
    ["DIAMONDS" /* DIAMONDS */]: 2,
    ["CLUBS" /* CLUBS */]: 3
  };
  const sorted = [...hand].sort((a, b) => {
    const suitDiff = suitPriority[a.suit] - suitPriority[b.suit];
    if (suitDiff !== 0) {
      return suitDiff;
    }
    return b.value - a.value;
  });
  return Object.freeze(sorted);
}
function getCardId(suit, rank) {
  return `${suit}_${rank}`;
}
function createCard(suit, rank) {
  if (!isValidSuit(suit)) {
    throw new CardValidationError(`Invalid card suit: "${String(suit)}"`);
  }
  if (!isValidRank(rank)) {
    throw new CardValidationError(`Invalid card rank: "${String(rank)}"`);
  }
  const value = RANK_VALUES[rank];
  return Object.freeze({
    id: getCardId(suit, rank),
    suit,
    rank,
    value
  });
}
function isValidSuit(suit) {
  return typeof suit === "string" && Object.values(Suit).includes(suit);
}
function isValidRank(rank) {
  return typeof rank === "string" && Object.values(Rank).includes(rank);
}
function isValidCard(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }
  const c = candidate;
  return typeof c.id === "string" && isValidSuit(c.suit) && isValidRank(c.rank) && typeof c.value === "number" && c.id === getCardId(c.suit, c.rank) && c.value === RANK_VALUES[c.rank];
}
function areCardsEqual(a, b) {
  if (!a || !b) return false;
  return a.suit === b.suit && a.rank === b.rank;
}

// src/core/deck/validation.ts
var REQUIRED_DECK_SIZE = 52;
var REQUIRED_CARDS_PER_SUIT = 13;
var ALL_SUITS = Object.freeze([
  "SPADES" /* SPADES */,
  "HEARTS" /* HEARTS */,
  "DIAMONDS" /* DIAMONDS */,
  "CLUBS" /* CLUBS */
]);
var ALL_RANKS = Object.freeze([
  "2" /* TWO */,
  "3" /* THREE */,
  "4" /* FOUR */,
  "5" /* FIVE */,
  "6" /* SIX */,
  "7" /* SEVEN */,
  "8" /* EIGHT */,
  "9" /* NINE */,
  "10" /* TEN */,
  "J" /* JACK */,
  "Q" /* QUEEN */,
  "K" /* KING */,
  "A" /* ACE */
]);
function checkDeckIntegrityDetailed(deck) {
  const errors = [];
  if (!Array.isArray(deck)) {
    return {
      isValid: false,
      errors: ["Deck candidate is not an array."],
      totalCards: 0,
      suitCounts: {
        ["SPADES" /* SPADES */]: 0,
        ["HEARTS" /* HEARTS */]: 0,
        ["DIAMONDS" /* DIAMONDS */]: 0,
        ["CLUBS" /* CLUBS */]: 0
      },
      uniqueCardCount: 0
    };
  }
  const totalCards = deck.length;
  if (totalCards !== REQUIRED_DECK_SIZE) {
    errors.push(`Deck contains ${totalCards} cards; expected exactly ${REQUIRED_DECK_SIZE}.`);
  }
  const seenIds = /* @__PURE__ */ new Set();
  const suitCounts = {
    ["SPADES" /* SPADES */]: 0,
    ["HEARTS" /* HEARTS */]: 0,
    ["DIAMONDS" /* DIAMONDS */]: 0,
    ["CLUBS" /* CLUBS */]: 0
  };
  const suitRankGrid = {
    ["SPADES" /* SPADES */]: /* @__PURE__ */ new Set(),
    ["HEARTS" /* HEARTS */]: /* @__PURE__ */ new Set(),
    ["DIAMONDS" /* DIAMONDS */]: /* @__PURE__ */ new Set(),
    ["CLUBS" /* CLUBS */]: /* @__PURE__ */ new Set()
  };
  deck.forEach((card, index) => {
    if (!isValidCard(card)) {
      errors.push(`Card at index ${index} is invalid or corrupted.`);
      return;
    }
    if (seenIds.has(card.id)) {
      errors.push(`Duplicate card detected: ${card.id} at index ${index}.`);
    } else {
      seenIds.add(card.id);
    }
    if (suitCounts[card.suit] !== void 0) {
      suitCounts[card.suit]++;
      suitRankGrid[card.suit].add(card.rank);
    }
  });
  for (const suit of ALL_SUITS) {
    const count = suitCounts[suit];
    if (count !== REQUIRED_CARDS_PER_SUIT) {
      errors.push(
        `Suit ${suit} has ${count} cards; expected exactly ${REQUIRED_CARDS_PER_SUIT}.`
      );
    }
    for (const rank of ALL_RANKS) {
      if (!suitRankGrid[suit].has(rank)) {
        errors.push(`Suit ${suit} is missing rank ${rank}.`);
      }
    }
  }
  return {
    isValid: errors.length === 0,
    errors: Object.freeze(errors),
    totalCards,
    suitCounts: Object.freeze(suitCounts),
    uniqueCardCount: seenIds.size
  };
}
function validateDeckIntegrity(deck) {
  return checkDeckIntegrityDetailed(deck).isValid;
}

// src/core/deck/CardEngine.ts
var STANDARD_SUIT_ORDER = Object.freeze([
  "SPADES" /* SPADES */,
  "HEARTS" /* HEARTS */,
  "DIAMONDS" /* DIAMONDS */,
  "CLUBS" /* CLUBS */
]);
var STANDARD_RANK_ORDER = Object.freeze([
  "2" /* TWO */,
  "3" /* THREE */,
  "4" /* FOUR */,
  "5" /* FIVE */,
  "6" /* SIX */,
  "7" /* SEVEN */,
  "8" /* EIGHT */,
  "9" /* NINE */,
  "10" /* TEN */,
  "J" /* JACK */,
  "Q" /* QUEEN */,
  "K" /* KING */,
  "A" /* ACE */
]);
var CardEngine = class {
  constructor(randomSource) {
    this.defaultRandomSource = randomSource ?? new CryptoRandomSource();
  }
  /**
   * Generates a standard 52-card deck (4 suits x 13 ranks).
   * Generates cards in a deterministic, standard order.
   * Fully immutable.
   */
  createDeck() {
    const cards = [];
    for (const suit of STANDARD_SUIT_ORDER) {
      for (const rank of STANDARD_RANK_ORDER) {
        cards.push(createCard(suit, rank));
      }
    }
    return Object.freeze(cards);
  }
  /**
   * Shuffles a given deck using an unbiased Fisher-Yates (Knuth) algorithm.
   * If a seed is provided, a DeterministicRandomSource is used for reproducible shuffles.
   * Does NOT mutate the input deck (returns a new array).
   */
  shuffle(deck, seed) {
    if (!deck || !Array.isArray(deck)) {
      throw new Error("Cannot shuffle invalid or non-array deck");
    }
    const random = seed !== void 0 ? new DeterministicRandomSource(seed) : this.defaultRandomSource;
    const copy = [...deck];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = random.nextInt(0, i);
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return Object.freeze(copy);
  }
  /**
   * Deals 13 cards to each of the 4 players.
   * Call Break standard: 52 cards dealt equally to 4 players (13 cards each).
   * Validates deck size and integrity before distribution.
   */
  deal(shuffledDeck, playerPositions = CLOCKWISE_PLAYER_ORDER) {
    if (!shuffledDeck || !Array.isArray(shuffledDeck)) {
      throw new Error("Cannot deal invalid or non-array deck");
    }
    const expectedTotalCards = playerPositions.length * 13;
    if (shuffledDeck.length < expectedTotalCards) {
      throw new Error(
        `Insufficient cards to deal: required at least ${expectedTotalCards} cards for ${playerPositions.length} players, got ${shuffledDeck.length}`
      );
    }
    const handBuckets = {};
    for (const pos of playerPositions) {
      handBuckets[pos] = [];
    }
    let cardIdx = 0;
    for (let round = 0; round < 13; round++) {
      for (const pos of playerPositions) {
        handBuckets[pos].push(shuffledDeck[cardIdx++]);
      }
    }
    const result = {};
    for (const pos of playerPositions) {
      result[pos] = Object.freeze(handBuckets[pos]);
    }
    return Object.freeze(result);
  }
  /**
   * Solo Offline Weighted Dealing Algorithm:
   * Gives South (or specified target) a ~10%-12% HCP point boost in dealt cards
   * (ensuring 1-2 solid honors and healthy Spades length).
   * 
   * Strict Invariant: Exactly 13 cards per hand dealt from the 52-card deck
   * with ZERO duplicate cards across all 4 hands.
   */
  dealWeighted(shuffledDeck, targetPosition = "SOUTH" /* SOUTH */) {
    if (!shuffledDeck || !Array.isArray(shuffledDeck)) {
      throw new Error("Cannot deal invalid or non-array deck");
    }
    if (shuffledDeck.length < 52) {
      return this.deal(shuffledDeck, CLOCKWISE_PLAYER_ORDER);
    }
    let currentDeck = [...shuffledDeck];
    let bestDeal = null;
    let bestScoreDiff = Infinity;
    const calcHCP = (hand) => {
      let score = 0;
      for (const card of hand) {
        if (card.rank === "A" /* ACE */) score += 4;
        else if (card.rank === "K" /* KING */) score += 3;
        else if (card.rank === "Q" /* QUEEN */) score += 2;
        else if (card.rank === "J" /* JACK */) score += 1;
        if (card.suit === "SPADES" /* SPADES */) score += 1;
      }
      return score;
    };
    for (let attempt = 0; attempt < 150; attempt++) {
      const candidateDeal = this.deal(currentDeck, CLOCKWISE_PLAYER_ORDER);
      const targetHand = candidateDeal[targetPosition];
      if (targetHand && targetHand.length === 13) {
        const hcp = calcHCP(targetHand);
        const honorsCount = targetHand.filter(
          (c) => c.rank === "A" /* ACE */ || c.rank === "K" /* KING */
        ).length;
        const spadesCount = targetHand.filter((c) => c.suit === "SPADES" /* SPADES */).length;
        if (hcp >= 15 && hcp <= 19 && honorsCount >= 1 && spadesCount >= 3) {
          return candidateDeal;
        }
        const scoreDiff = Math.abs(hcp - 16) + (spadesCount < 3 ? 5 : 0) + (honorsCount < 1 ? 5 : 0);
        if (scoreDiff < bestScoreDiff) {
          bestScoreDiff = scoreDiff;
          bestDeal = candidateDeal;
        }
      }
      currentDeck = [...this.shuffle(currentDeck)];
    }
    return bestDeal ?? this.deal(shuffledDeck, CLOCKWISE_PLAYER_ORDER);
  }
  /**
   * Sorts a player's hand deterministically:
   * 1. Grouped by suit: Spades (Trump) -> Hearts -> Diamonds -> Clubs
   * 2. Within each suit: Rank descending (Ace = 14 down to 2)
   * Returns a new frozen array, preserving input immutability.
   */
  sortHand(hand) {
    if (!hand || !Array.isArray(hand)) {
      return Object.freeze([]);
    }
    const suitPriority = {
      ["SPADES" /* SPADES */]: 0,
      // Trump always first
      ["HEARTS" /* HEARTS */]: 1,
      ["DIAMONDS" /* DIAMONDS */]: 2,
      ["CLUBS" /* CLUBS */]: 3
    };
    const sorted = [...hand].sort((a, b) => {
      const suitDiff = suitPriority[a.suit] - suitPriority[b.suit];
      if (suitDiff !== 0) {
        return suitDiff;
      }
      return b.value - a.value;
    });
    return Object.freeze(sorted);
  }
  /**
   * Verifies standard 52-card deck integrity.
   * Conforms to ICardEngine.
   */
  validateDeckIntegrity(deck) {
    return validateDeckIntegrity(deck);
  }
};

// src/core/rules/dealerDirectionPolicy.ts
var StandardClockwisePolicy = class {
  getNextPlayer(current) {
    const index = CLOCKWISE_PLAYER_ORDER.indexOf(current);
    if (index === -1) {
      return "SOUTH" /* SOUTH */;
    }
    return CLOCKWISE_PLAYER_ORDER[(index + 1) % CLOCKWISE_PLAYER_ORDER.length];
  }
  getDealerForRound(roundNumber, initialDealer = "SOUTH" /* SOUTH */) {
    const initialIndex = CLOCKWISE_PLAYER_ORDER.indexOf(initialDealer);
    const normalizedIndex = (initialIndex + (roundNumber - 1)) % CLOCKWISE_PLAYER_ORDER.length;
    return CLOCKWISE_PLAYER_ORDER[normalizedIndex];
  }
  getStartingPlayer(dealer) {
    return this.getNextPlayer(dealer);
  }
  getPlayerOrder() {
    return CLOCKWISE_PLAYER_ORDER;
  }
};
var defaultDealerDirectionPolicy = new StandardClockwisePolicy();

// src/core/rules/rulesUtils.ts
var DEFAULT_TRUMP_SUIT = "SPADES" /* SPADES */;
var STANDARD_MIN_BID = 1;
var STANDARD_MAX_BID = 13;
var TRICKS_PER_ROUND = 13;
function getNextPlayerClockwise(current, policy = defaultDealerDirectionPolicy) {
  return policy.getNextPlayer(current);
}
function getStartingPlayerForRound(dealer, policy = defaultDealerDirectionPolicy) {
  return policy.getStartingPlayer(dealer);
}
function getExpectedBiddingPlayer(state) {
  if (state.status !== "BIDDING" /* BIDDING */) {
    return null;
  }
  const startingPlayer = getStartingPlayerForRound(state.dealer);
  let candidate = startingPlayer;
  for (let i = 0; i < CLOCKWISE_PLAYER_ORDER.length; i++) {
    const playerState = state.players[candidate];
    if (playerState && playerState.currentBid === null) {
      return candidate;
    }
    candidate = getNextPlayerClockwise(candidate);
  }
  return null;
}
function validateBid(bid, playerPosition, state) {
  if (state.status !== "BIDDING" /* BIDDING */) {
    return {
      isValid: false,
      reason: `Cannot place bid in game status "${state.status}". Bidding is only allowed in BIDDING status.`
    };
  }
  if (!Number.isInteger(bid) || bid < STANDARD_MIN_BID || bid > STANDARD_MAX_BID) {
    return {
      isValid: false,
      reason: `Invalid bid value "${bid}". Bid must be an integer between ${STANDARD_MIN_BID} and ${STANDARD_MAX_BID}.`
    };
  }
  const playerState = state.players[playerPosition];
  if (!playerState) {
    return {
      isValid: false,
      reason: `Player "${playerPosition}" does not exist in game state.`
    };
  }
  if (playerState.currentBid !== null) {
    return {
      isValid: false,
      reason: `Player "${playerPosition}" has already placed a bid (${playerState.currentBid}) for this round.`
    };
  }
  const expectedPlayer = getExpectedBiddingPlayer(state);
  if (expectedPlayer !== playerPosition) {
    return {
      isValid: false,
      reason: `It is not ${playerPosition}'s turn to bid. Expected bidder is ${expectedPlayer ?? "none"}.`
    };
  }
  return { isValid: true };
}
function getCurrentWinningCard(currentTrick, trumpSuit = DEFAULT_TRUMP_SUIT) {
  if (!currentTrick || !currentTrick.cards || currentTrick.cards.length === 0) {
    return null;
  }
  const playedTrumps = currentTrick.cards.filter((pc) => pc.card.suit === trumpSuit);
  if (playedTrumps.length > 0) {
    let winningTrump = playedTrumps[0];
    for (let i = 1; i < playedTrumps.length; i++) {
      if (playedTrumps[i].card.value > winningTrump.card.value) {
        winningTrump = playedTrumps[i];
      }
    }
    return winningTrump;
  }
  const leadSuit = currentTrick.leadSuit ?? currentTrick.cards[0].card.suit;
  const playedLeadCards = currentTrick.cards.filter((pc) => pc.card.suit === leadSuit);
  if (playedLeadCards.length === 0) {
    return currentTrick.cards[0];
  }
  let winningLead = playedLeadCards[0];
  for (let i = 1; i < playedLeadCards.length; i++) {
    if (playedLeadCards[i].card.value > winningLead.card.value) {
      winningLead = playedLeadCards[i];
    }
  }
  return winningLead;
}
function getLegalMoves(playerHand, currentTrick, trumpSuit = DEFAULT_TRUMP_SUIT) {
  if (!playerHand || playerHand.length === 0) {
    return Object.freeze([]);
  }
  if (currentTrick.cards.length === 0 || currentTrick.leadSuit === null) {
    return Object.freeze([...playerHand]);
  }
  const leadSuit = currentTrick.leadSuit;
  const leadSuitCards = playerHand.filter((c) => c.suit === leadSuit);
  const currentWinner = getCurrentWinningCard(currentTrick, trumpSuit);
  if (leadSuitCards.length > 0) {
    if (currentWinner && currentWinner.card.suit === trumpSuit && leadSuit !== trumpSuit) {
      return Object.freeze(leadSuitCards);
    }
    const currentWinningValue = currentWinner ? currentWinner.card.value : 0;
    const higherLeadCards = leadSuitCards.filter((c) => c.value > currentWinningValue);
    if (higherLeadCards.length > 0) {
      return Object.freeze(higherLeadCards);
    }
    return Object.freeze(leadSuitCards);
  }
  const trumpsInHand = playerHand.filter((c) => c.suit === trumpSuit);
  if (trumpsInHand.length === 0) {
    return Object.freeze([...playerHand]);
  }
  if (!currentWinner || currentWinner.card.suit !== trumpSuit) {
    return Object.freeze(trumpsInHand);
  }
  const higherTrumps = trumpsInHand.filter((c) => c.value > currentWinner.card.value);
  if (higherTrumps.length > 0) {
    return Object.freeze(higherTrumps);
  }
  return Object.freeze([...playerHand]);
}
function validateCardPlay(cardToPlay, playerHand, currentTrick, trumpSuit = DEFAULT_TRUMP_SUIT) {
  if (!cardToPlay) {
    return { isValid: false, reason: "Card to play cannot be null or undefined." };
  }
  const hasCard = playerHand.some((c) => areCardsEqual(c, cardToPlay));
  if (!hasCard) {
    return {
      isValid: false,
      reason: `Player does not hold ${cardToPlay.rank} of ${cardToPlay.suit} in hand.`
    };
  }
  const legalMoves = getLegalMoves(playerHand, currentTrick, trumpSuit);
  const isLegal = legalMoves.some((c) => areCardsEqual(c, cardToPlay));
  if (!isLegal) {
    const leadSuit = currentTrick.leadSuit;
    const hasLeadSuit = playerHand.some((c) => c.suit === leadSuit);
    const currentWinner = getCurrentWinningCard(currentTrick, trumpSuit);
    if (hasLeadSuit) {
      if (cardToPlay.suit === leadSuit) {
        return {
          isValid: false,
          reason: `Illegal move: Must play a higher card of lead suit (${leadSuit}) to beat current winning card (${currentWinner?.card.rank} of ${currentWinner?.card.suit}) when possible.`
        };
      }
      return {
        isValid: false,
        reason: `Illegal move: Must follow lead suit (${leadSuit}). You hold ${playerHand.filter((c) => c.suit === leadSuit).length} card(s) of ${leadSuit}.`
      };
    }
    if (currentWinner && currentWinner.card.suit === trumpSuit) {
      return {
        isValid: false,
        reason: `Illegal move: Must over-trump with a higher ${trumpSuit} than current winner ${currentWinner.card.rank} of ${trumpSuit} when possible.`
      };
    }
    return {
      isValid: false,
      reason: `Illegal move: Must trump with a ${trumpSuit} when void in lead suit (${leadSuit}).`
    };
  }
  return { isValid: true };
}
function isLegalPlay(state, playerPosition, card) {
  if (state.status !== "PLAYING" /* PLAYING */) {
    return {
      isValid: false,
      reason: `Cannot play cards in game status "${state.status}". Game must be in PLAYING status.`
    };
  }
  if (state.currentPlayer !== playerPosition) {
    return {
      isValid: false,
      reason: `It is not ${playerPosition}'s turn to play. Current player is ${state.currentPlayer}.`
    };
  }
  if (state.currentTrick.cards.length >= 4) {
    return {
      isValid: false,
      reason: "Current trick is already complete (4 cards played). Trick must be resolved before next play."
    };
  }
  const playerState = state.players[playerPosition];
  if (!playerState) {
    return {
      isValid: false,
      reason: `Player "${playerPosition}" not found in game state.`
    };
  }
  return validateCardPlay(
    card,
    playerState.hand,
    state.currentTrick,
    state.config.trumpSuit
  );
}
function determineTrickWinner(playedCards, leadSuit, trumpSuit = DEFAULT_TRUMP_SUIT) {
  if (!playedCards || playedCards.length === 0) {
    throw new Error("Cannot determine trick winner for empty played cards.");
  }
  const trumpCards = playedCards.filter((pc) => pc.card.suit === trumpSuit);
  if (trumpCards.length > 0) {
    let winningPlay2 = trumpCards[0];
    for (let i = 1; i < trumpCards.length; i++) {
      if (trumpCards[i].card.value > winningPlay2.card.value) {
        winningPlay2 = trumpCards[i];
      }
    }
    return winningPlay2.playerPosition;
  }
  const leadSuitCards = playedCards.filter((pc) => pc.card.suit === leadSuit);
  if (leadSuitCards.length === 0) {
    return playedCards[0].playerPosition;
  }
  let winningPlay = leadSuitCards[0];
  for (let i = 1; i < leadSuitCards.length; i++) {
    if (leadSuitCards[i].card.value > winningPlay.card.value) {
      winningPlay = leadSuitCards[i];
    }
  }
  return winningPlay.playerPosition;
}

// src/core/rules/CallBreakRulesEngine.ts
var CallBreakRulesEngine = class {
  constructor(trumpSuitOrPolicy = DEFAULT_TRUMP_SUIT, dealerDirectionPolicy = defaultDealerDirectionPolicy) {
    if (typeof trumpSuitOrPolicy === "object" && "getNextPlayer" in trumpSuitOrPolicy) {
      this.trumpSuit = DEFAULT_TRUMP_SUIT;
      this.dealerDirectionPolicy = trumpSuitOrPolicy;
    } else {
      this.trumpSuit = trumpSuitOrPolicy;
      this.dealerDirectionPolicy = dealerDirectionPolicy;
    }
  }
  getDealerDirectionPolicy() {
    return this.dealerDirectionPolicy;
  }
  getNextPlayer(current) {
    return this.dealerDirectionPolicy.getNextPlayer(current);
  }
  getDealerForRound(roundNumber, initialDealer = "SOUTH" /* SOUTH */) {
    return this.dealerDirectionPolicy.getDealerForRound(roundNumber, initialDealer);
  }
  getStartingPlayer(dealer) {
    return this.dealerDirectionPolicy.getStartingPlayer(dealer);
  }
  getExpectedBiddingPlayer(state) {
    return getExpectedBiddingPlayer(state);
  }
  validateBid(bid, playerPosition, state) {
    return validateBid(bid, playerPosition, state);
  }
  getLegalMoves(playerHand, currentTrick, trumpSuit = this.trumpSuit) {
    return getLegalMoves(playerHand, currentTrick, trumpSuit);
  }
  validateCardPlay(cardToPlay, playerHand, currentTrick, trumpSuit = this.trumpSuit) {
    return validateCardPlay(cardToPlay, playerHand, currentTrick, trumpSuit);
  }
  isLegalPlay(state, playerPosition, card) {
    return isLegalPlay(state, playerPosition, card);
  }
  determineTrickWinner(playedCards, leadSuit, trumpSuit = this.trumpSuit) {
    return determineTrickWinner(playedCards, leadSuit, trumpSuit);
  }
  /**
   * Deterministic round initialization:
   * 1. Establishes dealer according to round rotation
   * 2. Establishes starting player (clockwise from dealer)
   * 3. Creates fresh 52-card deck and shuffles via ICardEngine
   * 4. Deals 13 cards each to SOUTH, WEST, NORTH, EAST
   * 5. Clears trick and bid states
   * 6. Sets status to BIDDING with currentPlayer as starting player
   */
  initializeRound(state, cardEngine, seed) {
    const roundNumber = state.currentRound;
    const dealer = this.getDealerForRound(roundNumber, "SOUTH" /* SOUTH */);
    const startingPlayer = this.getStartingPlayer(dealer);
    const deck = cardEngine.createDeck();
    const shuffledDeck = cardEngine.shuffle(deck, seed);
    const humanPositions = CLOCKWISE_PLAYER_ORDER.filter(
      (pos) => state.players[pos]?.type === "HUMAN" /* HUMAN */
    );
    let dealtHands;
    if (seed === void 0 && typeof cardEngine.dealWeighted === "function") {
      if (humanPositions.length === 1) {
        dealtHands = cardEngine.dealWeighted(shuffledDeck, humanPositions[0]);
      } else if (state.mode === "OFFLINE_BOTS" /* OFFLINE_BOTS */) {
        dealtHands = cardEngine.dealWeighted(shuffledDeck, "SOUTH" /* SOUTH */);
      } else {
        dealtHands = cardEngine.deal(shuffledDeck, CLOCKWISE_PLAYER_ORDER);
      }
    } else {
      dealtHands = cardEngine.deal(shuffledDeck, CLOCKWISE_PLAYER_ORDER);
    }
    const updatedPlayers = { ...state.players };
    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      const rawHand = dealtHands[pos] ?? [];
      const hand = cardEngine.sortHand(rawHand);
      updatedPlayers[pos] = {
        ...state.players[pos],
        hand,
        currentBid: null,
        tricksWon: 0,
        isTurn: pos === startingPlayer,
        isDealer: pos === dealer
      };
    }
    return Object.freeze({
      ...state,
      status: "BIDDING" /* BIDDING */,
      dealer,
      currentPlayer: startingPlayer,
      players: Object.freeze(updatedPlayers),
      currentTrick: Object.freeze({
        trickNumber: 1,
        leader: startingPlayer,
        leadSuit: null,
        cards: Object.freeze([]),
        winner: null
      }),
      completedTricks: Object.freeze([]),
      lastActionMessage: `Round ${roundNumber} started. Dealer is ${dealer}. Waiting for ${startingPlayer} to call.`
    });
  }
  /**
   * Applies a player's bid:
   * 1. Validates bid
   * 2. Updates player's bid
   * 3. Advances turn to next bidder or transitions to PLAYING if all 4 have bid
   */
  applyBid(state, playerPosition, bid) {
    const validation = this.validateBid(bid, playerPosition, state);
    if (!validation.isValid) {
      throw new Error(`Invalid bid: ${validation.reason}`);
    }
    const updatedPlayers = {
      ...state.players,
      [playerPosition]: {
        ...state.players[playerPosition],
        currentBid: bid
      }
    };
    const intermediateState = {
      ...state,
      players: updatedPlayers
    };
    const nextBidder = this.getExpectedBiddingPlayer(intermediateState);
    if (nextBidder !== null) {
      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        updatedPlayers[pos] = {
          ...updatedPlayers[pos],
          isTurn: pos === nextBidder
        };
      }
      return Object.freeze({
        ...state,
        currentPlayer: nextBidder,
        players: Object.freeze(updatedPlayers),
        lastActionMessage: `${state.players[playerPosition].name} called ${bid}. Waiting for ${state.players[nextBidder].name}.`
      });
    }
    const startingPlayer = this.getStartingPlayer(state.dealer);
    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      updatedPlayers[pos] = {
        ...updatedPlayers[pos],
        isTurn: pos === startingPlayer
      };
    }
    return Object.freeze({
      ...state,
      status: "PLAYING" /* PLAYING */,
      currentPlayer: startingPlayer,
      players: Object.freeze(updatedPlayers),
      currentTrick: Object.freeze({
        trickNumber: 1,
        leader: startingPlayer,
        leadSuit: null,
        cards: Object.freeze([]),
        winner: null
      }),
      lastActionMessage: `All bids placed. Round play started! ${state.players[startingPlayer].name} leads the first trick.`
    });
  }
  /**
   * Applies a card play:
   * 1. Validates legal move
   * 2. Removes card from player's hand
   * 3. Adds card to current trick
   * 4. If trick reaches 4 cards, automatically resolves trick
   * 5. Otherwise advances to next player
   */
  applyCardPlay(state, playerPosition, card) {
    const validation = this.isLegalPlay(state, playerPosition, card);
    if (!validation.isValid) {
      throw new Error(`Illegal card play: ${validation.reason}`);
    }
    const player = state.players[playerPosition];
    const newHand = player.hand.filter((c) => !areCardsEqual(c, card));
    const playedCard = Object.freeze({
      playerPosition,
      card,
      playedAt: Date.now()
    });
    const isFirstCard = state.currentTrick.cards.length === 0;
    const leadSuit = isFirstCard ? card.suit : state.currentTrick.leadSuit;
    const updatedCards = Object.freeze([...state.currentTrick.cards, playedCard]);
    const updatedPlayers = {
      ...state.players,
      [playerPosition]: {
        ...player,
        hand: Object.freeze(newHand)
      }
    };
    if (updatedCards.length === 4) {
      const trickWinner = this.determineTrickWinner(
        updatedCards,
        leadSuit,
        state.config.trumpSuit
      );
      const resolvedTrickState = Object.freeze({
        ...state.currentTrick,
        leadSuit,
        cards: updatedCards,
        winner: trickWinner
      });
      const stateWithCompletedTrick = {
        ...state,
        players: updatedPlayers,
        currentTrick: resolvedTrickState
      };
      return this.resolveCurrentTrick(stateWithCompletedTrick);
    }
    const nextPlayer = this.getNextPlayer(playerPosition);
    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      updatedPlayers[pos] = {
        ...updatedPlayers[pos],
        isTurn: pos === nextPlayer
      };
    }
    return Object.freeze({
      ...state,
      currentPlayer: nextPlayer,
      players: Object.freeze(updatedPlayers),
      currentTrick: Object.freeze({
        ...state.currentTrick,
        leadSuit,
        cards: updatedCards
      }),
      lastActionMessage: `${player.name} played ${card.rank} of ${card.suit}. Turn: ${state.players[nextPlayer].name}.`
    });
  }
  /**
   * Resolves a completed 4-card trick:
   * 1. Records trick in completedTricks
   * 2. Increments trick winner's tricksWon count
   * 3. If 13 tricks are completed, transitions round to ROUND_ENDED
   * 4. Otherwise, starts next trick with winner leading
   */
  resolveCurrentTrick(state) {
    const { currentTrick } = state;
    if (currentTrick.cards.length !== 4) {
      throw new Error(
        `Cannot resolve trick: trick contains ${currentTrick.cards.length} cards, expected 4.`
      );
    }
    const winner = currentTrick.winner ?? this.determineTrickWinner(
      currentTrick.cards,
      currentTrick.leadSuit,
      state.config.trumpSuit
    );
    const completedTrick = Object.freeze({
      trickNumber: currentTrick.trickNumber,
      leader: currentTrick.leader,
      leadSuit: currentTrick.leadSuit,
      cards: currentTrick.cards,
      winner
    });
    const completedTricks = Object.freeze([...state.completedTricks, completedTrick]);
    const winnerPlayer = state.players[winner];
    const updatedPlayers = {
      ...state.players,
      [winner]: {
        ...winnerPlayer,
        tricksWon: winnerPlayer.tricksWon + 1
      }
    };
    if (completedTricks.length >= TRICKS_PER_ROUND) {
      for (const pos of CLOCKWISE_PLAYER_ORDER) {
        updatedPlayers[pos] = {
          ...updatedPlayers[pos],
          isTurn: false
        };
      }
      return Object.freeze({
        ...state,
        status: "ROUND_ENDED" /* ROUND_ENDED */,
        players: Object.freeze(updatedPlayers),
        completedTricks,
        lastActionMessage: `Round ${state.currentRound} complete! All 13 tricks played. ${winnerPlayer.name} won trick 13.`
      });
    }
    const nextTrickNumber = completedTricks.length + 1;
    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      updatedPlayers[pos] = {
        ...updatedPlayers[pos],
        isTurn: pos === winner
      };
    }
    return Object.freeze({
      ...state,
      currentPlayer: winner,
      players: Object.freeze(updatedPlayers),
      completedTricks,
      currentTrick: Object.freeze({
        trickNumber: nextTrickNumber,
        leader: winner,
        leadSuit: null,
        cards: Object.freeze([]),
        winner: null
      }),
      lastActionMessage: `${winnerPlayer.name} won trick ${currentTrick.trickNumber} and leads trick ${nextTrickNumber}.`
    });
  }
  calculateRoundScore(bid, tricksWon) {
    if (tricksWon >= bid) {
      return Number((bid + (tricksWon - bid) * 0.1).toFixed(1));
    }
    return -bid;
  }
  isRoundComplete(completedTricksCount) {
    return completedTricksCount >= TRICKS_PER_ROUND;
  }
  isMatchComplete(currentRound, totalRounds) {
    return currentRound >= totalRounds;
  }
  rankPlayersByScore(cumulativeScores) {
    const list = CLOCKWISE_PLAYER_ORDER.map((pos) => ({
      position: pos,
      score: cumulativeScores[pos] ?? 0,
      rank: 1
    }));
    list.sort((a, b) => b.score - a.score);
    return Object.freeze(
      list.map((item, index) => ({
        ...item,
        rank: index + 1
      }))
    );
  }
  /**
   * Calculates the sum of all 4 players' current bids in the round.
   */
  getTotalBids(state) {
    return CLOCKWISE_PLAYER_ORDER.reduce((sum, pos) => {
      const bid = state.players[pos]?.currentBid;
      return sum + (typeof bid === "number" ? bid : 0);
    }, 0);
  }
  /**
   * Checks whether re-bidding is required for the round after all 4 players have submitted their bids.
   * Special Call Break rule: if the sum of all 4 bids is <= 8, minimum bid total was not reached.
   */
  isRebidRequired(state) {
    const allHaveBid = CLOCKWISE_PLAYER_ORDER.every(
      (pos) => typeof state.players[pos]?.currentBid === "number"
    );
    if (!allHaveBid) return false;
    return this.getTotalBids(state) <= 8;
  }
  /**
   * Re-deals 13 cards to all players and restarts bidding phase for the current round
   * without penalizing cumulative scores or advancing the dealer.
   */
  redealRound(state, cardEngine, seed) {
    const roundNumber = state.currentRound;
    const dealer = state.dealer;
    const startingPlayer = this.getStartingPlayer(dealer);
    const deck = cardEngine.createDeck();
    const shuffledDeck = cardEngine.shuffle(deck, seed);
    const humanPositions = CLOCKWISE_PLAYER_ORDER.filter(
      (pos) => state.players[pos]?.type === "HUMAN" /* HUMAN */
    );
    let dealtHands;
    if (seed === void 0 && typeof cardEngine.dealWeighted === "function") {
      if (humanPositions.length === 1) {
        dealtHands = cardEngine.dealWeighted(shuffledDeck, humanPositions[0]);
      } else if (state.mode === "OFFLINE_BOTS" /* OFFLINE_BOTS */) {
        dealtHands = cardEngine.dealWeighted(shuffledDeck, "SOUTH" /* SOUTH */);
      } else {
        dealtHands = cardEngine.deal(shuffledDeck, CLOCKWISE_PLAYER_ORDER);
      }
    } else {
      dealtHands = cardEngine.deal(shuffledDeck, CLOCKWISE_PLAYER_ORDER);
    }
    const updatedPlayers = { ...state.players };
    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      const rawHand = dealtHands[pos] ?? [];
      const hand = pos === "SOUTH" /* SOUTH */ ? cardEngine.sortHand(rawHand) : rawHand;
      updatedPlayers[pos] = {
        ...state.players[pos],
        hand,
        currentBid: null,
        tricksWon: 0,
        isTurn: pos === startingPlayer,
        isDealer: pos === dealer
      };
    }
    const totalBids = this.getTotalBids(state);
    return Object.freeze({
      ...state,
      status: "BIDDING" /* BIDDING */,
      dealer,
      currentPlayer: startingPlayer,
      players: Object.freeze(updatedPlayers),
      currentTrick: Object.freeze({
        trickNumber: 1,
        leader: startingPlayer,
        leadSuit: null,
        cards: Object.freeze([]),
        winner: null
      }),
      completedTricks: Object.freeze([]),
      lastActionMessage: `Total bids = ${totalBids} (\u2264 8). Minimum bid total not reached. Re-bidding round!`
    });
  }
};

// src/core/scoring/scoringPolicies.ts
function roundToPrecision(value, decimals = 1) {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
var StandardCallBreakScoringPolicy = class {
  constructor() {
    this.name = "Standard Call Break Policy";
    this.minBid = 1;
    this.maxBid = 13;
    this.overtrickValue = 0.1;
    this.failedBidPenaltyMode = "NEGATIVE_BID";
  }
  calculatePlayerRoundScore(bid, tricksWon) {
    if (tricksWon >= bid) {
      const overtricks = tricksWon - bid;
      const score = bid + overtricks * this.overtrickValue;
      return roundToPrecision(score, 1);
    } else {
      return roundToPrecision(-bid, 1);
    }
  }
};

// src/core/scoring/scoringUtils.ts
function validatePlayerRoundInput(bid, tricksWon, policy) {
  const errors = [];
  if (typeof bid !== "number" || !Number.isInteger(bid)) {
    errors.push(`Bid must be an integer, received: ${bid}`);
  } else if (bid < policy.minBid || bid > policy.maxBid) {
    errors.push(`Bid ${bid} is out of allowable range [${policy.minBid}, ${policy.maxBid}]`);
  }
  if (typeof tricksWon !== "number" || !Number.isInteger(tricksWon)) {
    errors.push(`Tricks won must be an integer, received: ${tricksWon}`);
  } else if (tricksWon < 0 || tricksWon > 13) {
    errors.push(`Tricks won ${tricksWon} is out of allowable range [0, 13]`);
  }
  return {
    isValid: errors.length === 0,
    reason: errors.length > 0 ? errors.join("; ") : void 0,
    errors: errors.length > 0 ? errors : void 0
  };
}
function validateRoundScoringInput(input, policy) {
  const errors = [];
  const maxRounds = 10;
  if (typeof input.roundNumber !== "number" || !Number.isInteger(input.roundNumber) || input.roundNumber < 1 || input.roundNumber > maxRounds) {
    errors.push(`Invalid round number: ${input.roundNumber}. Expected integer between 1 and ${maxRounds}.`);
  }
  if (!input.playerResults || input.playerResults.length !== 4) {
    errors.push(
      `Round scoring requires exactly 4 player results, received: ${input.playerResults?.length ?? 0}`
    );
    return { isValid: false, reason: errors.join("; "), errors };
  }
  const seenPositions = /* @__PURE__ */ new Set();
  let totalTricks = 0;
  for (const pr of input.playerResults) {
    if (!CLOCKWISE_PLAYER_ORDER.includes(pr.position)) {
      errors.push(`Unrecognized player position: ${pr.position}`);
      continue;
    }
    if (seenPositions.has(pr.position)) {
      errors.push(`Duplicate player result detected for position: ${pr.position}`);
    }
    seenPositions.add(pr.position);
    const individualCheck = validatePlayerRoundInput(pr.bid, pr.tricksWon, policy);
    if (!individualCheck.isValid && individualCheck.errors) {
      errors.push(`Player ${pr.position}: ${individualCheck.errors.join(", ")}`);
    }
    if (typeof pr.tricksWon === "number" && Number.isInteger(pr.tricksWon)) {
      totalTricks += pr.tricksWon;
    }
  }
  for (const pos of CLOCKWISE_PLAYER_ORDER) {
    if (!seenPositions.has(pos)) {
      errors.push(`Missing player result for position: ${pos}`);
    }
  }
  if (totalTricks !== 13) {
    errors.push(`Sum of tricks won across all 4 players must equal 13, received: ${totalTricks}`);
  }
  return {
    isValid: errors.length === 0,
    reason: errors.length > 0 ? errors.join("; ") : void 0,
    errors: errors.length > 0 ? errors : void 0
  };
}
function validateGameStateForScoring(state, policy) {
  const errors = [];
  if (state.status !== "ROUND_ENDED" /* ROUND_ENDED */ && state.completedTricks.length < 13) {
    errors.push(
      `Cannot score round in status ${state.status} with ${state.completedTricks.length} completed tricks (13 required)`
    );
  }
  const alreadyScored = state.roundScores.some((r) => r.roundNumber === state.currentRound);
  if (alreadyScored) {
    errors.push(`Round ${state.currentRound} has already been scored`);
  }
  const playerResults = CLOCKWISE_PLAYER_ORDER.map((pos) => {
    const p = state.players[pos];
    return {
      position: pos,
      bid: p.currentBid ?? 0,
      tricksWon: p.tricksWon
    };
  });
  const inputCheck = validateRoundScoringInput(
    {
      roundNumber: state.currentRound,
      playerResults
    },
    policy
  );
  if (!inputCheck.isValid && inputCheck.errors) {
    errors.push(...inputCheck.errors);
  }
  return {
    isValid: errors.length === 0,
    reason: errors.length > 0 ? errors.join("; ") : void 0,
    errors: errors.length > 0 ? errors : void 0
  };
}
function calculateRoundScores(input, policy) {
  const validation = validateRoundScoringInput(input, policy);
  if (!validation.isValid) {
    throw new Error(`Scoring validation failed: ${validation.reason}`);
  }
  const scoresMap = {};
  for (const pr of input.playerResults) {
    const roundScore = policy.calculatePlayerRoundScore(pr.bid, pr.tricksWon);
    const prevCumulative = input.previousCumulativeScores?.[pr.position] ?? 0;
    const cumulativeScore = roundToPrecision(prevCumulative + roundScore, 1);
    scoresMap[pr.position] = {
      playerPosition: pr.position,
      bid: pr.bid,
      tricksWon: pr.tricksWon,
      roundScore,
      cumulativeScore
    };
  }
  return {
    roundNumber: input.roundNumber,
    scores: scoresMap
  };
}
function calculateMatchResult(cumulativeScores, roundScores = []) {
  const sorted = CLOCKWISE_PLAYER_ORDER.map((pos) => ({
    position: pos,
    score: cumulativeScores[pos] ?? 0
  })).sort((a, b) => b.score - a.score);
  const rankings = [];
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].score < sorted[i - 1].score) {
      currentRank = i + 1;
    }
    rankings.push({
      position: sorted[i].position,
      score: sorted[i].score,
      rank: currentRank
    });
  }
  const highestScore = sorted[0].score;
  const winnerPositions = rankings.filter((r) => r.score === highestScore).map((r) => r.position);
  const isTie = winnerPositions.length > 1;
  return {
    winnerPosition: winnerPositions[0],
    winnerPositions,
    isTie,
    finalScores: { ...cumulativeScores },
    rankings,
    completedAt: Date.now()
  };
}

// src/core/scoring/ScoringEngine.ts
var ScoringEngine = class {
  constructor(policy) {
    this.policy = policy ?? new StandardCallBreakScoringPolicy();
  }
  validateRoundScoringInput(input) {
    return validateRoundScoringInput(input, this.policy);
  }
  validateStateForScoring(state) {
    return validateGameStateForScoring(state, this.policy);
  }
  calculatePlayerScore(bid, tricksWon, policy) {
    const activePolicy = policy ?? this.policy;
    const validation = validatePlayerRoundInput(bid, tricksWon, activePolicy);
    if (!validation.isValid) {
      throw new Error(`Invalid score calculation inputs: ${validation.reason}`);
    }
    return activePolicy.calculatePlayerRoundScore(bid, tricksWon);
  }
  calculateRoundScores(input, policy) {
    const activePolicy = policy ?? this.policy;
    return calculateRoundScores(input, activePolicy);
  }
  applyRoundScoresToState(state, policy) {
    const activePolicy = policy ?? this.policy;
    const validation = validateGameStateForScoring(state, activePolicy);
    if (!validation.isValid) {
      throw new Error(`State validation failed for round scoring: ${validation.reason}`);
    }
    const playerResults = CLOCKWISE_PLAYER_ORDER.map((pos) => {
      const p = state.players[pos];
      return {
        position: pos,
        bid: p.currentBid ?? 0,
        tricksWon: p.tricksWon
      };
    });
    const roundRecord = calculateRoundScores(
      {
        roundNumber: state.currentRound,
        playerResults,
        previousCumulativeScores: state.cumulativeScores
      },
      activePolicy
    );
    const newCumulativeScores = {};
    for (const pos of CLOCKWISE_PLAYER_ORDER) {
      const prev = state.cumulativeScores[pos] ?? 0;
      const roundScore = roundRecord.scores[pos].roundScore;
      newCumulativeScores[pos] = roundToPrecision(prev + roundScore, 1);
    }
    const updatedRoundScores = [...state.roundScores, roundRecord];
    const matchFinished = this.isMatchComplete(
      state.currentRound,
      state.config.totalRounds
    );
    let matchResult = null;
    let nextStatus = "ROUND_ENDED" /* ROUND_ENDED */;
    let actionMsg = `Round ${state.currentRound} scored successfully.`;
    if (matchFinished) {
      matchResult = calculateMatchResult(newCumulativeScores, updatedRoundScores);
      nextStatus = "MATCH_FINISHED" /* MATCH_FINISHED */;
      const winnerName = matchResult.isTie ? `Tied: ${matchResult.winnerPositions.join(", ")}` : `Winner: ${matchResult.winnerPosition}`;
      actionMsg = `Match complete! ${winnerName} with ${matchResult.rankings[0].score} points.`;
    }
    return {
      ...state,
      status: nextStatus,
      roundScores: updatedRoundScores,
      cumulativeScores: newCumulativeScores,
      matchResult,
      lastActionMessage: actionMsg
    };
  }
  calculateMatchResult(cumulativeScores, roundScores = []) {
    return calculateMatchResult(cumulativeScores, roundScores);
  }
  isMatchComplete(roundNumber, totalRounds = 5) {
    return roundNumber >= totalRounds;
  }
};

// src/core/bot/botBidding.ts
var MIN_BOT_BID = 1;
var MAX_BOT_BID = 13;
function groupHandBySuit(hand) {
  const groups = {
    ["SPADES" /* SPADES */]: [],
    ["HEARTS" /* HEARTS */]: [],
    ["DIAMONDS" /* DIAMONDS */]: [],
    ["CLUBS" /* CLUBS */]: []
  };
  for (const card of hand) {
    groups[card.suit].push(card);
  }
  for (const s of Object.values(Suit)) {
    groups[s].sort((a, b) => b.value - a.value);
  }
  return groups;
}
function evaluateHandStrength(hand, context) {
  const trumpSuit = context.trumpSuit ?? "SPADES" /* SPADES */;
  const suits = groupHandBySuit(hand);
  let spadeStrength = 0;
  let highCardStrength = 0;
  let lengthBonus = 0;
  let voidBonus = 0;
  const trumpCards = suits[trumpSuit] || [];
  const trumpCount = trumpCards.length;
  const hasTrumpRank = (r) => trumpCards.some((c) => c.rank === r);
  if (hasTrumpRank("A" /* ACE */)) {
    spadeStrength += 1;
  }
  if (hasTrumpRank("K" /* KING */)) {
    if (hasTrumpRank("A" /* ACE */)) {
      spadeStrength += 0.95;
    } else if (trumpCount >= 2) {
      spadeStrength += 0.8;
    } else {
      spadeStrength += 0.55;
    }
  }
  if (hasTrumpRank("Q" /* QUEEN */)) {
    if (hasTrumpRank("A" /* ACE */) && hasTrumpRank("K" /* KING */)) {
      spadeStrength += 0.9;
    } else if (hasTrumpRank("A" /* ACE */) || hasTrumpRank("K" /* KING */)) {
      spadeStrength += 0.65;
    } else if (trumpCount >= 3) {
      spadeStrength += 0.45;
    } else {
      spadeStrength += 0.2;
    }
  }
  if (hasTrumpRank("J" /* JACK */)) {
    if ((hasTrumpRank("A" /* ACE */) || hasTrumpRank("K" /* KING */)) && trumpCount >= 3) {
      spadeStrength += 0.35;
    } else if (trumpCount >= 4) {
      spadeStrength += 0.25;
    }
  }
  if (hasTrumpRank("10" /* TEN */) && trumpCount >= 4) {
    spadeStrength += 0.15;
  }
  if (trumpCount >= 4) {
    lengthBonus += 0.45;
  }
  if (trumpCount >= 5) {
    lengthBonus += 0.55;
  }
  if (trumpCount >= 6) {
    lengthBonus += 0.6;
  }
  if (trumpCount >= 7) {
    lengthBonus += 0.7;
  }
  for (const suit of Object.values(Suit)) {
    if (suit === trumpSuit) continue;
    const cards = suits[suit] || [];
    const count = cards.length;
    const hasRank = (r) => cards.some((c) => c.rank === r);
    if (hasRank("A" /* ACE */)) {
      if (count <= 3) {
        highCardStrength += 0.9;
      } else {
        highCardStrength += 0.75;
      }
    }
    if (hasRank("K" /* KING */)) {
      if (hasRank("A" /* ACE */)) {
        if (count >= 2) highCardStrength += 0.8;
      } else if (count >= 2 && count <= 4) {
        highCardStrength += 0.45;
      } else if (count === 1) {
        highCardStrength += 0.2;
      } else {
        highCardStrength += 0.3;
      }
    }
    if (hasRank("Q" /* QUEEN */)) {
      if (hasRank("A" /* ACE */) && hasRank("K" /* KING */)) {
        highCardStrength += 0.65;
      } else if (hasRank("A" /* ACE */) || hasRank("K" /* KING */)) {
        highCardStrength += 0.35;
      } else if (count >= 3) {
        highCardStrength += 0.15;
      }
    }
    if (hasRank("J" /* JACK */)) {
      if (hasRank("A" /* ACE */) && hasRank("K" /* KING */)) {
        highCardStrength += 0.25;
      }
    }
    if (trumpCount >= 3) {
      if (count === 0) {
        voidBonus += trumpCount >= 4 ? 0.65 : 0.35;
      } else if (count === 1) {
        voidBonus += trumpCount >= 4 ? 0.35 : 0.15;
      }
    }
  }
  const rawEstimatedTricks = spadeStrength + highCardStrength + lengthBonus + voidBonus;
  const estimatedTricks = Math.round(rawEstimatedTricks * 100) / 100;
  let calculatedBid = Math.floor(estimatedTricks + 0.15);
  const recommendedBid = Math.max(MIN_BOT_BID, Math.min(MAX_BOT_BID, calculatedBid));
  return {
    estimatedTricks,
    recommendedBid,
    spadeStrength: Math.round(spadeStrength * 100) / 100,
    highCardStrength: Math.round(highCardStrength * 100) / 100,
    lengthBonus: Math.round(lengthBonus * 100) / 100,
    voidBonus: Math.round(voidBonus * 100) / 100
  };
}

// src/core/bot/botMemory.ts
function extractPlayedCardIds(completedTricks, currentTrick) {
  const played = /* @__PURE__ */ new Set();
  if (completedTricks) {
    for (const trick of completedTricks) {
      for (const pc of trick.cards) {
        played.add(pc.card.id);
      }
    }
  }
  if (currentTrick) {
    for (const pc of currentTrick.cards) {
      played.add(pc.card.id);
    }
  }
  return played;
}
function isBossCardInSuit(candidateCard, playerHand, playedCardIds) {
  const suit = candidateCard.suit;
  const candidateValue = candidateCard.value;
  const handCardIds = new Set(playerHand.map((c) => c.id));
  for (const rankStr of Object.values(Rank)) {
    const rankValue = RANK_VALUES[rankStr];
    if (rankValue > candidateValue) {
      const cardId = getCardId(suit, rankStr);
      if (!playedCardIds.has(cardId) && !handCardIds.has(cardId)) {
        return false;
      }
    }
  }
  return true;
}
function hasTrumpBeenPlayedInTrick(currentTrick, trumpSuit) {
  if (!currentTrick.cards) return false;
  return currentTrick.cards.some((pc) => pc.card.suit === trumpSuit);
}
function getHighestTrumpInTrick(currentTrick, trumpSuit) {
  if (!currentTrick.cards) return null;
  const trumps = currentTrick.cards.filter((pc) => pc.card.suit === trumpSuit);
  if (trumps.length === 0) return null;
  let highest = trumps[0];
  for (let i = 1; i < trumps.length; i++) {
    if (trumps[i].card.value > highest.card.value) {
      highest = trumps[i];
    }
  }
  return highest;
}

// src/core/bot/botCardPlay.ts
function compareCardsAscending(a, b) {
  if (a.value !== b.value) {
    return a.value - b.value;
  }
  return a.suit.localeCompare(b.suit);
}
function compareCardsDescending(a, b) {
  return compareCardsAscending(b, a);
}
function selectLowestDiscard(legalMoves, trumpSuit) {
  const nonTrumps = legalMoves.filter((c) => c.suit !== trumpSuit);
  if (nonTrumps.length > 0) {
    const sorted = [...nonTrumps].sort(compareCardsAscending);
    return sorted[0];
  }
  const sortedTrumps = [...legalMoves].sort(compareCardsAscending);
  return sortedTrumps[0];
}
function selectMediumCardPlay(context) {
  const {
    hand,
    legalMoves,
    currentTrick,
    trumpSuit,
    playerBid,
    playerTricksWon,
    completedTricks
  } = context;
  if (!legalMoves || legalMoves.length === 0) {
    const fallback = hand[0];
    return {
      card: fallback,
      reasoning: "Failsafe fallback: no legal moves provided"
    };
  }
  if (legalMoves.length === 1) {
    const only = legalMoves[0];
    const isTrump = only.suit === trumpSuit;
    return {
      card: only,
      reasoning: isTrump ? `Forced move: trump with only legal ${only.rank} of ${only.suit}` : `Forced move: only ${only.rank} of ${only.suit} is legal`
    };
  }
  const playedCardIds = extractPlayedCardIds(completedTricks, currentTrick);
  const needsTricks = playerTricksWon < playerBid;
  const isLeading = currentTrick.cards.length === 0 || currentTrick.leadSuit === null;
  if (isLeading) {
    const nonTrumps = legalMoves.filter((c) => c.suit !== trumpSuit);
    const trumps = legalMoves.filter((c) => c.suit === trumpSuit);
    if (needsTricks && nonTrumps.length > 0) {
      const bossNonTrumps = nonTrumps.filter(
        (c) => isBossCardInSuit(c, hand, playedCardIds)
      );
      if (bossNonTrumps.length > 0) {
        const sortedBoss = [...bossNonTrumps].sort(compareCardsDescending);
        const chosen2 = sortedBoss[0];
        return {
          card: chosen2,
          reasoning: `Leading boss ${chosen2.rank} of ${chosen2.suit} to secure trick`
        };
      }
    }
    if (trumps.length >= 4) {
      const bossTrump = trumps.find((c) => isBossCardInSuit(c, hand, playedCardIds));
      if (bossTrump && bossTrump.rank === "A") {
        return {
          card: bossTrump,
          reasoning: `Leading Ace of Spades to draw out opponents' trumps`
        };
      }
    }
    if (nonTrumps.length > 0) {
      const suitCounts = {};
      for (const card of nonTrumps) {
        if (!suitCounts[card.suit]) suitCounts[card.suit] = [];
        suitCounts[card.suit].push(card);
      }
      const longestSuitCards = Object.values(suitCounts).sort(
        (a, b) => b.length - a.length
      )[0];
      const sortedInSuit = [...longestSuitCards].sort(compareCardsAscending);
      const chosen2 = sortedInSuit[0];
      return {
        card: chosen2,
        reasoning: `Leading low card (${chosen2.rank} of ${chosen2.suit}) in safe suit`
      };
    }
    const sortedTrumps = [...trumps].sort(
      needsTricks ? compareCardsDescending : compareCardsAscending
    );
    const chosen = sortedTrumps[0];
    return {
      card: chosen,
      reasoning: needsTricks ? `Leading highest trump (${chosen.rank} of ${chosen.suit}) to win trick` : `Leading lowest trump (${chosen.rank} of ${chosen.suit}) to conserve honors`
    };
  }
  const leadSuit = currentTrick.leadSuit;
  const hasLeadSuit = legalMoves.some((c) => c.suit === leadSuit);
  if (hasLeadSuit) {
    const leadSuitCards = legalMoves.filter((c) => c.suit === leadSuit);
    const trumpAlreadyPlayed = leadSuit !== trumpSuit && hasTrumpBeenPlayedInTrick(currentTrick, trumpSuit);
    if (trumpAlreadyPlayed) {
      const sortedLead2 = [...leadSuitCards].sort(compareCardsAscending);
      const lowestCard2 = sortedLead2[0];
      return {
        card: lowestCard2,
        reasoning: `Trick already trumped by opponent; ducking with lowest ${lowestCard2.rank} of ${leadSuit}`
      };
    }
    const playedLeadCards = currentTrick.cards.filter((pc) => pc.card.suit === leadSuit);
    const highestPlayedLeadCard = playedLeadCards.reduce(
      (prev, curr) => curr.card.value > prev.card.value ? curr : prev,
      playedLeadCards[0]
    );
    const winningCards = leadSuitCards.filter(
      (c) => c.value > highestPlayedLeadCard.card.value
    );
    if (winningCards.length > 0) {
      const sortedWinning = [...winningCards].sort(compareCardsAscending);
      const chosen = sortedWinning[0];
      return {
        card: chosen,
        reasoning: `Playing lowest winning card (${chosen.rank} of ${leadSuit}) over table's ${highestPlayedLeadCard.card.rank}`
      };
    }
    const sortedLead = [...leadSuitCards].sort(compareCardsAscending);
    const lowestCard = sortedLead[0];
    return {
      card: lowestCard,
      reasoning: `Cannot beat table's ${highestPlayedLeadCard.card.rank} of ${leadSuit}; ducking with ${lowestCard.rank}`
    };
  }
  const trumpsInHand = legalMoves.filter((c) => c.suit === trumpSuit);
  const highestTrumpPlayed = getHighestTrumpInTrick(currentTrick, trumpSuit);
  if (highestTrumpPlayed) {
    const higherTrumps = trumpsInHand.filter(
      (c) => c.value > highestTrumpPlayed.card.value
    );
    if (higherTrumps.length > 0) {
      const sortedHigher = [...higherTrumps].sort(compareCardsAscending);
      const chosen = sortedHigher[0];
      return {
        card: chosen,
        reasoning: `Over-trumping with lowest winning Spade (${chosen.rank}) over table's ${highestTrumpPlayed.card.rank}`
      };
    }
    const discardCard2 = selectLowestDiscard(legalMoves, trumpSuit);
    return {
      card: discardCard2,
      reasoning: `Cannot beat table's trump (${highestTrumpPlayed.card.rank} of ${trumpSuit}); discarding ${discardCard2.rank} of ${discardCard2.suit}`
    };
  }
  if (trumpsInHand.length > 0) {
    const sortedTrumps = [...trumpsInHand].sort(compareCardsAscending);
    const lowestTrump = sortedTrumps[0];
    return {
      card: lowestTrump,
      reasoning: `Ruffing with lowest trump (${lowestTrump.rank} of ${trumpSuit}) to win trick`
    };
  }
  const discardCard = selectLowestDiscard(legalMoves, trumpSuit);
  return {
    card: discardCard,
    reasoning: `Void in ${leadSuit}; discarding lowest off-suit card (${discardCard.rank} of ${discardCard.suit})`
  };
}

// src/core/bot/MediumBotStrategy.ts
var MediumBotStrategy = class {
  constructor(options) {
    this.difficulty = "MEDIUM" /* MEDIUM */;
    this.randomSource = options?.randomSource;
  }
  /**
   * Predicts/decides optimal call/bid (1 to 13) for the bot's hand.
   */
  decideBid(hand, context) {
    const evaluation = this.evaluateHand(hand, context);
    return evaluation.recommendedBid;
  }
  /**
   * Decides which legal card to play during the bot's turn.
   */
  decideCardPlay(context) {
    const decision = this.decideCardPlayWithDetails(context);
    return decision.card;
  }
  /**
   * Evaluates hand strength and returns estimated tricks breakdown for testing and diagnostics.
   */
  evaluateHand(hand, context) {
    return evaluateHandStrength(hand, context);
  }
  /**
   * Evaluates card play and returns both the selected card and the strategy reasoning label.
   */
  decideCardPlayWithDetails(context) {
    return selectMediumCardPlay(context);
  }
};

// src/core/state/initialState.ts
function createInitialPlayers() {
  return {
    ["SOUTH" /* SOUTH */]: {
      id: "player_south",
      name: "You",
      type: "HUMAN" /* HUMAN */,
      position: "SOUTH" /* SOUTH */,
      hand: [],
      currentBid: null,
      tricksWon: 0,
      isTurn: false,
      isDealer: false
    },
    ["WEST" /* WEST */]: {
      id: "player_west",
      name: "West Player",
      type: "BOT" /* BOT */,
      position: "WEST" /* WEST */,
      hand: [],
      currentBid: null,
      tricksWon: 0,
      isTurn: false,
      isDealer: false
    },
    ["NORTH" /* NORTH */]: {
      id: "player_north",
      name: "North Player",
      type: "BOT" /* BOT */,
      position: "NORTH" /* NORTH */,
      hand: [],
      currentBid: null,
      tricksWon: 0,
      isTurn: false,
      isDealer: true
      // Round 1 default dealer
    },
    ["EAST" /* EAST */]: {
      id: "player_east",
      name: "East Player",
      type: "BOT" /* BOT */,
      position: "EAST" /* EAST */,
      hand: [],
      currentBid: null,
      tricksWon: 0,
      isTurn: false,
      isDealer: false
    }
  };
}
function createInitialGameState(mode = "OFFLINE_BOTS" /* OFFLINE_BOTS */) {
  const players = createInitialPlayers();
  return {
    matchId: `match_${Date.now()}`,
    mode,
    status: "IDLE" /* IDLE */,
    config: {
      totalRounds: 5,
      trumpSuit: "SPADES" /* SPADES */,
      minBid: 1,
      maxBid: 13,
      cardsPerPlayer: 13
    },
    currentRound: 1,
    dealer: "NORTH" /* NORTH */,
    currentPlayer: "EAST" /* EAST */,
    // Traditional counter-clockwise lead from dealer
    players,
    currentTrick: {
      trickNumber: 1,
      leader: "EAST" /* EAST */,
      leadSuit: null,
      cards: [],
      winner: null
    },
    completedTricks: [],
    roundScores: [],
    cumulativeScores: {
      ["SOUTH" /* SOUTH */]: 0,
      ["WEST" /* WEST */]: 0,
      ["NORTH" /* NORTH */]: 0,
      ["EAST" /* EAST */]: 0
    },
    matchResult: null,
    lastActionMessage: "Phase 1 architectural foundation initialized. Ready for Phase 2 card engine integration."
  };
}

// src/core/state/gameStore.ts
var GameStateStore = class {
  constructor(initialState) {
    this.stateSubscribers = /* @__PURE__ */ new Set();
    this.eventSubscribers = /* @__PURE__ */ new Set();
    this.currentState = initialState ?? createInitialGameState();
  }
  getState() {
    return this.currentState;
  }
  subscribe(listener) {
    this.stateSubscribers.add(listener);
    listener(this.currentState);
    return () => {
      this.stateSubscribers.delete(listener);
    };
  }
  subscribeToEvents(listener) {
    this.eventSubscribers.add(listener);
    return () => {
      this.eventSubscribers.delete(listener);
    };
  }
  setState(updater, event) {
    const nextState = updater(this.currentState);
    if (nextState !== this.currentState) {
      this.currentState = nextState;
      this.notifyStateSubscribers();
    }
    if (event) {
      this.notifyEventSubscribers(event);
    }
  }
  reset(state) {
    this.currentState = state ?? createInitialGameState();
    this.notifyStateSubscribers();
    this.notifyEventSubscribers({
      type: "MATCH_INITIALIZED",
      payload: { matchId: this.currentState.matchId }
    });
  }
  /**
   * Restores a previously saved in-progress game state and notifies listeners.
   */
  restore(state) {
    this.currentState = state;
    this.notifyStateSubscribers();
    this.notifyEventSubscribers({
      type: "MATCH_RESTORED",
      payload: { matchId: this.currentState.matchId, roundNumber: this.currentState.currentRound }
    });
  }
  notifyStateSubscribers() {
    const frozenState = Object.freeze({ ...this.currentState });
    for (const listener of this.stateSubscribers) {
      try {
        listener(frozenState);
      } catch (err) {
        console.error("Error in GameState subscriber:", err);
      }
    }
  }
  notifyEventSubscribers(event) {
    for (const listener of this.eventSubscribers) {
      try {
        listener(event);
      } catch (err) {
        console.error("Error in GameEvent subscriber:", err);
      }
    }
  }
};
var sharedGameStore = new GameStateStore(
  createInitialGameState("ONLINE_MULTIPLAYER" /* ONLINE_MULTIPLAYER */)
);

// src/core/persistence/gameStateValidation.ts
var VALID_POSITIONS = [
  "SOUTH" /* SOUTH */,
  "WEST" /* WEST */,
  "NORTH" /* NORTH */,
  "EAST" /* EAST */
];
var VALID_SUITS = [
  "SPADES" /* SPADES */,
  "HEARTS" /* HEARTS */,
  "DIAMONDS" /* DIAMONDS */,
  "CLUBS" /* CLUBS */
];
var VALID_RANKS = [
  "2" /* TWO */,
  "3" /* THREE */,
  "4" /* FOUR */,
  "5" /* FIVE */,
  "6" /* SIX */,
  "7" /* SEVEN */,
  "8" /* EIGHT */,
  "9" /* NINE */,
  "10" /* TEN */,
  "J" /* JACK */,
  "Q" /* QUEEN */,
  "K" /* KING */,
  "A" /* ACE */
];
var RESUMABLE_STATUSES = [
  "DEALING" /* DEALING */,
  "BIDDING" /* BIDDING */,
  "PLAYING" /* PLAYING */,
  "ROUND_ENDED" /* ROUND_ENDED */
];
function isValidCard2(card) {
  if (!card || typeof card !== "object") return false;
  const c = card;
  return typeof c.id === "string" && c.id.length > 0 && VALID_SUITS.includes(c.suit) && VALID_RANKS.includes(c.rank);
}
function isValidPlayedCard(played) {
  if (!played || typeof played !== "object") return false;
  const p = played;
  return VALID_POSITIONS.includes(p.playerPosition) && isValidCard2(p.card) && typeof p.playedAt === "number";
}
function isValidCurrentTrick(trick) {
  if (!trick || typeof trick !== "object") return false;
  const t = trick;
  if (typeof t.trickNumber !== "number" || t.trickNumber < 1 || t.trickNumber > 13) return false;
  if (!VALID_POSITIONS.includes(t.leader)) return false;
  if (t.leadSuit !== null && !VALID_SUITS.includes(t.leadSuit)) return false;
  if (!Array.isArray(t.cards) || t.cards.length > 4) return false;
  for (const c of t.cards) {
    if (!isValidPlayedCard(c)) return false;
  }
  if (t.winner !== null && !VALID_POSITIONS.includes(t.winner)) return false;
  return true;
}
function isValidCompletedTrick(trick) {
  if (!trick || typeof trick !== "object") return false;
  const t = trick;
  if (typeof t.trickNumber !== "number" || t.trickNumber < 1 || t.trickNumber > 13) return false;
  if (!VALID_POSITIONS.includes(t.leader)) return false;
  if (!VALID_SUITS.includes(t.leadSuit)) return false;
  if (!Array.isArray(t.cards) || t.cards.length !== 4) return false;
  for (const c of t.cards) {
    if (!isValidPlayedCard(c)) return false;
  }
  if (!VALID_POSITIONS.includes(t.winner)) return false;
  return true;
}
function isValidPlayerState(player, expectedPosition) {
  if (!player || typeof player !== "object") return false;
  const p = player;
  if (typeof p.id !== "string" || p.id.length === 0) return false;
  if (typeof p.name !== "string" || p.name.length === 0) return false;
  if (p.position !== expectedPosition) return false;
  if (p.type !== "HUMAN" /* HUMAN */ && p.type !== "BOT" /* BOT */) return false;
  if (!Array.isArray(p.hand)) return false;
  for (const c of p.hand) {
    if (!isValidCard2(c)) return false;
  }
  if (p.currentBid !== null && (typeof p.currentBid !== "number" || p.currentBid < 1 || p.currentBid > 13)) {
    return false;
  }
  if (typeof p.tricksWon !== "number" || p.tricksWon < 0 || p.tricksWon > 13) return false;
  if (typeof p.isTurn !== "boolean") return false;
  if (typeof p.isDealer !== "boolean") return false;
  return true;
}
function validateResumableGameState(raw) {
  if (!raw || typeof raw !== "object") {
    return { isValid: false, state: null, error: "Raw state is not an object" };
  }
  const state = raw;
  if (typeof state.matchId !== "string" || state.matchId.trim().length === 0) {
    return { isValid: false, state: null, error: "Missing or empty matchId" };
  }
  if (!RESUMABLE_STATUSES.includes(state.status)) {
    return {
      isValid: false,
      state: null,
      error: `Status '${String(state.status)}' is not a resumable active game status`
    };
  }
  if (typeof state.currentRound !== "number" || state.currentRound < 1 || state.currentRound > 5) {
    return { isValid: false, state: null, error: `Invalid currentRound: ${String(state.currentRound)}` };
  }
  if (state.config && typeof state.config === "object") {
    const config = state.config;
    if (config.cardsPerPlayer !== 13 || config.trumpSuit !== "SPADES" /* SPADES */) {
      return { isValid: false, state: null, error: "Config values do not match Call Break rules" };
    }
  }
  if (state.dealer !== void 0 && !VALID_POSITIONS.includes(state.dealer)) {
    return { isValid: false, state: null, error: `Invalid dealer: ${String(state.dealer)}` };
  }
  if (state.currentPlayer !== void 0 && !VALID_POSITIONS.includes(state.currentPlayer)) {
    return { isValid: false, state: null, error: `Invalid currentPlayer: ${String(state.currentPlayer)}` };
  }
  if (!state.players) {
    return {
      isValid: true,
      state: raw
    };
  }
  const players = state.players;
  for (const pos of VALID_POSITIONS) {
    if (!isValidPlayerState(players[pos], pos)) {
      return { isValid: false, state: null, error: `Invalid player state for position ${pos}` };
    }
  }
  if (!isValidCurrentTrick(state.currentTrick)) {
    return { isValid: false, state: null, error: "Invalid currentTrick state" };
  }
  if (!Array.isArray(state.completedTricks)) {
    return { isValid: false, state: null, error: "completedTricks must be an array" };
  }
  for (const trick of state.completedTricks) {
    if (!isValidCompletedTrick(trick)) {
      return { isValid: false, state: null, error: "Array contains invalid completed trick" };
    }
  }
  const cardSet = /* @__PURE__ */ new Set();
  let totalCardsCount = 0;
  const registerCard = (card) => {
    const key = `${card.suit}_${card.rank}`;
    if (cardSet.has(key)) {
      return false;
    }
    cardSet.add(key);
    totalCardsCount++;
    return true;
  };
  const playerStates = players;
  for (const pos of VALID_POSITIONS) {
    for (const card of playerStates[pos].hand) {
      if (!registerCard(card)) {
        return { isValid: false, state: null, error: `Duplicate card in circulation: ${card.rank} of ${card.suit}` };
      }
    }
  }
  const isRoundCompleted = state.status === "ROUND_ENDED" /* ROUND_ENDED */ || Array.isArray(state.completedTricks) && state.completedTricks.length >= 13;
  if (!isRoundCompleted) {
    const currentTrick = state.currentTrick;
    for (const played of currentTrick.cards) {
      if (!registerCard(played.card)) {
        return { isValid: false, state: null, error: `Duplicate card in current trick: ${played.card.rank} of ${played.card.suit}` };
      }
    }
  }
  const completedTricks = state.completedTricks;
  for (const trick of completedTricks) {
    for (const played of trick.cards) {
      if (!registerCard(played.card)) {
        return { isValid: false, state: null, error: `Duplicate card in completed trick ${trick.trickNumber}: ${played.card.rank} of ${played.card.suit}` };
      }
    }
  }
  if (state.status !== "DEALING" /* DEALING */ && totalCardsCount !== 52) {
    return {
      isValid: false,
      state: null,
      error: `Card conservation failure: Expected 52 cards in round, found ${totalCardsCount}`
    };
  }
  if (!state.cumulativeScores || typeof state.cumulativeScores !== "object") {
    return { isValid: false, state: null, error: "Missing cumulativeScores" };
  }
  const cumScores = state.cumulativeScores;
  for (const pos of VALID_POSITIONS) {
    if (typeof cumScores[pos] !== "number") {
      return { isValid: false, state: null, error: `Missing cumulativeScore for ${pos}` };
    }
  }
  return {
    isValid: true,
    state: raw
  };
}

// src/services/storage/LocalStorageAdapter.ts
var STORAGE_KEYS = {
  ACTIVE_GAME: "cb_lakdi_active_game_v1",
  HISTORY: "cb_lakdi_history_v1",
  STATISTICS: "cb_lakdi_stats_v1"
};
var LocalStorageAdapter = class {
  isAvailable() {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }
  async saveGame(state) {
    if (!this.isAvailable()) return false;
    if (state.status === "IDLE" /* IDLE */ || state.status === "MATCH_FINISHED" /* MATCH_FINISHED */) {
      await this.clearSavedGame();
      return true;
    }
    try {
      window.localStorage.setItem(STORAGE_KEYS.ACTIVE_GAME, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }
  async loadSavedGame() {
    if (!this.isAvailable()) return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.ACTIVE_GAME);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const validation = validateResumableGameState(parsed);
      if (!validation.isValid || !validation.state) {
        await this.clearSavedGame();
        return null;
      }
      return validation.state;
    } catch {
      await this.clearSavedGame();
      return null;
    }
  }
  async clearSavedGame() {
    if (!this.isAvailable()) return false;
    try {
      window.localStorage.removeItem(STORAGE_KEYS.ACTIVE_GAME);
      return true;
    } catch {
      return false;
    }
  }
  async saveMatchHistory(result) {
    if (!this.isAvailable()) return false;
    try {
      const existing = await this.getMatchHistory();
      const updated = [result, ...existing].slice(0, 50);
      window.localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  }
  async getMatchHistory(limit = 20) {
    if (!this.isAvailable()) return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return parsed.slice(0, limit);
    } catch {
      return [];
    }
  }
  async getStatistics() {
    const defaultStats = {
      matchesPlayed: 0,
      matchesWon: 0,
      roundsPlayed: 0,
      roundsWon: 0,
      totalBidsMade: 0,
      successfulBids: 0,
      highestSingleMatchScore: 0,
      lastPlayedAt: Date.now()
    };
    if (!this.isAvailable()) return defaultStats;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.STATISTICS);
      return raw ? { ...defaultStats, ...JSON.parse(raw) } : defaultStats;
    } catch {
      return defaultStats;
    }
  }
  async updateStatistics(statsUpdate) {
    if (!this.isAvailable()) return false;
    try {
      const current = await this.getStatistics();
      const updated = {
        ...current,
        ...statsUpdate,
        lastPlayedAt: Date.now()
      };
      window.localStorage.setItem(STORAGE_KEYS.STATISTICS, JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  }
};
var sharedLocalStorageAdapter = new LocalStorageAdapter();

// src/core/controller/LocalGameController.ts
var LocalGameController = class {
  constructor(store, deps) {
    // Modular engine injections (Phase 2, 3, 4, 5, 6)
    this.cardEngine = null;
    this.rulesEngine = null;
    this.scoringEngine = null;
    this.botStrategies = /* @__PURE__ */ new Map();
    this.defaultBotStrategy = new MediumBotStrategy();
    this.persistenceAdapter = null;
    this.rebidListeners = [];
    this.store = store;
    if (deps?.cardEngine) this.cardEngine = deps.cardEngine;
    if (deps?.rulesEngine) this.rulesEngine = deps.rulesEngine;
    if (deps?.scoringEngine) this.scoringEngine = deps.scoringEngine;
    if (deps?.botStrategy) this.defaultBotStrategy = deps.botStrategy;
    if (deps?.botStrategies) {
      for (const [pos, strat] of Object.entries(deps.botStrategies)) {
        if (strat) {
          this.botStrategies.set(pos, strat);
        }
      }
    }
    if (deps?.persistenceAdapter) {
      this.persistenceAdapter = deps.persistenceAdapter;
    } else if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      this.persistenceAdapter = sharedLocalStorageAdapter;
    }
  }
  /**
   * Automatically persists active game state to persistence adapter at state boundaries.
   * Clears saved state when match is finished or uninitialized (IDLE).
   */
  persistState(state) {
    if (!this.persistenceAdapter) return;
    if (state.status === "IDLE" /* IDLE */ || state.status === "MATCH_FINISHED" /* MATCH_FINISHED */) {
      this.persistenceAdapter.clearSavedGame().catch(() => {
      });
    } else {
      this.persistenceAdapter.saveGame(state).catch(() => {
      });
    }
  }
  /**
   * Registers or updates the Card Engine when implemented in Phase 2.
   */
  bindCardEngine(engine) {
    this.cardEngine = engine;
  }
  /**
   * Registers or updates the Rules Engine when implemented in Phase 3.
   */
  bindRulesEngine(engine) {
    this.rulesEngine = engine;
  }
  /**
   * Registers or updates the Scoring Engine implemented in Phase 4.
   */
  bindScoringEngine(engine) {
    this.scoringEngine = engine;
  }
  /**
   * Registers or updates Bot Strategies when implemented in Phase 5.
   */
  bindBotStrategy(position, strategy) {
    this.botStrategies.set(position, strategy);
  }
  /**
   * Registers persistence adapter when implemented in Phase 6.
   */
  bindPersistenceAdapter(adapter) {
    this.persistenceAdapter = adapter;
  }
  /**
   * Subscribes to re-bid events triggered when sum(bids) <= 8.
   */
  onRebid(listener) {
    this.rebidListeners.push(listener);
    return () => {
      const idx = this.rebidListeners.indexOf(listener);
      if (idx >= 0) this.rebidListeners.splice(idx, 1);
    };
  }
  /**
   * Restores a previously saved in-progress match from the persistence adapter into the store.
   * Returns true if restored successfully, false otherwise.
   */
  async restoreSavedGame() {
    if (!this.persistenceAdapter) {
      return false;
    }
    try {
      const saved = await this.persistenceAdapter.loadSavedGame();
      if (!saved) {
        return false;
      }
      const sanitizedPlayers = saved.mode === "OFFLINE_BOTS" /* OFFLINE_BOTS */ ? {
        ...saved.players,
        ["SOUTH" /* SOUTH */]: { ...saved.players["SOUTH" /* SOUTH */], name: "You" },
        ["WEST" /* WEST */]: { ...saved.players["WEST" /* WEST */], name: "West Player" },
        ["NORTH" /* NORTH */]: { ...saved.players["NORTH" /* NORTH */], name: "North Player" },
        ["EAST" /* EAST */]: { ...saved.players["EAST" /* EAST */], name: "East Player" }
      } : saved.players;
      const sanitizedSaved = {
        ...saved,
        config: {
          ...saved.config,
          enableRebiddingRule: false
        },
        players: sanitizedPlayers
      };
      if (typeof this.store.restore === "function") {
        this.store.restore(sanitizedSaved);
      } else {
        this.store.setState(() => sanitizedSaved, {
          type: "MATCH_RESTORED",
          payload: {
            matchId: sanitizedSaved.matchId,
            roundNumber: sanitizedSaved.currentRound
          }
        });
      }
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Checks whether a valid in-progress saved game exists.
   */
  async hasSavedGame() {
    if (!this.persistenceAdapter) return false;
    try {
      const saved = await this.persistenceAdapter.loadSavedGame();
      return saved !== null;
    } catch {
      return false;
    }
  }
  /**
   * Clears any saved in-progress game.
   */
  async clearSavedGame() {
    if (!this.persistenceAdapter) return false;
    try {
      return await this.persistenceAdapter.clearSavedGame();
    } catch {
      return false;
    }
  }
  /**
   * Explicitly persists the current store state if in-progress.
   */
  async saveCurrentGame() {
    if (!this.persistenceAdapter) return false;
    try {
      return await this.persistenceAdapter.saveGame(this.store.getState());
    } catch {
      return false;
    }
  }
  /**
   * Retrieves the current saved in-progress game state without loading it into the store.
   */
  async getSavedGame() {
    if (!this.persistenceAdapter) return null;
    try {
      return await this.persistenceAdapter.loadSavedGame();
    } catch {
      return null;
    }
  }
  initMatch(mode = "OFFLINE_BOTS" /* OFFLINE_BOTS */, enableRebiddingRule = false, totalRounds = 5) {
    const rawState = createInitialGameState(mode);
    const userSavedName = typeof window !== "undefined" ? (localStorage.getItem("cb_player_name") || "").trim() : "";
    const southBase = userSavedName && !/^(host|player|you)$/i.test(userSavedName) ? userSavedName : "Host";
    const finalSouthName = `${southBase} (You)`;
    const players = mode === "OFFLINE_BOTS" /* OFFLINE_BOTS */ ? {
      ["SOUTH" /* SOUTH */]: {
        ...rawState.players["SOUTH" /* SOUTH */],
        name: "You"
      },
      ["WEST" /* WEST */]: {
        ...rawState.players["WEST" /* WEST */],
        name: "West Player"
      },
      ["NORTH" /* NORTH */]: {
        ...rawState.players["NORTH" /* NORTH */],
        name: "North Player"
      },
      ["EAST" /* EAST */]: {
        ...rawState.players["EAST" /* EAST */],
        name: "East Player"
      }
    } : {
      ...rawState.players,
      ["SOUTH" /* SOUTH */]: {
        ...rawState.players.SOUTH,
        name: finalSouthName
      }
    };
    const freshState = {
      ...rawState,
      config: {
        ...rawState.config,
        totalRounds: totalRounds === 10 ? 10 : 5,
        ...enableRebiddingRule ? { enableRebiddingRule: true } : {}
      },
      players
    };
    this.store.reset(freshState);
    this.persistState(freshState);
  }
  /**
   * Starts a completely fresh match and immediately initializes Round 1.
   */
  startNewMatch(mode = "OFFLINE_BOTS" /* OFFLINE_BOTS */, enableRebiddingRule = false, totalRounds = 5) {
    this.initMatch(mode, enableRebiddingRule, totalRounds);
    this.startRound();
  }
  startRound() {
    const current = this.store.getState();
    if (current.status === "DEALING" /* DEALING */ || current.status === "PLAYING" /* PLAYING */) {
      return;
    }
    if (this.cardEngine && this.rulesEngine) {
      const initializedState = this.rulesEngine.initializeRound(current, this.cardEngine);
      this.store.setState(() => initializedState, {
        type: "ROUND_STARTED",
        payload: {
          roundNumber: initializedState.currentRound,
          dealer: initializedState.dealer
        }
      });
      this.persistState(initializedState);
      return;
    }
    this.store.setState(
      (prev) => ({
        ...prev,
        status: "DEALING" /* DEALING */,
        lastActionMessage: `Round ${prev.currentRound} of 5 initiated. Awaiting Phase 2 Card Engine dealing.`
      }),
      {
        type: "ROUND_STARTED",
        payload: {
          roundNumber: current.currentRound,
          dealer: current.dealer
        }
      }
    );
    this.persistState(this.store.getState());
  }
  submitBid(position, bid) {
    const current = this.store.getState();
    if (this.rulesEngine) {
      const validation = this.rulesEngine.validateBid(bid, position, current);
      if (!validation.isValid) {
        return false;
      }
      const nextState = this.rulesEngine.applyBid(current, position, bid);
      this.store.setState(() => nextState, {
        type: "BID_PLACED",
        payload: { playerPosition: position, bid }
      });
      if (nextState.config.enableRebiddingRule && this.rulesEngine.isRebidRequired && this.rulesEngine.isRebidRequired(nextState)) {
        const totalBids = this.rulesEngine.getTotalBids(nextState);
        const rebidMessage = `Total bids = ${totalBids} (\u2264 8). Minimum bid total not reached. Re-bidding round!`;
        if (this.cardEngine) {
          const redealtState = this.rulesEngine.redealRound(nextState, this.cardEngine);
          this.store.setState(() => redealtState, {
            type: "ROUND_STARTED",
            payload: {
              roundNumber: redealtState.currentRound,
              dealer: redealtState.dealer
            }
          });
          this.persistState(redealtState);
          for (const listener of this.rebidListeners) {
            try {
              listener(totalBids, rebidMessage);
            } catch (err) {
              console.error("Error in rebid listener:", err);
            }
          }
          if (this.rulesEngine) {
            const expected = this.rulesEngine.getExpectedBiddingPlayer(redealtState);
            if (expected && this.isBotPlayer(expected)) {
              this.stepBotTurn();
            }
          }
          return true;
        }
      }
      this.persistState(nextState);
      return true;
    }
    if (bid < current.config.minBid || bid > current.config.maxBid) {
      return false;
    }
    this.store.setState(
      (prev) => {
        const player = prev.players[position];
        if (!player) return prev;
        return {
          ...prev,
          players: {
            ...prev.players,
            [position]: {
              ...player,
              currentBid: bid
            }
          },
          lastActionMessage: `${player.name} bid ${bid} tricks.`
        };
      },
      {
        type: "BID_PLACED",
        payload: { playerPosition: position, bid }
      }
    );
    this.persistState(this.store.getState());
    return true;
  }
  playCard(position, card) {
    const current = this.store.getState();
    if (this.rulesEngine) {
      const validation = this.rulesEngine.isLegalPlay(current, position, card);
      if (!validation.isValid) {
        return false;
      }
      const nextState = this.rulesEngine.applyCardPlay(current, position, card);
      this.store.setState(() => nextState, {
        type: "CARD_PLAYED",
        payload: { playerPosition: position, card }
      });
      this.persistState(nextState);
      return true;
    }
    if (current.status !== "PLAYING" /* PLAYING */) {
      return false;
    }
    this.store.setState(
      (prev) => ({
        ...prev,
        lastActionMessage: `${prev.players[position]?.name ?? position} played ${card.rank} of ${card.suit}.`
      }),
      {
        type: "CARD_PLAYED",
        payload: { playerPosition: position, card }
      }
    );
    this.persistState(this.store.getState());
    return true;
  }
  resolveTrick() {
    const current = this.store.getState();
    if (this.rulesEngine && current.currentTrick.cards.length === 4) {
      const nextState = this.rulesEngine.resolveCurrentTrick(current);
      const lastCompletedTrick = nextState.completedTricks[nextState.completedTricks.length - 1];
      this.store.setState(() => nextState, {
        type: "TRICK_COMPLETED",
        payload: {
          trick: lastCompletedTrick
        }
      });
      this.persistState(nextState);
      return;
    }
    this.store.setState((prev) => ({
      ...prev,
      lastActionMessage: "Trick resolution triggered."
    }));
  }
  completeRound() {
    const current = this.store.getState();
    if (this.scoringEngine) {
      if (current.roundScores.some((r) => r.roundNumber === current.currentRound)) {
        return;
      }
      const nextState = this.scoringEngine.applyRoundScoresToState(current);
      const latestRoundScore = nextState.roundScores[nextState.roundScores.length - 1];
      this.store.setState(() => nextState, {
        type: "ROUND_COMPLETED",
        payload: {
          roundNumber: current.currentRound,
          roundScore: latestRoundScore
        }
      });
      if (nextState.status === "MATCH_FINISHED" /* MATCH_FINISHED */ && nextState.matchResult) {
        this.store.setState((prev) => prev, {
          type: "MATCH_COMPLETED",
          payload: {
            result: nextState.matchResult
          }
        });
      }
      this.persistState(nextState);
      return;
    }
    this.store.setState((prev) => ({
      ...prev,
      status: "ROUND_ENDED" /* ROUND_ENDED */,
      lastActionMessage: `Round ${prev.currentRound} complete. Awaiting scoring calculation.`
    }));
    this.persistState(this.store.getState());
  }
  resetMatch() {
    this.initMatch();
  }
  /**
   * Transitions to the next round (2 to 5):
   * 1. Verifies current round is complete and scored
   * 2. Increments round number
   * 3. Initializes fresh round via RulesEngine & CardEngine (dealer rotation, fresh deal)
   * 4. Preserves cumulative scores and previous round records
   */
  nextRound() {
    const current = this.store.getState();
    if (current.status !== "ROUND_ENDED" /* ROUND_ENDED */) {
      return false;
    }
    if (current.currentRound >= current.config.totalRounds) {
      return false;
    }
    const nextRoundNumber = current.currentRound + 1;
    const stateForNextRound = {
      ...current,
      currentRound: nextRoundNumber
    };
    if (this.cardEngine && this.rulesEngine) {
      const initializedState = this.rulesEngine.initializeRound(
        stateForNextRound,
        this.cardEngine
      );
      this.store.setState(() => initializedState, {
        type: "ROUND_STARTED",
        payload: {
          roundNumber: initializedState.currentRound,
          dealer: initializedState.dealer
        }
      });
      this.persistState(initializedState);
      return true;
    }
    return false;
  }
  /**
   * Retrieves authoritative legal moves for a given player position from the RulesEngine.
   */
  getLegalMovesForPlayer(position) {
    const current = this.store.getState();
    const player = current.players[position];
    if (!player || !this.rulesEngine) {
      return [];
    }
    return this.rulesEngine.getLegalMoves(
      player.hand,
      current.currentTrick,
      current.config.trumpSuit
    );
  }
  /**
   * Retrieves the configured bot strategy for the player position,
   * falling back to the default strategy if not specifically assigned.
   */
  getBotStrategy(position) {
    return this.botStrategies.get(position) ?? this.defaultBotStrategy;
  }
  /**
   * Determines if the specified player position is managed by a bot.
   */
  isBotPlayer(position) {
    const current = this.store.getState();
    const player = current.players[position];
    if (player) {
      return player.type === "BOT" /* BOT */;
    }
    return position !== "SOUTH" /* SOUTH */;
  }
  /**
   * Executes an automated bid for a bot player during BIDDING phase.
   */
  executeBotBid(position) {
    const current = this.store.getState();
    if (current.status !== "BIDDING" /* BIDDING */) {
      return false;
    }
    if (this.rulesEngine) {
      const expected = this.rulesEngine.getExpectedBiddingPlayer(current);
      if (expected !== position) {
        return false;
      }
    }
    const playerState = current.players[position];
    if (!playerState || playerState.currentBid !== null) {
      return false;
    }
    const strategy = this.getBotStrategy(position);
    const existingBids = {
      ["SOUTH" /* SOUTH */]: current.players.SOUTH.currentBid,
      ["WEST" /* WEST */]: current.players.WEST.currentBid,
      ["NORTH" /* NORTH */]: current.players.NORTH.currentBid,
      ["EAST" /* EAST */]: current.players.EAST.currentBid
    };
    const context = {
      position,
      dealer: current.dealer,
      existingBids,
      trumpSuit: current.config.trumpSuit
    };
    const bidResult = strategy.decideBid(playerState.hand, context);
    const bid = typeof bidResult === "number" ? bidResult : 1;
    return this.submitBid(position, bid);
  }
  /**
   * Executes an automated card play for a bot player during PLAYING phase.
   */
  executeBotCardPlay(position) {
    const current = this.store.getState();
    if (current.status !== "PLAYING" /* PLAYING */) {
      return false;
    }
    if (current.currentPlayer !== position) {
      return false;
    }
    if (current.currentTrick.cards.length >= 4) {
      return false;
    }
    const playerState = current.players[position];
    if (!playerState || playerState.hand.length === 0) {
      return false;
    }
    const legalMoves = this.rulesEngine ? this.rulesEngine.getLegalMoves(
      playerState.hand,
      current.currentTrick,
      current.config.trumpSuit
    ) : playerState.hand;
    if (legalMoves.length === 0) {
      return false;
    }
    const remainingCardsCount = {
      ["SOUTH" /* SOUTH */]: current.players.SOUTH.hand.length,
      ["WEST" /* WEST */]: current.players.WEST.hand.length,
      ["NORTH" /* NORTH */]: current.players.NORTH.hand.length,
      ["EAST" /* EAST */]: current.players.EAST.hand.length
    };
    const context = {
      position,
      hand: playerState.hand,
      legalMoves,
      currentTrick: current.currentTrick,
      trumpSuit: current.config.trumpSuit,
      playerBid: playerState.currentBid ?? 1,
      playerTricksWon: playerState.tricksWon,
      remainingCardsCount,
      completedTricks: current.completedTricks
    };
    const strategy = this.getBotStrategy(position);
    const cardResult = strategy.decideCardPlay(context);
    const cardToPlay = "id" in cardResult ? cardResult : legalMoves[0];
    return this.playCard(position, cardToPlay);
  }
  /**
   * Advances the match if the current turn belongs to a bot or if a trick is ready for resolution.
   * Returns true if an action was performed; false if waiting for human input or match not active.
   */
  stepBotTurn() {
    const current = this.store.getState();
    if (current.status === "BIDDING" /* BIDDING */) {
      const expectedBidder = this.rulesEngine ? this.rulesEngine.getExpectedBiddingPlayer(current) : null;
      if (expectedBidder && this.isBotPlayer(expectedBidder)) {
        return this.executeBotBid(expectedBidder);
      }
      return false;
    }
    if (current.status === "PLAYING" /* PLAYING */) {
      if (current.currentTrick.cards.length === 4) {
        this.resolveTrick();
        return true;
      }
      if (this.isBotPlayer(current.currentPlayer)) {
        return this.executeBotCardPlay(current.currentPlayer);
      }
      return false;
    }
    if (current.status === "ROUND_ENDED" /* ROUND_ENDED */ && this.scoringEngine) {
      const alreadyScored = current.roundScores.some(
        (r) => r.roundNumber === current.currentRound
      );
      if (!alreadyScored) {
        this.completeRound();
        return true;
      }
      return false;
    }
    return false;
  }
};

// server/src/AuthoritativeGameController.ts
var MAIN_TURN_SECONDS = 20;
var EXTRA_TURN_SECONDS = 10;
var HOST_EXTRA_TURN_SECONDS = 20;
var POSITIONS = [
  "SOUTH" /* SOUTH */,
  "WEST" /* WEST */,
  "NORTH" /* NORTH */,
  "EAST" /* EAST */
];
var AuthoritativeGameController = class {
  constructor() {
    this.eventListeners = [];
    this.stateListeners = [];
    this.timerListeners = [];
    this.rebidListeners = [];
    this.timeoutTakeoverListeners = [];
    this.botTimer = null;
    this.turnTimerInterval = null;
    this.roundTransitionTimer = null;
    this.currentTimerPlayer = null;
    this.remainingSeconds = MAIN_TURN_SECONDS;
    this.isExtraTime = false;
    this.isMatchTurnProgressionStarted = false;
    this.unsubscribeStore = null;
    this.hostPositionProvider = null;
    this.store = new GameStateStore(createInitialGameState("ONLINE_MULTIPLAYER" /* ONLINE_MULTIPLAYER */));
    this.controller = new LocalGameController(this.store, {
      cardEngine: new CardEngine(),
      rulesEngine: new CallBreakRulesEngine(),
      scoringEngine: new ScoringEngine(),
      botStrategy: new MediumBotStrategy()
    });
    this.controller.onRebid((totalBids, message) => {
      for (const listener of this.rebidListeners) {
        try {
          listener({ totalBids, message });
        } catch (err) {
          console.error("Error in rebid listener:", err);
        }
      }
    });
    this.unsubscribeStore = this.store.subscribe((state) => {
      for (const listener of this.stateListeners) {
        try {
          listener(state);
        } catch (err) {
          console.error("Error in state listener:", err);
        }
      }
    });
    const unsubEvents = this.store.subscribeToEvents((event) => {
      for (const listener of this.eventListeners) {
        try {
          listener(event);
        } catch (err) {
          console.error("Error in event listener:", err);
        }
      }
    });
    const origUnsub = this.unsubscribeStore;
    this.unsubscribeStore = () => {
      origUnsub();
      unsubEvents();
    };
  }
  onEvent(listener) {
    this.eventListeners.push(listener);
    return () => {
      const idx = this.eventListeners.indexOf(listener);
      if (idx >= 0) this.eventListeners.splice(idx, 1);
    };
  }
  onStateChange(listener) {
    this.stateListeners.push(listener);
    return () => {
      const idx = this.stateListeners.indexOf(listener);
      if (idx >= 0) this.stateListeners.splice(idx, 1);
    };
  }
  onTimerTick(listener) {
    this.timerListeners.push(listener);
    return () => {
      const idx = this.timerListeners.indexOf(listener);
      if (idx >= 0) this.timerListeners.splice(idx, 1);
    };
  }
  onRebid(listener) {
    this.rebidListeners.push(listener);
    return () => {
      const idx = this.rebidListeners.indexOf(listener);
      if (idx >= 0) this.rebidListeners.splice(idx, 1);
    };
  }
  onTimeoutTakeover(listener) {
    this.timeoutTakeoverListeners.push(listener);
    return () => {
      const idx = this.timeoutTakeoverListeners.indexOf(listener);
      if (idx >= 0) this.timeoutTakeoverListeners.splice(idx, 1);
    };
  }
  /**
   * Sets the authoritative host check provider from RoomManager.
   */
  setHostPositionProvider(provider) {
    this.hostPositionProvider = provider;
  }
  /**
   * Checks whether the specified position is the authoritative human host.
   * A bot can NEVER be considered a host human.
   */
  isHostPosition(position) {
    const player = this.store.getState().players[position];
    if (!player || player.type === "BOT" /* BOT */) {
      return false;
    }
    return this.hostPositionProvider ? this.hostPositionProvider(position) : false;
  }
  /**
   * Returns extra turn duration: 10s for normal players, 30s (10s + 20s) for the human host.
   */
  getExtraTurnSeconds(position) {
    return this.isHostPosition(position) ? EXTRA_TURN_SECONDS + HOST_EXTRA_TURN_SECONDS : EXTRA_TURN_SECONDS;
  }
  notifyTimeoutTakeover(position) {
    for (const listener of this.timeoutTakeoverListeners) {
      try {
        listener(position);
      } catch (err) {
        console.error("Error in timeout takeover listener:", err);
      }
    }
  }
  broadcastTimerTick(position, remaining, total, extra) {
    const payload = {
      position,
      rawPosition: position,
      remainingSec: remaining,
      totalSec: total,
      isExtraTime: extra
    };
    for (const listener of this.timerListeners) {
      try {
        listener(payload);
      } catch (err) {
        console.error("Error in timer listener:", err);
      }
    }
  }
  getState() {
    return this.store.getState();
  }
  /**
   * Initializes a multiplayer match with assigned players and starts Round 1.
   * STRICT MULTIPLAYER FAIRNESS GUARD:
   * GameMode is set to ONLINE_MULTIPLAYER, ensuring 100% unweighted uniform random
   * cryptographic Fisher-Yates dealing with zero card bias or player favoritism.
   */
  initializeMatch(players, totalRounds = 5, autoStartProgression = false) {
    const rawState = createInitialGameState("ONLINE_MULTIPLAYER" /* ONLINE_MULTIPLAYER */);
    const configuredPlayers = {
      ["SOUTH" /* SOUTH */]: {
        ...rawState.players.SOUTH,
        id: players["SOUTH" /* SOUTH */].id,
        name: players["SOUTH" /* SOUTH */].name,
        type: players["SOUTH" /* SOUTH */].isBot ? "BOT" /* BOT */ : "HUMAN" /* HUMAN */
      },
      ["WEST" /* WEST */]: {
        ...rawState.players.WEST,
        id: players["WEST" /* WEST */].id,
        name: players["WEST" /* WEST */].name,
        type: players["WEST" /* WEST */].isBot ? "BOT" /* BOT */ : "HUMAN" /* HUMAN */
      },
      ["NORTH" /* NORTH */]: {
        ...rawState.players.NORTH,
        id: players["NORTH" /* NORTH */].id,
        name: players["NORTH" /* NORTH */].name,
        type: players["NORTH" /* NORTH */].isBot ? "BOT" /* BOT */ : "HUMAN" /* HUMAN */
      },
      ["EAST" /* EAST */]: {
        ...rawState.players.EAST,
        id: players["EAST" /* EAST */].id,
        name: players["EAST" /* EAST */].name,
        type: players["EAST" /* EAST */].isBot ? "BOT" /* BOT */ : "HUMAN" /* HUMAN */
      }
    };
    const nextState = {
      ...rawState,
      config: {
        ...rawState.config,
        totalRounds: totalRounds === 10 ? 10 : 5,
        enableRebiddingRule: true
      },
      players: configuredPlayers
    };
    this.isMatchTurnProgressionStarted = false;
    this.store.reset(nextState);
    this.controller.startRound();
    if (autoStartProgression) {
      this.startTurnProgression();
    }
  }
  /**
   * Starts turn progression / bot stepping after clients have confirmed readiness.
   * Safe to call multiple times (idempotent).
   */
  startTurnProgression() {
    if (this.isMatchTurnProgressionStarted) return;
    this.isMatchTurnProgressionStarted = true;
    this.advanceTurnOrStepBot();
  }
  submitBid(position, bid) {
    const success = this.controller.submitBid(position, bid);
    if (success) {
      this.advanceTurnOrStepBot();
    }
    return success;
  }
  playCard(position, card) {
    const success = this.controller.playCard(position, card);
    if (success) {
      this.handlePostActionState();
    }
    return success;
  }
  nextRound() {
    this.clearRoundTransitionTimer();
    const state = this.store.getState();
    if (state.status !== "ROUND_ENDED" /* ROUND_ENDED */ || state.currentRound >= state.config.totalRounds) {
      return false;
    }
    const success = this.controller.nextRound();
    if (success) {
      this.advanceTurnOrStepBot();
    }
    return success;
  }
  /**
   * Alias for nextRound() to advance to the next round.
   */
  startNextRound() {
    return this.nextRound();
  }
  /**
   * Resets and clears any pending automatic round transition timer.
   */
  clearRoundTransitionTimer() {
    if (this.roundTransitionTimer) {
      clearTimeout(this.roundTransitionTimer);
      this.roundTransitionTimer = null;
    }
  }
  /**
   * Schedules authoritative server-side auto-transition to the next round after displaying the round summary.
   */
  scheduleNextRoundAutoTransition(delayMs = 4e3) {
    this.clearRoundTransitionTimer();
    this.roundTransitionTimer = setTimeout(() => {
      this.roundTransitionTimer = null;
      const state = this.store.getState();
      if (state.status === "ROUND_ENDED" /* ROUND_ENDED */ && state.currentRound < state.config.totalRounds) {
        this.startNextRound();
      }
    }, delayMs);
  }
  /**
   * Handles post-card-play and post-bot-step state inspection for round ends and trick resolutions.
   */
  handlePostActionState() {
    const state = this.store.getState();
    if (state.status === "ROUND_ENDED" /* ROUND_ENDED */) {
      this.clearTurnTimer();
      try {
        this.controller.completeRound();
      } catch (err) {
        console.error("Error completing round scoring:", err);
      }
      const scoredState = this.store.getState();
      if (scoredState.status === "ROUND_ENDED" /* ROUND_ENDED */ && scoredState.currentRound < scoredState.config.totalRounds) {
        this.scheduleNextRoundAutoTransition(4e3);
      }
      return;
    }
    if (state.status === "MATCH_FINISHED" /* MATCH_FINISHED */) {
      this.clearTurnTimer();
      this.clearRoundTransitionTimer();
      return;
    }
    if (state.currentTrick.cards.length === 4) {
      this.clearTurnTimer();
      this.scheduleTrickResolution();
      return;
    }
    this.advanceTurnOrStepBot();
  }
  /**
   * Starts or restarts the turn timer for the given active human player:
   * Main time: 20s
   * Extra time: 10s (Non-host) or 30s (Host, which is 10s + 20s)
   * Total allowance: 30s (Non-host) or 50s (Host)
   */
  startTurnTimer(position) {
    this.clearTurnTimer();
    this.currentTimerPlayer = position;
    this.remainingSeconds = MAIN_TURN_SECONDS;
    this.isExtraTime = false;
    this.broadcastTimerTick(position, MAIN_TURN_SECONDS, MAIN_TURN_SECONDS, false);
    this.turnTimerInterval = setInterval(() => {
      this.remainingSeconds--;
      if (!this.isExtraTime) {
        if (this.remainingSeconds > 0) {
          this.broadcastTimerTick(position, this.remainingSeconds, MAIN_TURN_SECONDS, false);
        } else {
          this.isExtraTime = true;
          const extraSeconds = this.getExtraTurnSeconds(position);
          this.remainingSeconds = extraSeconds;
          this.broadcastTimerTick(position, extraSeconds, extraSeconds, true);
        }
      } else {
        const extraSeconds = this.getExtraTurnSeconds(position);
        if (this.remainingSeconds > extraSeconds) {
          this.remainingSeconds = extraSeconds;
        }
        if (this.remainingSeconds > 0) {
          this.broadcastTimerTick(position, this.remainingSeconds, extraSeconds, true);
        } else {
          this.clearTurnTimer();
          this.handleTurnTimeout(position);
        }
      }
    }, 1e3);
  }
  /**
   * Resets and clears the turn timer interval, notifying listeners that timer stopped.
   */
  clearTurnTimer() {
    if (this.turnTimerInterval) {
      clearInterval(this.turnTimerInterval);
      this.turnTimerInterval = null;
    }
    if (this.currentTimerPlayer) {
      this.broadcastTimerTick(this.currentTimerPlayer, 0, MAIN_TURN_SECONDS, false);
      this.currentTimerPlayer = null;
    }
  }
  /**
   * Executes authoritative auto-timeout action when total allowance (30s non-host, 50s host) expires:
   * 1. Converts the seat's controller state to isBot: true (PlayerType.BOT) keeping cards, bid, and tricks intact.
   * 2. Requests an optimal legal move from the strong bot strategy (with lowest legal card as emergency fallback).
   * 3. Plays that move immediately without stalling.
   * 4. Subsequent turns for this seat continue automatically under bot control.
   */
  handleTurnTimeout(position) {
    const state = this.store.getState();
    if (state.currentPlayer !== position) return;
    const existingPlayer = state.players[position];
    if (existingPlayer && existingPlayer.type !== "BOT" /* BOT */) {
      const updatedPlayer = {
        ...existingPlayer,
        type: "BOT" /* BOT */
      };
      this.store.reset({
        ...state,
        players: {
          ...state.players,
          [position]: updatedPlayer
        }
      });
      this.controller.bindBotStrategy(position, new MediumBotStrategy());
      this.notifyTimeoutTakeover(position);
    }
    const currentState = this.store.getState();
    const player = currentState.players[position];
    if (!player) return;
    if (currentState.status === "BIDDING" /* BIDDING */) {
      let safeBid = 1;
      try {
        const existingBids = {
          ["SOUTH" /* SOUTH */]: currentState.players["SOUTH" /* SOUTH */].currentBid,
          ["WEST" /* WEST */]: currentState.players["WEST" /* WEST */].currentBid,
          ["NORTH" /* NORTH */]: currentState.players["NORTH" /* NORTH */].currentBid,
          ["EAST" /* EAST */]: currentState.players["EAST" /* EAST */].currentBid
        };
        const strategy = new MediumBotStrategy();
        const decided = strategy.decideBid(player.hand, {
          position,
          dealer: currentState.dealer,
          existingBids,
          trumpSuit: currentState.config.trumpSuit
        });
        safeBid = typeof decided === "number" ? decided : 1;
      } catch {
        safeBid = 1;
      }
      const finalBid = Math.max(currentState.config.minBid, Math.min(currentState.config.maxBid, safeBid || 1));
      this.submitBid(position, finalBid);
    } else if (currentState.status === "PLAYING" /* PLAYING */) {
      const rulesEngine = new CallBreakRulesEngine();
      const legalMoves = rulesEngine.getLegalMoves(player.hand, currentState.currentTrick, currentState.config.trumpSuit);
      if (legalMoves.length > 0) {
        let cardToPlay = null;
        try {
          const remainingCardsCount = {
            ["SOUTH" /* SOUTH */]: currentState.players["SOUTH" /* SOUTH */].hand.length,
            ["WEST" /* WEST */]: currentState.players["WEST" /* WEST */].hand.length,
            ["NORTH" /* NORTH */]: currentState.players["NORTH" /* NORTH */].hand.length,
            ["EAST" /* EAST */]: currentState.players["EAST" /* EAST */].hand.length
          };
          const context = {
            position,
            hand: player.hand,
            legalMoves,
            currentTrick: currentState.currentTrick,
            trumpSuit: currentState.config.trumpSuit,
            playerBid: player.currentBid ?? 1,
            playerTricksWon: player.tricksWon,
            remainingCardsCount,
            completedTricks: currentState.completedTricks
          };
          const strategy = new MediumBotStrategy();
          const decision = strategy.decideCardPlay(context);
          if (decision && legalMoves.some((c) => c.suit === decision.suit && c.rank === decision.rank)) {
            cardToPlay = decision;
          }
        } catch {
          cardToPlay = null;
        }
        if (!cardToPlay) {
          const sorted = [...legalMoves].sort((a, b) => a.value - b.value);
          cardToPlay = sorted[0];
        }
        this.playCard(position, cardToPlay);
      }
    }
  }
  /**
   * Centralized turn driver: clears timers, evaluates active player,
   * schedules bot decision if BOT, or initiates 45s+15s timer if HUMAN.
   */
  advanceTurnOrStepBot() {
    this.clearTurnTimer();
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    const state = this.store.getState();
    if (state.status === "BIDDING" /* BIDDING */ || state.status === "PLAYING" /* PLAYING */) {
      if (state.currentTrick.cards.length === 4) {
        return;
      }
      const activePlayer = state.players[state.currentPlayer];
      if (activePlayer && activePlayer.type === "BOT" /* BOT */) {
        this.scheduleBotStep();
      } else if (activePlayer) {
        this.startTurnTimer(state.currentPlayer);
      }
    }
  }
  scheduleBotStep() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    const state = this.store.getState();
    if (state.status === "BIDDING" /* BIDDING */ || state.status === "PLAYING" /* PLAYING */) {
      if (state.currentTrick.cards.length === 4) {
        return;
      }
      this.botTimer = setTimeout(() => {
        this.botTimer = null;
        const didStep = this.controller.stepBotTurn();
        if (didStep) {
          this.handlePostActionState();
        }
      }, 550);
    }
  }
  scheduleTrickResolution() {
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      this.controller.resolveTrick();
      const state = this.store.getState();
      if (state.status === "ROUND_ENDED" /* ROUND_ENDED */) {
        try {
          this.controller.completeRound();
        } catch (err) {
          console.error("Error completing round scoring in trick resolution:", err);
        }
        const scoredState = this.store.getState();
        if (scoredState.status === "ROUND_ENDED" /* ROUND_ENDED */ && scoredState.currentRound < scoredState.config.totalRounds) {
          this.scheduleNextRoundAutoTransition(4e3);
        }
      } else {
        this.advanceTurnOrStepBot();
      }
    }, 1100);
  }
  /**
   * Returns current active turn timer payload if a turn timer is running.
   */
  getCurrentTimer() {
    if (!this.currentTimerPlayer || this.remainingSeconds <= 0) {
      return null;
    }
    const totalSec = this.isExtraTime ? this.getExtraTurnSeconds(this.currentTimerPlayer) : MAIN_TURN_SECONDS;
    return {
      position: this.currentTimerPlayer,
      rawPosition: this.currentTimerPlayer,
      remainingSec: this.remainingSeconds,
      totalSec,
      isExtraTime: this.isExtraTime
    };
  }
  /**
   * Dynamically replaces an AI Bot seat with an incoming human player mid-match.
   * Seamlessly transfers the current round's dealt cards, bid, and won trick counts.
   */
  takeoverBotSeat(position, newClientId, newPlayerName) {
    const state = this.store.getState();
    const existingPlayer = state.players[position];
    if (!existingPlayer) return false;
    const updatedPlayer = {
      ...existingPlayer,
      id: newClientId,
      name: newPlayerName || `Player ${position}`,
      type: "HUMAN" /* HUMAN */
    };
    const nextPlayers = {
      ...state.players,
      [position]: updatedPlayer
    };
    this.store.reset({
      ...state,
      players: nextPlayers
    });
    if (state.currentPlayer === position) {
      this.advanceTurnOrStepBot();
    }
    return true;
  }
  /**
   * Dynamically replaces a departing human player seat with an AI Bot mid-match.
   * Seamlessly preserves the player's dealt cards, bid, tricks won, and score.
   * Clears any active turn timer and immediately schedules bot automation.
   */
  replacePlayerWithBot(position, botName) {
    const state = this.store.getState();
    const existingPlayer = state.players[position];
    if (!existingPlayer) return false;
    const defaultName = `Bot (${position.charAt(0).toUpperCase() + position.slice(1).toLowerCase()})`;
    const updatedPlayer = {
      ...existingPlayer,
      id: `bot_${position}`,
      name: botName || defaultName,
      type: "BOT" /* BOT */
    };
    const nextPlayers = {
      ...state.players,
      [position]: updatedPlayer
    };
    this.store.reset({
      ...state,
      players: nextPlayers
    });
    this.controller.bindBotStrategy(position, new MediumBotStrategy());
    if (state.currentPlayer === position) {
      this.clearTurnTimer();
      if (this.botTimer) {
        clearTimeout(this.botTimer);
        this.botTimer = null;
      }
      this.botTimer = setTimeout(() => {
        const cur = this.store.getState();
        if (cur.currentPlayer === position) {
          if (cur.status === "BIDDING" /* BIDDING */) {
            this.controller.executeBotBid(position);
            this.advanceTurnOrStepBot();
          } else if (cur.status === "PLAYING" /* PLAYING */) {
            const legalMoves = this.controller.getLegalMovesForPlayer(position);
            if (legalMoves.length > 0) {
              const sorted = [...legalMoves].sort((a, b) => a.value - b.value);
              this.playCard(position, sorted[0]);
            } else {
              const didStep = this.controller.stepBotTurn();
              if (didStep) {
                if (this.store.getState().currentTrick.cards.length === 4) {
                  this.scheduleTrickResolution();
                } else {
                  this.advanceTurnOrStepBot();
                }
              }
            }
          }
        }
      }, 500);
    }
    return true;
  }
  /**
   * Generates a client-perspective GameState for the player at clientRawPos.
   * Maps client's raw position to SOUTH so client's own hand is rendered at the bottom,
   * with other 3 players rotated clockwise around the table.
   * Also masks opponents' hand cards for anti-cheat protection.
   */
  getPerspectiveState(clientRawPos) {
    const state = this.store.getState();
    const clientIdx = POSITIONS.indexOf(clientRawPos);
    const mapPosition = (rawPos) => {
      const rawIdx = POSITIONS.indexOf(rawPos);
      const mappedIdx = (rawIdx - clientIdx + 4) % 4;
      return POSITIONS[mappedIdx];
    };
    const rotatedPlayers = {
      ["SOUTH" /* SOUTH */]: {},
      ["WEST" /* WEST */]: {},
      ["NORTH" /* NORTH */]: {},
      ["EAST" /* EAST */]: {}
    };
    for (const rawPos of POSITIONS) {
      const p = state.players[rawPos];
      const mappedPos = mapPosition(rawPos);
      const isClientSelf = rawPos === clientRawPos;
      const handForClient = isClientSelf ? sortHand(p.hand) : p.hand.map((_, i) => ({
        id: `masked_${p.id}_${i}`,
        suit: state.config.trumpSuit,
        rank: "2" /* TWO */,
        value: 2
      }));
      rotatedPlayers[mappedPos] = {
        ...p,
        position: mappedPos,
        hand: handForClient
      };
    }
    const rotatedTrickCards = state.currentTrick.cards.map((tc) => ({
      card: tc.card,
      playedAt: tc.playedAt,
      playerPosition: mapPosition(tc.playerPosition)
    }));
    const rotatedCompletedTricks = state.completedTricks.map((ct) => ({
      trickNumber: ct.trickNumber,
      leader: mapPosition(ct.leader),
      leadSuit: ct.leadSuit,
      cards: ct.cards.map((c) => ({
        card: c.card,
        playedAt: c.playedAt,
        playerPosition: mapPosition(c.playerPosition)
      })),
      winner: mapPosition(ct.winner)
    }));
    const rotatedCumulativeScores = {
      ["SOUTH" /* SOUTH */]: state.cumulativeScores[POSITIONS[(0 + clientIdx) % 4]],
      ["WEST" /* WEST */]: state.cumulativeScores[POSITIONS[(1 + clientIdx) % 4]],
      ["NORTH" /* NORTH */]: state.cumulativeScores[POSITIONS[(2 + clientIdx) % 4]],
      ["EAST" /* EAST */]: state.cumulativeScores[POSITIONS[(3 + clientIdx) % 4]]
    };
    const rotatedRoundScores = state.roundScores.map((record) => {
      const rotatedScores = {
        ["SOUTH" /* SOUTH */]: {
          ...record.scores[POSITIONS[(0 + clientIdx) % 4]],
          playerPosition: "SOUTH" /* SOUTH */
        },
        ["WEST" /* WEST */]: {
          ...record.scores[POSITIONS[(1 + clientIdx) % 4]],
          playerPosition: "WEST" /* WEST */
        },
        ["NORTH" /* NORTH */]: {
          ...record.scores[POSITIONS[(2 + clientIdx) % 4]],
          playerPosition: "NORTH" /* NORTH */
        },
        ["EAST" /* EAST */]: {
          ...record.scores[POSITIONS[(3 + clientIdx) % 4]],
          playerPosition: "EAST" /* EAST */
        }
      };
      return {
        ...record,
        scores: rotatedScores
      };
    });
    const rotatedMatchResult = state.matchResult ? {
      ...state.matchResult,
      winnerPosition: mapPosition(state.matchResult.winnerPosition),
      winnerPositions: state.matchResult.winnerPositions.map(mapPosition),
      finalScores: rotatedCumulativeScores,
      rankings: state.matchResult.rankings.map((r) => ({
        ...r,
        position: mapPosition(r.position)
      }))
    } : null;
    return {
      ...state,
      currentPlayer: mapPosition(state.currentPlayer),
      dealer: mapPosition(state.dealer),
      players: rotatedPlayers,
      currentTrick: {
        ...state.currentTrick,
        leader: mapPosition(state.currentTrick.leader),
        winner: state.currentTrick.winner ? mapPosition(state.currentTrick.winner) : null,
        cards: rotatedTrickCards
      },
      completedTricks: rotatedCompletedTricks,
      roundScores: rotatedRoundScores,
      cumulativeScores: rotatedCumulativeScores,
      matchResult: rotatedMatchResult
    };
  }
  destroy() {
    this.clearTurnTimer();
    this.clearRoundTransitionTimer();
    if (this.botTimer) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
  }
};

// server/src/db/PersistenceService.ts
import crypto2 from "crypto";

// server/src/db/dbPool.ts
import { Pool } from "pg";
var globalPool = null;
var lastDbError = null;
function isDatabaseConfigured() {
  const url = process.env.DATABASE_URL;
  return Boolean(url && url.trim().length > 0);
}
function getLastDbError() {
  return lastDbError;
}
function getDbPool() {
  if (!isDatabaseConfigured()) {
    return null;
  }
  if (!globalPool) {
    const connectionString = process.env.DATABASE_URL.trim();
    const config = {
      connectionString,
      max: Number(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 1e4
    };
    if (process.env.NODE_ENV === "production" || connectionString.includes("sslmode=require") || connectionString.includes(".render.com") || connectionString.includes(".supabase.co") || connectionString.includes(".neon.tech")) {
      config.ssl = {
        rejectUnauthorized: false
      };
    }
    try {
      globalPool = new Pool(config);
      globalPool.on("error", (err) => {
        const msg = `Unexpected idle PostgreSQL client error: ${err.message}`;
        lastDbError = msg;
        console.error(`[PostgreSQL Pool] ${msg}`);
      });
      console.log("[PostgreSQL Pool] Initialized lazy connection pool");
    } catch (err) {
      lastDbError = err.message || "Failed to initialize pool";
      console.error("[PostgreSQL Pool] Failed to create pool:", lastDbError);
      return null;
    }
  }
  return globalPool;
}
async function checkDbHealth() {
  const pool = getDbPool();
  if (!pool) {
    return { connected: false, error: "DATABASE_URL not configured" };
  }
  const start = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      const latencyMs = Date.now() - start;
      lastDbError = null;
      return { connected: true, latencyMs };
    } finally {
      client.release();
    }
  } catch (err) {
    const msg = err.message || "Connection test query failed";
    lastDbError = msg;
    return { connected: false, error: msg };
  }
}

// server/src/db/repositories/PlayerRepository.ts
import crypto from "crypto";
var PlayerRepository = class {
  constructor(pool) {
    this.pool = pool;
  }
  /**
   * Finds or creates a persistent profile for an anonymous player ID.
   * If the player already exists, updates display_name and updated_at if changed.
   * Idempotent and concurrency-safe via PostgreSQL ON CONFLICT.
   */
  async findOrCreateByAnonymousId(anonymousClientId, displayName) {
    const cleanAnonId = anonymousClientId.trim();
    const cleanName = displayName.trim() || "Player";
    const newPlayerId = `p_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const query = `
      INSERT INTO player_profiles (player_id, anonymous_client_id, display_name, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (anonymous_client_id)
      DO UPDATE SET
        display_name = CASE
          WHEN EXCLUDED.display_name <> '' AND EXCLUDED.display_name <> player_profiles.display_name
          THEN EXCLUDED.display_name
          ELSE player_profiles.display_name
        END,
        updated_at = NOW()
      RETURNING player_id, anonymous_client_id, display_name, created_at, updated_at;
    `;
    const result = await this.pool.query(query, [newPlayerId, cleanAnonId, cleanName]);
    return result.rows[0];
  }
  async findByAnonymousId(anonymousClientId) {
    const query = `
      SELECT player_id, anonymous_client_id, display_name, created_at, updated_at
      FROM player_profiles
      WHERE anonymous_client_id = $1;
    `;
    const result = await this.pool.query(query, [anonymousClientId.trim()]);
    return result.rows[0] || null;
  }
  async findById(playerId) {
    const query = `
      SELECT player_id, anonymous_client_id, display_name, created_at, updated_at
      FROM player_profiles
      WHERE player_id = $1;
    `;
    const result = await this.pool.query(query, [playerId]);
    return result.rows[0] || null;
  }
};

// server/src/db/repositories/MatchRepository.ts
var MatchRepository = class {
  constructor(pool) {
    this.pool = pool;
  }
  /**
   * Persists a newly started match and its seated players.
   * Idempotent: if match_id already exists, ignores duplicate creation.
   */
  async createMatch(dto) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const matchQuery = `
        INSERT INTO matches (match_id, game_type, room_code, total_rounds, status, started_at, created_at)
        VALUES ($1, 'CALL_BREAK', $2, $3, 'IN_PROGRESS', NOW(), NOW())
        ON CONFLICT (match_id) DO NOTHING
        RETURNING match_id, game_type, room_code, total_rounds, status, started_at, finished_at, created_at;
      `;
      const matchResult = await client.query(matchQuery, [
        dto.matchId,
        dto.roomCode,
        dto.totalRounds
      ]);
      for (const p of dto.players) {
        const playerQuery = `
          INSERT INTO match_players (match_id, player_id, seat, is_host, is_bot, tricks_won)
          VALUES ($1, $2, $3, $4, $5, 0)
          ON CONFLICT (match_id, seat) DO NOTHING;
        `;
        await client.query(playerQuery, [
          dto.matchId,
          p.playerId || null,
          p.seat,
          p.isHost,
          p.isBot
        ]);
      }
      await client.query("COMMIT");
      if (matchResult.rows.length > 0) {
        return matchResult.rows[0];
      }
      const existing = await this.getMatchById(dto.matchId);
      return existing;
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Failed to create persistent match record: ${err.message}`);
    } finally {
      client.release();
    }
  }
  /**
   * Completes a match by recording final scores, tricks, and ranking.
   * Idempotent: multiple calls update final records safely without duplicating rows.
   */
  async completeMatch(dto) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const updateMatchQuery = `
        UPDATE matches
        SET status = 'FINISHED',
            finished_at = COALESCE($2, NOW())
        WHERE match_id = $1 AND status <> 'FINISHED';
      `;
      await client.query(updateMatchQuery, [dto.matchId, dto.finishedAt || null]);
      for (const res of dto.playerResults) {
        const updatePlayerQuery = `
          UPDATE match_players
          SET final_score = $3,
              tricks_won = $4,
              final_rank = $5
          WHERE match_id = $1 AND seat = $2;
        `;
        await client.query(updatePlayerQuery, [
          dto.matchId,
          res.seat,
          res.finalScore,
          res.tricksWon,
          res.finalRank
        ]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Failed to complete persistent match record: ${err.message}`);
    } finally {
      client.release();
    }
  }
  async getMatchById(matchId) {
    const query = `
      SELECT match_id, game_type, room_code, total_rounds, status, started_at, finished_at, created_at
      FROM matches
      WHERE match_id = $1;
    `;
    const result = await this.pool.query(query, [matchId]);
    return result.rows[0] || null;
  }
  async getMatchPlayers(matchId) {
    const query = `
      SELECT match_id, player_id, seat, is_host, is_bot, final_score, tricks_won, final_rank
      FROM match_players
      WHERE match_id = $1
      ORDER BY seat ASC;
    `;
    const result = await this.pool.query(query, [matchId]);
    return result.rows;
  }
  async getPlayerStatistics(playerId) {
    const query = `
      SELECT
        COUNT(m.match_id) AS total_matches,
        SUM(CASE WHEN mp.final_rank = 1 THEN 1 ELSE 0 END) AS wins,
        SUM(mp.final_score) AS total_score,
        AVG(mp.final_score) AS avg_score,
        MAX(mp.final_score) AS best_score,
        SUM(mp.tricks_won) AS total_tricks,
        AVG(mp.tricks_won) AS avg_tricks
      FROM match_players mp
      JOIN matches m ON mp.match_id = m.match_id
      WHERE mp.player_id = $1 AND m.status = 'FINISHED';
    `;
    const result = await this.pool.query(query, [playerId]);
    const row = result.rows[0] || {};
    return {
      totalMatches: Number(row.total_matches || 0),
      wins: Number(row.wins || 0),
      totalScore: Number(row.total_score || 0),
      avgScore: Number(row.avg_score || 0),
      bestScore: Number(row.best_score || 0),
      totalTricks: Number(row.total_tricks || 0),
      avgTricks: Number(row.avg_tricks || 0)
    };
  }
  async getPlayerMatches(playerId, limit = 20, offset = 0) {
    const matchQuery = `
      SELECT m.match_id, m.game_type, m.room_code, m.total_rounds, m.status, m.started_at, m.finished_at, m.created_at
      FROM matches m
      JOIN match_players mp ON m.match_id = mp.match_id
      WHERE mp.player_id = $1 AND m.status = 'FINISHED'
      ORDER BY m.finished_at DESC NULLS LAST, m.started_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const matchResult = await this.pool.query(matchQuery, [playerId, limit, offset]);
    const matchesList = matchResult.rows;
    const detailedMatches = [];
    for (const m of matchesList) {
      const players = await this.getMatchPlayers(m.match_id);
      const playerRecord = players.find((p) => p.player_id === playerId) || players[0];
      detailedMatches.push({
        match: m,
        playerRecord,
        participants: players
      });
    }
    return detailedMatches;
  }
  async getGlobalLeaderboard(category = "overall", timeframe = "all", limit = 20, offset = 0, callerPlayerId) {
    const validLimit = Math.max(1, Math.min(limit, 100));
    const validOffset = Math.max(0, offset);
    let timeFilterSql = "1=1";
    if (timeframe === "monthly") {
      timeFilterSql = "m.finished_at >= (NOW() - INTERVAL '30 days')";
    } else if (timeframe === "weekly") {
      timeFilterSql = "m.finished_at >= (NOW() - INTERVAL '7 days')";
    }
    let havingClause = "";
    if (category === "win_rate") {
      const minGames = timeframe === "all" ? 2 : 1;
      havingClause = `HAVING COUNT(m.match_id) >= ${minGames}`;
    }
    let orderBySql = "overall_score DESC, wins DESC, avg_score DESC, p.player_id ASC";
    if (category === "wins") {
      orderBySql = "wins DESC, avg_score DESC, total_matches ASC, p.player_id ASC";
    } else if (category === "win_rate") {
      orderBySql = "win_rate DESC, wins DESC, avg_score DESC, p.player_id ASC";
    } else if (category === "score") {
      orderBySql = "best_score DESC, avg_score DESC, wins DESC, p.player_id ASC";
    } else if (category === "tricks") {
      orderBySql = "total_tricks DESC, avg_tricks DESC, wins DESC, p.player_id ASC";
    }
    const query = `
      WITH aggregated AS (
        SELECT
          p.player_id,
          p.display_name,
          COUNT(m.match_id)::int AS total_matches,
          SUM(CASE WHEN mp.final_rank = 1 THEN 1 ELSE 0 END)::int AS wins,
          SUM(CASE WHEN mp.final_rank > 1 THEN 1 ELSE 0 END)::int AS losses,
          ROUND(COALESCE(SUM(mp.final_score), 0), 1)::float AS total_score,
          ROUND(COALESCE(AVG(mp.final_score), 0), 1)::float AS avg_score,
          ROUND(COALESCE(MAX(mp.final_score), 0), 1)::float AS best_score,
          SUM(mp.tricks_won)::int AS total_tricks,
          ROUND(COALESCE(AVG(mp.tricks_won), 0), 1)::float AS avg_tricks,
          ROUND((SUM(CASE WHEN mp.final_rank = 1 THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(m.match_id), 0)) * 100.0, 1)::float AS win_rate,
          ROUND(((SUM(CASE WHEN mp.final_rank = 1 THEN 1 ELSE 0 END) * 10) + COALESCE(SUM(mp.final_score), 0) + (SUM(mp.tricks_won) * 0.5)), 1)::float AS overall_score
        FROM player_profiles p
        JOIN match_players mp ON p.player_id = mp.player_id
        JOIN matches m ON mp.match_id = m.match_id
        WHERE m.status = 'FINISHED' AND ${timeFilterSql}
        GROUP BY p.player_id, p.display_name
        ${havingClause}
      ),
      ranked AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY ${orderBySql})::int AS rank
        FROM aggregated
      )
      SELECT * FROM ranked
      ORDER BY rank ASC;
    `;
    const result = await this.pool.query(query);
    const allRows = result.rows || [];
    const totalCount = allRows.length;
    const pageRows = allRows.slice(validOffset, validOffset + validLimit);
    const items = pageRows.map((r) => ({
      rank: Number(r.rank),
      displayName: String(r.display_name || "Player"),
      totalMatches: Number(r.total_matches || 0),
      wins: Number(r.wins || 0),
      losses: Number(r.losses || 0),
      winRate: Number(r.win_rate || 0),
      totalScore: Number(r.total_score || 0),
      avgScore: Number(r.avg_score || 0),
      bestScore: Number(r.best_score || 0),
      totalTricks: Number(r.total_tricks || 0),
      avgTricks: Number(r.avg_tricks || 0),
      overallScore: Number(r.overall_score || 0),
      isCurrentPlayer: callerPlayerId ? r.player_id === callerPlayerId : false
    }));
    let selfData = null;
    if (callerPlayerId) {
      const selfRow = allRows.find((r) => r.player_id === callerPlayerId);
      if (selfRow) {
        selfData = {
          rank: Number(selfRow.rank),
          entry: {
            rank: Number(selfRow.rank),
            displayName: String(selfRow.display_name || "Player"),
            totalMatches: Number(selfRow.total_matches || 0),
            wins: Number(selfRow.wins || 0),
            losses: Number(selfRow.losses || 0),
            winRate: Number(selfRow.win_rate || 0),
            totalScore: Number(selfRow.total_score || 0),
            avgScore: Number(selfRow.avg_score || 0),
            bestScore: Number(selfRow.best_score || 0),
            totalTricks: Number(selfRow.total_tricks || 0),
            avgTricks: Number(selfRow.avg_tricks || 0),
            overallScore: Number(selfRow.overall_score || 0),
            isCurrentPlayer: true
          }
        };
      }
    }
    return {
      category,
      timeframe,
      items,
      totalCount,
      limit: validLimit,
      offset: validOffset,
      self: selfData
    };
  }
  async getTopWins(timeframe = "all", limit = 20, offset = 0) {
    const validLimit = Math.max(1, Math.min(limit, 50));
    const validOffset = Math.max(0, offset);
    let timeFilterSql = "1=1";
    if (timeframe === "monthly") {
      timeFilterSql = "m.finished_at >= (NOW() - INTERVAL '30 days')";
    } else if (timeframe === "weekly") {
      timeFilterSql = "m.finished_at >= (NOW() - INTERVAL '7 days')";
    }
    const query = `
      SELECT
        m.match_id,
        m.room_code,
        m.game_type,
        m.total_rounds,
        m.finished_at,
        mp.seat AS winner_seat,
        p.display_name AS winner_name,
        mp.final_score::float AS final_score,
        mp.tricks_won::int AS tricks_won,
        ROUND((mp.final_score - COALESCE((
          SELECT MAX(mp2.final_score)
          FROM match_players mp2
          WHERE mp2.match_id = m.match_id AND mp2.seat != mp.seat
        ), 0)), 1)::float AS winning_margin
      FROM matches m
      JOIN match_players mp ON m.match_id = mp.match_id
      JOIN player_profiles p ON mp.player_id = p.player_id
      WHERE m.status = 'FINISHED'
        AND mp.final_rank = 1
        AND ${timeFilterSql}
      ORDER BY mp.final_score DESC, winning_margin DESC, m.finished_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await this.pool.query(query, [validLimit, validOffset]);
    const topWinsList = result.rows || [];
    const detailedWins = [];
    for (const row of topWinsList) {
      const players = await this.getMatchPlayers(row.match_id);
      const participants = players.map((p) => ({
        seat: p.seat,
        displayName: p.is_bot ? `Bot ${p.seat}` : p.seat === row.winner_seat ? row.winner_name : `Player ${p.seat}`,
        isBot: p.is_bot,
        finalScore: Number(p.final_score || 0),
        finalRank: Number(p.final_rank || 0)
      }));
      detailedWins.push({
        matchId: row.match_id,
        roomCode: row.room_code,
        gameType: row.game_type,
        totalRounds: Number(row.total_rounds || 5),
        finishedAt: row.finished_at,
        winnerSeat: row.winner_seat,
        winnerName: row.winner_name || "Champion",
        finalScore: Number(row.final_score || 0),
        winningMargin: Number(row.winning_margin || 0),
        tricksWon: Number(row.tricks_won || 0),
        participants
      });
    }
    return detailedWins;
  }
  async getPlayerAchievements(playerId) {
    const stats = await this.getPlayerStatistics(playerId);
    const matches = await this.getPlayerMatches(playerId, 100, 0);
    const winRate = stats.totalMatches > 0 ? stats.wins / stats.totalMatches * 100 : 0;
    const maxSingleMatchTricks = matches.reduce((max, m) => Math.max(max, m.playerRecord?.tricks_won || 0), 0);
    const flawlessMatch = matches.some((m) => m.playerRecord?.final_rank === 1 && (m.playerRecord?.final_score || 0) >= 20);
    const achievements = [
      {
        id: "FIRST_VICTORY",
        title: "First Victory",
        description: "Win your first Call Break match",
        category: "wins",
        unlocked: stats.wins >= 1,
        progress: Math.min(stats.wins, 1),
        maxProgress: 1
      },
      {
        id: "BRONZE_CHAMPION",
        title: "Bronze Champion",
        description: "Win 5 completed matches",
        category: "wins",
        unlocked: stats.wins >= 5,
        progress: Math.min(stats.wins, 5),
        maxProgress: 5
      },
      {
        id: "SILVER_CHAMPION",
        title: "Silver Champion",
        description: "Win 10 completed matches",
        category: "wins",
        unlocked: stats.wins >= 10,
        progress: Math.min(stats.wins, 10),
        maxProgress: 10
      },
      {
        id: "GOLD_CHAMPION",
        title: "Gold Champion",
        description: "Win 25 completed matches",
        category: "wins",
        unlocked: stats.wins >= 25,
        progress: Math.min(stats.wins, 25),
        maxProgress: 25
      },
      {
        id: "HIGH_ROLLER",
        title: "High Roller",
        description: "Score 25+ points in a single match",
        category: "score",
        unlocked: stats.bestScore >= 25,
        progress: Math.min(stats.bestScore, 25),
        maxProgress: 25
      },
      {
        id: "CENTURION",
        title: "Centurion",
        description: "Score 30+ points in a single match",
        category: "score",
        unlocked: stats.bestScore >= 30,
        progress: Math.min(stats.bestScore, 30),
        maxProgress: 30
      },
      {
        id: "TRICK_TACTICIAN",
        title: "Trick Tactician",
        description: "Win 10+ tricks in a single match",
        category: "mastery",
        unlocked: maxSingleMatchTricks >= 10,
        progress: Math.min(maxSingleMatchTricks, 10),
        maxProgress: 10
      },
      {
        id: "MATCH_VETERAN",
        title: "Match Veteran",
        description: "Complete 10 total matches",
        category: "experience",
        unlocked: stats.totalMatches >= 10,
        progress: Math.min(stats.totalMatches, 10),
        maxProgress: 10
      },
      {
        id: "CALLBREAK_LEGEND",
        title: "Call Break Legend",
        description: "Win 5+ matches with a 50%+ win rate",
        category: "mastery",
        unlocked: stats.wins >= 5 && winRate >= 50,
        progress: Math.min(stats.wins, 5),
        maxProgress: 5
      },
      {
        id: "SHARPSHOOTER",
        title: "Sharpshooter",
        description: "Win a match with 20+ final points",
        category: "mastery",
        unlocked: flawlessMatch,
        progress: flawlessMatch ? 1 : 0,
        maxProgress: 1
      }
    ];
    return achievements;
  }
};

// server/src/db/repositories/RoundRepository.ts
var RoundRepository = class {
  constructor(pool) {
    this.pool = pool;
  }
  /**
   * Persists an authoritative round outcome and individual player scorecards.
   * Idempotent: ignores duplicates if the same round result is delivered twice.
   */
  async recordRoundResult(dto) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const roundQuery = `
        INSERT INTO match_rounds (match_id, round_number, dealer_seat, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (match_id, round_number) DO NOTHING;
      `;
      await client.query(roundQuery, [dto.matchId, dto.roundNumber, dto.dealerSeat]);
      for (const p of dto.players) {
        const roundPlayerQuery = `
          INSERT INTO match_round_players (match_id, round_number, player_id, seat, bid, tricks_won, round_score)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (match_id, round_number, seat)
          DO UPDATE SET
            bid = EXCLUDED.bid,
            tricks_won = EXCLUDED.tricks_won,
            round_score = EXCLUDED.round_score;
        `;
        await client.query(roundPlayerQuery, [
          dto.matchId,
          dto.roundNumber,
          p.playerId || null,
          p.seat,
          p.bid,
          p.tricksWon,
          p.roundScore
        ]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Failed to record persistent round result: ${err.message}`);
    } finally {
      client.release();
    }
  }
  async getRoundHeader(matchId, roundNumber) {
    const query = `
      SELECT match_id, round_number, dealer_seat, created_at
      FROM match_rounds
      WHERE match_id = $1 AND round_number = $2;
    `;
    const result = await this.pool.query(query, [matchId, roundNumber]);
    return result.rows[0] || null;
  }
  async getRoundScorecards(matchId, roundNumber) {
    const query = `
      SELECT match_id, round_number, player_id, seat, bid, tricks_won, round_score
      FROM match_round_players
      WHERE match_id = $1 AND round_number = $2
      ORDER BY seat ASC;
    `;
    const result = await this.pool.query(query, [matchId, roundNumber]);
    return result.rows;
  }
  async getMatchRoundsFull(matchId) {
    const roundsQuery = `
      SELECT match_id, round_number, dealer_seat, created_at
      FROM match_rounds
      WHERE match_id = $1
      ORDER BY round_number ASC;
    `;
    const roundsResult = await this.pool.query(roundsQuery, [matchId]);
    const rounds = roundsResult.rows;
    const result = [];
    for (const r of rounds) {
      const scorecards = await this.getRoundScorecards(matchId, r.round_number);
      result.push({
        roundNumber: r.round_number,
        dealerSeat: r.dealer_seat,
        createdAt: r.created_at,
        scorecards
      });
    }
    return result;
  }
};

// server/src/db/PersistenceService.ts
var PersistenceService = class _PersistenceService {
  constructor() {
    this.pool = null;
    this.playerRepo = null;
    this.matchRepo = null;
    this.roundRepo = null;
    // In-memory cache for anonymous_client_id -> player_id to eliminate repeated DB reads
    this.playerProfileCache = /* @__PURE__ */ new Map();
    // In-memory bounded queue for failed persistence jobs
    this.pendingQueue = [];
    this.MAX_QUEUE_SIZE = 100;
    this.isDraining = false;
    this.initPool();
  }
  static {
    this.instance = null;
  }
  static getInstance() {
    if (!_PersistenceService.instance) {
      _PersistenceService.instance = new _PersistenceService();
    }
    return _PersistenceService.instance;
  }
  initPool() {
    if (isDatabaseConfigured()) {
      this.pool = getDbPool();
      if (this.pool) {
        this.playerRepo = new PlayerRepository(this.pool);
        this.matchRepo = new MatchRepository(this.pool);
        this.roundRepo = new RoundRepository(this.pool);
      }
    }
  }
  /**
   * Resets or reinitializes connection (useful for testing or env changes)
   */
  reinitialize() {
    this.pool = null;
    this.playerRepo = null;
    this.matchRepo = null;
    this.roundRepo = null;
    this.playerProfileCache.clear();
    this.pendingQueue = [];
    this.initPool();
  }
  isAvailable() {
    return Boolean(this.pool && this.playerRepo && this.matchRepo && this.roundRepo);
  }
  async getStatus() {
    const enabled = isDatabaseConfigured();
    if (!enabled || !this.pool) {
      return {
        enabled: false,
        connected: false,
        driver: "none",
        pendingQueueSize: 0,
        lastError: null
      };
    }
    const health = await checkDbHealth();
    return {
      enabled: true,
      connected: health.connected,
      driver: "postgres",
      pendingQueueSize: this.pendingQueue.length,
      lastError: health.error || getLastDbError()
    };
  }
  /**
   * Resolves or creates a persistent player profile for an anonymous cb_player_id.
   * Safe to call on every table join; returns cached record if already resolved.
   */
  async onPlayerJoin(anonymousClientId, displayName) {
    if (!this.isAvailable()) return null;
    const cleanAnonId = anonymousClientId.trim();
    if (!cleanAnonId) return null;
    const cached = this.playerProfileCache.get(cleanAnonId);
    if (cached) {
      if (displayName && displayName !== cached.display_name) {
        this.enqueue(async () => {
          const updated = await this.playerRepo.findOrCreateByAnonymousId(cleanAnonId, displayName);
          this.playerProfileCache.set(cleanAnonId, updated);
        });
      }
      return cached;
    }
    try {
      const profile = await this.playerRepo.findOrCreateByAnonymousId(cleanAnonId, displayName);
      this.playerProfileCache.set(cleanAnonId, profile);
      return profile;
    } catch (err) {
      console.error("[PersistenceService] onPlayerJoin failed:", err.message);
      return null;
    }
  }
  /**
   * Persists the start of a match. Returns a generated matchId.
   */
  async onMatchStart(roomCode, totalRounds, participants) {
    if (!this.isAvailable()) return null;
    const matchId = `m_${roomCode}_${Date.now()}_${crypto2.randomUUID().slice(0, 6)}`;
    this.enqueue(async () => {
      const playerDtos = [];
      for (const p of participants) {
        let dbPlayerId = null;
        if (!p.isBot) {
          const profile = await this.onPlayerJoin(p.id, p.name);
          dbPlayerId = profile ? profile.player_id : null;
        }
        playerDtos.push({
          playerId: dbPlayerId,
          seat: p.position,
          displayName: p.name,
          isHost: p.isHost,
          isBot: p.isBot
        });
      }
      await this.matchRepo.createMatch({
        matchId,
        roomCode,
        totalRounds,
        players: playerDtos
      });
      console.log(`[PersistenceService] Persisted match start: ${matchId} (Room ${roomCode})`);
    });
    return matchId;
  }
  /**
   * Persists completed round scores and player bids.
   */
  async onRoundComplete(matchId, roundNumber, dealerSeat, roundScoreRecord, bids, tricksWon, participants) {
    if (!this.isAvailable() || !matchId) return;
    this.enqueue(async () => {
      const players = [];
      for (const pos of ["SOUTH" /* SOUTH */, "WEST" /* WEST */, "NORTH" /* NORTH */, "EAST" /* EAST */]) {
        const participant = participants.find((p) => p.position === pos);
        let dbPlayerId = null;
        if (participant && !participant.isBot) {
          const cached = this.playerProfileCache.get(participant.id);
          dbPlayerId = cached ? cached.player_id : null;
        }
        const scoreEntry = roundScoreRecord.scores ? roundScoreRecord.scores[pos] : void 0;
        players.push({
          seat: pos,
          playerId: dbPlayerId,
          bid: bids[pos] ?? null,
          tricksWon: tricksWon[pos] ?? 0,
          roundScore: scoreEntry ? scoreEntry.roundScore : 0
        });
      }
      await this.roundRepo.recordRoundResult({
        matchId,
        roundNumber,
        dealerSeat,
        players
      });
      console.log(`[PersistenceService] Persisted round ${roundNumber} for match ${matchId}`);
    });
  }
  /**
   * Persists match completion, final player scores, and rankings.
   */
  async onMatchComplete(matchId, gameState, participants) {
    if (!this.isAvailable() || !matchId) return;
    this.enqueue(async () => {
      const positions = [
        "SOUTH" /* SOUTH */,
        "WEST" /* WEST */,
        "NORTH" /* NORTH */,
        "EAST" /* EAST */
      ];
      const scored = positions.map((pos) => {
        const score = gameState.cumulativeScores[pos] ?? 0;
        let totalTricks = 0;
        for (const round of gameState.roundScores) {
          const ps = round.scores ? round.scores[pos] : void 0;
          if (ps) totalTricks += ps.tricksWon;
        }
        return { pos, score, totalTricks };
      });
      scored.sort((a, b) => b.score - a.score);
      const playerResults = scored.map((item, idx) => ({
        seat: item.pos,
        finalScore: item.score,
        tricksWon: item.totalTricks,
        finalRank: idx + 1
      }));
      await this.matchRepo.completeMatch({
        matchId,
        finishedAt: /* @__PURE__ */ new Date(),
        playerResults
      });
      console.log(`[PersistenceService] Persisted match completion: ${matchId}`);
    });
  }
  async getPlayerProfileDashboard(anonymousClientId, limit = 20, offset = 0) {
    if (!this.isAvailable()) {
      return {
        profile: null,
        stats: { totalMatches: 0, wins: 0, losses: 0, winRate: 0, totalScore: 0, avgScore: 0, bestScore: 0, totalTricks: 0, avgTricks: 0 },
        matches: [],
        enabled: false
      };
    }
    const cleanAnonId = anonymousClientId.trim();
    if (!cleanAnonId) return null;
    const profile = await this.playerRepo.findByAnonymousId(cleanAnonId);
    if (!profile) {
      return {
        profile: { anonymous_client_id: cleanAnonId, display_name: "Player", created_at: /* @__PURE__ */ new Date() },
        stats: { totalMatches: 0, wins: 0, losses: 0, winRate: 0, totalScore: 0, avgScore: 0, bestScore: 0, totalTricks: 0, avgTricks: 0 },
        matches: [],
        enabled: true
      };
    }
    const stats = await this.matchRepo.getPlayerStatistics(profile.player_id);
    const matches = await this.matchRepo.getPlayerMatches(profile.player_id, limit, offset);
    const losses = Math.max(0, stats.totalMatches - stats.wins);
    const winRate = stats.totalMatches > 0 ? Number((stats.wins / stats.totalMatches * 100).toFixed(1)) : 0;
    return {
      profile,
      stats: {
        totalMatches: stats.totalMatches,
        wins: stats.wins,
        losses,
        winRate,
        totalScore: stats.totalScore,
        avgScore: stats.totalMatches > 0 ? Number((stats.totalScore / stats.totalMatches).toFixed(1)) : 0,
        bestScore: stats.bestScore,
        totalTricks: stats.totalTricks,
        avgTricks: stats.totalMatches > 0 ? Number((stats.totalTricks / stats.totalMatches).toFixed(1)) : 0
      },
      matches,
      enabled: true
    };
  }
  async getMatchScorecardDetails(anonymousClientId, matchId) {
    if (!this.isAvailable()) return null;
    const cleanAnonId = anonymousClientId.trim();
    if (!cleanAnonId) return null;
    const profile = await this.playerRepo.findByAnonymousId(cleanAnonId);
    if (!profile) return null;
    const match = await this.matchRepo.getMatchById(matchId);
    if (!match) return null;
    const players = await this.matchRepo.getMatchPlayers(matchId);
    const participant = players.find((p) => p.player_id === profile.player_id);
    if (!participant) {
      return null;
    }
    const rounds = await this.roundRepo.getMatchRoundsFull(matchId);
    return {
      match,
      players,
      rounds
    };
  }
  async getGlobalLeaderboard(category = "overall", timeframe = "all", limit = 20, offset = 0, anonymousClientId) {
    if (!this.isAvailable()) {
      return {
        category,
        timeframe,
        items: [],
        totalCount: 0,
        limit,
        offset,
        self: null
      };
    }
    let callerPlayerId = null;
    if (anonymousClientId && anonymousClientId.trim()) {
      const profile = await this.playerRepo.findByAnonymousId(anonymousClientId.trim());
      if (profile) {
        callerPlayerId = profile.player_id;
      }
    }
    return await this.matchRepo.getGlobalLeaderboard(category, timeframe, limit, offset, callerPlayerId);
  }
  async getTopWins(timeframe = "all", limit = 20, offset = 0) {
    if (!this.isAvailable()) {
      return [];
    }
    return await this.matchRepo.getTopWins(timeframe, limit, offset);
  }
  async getPlayerAchievements(anonymousClientId) {
    if (!this.isAvailable()) {
      return [];
    }
    const cleanAnonId = anonymousClientId.trim();
    if (!cleanAnonId) return [];
    const profile = await this.playerRepo.findByAnonymousId(cleanAnonId);
    if (!profile) {
      return [];
    }
    return await this.matchRepo.getPlayerAchievements(profile.player_id);
  }
  /**
   * Enqueues an asynchronous persistence job.
   * If a transient failure occurs, keeps going without crashing the engine.
   */
  enqueue(job) {
    if (this.pendingQueue.length >= this.MAX_QUEUE_SIZE) {
      console.warn("[PersistenceService] Pending queue full; dropping oldest job");
      this.pendingQueue.shift();
    }
    this.pendingQueue.push(job);
    this.drainQueue();
  }
  async drainQueue() {
    if (this.isDraining) return;
    this.isDraining = true;
    while (this.pendingQueue.length > 0) {
      const job = this.pendingQueue.shift();
      if (!job) break;
      try {
        await job();
      } catch (err) {
        console.error("[PersistenceService] Persistence job failed:", err.message);
      }
    }
    this.isDraining = false;
  }
};

// server/src/RoomManager.ts
var SEAT_ORDER = [
  "SOUTH" /* SOUTH */,
  "WEST" /* WEST */,
  "NORTH" /* NORTH */,
  "EAST" /* EAST */
];
var POSITION_TO_SEAT = {
  ["SOUTH" /* SOUTH */]: "P1",
  ["WEST" /* WEST */]: "P2",
  ["NORTH" /* NORTH */]: "P3",
  ["EAST" /* EAST */]: "P4"
};
var SEAT_TO_POSITION = {
  P1: "SOUTH" /* SOUTH */,
  P2: "WEST" /* WEST */,
  P3: "NORTH" /* NORTH */,
  P4: "EAST" /* EAST */
};
var DEFAULT_BOT_NAMES = {
  ["SOUTH" /* SOUTH */]: "Bot: Shield",
  ["WEST" /* WEST */]: "Bot: Shield",
  ["NORTH" /* NORTH */]: "Bot: Shark",
  ["EAST" /* EAST */]: "Bot: Tactician"
};
function normalizeRoomCode(code) {
  if (!code) return "";
  return code.trim().replace(/^CB-?/i, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
function generateRoomCodeFromPlayerName(playerName, existingRooms) {
  let normalized = (playerName || "").trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!normalized) {
    normalized = "ROOM";
  }
  if (normalized.length === 1) {
    normalized = `${normalized}01`;
  } else if (normalized.length === 2) {
    normalized = `${normalized}1`;
  }
  if (normalized.length > 10) {
    normalized = normalized.slice(0, 10);
  }
  if (!existingRooms.has(normalized)) {
    return normalized;
  }
  let suffixNum = 2;
  while (suffixNum < 1e5) {
    const suffixStr = suffixNum.toString();
    const maxBaseLen = 10 - suffixStr.length;
    const truncatedBase = normalized.slice(0, maxBaseLen);
    const candidate = `${truncatedBase}${suffixStr}`;
    if (!existingRooms.has(candidate)) {
      return candidate;
    }
    suffixNum++;
  }
  return Math.floor(1e5 + Math.random() * 9e5).toString();
}
var GameRoom = class {
  constructor(roomCode, hostClientId, hostName, hostSocket) {
    this.status = "LOBBY";
    this.autoFillBots = true;
    this.totalRounds = 5;
    this.persistentMatchId = null;
    // Position to participant (Always contains 4 stable seats: P1, P2, P3, P4)
    this.players = /* @__PURE__ */ new Map();
    // Client ID to WebSocket
    this.clientSockets = /* @__PURE__ */ new Map();
    // Client ID to Position
    this.clientPositions = /* @__PURE__ */ new Map();
    // Disconnected seats map for seamless same-seat re-connection
    this.disconnectedSeats = /* @__PURE__ */ new Map();
    // Pending join requests awaiting Host approval
    this.pendingJoinRequests = /* @__PURE__ */ new Map();
    this.lobbyGraceTimer = null;
    this.lobbyOrphanedAt = null;
    this.lobbyHostTransferTimer = null;
    this.lobbyHostDisconnectedAt = null;
    this.controller = null;
    this.unsubscribeEvents = null;
    this.unsubscribeState = null;
    this.unsubscribeTimer = null;
    this.unsubscribeRebid = null;
    this.unsubscribeTimeoutTakeover = null;
    this.readyFallbackTimer = null;
    this.finishedCleanupTimer = null;
    this.isDestroyed = false;
    this.roomCode = normalizeRoomCode(roomCode);
    this.hostClientId = hostClientId;
    const cleanHostName = (hostName || "").replace(/\s*\(You\)$/i, "").replace(/\s*\(Host\)$/i, "").replace(/^Host Player$/i, "").trim();
    const finalHostName = cleanHostName && !/^(host|player|player 1|you)$/i.test(cleanHostName) ? cleanHostName : "Host (Player 1)";
    this.creatorName = finalHostName;
    this.creatorClientId = hostClientId;
    const hostParticipant = {
      id: hostClientId,
      playerId: "P1",
      name: finalHostName,
      position: "SOUTH" /* SOUTH */,
      isHost: true,
      isReady: true,
      isBot: false
    };
    this.players.set("SOUTH" /* SOUTH */, hostParticipant);
    this.clientSockets.set(hostClientId, hostSocket);
    this.clientPositions.set(hostClientId, "SOUTH" /* SOUTH */);
    this.players.set("WEST" /* WEST */, {
      id: "bot_WEST",
      playerId: "P2",
      name: DEFAULT_BOT_NAMES["WEST" /* WEST */],
      position: "WEST" /* WEST */,
      isHost: false,
      isReady: true,
      isBot: true
    });
    this.players.set("NORTH" /* NORTH */, {
      id: "bot_NORTH",
      playerId: "P3",
      name: DEFAULT_BOT_NAMES["NORTH" /* NORTH */],
      position: "NORTH" /* NORTH */,
      isHost: false,
      isReady: true,
      isBot: true
    });
    this.players.set("EAST" /* EAST */, {
      id: "bot_EAST",
      playerId: "P4",
      name: DEFAULT_BOT_NAMES["EAST" /* EAST */],
      position: "EAST" /* EAST */,
      isHost: false,
      isReady: true,
      isBot: true
    });
  }
  getStatus() {
    return this.status;
  }
  getPlayerCount() {
    return Array.from(this.players.values()).filter((p) => !p.isBot).length;
  }
  getConnectedClientCount() {
    return this.clientSockets.size;
  }
  hasClient(clientId) {
    return this.clientSockets.has(clientId);
  }
  getClientPosition(clientId) {
    return this.clientPositions.get(clientId);
  }
  getParticipant(position) {
    return this.players.get(position);
  }
  getParticipants() {
    return Array.from(this.players.values());
  }
  getController() {
    return this.controller;
  }
  getSeatReservation(position) {
    const now = Date.now();
    for (const info of this.disconnectedSeats.values()) {
      if (info.position === position && now - info.disconnectedAt <= 45e3) {
        return {
          hasReservation: true,
          remainingMs: Math.max(0, 45e3 - (now - info.disconnectedAt))
        };
      }
    }
    return { hasReservation: false, remainingMs: null };
  }
  isSocketOpen(clientId) {
    const ws = this.clientSockets.get(clientId);
    return ws ? ws.readyState === WebSocket.OPEN : false;
  }
  isLobbyGraceActive() {
    if (this.status !== "LOBBY" || this.isDestroyed) return false;
    if (!this.lobbyOrphanedAt) return false;
    return Date.now() - this.lobbyOrphanedAt <= 3e5;
  }
  getLobbyOrphanedAt() {
    return this.lobbyOrphanedAt;
  }
  expireLobbyGraceForTesting(customCleanup) {
    if (this.lobbyGraceTimer) {
      clearTimeout(this.lobbyGraceTimer);
      this.lobbyGraceTimer = null;
    }
    this.lobbyOrphanedAt = null;
    if (customCleanup) {
      customCleanup();
    } else if (this.status === "LOBBY" && this.getConnectedClientCount() === 0 && !this.hasActiveReservations()) {
      RoomManager.getInstance().cleanupRoom(this.roomCode);
    }
  }
  isLobbyHostTransferPending() {
    if (this.status !== "LOBBY" || this.isDestroyed) return false;
    if (!this.lobbyHostDisconnectedAt) return false;
    return Date.now() - this.lobbyHostDisconnectedAt <= 45e3;
  }
  getLobbyHostDisconnectedAt() {
    return this.lobbyHostDisconnectedAt;
  }
  expireLobbyHostTransferForTesting() {
    if (this.lobbyHostTransferTimer) {
      clearTimeout(this.lobbyHostTransferTimer);
      this.lobbyHostTransferTimer = null;
    }
    this.lobbyHostDisconnectedAt = null;
    if (this.status === "LOBBY" && !this.isDestroyed) {
      const transferred = this.ensureHumanHost(true);
      if (transferred) {
        this.broadcastRoomState();
      }
    }
  }
  addPlayer(clientId, playerName, socket) {
    const cleanPlayerName = (playerName || "").replace(/\s*\(You\)$/i, "").replace(/\s*\(Bot\)$/i, "").replace(/^🤖\s*/, "").trim();
    if (this.clientPositions.has(clientId)) {
      this.clientSockets.set(clientId, socket);
      const assignedPos = this.clientPositions.get(clientId);
      if (this.status === "PLAYING" || this.status === "FINISHED") {
        if (this.controller) {
          const perspectiveState = this.controller.getPerspectiveState(assignedPos);
          const syncMsg = {
            type: "MATCH_SYNC",
            payload: {
              roomCode: this.roomCode,
              state: perspectiveState,
              myPosition: "SOUTH" /* SOUTH */,
              rawPosition: assignedPos
            }
          };
          socket.send(JSON.stringify(syncMsg));
          const currentTimer = this.controller.getCurrentTimer();
          if (currentTimer) {
            const clientIdx = SEAT_ORDER.indexOf(assignedPos);
            const rawIdx = SEAT_ORDER.indexOf(currentTimer.rawPosition);
            const mappedIdx = (rawIdx - clientIdx + 4) % 4;
            const mappedPos = SEAT_ORDER[mappedIdx];
            const timerMsg = {
              type: "TURN_TIMER",
              payload: {
                ...currentTimer,
                position: mappedPos
              }
            };
            socket.send(JSON.stringify(timerMsg));
          }
        }
      }
      return { success: true, position: assignedPos };
    }
    const humanSeats = Array.from(this.players.values()).filter((p) => !p.isBot);
    if (humanSeats.length >= 4) {
      return { success: false, error: "Table is full (4/4 players)" };
    }
    if (this.status === "PLAYING" || this.status === "FINISHED") {
      let targetPos = null;
      let matchedSeatInfo;
      const now = Date.now();
      if (this.disconnectedSeats.has(clientId)) {
        const info = this.disconnectedSeats.get(clientId);
        if (info && now - info.disconnectedAt <= 45e3) {
          matchedSeatInfo = info;
          targetPos = info.position;
        } else if (info) {
          this.clearSeatReservation(info.position);
        }
      } else if (cleanPlayerName && this.disconnectedSeats.has(cleanPlayerName.toLowerCase())) {
        const info = this.disconnectedSeats.get(cleanPlayerName.toLowerCase());
        if (info && now - info.disconnectedAt <= 45e3) {
          matchedSeatInfo = info;
          targetPos = info.position;
        } else if (info) {
          this.clearSeatReservation(info.position);
        }
      }
      const isReturningPlayer = matchedSeatInfo !== void 0;
      if (isReturningPlayer) {
        if (targetPos && this.players.get(targetPos)?.isBot) {
        } else {
          targetPos = null;
          for (const pos of SEAT_ORDER) {
            const participant2 = this.players.get(pos);
            if (participant2 && participant2.isBot) {
              targetPos = pos;
              break;
            }
          }
        }
        if (!targetPos) {
          return { success: false, error: "Table is full (4/4 players)" };
        }
        const incomingName2 = cleanPlayerName || matchedSeatInfo?.name || `Player ${targetPos}`;
        const seatId2 = POSITION_TO_SEAT[targetPos];
        const currentHostPos2 = this.clientPositions.get(this.hostClientId);
        const currentHost2 = currentHostPos2 ? this.players.get(currentHostPos2) : void 0;
        const isCurrentHostConnected2 = currentHost2 && !currentHost2.isBot && this.clientSockets.has(currentHost2.id) && this.clientSockets.get(currentHost2.id)?.readyState === WebSocket.OPEN;
        const shouldBeHost2 = !isCurrentHostConnected2 && (matchedSeatInfo?.wasHost ?? false);
        const newParticipant = {
          id: clientId,
          playerId: seatId2,
          name: incomingName2,
          position: targetPos,
          isHost: shouldBeHost2,
          isReady: true,
          isBot: false
        };
        if (shouldBeHost2) {
          this.hostClientId = clientId;
        }
        this.players.set(targetPos, newParticipant);
        this.clientSockets.set(clientId, socket);
        this.clientPositions.set(clientId, targetPos);
        this.clearSeatReservation(targetPos);
        this.ensureHumanHost(false);
        if (this.controller) {
          this.controller.takeoverBotSeat(targetPos, clientId, incomingName2);
          const perspectiveState = this.controller.getPerspectiveState(targetPos);
          const syncMsg = {
            type: "MATCH_SYNC",
            payload: {
              roomCode: this.roomCode,
              state: perspectiveState,
              myPosition: "SOUTH" /* SOUTH */,
              rawPosition: targetPos
            }
          };
          socket.send(JSON.stringify(syncMsg));
          const currentTimer = this.controller.getCurrentTimer();
          if (currentTimer) {
            const clientIdx = SEAT_ORDER.indexOf(targetPos);
            const rawIdx = SEAT_ORDER.indexOf(currentTimer.rawPosition);
            const mappedIdx = (rawIdx - clientIdx + 4) % 4;
            const mappedPos = SEAT_ORDER[mappedIdx];
            const timerMsg = {
              type: "TURN_TIMER",
              payload: {
                ...currentTimer,
                position: mappedPos
              }
            };
            socket.send(JSON.stringify(timerMsg));
          }
        }
        this.broadcastRoomState();
        this.broadcastGameState();
        const reconnectedMsg = `\u{1F389} ${incomingName2} reconnected to their seat!`;
        this.broadcast({
          type: "TOAST_NOTIFICATION",
          payload: {
            message: reconnectedMsg,
            type: "success"
          }
        });
        return { success: true, position: targetPos };
      }
      const availableSeats = [];
      for (const pos of SEAT_ORDER) {
        const participant2 = this.players.get(pos);
        if (participant2 && participant2.isBot) {
          const seatId2 = POSITION_TO_SEAT[pos];
          const isAutoPlay = participant2.name.toLowerCase().includes("auto-play") || this.disconnectedSeats.has(participant2.name.toLowerCase());
          const rawName = participant2.name.replace(/\s*\(You\)$/i, "").replace(/\s*\(Host\)$/i, "").replace(/\s*\(Auto-Play\)$/i, "").replace(/\s*\(Bot\)$/i, "").replace(/^🤖\s*/, "").trim();
          availableSeats.push({
            seat: pos,
            seatId: seatId2,
            type: isAutoPlay ? "auto_play" : "bot",
            label: isAutoPlay && rawName ? `Replace Bot on Seat ${seatId2} (${rawName})` : `Replace Bot on Seat ${seatId2}`
          });
        }
      }
      if (availableSeats.length === 0) {
        return { success: false, error: "Table is full (4/4 players)" };
      }
      targetPos = availableSeats[0].seat;
      const incomingName = cleanPlayerName || `Player ${targetPos}`;
      this.ensureHumanHost(false);
      let hostSocket = this.clientSockets.get(this.hostClientId);
      let isHostConnected = hostSocket && (hostSocket.readyState === void 0 || hostSocket.readyState === WebSocket.OPEN);
      const isHostHuman = Array.from(this.players.values()).some(
        (p) => p.id === this.hostClientId && !p.isBot
      );
      if (isHostConnected && hostSocket && isHostHuman) {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        this.pendingJoinRequests.set(requestId, {
          requestId,
          clientId,
          playerName: incomingName,
          socket,
          targetPos,
          timestamp: Date.now()
        });
        const pendingStatus = {
          type: "JOIN_REQUEST_STATUS",
          payload: {
            status: "PENDING",
            message: "Waiting for table host to accept your request...",
            requestId
          }
        };
        try {
          socket.send(JSON.stringify(pendingStatus));
        } catch {
        }
        const joinReqMsg = {
          type: "JOIN_REQUEST",
          payload: {
            requestId,
            playerName: incomingName,
            clientId,
            position: targetPos,
            availableSeats
          }
        };
        try {
          hostSocket.send(JSON.stringify(joinReqMsg));
        } catch {
        }
        return { success: true, position: targetPos };
      } else if (!isHostHuman) {
        this.clearSeatReservation(targetPos);
        const seatId2 = POSITION_TO_SEAT[targetPos];
        const newParticipant = {
          id: clientId,
          playerId: seatId2,
          name: incomingName,
          position: targetPos,
          isHost: true,
          isReady: true,
          isBot: false
        };
        this.players.set(targetPos, newParticipant);
        this.clientSockets.set(clientId, socket);
        this.clientPositions.set(clientId, targetPos);
        this.hostClientId = clientId;
        RoomManager.getInstance().registerClientRoom(clientId, this.roomCode);
        if (this.controller) {
          this.controller.takeoverBotSeat(targetPos, clientId, incomingName);
          const perspectiveState = this.controller.getPerspectiveState(targetPos);
          const syncMsg = {
            type: "MATCH_SYNC",
            payload: {
              roomCode: this.roomCode,
              state: perspectiveState,
              myPosition: "SOUTH" /* SOUTH */,
              rawPosition: targetPos
            }
          };
          socket.send(JSON.stringify(syncMsg));
          const currentTimer = this.controller.getCurrentTimer();
          if (currentTimer) {
            const clientIdx = SEAT_ORDER.indexOf(targetPos);
            const rawIdx = SEAT_ORDER.indexOf(currentTimer.rawPosition);
            const mappedIdx = (rawIdx - clientIdx + 4) % 4;
            const mappedPos = SEAT_ORDER[mappedIdx];
            const timerMsg = {
              type: "TURN_TIMER",
              payload: {
                ...currentTimer,
                position: mappedPos
              }
            };
            socket.send(JSON.stringify(timerMsg));
          }
        }
        this.ensureHumanHost(false);
        this.broadcastRoomState();
        this.broadcastGameState();
        this.broadcast({
          type: "TOAST_NOTIFICATION",
          payload: {
            message: `\u{1F451} ${incomingName} joined the table and is now Table Host.`,
            type: "success"
          }
        });
        return { success: true, position: targetPos };
      } else {
        try {
          const errMsg = {
            type: "ERROR",
            payload: {
              code: "HOST_UNAVAILABLE",
              message: "Table host is currently unreachable. Please try again in a moment."
            }
          };
          socket.send(JSON.stringify(errMsg));
        } catch {
        }
        return { success: false, error: "Table host is unreachable", errorCode: "HOST_UNAVAILABLE" };
      }
    }
    if (this.lobbyGraceTimer) {
      clearTimeout(this.lobbyGraceTimer);
      this.lobbyGraceTimer = null;
    }
    this.lobbyOrphanedAt = null;
    let preferredPos = null;
    const savedDisconnect = this.disconnectedSeats.get(clientId) || (cleanPlayerName ? this.disconnectedSeats.get(cleanPlayerName.toLowerCase()) : void 0);
    if (savedDisconnect && this.players.get(savedDisconnect.position)?.isBot) {
      preferredPos = savedDisconnect.position;
    }
    let openPosition = preferredPos;
    if (!openPosition) {
      for (const pos of SEAT_ORDER) {
        const p = this.players.get(pos);
        if (p && p.isBot) {
          openPosition = pos;
          break;
        }
      }
    }
    if (!openPosition) {
      return { success: false, error: "Table is full (4/4 players)" };
    }
    const seatId = POSITION_TO_SEAT[openPosition];
    let defaultName = "Friend 1";
    if (openPosition === "WEST" /* WEST */) defaultName = "Friend 1";
    else if (openPosition === "NORTH" /* NORTH */) defaultName = "Friend 2";
    else if (openPosition === "EAST" /* EAST */) defaultName = "Friend 3";
    else if (openPosition === "SOUTH" /* SOUTH */) defaultName = this.creatorName || "Host (Player 1)";
    const rawIncoming = (cleanPlayerName || "").trim();
    const isGeneric = !rawIncoming || /^(friend|player|guest|user|friend \(you\)|host player|host player \(you\))$/i.test(rawIncoming);
    const assignedName = isGeneric ? defaultName : rawIncoming;
    const isReturningHost = (savedDisconnect?.wasHost ?? false) || clientId === this.creatorClientId;
    const currentHostPos = this.clientPositions.get(this.hostClientId);
    const currentHost = currentHostPos ? this.players.get(currentHostPos) : void 0;
    const isCurrentHostConnected = currentHost && !currentHost.isBot && this.clientSockets.has(currentHost.id) && this.clientSockets.get(currentHost.id)?.readyState === WebSocket.OPEN;
    let shouldBeHost = false;
    if (isReturningHost) {
      shouldBeHost = !isCurrentHostConnected;
      if (this.lobbyHostTransferTimer) {
        clearTimeout(this.lobbyHostTransferTimer);
        this.lobbyHostTransferTimer = null;
      }
      this.lobbyHostDisconnectedAt = null;
    } else {
      shouldBeHost = !isCurrentHostConnected && !this.isLobbyHostTransferPending() && this.getConnectedClientCount() === 0;
    }
    const participant = {
      id: clientId,
      playerId: seatId,
      name: assignedName,
      position: openPosition,
      isHost: shouldBeHost,
      isReady: true,
      isBot: false
    };
    if (shouldBeHost) {
      this.hostClientId = clientId;
    }
    this.players.set(openPosition, participant);
    this.clientSockets.set(clientId, socket);
    this.clientPositions.set(clientId, openPosition);
    if (savedDisconnect) {
      this.clearSeatReservation(openPosition);
    }
    this.ensureHumanHost(false);
    this.broadcastRoomState();
    return { success: true, position: openPosition };
  }
  getActiveReservationCount() {
    const now = Date.now();
    let count = 0;
    const countedPositions = /* @__PURE__ */ new Set();
    for (const info of this.disconnectedSeats.values()) {
      if (now - info.disconnectedAt <= 45e3 && !countedPositions.has(info.position)) {
        countedPositions.add(info.position);
        count++;
      }
    }
    return count;
  }
  hasActiveReservations() {
    return this.getActiveReservationCount() > 0;
  }
  hasSeatReservation(seat) {
    const now = Date.now();
    for (const info of this.disconnectedSeats.values()) {
      if (info.position === seat && now - info.disconnectedAt <= 45e3) {
        return true;
      }
    }
    return false;
  }
  /**
   * Authoritative Human-Host Invariant:
   * RULE 1: If there is at least ONE connected/active Human participant in the room, the Host MUST be a Human.
   * RULE 2: A Bot may be Host ONLY when ZERO Humans remain in the room.
   * RULE 3: Host timeout causing Human → Bot conversion MUST immediately trigger Host transfer when another Human exists.
   * RULE 4: Do not make a Bot Host while any Human is available.
   * RULE 5: If Host disconnects/leaves, existing Host-transfer behavior must choose a Human when any Human remains.
   * RULE 6: If Host times out: convert seat to Bot, immediately transfer host to remaining human if any exists.
   */
  ensureHumanHost(notify = true) {
    const connectedHumans = [];
    for (const pos of SEAT_ORDER) {
      const p = this.players.get(pos);
      if (p && !p.isBot && this.clientSockets.has(p.id) && (this.clientSockets.get(p.id)?.readyState === void 0 || this.clientSockets.get(p.id)?.readyState === WebSocket.OPEN)) {
        connectedHumans.push(p);
      }
    }
    const currentHost = connectedHumans.find((p) => p.id === this.hostClientId && p.isHost);
    if (currentHost) {
      for (const p of this.players.values()) {
        if (p.id !== currentHost.id && p.isHost) {
          p.isHost = false;
        }
      }
      return false;
    }
    if (this.status === "LOBBY" && this.isLobbyHostTransferPending()) {
      return false;
    }
    if (connectedHumans.length > 0) {
      const newHost = connectedHumans[0];
      for (const p of this.players.values()) {
        p.isHost = false;
      }
      newHost.isHost = true;
      this.hostClientId = newHost.id;
      if (notify) {
        const cleanName = newHost.name.replace(/\s*\(You\)$/i, "").replace(/\s*\(Host\)$/i, "").replace(/\s*\(Bot\)$/i, "").trim() || "Player";
        this.broadcast({
          type: "TOAST_NOTIFICATION",
          payload: {
            message: `\u{1F451} ${cleanName} is now the Table Host.`,
            type: "info"
          }
        });
      }
      return true;
    }
    let existingBotHost = Array.from(this.players.values()).find((p) => p.isHost);
    if (!existingBotHost) {
      const southBot = this.players.get("SOUTH" /* SOUTH */) || Array.from(this.players.values())[0];
      if (southBot) {
        southBot.isHost = true;
        this.hostClientId = southBot.id;
      }
    } else {
      this.hostClientId = existingBotHost.id;
    }
    return false;
  }
  removeClient(clientId, isExplicit = false) {
    const pos = this.clientPositions.get(clientId);
    const leavingPlayer = pos ? this.players.get(pos) : void 0;
    const rawPlayerName = leavingPlayer ? leavingPlayer.name : "A player";
    const cleanPlayerName = rawPlayerName.replace(/\s*\(You\)$/i, "").replace(/\s*\(Host\)$/i, "").replace(/\s*\(Bot\)$/i, "").replace(/^🤖\s*/, "").trim();
    this.clientSockets.delete(clientId);
    this.clientPositions.delete(clientId);
    if (!pos) return;
    const seatId = POSITION_TO_SEAT[pos];
    const wasHost = clientId === this.hostClientId || leavingPlayer?.isHost === true;
    const persona = DEFAULT_BOT_NAMES[pos] || "Bot: Shield";
    const botName = this.status === "PLAYING" && cleanPlayerName && !isExplicit ? `\u{1F916} ${cleanPlayerName} (Auto-Play)` : persona;
    const botParticipant = {
      id: `bot_${pos}`,
      playerId: seatId,
      name: botName,
      position: pos,
      isHost: false,
      isReady: true,
      isBot: true
    };
    this.players.set(pos, botParticipant);
    if (this.status === "LOBBY") {
      if (isExplicit) {
        this.clearSeatReservation(pos);
        if (this.lobbyGraceTimer) {
          clearTimeout(this.lobbyGraceTimer);
          this.lobbyGraceTimer = null;
        }
        this.lobbyOrphanedAt = null;
        if (this.lobbyHostTransferTimer) {
          clearTimeout(this.lobbyHostTransferTimer);
          this.lobbyHostTransferTimer = null;
        }
        this.lobbyHostDisconnectedAt = null;
        this.ensureHumanHost(true);
      } else {
        const seatInfo = {
          position: pos,
          name: cleanPlayerName,
          originalClientId: clientId,
          wasHost,
          disconnectedAt: Date.now()
        };
        this.disconnectedSeats.set(clientId, seatInfo);
        if (cleanPlayerName) {
          this.disconnectedSeats.set(cleanPlayerName.toLowerCase(), seatInfo);
        }
        if (wasHost) {
          this.lobbyHostDisconnectedAt = Date.now();
          if (this.lobbyHostTransferTimer) {
            clearTimeout(this.lobbyHostTransferTimer);
          }
          this.lobbyHostTransferTimer = setTimeout(() => {
            this.lobbyHostTransferTimer = null;
            this.lobbyHostDisconnectedAt = null;
            if (this.status === "LOBBY" && !this.isDestroyed) {
              const transferred = this.ensureHumanHost(true);
              if (transferred) {
                this.broadcastRoomState();
              }
            }
          }, 45e3);
        }
        this.ensureHumanHost(true);
        if (this.getConnectedClientCount() === 0) {
          if (!this.lobbyGraceTimer) {
            this.lobbyOrphanedAt = Date.now();
            this.lobbyGraceTimer = setTimeout(() => {
              this.lobbyGraceTimer = null;
              this.lobbyOrphanedAt = null;
              if (this.status === "LOBBY" && this.getConnectedClientCount() === 0 && !this.hasActiveReservations()) {
                RoomManager.getInstance().cleanupRoom(this.roomCode);
              }
            }, 3e5);
          }
        }
      }
      this.broadcastRoomState();
    } else if (this.status === "FINISHED") {
      this.ensureHumanHost(true);
      this.broadcastRoomState();
      if (this.getConnectedClientCount() === 0) {
        RoomManager.getInstance().cleanupRoom(this.roomCode);
      }
    } else if (this.status === "PLAYING") {
      this.ensureHumanHost(true);
      this.clearSeatReservation(pos);
      if (isExplicit) {
        if (this.controller) {
          this.controller.replacePlayerWithBot(pos, botName);
        }
      } else {
        const disconnectTime = Date.now();
        const reservationTimer = setTimeout(() => {
          const currentInfo = this.disconnectedSeats.get(clientId);
          if (currentInfo && currentInfo.position === pos) {
            this.clearSeatReservation(pos);
            const seatPart = this.players.get(pos);
            if (seatPart && seatPart.isBot) {
              const defaultBot = DEFAULT_BOT_NAMES[pos] || `Bot: ${pos}`;
              seatPart.name = defaultBot;
              if (this.controller) {
                this.controller.replacePlayerWithBot(pos, defaultBot);
              }
            }
            this.broadcast({
              type: "TOAST_NOTIFICATION",
              payload: {
                message: `\u23F1\uFE0F Reconnect reservation expired for seat ${pos}. Now open for takeover.`,
                type: "info"
              }
            });
            this.broadcastRoomState();
            this.broadcastGameState();
            RoomManager.getInstance().cleanupRoomIfEmpty(this.roomCode);
          }
        }, 45e3);
        const seatInfo = {
          position: pos,
          name: cleanPlayerName,
          originalClientId: clientId,
          wasHost,
          disconnectedAt: disconnectTime,
          reservationTimeout: reservationTimer
        };
        this.disconnectedSeats.set(clientId, seatInfo);
        if (cleanPlayerName) {
          this.disconnectedSeats.set(cleanPlayerName.toLowerCase(), seatInfo);
        }
        if (this.controller) {
          this.controller.replacePlayerWithBot(pos, botName);
        }
      }
      this.broadcast({
        type: "PLAYER_DISCONNECTED",
        payload: {
          seat: pos,
          playerName: cleanPlayerName
        }
      });
      this.broadcast({
        type: "PLAYER_LEFT",
        payload: {
          clientId,
          playerName: cleanPlayerName,
          position: pos
        }
      });
      this.broadcast({
        type: "TOAST_NOTIFICATION",
        payload: {
          message: isExplicit ? `\u{1F6AA} ${cleanPlayerName} left the table.` : `\u26A0\uFE0F ${cleanPlayerName} disconnected. Bot is now playing.`,
          type: "warning"
        }
      });
      this.broadcastRoomState();
      this.broadcastGameState();
    }
  }
  handleJoinResponse(hostClientId, requestId, accept, targetSeat) {
    if (hostClientId !== this.hostClientId) {
      return { success: false, error: "Only the room host can approve join requests." };
    }
    const pending = this.pendingJoinRequests.get(requestId);
    if (!pending) {
      return { success: false, error: "Join request not found or expired." };
    }
    this.pendingJoinRequests.delete(requestId);
    if (!accept) {
      try {
        const declineMsg = {
          type: "JOIN_REQUEST_STATUS",
          payload: {
            status: "DECLINED",
            message: "Host declined your join request.",
            requestId
          }
        };
        pending.socket.send(JSON.stringify(declineMsg));
        const errMsg = {
          type: "ERROR",
          payload: {
            code: "JOIN_DECLINED",
            message: "Host declined your join request."
          }
        };
        pending.socket.send(JSON.stringify(errMsg));
      } catch (err) {
      }
      return { success: true };
    }
    let chosenSeat = targetSeat || pending.targetPos;
    if (!this.players.get(chosenSeat)?.isBot) {
      chosenSeat = null;
      for (const pos of SEAT_ORDER) {
        if (this.players.get(pos)?.isBot) {
          chosenSeat = pos;
          break;
        }
      }
    }
    if (!chosenSeat) {
      try {
        pending.socket.send(
          JSON.stringify({
            type: "ERROR",
            payload: { message: "Table is full (4/4 players)" }
          })
        );
      } catch {
      }
      return { success: false, error: "Table is full (4/4 players)" };
    }
    this.clearSeatReservation(chosenSeat);
    const chosenSeatId = POSITION_TO_SEAT[chosenSeat];
    const newParticipant = {
      id: pending.clientId,
      playerId: chosenSeatId,
      name: pending.playerName,
      position: chosenSeat,
      isHost: false,
      isReady: true,
      isBot: false
    };
    this.players.set(chosenSeat, newParticipant);
    this.clientSockets.set(pending.clientId, pending.socket);
    this.clientPositions.set(pending.clientId, chosenSeat);
    RoomManager.getInstance().registerClientRoom(pending.clientId, this.roomCode);
    if (this.controller) {
      this.controller.takeoverBotSeat(chosenSeat, pending.clientId, pending.playerName);
    }
    try {
      const acceptedStatus = {
        type: "JOIN_REQUEST_STATUS",
        payload: {
          status: "ACCEPTED",
          message: "Join request accepted!",
          requestId
        }
      };
      pending.socket.send(JSON.stringify(acceptedStatus));
      if (this.controller) {
        const perspectiveState = this.controller.getPerspectiveState(chosenSeat);
        const syncMsg = {
          type: "MATCH_SYNC",
          payload: {
            roomCode: this.roomCode,
            state: perspectiveState,
            myPosition: "SOUTH" /* SOUTH */,
            rawPosition: chosenSeat
          }
        };
        pending.socket.send(JSON.stringify(syncMsg));
        const currentTimer = this.controller.getCurrentTimer();
        if (currentTimer) {
          const clientIdx = SEAT_ORDER.indexOf(chosenSeat);
          const rawIdx = SEAT_ORDER.indexOf(currentTimer.rawPosition);
          const mappedIdx = (rawIdx - clientIdx + 4) % 4;
          const mappedPos = SEAT_ORDER[mappedIdx];
          const timerMsg = {
            type: "TURN_TIMER",
            payload: {
              ...currentTimer,
              position: mappedPos
            }
          };
          pending.socket.send(JSON.stringify(timerMsg));
        }
      }
    } catch (err) {
      console.error("[RoomManager] Failed to send sync to admitted player:", err);
    }
    this.broadcast({
      type: "TOAST_NOTIFICATION",
      payload: {
        message: `${pending.playerName} joined the table!`,
        type: "success"
      }
    });
    RoomManager.getInstance().registerClientRoom(pending.clientId, this.roomCode);
    this.ensureHumanHost(false);
    this.broadcastRoomState();
    this.broadcastGameState();
    return { success: true };
  }
  clearSeatReservation(seat) {
    for (const [key, info] of Array.from(this.disconnectedSeats.entries())) {
      if (info.position === seat) {
        if (info.reservationTimeout) {
          clearTimeout(info.reservationTimeout);
        }
        this.disconnectedSeats.delete(key);
      }
    }
  }
  handleConvertToBot(hostClientId, seat) {
    if (hostClientId !== this.hostClientId) {
      return { success: false, error: "Only the room host can convert seats to permanent bots." };
    }
    const participant = this.players.get(seat);
    if (!participant) {
      return { success: false, error: "Player seat not found." };
    }
    if (participant.id === hostClientId || participant.isHost) {
      return { success: false, error: "Host cannot convert their own seat to a bot. Transfer host role first." };
    }
    this.clearSeatReservation(seat);
    if (!participant.isBot && this.clientSockets.has(participant.id)) {
      const targetSocket = this.clientSockets.get(participant.id);
      if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
        try {
          targetSocket.send(
            JSON.stringify({
              type: "TOAST_NOTIFICATION",
              payload: {
                message: "The table host converted your seat to an AI Bot.",
                type: "warning"
              }
            })
          );
        } catch {
        }
      }
      this.clientPositions.delete(participant.id);
      this.clientSockets.delete(participant.id);
    }
    const botName = DEFAULT_BOT_NAMES[seat] || `Bot: ${seat}`;
    participant.id = `bot_${seat}`;
    participant.isBot = true;
    participant.playerId = POSITION_TO_SEAT[seat];
    participant.name = botName;
    if (this.controller) {
      this.controller.replacePlayerWithBot(seat, botName);
    }
    this.broadcast({
      type: "TOAST_NOTIFICATION",
      payload: {
        message: `\u{1F916} Seat ${POSITION_TO_SEAT[seat]} (${seat}) converted to AI Bot.`,
        type: "info"
      }
    });
    this.ensureHumanHost(true);
    this.broadcastRoomState();
    this.broadcastGameState();
    return { success: true };
  }
  handleKickPlayer(hostClientId, seat) {
    return this.handleConvertToBot(hostClientId, seat);
  }
  handleSwapSeats(hostClientId, seatA, seatB) {
    if (hostClientId !== this.hostClientId) {
      return { success: false, error: "Only the room host can swap player seats." };
    }
    if (seatA === seatB) {
      return { success: true };
    }
    const partA = this.players.get(seatA);
    const partB = this.players.get(seatB);
    if (!partA || !partB) {
      return { success: false, error: "Invalid seats specified for swap." };
    }
    this.clearSeatReservation(seatA);
    this.clearSeatReservation(seatB);
    partA.position = seatB;
    partA.playerId = POSITION_TO_SEAT[seatB];
    partB.position = seatA;
    partB.playerId = POSITION_TO_SEAT[seatA];
    this.players.set(seatA, partB);
    this.players.set(seatB, partA);
    if (!partA.isBot && this.clientSockets.has(partA.id)) {
      this.clientPositions.set(partA.id, seatB);
    }
    if (!partB.isBot && this.clientSockets.has(partB.id)) {
      this.clientPositions.set(partB.id, seatA);
    }
    if (this.controller) {
      if (partB.isBot) {
        this.controller.replacePlayerWithBot(seatA, partB.name);
      } else {
        this.controller.takeoverBotSeat(seatA, partB.id, partB.name);
      }
      if (partA.isBot) {
        this.controller.replacePlayerWithBot(seatB, partA.name);
      } else {
        this.controller.takeoverBotSeat(seatB, partA.id, partA.name);
      }
    }
    this.broadcast({
      type: "TOAST_NOTIFICATION",
      payload: {
        message: `\u{1F504} Host swapped Seat ${POSITION_TO_SEAT[seatA]} (${seatA}) and Seat ${POSITION_TO_SEAT[seatB]} (${seatB}).`,
        type: "info"
      }
    });
    this.broadcastRoomState();
    this.broadcastGameState();
    return { success: true };
  }
  startMatch(requestingClientId, autoFillBots, totalRounds = 5) {
    if (requestingClientId !== this.hostClientId) {
      return { success: false, error: "Only the room host can start the table." };
    }
    const isMatchEnded = this.status === "FINISHED" || this.controller && this.controller.getState().status === "MATCH_FINISHED" /* MATCH_FINISHED */;
    if (this.status === "PLAYING" && !isMatchEnded) {
      return { success: false, error: "Game is already in progress." };
    }
    if (this.lobbyGraceTimer) {
      clearTimeout(this.lobbyGraceTimer);
      this.lobbyGraceTimer = null;
    }
    this.lobbyOrphanedAt = null;
    if (this.lobbyHostTransferTimer) {
      clearTimeout(this.lobbyHostTransferTimer);
      this.lobbyHostTransferTimer = null;
    }
    this.lobbyHostDisconnectedAt = null;
    if (this.unsubscribeEvents) {
      this.unsubscribeEvents();
      this.unsubscribeEvents = null;
    }
    if (this.unsubscribeState) {
      this.unsubscribeState();
      this.unsubscribeState = null;
    }
    if (this.unsubscribeTimer) {
      this.unsubscribeTimer();
      this.unsubscribeTimer = null;
    }
    if (this.unsubscribeRebid) {
      this.unsubscribeRebid();
      this.unsubscribeRebid = null;
    }
    if (this.controller) {
      this.controller.destroy();
      this.controller = null;
    }
    this.autoFillBots = autoFillBots;
    this.totalRounds = totalRounds === 10 ? 10 : 5;
    for (const pos of SEAT_ORDER) {
      if (!this.players.has(pos)) {
        const seatId = POSITION_TO_SEAT[pos];
        this.players.set(pos, {
          id: `bot_${pos}`,
          playerId: seatId,
          name: DEFAULT_BOT_NAMES[pos],
          position: pos,
          isHost: false,
          isReady: true,
          isBot: true
        });
      }
    }
    this.status = "PLAYING";
    this.broadcast({
      type: "MATCH_STARTED",
      payload: { roomCode: this.roomCode }
    });
    this.broadcast({
      type: "GAME_STARTED",
      payload: { roomCode: this.roomCode }
    });
    this.broadcastRoomState();
    const playerConfigs = {
      ["SOUTH" /* SOUTH */]: {
        id: this.players.get("SOUTH" /* SOUTH */).id,
        name: this.players.get("SOUTH" /* SOUTH */).name,
        isBot: this.players.get("SOUTH" /* SOUTH */).isBot,
        position: "SOUTH" /* SOUTH */
      },
      ["WEST" /* WEST */]: {
        id: this.players.get("WEST" /* WEST */).id,
        name: this.players.get("WEST" /* WEST */).name,
        isBot: this.players.get("WEST" /* WEST */).isBot,
        position: "WEST" /* WEST */
      },
      ["NORTH" /* NORTH */]: {
        id: this.players.get("NORTH" /* NORTH */).id,
        name: this.players.get("NORTH" /* NORTH */).name,
        isBot: this.players.get("NORTH" /* NORTH */).isBot,
        position: "NORTH" /* NORTH */
      },
      ["EAST" /* EAST */]: {
        id: this.players.get("EAST" /* EAST */).id,
        name: this.players.get("EAST" /* EAST */).name,
        isBot: this.players.get("EAST" /* EAST */).isBot,
        position: "EAST" /* EAST */
      }
    };
    this.controller = new AuthoritativeGameController();
    this.controller.setHostPositionProvider((pos) => {
      const participant = this.players.get(pos);
      return !!participant && participant.isHost && !participant.isBot;
    });
    this.unsubscribeEvents = this.controller.onEvent((event) => {
      this.broadcast({
        type: "GAME_EVENT",
        payload: event
      });
      if (event.type === "ROUND_COMPLETED") {
        if (this.controller && this.persistentMatchId) {
          const state = this.controller.getState();
          const roundNum = event.payload.roundNumber;
          const roundScoreRecord = state.roundScores.find((r) => r.roundNumber === roundNum);
          if (roundScoreRecord) {
            const bids = {
              ["SOUTH" /* SOUTH */]: state.players["SOUTH" /* SOUTH */]?.currentBid ?? null,
              ["WEST" /* WEST */]: state.players["WEST" /* WEST */]?.currentBid ?? null,
              ["NORTH" /* NORTH */]: state.players["NORTH" /* NORTH */]?.currentBid ?? null,
              ["EAST" /* EAST */]: state.players["EAST" /* EAST */]?.currentBid ?? null
            };
            const tricks = {
              ["SOUTH" /* SOUTH */]: state.players["SOUTH" /* SOUTH */]?.tricksWon ?? 0,
              ["WEST" /* WEST */]: state.players["WEST" /* WEST */]?.tricksWon ?? 0,
              ["NORTH" /* NORTH */]: state.players["NORTH" /* NORTH */]?.tricksWon ?? 0,
              ["EAST" /* EAST */]: state.players["EAST" /* EAST */]?.tricksWon ?? 0
            };
            PersistenceService.getInstance().onRoundComplete(
              this.persistentMatchId,
              roundNum,
              state.dealer,
              roundScoreRecord,
              bids,
              tricks,
              this.getParticipants()
            ).catch(() => {
            });
          }
        }
      }
      if (event.type === "MATCH_COMPLETED") {
        this.status = "FINISHED";
        this.broadcastRoomState();
        this.scheduleFinishedCleanup();
        if (this.controller && this.persistentMatchId) {
          const state = this.controller.getState();
          PersistenceService.getInstance().onMatchComplete(
            this.persistentMatchId,
            state,
            this.getParticipants()
          ).catch(() => {
          });
        }
      }
    });
    this.unsubscribeState = this.controller.onStateChange(() => {
      this.broadcastGameState();
    });
    this.unsubscribeTimer = this.controller.onTimerTick((payload) => {
      this.broadcastTimer(payload);
    });
    this.unsubscribeRebid = this.controller.onRebid(({ message }) => {
      this.broadcast({
        type: "TOAST_NOTIFICATION",
        payload: {
          message,
          type: "warning"
        }
      });
    });
    this.unsubscribeTimeoutTakeover = this.controller.onTimeoutTakeover((pos) => {
      const participant = this.players.get(pos);
      if (participant && !participant.isBot) {
        const wasHost = participant.isHost;
        participant.isBot = true;
        const cleanName = participant.name.replace(/\s*\(You\)$/i, "").replace(/\s*\(Host\)$/i, "").replace(/\s*\(Bot\)$/i, "").trim();
        this.ensureHumanHost(true);
        this.broadcastRoomState();
        this.broadcastGameState();
        const timeoutSec = wasHost ? 50 : 30;
        this.broadcast({
          type: "TOAST_NOTIFICATION",
          payload: {
            message: `\u23F1\uFE0F ${cleanName || "Player"} timed out (${timeoutSec}s). Auto-play Bot took over seat.`,
            type: "info"
          }
        });
      }
    });
    this.controller.initializeMatch(playerConfigs, this.totalRounds, false);
    this.broadcastGameState();
    PersistenceService.getInstance().onMatchStart(this.roomCode, this.totalRounds, this.getParticipants()).then((mId) => {
      this.persistentMatchId = mId;
    }).catch(() => {
    });
    if (this.readyFallbackTimer) {
      clearTimeout(this.readyFallbackTimer);
    }
    this.readyFallbackTimer = setTimeout(() => {
      if (this.status === "PLAYING" && this.controller) {
        this.controller.startTurnProgression();
      }
    }, 1500);
    return { success: true };
  }
  getRoomStatePayload(clientId) {
    const playerList = Array.from(this.players.values());
    const assignedPos = this.clientPositions.get(clientId);
    return {
      roomCode: this.roomCode,
      hostId: this.hostClientId,
      status: this.status,
      players: playerList,
      assignedPosition: assignedPos,
      myClientId: clientId,
      autoFillBots: this.autoFillBots,
      totalRounds: this.totalRounds
    };
  }
  handleClientReady(clientId) {
    if (this.readyFallbackTimer) {
      clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }
    const pos = this.clientPositions.get(clientId);
    const socket = this.clientSockets.get(clientId);
    if (socket && (socket.readyState === 1 || socket.readyState === WebSocket.OPEN)) {
      if (pos && this.controller && (this.status === "PLAYING" || this.status === "FINISHED")) {
        const perspectiveState = this.controller.getPerspectiveState(pos);
        const syncMsg = {
          type: "MATCH_SYNC",
          payload: {
            roomCode: this.roomCode,
            state: perspectiveState,
            myPosition: "SOUTH" /* SOUTH */,
            rawPosition: pos
          }
        };
        socket.send(JSON.stringify(syncMsg));
      } else {
        socket.send(
          JSON.stringify({
            type: "ROOM_STATE",
            payload: this.getRoomStatePayload(clientId)
          })
        );
      }
    }
    if (this.status === "PLAYING" && this.controller) {
      this.controller.startTurnProgression();
    }
  }
  renameSeat(requestingClientId, targetSeat, newName) {
    if (requestingClientId !== this.hostClientId) {
      return { success: false, error: "Only the host can rename player seats." };
    }
    const player = this.players.get(targetSeat);
    if (!player) {
      return { success: false, error: "Target seat is empty." };
    }
    const defaultName = targetSeat === "SOUTH" /* SOUTH */ ? "Host" : `Friend ${targetSeat === "WEST" /* WEST */ ? 1 : targetSeat === "NORTH" /* NORTH */ ? 2 : 3}`;
    const clean = newName.trim() || defaultName;
    player.name = clean;
    if (this.controller) {
      this.controller.takeoverBotSeat(targetSeat, player.id, clean);
    }
    this.broadcastRoomState();
    this.broadcastGameState();
    return { success: true };
  }
  transferHost(requestingClientId, targetSeatOrClientId) {
    if (requestingClientId !== this.hostClientId) {
      return { success: false, error: "Only the room host can transfer the host role." };
    }
    let targetParticipant;
    if (Object.values(PlayerPosition).includes(targetSeatOrClientId)) {
      targetParticipant = this.players.get(targetSeatOrClientId);
    } else {
      targetParticipant = Array.from(this.players.values()).find((p) => p.id === targetSeatOrClientId);
    }
    if (!targetParticipant) {
      return { success: false, error: "Target player not found." };
    }
    if (targetParticipant.isBot || !this.clientSockets.has(targetParticipant.id)) {
      return { success: false, error: "Cannot transfer host role to a bot or offline player." };
    }
    if (targetParticipant.id === this.hostClientId) {
      return { success: true };
    }
    for (const p of this.players.values()) {
      if (p.isHost) {
        p.isHost = false;
      }
    }
    targetParticipant.isHost = true;
    this.hostClientId = targetParticipant.id;
    const cleanNewHostName = targetParticipant.name.replace(/\s*\(You\)$/i, "").replace(/\s*\(Host\)$/i, "").trim() || "Player";
    this.broadcast({
      type: "TOAST_NOTIFICATION",
      payload: {
        message: `\u{1F451} ${cleanNewHostName} is now the Table Host.`,
        type: "info"
      }
    });
    this.ensureHumanHost(false);
    this.broadcastRoomState();
    this.broadcastGameState();
    if (this.controller) {
      const activeTimer = this.controller.getCurrentTimer();
      if (activeTimer) {
        this.broadcastTimer(activeTimer);
      }
    }
    return { success: true };
  }
  handleBid(clientId, bid) {
    if (!this.controller || this.status !== "PLAYING") {
      return { success: false, error: "Game is not active." };
    }
    const pos = this.clientPositions.get(clientId);
    if (!pos) {
      return { success: false, error: "Player is not seated in this match." };
    }
    const success = this.controller.submitBid(pos, bid);
    return { success, error: success ? void 0 : "Illegal or out-of-turn bid." };
  }
  handlePlayCard(clientId, card) {
    if (!this.controller || this.status !== "PLAYING") {
      return { success: false, error: "Game is not active." };
    }
    const pos = this.clientPositions.get(clientId);
    if (!pos) {
      return { success: false, error: "Player is not seated in this match." };
    }
    const success = this.controller.playCard(pos, card);
    return { success, error: success ? void 0 : "Illegal or out-of-turn card play." };
  }
  handleNextRound(clientId) {
    if (!this.controller || this.status !== "PLAYING") {
      return { success: false, error: "Game is not active." };
    }
    const success = this.controller.nextRound();
    return { success, error: success ? void 0 : "Cannot advance round at this time." };
  }
  broadcastRoomState() {
    for (const [clientId, socket] of this.clientSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        const msg = {
          type: "ROOM_STATE",
          payload: this.getRoomStatePayload(clientId)
        };
        socket.send(JSON.stringify(msg));
      }
    }
  }
  broadcastGameState() {
    if (!this.controller) return;
    for (const [clientId, socket] of this.clientSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        const rawPos = this.clientPositions.get(clientId) ?? "SOUTH" /* SOUTH */;
        const perspectiveState = this.controller.getPerspectiveState(rawPos);
        const msg = {
          type: "GAME_STATE",
          payload: {
            state: perspectiveState,
            myPosition: "SOUTH" /* SOUTH */,
            rawPosition: rawPos
          }
        };
        socket.send(JSON.stringify(msg));
      }
    }
  }
  broadcast(message) {
    const serialized = JSON.stringify(message);
    for (const socket of this.clientSockets.values()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serialized);
      }
    }
  }
  broadcastTimer(payload) {
    for (const [clientId, socket] of this.clientSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        const clientRawPos = this.clientPositions.get(clientId) ?? "SOUTH" /* SOUTH */;
        const clientIdx = SEAT_ORDER.indexOf(clientRawPos);
        const rawIdx = SEAT_ORDER.indexOf(payload.rawPosition);
        const mappedIdx = (rawIdx - clientIdx + 4) % 4;
        const mappedPos = SEAT_ORDER[mappedIdx];
        const msg = {
          type: "TURN_TIMER",
          payload: {
            position: mappedPos,
            rawPosition: payload.rawPosition,
            remainingSec: payload.remainingSec,
            totalSec: payload.totalSec,
            isExtraTime: payload.isExtraTime
          }
        };
        socket.send(JSON.stringify(msg));
      }
    }
  }
  scheduleFinishedCleanup() {
    if (this.finishedCleanupTimer) {
      clearTimeout(this.finishedCleanupTimer);
      this.finishedCleanupTimer = null;
    }
    if (this.getConnectedClientCount() === 0) {
      RoomManager.getInstance().cleanupRoom(this.roomCode);
      return;
    }
    this.finishedCleanupTimer = setTimeout(() => {
      this.finishedCleanupTimer = null;
      RoomManager.getInstance().cleanupRoom(this.roomCode);
    }, 9e4);
  }
  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    if (this.lobbyGraceTimer) {
      clearTimeout(this.lobbyGraceTimer);
      this.lobbyGraceTimer = null;
    }
    this.lobbyOrphanedAt = null;
    if (this.lobbyHostTransferTimer) {
      clearTimeout(this.lobbyHostTransferTimer);
      this.lobbyHostTransferTimer = null;
    }
    this.lobbyHostDisconnectedAt = null;
    if (this.finishedCleanupTimer) {
      clearTimeout(this.finishedCleanupTimer);
      this.finishedCleanupTimer = null;
    }
    for (const info of Array.from(this.disconnectedSeats.values())) {
      if (info.reservationTimeout) {
        clearTimeout(info.reservationTimeout);
      }
    }
    this.disconnectedSeats.clear();
    this.pendingJoinRequests.clear();
    if (this.readyFallbackTimer) {
      clearTimeout(this.readyFallbackTimer);
      this.readyFallbackTimer = null;
    }
    if (this.unsubscribeEvents) this.unsubscribeEvents();
    if (this.unsubscribeState) this.unsubscribeState();
    if (this.unsubscribeTimer) this.unsubscribeTimer();
    if (this.unsubscribeRebid) this.unsubscribeRebid();
    if (this.unsubscribeTimeoutTakeover) this.unsubscribeTimeoutTakeover();
    if (this.controller) this.controller.destroy();
    this.clientSockets.clear();
    this.clientPositions.clear();
    this.players.clear();
  }
  getPublicSummary() {
    if (this.status === "FINISHED" || this.isDestroyed) return null;
    const connectedHumanCount = this.getConnectedClientCount();
    const hasReservations = this.hasActiveReservations();
    const isLobbyGrace = this.isLobbyGraceActive();
    if (connectedHumanCount === 0 && !hasReservations && !isLobbyGrace) {
      return null;
    }
    const playersList = Array.from(this.players.values());
    const humanCount = playersList.filter((p) => !p.isBot).length;
    const botCount = playersList.filter((p) => p.isBot).length;
    if (humanCount >= 4) return null;
    if (this.status === "PLAYING" && botCount === 0) return null;
    let hostName = this.creatorName || "Host";
    if (connectedHumanCount > 0) {
      const hostParticipant = playersList.find((p) => p.id === this.hostClientId && !p.isBot) || playersList.find((p) => p.isHost && !p.isBot);
      if (hostParticipant) {
        hostName = hostParticipant.name;
      }
    }
    if (this.status === "LOBBY") {
      return {
        roomCode: this.roomCode,
        hostName,
        humanCount: Math.max(connectedHumanCount, humanCount),
        totalSeats: 4,
        status: "WAITING",
        currentRound: 1,
        totalRounds: this.totalRounds || 5,
        isJoinable: true
      };
    }
    if (this.status === "PLAYING") {
      const currentRound = this.controller ? this.controller.getState().currentRound : 1;
      return {
        roomCode: this.roomCode,
        hostName,
        humanCount: Math.max(connectedHumanCount, humanCount),
        totalSeats: 4,
        status: "PLAYING",
        currentRound,
        totalRounds: this.totalRounds || 5,
        isJoinable: true
      };
    }
    return null;
  }
};
var RoomManager = class _RoomManager {
  constructor() {
    this.rooms = /* @__PURE__ */ new Map();
    this.clientRoomMap = /* @__PURE__ */ new Map();
  }
  static {
    this.instance = null;
  }
  // clientId -> roomCode
  static getInstance() {
    if (!_RoomManager.instance) {
      _RoomManager.instance = new _RoomManager();
    }
    return _RoomManager.instance;
  }
  generateRoomCode(playerName) {
    if (playerName && playerName.trim().length > 0) {
      return generateRoomCodeFromPlayerName(playerName, this.rooms);
    }
    let code;
    let attempts = 0;
    do {
      code = Math.floor(1e5 + Math.random() * 9e5).toString();
      attempts++;
    } while (this.rooms.has(code) && attempts < 100);
    return code;
  }
  createRoom(hostClientId, hostName, hostSocket, requestedCode) {
    const trimmedHostName = (hostName || "").trim();
    if (!trimmedHostName) {
      return {
        success: false,
        error: "Please enter your name.",
        errorCode: "INVALID_NAME"
      };
    }
    let roomCode;
    if (requestedCode && requestedCode.trim().length > 0) {
      const cleanRequested = normalizeRoomCode(requestedCode);
      if (cleanRequested.length < 3 || cleanRequested.length > 10) {
        return {
          success: false,
          error: "Room ID must be between 3 and 10 alphanumeric characters.",
          errorCode: "INVALID_ROOM_CODE"
        };
      }
      if (this.rooms.has(cleanRequested)) {
        return {
          success: false,
          error: `Room ID "${cleanRequested}" is already active.`,
          errorCode: "ROOM_ALREADY_EXISTS"
        };
      }
      roomCode = cleanRequested;
    } else {
      roomCode = generateRoomCodeFromPlayerName(trimmedHostName, this.rooms);
    }
    this.leaveRoom(hostClientId);
    const room = new GameRoom(roomCode, hostClientId, trimmedHostName, hostSocket);
    this.rooms.set(roomCode, room);
    this.clientRoomMap.set(hostClientId, roomCode);
    room.broadcastRoomState();
    return { success: true, room };
  }
  joinRoom(roomCode, clientId, playerName, socket) {
    const trimmedPlayerName = (playerName || "").trim();
    if (!trimmedPlayerName) {
      return {
        success: false,
        error: "Please enter your name.",
        errorCode: "INVALID_NAME"
      };
    }
    const cleanCode = normalizeRoomCode(roomCode);
    const room = this.rooms.get(cleanCode);
    if (!room) {
      return {
        success: false,
        error: `No active table found with code: ${cleanCode}`,
        errorCode: "ROOM_NOT_FOUND"
      };
    }
    const currentRoomCode = this.clientRoomMap.get(clientId);
    if (currentRoomCode && currentRoomCode !== cleanCode) {
      this.leaveRoom(clientId, true);
    }
    const result = room.addPlayer(clientId, trimmedPlayerName, socket);
    if (!result.success) {
      return { success: false, error: result.error, errorCode: result.errorCode || "JOIN_FAILED" };
    }
    this.clientRoomMap.set(clientId, cleanCode);
    return { success: true, room };
  }
  leaveRoom(clientId, isExplicit = false) {
    const roomCode = this.clientRoomMap.get(clientId);
    if (!roomCode) return;
    const room = this.rooms.get(roomCode);
    if (room) {
      room.removeClient(clientId, isExplicit);
      this.cleanupRoomIfEmpty(roomCode);
    }
    if (isExplicit) {
      this.clientRoomMap.delete(clientId);
    }
  }
  cleanupRoom(roomCode) {
    const cleanCode = normalizeRoomCode(roomCode);
    const room = this.rooms.get(cleanCode);
    if (room) {
      room.destroy();
      this.rooms.delete(cleanCode);
      for (const [clientId, rCode] of Array.from(this.clientRoomMap.entries())) {
        if (rCode === cleanCode) {
          this.clientRoomMap.delete(clientId);
        }
      }
    }
  }
  cleanupRoomIfEmpty(roomCode) {
    const cleanCode = normalizeRoomCode(roomCode);
    const room = this.rooms.get(cleanCode);
    if (!room) return;
    if (room.getStatus() === "FINISHED") {
      if (room.getConnectedClientCount() === 0) {
        this.cleanupRoom(cleanCode);
      }
      return;
    }
    if (room.getStatus() === "LOBBY") {
      if (room.getConnectedClientCount() === 0 && !room.isLobbyGraceActive()) {
        this.cleanupRoom(cleanCode);
      }
      return;
    }
    if (room.getConnectedClientCount() === 0 && !room.hasActiveReservations()) {
      this.cleanupRoom(cleanCode);
    }
  }
  registerClientRoom(clientId, roomCode) {
    this.clientRoomMap.set(clientId, normalizeRoomCode(roomCode));
  }
  getRoomByClientId(clientId) {
    const roomCode = this.clientRoomMap.get(clientId);
    if (!roomCode) return void 0;
    return this.rooms.get(roomCode);
  }
  getRoom(roomCode) {
    return this.rooms.get(normalizeRoomCode(roomCode));
  }
  getActiveRoomsSummary() {
    const summaries = [];
    const deadRoomCodes = [];
    for (const [code, room] of this.rooms.entries()) {
      if (room.getStatus() === "FINISHED" && room.getConnectedClientCount() === 0 || room.getStatus() === "LOBBY" && room.getConnectedClientCount() === 0 && !room.isLobbyGraceActive() || room.getStatus() === "PLAYING" && room.getConnectedClientCount() === 0 && !room.hasActiveReservations()) {
        deadRoomCodes.push(code);
        continue;
      }
      const summary = room.getPublicSummary();
      if (summary) {
        summaries.push(summary);
      }
    }
    for (const deadCode of deadRoomCodes) {
      this.cleanupRoom(deadCode);
    }
    return summaries;
  }
  getAllRooms() {
    return Array.from(this.rooms.values());
  }
};

// server/src/adminRouter.ts
import { Router } from "express";

// server/src/adminAuth.ts
import crypto3 from "crypto";
function timingSafeEqualStr(a, b) {
  if (!a || !b) return false;
  const hashA = crypto3.createHash("sha256").update(a).digest();
  const hashB = crypto3.createHash("sha256").update(b).digest();
  return crypto3.timingSafeEqual(hashA, hashB);
}
function adminAuthGuard(req, res, next) {
  const expectedKey = process.env.ADMIN_API_KEY;
  if (!expectedKey || expectedKey.trim().length === 0) {
    res.status(503).json({
      error: "Admin API is not configured on this server",
      code: "ADMIN_NOT_CONFIGURED"
    });
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({
      error: "Authorization header with Bearer token is required",
      code: "UNAUTHORIZED"
    });
    return;
  }
  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    res.status(401).json({
      error: "Authorization header must follow Bearer <token> format",
      code: "UNAUTHORIZED"
    });
    return;
  }
  const token = parts[1];
  if (!timingSafeEqualStr(token, expectedKey)) {
    res.status(403).json({
      error: "Invalid admin API key",
      code: "FORBIDDEN"
    });
    return;
  }
  next();
}

// server/src/adminSerializers.ts
function serializeAdminStats(roomManager, getActiveConnectionsCount) {
  const rooms = roomManager.getAllRooms();
  let humanPlayerCount = 0;
  let botSeatCount = 0;
  const roomsByStatus = { LOBBY: 0, PLAYING: 0, FINISHED: 0 };
  for (const room of rooms) {
    if (room.status === "LOBBY") roomsByStatus.LOBBY++;
    else if (room.status === "PLAYING") roomsByStatus.PLAYING++;
    else if (room.status === "FINISHED") roomsByStatus.FINISHED++;
    const participants = room.getParticipants();
    for (const p of participants) {
      if (p.isBot) {
        botSeatCount++;
      } else {
        humanPlayerCount++;
      }
    }
  }
  const mem = process.memoryUsage();
  return {
    serverUptimeSeconds: Math.floor(process.uptime()),
    activeWebSocketConnections: getActiveConnectionsCount(),
    activeRoomsCount: rooms.length,
    humanPlayerCount,
    botSeatCount,
    roomsByStatus,
    processMemory: {
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      rssBytes: mem.rss,
      externalBytes: mem.external
    },
    serverVersion: process.env.npm_package_version || "1.0.0",
    persistence: {
      enabled: isDatabaseConfigured(),
      connected: PersistenceService.getInstance().isAvailable(),
      driver: isDatabaseConfigured() ? "postgres" : "none"
    }
  };
}
function serializeAdminRoomSummary(room) {
  const participants = room.getParticipants();
  const hostPart = participants.find((p) => p.isHost && !p.isBot) || participants.find((p) => p.isHost) || room.getParticipant("SOUTH" /* SOUTH */);
  const hostSeat = hostPart ? POSITION_TO_SEAT[hostPart.position] : "P1";
  const hostName = hostPart ? hostPart.name : "Host";
  const controller = room.getController();
  let currentRound = 1;
  let activeTurn = null;
  if (controller && room.status === "PLAYING") {
    const state = controller.getState();
    currentRound = state.currentRound;
    activeTurn = {
      seat: POSITION_TO_SEAT[state.currentPlayer],
      position: state.currentPlayer
    };
  }
  const seats = SEAT_ORDER.map((pos) => {
    const p = room.getParticipant(pos);
    const seatId = POSITION_TO_SEAT[pos];
    if (!p) {
      return {
        seat: seatId,
        position: pos,
        name: `Bot: ${pos}`,
        isBot: true,
        isConnected: true,
        isHost: false
      };
    }
    const isConnected = p.isBot ? true : room.isSocketOpen(p.id);
    return {
      seat: seatId,
      position: pos,
      name: p.name,
      isBot: p.isBot,
      isConnected,
      isHost: p.isHost
    };
  });
  const humanCount = seats.filter((s) => !s.isBot).length;
  const botCount = seats.filter((s) => s.isBot).length;
  const isJoinable = room.status !== "FINISHED" && humanCount < 4;
  return {
    roomCode: room.roomCode,
    status: room.status,
    hostSeat,
    hostName,
    currentRound,
    totalRounds: room.totalRounds || 5,
    activeTurn,
    seats,
    isJoinable,
    connectedClientsCount: room.getConnectedClientCount(),
    humanCount,
    botCount
  };
}
function serializeAdminRoomDebug(room) {
  const participants = room.getParticipants();
  const hostPart = participants.find((p) => p.isHost && !p.isBot) || participants.find((p) => p.isHost) || room.getParticipant("SOUTH" /* SOUTH */);
  const hostSeat = hostPart ? POSITION_TO_SEAT[hostPart.position] : "P1";
  const hostName = hostPart ? hostPart.name : "Host";
  const hostClientId = room.hostClientId;
  const controller = room.getController();
  const controllerState = controller ? controller.getState() : null;
  let currentRound = 1;
  let dealerSeat = null;
  let activeTurnSeat = null;
  let phase = room.status === "LOBBY" ? "LOBBY" : "PLAYING";
  if (controllerState) {
    currentRound = controllerState.currentRound;
    dealerSeat = {
      seat: POSITION_TO_SEAT[controllerState.dealer],
      position: controllerState.dealer
    };
    activeTurnSeat = {
      seat: POSITION_TO_SEAT[controllerState.currentPlayer],
      position: controllerState.currentPlayer
    };
    phase = controllerState.status;
  }
  const seats = SEAT_ORDER.map((pos) => {
    const p = room.getParticipant(pos);
    const seatId = POSITION_TO_SEAT[pos];
    const isBot = p ? p.isBot : true;
    const name = p ? p.name : `Bot: ${pos}`;
    const isConnected = isBot ? true : p ? room.isSocketOpen(p.id) : false;
    const isHost = p ? p.isHost : false;
    const reservationInfo = room.getSeatReservation(pos);
    const clientId = isBot ? null : p ? p.id : null;
    const playerState = controllerState ? controllerState.players[pos] : null;
    const currentBid = playerState ? playerState.currentBid : null;
    const tricksWon = playerState ? playerState.tricksWon : 0;
    const hand = playerState ? playerState.hand.map((c) => ({ suit: c.suit, rank: c.rank, id: c.id })) : [];
    const playedCards = [];
    if (controllerState) {
      for (const trick of controllerState.completedTricks) {
        const pc = trick.cards.find((c) => c.playerPosition === pos);
        if (pc) {
          playedCards.push({ suit: pc.card.suit, rank: pc.card.rank, id: pc.card.id });
        }
      }
      const currentPlay = controllerState.currentTrick.cards.find((c) => c.playerPosition === pos);
      if (currentPlay) {
        playedCards.push({
          suit: currentPlay.card.suit,
          rank: currentPlay.card.rank,
          id: currentPlay.card.id
        });
      }
    }
    return {
      seat: seatId,
      position: pos,
      name,
      isBot,
      isConnected,
      isHost,
      hasReservation: reservationInfo.hasReservation,
      reservationRemainingMs: reservationInfo.remainingMs,
      clientId,
      currentBid,
      tricksWon,
      privateCards: {
        cardsRemaining: hand.length,
        hand,
        playedCards
      }
    };
  });
  let gameState = null;
  if (controllerState) {
    const currentBids = {
      ["SOUTH" /* SOUTH */]: controllerState.players["SOUTH" /* SOUTH */]?.currentBid ?? null,
      ["WEST" /* WEST */]: controllerState.players["WEST" /* WEST */]?.currentBid ?? null,
      ["NORTH" /* NORTH */]: controllerState.players["NORTH" /* NORTH */]?.currentBid ?? null,
      ["EAST" /* EAST */]: controllerState.players["EAST" /* EAST */]?.currentBid ?? null
    };
    const biddingComplete = Object.values(currentBids).every((b) => b !== null);
    const tricksWon = {
      ["SOUTH" /* SOUTH */]: controllerState.players["SOUTH" /* SOUTH */]?.tricksWon ?? 0,
      ["WEST" /* WEST */]: controllerState.players["WEST" /* WEST */]?.tricksWon ?? 0,
      ["NORTH" /* NORTH */]: controllerState.players["NORTH" /* NORTH */]?.tricksWon ?? 0,
      ["EAST" /* EAST */]: controllerState.players["EAST" /* EAST */]?.tricksWon ?? 0
    };
    const completedTricks = controllerState.completedTricks.map((t) => {
      const winningPlayedCard = t.cards.find((c) => c.playerPosition === t.winner);
      return {
        trickNumber: t.trickNumber,
        leader: t.leader,
        leadSuit: t.leadSuit,
        cards: t.cards.map((c) => ({
          position: c.playerPosition,
          card: { suit: c.card.suit, rank: c.card.rank, id: c.card.id }
        })),
        winner: t.winner,
        winningCard: winningPlayedCard ? {
          suit: winningPlayedCard.card.suit,
          rank: winningPlayedCard.card.rank,
          id: winningPlayedCard.card.id
        } : null
      };
    });
    const lastCompleted = completedTricks[completedTricks.length - 1] || null;
    gameState = {
      status: controllerState.status,
      phase: controllerState.status,
      biddingComplete,
      currentBids,
      currentTrick: {
        trickNumber: controllerState.currentTrick.trickNumber,
        leader: controllerState.currentTrick.leader,
        leadSuit: controllerState.currentTrick.leadSuit,
        cards: controllerState.currentTrick.cards.map((c) => ({
          position: c.playerPosition,
          card: { suit: c.card.suit, rank: c.card.rank, id: c.card.id },
          isLeading: c.playerPosition === controllerState.currentTrick.leader
        })),
        winner: controllerState.currentTrick.winner
      },
      completedTricksCount: completedTricks.length,
      completedTricks,
      tricksWon,
      scores: {
        ["SOUTH" /* SOUTH */]: controllerState.cumulativeScores["SOUTH" /* SOUTH */] ?? 0,
        ["WEST" /* WEST */]: controllerState.cumulativeScores["WEST" /* WEST */] ?? 0,
        ["NORTH" /* NORTH */]: controllerState.cumulativeScores["NORTH" /* NORTH */] ?? 0,
        ["EAST" /* EAST */]: controllerState.cumulativeScores["EAST" /* EAST */] ?? 0
      },
      roundScores: controllerState.roundScores,
      lastTrickWinner: lastCompleted ? lastCompleted.winner : null,
      lastWinningCard: lastCompleted ? lastCompleted.winningCard : null
    };
  }
  const rawTimer = controller ? controller.getCurrentTimer() : null;
  const activeTimer = rawTimer ? {
    type: "TURN",
    position: rawTimer.position,
    rawPosition: rawTimer.rawPosition,
    remainingSec: rawTimer.remainingSec,
    totalSec: rawTimer.totalSec,
    isExtraTime: rawTimer.isExtraTime
  } : null;
  return {
    room: {
      roomCode: room.roomCode,
      status: room.status,
      hostSeat,
      hostClientId,
      hostName,
      currentRound,
      totalRounds: room.totalRounds || 5,
      dealerSeat,
      activeTurnSeat,
      phase
    },
    seats,
    gameState,
    timers: {
      activeTimer
    }
  };
}

// server/src/adminRouter.ts
function createAdminRouter(options = {}) {
  const router = Router();
  const roomManager = options.roomManager || RoomManager.getInstance();
  const getActiveConnectionsCount = options.getActiveConnectionsCount || (() => 0);
  router.use(adminAuthGuard);
  router.get("/stats", (_req, res) => {
    try {
      const stats = serializeAdminStats(roomManager, getActiveConnectionsCount);
      res.json(stats);
    } catch (err) {
      res.status(500).json({
        error: "Failed to retrieve server statistics",
        code: "INTERNAL_SERVER_ERROR"
      });
    }
  });
  router.get("/rooms", (_req, res) => {
    try {
      const rooms = roomManager.getAllRooms();
      const summaries = rooms.map((r) => serializeAdminRoomSummary(r));
      res.json(summaries);
    } catch (err) {
      res.status(500).json({
        error: "Failed to retrieve room summaries",
        code: "INTERNAL_SERVER_ERROR"
      });
    }
  });
  router.get("/rooms/:roomCode", (req, res) => {
    try {
      const { roomCode } = req.params;
      const room = roomManager.getRoom(roomCode);
      if (!room) {
        res.status(404).json({
          error: "Room not found",
          code: "ROOM_NOT_FOUND"
        });
        return;
      }
      const debugSnapshot = serializeAdminRoomDebug(room);
      res.json(debugSnapshot);
    } catch (err) {
      res.status(500).json({
        error: "Failed to retrieve room debug snapshot",
        code: "INTERNAL_SERVER_ERROR"
      });
    }
  });
  return router;
}

// server/src/playerRouter.ts
import { Router as Router2 } from "express";

// server/src/identityAuth.ts
import crypto4 from "crypto";
var IDENTITY_SECRET = process.env.IDENTITY_SECRET || crypto4.randomBytes(32).toString("hex");
function signPlayerId(playerId) {
  if (!playerId) return "";
  return crypto4.createHmac("sha256", IDENTITY_SECRET).update(playerId.trim()).digest("hex");
}
function verifyPlayerToken(playerId, token) {
  if (!playerId || !token) return false;
  try {
    const expected = signPlayerId(playerId);
    if (expected.length !== token.length) return false;
    return crypto4.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
  } catch {
    return false;
  }
}

// server/src/playerRouter.ts
function createPlayerRouter() {
  const router = Router2();
  router.use(async (req, res, next) => {
    const playerId = req.headers["x-player-id"] || req.headers["x-client-id"];
    const playerToken = req.headers["x-player-token"];
    if (playerId && typeof playerId === "string" && playerId.trim()) {
      const cleanId = playerId.trim();
      const tokenStr = typeof playerToken === "string" ? playerToken.trim() : "";
      const isValid = verifyPlayerToken(cleanId, tokenStr);
      if (isValid) {
        req.anonymousClientId = cleanId;
      } else {
        const persistence = PersistenceService.getInstance();
        let profileExists = false;
        if (persistence.isAvailable()) {
          try {
            const profile = await persistence.getPlayerProfileDashboard(cleanId, 1, 0);
            if (profile && profile.profile && profile.profile.player_id) {
              profileExists = true;
            }
          } catch {
          }
        }
        if (!profileExists) {
          const newToken = signPlayerId(cleanId);
          res.setHeader("X-Issued-Token", newToken);
          req.anonymousClientId = cleanId;
        }
      }
    }
    next();
  });
  router.get("/leaderboard", async (req, res) => {
    try {
      const category = req.query.category || "overall";
      const timeframe = req.query.timeframe || "all";
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const callerId = req.anonymousClientId || null;
      const data = await PersistenceService.getInstance().getGlobalLeaderboard(
        category,
        timeframe,
        limit,
        offset,
        callerId
      );
      res.json(data);
    } catch (err) {
      console.error("[PlayerAPI] GET /leaderboard error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  router.get("/top-wins", async (req, res) => {
    try {
      const timeframe = req.query.timeframe || "all";
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 50));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const data = await PersistenceService.getInstance().getTopWins(timeframe, limit, offset);
      res.json({ timeframe, topWins: data });
    } catch (err) {
      console.error("[PlayerAPI] GET /top-wins error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  const requireAuth = (req, res, next) => {
    if (!req.anonymousClientId) {
      res.status(401).json({ error: "Unauthorized: Invalid or missing anonymous identity proof token" });
      return;
    }
    next();
  };
  router.get("/profile", requireAuth, async (req, res) => {
    try {
      const anonId = req.anonymousClientId;
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      const data = await PersistenceService.getInstance().getPlayerProfileDashboard(anonId, limit, offset);
      res.json(data);
    } catch (err) {
      console.error("[PlayerAPI] GET /profile error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  router.get("/matches", requireAuth, async (req, res) => {
    try {
      const anonId = req.anonymousClientId;
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      const data = await PersistenceService.getInstance().getPlayerProfileDashboard(anonId, limit, offset);
      res.json({ matches: data?.matches || [], stats: data?.stats || {} });
    } catch (err) {
      console.error("[PlayerAPI] GET /matches error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  router.get("/scorecard/:matchId", requireAuth, async (req, res) => {
    try {
      const anonId = req.anonymousClientId;
      const matchId = req.params.matchId;
      const details = await PersistenceService.getInstance().getMatchScorecardDetails(anonId, matchId);
      if (!details) {
        res.status(404).json({ error: "Match not found or unauthorized" });
        return;
      }
      res.json(details);
    } catch (err) {
      console.error("[PlayerAPI] GET /scorecard error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  router.get("/achievements", requireAuth, async (req, res) => {
    try {
      const anonId = req.anonymousClientId;
      const data = await PersistenceService.getInstance().getPlayerAchievements(anonId);
      res.json({ achievements: data });
    } catch (err) {
      console.error("[PlayerAPI] GET /achievements error:", err.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  return router;
}

// server/src/wsGuard.ts
var MAX_WS_MESSAGE_SIZE_BYTES = 16 * 1024;
var RATE_LIMIT_CONFIG = {
  // Global message limit per connection: 30 messages per 1-second sliding window
  GLOBAL_MAX_PER_WINDOW: 30,
  GLOBAL_WINDOW_MS: 1e3,
  // Setup / heavy room operations limit per connection (CREATE_ROOM, JOIN_ROOM, RESPOND_JOIN_REQUEST):
  // 5 requests per 2-second sliding window
  SETUP_MAX_PER_WINDOW: 5,
  SETUP_WINDOW_MS: 2e3
};
var KNOWN_CLIENT_MESSAGE_TYPES = /* @__PURE__ */ new Set([
  "GET_ACTIVE_ROOMS",
  "CREATE_ROOM",
  "JOIN_ROOM",
  "START_MATCH",
  "START_GAME",
  "CLIENT_READY",
  "RENAME_PLAYER",
  "TRANSFER_HOST",
  "SUBMIT_BID",
  "PLAY_CARD",
  "NEXT_ROUND",
  "RESPOND_JOIN_REQUEST",
  "CONVERT_TO_BOT",
  "KICK_PLAYER",
  "SWAP_SEATS",
  "LEAVE_ROOM",
  "PING"
]);
var SETUP_MESSAGE_TYPES = /* @__PURE__ */ new Set([
  "CREATE_ROOM",
  "JOIN_ROOM",
  "RESPOND_JOIN_REQUEST"
]);
var VALID_POSITIONS2 = /* @__PURE__ */ new Set([
  "SOUTH" /* SOUTH */,
  "WEST" /* WEST */,
  "NORTH" /* NORTH */,
  "EAST" /* EAST */
]);
var VALID_SUITS2 = /* @__PURE__ */ new Set([
  "SPADES" /* SPADES */,
  "HEARTS" /* HEARTS */,
  "DIAMONDS" /* DIAMONDS */,
  "CLUBS" /* CLUBS */
]);
var VALID_RANKS2 = /* @__PURE__ */ new Set([
  "2" /* TWO */,
  "3" /* THREE */,
  "4" /* FOUR */,
  "5" /* FIVE */,
  "6" /* SIX */,
  "7" /* SEVEN */,
  "8" /* EIGHT */,
  "9" /* NINE */,
  "10" /* TEN */,
  "J" /* JACK */,
  "Q" /* QUEEN */,
  "K" /* KING */,
  "A" /* ACE */
]);
var WsRateLimiter = class {
  constructor() {
    this.states = /* @__PURE__ */ new Map();
  }
  checkRateLimit(socket, isSetupAction = false, now = Date.now()) {
    let state = this.states.get(socket);
    if (!state) {
      state = { globalTimestamps: [], setupTimestamps: [] };
      this.states.set(socket, state);
    }
    const globalWindowStart = now - RATE_LIMIT_CONFIG.GLOBAL_WINDOW_MS;
    state.globalTimestamps = state.globalTimestamps.filter((t) => t > globalWindowStart);
    if (state.globalTimestamps.length >= RATE_LIMIT_CONFIG.GLOBAL_MAX_PER_WINDOW) {
      return { allowed: false, reason: "Message rate limit exceeded. Please slow down." };
    }
    if (isSetupAction) {
      const setupWindowStart = now - RATE_LIMIT_CONFIG.SETUP_WINDOW_MS;
      state.setupTimestamps = state.setupTimestamps.filter((t) => t > setupWindowStart);
      if (state.setupTimestamps.length >= RATE_LIMIT_CONFIG.SETUP_MAX_PER_WINDOW) {
        return { allowed: false, reason: "Room operation rate limit exceeded. Please slow down." };
      }
      state.setupTimestamps.push(now);
    }
    state.globalTimestamps.push(now);
    return { allowed: true };
  }
  cleanup(socket) {
    this.states.delete(socket);
  }
  getActiveTrackedCount() {
    return this.states.size;
  }
  reset() {
    this.states.clear();
  }
};
function validateClientPayload(type, payload) {
  switch (type) {
    case "CREATE_ROOM": {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { valid: false, error: "CREATE_ROOM payload must be an object." };
      }
      const { playerName, roomCode, totalRounds, playerId } = payload;
      if (typeof playerName !== "string" || playerName.trim().length === 0) {
        return { valid: false, error: "Player name is required." };
      }
      if (playerName.trim().length > 30) {
        return { valid: false, error: "Player name must not exceed 30 characters." };
      }
      if (roomCode !== void 0 && roomCode !== null && roomCode !== "") {
        if (typeof roomCode !== "string") {
          return { valid: false, error: "Room code must be a string." };
        }
        const trimmedCode = roomCode.trim().replace(/^CB-?/i, "");
        if (trimmedCode.length < 3 || trimmedCode.length > 10 || !/^[A-Za-z0-9]+$/.test(trimmedCode)) {
          return { valid: false, error: "Room code must be 3 to 10 alphanumeric characters." };
        }
      }
      if (totalRounds !== void 0 && totalRounds !== null) {
        if (typeof totalRounds !== "number" || !Number.isInteger(totalRounds) || totalRounds !== 5 && totalRounds !== 10) {
          return { valid: false, error: "Total rounds must be 5 or 10." };
        }
      }
      if (playerId !== void 0 && playerId !== null) {
        if (typeof playerId !== "string" || playerId.trim().length === 0 || playerId.length > 64) {
          return { valid: false, error: "Player ID must be a non-empty string up to 64 characters." };
        }
      }
      return { valid: true };
    }
    case "JOIN_ROOM": {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { valid: false, error: "JOIN_ROOM payload must be an object." };
      }
      const { roomCode, playerName, playerId } = payload;
      if (typeof roomCode !== "string" || roomCode.trim().length === 0) {
        return { valid: false, error: "Room code is required." };
      }
      if (roomCode.trim().length > 20) {
        return { valid: false, error: "Room code must not exceed 20 characters." };
      }
      if (typeof playerName !== "string" || playerName.trim().length === 0) {
        return { valid: false, error: "Player name is required." };
      }
      if (playerName.trim().length > 30) {
        return { valid: false, error: "Player name must not exceed 30 characters." };
      }
      if (playerId !== void 0 && playerId !== null) {
        if (typeof playerId !== "string" || playerId.trim().length === 0 || playerId.length > 64) {
          return { valid: false, error: "Player ID must be a non-empty string up to 64 characters." };
        }
      }
      return { valid: true };
    }
    case "START_MATCH":
    case "START_GAME": {
      if (payload !== void 0 && payload !== null) {
        if (typeof payload !== "object" || Array.isArray(payload)) {
          return { valid: false, error: "START_MATCH payload must be an object if provided." };
        }
        const { autoFillBots, totalRounds } = payload;
        if (autoFillBots !== void 0 && typeof autoFillBots !== "boolean") {
          return { valid: false, error: "autoFillBots must be a boolean." };
        }
        if (totalRounds !== void 0 && totalRounds !== null) {
          if (typeof totalRounds !== "number" || !Number.isInteger(totalRounds) || totalRounds !== 5 && totalRounds !== 10) {
            return { valid: false, error: "Total rounds must be 5 or 10." };
          }
        }
      }
      return { valid: true };
    }
    case "CLIENT_READY": {
      if (payload !== void 0 && payload !== null) {
        if (typeof payload !== "object" || Array.isArray(payload)) {
          return { valid: false, error: "CLIENT_READY payload must be an object if provided." };
        }
        if (payload.roomCode !== void 0 && (typeof payload.roomCode !== "string" || payload.roomCode.length > 32)) {
          return { valid: false, error: "roomCode must be a string up to 32 characters." };
        }
      }
      return { valid: true };
    }
    case "SUBMIT_BID": {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { valid: false, error: "SUBMIT_BID payload must be an object." };
      }
      const { bid } = payload;
      if (typeof bid !== "number" || !Number.isInteger(bid) || bid < 1 || bid > 13) {
        return { valid: false, error: "Bid must be an integer between 1 and 13." };
      }
      return { valid: true };
    }
    case "PLAY_CARD": {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { valid: false, error: "PLAY_CARD payload must be an object." };
      }
      const { card } = payload;
      if (!card || typeof card !== "object" || Array.isArray(card)) {
        return { valid: false, error: "PLAY_CARD requires a card object." };
      }
      if (!VALID_SUITS2.has(card.suit)) {
        return { valid: false, error: `Invalid card suit: ${String(card.suit)}` };
      }
      if (!VALID_RANKS2.has(card.rank)) {
        return { valid: false, error: `Invalid card rank: ${String(card.rank)}` };
      }
      if (typeof card.id !== "string" || card.id.length < 1 || card.id.length > 32) {
        return { valid: false, error: "Card id must be a string between 1 and 32 characters." };
      }
      if (typeof card.value !== "number" || !Number.isFinite(card.value) || card.value < 2 || card.value > 14) {
        return { valid: false, error: "Card value must be a number between 2 and 14." };
      }
      return { valid: true };
    }
    case "RESPOND_JOIN_REQUEST": {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { valid: false, error: "RESPOND_JOIN_REQUEST payload must be an object." };
      }
      const { requestId, accept, targetSeat } = payload;
      if (typeof requestId !== "string" || requestId.trim().length === 0 || requestId.length > 64) {
        return { valid: false, error: "requestId must be a non-empty string up to 64 characters." };
      }
      if (typeof accept !== "boolean") {
        return { valid: false, error: "accept must be a boolean." };
      }
      if (targetSeat !== void 0 && targetSeat !== null && !VALID_POSITIONS2.has(targetSeat)) {
        return { valid: false, error: `Invalid targetSeat: ${String(targetSeat)}` };
      }
      return { valid: true };
    }
    case "CONVERT_TO_BOT":
    case "KICK_PLAYER": {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { valid: false, error: `${type} payload must be an object.` };
      }
      const { seat } = payload;
      if (!seat || !VALID_POSITIONS2.has(seat)) {
        return { valid: false, error: `Invalid seat position: ${String(seat)}` };
      }
      return { valid: true };
    }
    case "SWAP_SEATS": {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { valid: false, error: "SWAP_SEATS payload must be an object." };
      }
      const { seatA, seatB } = payload;
      if (!seatA || !VALID_POSITIONS2.has(seatA)) {
        return { valid: false, error: `Invalid seatA: ${String(seatA)}` };
      }
      if (!seatB || !VALID_POSITIONS2.has(seatB)) {
        return { valid: false, error: `Invalid seatB: ${String(seatB)}` };
      }
      if (seatA === seatB) {
        return { valid: false, error: "seatA and seatB must be different seats." };
      }
      return { valid: true };
    }
    case "RENAME_PLAYER": {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { valid: false, error: "RENAME_PLAYER payload must be an object." };
      }
      const { seat, name } = payload;
      if (!seat || !VALID_POSITIONS2.has(seat)) {
        return { valid: false, error: `Invalid seat: ${String(seat)}` };
      }
      if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 30) {
        return { valid: false, error: "Player name must be 1 to 30 characters." };
      }
      return { valid: true };
    }
    case "TRANSFER_HOST": {
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return { valid: false, error: "TRANSFER_HOST payload must be an object." };
      }
      const { targetSeat, targetClientId } = payload;
      if (!targetSeat && !targetClientId) {
        return { valid: false, error: "targetSeat or targetClientId is required." };
      }
      if (targetSeat && !VALID_POSITIONS2.has(targetSeat)) {
        return { valid: false, error: `Invalid targetSeat: ${String(targetSeat)}` };
      }
      if (targetClientId && (typeof targetClientId !== "string" || targetClientId.trim().length === 0 || targetClientId.length > 64)) {
        return { valid: false, error: "targetClientId must be a non-empty string up to 64 characters." };
      }
      return { valid: true };
    }
    case "GET_ACTIVE_ROOMS":
    case "NEXT_ROUND":
    case "LEAVE_ROOM":
    case "PING": {
      if (payload !== void 0 && payload !== null && typeof payload !== "object") {
        return { valid: false, error: `${type} does not accept primitive payloads.` };
      }
      return { valid: true };
    }
    default:
      return { valid: false, error: `Unknown message type: ${type}` };
  }
}
function parseAndValidateWsMessage(rawData, socket, rateLimiter, now = Date.now()) {
  if (rawData == null) {
    return {
      ok: false,
      errorCode: "INVALID_MESSAGE_SHAPE",
      errorMessage: "Message data cannot be null or undefined."
    };
  }
  const byteLength = Buffer.isBuffer(rawData) ? rawData.byteLength : Buffer.byteLength(rawData, "utf8");
  if (byteLength > MAX_WS_MESSAGE_SIZE_BYTES) {
    return {
      ok: false,
      errorCode: "MESSAGE_TOO_LARGE",
      errorMessage: `Message size (${byteLength} bytes) exceeds maximum allowed limit of ${MAX_WS_MESSAGE_SIZE_BYTES} bytes.`
    };
  }
  let parsed;
  try {
    const text = typeof rawData === "string" ? rawData : rawData.toString("utf8");
    parsed = JSON.parse(text);
  } catch {
    rateLimiter.checkRateLimit(socket, false, now);
    return {
      ok: false,
      errorCode: "INVALID_JSON",
      errorMessage: "Invalid JSON payload."
    };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    rateLimiter.checkRateLimit(socket, false, now);
    return {
      ok: false,
      errorCode: "INVALID_MESSAGE_SHAPE",
      errorMessage: "Message must be a valid JSON object."
    };
  }
  if (typeof parsed.type !== "string" || !parsed.type.trim()) {
    rateLimiter.checkRateLimit(socket, false, now);
    return {
      ok: false,
      errorCode: "MISSING_MESSAGE_TYPE",
      errorMessage: "Message missing required type field."
    };
  }
  if (!KNOWN_CLIENT_MESSAGE_TYPES.has(parsed.type)) {
    rateLimiter.checkRateLimit(socket, false, now);
    return {
      ok: false,
      errorCode: "UNKNOWN_MESSAGE_TYPE",
      errorMessage: `Unknown message type: ${String(parsed.type).slice(0, 32)}`
    };
  }
  const isSetup = SETUP_MESSAGE_TYPES.has(parsed.type);
  const rateCheck = rateLimiter.checkRateLimit(socket, isSetup, now);
  if (!rateCheck.allowed) {
    return {
      ok: false,
      errorCode: "RATE_LIMIT_EXCEEDED",
      errorMessage: rateCheck.reason || "Too many requests. Please slow down."
    };
  }
  const payloadCheck = validateClientPayload(parsed.type, parsed.payload);
  if (!payloadCheck.valid) {
    return {
      ok: false,
      errorCode: "INVALID_PAYLOAD",
      errorMessage: payloadCheck.error || "Invalid payload format."
    };
  }
  return {
    ok: true,
    message: parsed
  };
}

// server/src/index.ts
var PORT = Number(process.env.PORT) || 3001;
function setupWebSocketServer(server, customRateLimiter) {
  const wss = new WebSocketServer({ noServer: true });
  const roomManager = RoomManager.getInstance();
  const rateLimiter = customRateLimiter || new WsRateLimiter();
  console.log("[WebSocket] CallBreak Multiplayer WebSocket server initialized");
  server.on("upgrade", (request, socket, head) => {
    const protocol = request.headers["sec-websocket-protocol"];
    if (protocol && protocol.includes("vite")) {
      return;
    }
    const pathname = request.url ? new URL(request.url, "http://localhost").pathname : "/";
    if (pathname.startsWith("/@vite") || pathname.startsWith("/__vite")) {
      return;
    }
    if (request.url && request.url.includes("token=")) {
      return;
    }
    if (pathname === "/ws" || pathname === "/ws/") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });
  wss.on("connection", (socket, req) => {
    let clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[WebSocket] Client connected: ${clientId} from ${req.socket.remoteAddress}`);
    let isAlive = true;
    socket.on("pong", () => {
      isAlive = true;
    });
    socket.on("message", (rawData) => {
      try {
        const guardResult = parseAndValidateWsMessage(rawData, socket, rateLimiter);
        if (!guardResult.ok) {
          if (socket.readyState === WebSocket2.OPEN) {
            const errMsg = {
              type: "ERROR",
              payload: {
                code: guardResult.errorCode || "INVALID_PAYLOAD",
                message: guardResult.errorMessage || "Invalid message format"
              }
            };
            socket.send(JSON.stringify(errMsg));
          }
          return;
        }
        const msg = guardResult.message;
        switch (msg.type) {
          case "GET_ACTIVE_ROOMS": {
            const summaries = roomManager.getActiveRoomsSummary();
            const activeRoomsMsg = {
              type: "ACTIVE_ROOMS_LIST",
              payload: summaries
            };
            socket.send(JSON.stringify(activeRoomsMsg));
            break;
          }
          case "CREATE_ROOM": {
            const { roomCode, playerName, totalRounds, playerId } = msg.payload || {};
            const trimmedName = typeof playerName === "string" ? playerName.trim() : "";
            if (!trimmedName) {
              const errMsg = {
                type: "ERROR",
                payload: {
                  code: "INVALID_NAME",
                  message: "Please enter your name."
                }
              };
              socket.send(JSON.stringify(errMsg));
              break;
            }
            if (playerId && typeof playerId === "string" && playerId.trim().length > 0) {
              clientId = playerId.trim();
            }
            const result = roomManager.createRoom(
              clientId,
              trimmedName,
              socket,
              roomCode
            );
            if (!result.success || !result.room) {
              const errMsg = {
                type: "ERROR",
                payload: {
                  code: result.errorCode || "CREATE_FAILED",
                  message: result.error || "Room ID already active"
                }
              };
              socket.send(JSON.stringify(errMsg));
              break;
            }
            const room = result.room;
            if (totalRounds && (totalRounds === 5 || totalRounds === 10)) {
              room.totalRounds = totalRounds;
            }
            if (playerId && typeof playerId === "string" && playerId.trim().length > 0) {
              PersistenceService.getInstance().onPlayerJoin(playerId.trim(), trimmedName).catch(() => {
              });
            }
            console.log(`[WebSocket] Room created: ${room.roomCode} by ${clientId}`);
            break;
          }
          case "JOIN_ROOM": {
            const { roomCode, playerName, playerId } = msg.payload || {};
            const trimmedName = typeof playerName === "string" ? playerName.trim() : "";
            if (!trimmedName) {
              const errMsg = {
                type: "ERROR",
                payload: {
                  code: "INVALID_NAME",
                  message: "Please enter your name."
                }
              };
              socket.send(JSON.stringify(errMsg));
              break;
            }
            if (playerId && typeof playerId === "string" && playerId.trim().length > 0) {
              clientId = playerId.trim();
            }
            const result = roomManager.joinRoom(
              roomCode,
              clientId,
              trimmedName,
              socket
            );
            if (!result.success) {
              const errMsg = {
                type: "ERROR",
                payload: {
                  code: result.errorCode || "JOIN_FAILED",
                  message: result.error || "Failed to join room."
                }
              };
              socket.send(JSON.stringify(errMsg));
            } else {
              if (playerId && typeof playerId === "string" && playerId.trim().length > 0) {
                PersistenceService.getInstance().onPlayerJoin(playerId.trim(), trimmedName).catch(() => {
                });
              }
              console.log(`[WebSocket] Client ${clientId} joined room: ${roomCode}`);
            }
            break;
          }
          case "START_MATCH":
          case "START_GAME": {
            const room = roomManager.getRoomByClientId(clientId);
            if (!room) {
              const errMsg = {
                type: "ERROR",
                payload: { message: "You are not in any active room." }
              };
              socket.send(JSON.stringify(errMsg));
              return;
            }
            const autoFill = msg.payload?.autoFillBots ?? true;
            const totalRounds = msg.payload?.totalRounds ?? 5;
            const result = room.startMatch(clientId, autoFill, totalRounds);
            if (!result.success) {
              const errMsg = {
                type: "ERROR",
                payload: { message: result.error || "Cannot start table." }
              };
              socket.send(JSON.stringify(errMsg));
            } else {
              console.log(`[WebSocket] Match started in room ${room.roomCode}`);
            }
            break;
          }
          case "CLIENT_READY": {
            const room = roomManager.getRoomByClientId(clientId) || (msg.payload?.roomCode ? roomManager.getRoom(msg.payload.roomCode) : void 0);
            if (room) {
              room.handleClientReady(clientId);
            }
            break;
          }
          case "RENAME_PLAYER": {
            const room = roomManager.getRoomByClientId(clientId);
            if (room) {
              const { seat, name } = msg.payload || {};
              if (seat && name) {
                room.renameSeat(clientId, seat, name);
              }
            }
            break;
          }
          case "TRANSFER_HOST": {
            const room = roomManager.getRoomByClientId(clientId);
            if (room) {
              const { targetSeat, targetClientId } = msg.payload || {};
              room.transferHost(clientId, targetSeat || targetClientId);
            }
            break;
          }
          case "SUBMIT_BID": {
            const room = roomManager.getRoomByClientId(clientId);
            if (room) {
              const result = room.handleBid(clientId, msg.payload.bid);
              if (!result.success && result.error) {
                socket.send(
                  JSON.stringify({
                    type: "ERROR",
                    payload: { message: result.error }
                  })
                );
              }
            }
            break;
          }
          case "PLAY_CARD": {
            const room = roomManager.getRoomByClientId(clientId);
            if (room) {
              const result = room.handlePlayCard(clientId, msg.payload.card);
              if (!result.success && result.error) {
                socket.send(
                  JSON.stringify({
                    type: "ERROR",
                    payload: { message: result.error }
                  })
                );
              }
            }
            break;
          }
          case "NEXT_ROUND": {
            const room = roomManager.getRoomByClientId(clientId);
            if (room) {
              room.handleNextRound(clientId);
            }
            break;
          }
          case "RESPOND_JOIN_REQUEST": {
            const room = roomManager.getRoomByClientId(clientId);
            if (room) {
              room.handleJoinResponse(clientId, msg.payload.requestId, msg.payload.accept, msg.payload.targetSeat);
            }
            break;
          }
          case "CONVERT_TO_BOT":
          case "KICK_PLAYER": {
            const room = roomManager.getRoomByClientId(clientId);
            if (room && msg.payload?.seat) {
              room.handleConvertToBot(clientId, msg.payload.seat);
            }
            break;
          }
          case "SWAP_SEATS": {
            const room = roomManager.getRoomByClientId(clientId);
            if (room && msg.payload?.seatA && msg.payload?.seatB) {
              room.handleSwapSeats(clientId, msg.payload.seatA, msg.payload.seatB);
            }
            break;
          }
          case "LEAVE_ROOM": {
            roomManager.leaveRoom(clientId, true);
            break;
          }
          case "PING": {
            const pong = { type: "PONG" };
            socket.send(JSON.stringify(pong));
            break;
          }
          default:
            console.warn("[WebSocket] Unknown message type received:", msg?.type);
        }
      } catch (err) {
        console.error("[WebSocket] Failed to handle message:", err?.message);
        const errMsg = {
          type: "ERROR",
          payload: { message: "Invalid payload format" }
        };
        socket.send(JSON.stringify(errMsg));
      }
    });
    socket.on("close", () => {
      rateLimiter.cleanup(socket);
      console.log(`[WebSocket] Client disconnected: ${clientId}`);
      roomManager.leaveRoom(clientId, false);
    });
    socket.on("error", (err) => {
      rateLimiter.cleanup(socket);
      console.error(`[WebSocket] Error for client ${clientId}:`, err.message);
      roomManager.leaveRoom(clientId, false);
    });
  });
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket2.OPEN) {
        ws.ping();
      }
    });
  }, 3e4);
  wss.on("close", () => {
    clearInterval(interval);
    rateLimiter.reset();
  });
  return wss;
}
function createServerApp(getActiveConnectionsCount) {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
  });
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "callbreak-server" });
  });
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "callbreak-server", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/", (_req, res) => {
    res.json({ status: "ok", service: "callbreak-server" });
  });
  app.use("/api/admin", createAdminRouter({ getActiveConnectionsCount }));
  app.use("/api/player", createPlayerRouter());
  return app;
}
function startStandaloneServer(port = PORT) {
  const server = http.createServer();
  const wss = setupWebSocketServer(server);
  const app = createServerApp(() => wss.clients.size);
  server.on("request", app);
  server.listen(port, "0.0.0.0", () => {
    console.log(`[CallBreak Server] Running on http://0.0.0.0:${port}`);
    console.log(`[CallBreak Server] Health check ready at http://0.0.0.0:${port}/health`);
  });
  return { app, server, wss };
}
var isDirectExecution = typeof process !== "undefined" && process.argv[1] && (process.argv[1].endsWith("server/src/index.ts") || process.argv[1].endsWith("server/src/index.js") || process.argv[1].endsWith("dist/index.js") || process.argv[1].endsWith("dist/index.mjs") || Boolean(process.env.STANDALONE_SERVER));
if (isDirectExecution) {
  startStandaloneServer();
}

// server.ts
if (typeof globalThis.__dirname === "string" && globalThis.__dirname === ".") {
  delete globalThis.__dirname;
}
dotenv.config();
async function startServer() {
  const app = express2();
  const server = http2.createServer(app);
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.K_SERVICE);
  const PORT2 = isProduction ? Number(process.env.PORT) || 8080 : 3e3;
  app.use(express2.json());
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "callbreak-server" });
  });
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "callbreak-server", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  const wss = setupWebSocketServer(server);
  app.use("/api/admin", createAdminRouter({ getActiveConnectionsCount: () => wss.clients.size }));
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    let distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(path.join(distPath, "index.html"))) {
      const buildPath = path.join(process.cwd(), "build");
      if (fs.existsSync(path.join(buildPath, "index.html"))) {
        distPath = buildPath;
      } else if (fs.existsSync(path.join(process.cwd(), "index.html"))) {
        distPath = process.cwd();
      }
    }
    app.use(express2.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  server.listen(PORT2, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT2}`);
    console.log(`Server running on port ${PORT2}`);
    console.log(`CallBreak full-stack server running on http://0.0.0.0:${PORT2}`);
  });
}
startServer();
//# sourceMappingURL=server.js.map
