/**
 * Real-Audio Feature Extractor
 * ----------------------------
 * Replaces the mock analyzers in server/analysis with real FFmpeg-driven
 * audio feature extraction. Returns dense time-series of:
 *   - rms          (overall loudness)
 *   - lowEnergy    (sub-bass + bass, 20-200 Hz) — "kick / bass" indicator
 *   - midEnergy    (200-2000 Hz)                — "vocals / chords"
 *   - highEnergy   (2000-16000 Hz)              — "hats / air / brightness"
 *   - flux         (spectral flux ≈ rate of change of mid+high energy)
 *   - onset        (binary onset events from low-band peaks ≈ kicks)
 *
 * All features are sampled on a uniform hop (default 0.5s) so they can be
 * fed straight into a structural-segmentation algorithm.
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const HOP_SECONDS = 0.5;

/**
 * Run ffmpeg with an `astats` filter on a single band and collect per-frame
 * RMS dB values. Returns an array of linear-amplitude RMS samples (0..1)
 * sampled every `HOP_SECONDS`.
 *
 * Uses `astats=metadata=1:reset=1` combined with `asetnsamples` so each frame
 * covers exactly `hopSeconds` of audio — that gives us a uniform time grid.
 */
function extractBandRms(audioPath, lowHz, highHz, hopSeconds = HOP_SECONDS) {
  return new Promise((resolve) => {
    const samples = [];
    const sampleRate = 44100;
    const frameSize = Math.round(sampleRate * hopSeconds);

    const filters = [];
    if (lowHz > 20)   filters.push(`highpass=f=${lowHz}`);
    if (highHz < 20000) filters.push(`lowpass=f=${highHz}`);
    filters.push(`asetnsamples=n=${frameSize}:p=0`);
    filters.push(`astats=metadata=1:reset=1`);
    filters.push(`ametadata=mode=print:key=lavfi.astats.Overall.RMS_level:file=-`);

    const command = ffmpeg(audioPath)
      .audioFrequency(sampleRate)
      .audioChannels(1)
      .audioFilters(filters)
      .format('null')
      .on('stderr', () => {})
      .on('error', (err) => {
        console.warn(`⚠️  Band [${lowHz}-${highHz}] extraction failed:`, err.message);
        resolve(samples);
      })
      .on('end', () => resolve(samples));

    // ametadata writes to FFmpeg's stdout. We pipe and parse line-by-line.
    const stream = command.pipe();
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        const m = line.match(/lavfi\.astats\.Overall\.RMS_level=([\-0-9.eE+]+)/);
        if (m) {
          const db = parseFloat(m[1]);
          // dB to 0..1 linear: clamp -60..0
          const lin = Math.max(0, Math.min(1, (db + 60) / 60));
          samples.push(Number.isFinite(lin) ? lin : 0);
        }
      }
    });
    stream.on('error', () => resolve(samples));
  });
}

/**
 * Align all band arrays to the shortest length, returning per-frame feature
 * objects.
 */
function alignBands({ rms, low, mid, high }) {
  const n = Math.min(rms.length, low.length, mid.length, high.length);
  const frames = [];
  for (let i = 0; i < n; i++) {
    frames.push({
      t: i * HOP_SECONDS,
      rms: rms[i],
      low: low[i],
      mid: mid[i],
      high: high[i],
    });
  }
  return frames;
}

/**
 * Spectral flux ≈ rate of change of (mid + high) band energy, half-wave
 * rectified (only positive deltas count, like classic onset detection).
 */
function computeFlux(frames) {
  for (let i = 0; i < frames.length; i++) {
    if (i === 0) { frames[i].flux = 0; continue; }
    const cur = frames[i].mid + frames[i].high;
    const prv = frames[i - 1].mid + frames[i - 1].high;
    frames[i].flux = Math.max(0, cur - prv);
  }
  return frames;
}

/**
 * Onset events. We detect them on the *low-band derivative* (Δlow) — bass
 * hits are the most reliable beat-anchors in dance music — and fall back to
 * spectral flux when low-band derivative is featureless.
 *
 * Adaptive threshold = mean + 0.7·stdev of the candidate signal, with a
 * minimum-distance constraint so kick rolls don't all count as onsets.
 */
function computeOnsets(frames) {
  // Build candidate signal: half-wave-rectified Δlow.
  const dLow = new Array(frames.length).fill(0);
  for (let i = 1; i < frames.length; i++) {
    dLow[i] = Math.max(0, frames[i].low - frames[i - 1].low);
  }
  // If Δlow is too flat (no bass-driven track) use spectral flux as fallback.
  const dLowMax = Math.max(...dLow);
  const signal = dLowMax < 0.02 ? frames.map((f) => f.flux) : dLow;

  // Adaptive threshold from signal statistics.
  const mean = signal.reduce((s, v) => s + v, 0) / signal.length;
  const variance = signal.reduce((s, v) => s + (v - mean) ** 2, 0) / signal.length;
  const std = Math.sqrt(variance);
  const threshold = Math.max(0.01, mean + 0.7 * std);

  const minSpacing = 1; // ≥ 1 frame between onsets at 0.5s hop = 120 BPM ceiling

  let lastOnset = -minSpacing;
  for (let i = 0; i < frames.length; i++) {
    const isPeak = signal[i] > threshold &&
                   (i === 0 || signal[i] >= signal[i - 1]) &&
                   (i === signal.length - 1 || signal[i] >= signal[i + 1]);
    if (isPeak && i - lastOnset >= minSpacing) {
      frames[i].onset = 1;
      lastOnset = i;
    } else {
      frames[i].onset = 0;
    }
  }
  return frames;
}

/**
 * Estimate BPM from the inter-onset interval distribution.
 * Picks the strongest peak in the 60-200 BPM range.
 */
function estimateBpmFromOnsets(frames) {
  const onsetTimes = frames.filter((f) => f.onset).map((f) => f.t);
  if (onsetTimes.length < 4) return 120;

  // Histogram of inter-onset intervals (200ms-1s buckets in 5ms resolution)
  const bins = new Map();
  for (let i = 1; i < onsetTimes.length; i++) {
    const dt = onsetTimes[i] - onsetTimes[i - 1];
    if (dt < 0.2 || dt > 1.5) continue;
    const k = Math.round(dt * 200) / 200; // 5ms bins
    bins.set(k, (bins.get(k) || 0) + 1);
  }
  if (!bins.size) return 120;

  let bestDt = 0.5;
  let bestCount = 0;
  for (const [dt, c] of bins) {
    if (c > bestCount) { bestCount = c; bestDt = dt; }
  }

  // Convert interval → BPM, then fold into 60-200 range
  let bpm = 60 / bestDt;
  while (bpm < 60)  bpm *= 2;
  while (bpm > 200) bpm /= 2;
  return Math.round(bpm * 10) / 10;
}

/**
 * Top-level extractor. Returns:
 *   {
 *     hopSeconds,
 *     bpm,
 *     frames: [{ t, rms, low, mid, high, flux, onset }, ...],
 *   }
 */
export async function extractFeatures(audioPath, opts = {}) {
  const hopSeconds = opts.hopSeconds || HOP_SECONDS;

  console.log(`🔬 [FeatureExtractor] analysing ${audioPath} @ hop=${hopSeconds}s`);
  const t0 = Date.now();

  // 4 parallel band passes — bottleneck is CPU not memory.
  const [rms, low, mid, high] = await Promise.all([
    extractBandRms(audioPath, 20,   20000, hopSeconds), // full
    extractBandRms(audioPath, 20,   200,   hopSeconds), // bass
    extractBandRms(audioPath, 200,  2000,  hopSeconds), // mid
    extractBandRms(audioPath, 2000, 16000, hopSeconds), // high
  ]);

  let frames = alignBands({ rms, low, mid, high });
  frames = computeFlux(frames);
  frames = computeOnsets(frames);

  const bpm = estimateBpmFromOnsets(frames);

  const ms = Date.now() - t0;
  console.log(`✅ [FeatureExtractor] ${frames.length} frames, BPM≈${bpm}, ${ms}ms`);

  return { hopSeconds, bpm, frames };
}

export default { extractFeatures };
