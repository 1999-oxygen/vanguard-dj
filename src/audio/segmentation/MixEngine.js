/**
 * @fileoverview MixEngine
 * Generates infinite, unique DJ mixes by traversing the segment compatibility graph.
 * Supports multiple mix styles, energy arc planning, and stem-swap transitions.
 *
 * Mix Styles:
 *   - RAMP_UP: Energy builds progressively
 *   - RAMP_DOWN: Energy decrescendo
 *   - WAVE: Energy oscillates (peak -> valley -> peak)
 *   - JOURNEY: Random but connected walk through the graph
 *   - STEM_FUSION: Alternates stem-swapped segments (drums from A + melody from B)
 */

import { computeSegmentCompatibility, buildSegmentGraph, coerceSegmentFeatures } from './SegmentMatcher.js';

export const MIX_STYLES = {
  RAMP_UP: 'ramp_up',
  RAMP_DOWN: 'ramp_down',
  WAVE: 'wave',
  JOURNEY: 'journey',
  STEM_FUSION: 'stem_fusion',
};

/**
 * Generate a mix sequence from a segment pool.
 *
 * @param {Array<Object>} segments - All available segments.
 * @param {Object} [options={}]
 * @param {string} [options.style='journey'] - Mix style from MIX_STYLES.
 * @param {number} [options.targetDuration=300] - Target mix duration in seconds.
 * @param {string} [options.startSegmentId] - Specific segment to start from.
 * @param {number} [options.minTransitionScore=0.5] - Minimum compatibility threshold.
 * @param {boolean} [options.allowStemSwaps=false] - Enable stem-fusion transitions.
 * @returns {{segments: Array<Object>, totalDuration: number, transitions: Array<Object>}} Mix plan.
 */
export const generateMix = (segments, options = {}) => {
  const {
    style = MIX_STYLES.JOURNEY,
    targetDuration = 300,
    startSegmentId = null,
    minTransitionScore = 0.5,
    allowStemSwaps = false,
  } = options;

  if (segments.length === 0) {
    return { segments: [], totalDuration: 0, transitions: [] };
  }

  // Build compatibility graph
  const graph = buildSegmentGraph(segments, 8, minTransitionScore);

  // Select starting segment
  let current = startSegmentId
    ? segments.find(s => s.id === startSegmentId)
    : selectStartSegment(segments, style);

  if (!current) current = segments[0];

  const mixSegments = [current];
  const transitions = [];
  let totalDuration = current.duration;

  // Generate sequence
  while (totalDuration < targetDuration) {
    const neighbors = graph.get(current.id) || [];

    if (neighbors.length === 0) break;

    // Filter neighbors based on style constraints
    const candidates = filterByStyle(neighbors, mixSegments, style, allowStemSwaps);

    if (candidates.length === 0) break;

    // Weighted random selection (higher score = more likely)
    const next = weightedRandomSelection(candidates);

    transitions.push({
      from: current.id,
      to: next.segment.id,
      score: next.score,
      type: next.type,
      crossfadeDuration: computeCrossfadeDuration(current, next.segment),
    });

    mixSegments.push(next.segment);
    totalDuration += next.segment.duration;
    current = next.segment;

    // Avoid getting stuck in small loops
    if (mixSegments.length > segments.length * 2) break;
  }

  return {
    segments: mixSegments,
    totalDuration,
    transitions,
  };
};

/**
 * Select an appropriate starting segment based on mix style.
 */
const selectStartSegment = (segments, style) => {
  switch (style) {
    case MIX_STYLES.RAMP_UP:
      // Start with low energy
      return segments.reduce((lowest, seg) =>
        coerceSegmentFeatures(seg).avgEnergy < coerceSegmentFeatures(lowest).avgEnergy ? seg : lowest
      );
    case MIX_STYLES.RAMP_DOWN:
      // Start with high energy
      return segments.reduce((highest, seg) =>
        coerceSegmentFeatures(seg).avgEnergy > coerceSegmentFeatures(highest).avgEnergy ? seg : highest
      );
    case MIX_STYLES.WAVE:
      // Start at medium energy
      const sorted = [...segments].sort((a, b) => coerceSegmentFeatures(a).avgEnergy - coerceSegmentFeatures(b).avgEnergy);
      return sorted[Math.floor(sorted.length / 2)];
    case MIX_STYLES.STEM_FUSION:
      // Start with a percussive segment
      return segments.find(s => coerceSegmentFeatures(s).isPercussive) || segments[0];
    default:
      // Random start
      return segments[Math.floor(Math.random() * segments.length)];
  }
};

/**
 * Filter neighbor candidates based on mix style constraints.
 */
const filterByStyle = (neighbors, mixSegments, style, allowStemSwaps) => {
  const current = mixSegments[mixSegments.length - 1];
  const currentEnergy = coerceSegmentFeatures(current).avgEnergy;

  switch (style) {
    case MIX_STYLES.RAMP_UP:
      // Prefer higher energy than current
      return neighbors.filter(n =>
        coerceSegmentFeatures(n.segment).avgEnergy >= currentEnergy - 0.1 &&
        n.score > 0.4
      );

    case MIX_STYLES.RAMP_DOWN:
      // Prefer lower energy than current
      return neighbors.filter(n =>
        coerceSegmentFeatures(n.segment).avgEnergy <= currentEnergy + 0.1 &&
        n.score > 0.4
      );

    case MIX_STYLES.WAVE: {
      // Create sinusoidal energy arc
      const position = mixSegments.length;
      const cycleLength = 8;
      const targetEnergy = 0.5 + 0.4 * Math.sin((position / cycleLength) * Math.PI * 2);

      return neighbors
        .map(n => ({
          ...n,
          energyMatch: 1 - Math.abs(coerceSegmentFeatures(n.segment).avgEnergy - targetEnergy),
        }))
        .sort((a, b) => b.energyMatch - a.energyMatch)
        .slice(0, 5);
    }

    case MIX_STYLES.STEM_FUSION:
      if (allowStemSwaps) {
        // Prioritize segments with contrasting stem characteristics
        return neighbors.filter(n =>
          n.type === 'vocal_swap' ||
          n.type === 'timbre_shift' ||
          n.type === 'percussive_break'
        );
      }
      return neighbors;

    default:
      // Journey: accept any decent transition, but avoid recent repeats
      const recentIds = new Set(mixSegments.slice(-4).map(s => s.id));
      return neighbors.filter(n => !recentIds.has(n.segment.id));
  }
};

/**
 * Weighted random selection from candidates.
 * Higher scores have higher probability but randomness prevents predictability.
 */
const weightedRandomSelection = (candidates) => {
  const totalWeight = candidates.reduce((sum, c) => sum + c.score, 0);
  let random = Math.random() * totalWeight;

  for (const candidate of candidates) {
    random -= candidate.score;
    if (random <= 0) return candidate;
  }

  return candidates[candidates.length - 1];
};

/**
 * Compute optimal crossfade duration between two segments.
 * Longer crossfades for similar segments, shorter for contrasting.
 * @param {Object} segA
 * @param {Object} segB
 * @returns {number} Crossfade duration in seconds.
 */
const computeCrossfadeDuration = (segA, segB) => {
  const compat = computeSegmentCompatibility(segA, segB);

  if (compat.score > 0.8) return 4.0;  // Very similar: smooth long blend
  if (compat.score > 0.6) return 2.0;  // Moderate: medium blend
  if (compat.score > 0.4) return 1.0;  // Different: quick cut
  return 0.5; // Very different: almost a hard cut
};

/**
 * Generate multiple unique mixes from the same segment pool.
 * Each mix follows a different path through the graph.
 *
 * @param {Array<Object>} segments
 * @param {number} [count=3] - Number of mixes to generate.
 * @param {Object} [options={}]
 * @returns {Array<Object>} Array of mix plans.
 */
export const generateMixVariations = (segments, count = 3, options = {}) => {
  const mixes = [];
  const usedStarts = new Set();

  for (let i = 0; i < count; i++) {
    // Pick a fresh starting segment
    let start = segments[Math.floor(Math.random() * segments.length)];
    let attempts = 0;
    while (usedStarts.has(start.id) && attempts < 10) {
      start = segments[Math.floor(Math.random() * segments.length)];
      attempts++;
    }
    usedStarts.add(start.id);

    const mix = generateMix(segments, {
      ...options,
      startSegmentId: start.id,
      style: Object.values(MIX_STYLES)[i % Object.values(MIX_STYLES).length],
    });

    mixes.push(mix);
  }

  return mixes;
};

/**
 * Plan a stem-swap transition where specific stems are exchanged
 * between two segments. E.g., keep drums from A, replace melody with B.
 *
 * @param {Object} segA - Base segment.
 * @param {Object} segB - Donor segment.
 * @param {Array<string>} swapStems - Which stems to swap ('D', 'B', 'V', 'M').
 * @returns {Object} Fusion plan.
 */
export const planStemSwap = (segA, segB, swapStems = ['M']) => {
  const compat = computeSegmentCompatibility(segA, segB, {
    energy: 0.15,
    timbre: 0.15,
    tempo: 0.4,
    key: 0.2,
    dynamics: 0.05,
    vocalDensity: 0.05,
  });

  return {
    baseSegment: segA,
    donorSegment: segB,
    swapStems,
    compatibility: compat.score,
    // Playback: Start with segA full, crossfade swapped stems in over 2 beats
    transitionDuration: 2.0,
    notes: `Swapping ${swapStems.join('+')} from ${segB.trackName} into ${segA.trackName}`,
  };
};

