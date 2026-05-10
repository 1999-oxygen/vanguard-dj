/**
 * @fileoverview MasterBus
 * The final stage of the audio graph before reaching the speakers.
 * Combines Deck A and Deck B, applies crossfading, master gain,
 * a brickwall limiter, and provides an AnalyserNode for visualization.
 */

export class MasterBus {
  /**
   * @param {AudioContext} audioContext - The shared AudioContext.
   * @param {Object} [options={}] - Configuration options.
   * @param {number} [options.masterGain=0.85] - Initial master volume.
   * @param {number} [options.analyserFftSize=2048] - FFT size for frequency analysis.
   */
  constructor(audioContext, options = {}) {
    this.audioContext = audioContext;

    // --- Input Stage ---
    // Each deck connects to its own input gain (for crossfader logic)
    this.deckAInput = this.audioContext.createGain();
    this.deckBInput = this.audioContext.createGain();
    this.deckAInput.gain.value = 1.0;
    this.deckBInput.gain.value = 1.0;

    // --- Summing Bus ---
    this.summer = this.audioContext.createGain();
    this.summer.gain.value = 1.0;

    // --- Master Gain ---
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = options.masterGain ?? 0.85;

    // --- Limiter (DynamicsCompressorNode tuned for brickwall) ---
    this.limiter = this.audioContext.createDynamicsCompressor();
    this.limiter.threshold.value = -2.0;   // Catch peaks above -2dB
    this.limiter.knee.value = 0.0;         // Hard knee
    this.limiter.ratio.value = 20.0;       // Aggressive ratio
    this.limiter.attack.value = 0.001;     // 1ms attack
    this.limiter.release.value = 0.1;      // 100ms release

    // --- Analyser (for visualization) ---
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = options.analyserFftSize || 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // --- Wiring ---
    // Deck inputs -> Summer -> Master Gain -> Limiter -> Analyser -> Destination
    this.deckAInput.connect(this.summer);
    this.deckBInput.connect(this.summer);
    this.summer
      .connect(this.masterGain)
      .connect(this.limiter)
      .connect(this.analyser)
      .connect(this.audioContext.destination);

    // Crossfader state: -1 (full A), 0 (center), +1 (full B)
    this.crossfaderPosition = 0;
  }

  /**
   * Get the input node for a specific deck.
   * Decks should connect their output to this node.
   * @param {'A'|'B'} deckId
   * @returns {GainNode}
   */
  getDeckInput(deckId) {
    return deckId === 'B' ? this.deckBInput : this.deckAInput;
  }

  /**
   * Set the master output gain.
   * @param {number} level - 0.0 to 1.0 (will be clamped).
   */
  setMasterGain(level) {
    const normalized = Math.max(0, Math.min(1, level));
    this.masterGain.gain.setTargetAtTime(normalized, this.audioContext.currentTime, 0.05);
  }

  /**
   * Set the crossfader position with a smooth constant-power curve.
   * A constant-power crossfade prevents a volume dip in the center.
   *
   * @param {number} position - -1.0 (Deck A) to +1.0 (Deck B), 0.0 is center.
   * @param {number} [rampTime=0.1] - Transition time in seconds.
   */
  setCrossfader(position, rampTime = 0.1) {
    this.crossfaderPosition = Math.max(-1, Math.min(1, position));
    const now = this.audioContext.currentTime;

    // Constant-power crossfade curve
    // A_gain = cos((position + 1) * PI / 4)
    // B_gain = sin((position + 1) * PI / 4)
    const angle = ((this.crossfaderPosition + 1) / 2) * (Math.PI / 2);
    const gainA = Math.cos(angle);
    const gainB = Math.sin(angle);

    this.deckAInput.gain.setTargetAtTime(gainA, now, rampTime);
    this.deckBInput.gain.setTargetAtTime(gainB, now, rampTime);
  }

  /**
   * Get the current frequency data for visualization.
   * @returns {Uint8Array} Frequency data (0-255).
   */
  getFrequencyData() {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Get the current time-domain waveform data for visualization.
   * @returns {Uint8Array} Time-domain data (0-255, 128 is silence).
   */
  getTimeData() {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  /**
   * Get the average volume level (RMS) across all frequency bins.
   * Useful for driving VU meters.
   * @returns {number} Average level (0.0 - 1.0).
   */
  getAverageLevel() {
    const data = this.getFrequencyData();
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum / data.length / 255;
  }

  /**
   * Clean disconnect all master nodes.
   */
  destroy() {
    [
      this.deckAInput,
      this.deckBInput,
      this.summer,
      this.masterGain,
      this.limiter,
      this.analyser,
    ].forEach((node) => {
      try {
        node.disconnect();
      } catch (e) {}
    });
  }
}

