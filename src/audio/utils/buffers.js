/**
 * @fileoverview Audio Buffer Utilities
 * Provides helpers for decoding audio files, extracting sub-buffers,
 * generating waveform peak data, and creating synthetic impulse responses.
 * All operations are designed to work with a shared AudioContext.
 */

/**
 * Fetch an audio file from a URL and decode it into an AudioBuffer.
 * Handles CORS, network errors, and decode failures.
 *
 * @param {string} url - The audio file URL.
 * @param {AudioContext} audioContext - The shared AudioContext instance.
 * @returns {Promise<AudioBuffer>} The decoded audio buffer.
 */
export const fetchAudioBufferFromUrl = async (url, audioContext) => {
  if (!url) {
    throw new Error('[AudioUtils] URL is required for fetching.');
  }
  if (!audioContext) {
    throw new Error('[AudioUtils] AudioContext is required for decoding.');
  }

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error('[AudioUtils] Failed to fetch/decode audio from URL:', error);
    throw error;
  }
};

/**
 * Decode an ArrayBuffer into an AudioBuffer using the provided context.
 * Wraps the native decodeAudioData in a Promise with error handling.
 *
 * @param {AudioContext} audioContext - The shared AudioContext instance.
 * @param {ArrayBuffer} arrayBuffer - Raw file data.
 * @returns {Promise<AudioBuffer>} The decoded audio buffer.
 */
export const decodeAudioBuffer = async (audioContext, arrayBuffer) => {
  if (!audioContext) {
    throw new Error('[AudioUtils] AudioContext is required for decoding.');
  }
  try {
    // Modern browsers support the Promise-based signature directly.
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error('[AudioUtils] decodeAudioData failed:', error);
    throw error;
  }
};

/**
 * Extract a slice of an AudioBuffer into a new AudioBuffer.
 * Useful for chopping phrases, loops, or cue regions.
 *
 * @param {AudioBuffer} sourceBuffer - The original buffer.
 * @param {number} startTime - Start time in seconds.
 * @param {number} endTime - End time in seconds.
 * @param {AudioContext} audioContext - Context to create the new buffer in.
 * @returns {AudioBuffer} The extracted slice.
 */
export const extractBufferSlice = (sourceBuffer, startTime, endTime, audioContext) => {
  const sampleRate = sourceBuffer.sampleRate;
  const channels = sourceBuffer.numberOfChannels;
  const startSample = Math.max(0, Math.floor(startTime * sampleRate));
  const endSample = Math.min(
    sourceBuffer.length,
    Math.floor(endTime * sampleRate)
  );
  const frameCount = endSample - startSample;

  if (frameCount <= 0) {
    throw new Error('[AudioUtils] Invalid slice range: frameCount <= 0');
  }

  const newBuffer = audioContext.createBuffer(channels, frameCount, sampleRate);

  for (let ch = 0; ch < channels; ch++) {
    const sourceData = sourceBuffer.getChannelData(ch);
    const targetData = newBuffer.getChannelData(ch);
    targetData.set(sourceData.subarray(startSample, endSample));
  }

  return newBuffer;
};

/**
 * Compute peak and RMS data for waveform visualization.
 * Returns an array of { peak, rms } objects per slice.
 *
 * @param {AudioBuffer} audioBuffer - The buffer to analyze.
 * @param {number} [sliceCount=200] - How many horizontal slices to generate.
 * @returns {Array<{peak: number, rms: number}>} Visualization data.
 */
export const computeWaveformPeaks = (audioBuffer, sliceCount = 200) => {
  const channelData = audioBuffer.getChannelData(0); // Use left channel for mono analysis
  const samplesPerSlice = Math.floor(channelData.length / sliceCount);
  const peaks = [];

  for (let i = 0; i < sliceCount; i++) {
    const start = i * samplesPerSlice;
    const end = start + samplesPerSlice;
    let maxPeak = 0;
    let sumSquares = 0;

    for (let s = start; s < end; s++) {
      const abs = Math.abs(channelData[s]);
      if (abs > maxPeak) maxPeak = abs;
      sumSquares += abs * abs;
    }

    peaks.push({
      peak: maxPeak,
      rms: Math.sqrt(sumSquares / samplesPerSlice),
    });
  }

  return peaks;
};

/**
 * Generate a synthetic impulse response for a reverb effect.
 * Creates a decaying noise burst that can be fed into a ConvolverNode.
 *
 * @param {AudioContext} audioContext - The shared AudioContext.
 * @param {number} [duration=2.0] - Impulse length in seconds.
 * @param {number} [decay=2.0] - Decay rate (higher = shorter tail).
 * @param {boolean} [reverse=false] - Reverse the impulse for pre-verb effect.
 * @returns {AudioBuffer} The generated impulse response.
 */
export const generateImpulseResponse = (
  audioContext,
  duration = 2.0,
  decay = 2.0,
  reverse = false
) => {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const channelData = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const n = reverse ? length - i : i;
      // Exponential decay envelope multiplied by white noise
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
  }

  return impulse;
};

/**
 * Create mock stem buffers from a single stereo buffer.
 * Since real-time stem separation (Demucs) is too heavy for the main thread,
 * we approximate stems using frequency-band splitting and panning.
 * This provides a functional architecture ready for real WASM models.
 *
 * @param {AudioBuffer} sourceBuffer - The original track buffer.
 * @param {AudioContext} audioContext - Context for creating new buffers.
 * @returns {Object<string, AudioBuffer>} Object with keys: D, B, V, M.
 */
export const createMockStems = (sourceBuffer, audioContext) => {
  const sampleRate = sourceBuffer.sampleRate;
  const length = sourceBuffer.length;
  const channels = sourceBuffer.numberOfChannels;

  // Create empty buffers for each stem
  const stems = {
    D: audioContext.createBuffer(channels, length, sampleRate), // Drums
    B: audioContext.createBuffer(channels, length, sampleRate), // Bass
    V: audioContext.createBuffer(channels, length, sampleRate), // Vocals
    M: audioContext.createBuffer(channels, length, sampleRate), // Melody
  };

  for (let ch = 0; ch < channels; ch++) {
    const sourceData = sourceBuffer.getChannelData(ch);

    // Simple frequency-approximate separation via finite differences (high-pass energy)
    // This is a stub architecture - replace with Demucs WASM output
    for (let i = 0; i < length; i++) {
      const sample = sourceData[i];
      const diff = i > 0 ? Math.abs(sample - sourceData[i - 1]) : 0;
      const lowEnergy = Math.abs(sample); // Approximate low freq

      // D (Drums): transient-heavy content
      stems.D.getChannelData(ch)[i] = diff * 0.8 + sample * 0.2;

      // B (Bass): low-frequency sustained content
      stems.B.getChannelData(ch)[i] = lowEnergy * 0.6;

      // V (Vocals): mid-range with some stereo variance (mock)
      stems.V.getChannelData(ch)[i] = sample * 0.4 * (ch === 0 ? 1.1 : 0.9);

      // M (Melody): residual high-mid content
      stems.M.getChannelData(ch)[i] = sample * 0.5 - lowEnergy * 0.3;
    }
  }

  return stems;
};
