/**
 * @fileoverview SegmentMatcher
 * Multi-dimensional similarity engine that finds compatible audio segments
 * across an entire song library. Supports weighted feature matching,
 * transition type classification (energy ramp, timbre shift, beat juggling),
 * and compatibility scoring for harmonic mixing.
 *
 * The matcher creates a "segment graph" where edges represent viable
 * transitions. This graph can then be traversed to generate infinite mixes.
 */

import { camelotDistance } from './harmonicUtils.js';

/**
 * Default feature weights for similarity calculation.
 * These can be adjusted per mix style (e.g., energy ramp vs. chill blend).
 */
export const DEFAULT_WEIGHTS = {
  energy: 0.25,        // RMS energy match
  timbre: 0.20,        // Spectral characteristics
  tempo: 0.20,         // BPM proximity
  key: 0.15,           // Harmonic compatibility
  dynamics: 0.10,      // Dynamic range similarity
  vocalDensity: 0.10,  // Vocal presence match
};

/**
 * Transition type tags for semantic mixing.
 */
export const TRANSITION_TYPES = {
  ENERGY_RAMP_UP: 'energy_ramp_up',       // Low -> High energy
  ENERGY_RAMP_DOWN: 'energy_ramp_down',   // High -> Low energy
  TIMBRE_SHIFT: 'timbre_shift',           // Dark -> Bright or vice versa
  BEAT_MATCH: 'beat_match',               // Same/similar BPM
  HARMONIC_MIX: 'harmonic_mix',           // Compatible keys
  VOCAL_SWAP: 'vocal_swap',               // Vocal -> Instrumental
  PERCUSSIVE_BREAK: 'percussive_break',   // High percussiveness change
  SIMILAR_VIBE: 'similar_vibe',           // All features close
};

/**
 * Compute similarity between two segments (0 = identical, 1 = completely different).
 * Uses weighted Euclidean distance across feature vectors.
 *
 * @param {Object} segA - Segment with features.
 * @param {Object} segB - Segment with features.
 * @param {Object} [weights={}] - Custom feature weights.
 * @returns {{score: number, details: Object, type: string}} Compatibility result.
 */
export const computeSegmentCompatibility = (segA, segB, weights = {}) => {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const fA = segA.features;
  const fB = segB.features;

  // Energy similarity (0-1, 1 = identical)
  const energyDiff = Math.abs(fA.avgEnergy - fB.avgEnergy);
  const energyStartEndMatch = 1 - Math.abs(fA.energyEnd - fB.energyStart);
  const energySim = 1 - energyDiff;

  // Timbre similarity
  const timbreDiff = Math.abs(fA.spectralFlux - fB.spectralFlux) * 0.5 +
                     Math.abs(fA.spectralRolloff - fB.spectralRolloff) * 0.5;
  const timbreSim = 1 - timbreDiff;

  // Tempo similarity
  const bpmDiff = Math.abs(fA.bpm - fB.bpm);
  const tempoSim = Math.max(0, 1 - bpmDiff / 30); // 30 BPM diff = 0 similarity

  // Key compatibility (Camelot wheel)
  const keyDist = camelotDistance(fA.key, fB.key);
  const keySim = Math.max(0, 1 - keyDist / 7);

  // Dynamics similarity
  const dynDiff = Math.abs(fA.dynamicRange - fB.dynamicRange);
  const dynSim = 1 - dynDiff;

  // Vocal density similarity (or intentional contrast)
  const vocalDiff = Math.abs(fA.vocalDensity - fB.vocalDensity);
  const vocalSim = 1 - vocalDiff;

  // Weighted composite score (0-1)
  const score =
    energySim * w.energy +
    timbreSim * w.timbre +
    tempoSim * w.tempo +
    keySim * w.key +
    dynSim * w.dynamics +
    vocalSim * w.vocalDensity;

  // Determine transition type based on feature deltas
  const type = classifyTransition(fA, fB, {
    energyDiff,
    timbreDiff,
    bpmDiff,
    keyDist,
    vocalDiff,
  });

  return {
    score: Math.min(1, Math.max(0, score)),
    type,
    details: {
      energySim,
      timbreSim,
      tempoSim,
      keySim,
      dynSim,
      vocalSim,
      energyStartEndMatch,
    },
  };
};

/**
 * Classify a transition type based on feature deltas.
 * @param {Object} fA
 * @param {Object} fB
 * @param {Object} diffs
 * @returns {string} TRANSITION_TYPES value.
 */
const classifyTransition = (fA, fB, diffs) => {
  if (diffs.energyDiff > 0.4 && fB.avgEnergy > fA.avgEnergy) {
    return TRANSITION_TYPES.ENERGY_RAMP_UP;
  }
  if (diffs.energyDiff > 0.4 && fB.avgEnergy < fA.avgEnergy) {
    return TRANSITION_TYPES.ENERGY_RAMP_DOWN;
  }
  if (diffs.timbreDiff > 0.4) {
    return TRANSITION_TYPES.TIMBRE_SHIFT;
  }
  if (diffs.bpmDiff < 3 && diffs.keyDist <= 1) {
    return TRANSITION_TYPES.HARMONIC_MIX;
  }
  if (diffs.vocalDiff > 0.5) {
    return TRANSITION_TYPES.VOCAL_SWAP;
  }
  if (Math.abs(fA.zeroCrossingRate - fB.zeroCrossingRate) > 0.03) {
    return TRANSITION_TYPES.PERCUSSIVE_BREAK;
  }
  if (diffs.energyDiff < 0.15 && diffs.timbreDiff < 0.2) {
    return TRANSITION_TYPES.SIMILAR_VIBE;
  }
  return TRANSITION_TYPES.BEAT_MATCH;
};

/**
 * Build a compatibility graph for a pool of segments.
 * Each segment gets edges to its top-N most compatible neighbors.
 *
 * @param {Array<Object>} segments - All segments across all tracks.
 * @param {number} [topN=5] - Number of neighbors per segment.
 * @param {number} [minScore=0.5] - Minimum compatibility threshold.
 * @returns {Map<string, Array<{segment: Object, score: number, type: string}>>} Graph.
 */
export const buildSegmentGraph = (segments, topN = 5, minScore = 0.5) => {
  const graph = new Map();

  for (let i = 0; i < segments.length; i++) {
    const segA = segments[i];
    const edges = [];

    for (let j = 0; j < segments.length; j++) {
      if (i === j) continue;

      const segB = segments[j];
      const compat = computeSegmentCompatibility(segA, segB);

      if (compat.score >= minScore) {
        edges.push({
          segment: segB,
          score: compat.score,
          type: compat.type,
          details: compat.details,
        });
      }
    }

    // Sort by score descending and keep top N
    edges.sort((a, b) => b.score - a.score);
    graph.set(segA.id, edges.slice(0, topN));
  }

  return graph;
};

/**
 * Find the best transition path between two segments using A* search.
 * Useful for finding a bridge between distant musical territories.
 *
 * @param {string} startId
 * @param {string} goalId
 * @param {Map} graph
 * @param {Array<Object>} segments
 * @returns {Array<Object>|null} Path of segments or null if no path.
 */
export const findTransitionPath = (startId, goalId, graph, segments) => {
  if (startId === goalId) return [segments.find(s => s.id === startId)];

  const openSet = new Set([startId]);
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  gScore.set(startId, 0);
  fScore.set(startId, 1); // Heuristic: max possible score

  while (openSet.size > 0) {
    // Get node with lowest fScore
    let current = null;
    let minF = Infinity;
    for (const node of openSet) {
      if (fScore.get(node) < minF) {
        minF = fScore.get(node);
        current = node;
      }
    }

    if (current === goalId) {
      return reconstructPath(cameFrom, current, segments);
    }

    openSet.delete(current);
    const neighbors = graph.get(current) || [];

    for (const neighbor of neighbors) {
      const tentativeG = gScore.get(current) + (1 - neighbor.score); // Lower is better

      if (tentativeG < (gScore.get(neighbor.segment.id) || Infinity)) {
        cameFrom.set(neighbor.segment.id, current);
        gScore.set(neighbor.segment.id, tentativeG);
        fScore.set(neighbor.segment.id, tentativeG + (1 - neighbor.score));
        openSet.add(neighbor.segment.id);
      }
    }
  }

  return null; // No path found
};

const reconstructPath = (cameFrom, current, segments) => {
  const path = [segments.find(s => s.id === current)];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    path.unshift(segments.find(s => s.id === current));
  }
  return path;
};

/**
 * Find segments that can act as "stems" for swap mixing.
 * E.g., find a drum-heavy segment from Track A and a melodic segment
 * from Track B that are temporally compatible.
 *
 * @param {Object} baseSegment - The segment to swap stems into.
 * @param {Array<Object>} pool - All available segments.
 * @param {string} targetStem - 'D', 'B', 'V', or 'M'.
 * @returns {Array<Object>} Compatible donor segments.
 */
export const findStemSwapCandidates = (baseSegment, pool, targetStem) => {
  const stemCriteria = {
    D: (f) => f.isPercussive && f.avgEnergy > 0.4,
    B: (f) => f.spectralRolloff < 0.3 && !f.isPercussive,
    V: (f) => f.isVocalHeavy,
    M: (f) => f.spectralRolloff > 0.4 && !f.isVocalHeavy,
  };

  const criteria = stemCriteria[targetStem] || stemCriteria.M;

  return pool
    .filter(seg => seg.trackId !== baseSegment.trackId) // Different track
    .filter(seg => criteria(seg.features))
    .map(seg => ({
      segment: seg,
      compat: computeSegmentCompatibility(baseSegment, seg, {
        energy: 0.15,
        timbre: 0.15,
        tempo: 0.35,
        key: 0.25,
        dynamics: 0.05,
        vocalDensity: 0.05,
      }),
    }))
    .filter(result => result.compat.score > 0.5)
    .sort((a, b) => b.compat.score - a.compat.score)
    .slice(0, 5);
};

