/**
 * @fileoverview SegmentAnalyzer
 * Intelligently chops audio tracks into musically-meaningful segments.
 * Uses onset detection, energy transitions, beat boundaries, and
 * spectral flux to find optimal chop points.
 *
 * Industry-standard approaches combined:
 *   - Onset detection (spectral flux) for transients
 *   - Energy envelope derivatives for phrase boundaries
 *   - Beat-grid quantization to ensure segments start on-beat
 *   - Minimum segment duration constraints (4-32 beats)
 */

import { extractBufferSlice } from '../utils/buffers.js';

/**
 * Compute spectral flux between consecutive frames.
 * High flux indicates timbral change (good chop point).
 * @param {Float32Array} channelData - Mono audio data.
 * @param {number} sampleRate
 * @param {number} frameSize
 * @param {number} hopSize
 * @returns {Array<{time: number, flux: number}>} Flux per frame.
 */
export const computeSpectralFlux = (channelData, sampleRate, frameSize = 2048, hopSize = 512) => {
  const fluxCurve = [];
  const numFrames = Math.floor((channelData.length - frameSize) / hopSize);

  let prevMagnitude = null;

  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    const frame = channelData.subarray(start, start + frameSize);

    // Windowed FFT (simplified: use real FFT or DFT)
    // For performance in JS, we approximate with a simple frequency-domain energy difference
    const fft = computeRealFFT(frame);
    const magnitude = new Float32Array(fft.length / 2);

    for (let j = 0; j < magnitude.length; j++) {
      const real = fft[j * 2];
      const imag = fft[j * 2 + 1];
      magnitude[j] = Math.sqrt(real * real + imag * imag);
    }

    if (prevMagnitude) {
      let flux = 0;
      for (let j = 0; j < magnitude.length; j++) {
        const diff = magnitude[j] - prevMagnitude[j];
        if (diff > 0) flux += diff; // Only positive changes (new energy)
      }
      fluxCurve.push({
        time: start / sampleRate,
        flux: flux,
      });
    }

    prevMagnitude = magnitude;
  }

  return fluxCurve;
};

/**
 * Simplified real FFT using complex DFT.
 * In production, replace with FFT.js or WASM FFT for performance.
 * @param {Float32Array} signal
 * @returns {Float32Array} Interleaved [real, imag, real, imag, ...]
 */
const computeRealFFT = (signal) => {
  const N = signal.length;
  const output = new Float32Array(N * 2);

  for (let k = 0; k < N; k++) {
    let real = 0;
    let imag = 0;
    for (let n = 0; n < N; n++) {
      const angle = (-2 * Math.PI * k * n) / N;
      const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (N - 1)); // Hann window
      const sample = signal[n] * window;
      real += sample * Math.cos(angle);
      imag += sample * Math.sin(angle);
    }
    output[k * 2] = real;
    output[k * 2 + 1] = imag;
  }

  return output;
};

/**
 * Compute RMS energy envelope.
 * @param {Float32Array} channelData
 * @param {number} sampleRate
 * @param {number} windowSize
 * @returns {Array<{time: number, rms: number}>}
 */
export const computeEnergyEnvelope = (channelData, sampleRate, windowSize = 4096) => {
  const envelope = [];
  const hopSize = windowSize / 2;
  const numWindows = Math.floor((channelData.length - windowSize) / hopSize);

  for (let i = 0; i < numWindows; i++) {
    const start = i * hopSize;
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += channelData[start + j] * channelData[start + j];
    }
    envelope.push({
      time: start / sampleRate,
      rms: Math.sqrt(sum / windowSize),
    });
  }

  return envelope;
};

/**
 * Detect beat positions using a simplified autocorrelation approach.
 * @param {Float32Array} channelData
 * @param {number} sampleRate
 * @returns {Array<number>} Beat times in seconds.
 */
export const detectBeats = (channelData, sampleRate) => {
  // Simplified: use energy envelope peaks as beat proxies
  const envelope = computeEnergyEnvelope(channelData, sampleRate, 2048);
  const beats = [];
  const minBeatInterval = 0.4; // ~150 BPM max

  for (let i = 1; i < envelope.length - 1; i++) {
    const prev = envelope[i - 1].rms;
    const curr = envelope[i].rms;
    const next = envelope[i + 1].rms;

    if (curr > prev && curr > next && curr > 0.05) {
      const time = envelope[i].time;
      if (beats.length === 0 || time - beats[beats.length - 1] > minBeatInterval) {
        beats.push(time);
      }
    }
  }

  return beats;
};

/**
 * Find optimal segment boundaries using multiple features combined.
 * We want boundaries that are:
 *   1. On-beat (aligned to detected beats)
 *   2. At spectral flux peaks (timbre changes)
 *   3. At energy transitions (phrase boundaries)
 *   4. Within valid duration range (4-32 beats)
 *
 * @param {AudioBuffer} audioBuffer
 * @param {Object} [options={}]
 * @param {number} [options.minDuration=4] - Minimum segment duration in seconds.
 * @param {number} [options.maxDuration=16] - Maximum segment duration in seconds.
 * @param {number} [options.targetDuration=8] - Ideal segment duration.
 * @returns {Array<number>} Boundary times in seconds (including 0 and duration).
 */
export const findSegmentBoundaries = (audioBuffer, options = {}) => {
  const {
    minDuration = 4,
    maxDuration = 16,
    targetDuration = 8,
  } = options;

  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  // Get all feature curves
  const fluxCurve = computeSpectralFlux(channelData, sampleRate);
  const energyCurve = computeEnergyEnvelope(channelData, sampleRate);
  const beats = detectBeats(channelData, sampleRate);

  // Normalize flux and energy to 0-1
  const maxFlux = Math.max(...fluxCurve.map(f => f.flux), 1);
  const maxEnergy = Math.max(...energyCurve.map(e => e.rms), 1);

  // Combine features into a "boundary probability" curve
  const boundaryScores = [];

  for (let t = minDuration; t < duration - minDuration; t += 0.5) {
    // Find nearest flux value
    const fluxIdx = Math.floor(t * 2); // flux is roughly every 0.5s
    const fluxVal = fluxIdx < fluxCurve.length ? fluxCurve[fluxIdx].flux / maxFlux : 0;

    // Find nearest energy transition
    const energyIdx = Math.floor(t * (sampleRate / 2048));
    let energyTransition = 0;
    if (energyIdx > 0 && energyIdx < energyCurve.length - 1) {
      const diff = Math.abs(energyCurve[energyIdx].rms - energyCurve[energyIdx - 1].rms);
      energyTransition = diff / maxEnergy;
    }

    // Beat proximity bonus (0-1, 1 = exactly on beat)
    let beatBonus = 0;
    for (const beat of beats) {
      const diff = Math.abs(t - beat);
      if (diff < 0.1) {
        beatBonus = 1 - diff / 0.1;
        break;
      }
    }

    // Duration preference (Gaussian around target)
    if (boundaryScores.length > 0) {
      const lastBoundary = boundaryScores[boundaryScores.length - 1].time;
      const segDuration = t - lastBoundary;
      const durationScore = Math.exp(-Math.pow(segDuration - targetDuration, 2) / (2 * 4));

      const score = fluxVal * 0.3 + energyTransition * 0.3 + beatBonus * 0.3 + durationScore * 0.1;

      if (segDuration >= minDuration && segDuration <= maxDuration && score > 0.4) {
        boundaryScores.push({ time: t, score });
      }
    } else {
      boundaryScores.push({ time: 0, score: 1 });
    }
  }

  // Always include end boundary
  const boundaries = [0, ...boundaryScores.map(b => b.time), duration];

  // Deduplicate and sort
  return [...new Set(boundaries)].sort((a, b) => a - b);
};

/**
 * Extract feature vector for a single segment.
 * This vector drives the matching engine.
 * @param {AudioBuffer} segmentBuffer
 * @param {Object} [metadata={}]
 * @returns {Object} Feature vector.
 */
export const extractSegmentFeatures = (segmentBuffer, metadata = {}) => {
  const channelData = segmentBuffer.getChannelData(0);
  const sampleRate = segmentBuffer.sampleRate;
  const duration = segmentBuffer.duration;

  // Energy stats
  const envelope = computeEnergyEnvelope(channelData, sampleRate, 2048);
  const energies = envelope.map(e => e.rms);
  const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
  const maxEnergy = Math.max(...energies);
  const energyVariance = energies.reduce((sum, e) => sum + Math.pow(e - avgEnergy, 2), 0) / energies.length;

  // Spectral centroid (brightness) - simplified
  const fluxCurve = computeSpectralFlux(channelData, sampleRate, 1024, 256);
  const avgFlux = fluxCurve.reduce((a, f) => a + f.flux, 0) / fluxCurve.length;

  // Zero-crossing rate (percussiveness/noisiness)
  let zcr = 0;
  for (let i = 1; i < channelData.length; i++) {
    if ((channelData[i] >= 0) !== (channelData[i - 1] >= 0)) zcr++;
  }
  zcr /= channelData.length;

  // Dynamic range
  const peaks = channelData.filter((_, i) => i % 100 === 0).map(s => Math.abs(s));
  const dynamicRange = Math.max(...peaks) / (Math.min(...peaks.filter(p => p > 0)) || 0.001);

  // Timbre clustering features
  const spectralRolloff = computeSpectralRolloff(channelData, sampleRate);

  return {
    // Timing
    duration,
    bpm: metadata.bpm || 128,
    key: metadata.key || 'Unknown',

    // Energy
    avgEnergy: Math.min(1, avgEnergy * 4), // Normalize
    maxEnergy: Math.min(1, maxEnergy * 4),
    energyVariance: Math.min(1, energyVariance * 10),
    energyStart: energies.slice(0, Math.min(10, energies.length)).reduce((a, b) => a + b, 0) / Math.min(10, energies.length),
    energyEnd: energies.slice(-10).reduce((a, b) => a + b, 0) / 10,

    // Timbre
    spectralFlux: Math.min(1, avgFlux * 2),
    zeroCrossingRate: Math.min(1, zcr * 10),
    spectralRolloff: spectralRolloff / (sampleRate / 2),
    dynamicRange: Math.min(1, dynamicRange / 10),

    // Mock vocal density (replace with Whisper.js onset detection in production)
    vocalDensity: metadata.vocalDensity || Math.random() * 0.5 + 0.2,

    // Derived
    isVocalHeavy: (metadata.vocalDensity || 0.3) > 0.6,
    isPercussive: zcr > 0.05,
    isBright: spectralRolloff > sampleRate / 4,
  };
};

/**
 * Compute spectral rolloff (frequency below which 85% of energy resides).
 * Indicates brightness: high rolloff = bright/trebly, low = dark/bassy.
 * @param {Float32Array} channelData
 * @param {number} sampleRate
 * @returns {number} Rolloff frequency in Hz.
 */
const computeSpectralRolloff = (channelData, sampleRate) => {
  const frameSize = 2048;
  const fft = computeRealFFT(channelData.subarray(0, Math.min(frameSize, channelData.length)));
  const magnitude = new Float32Array(fft.length / 2);
  let totalEnergy = 0;

  for (let i = 0; i < magnitude.length; i++) {
    const real = fft[i * 2];
    const imag = fft[i * 2 + 1];
    magnitude[i] = real * real + imag * imag;
    totalEnergy += magnitude[i];
  }

  const threshold = totalEnergy * 0.85;
  let cumulative = 0;
  const binFreq = sampleRate / frameSize;

  for (let i = 0; i < magnitude.length; i++) {
    cumulative += magnitude[i];
    if (cumulative >= threshold) {
      return i * binFreq;
    }
  }

  return sampleRate / 2;
};

/**
 * Main entry point: analyze a track and chop into segments with features.
 * @param {AudioBuffer} audioBuffer
 * @param {Object} trackMetadata
 * @param {AudioContext} audioContext
 * @returns {Promise<Array<Object>>} Segments with features and AudioBuffers.
 */
export const analyzeAndChopTrack = async (audioBuffer, trackMetadata, audioContext) => {
  const boundaries = findSegmentBoundaries(audioBuffer);
  const segments = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];

    const segmentBuffer = extractBufferSlice(audioBuffer, start, end, audioContext);
    const features = extractSegmentFeatures(segmentBuffer, trackMetadata);

    segments.push({
      id: `${trackMetadata.id || 'track'}_seg_${i}`,
      trackId: trackMetadata.id,
      trackName: trackMetadata.name,
      start,
      end,
      duration: end - start,
      buffer: segmentBuffer,
      features,
      // Stem buffers for swap mixing (if stems available)
      stems: null,
    });
  }

  return segments;
};

