import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * @fileoverview useAutoMix Hook
 * Manages Auto-DJ intelligence: transition graph building, compatibility scoring,
 * and queue management. It does NOT own an audio engine; instead it receives
 * engine controls from the parent (useAudioEngine) to execute transitions.
 *
 * This prevents the duplicate AudioContext bug that existed when useAutoMix
 * previously called useAudioEngine() internally.
 */

// Simplified Camelot Wheel for harmonic mixing
const camelotWheel = {
  '1A':  { compatible: ['1A', '2A', '12A', '1B', '2B', '12B'] },
  '2A':  { compatible: ['2A', '3A', '1A', '2B', '3B', '1B'] },
  '3A':  { compatible: ['3A', '4A', '2A', '3B', '4B', '2B'] },
  '4A':  { compatible: ['4A', '5A', '3A', '4B', '5B', '3B'] },
  '5A':  { compatible: ['5A', '6A', '4A', '5B', '6B', '4B'] },
  '6A':  { compatible: ['6A', '7A', '5A', '6B', '7B', '5B'] },
  '7A':  { compatible: ['7A', '8A', '6A', '7B', '8B', '6B'] },
  '8A':  { compatible: ['8A', '9A', '7A', '8B', '9B', '7B'] },
  '9A':  { compatible: ['9A', '10A', '8A', '9B', '10B', '8B'] },
  '10A': { compatible: ['10A', '11A', '9A', '10B', '11B', '9B'] },
  '11A': { compatible: ['11A', '12A', '10A', '11B', '12B', '10B'] },
  '12A': { compatible: ['12A', '1A', '11A', '12B', '1B', '11B'] },
  '1B':  { compatible: ['1B', '2B', '12B', '1A', '2A', '12A'] },
  '2B':  { compatible: ['2B', '3B', '1B', '2A', '3A', '1A'] },
  '3B':  { compatible: ['3B', '4B', '2B', '3A', '4A', '2A'] },
  '4B':  { compatible: ['4B', '5B', '3B', '4A', '5A', '3A'] },
  '5B':  { compatible: ['5B', '6B', '4B', '5A', '6A', '4A'] },
  '6B':  { compatible: ['6B', '7B', '5B', '6A', '7A', '5A'] },
  '7B':  { compatible: ['7B', '8B', '6B', '7A', '8A', '6A'] },
  '8B':  { compatible: ['8B', '9B', '7B', '8A', '9A', '7A'] },
  '9B':  { compatible: ['9B', '10B', '8B', '9A', '10A', '8A'] },
  '10B': { compatible: ['10B', '11B', '9B', '10A', '11A', '9A'] },
  '11B': { compatible: ['11B', '12B', '10B', '11A', '12A', '10A'] },
  '12B': { compatible: ['12B', '1B', '11B', '12A', '1A', '11A'] },
};

/**
 * Calculate a compatibility score between two tracks for harmonic mixing.
 * @param {Object} trackA
 * @param {Object} trackB
 * @returns {number} Score 0-100.
 */
const calculateCompatibility = (trackA, trackB) => {
  if (!trackA || !trackB) return 0;

  let score = 0;
  const keyA = trackA.key;
  const keyB = trackB.key;

  // Camelot key match (up to 40 points)
  if (camelotWheel[keyA]?.compatible.includes(keyB)) {
    score += 40;
  }

  // BPM proximity (up to 30 points)
  const bpmDiff = Math.abs((trackA.bpm || 0) - (trackB.bpm || 0));
  score += Math.max(0, 30 - bpmDiff * 2);

  // Energy curve match: compare end of A vs start of B (up to 20 points)
  const endEnergyA = trackA.energyCurve?.slice(-10).reduce((a, b) => a + b, 0) / 10 || 0.5;
  const startEnergyB = trackB.energyCurve?.slice(0, 10).reduce((a, b) => a + b, 0) / 10 || 0.5;
  const energyMatch = Math.abs(endEnergyA - startEnergyB);
  score += Math.max(0, 20 - energyMatch * 10);

  // Lyrics density: avoid overlapping dense vocals (up to 10 points)
  const endLyricsA = trackA.lyricsDensity?.slice(-5).reduce((a, b) => a + b, 0) / 5 || 0.5;
  const startLyricsB = trackB.lyricsDensity?.slice(0, 5).reduce((a, b) => a + b, 0) / 5 || 0.5;
  const lyricsDiff = Math.abs(endLyricsA - startLyricsB);
  score += Math.max(0, 10 - lyricsDiff * 5);

  return Math.min(100, Math.round(score));
};

/**
 * @param {Array} playlist - Array of track objects.
 * @param {Object} engineAPI - Audio engine controls from useAudioEngine.
 *   Required methods: playPause, setCrossfader, setDeckBPM, switchActiveDeck, getDeckState
 * @param {Function} addLog - Logging callback.
 */
export const useAutoMix = (playlist, engineAPI, addLog) => {
  const [queue, setQueue] = useState([]);
  const [currentTransition, setCurrentTransition] = useState(null);
  const [autoMode, setAutoMode] = useState(false);
  const [transitionMs, setTransitionMs] = useState(8000); // 8 seconds default crossfade
  const [activeDeck, setActiveDeck] = useState('A');

  const transitionTimerRef = useRef(null);

  const {
    playPause,
    setCrossfader,
    setDeckBPM,
    switchActiveDeck,
    getDeckState,
  } = engineAPI || {};

  /**
   * Build a transition graph mapping each track to its top compatible neighbors.
   * @returns {Object} Graph: { [trackId]: Array<{track, score, bpmAdjust}> }
   */
  const buildTransitionGraph = useCallback(() => {
    const graph = {};
    playlist.forEach((trackA) => {
      graph[trackA.id] = playlist
        .filter((t) => t.id !== trackA.id)
        .map((trackB) => ({
          track: trackB,
          score: calculateCompatibility(trackA, trackB),
          bpmAdjust: (trackB.bpm || 128) - (trackA.bpm || 128),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3); // Top 3 candidates
    });
    return graph;
  }, [playlist]);

  /**
   * Select the best next track from the graph and set up the transition state.
   * @param {number|string} currentId - ID of the currently playing track.
   */
  const nextTrack = useCallback(
    (currentId) => {
      const graph = buildTransitionGraph();
      const candidates = graph[currentId] || [];
      const best = candidates[0];

      if (best) {
        setCurrentTransition({
          fromId: currentId,
          toTrack: best.track,
          score: best.score,
          bpmAdjust: best.bpmAdjust,
        });
        setQueue((prev) => [...prev.slice(1), best.track]);
        addLog(
          `AutoMix: queued ${best.track.name} (compat: ${best.score}%)`,
          'ai'
        );
      } else {
        addLog('AutoMix: no compatible tracks found', 'warning');
      }
    },
    [buildTransitionGraph, addLog]
  );

  /**
   * Execute the transition: crossfade from current deck to the other deck,
   * optionally warp BPM, and swap the active deck.
   */
  const executeTransition = useCallback(() => {
    if (!currentTransition || !playPause || !setCrossfader) return;

    const nextDeck = activeDeck === 'A' ? 'B' : 'A';
    const fromDeck = activeDeck;

    addLog(
      `Transition: Deck ${fromDeck} -> Deck ${nextDeck} | ${currentTransition.toTrack.name}`,
      'ai'
    );

    // Start the incoming deck (assumes track is already loaded there)
    switchActiveDeck(nextDeck);
    playPause(true);
    setActiveDeck(nextDeck);

    // BPM warp the incoming deck to match outgoing deck's current BPM
    const fromState = getDeckState ? getDeckState(fromDeck) : {};
    const targetBPM = fromState.bpm || currentTransition.toTrack.bpm || 128;
    if (setDeckBPM) {
      setDeckBPM(targetBPM);
    }

    // Animate crossfader over transition duration
    const steps = 20;
    const stepTime = transitionMs / steps;
    const fromPos = fromDeck === 'A' ? -1 : 1; // Full current deck
    const toPos = nextDeck === 'A' ? -1 : 1;   // Full next deck

    let step = 0;
    const interval = setInterval(() => {
      step++;
      const t = step / steps; // 0 -> 1
      // Smooth sigmoid-like curve for natural crossfade feel
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const currentPos = fromPos + (toPos - fromPos) * ease;
      setCrossfader(currentPos);

      if (step >= steps) {
        clearInterval(interval);
        // Stop the outgoing deck after fade completes
        if (playPause) {
          // We pass false to pause the old deck (UI will need to track both)
          // In a full implementation, we'd call pause on the specific deck.
        }
        addLog('Transition complete', 'system');
      }
    }, stepTime);

    // Queue the next track after transition
    transitionTimerRef.current = setTimeout(() => {
      nextTrack(currentTransition.toTrack.id);
    }, transitionMs + 2000);
  }, [
    currentTransition,
    activeDeck,
    transitionMs,
    playPause,
    setCrossfader,
    setDeckBPM,
    switchActiveDeck,
    getDeckState,
    nextTrack,
    addLog,
  ]);

  /**
   * Auto-trigger transitions when autoMode is active and a transition is queued.
   */
  useEffect(() => {
    if (autoMode && currentTransition) {
      executeTransition();
    }
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, [autoMode, currentTransition, executeTransition]);

  /**
   * Compatibility score between the first two tracks in the playlist.
   * Used for UI display.
   */
  const compatibilityScore =
    playlist.length >= 2
      ? calculateCompatibility(playlist[0], playlist[1])
      : 0;

  return {
    queue,
    autoMode,
    setAutoMode,
    currentTransition,
    nextTrack,
    transitionMs,
    setTransitionMs,
    activeDeck,
    setActiveDeck,
    compatibilityScore,
    buildTransitionGraph,
  };
};

export default useAutoMix;

