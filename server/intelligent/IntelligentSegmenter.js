/**
 * Intelligent Segmenter
 * ---------------------
 * Produces long, musically-meaningful "DJ phrases" (30–90s by default) from
 * the dense feature time-series produced by FeatureExtractor.
 *
 * Algorithm:
 *  1. Build a self-similarity novelty curve from the feature vectors. A
 *     novelty peak ≈ a structural change (build → drop, drop → break, …).
 *  2. Peak-pick novelty with a min-distance constraint = MIN_DURATION.
 *  3. Snap each candidate boundary to the nearest 8-bar phrase boundary
 *     using the estimated BPM. This is what gives segments the "feels right"
 *     property a DJ wants.
 *  4. Enforce 30 ≤ length ≤ 90 by splitting too-long sections at the next
 *     strongest internal peak and merging too-short sections.
 *  5. Classify each segment from its internal feature statistics:
 *     INTRO / BREAK / BUILDUP / DROP / VERSE / CHORUS / OUTRO.
 *  6. Pick a mix-in / mix-out point inside each segment that lands on a
 *     beat-grid bar boundary AND avoids the lowest-energy 5% (so we don't
 *     mix into silence).
 */

import { extractFeatures } from './FeatureExtractor.js';

const MIN_DURATION_DEFAULT = 30;
const MAX_DURATION_DEFAULT = 90;
const PREFERRED_PHRASE_BARS = 8; // 8 bars = 32 beats

// ------------------------------- helpers --------------------------------

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}
function std(arr) {
  if (!arr.length) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// --------------------------- novelty curve ------------------------------

/**
 * Cosine distance between two feature vectors (low, mid, high, flux).
 */
function frameDistance(a, b) {
  const va = [a.low, a.mid, a.high, a.flux];
  const vb = [b.low, b.mid, b.high, b.flux];
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < va.length; i++) {
    dot += va[i] * vb[i];
    na += va[i] * va[i];
    nb += vb[i] * vb[i];
  }
  if (na === 0 || nb === 0) return 0;
  return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Local novelty = mean distance between a frame and the next K frames vs.
 * the previous K frames. Peaks here = structural change.
 */
function noveltyCurve(frames, K = 16) {
  const n = frames.length;
  const novelty = new Array(n).fill(0);
  for (let i = K; i < n - K; i++) {
    let beforeAvg = 0, afterAvg = 0;
    for (let k = 1; k <= K; k++) {
      beforeAvg += frameDistance(frames[i], frames[i - k]);
      afterAvg += frameDistance(frames[i], frames[i + k]);
    }
    // Boundary strength = how different "before" is from "after".
    novelty[i] = Math.abs(afterAvg - beforeAvg) / K;
  }
  return novelty;
}

// --------------------------- peak picking -------------------------------

function pickPeaks(novelty, minSpacingFrames) {
  const peaks = [];
  const m = mean(novelty);
  const s = std(novelty);
  const threshold = m + 0.5 * s;

  let lastPeak = -minSpacingFrames;
  for (let i = 1; i < novelty.length - 1; i++) {
    if (novelty[i] < threshold) continue;
    if (novelty[i] <= novelty[i - 1] || novelty[i] < novelty[i + 1]) continue;
    if (i - lastPeak < minSpacingFrames) continue;
    peaks.push({ index: i, score: novelty[i] });
    lastPeak = i;
  }
  return peaks;
}

// ----------------------- phrase / bar snapping --------------------------

function snapToBarGrid(timeSec, bpm, anchor = 0) {
  const beatsPerSec = bpm / 60;
  const barSec = 4 / beatsPerSec;
  const phraseSec = barSec * PREFERRED_PHRASE_BARS;
  const offset = timeSec - anchor;
  const phraseIdx = Math.round(offset / phraseSec);
  return anchor + phraseIdx * phraseSec;
}

// ------------------------- segment classification ----------------------

/**
 * Classify a segment RELATIVE to the track's own loudness distribution.
 * This is what makes the classifier work across tracks with very different
 * mastering levels — a "loud" section in a quiet track might have the same
 * absolute RMS as a "quiet" section in a louder track.
 *
 * `trackStats` must be pre-computed once per track and passed in.
 */
function classifySegment(frames, segStartIdx, segEndIdx, bpm, trackStats) {
  const slice = frames.slice(segStartIdx, segEndIdx);
  if (!slice.length) return { type: 'REGULAR', energy: 0, intensity: 'MEDIUM' };

  const rms = slice.map((f) => f.rms);
  const low = slice.map((f) => f.low);
  const high = slice.map((f) => f.high);
  const flux = slice.map((f) => f.flux);

  const meanRms = mean(rms);
  const meanLow = mean(low);
  const meanHigh = mean(high);
  const meanFlux = mean(flux);
  const onsetCount = slice.reduce((s, f) => s + (f.onset || 0), 0);
  const onsetDensity = onsetCount / Math.max(1, slice.length);

  // Energy slope across the segment ⇒ rising / falling / flat
  const half = Math.floor(slice.length / 2);
  const earlyMean = mean(rms.slice(0, half));
  const lateMean = mean(rms.slice(half));
  const slope = lateMean - earlyMean;

  // Z-scores against the whole track — "how unusual is this segment?"
  const rmsZ     = (meanRms  - trackStats.rmsMean)   / (trackStats.rmsStd   || 1e-6);
  const lowZ     = (meanLow  - trackStats.lowMean)   / (trackStats.lowStd   || 1e-6);
  const highZ    = (meanHigh - trackStats.highMean)  / (trackStats.highStd  || 1e-6);
  const onsetRel = onsetDensity / (trackStats.onsetMean || 1e-6);
  const slopeRel = slope        / (trackStats.rmsStd   || 1e-6);

  let type = 'VERSE';
  if (rmsZ < -0.7 && onsetRel < 0.75) {
    type = 'BREAK';                      // noticeably quieter + sparser
  } else if (slopeRel > 0.5 && lateMean > earlyMean * 1.10) {
    type = 'BUILDUP';                    // energy clearly rising
  } else if (slopeRel < -0.5 && earlyMean > lateMean * 1.10) {
    type = 'OUTRO';                      // energy clearly falling
  } else if (rmsZ > 0.5 && (lowZ > 0.1 || onsetRel > 1.0)) {
    type = 'DROP';                       // louder + bass-heavy OR hit-dense
  } else if (rmsZ > 0.15) {
    type = 'CHORUS';                     // above-average energy
  } else if (rmsZ < -0.15) {
    type = 'VERSE';                      // below-average energy
  } else {
    type = 'VERSE';                      // neutral → VERSE (less CHORUS bias)
  }

  const intensity = rmsZ > 0.7 ? 'HIGH' : rmsZ < -0.5 ? 'LOW' : 'MEDIUM';

  return {
    type,
    energy: meanRms,
    low: meanLow,
    high: meanHigh,
    flux: meanFlux,
    onsetDensity,
    slope,
    intensity,
    bpm,
  };
}

// ----------------------- mix-in / mix-out points ------------------------

/**
 * Pick a clean mix-in (inside the first quarter) and mix-out (inside the
 * last quarter) point. Snapped to bar boundary, avoiding very-low-energy
 * frames so we don't fade into silence.
 */
function pickMixPoints(frames, segStartIdx, segEndIdx, bpm, hopSeconds) {
  const sliceLen = segEndIdx - segStartIdx;
  const startWindowEnd = segStartIdx + Math.max(2, Math.floor(sliceLen * 0.25));
  const endWindowStart = segEndIdx - Math.max(2, Math.floor(sliceLen * 0.25));

  // Mix in: first frame inside the start window with energy ≥ 60% of the
  // segment max — this avoids pre-roll silence.
  const segMax = Math.max(...frames.slice(segStartIdx, segEndIdx).map((f) => f.rms));
  const energyFloor = segMax * 0.6;

  let inIdx = segStartIdx;
  for (let i = segStartIdx; i < startWindowEnd; i++) {
    if (frames[i].rms >= energyFloor) { inIdx = i; break; }
  }

  let outIdx = segEndIdx - 1;
  for (let i = segEndIdx - 1; i >= endWindowStart; i--) {
    if (frames[i].rms >= energyFloor) { outIdx = i; break; }
  }

  const startSec = segStartIdx * hopSeconds;
  const endSec = segEndIdx * hopSeconds;
  const inSec = snapToBarGrid(inIdx * hopSeconds, bpm, startSec);
  const outSec = snapToBarGrid(outIdx * hopSeconds, bpm, startSec);

  return {
    mixInOffset: clamp(inSec - startSec, 0, endSec - startSec),
    mixOutOffset: clamp(outSec - startSec, 0, endSec - startSec),
  };
}

// ----------------------------- main entry -------------------------------

export async function segmentTrack(audioPath, opts = {}) {
  const minDur = opts.minDuration || MIN_DURATION_DEFAULT;
  const maxDur = opts.maxDuration || MAX_DURATION_DEFAULT;

  const { hopSeconds, bpm: estBpm, frames } = await extractFeatures(audioPath, opts);
  const bpm = opts.bpm || estBpm || 120;
  const totalDuration = frames.length * hopSeconds;

  // Pre-compute track-wide feature stats for relative classification.
  const allRms   = frames.map((f) => f.rms);
  const allLow   = frames.map((f) => f.low);
  const allHigh  = frames.map((f) => f.high);
  const allOnset = frames.map((f) => f.onset || 0);
  const trackStats = {
    rmsMean:   mean(allRms),   rmsStd:  std(allRms),
    lowMean:   mean(allLow),   lowStd:  std(allLow),
    highMean:  mean(allHigh),  highStd: std(allHigh),
    onsetMean: mean(allOnset),
  };

  if (totalDuration < minDur * 1.5) {
    // Track too short to be worth chopping — return single segment.
    const cls = classifySegment(frames, 0, frames.length, bpm, trackStats);
    const mix = pickMixPoints(frames, 0, frames.length, bpm, hopSeconds);
    return {
      bpm,
      totalDuration,
      segments: [{
        startTime: 0,
        endTime: totalDuration,
        duration: totalDuration,
        ...cls,
        ...mix,
      }],
    };
  }

  // 1. Novelty curve.
  const novelty = noveltyCurve(frames);

  // 2. Peak-pick with min-distance = minDur.
  const minSpacing = Math.ceil(minDur / hopSeconds);
  const peaks = pickPeaks(novelty, minSpacing);

  // 3. Build raw boundaries (start, …peaks…, end) and snap each peak to the
  //    nearest 8-bar phrase line.
  const rawBoundaries = [0, ...peaks.map((p) => p.index * hopSeconds), totalDuration];
  const snapped = rawBoundaries.map((t, i) => {
    if (i === 0 || i === rawBoundaries.length - 1) return t;
    return snapToBarGrid(t, bpm);
  });
  // Deduplicate after snapping.
  const cleaned = [];
  for (const b of snapped) {
    if (!cleaned.length || b - cleaned[cleaned.length - 1] > 1) cleaned.push(b);
  }

  // 4. Enforce duration window.
  const final = [cleaned[0]];
  for (let i = 1; i < cleaned.length; i++) {
    const prev = final[final.length - 1];
    const cur = cleaned[i];
    const len = cur - prev;
    if (len < minDur && i < cleaned.length - 1) {
      // Too short → drop this boundary, merge into next.
      continue;
    }
    if (len > maxDur) {
      // Too long → insert phrase-aligned splits every ~maxDur.
      const phraseSec = (4 / (bpm / 60)) * PREFERRED_PHRASE_BARS;
      let t = prev + Math.round((maxDur * 0.8) / phraseSec) * phraseSec;
      while (cur - t > minDur) {
        final.push(t);
        t += Math.round(maxDur / phraseSec) * phraseSec;
      }
    }
    final.push(cur);
  }
  if (final[final.length - 1] !== totalDuration) {
    final[final.length - 1] = totalDuration;
  }
  // Merge the trailing segment back into the previous one if it's too short
  // (e.g. a 7s leftover after the last phrase boundary).
  while (final.length >= 3 &&
         final[final.length - 1] - final[final.length - 2] < minDur) {
    final.splice(final.length - 2, 1);
  }

  // 5. Build segment objects.
  const segments = [];
  for (let i = 0; i < final.length - 1; i++) {
    const startSec = final[i];
    const endSec = final[i + 1];
    const startIdx = Math.round(startSec / hopSeconds);
    const endIdx = Math.round(endSec / hopSeconds);
    if (endIdx - startIdx < 2) continue;

    const cls = classifySegment(frames, startIdx, endIdx, bpm, trackStats);
    const mix = pickMixPoints(frames, startIdx, endIdx, bpm, hopSeconds);

    // Heuristics for INTRO / OUTRO based on position-in-track.
    // Use relative energy (vs. track mean) so it fires on loud masters too.
    const positionRatio = (startSec + endSec) / 2 / totalDuration;
    const relEnergy = cls.energy / (trackStats.rmsMean || 1);
    let type = cls.type;
    if (positionRatio < 0.15 && relEnergy < 1.0) type = 'INTRO';
    else if (positionRatio > 0.85 && relEnergy < 1.0) type = 'OUTRO';

    segments.push({
      startTime: startSec,
      endTime: endSec,
      duration: endSec - startSec,
      type,
      energy: cls.energy,
      lowEnergy: cls.low,
      highEnergy: cls.high,
      flux: cls.flux,
      onsetDensity: cls.onsetDensity,
      energySlope: cls.slope,
      intensity: cls.intensity,
      bpm,
      mixInOffset: mix.mixInOffset,
      mixOutOffset: mix.mixOutOffset,
      // Quality = how cleanly the boundary aligned to the bar grid + how
      // confidently we classified it.
      quality: clamp(0.4 + Math.min(0.3, cls.flux) + (cls.energy > 0.2 ? 0.2 : 0), 0, 1),
    });
  }

  return { bpm, totalDuration, segments };
}

export default { segmentTrack };
