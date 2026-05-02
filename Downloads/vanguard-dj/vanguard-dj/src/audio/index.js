/**
 * @fileoverview Audio Engine Public API
 * Central export point for the Vanguard DJ audio architecture.
 *
 * Usage:
 *   import { AudioEngine } from './audio';
 *   const engine = new AudioEngine(addLog);
 *   engine.init();
 *   engine.loadTrackToDeck('A', audioBuffer, metadata);
 *   engine.playDeck('A');
 */

export { AudioContextManager, getAudioContext } from './core/AudioContextManager.js';
export { Transport } from './core/Transport.js';
export { FXChain } from './core/FXChain.js';
export { Deck } from './core/Deck.js';
export { MasterBus } from './core/MasterBus.js';
export { Scheduler } from './utils/scheduler.js';
export {
  decodeAudioBuffer,
  extractBufferSlice,
  computeWaveformPeaks,
  generateImpulseResponse,
  createMockStems,
} from './utils/buffers.js';
export {
  calculatePlaybackRate,
  applyTimeStretch,
  createGranularConfig,
  rampPlaybackRate,
} from './utils/timeStretch.js';

import { AudioContextManager } from './core/AudioContextManager.js';
import { Deck } from './core/Deck.js';
import { MasterBus } from './core/MasterBus.js';
import { Scheduler } from './utils/scheduler.js';
import { decodeAudioBuffer } from './utils/buffers.js';

/**
 * AudioEngine
 * High-level facade that orchestrates the entire audio system.
 * Manages the singleton AudioContext, dual decks, master bus,
 * scheduler, and provides a clean API for React hooks.
 */
export class AudioEngine {
  /**
   * @param {Function} [logCallback] - Optional logging function (text, type).
   */
  constructor(logCallback) {
    this.log = logCallback || (() => {});
    this.contextManager = AudioContextManager.getInstance();
    this.audioContext = null;

    this.deckA = null;
    this.deckB = null;
    this.masterBus = null;
    this.scheduler = null;

    this.isInitialized = false;
    this._activeDeck = 'A'; // Which deck is currently "live" for single-deck UI
  }

  /**
   * Initialize the audio engine. Must be called inside a user gesture.
   */
  init() {
    if (this.isInitialized) return;

    this.audioContext = this.contextManager.init();
    this.contextManager.onStateChange((state) => {
      this.log(`AudioContext state: ${state}`, 'system');
    });

    // Create Master Bus (limiter, analyser, crossfader)
    this.masterBus = new MasterBus(this.audioContext, {
      masterGain: 0.85,
      analyserFftSize: 2048,
    });

    // Create Dual Decks
    this.deckA = new Deck(this.audioContext, 'A', (deckId) => {
      this.log(`Deck ${deckId} track ended`, 'system');
    });
    this.deckB = new Deck(this.audioContext, 'B', (deckId) => {
      this.log(`Deck ${deckId} track ended`, 'system');
    });

    // Connect decks to master bus inputs
    this.deckA.outputNode.connect(this.masterBus.getDeckInput('A'));
    this.deckB.outputNode.connect(this.masterBus.getDeckInput('B'));

    // Create beat scheduler
    this.scheduler = new Scheduler(this.audioContext);

    this.isInitialized = true;
    this.log('Audio Engine initialized. Dual decks online.', 'system');
  }

  /**
   * Resume the AudioContext (required after browser suspension).
   */
  async resume() {
    await this.contextManager.resume();
  }

  /**
   * Load a decoded AudioBuffer into a specific deck.
   * @param {'A'|'B'} deckId
   * @param {AudioBuffer} audioBuffer
   * @param {Object} metadata
   */
  loadTrackToDeck(deckId, audioBuffer, metadata = {}) {
    const deck = deckId === 'B' ? this.deckB : this.deckA;
    deck.loadTrack(audioBuffer, metadata);
    this.log(`Loaded track into Deck ${deckId}: ${metadata.name || 'Untitled'}`, 'system');
  }

  /**
   * Decode a file and load it into a deck.
   * @param {'A'|'B'} deckId
   * @param {File|Blob} file
   * @param {Object} metadata
   */
  async loadFileToDeck(deckId, file, metadata = {}) {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await decodeAudioBuffer(this.audioContext, arrayBuffer);
    const mergedMeta = { ...metadata, name: metadata.name || file.name };
    this.loadTrackToDeck(deckId, audioBuffer, mergedMeta);
    return audioBuffer;
  }

  /**
   * Play a deck.
   * @param {'A'|'B'} deckId
   */
  playDeck(deckId) {
    const deck = deckId === 'B' ? this.deckB : this.deckA;
    deck.play();
    this._activeDeck = deckId;
    this.log(`Deck ${deckId} playing`, 'system');
  }

  /**
   * Pause a deck.
   * @param {'A'|'B'} deckId
   */
  pauseDeck(deckId) {
    const deck = deckId === 'B' ? this.deckB : this.deckA;
    deck.pause();
    this.log(`Deck ${deckId} paused`, 'system');
  }

  /**
   * Stop a deck.
   * @param {'A'|'B'} deckId
   */
  stopDeck(deckId) {
    const deck = deckId === 'B' ? this.deckB : this.deckA;
    deck.stop();
    this.log(`Deck ${deckId} stopped`, 'system');
  }

  /**
   * Seek within a deck.
   * @param {'A'|'B'} deckId
   * @param {number} time - Seconds.
   */
  seekDeck(deckId, time) {
    const deck = deckId === 'B' ? this.deckB : this.deckA;
    deck.seek(time);
  }

  /**
   * Set the BPM for a deck (time-stretch).
   * @param {'A'|'B'} deckId
   * @param {number} bpm
   */
  setDeckBPM(deckId, bpm) {
    const deck = deckId === 'B' ? this.deckB : this.deckA;
    deck.setBPM(bpm);
  }

  /**
   * Set a stem level on a deck.
   * @param {'A'|'B'} deckId
   * @param {string} stemKey - 'D', 'B', 'V', 'M'
   * @param {number} level - 0-100
   */
  setDeckStemLevel(deckId, stemKey, level) {
    const deck = deckId === 'B' ? this.deckB : this.deckA;
    deck.setStemLevel(stemKey, level);
  }

  /**
   * Set the crossfader position.
   * @param {number} position - -1.0 (A) to +1.0 (B).
   */
  setCrossfader(position) {
    if (this.masterBus) {
      this.masterBus.setCrossfader(position);
    }
  }

  /**
   * Set master output gain.
   * @param {number} level - 0.0 to 1.0.
   */
  setMasterGain(level) {
    if (this.masterBus) {
      this.masterBus.setMasterGain(level);
    }
  }

  /**
   * Get real-time frequency data for visualization.
   * @returns {Uint8Array|null}
   */
  getFrequencyData() {
    return this.masterBus ? this.masterBus.getFrequencyData() : null;
  }

  /**
   * Get real-time waveform data for visualization.
   * @returns {Uint8Array|null}
   */
  getTimeData() {
    return this.masterBus ? this.masterBus.getTimeData() : null;
  }

  /**
   * Get the average master level (0.0 - 1.0).
   * @returns {number}
   */
  getAverageLevel() {
    return this.masterBus ? this.masterBus.getAverageLevel() : 0;
  }

  /**
   * Get the state of a specific deck.
   * @param {'A'|'B'} deckId
   * @returns {Object}
   */
  getDeckState(deckId) {
    const deck = deckId === 'B' ? this.deckB : this.deckA;
    return deck ? deck.getState() : {};
  }

  /**
   * Set the scheduler BPM.
   * @param {number} bpm
   */
  setSchedulerBPM(bpm) {
    if (this.scheduler) {
      this.scheduler.setBPM(bpm);
    }
  }

  /**
   * Schedule a transition event.
   * @param {number} beatOffset
   * @param {Object} transitionData
   */
  scheduleTransition(beatOffset, transitionData) {
    if (this.scheduler) {
      this.scheduler.scheduleTransition(beatOffset, transitionData);
    }
  }

  /**
   * Get the active deck ID (for single-deck UI mode).
   * @returns {'A'|'B'}
   */
  getActiveDeck() {
    return this._activeDeck;
  }

  /**
   * Clean up the entire engine.
   */
  destroy() {
    if (this.scheduler) this.scheduler.destroy();
    if (this.deckA) this.deckA.destroy();
    if (this.deckB) this.deckB.destroy();
    if (this.masterBus) this.masterBus.destroy();
    this.contextManager.close();
    this.isInitialized = false;
    this.log('Audio Engine destroyed', 'system');
  }
}

