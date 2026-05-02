/**
 * @fileoverview FXChain
 * Per-deck effects processing chain: 3-Band EQ, Highpass/Lowpass Filter,
 * Compressor, and Reverb Send/Return with dry/wet mix.
 * All nodes are created lazily and connected in series.
 */

import { generateImpulseResponse } from '../utils/buffers.js';

export class FXChain {
  /**
   * @param {AudioContext} audioContext - The shared AudioContext.
   * @param {Object} [options={}] - Configuration.
   * @param {number} [options.reverbDuration=1.5] - Reverb tail length.
   * @param {number} [options.reverbDecay=2.0] - Reverb decay rate.
   */
  constructor(audioContext, options = {}) {
    this.audioContext = audioContext;
    this.inputNode = null;
    this.outputNode = null;
    this.reverbReturn = null;
    this.reverbSendGain = null;
    this.reverbWetGain = null;
    this.reverbDryGain = null;
    this.isInitialized = false;

    this._reverbDuration = options.reverbDuration || 1.5;
    this._reverbDecay = options.reverbDecay || 2.0;

    this._init();
  }

  /**
   * Build the internal node graph:
   * Input -> EQ Low -> EQ Mid -> EQ High -> Filter -> Compressor -> Dry Gain -> Output
   *                                      |-> Reverb Send -> Convolver -> Wet Gain -> Output
   */
  _init() {
    if (this.isInitialized) return;

    // --- Input / Output ---
    this.inputNode = this.audioContext.createGain();
    this.outputNode = this.audioContext.createGain();

    // --- 3-Band EQ (BiquadFilterNode) ---
    // Low: 0 - 250Hz (shelf boost/cut)
    this.eqLow = this.audioContext.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 250;
    this.eqLow.gain.value = 0;

    // Mid: 250Hz - 4kHz (peaking filter)
    this.eqMid = this.audioContext.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 1.0;
    this.eqMid.gain.value = 0;

    // High: 4kHz+ (high shelf)
    this.eqHigh = this.audioContext.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 4000;
    this.eqHigh.gain.value = 0;

    // --- Filter (HPF/LPF sweepable) ---
    this.filterNode = this.audioContext.createBiquadFilter();
    this.filterNode.type = 'lowpass'; // Default to LPF; can be switched
    this.filterNode.frequency.value = 20000; // Fully open
    this.filterNode.Q.value = 0.7;

    // --- Compressor ---
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    // --- Reverb Send/Return ---
    this.reverbSendGain = this.audioContext.createGain();
    this.reverbSendGain.gain.value = 0.0; // Default dry

    this.reverbConvolver = this.audioContext.createConvolver();
    this.reverbConvolver.buffer = generateImpulseResponse(
      this.audioContext,
      this._reverbDuration,
      this._reverbDecay
    );

    this.reverbWetGain = this.audioContext.createGain();
    this.reverbWetGain.gain.value = 0.0;

    this.reverbDryGain = this.audioContext.createGain();
    this.reverbDryGain.gain.value = 1.0;

    // --- Wiring ---
    // Main chain: Input -> EQ -> Filter -> Compressor -> Dry Gain -> Output
    this.inputNode
      .connect(this.eqLow)
      .connect(this.eqMid)
      .connect(this.eqHigh)
      .connect(this.filterNode)
      .connect(this.compressor)
      .connect(this.reverbDryGain)
      .connect(this.outputNode);

    // Reverb side-chain: Compressor -> Send -> Convolver -> Wet -> Output
    this.compressor.connect(this.reverbSendGain);
    this.reverbSendGain.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.outputNode);

    this.isInitialized = true;
  }

  // ============================================================
  // EQ Controls
  // ============================================================

  /**
   * Set the low-shelf EQ gain.
   * @param {number} db - Gain in dB (-40 to +40).
   */
  setEQLow(db) {
    if (this.eqLow) {
      this.eqLow.gain.setTargetAtTime(db, this.audioContext.currentTime, 0.02);
    }
  }

  /**
   * Set the mid peaking EQ gain.
   * @param {number} db - Gain in dB (-40 to +40).
   */
  setEQMid(db) {
    if (this.eqMid) {
      this.eqMid.gain.setTargetAtTime(db, this.audioContext.currentTime, 0.02);
    }
  }

  /**
   * Set the high-shelf EQ gain.
   * @param {number} db - Gain in dB (-40 to +40).
   */
  setEQHigh(db) {
    if (this.eqHigh) {
      this.eqHigh.gain.setTargetAtTime(db, this.audioContext.currentTime, 0.02);
    }
  }

  /**
   * Instantly cut a frequency band (DJ "kill" switch).
   * @param {'low'|'mid'|'high'} band - Which band to kill/restore.
   * @param {boolean} active - True to kill (-60dB), false to restore.
   */
  setKillSwitch(band, active) {
    const target = active ? -60 : 0;
    const time = this.audioContext.currentTime;
    switch (band) {
      case 'low':
        this.eqLow.gain.setTargetAtTime(target, time, 0.01);
        break;
      case 'mid':
        this.eqMid.gain.setTargetAtTime(target, time, 0.01);
        break;
      case 'high':
        this.eqHigh.gain.setTargetAtTime(target, time, 0.01);
        break;
      default:
        break;
    }
  }

  // ============================================================
  // Filter Controls
  // ============================================================

  /**
   * Set the filter cutoff frequency with smooth ramping.
   * @param {number} freq - Cutoff frequency in Hz.
   * @param {number} [rampTime=0.1] - Ramp duration in seconds.
   */
  setFilterFrequency(freq, rampTime = 0.1) {
    if (this.filterNode) {
      const now = this.audioContext.currentTime;
      this.filterNode.frequency.setTargetAtTime(freq, now, rampTime);
    }
  }

  /**
   * Switch filter mode between lowpass and highpass.
   * @param {'lowpass'|'highpass'} type
   */
  setFilterType(type) {
    if (this.filterNode) {
      this.filterNode.type = type;
    }
  }

  // ============================================================
  // Reverb Controls
  // ============================================================

  /**
   * Set the reverb wet/dry mix.
   * @param {number} wet - Wet amount 0.0 (dry) to 1.0 (fully wet).
   */
  setReverbWet(wet) {
    const now = this.audioContext.currentTime;
    const wetGain = Math.max(0, Math.min(1, wet));
    const dryGain = 1 - wetGain;

    if (this.reverbWetGain) {
      this.reverbWetGain.gain.setTargetAtTime(wetGain, now, 0.05);
    }
    if (this.reverbDryGain) {
      this.reverbDryGain.gain.setTargetAtTime(dryGain, now, 0.05);
    }
    if (this.reverbSendGain) {
      // Send amount follows wet level scaled up for effect intensity
      this.reverbSendGain.gain.setTargetAtTime(wetGain * 0.8, now, 0.05);
    }
  }

  /**
   * Regenerate the reverb impulse with new characteristics.
   * @param {number} duration - Impulse length in seconds.
   * @param {number} decay - Decay rate.
   */
  regenerateReverb(duration, decay) {
    if (this.reverbConvolver) {
      this.reverbConvolver.buffer = generateImpulseResponse(
        this.audioContext,
        duration,
        decay
      );
    }
  }

  // ============================================================
  // Compressor Controls
  // ============================================================

  /**
   * Set the compressor threshold.
   * @param {number} db - Threshold in dB (typically -60 to 0).
   */
  setCompressorThreshold(db) {
    if (this.compressor) {
      this.compressor.threshold.setTargetAtTime(db, this.audioContext.currentTime, 0.05);
    }
  }

  /**
   * Set the compressor ratio.
   * @param {number} ratio - Compression ratio (1 to 20).
   */
  setCompressorRatio(ratio) {
    if (this.compressor) {
      this.compressor.ratio.setTargetAtTime(ratio, this.audioContext.currentTime, 0.05);
    }
  }

  // ============================================================
  // Utility
  // ============================================================

  /**
   * Clean disconnect all internal nodes.
   */
  destroy() {
    [
      this.inputNode,
      this.eqLow,
      this.eqMid,
      this.eqHigh,
      this.filterNode,
      this.compressor,
      this.reverbSendGain,
      this.reverbConvolver,
      this.reverbWetGain,
      this.reverbDryGain,
      this.outputNode,
    ].forEach((node) => {
      if (node) {
        try {
          node.disconnect();
        } catch (e) {
          // Ignore disconnect errors on already-disconnected nodes
        }
      }
    });
    this.isInitialized = false;
  }
}

