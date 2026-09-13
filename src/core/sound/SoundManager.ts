/**
 * Centralized Web Audio API Sound Manager
 * Provides procedural, zero-asset, high-fidelity sound synthesis for card games.
 * Autoplay-safe, handles AudioContext suspension gracefully, and supports mute toggle.
 * Phase 8 Animations & Sound
 */

export type SoundEffect =
  | 'deal'
  | 'cardHover'
  | 'cardSelect'
  | 'cardPlay'
  | 'bidSelect'
  | 'bidConfirm'
  | 'trickWon'
  | 'roundEnd'
  | 'matchEnd'
  | 'warning'
  | 'click'
  | 'pop';

export class SoundManager {
  private audioCtx: AudioContext | null = null;
  private muted: boolean = false;
  private volume: number = 0.4;
  private listeners: Set<(muted: boolean) => void> = new Set();
  private isUnlocked: boolean = false;

  constructor() {
    // Check if muted preference was stored
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedMute = window.localStorage.getItem('callbreak_sound_muted');
        if (storedMute !== null) {
          this.muted = storedMute === 'true';
        }
      }
    } catch {
      // Storage unavailable or disabled
    }
  }

  /**
   * Initializes or returns the current AudioContext in an autoplay-safe manner.
   */
  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!this.audioCtx) {
      try {
        this.audioCtx = new AudioContextClass();
      } catch (e) {
        console.warn('AudioContext not supported or blocked:', e);
        return null;
      }
    }

    if (this.audioCtx.state === 'suspended' && this.isUnlocked) {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  /**
   * Unlocks audio on first user gesture.
   */
  public unlockAudio(): void {
    this.isUnlocked = true;
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('callbreak_sound_muted', String(muted));
      }
    } catch {}
    this.notifyListeners();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  public subscribe(callback: (muted: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.muted);
      } catch {}
    });
  }

  /**
   * Plays a synthesized sound effect.
   */
  public play(effect: SoundEffect): void {
    if (this.muted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
      if (ctx.state === 'suspended') return; // Autoplay policy preventing playback
    }

    try {
      switch (effect) {
        case 'deal':
          this.synthDealSound(ctx);
          break;
        case 'cardHover':
          this.synthCardHoverSound(ctx);
          break;
        case 'cardSelect':
          this.synthCardSelectSound(ctx);
          break;
        case 'cardPlay':
          this.synthCardPlaySound(ctx);
          break;
        case 'bidSelect':
          this.synthBidSelectSound(ctx);
          break;
        case 'bidConfirm':
          this.synthBidConfirmSound(ctx);
          break;
        case 'trickWon':
          this.synthTrickWonSound(ctx);
          break;
        case 'roundEnd':
          this.synthRoundEndSound(ctx);
          break;
        case 'matchEnd':
          this.synthMatchEndSound(ctx);
          break;
        case 'warning':
          this.synthWarningSound(ctx);
          break;
        case 'click':
          this.synthBidSelectSound(ctx);
          break;
        case 'pop':
          this.synthCardHoverSound(ctx);
          break;
      }
    } catch (e) {
      console.warn(`Failed to play sound effect: ${effect}`, e);
    }
  }

  // --- Procedural Sound Synthesizers ---

  /** Soft card slide / deal flutter */
  private synthDealSound(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(300, now + 0.08);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(this.volume * 0.35, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /** Subtle tick on hover */
  private synthCardHoverSound(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.02);

    gain.gain.setValueAtTime(this.volume * 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
  }

  /** Tactile click on card selection */
  private synthCardSelectSound(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.04);

    gain.gain.setValueAtTime(this.volume * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /** Crisp card snap / play on felt */
  private synthCardPlaySound(ctx: AudioContext): void {
    const now = ctx.currentTime;
    // Layer 1: Noise-like transient for card snap
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.09);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + 0.09);

    gain.gain.setValueAtTime(this.volume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.11);
  }

  /** Bid button tap chime */
  private synthBidSelectSound(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5

    gain.gain.setValueAtTime(this.volume * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /** Bid confirmed pleasant chord */
  private synthBidConfirmSound(ctx: AudioContext): void {
    const notes = [523.25, 659.25]; // C5, E5
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(this.volume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    });
  }

  /** Trick won celebratory chime */
  private synthTrickWonSound(ctx: AudioContext): void {
    const notes = [587.33, 739.99, 880.0]; // D5, F#5, A5
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(this.volume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.23);
    });
  }

  /** Round finished fanfare */
  private synthRoundEndSound(ctx: AudioContext): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(this.volume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    });
  }

  /** Match completed triumphant celebration */
  private synthMatchEndSound(ctx: AudioContext): void {
    const chords = [
      [523.25, 659.25, 783.99], // C major
      [587.33, 739.99, 880.0],  // D major
      [659.25, 830.61, 987.77], // E major
      [783.99, 987.77, 1174.66], // G major
    ];

    chords.forEach((chord, chordIdx) => {
      const chordTime = ctx.currentTime + chordIdx * 0.16;
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, chordTime);

        gain.gain.setValueAtTime(this.volume * 0.25, chordTime);
        gain.gain.exponentialRampToValueAtTime(0.001, chordTime + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(chordTime);
        osc.stop(chordTime + 0.32);
      });
    });
  }

  /** Illegal play or rule violation buzz */
  private synthWarningSound(ctx: AudioContext): void {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.setValueAtTime(110, now + 0.08);

    gain.gain.setValueAtTime(this.volume * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.17);
  }
}

// Global Singleton Export
export const soundManager = new SoundManager();
