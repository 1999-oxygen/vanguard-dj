/**
 * @fileoverview Deck
 * A single DJ deck consisting of:
 *   - Transport (play/pause/seek)
 *   - 4 Stem channels (Drums, Bass, Vocals, Melody) each with independent gain
 *   - FX Chain (EQ, Filter, Compressor, Reverb)
 *   - Deck fader (output volume before master bus)
 *
 * Each deck is a self-contained unit that feeds into the MasterBus.
 */

import { Transport } from './Transport.js';
import { FXChain } from './FXChain.js';
import { createMockStems } from '../utils/buffers.js';

export class Deck {
  /**
   * @param {AudioContext} audioContext - Shared AudioContext.
   * @param {string} deckId - Identifier: 'A' or 'B'.
   * @param {Function} [onTrackEnd] - Called when track reaches end.
   */
  constructor(audioContext, deckId, onTrackEnd) {
    this.audioContext = audioContext;
    this.deckId = deckId;
    this.onTrackEnd = onTrackEnd || (() => {});

    // --- Stem Configuration ---
    this.stemKeys = ['D', 'B', 'V', 'M']; // Drums, Bass, Vocals, Melody
    this.stemNames = {
      D: 'Drums',
      B: 'Bass',
      V: 'Vocals',
      M: 'Melody',
    };

    // --- Audio Graph Nodes ---
    this.transport = null;
    this.fxChain = null;
    this.stemGains = {};      // Map<stemKey, GainNode>
    this.stemMutes = {};      // Map<stemKey, boolean>
    this.stemSolo = null;     // Currently soloed stem key or null
    this.masterFader = null;  // Final deck output gain
    this.outputNode = null;   // Connection point to MasterBus

    // --- State ---
    this.buffer = null;       // Full track buffer
    this.stemBuffers = null;  // Map<stemKey, AudioBuffer>
    this.bpm = 124;
    this.originalBPM = 124;
    this.isLoaded = false;
    this.isPlaying = false;

    this._initGraph();
  }

  /**
   * Build the internal audio graph for this deck.
   * @private
   */
  _initGraph() {
    // FX Chain sits between transport and fader
    this.fxChain = new FXChain(this.audioContext);

    // Master fader controls overall deck volume
    this.masterFader = this.audioContext.createGain();
    this.masterFader.gain.value = 1.0;

    // Output node (after fader, before MasterBus)
    this.outputNode = this.audioContext.createGain();
    this.outputNode.gain.value = 1.0;

    // Wire FX -> Fader -> Output
    this.fxChain.outputNode.connect(this.masterFader);
    this.masterFader.connect(this.outputNode);

    // Create stem gain nodes
    // In a real implementation, each stem would be a separate source.
    // Here, we create a single transport that plays the main buffer,
    // and stem gains are logically applied (prepared for future multi-source routing).
    this.stemKeys.forEach((key) => {
      const gain = this.audioContext.createGain();
      gain.gain.value = 0.7; // Default stem level
      this.stemGains[key] = gain;
      this.stemMutes[key] = false;
    });

    // Transport connects to FXChain input
    this.transport = new Transport(this.audioContext, () => {
      this.isPlaying = false;
      this.onTrackEnd(this.deckId);
    });
    this.transport.setDestination(this.fxChain.inputNode);
  }

  /**
   * Load a track buffer into the deck.
   * Optionally generates mock stems for isolation control.
   *
   * @param {AudioBuffer} audioBuffer - The decoded track.
   * @param {Object} [metadata={}] - Track metadata (bpm, key, etc.).
   */
  loadTrack(audioBuffer, metadata = {}) {
    this.stop();
    this.buffer = audioBuffer;
    this.originalBPM = metadata.bpm || 124;
    this.bpm = this.originalBPM;
    this.isLoaded = true;

    // Load into transport
    this.transport.loadBuffer(audioBuffer);

    // Generate mock stems (architecture ready for real separation)
    this.stemBuffers = createMockStems(audioBuffer, this.audioContext);

    // Reset stem controls
    this.stemKeys.forEach((key) => {
      this.stemGains[key].gain.value = 0.7;
      this.stemMutes[key] = false;
    });
    this.stemSolo = null;
  }

  /**
   * Start playback.
   * @param {number} [playbackRate] - Override playback rate.
   */
  play(playbackRate) {
    if (!this.isLoaded) return;
    const rate = playbackRate ?? this.bpm / this.originalBPM;
    this.transport.play(undefined, undefined, rate);
    this.isPlaying = true;
  }

  /**
   * Pause playback.
   */
  pause() {
    this.transport.pause();
    this.isPlaying = false;
  }

  /**
   * Stop playback and reset to start.
   */
  stop() {
    this.transport.stop();
    this.isPlaying = false;
  }

  /**
   * Seek to a time position.
   * @param {number} time - Seconds.
   */
  seek(time) {
    this.transport.seek(time);
  }

  /**
   * Set the BPM for this deck.
   * Adjusts playback rate to match target BPM relative to original.
   * @param {number} targetBPM - Target beats per minute.
   */
  setBPM(targetBPM) {
    if (!this.isLoaded || this.originalBPM <= 0) return;
    this.bpm = targetBPM;
    const rate = targetBPM / this.originalBPM;
    this.transport.setPlaybackRate(rate, 1.5); // Smooth ramp over 1.5s
  }

  /**
   * Set a stem's gain level.
   * Respects mute and solo states.
   * @param {string} stemKey - 'D', 'B', 'V', or 'M'.
   * @param {number} level - 0 to 100.
   */
  setStemLevel(stemKey, level) {
    if (!this.stemGains[stemKey]) return;
    const normalized = Math.max(0, Math.min(100, level)) / 100;
    const now = this.audioContext.currentTime;

    if (this.stemSolo && this.stemSolo !== stemKey) {
      // Another stem is soloed; store value but keep silent
      this.stemGains[stemKey].gain.setTargetAtTime(0, now, 0.02);
    } else if (this.stemMutes[stemKey]) {
      // This stem is muted
      this.stemGains[stemKey].gain.setTargetAtTime(0, now, 0.02);
    } else {
      this.stemGains[stemKey].gain.setTargetAtTime(normalized, now, 0.02);
    }
  }

  /**
   * Toggle mute on a stem.
   * @param {string} stemKey
   */
  toggleStemMute(stemKey) {
    if (!this.stemGains[stemKey]) return;
    this.stemMutes[stemKey] = !this.stemMutes[stemKey];
    // Re-apply current level to enforce mute state
    const currentLevel = this.stemGains[stemKey].gain.value * 100;
    this.setStemLevel(stemKey, currentLevel);
  }

  /**
   * Toggle solo on a stem.
   * Only one stem can be soloed at a time.
   * @param {string} stemKey
   */
  toggleStemSolo(stemKey) {
    if (this.stemSolo === stemKey) {
      this.stemSolo = null; // Unsolo
    } else {
      this.stemSolo = stemKey;
    }

    // Re-apply all levels to update solo state
    this.stemKeys.forEach((key) => {
      const currentLevel = this.stemGains[key].gain.value * 100;
      this.setStemLevel(key, currentLevel);
    });
  }

  /**
   * Set the deck output fader (pre-crossfader).
   * @param {number} level - 0.0 to 1.0.
   */
  setFader(level) {
    const normalized = Math.max(0, Math.min(1, level));
    this.masterFader.gain.setTargetAtTime(normalized, this.audioContext.currentTime, 0.05);
  }

  /**
   * Set the deck trim gain (input gain before FX).
   * @param {number} db - Gain in dB (-12 to +12).
   */
  setTrim(db) {
    const linearGain = Math.pow(10, db / 20);
    this.fxChain.inputNode.gain.setTargetAtTime(linearGain, this.audioContext.currentTime, 0.05);
  }

  /**
   * Set the FX filter cutoff.
   * @param {number} freq - Cutoff frequency in Hz.
   */
  setFilter(freq) {
    this.fxChain.setFilterFrequency(freq);
  }

  /**
   * Set the FX filter type.
   * @param {'lowpass'|'highpass'} type
   */
  setFilterType(type) {
    this.fxChain.setFilterType(type);
  }

  /**
   * Set the reverb wet/dry mix.
   * @param {number} wet - 0.0 to 1.0.
   */
  setReverb(wet) {
    this.fxChain.setReverbWet(wet);
  }

  /**
   * Get current playback time in seconds.
   * @returns {number}
   */
  getCurrentTime() {
    return this.transport.getCurrentTime();
  }

  /**
   * Get total track duration.
   * @returns {number}
   */
  getDuration() {
    return this.transport.duration;
  }

  /**
   * Get playback progress (0.0 - 1.0).
   * @returns {number}
   */
  getProgress() {
    return this.transport.getProgress();
  }

  /**
   * Get deck state snapshot.
   * @returns {Object}
   */
  getState() {
    return {
      deckId: this.deckId,
      isLoaded: this.isLoaded,
      isPlaying: this.isPlaying,
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
      progress: this.getProgress(),
      bpm: this.bpm,
      originalBPM: this.originalBPM,
      stemLevels: Object.fromEntries(
        this.stemKeys.map((k) => [k, this.stemGains[k].gain.value])
      ),
      stemMutes: { ...this.stemMutes },
      stemSolo: this.stemSolo,
    };
  }

  /**
   * Destroy the deck and all its nodes.
   */
  destroy() {
    this.stop();
    this.transport.destroy();
    this.fxChain.destroy();

    Object.values(this.stemGains).forEach((node) => {
      try {
        node.disconnect();
      } catch (e) {}
    });

    try {
      this.masterFader.disconnect();
    } catch (e) {}
    try {
      this.outputNode.disconnect();
    } catch (e) {}

    this.stemGains = {};
    this.stemMutes = {};
    this.stemBuffers = null;
    this.buffer = null;
    this.isLoaded = false;
  }
}

