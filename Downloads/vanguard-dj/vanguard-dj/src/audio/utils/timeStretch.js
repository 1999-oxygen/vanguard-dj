/**
 * @fileoverview Time-Stretching Utilities
 * Provides algorithms for tempo matching without pitch shifting.
 * Includes a playback-rate shim (simple but pitch-shifts) and a
 * granular synthesis stub ready for AudioWorklet migration.
 */

/**
 * Calculate the playback rate needed to match a target BPM.
 *
 * @param {number} originalBPM - The track's native BPM.
 * @param {number} targetBPM - The desired playback BPM.
 * @returns {number} The playback rate multiplier.
 */
export const calculatePlaybackRate = (originalBPM, targetBPM) => {
  if (!originalBPM || originalBPM <= 0) return 1.0;
  return targetBPM / originalBPM;
};

/**
 * Pitch-compensated playback rate using the Detune parameter.
 * AudioBufferSourceNode.playbackRate changes both pitch and speed.
 * We can use detune (cents) to approximately compensate for pitch shift.
 * Note: This is a coarse approximation; true time-stretch requires granular synthesis.
 *
 * @param {AudioBufferSourceNode} sourceNode - The source to configure.
 * @param {number} originalBPM - Native track BPM.
 * @param {number} targetBPM - Target BPM.
 * @returns {{rate: number, detune: number}} The applied values.
 */
export const applyTimeStretch = (sourceNode, originalBPM, targetBPM) => {
  const rate = calculatePlaybackRate(originalBPM, targetBPM);

  // Each octave is 1200 cents. Rate change of 2x = 1 octave up = +1200 cents.
  // To compensate: detune = -1200 * log2(rate)
  const detune = -1200 * Math.log2(rate);

  if (sourceNode) {
    sourceNode.playbackRate.value = rate;
    // detune is not directly on AudioBufferSourceNode in all browsers,
    // but it's a standard property. Fallback if unsupported.
    if (typeof sourceNode.detune !== 'undefined') {
      sourceNode.detune.value = detune;
    }
  }

  return { rate, detune };
};

/**
 * Granular time-stretching configuration stub.
 * This architecture is ready to be moved to an AudioWorkletProcessor
 * for zero-UI-jank performance. In the main thread, we return a config
 * object that a future worklet can consume.
 *
 * @param {AudioBuffer} audioBuffer - Source buffer.
 * @param {number} targetBPM - Target BPM.
 * @param {number} originalBPM - Original BPM.
 * @returns {Object} Configuration for granular engine.
 */
export const createGranularConfig = (audioBuffer, targetBPM, originalBPM) => {
  const rateRatio = targetBPM / originalBPM;
  const grainSize = 0.05; // 50ms grains
  const overlap = 0.5; // 50% overlap

  return {
    grainSize,
    overlap,
    rateRatio,
    sampleRate: audioBuffer.sampleRate,
    channelData: Array.from({ length: audioBuffer.numberOfChannels }, (_, i) =>
      audioBuffer.getChannelData(i)
    ),
    // Future: pass this config to an AudioWorkletNode
    workletName: 'granular-stretch-processor',
  };
};

/**
 * Smoothly ramp playback rate to a new value over time.
 * Uses exponentialRampToValueAtTime for natural-sounding tempo shifts.
 *
 * @param {AudioParam} playbackRateParam - The source's playbackRate AudioParam.
 * @param {number} targetRate - The desired final rate.
 * @param {number} [rampDuration=2.0] - How long to ramp (seconds).
 * @param {AudioContext} audioContext - For currentTime reference.
 */
export const rampPlaybackRate = (
  playbackRateParam,
  targetRate,
  rampDuration = 2.0,
  audioContext
) => {
  if (!playbackRateParam || !audioContext) return;
  const now = audioContext.currentTime;
  playbackRateParam.setValueAtTime(playbackRateParam.value, now);
  playbackRateParam.exponentialRampToValueAtTime(
    Math.max(0.01, targetRate), // Prevent zero or negative values
    now + rampDuration
  );
};

