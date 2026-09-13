/**
 * Random Number Generation Abstraction for Card Engine
 * Supports Cryptographically Secure and Deterministic (seeded) sources.
 * Zero external dependencies. Fully offline.
 * Phase 2 Card & Deck Engine
 */

export interface IRandomSource {
  /**
   * Returns a pseudo-random floating-point number in the range [0, 1).
   */
  next(): number;

  /**
   * Returns a pseudo-random integer in the range [min, max] inclusive.
   */
  nextInt(min: number, max: number): number;
}

/**
 * Production Random Source:
 * Uses the environment's cryptographically secure random values (Web Crypto API).
 * Supported in both modern browsers (window.crypto) and Node.js 19+ (globalThis.crypto).
 */
export class CryptoRandomSource implements IRandomSource {
  private readonly uint32Buffer = new Uint32Array(1);

  public next(): number {
    const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      cryptoObj.getRandomValues(this.uint32Buffer);
      // Convert 32-bit unsigned integer to floating point in [0, 1)
      return this.uint32Buffer[0] / (0xffffffff + 1);
    }

    // Secure fallback if web crypto is somehow not accessible
    return Math.random();
  }

  public nextInt(min: number, max: number): number {
    if (min > max) {
      throw new Error(`Invalid range: min (${min}) cannot be greater than max (${max})`);
    }
    if (min === max) {
      return min;
    }
    const range = max - min + 1;
    return min + Math.floor(this.next() * range);
  }
}

/**
 * Deterministic (Seeded) Random Source:
 * Uses the Mulberry32 algorithm to generate high-quality, reproducible pseudo-random numbers.
 * Essential for reproducible unit tests, bot simulation, and game replay.
 */
export class DeterministicRandomSource implements IRandomSource {
  private state: number;
  private readonly initialSeed: number;

  constructor(seed: number = 123456789) {
    this.initialSeed = Math.floor(seed);
    // Initialize state with non-zero 32-bit integer
    this.state = this.initialSeed >>> 0;
    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  public getSeed(): number {
    return this.initialSeed;
  }

  public reset(seed?: number): void {
    const s = seed !== undefined ? Math.floor(seed) : this.initialSeed;
    this.state = s >>> 0;
    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  public next(): number {
    // Mulberry32 algorithm
    let z = (this.state += 0x6d2b79f5);
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    this.state = z >>> 0;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  public nextInt(min: number, max: number): number {
    if (min > max) {
      throw new Error(`Invalid range: min (${min}) cannot be greater than max (${max})`);
    }
    if (min === max) {
      return min;
    }
    const range = max - min + 1;
    return min + Math.floor(this.next() * range);
  }
}
