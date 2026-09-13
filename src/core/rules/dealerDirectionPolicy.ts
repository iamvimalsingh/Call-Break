/**
 * Dealer & Direction Policy for Call Break (Lakdi)
 * Isolates dealer rotation, starting player determination, and turn order progression
 * behind a modular policy abstraction so variants can be configured without modifying game engine core.
 */

import { PlayerPosition, CLOCKWISE_PLAYER_ORDER } from '../../models/player';

export interface IDealerDirectionPolicy {
  /**
   * Returns the next player in turn order.
   */
  getNextPlayer(current: PlayerPosition): PlayerPosition;

  /**
   * Returns the dealer for the given round number (1 to 5).
   */
  getDealerForRound(roundNumber: number, initialDealer?: PlayerPosition): PlayerPosition;

  /**
   * Returns the starting player for a round given the dealer.
   * Standard Call Break: immediately clockwise from the dealer.
   */
  getStartingPlayer(dealer: PlayerPosition): PlayerPosition;

  /**
   * Returns the standard seating / turn sequence array.
   */
  getPlayerOrder(): readonly PlayerPosition[];
}

/**
 * Standard Call Break Clockwise Policy:
 * Turn order: SOUTH -> WEST -> NORTH -> EAST -> SOUTH
 * Dealer rotates clockwise each round (R1: SOUTH, R2: WEST, R3: NORTH, R4: EAST, R5: SOUTH)
 * First bidder / trick leader is the player immediately clockwise from the dealer.
 */
export class StandardClockwisePolicy implements IDealerDirectionPolicy {
  public getNextPlayer(current: PlayerPosition): PlayerPosition {
    const index = CLOCKWISE_PLAYER_ORDER.indexOf(current);
    if (index === -1) {
      return PlayerPosition.SOUTH;
    }
    return CLOCKWISE_PLAYER_ORDER[(index + 1) % CLOCKWISE_PLAYER_ORDER.length];
  }

  public getDealerForRound(
    roundNumber: number,
    initialDealer: PlayerPosition = PlayerPosition.SOUTH
  ): PlayerPosition {
    const initialIndex = CLOCKWISE_PLAYER_ORDER.indexOf(initialDealer);
    const normalizedIndex = (initialIndex + (roundNumber - 1)) % CLOCKWISE_PLAYER_ORDER.length;
    return CLOCKWISE_PLAYER_ORDER[normalizedIndex];
  }

  public getStartingPlayer(dealer: PlayerPosition): PlayerPosition {
    return this.getNextPlayer(dealer);
  }

  public getPlayerOrder(): readonly PlayerPosition[] {
    return CLOCKWISE_PLAYER_ORDER;
  }
}

export const defaultDealerDirectionPolicy: IDealerDirectionPolicy = new StandardClockwisePolicy();
