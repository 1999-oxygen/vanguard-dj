/**
 * @fileoverview useSegmentEngine Hook
 * Orchestrates the entire segment-based mixing pipeline:
 *   1. Chops uploaded tracks into intelligent segments
 *   2. Stores segments in IndexedDB
 *   3. Builds compatibility graphs
 *   4. Generates infinite mix variations
 *   5. Plays segments through the audio engine with crossfades
 *
 * This hook connects the segmentation layer to the audio engine.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioContextManager } from '../audio/index.js';
import { analyzeAndChopTrack } from '../audio/segmentation/SegmentAnalyzer.js';
import { extractBufferSlice } from '../audio/utils/buffers.js';
import { buildSegmentGraph, computeSegmentCompatibility } from '../audio/segmentation/SegmentMatcher.js';
import { generateMix, generateMixVariations, MIX_STYLES } from '../audio/segmentation/MixEngine.js';
import {
  storeSegment,
  getAllSegments,
  getSegmentBuffer,
  clearAllSegments,
  storeMixPlan,
  getAllMixPlans,
} from '../audio/segmentation/SegmentStore.js';

export const useSegmentEngine = (audioEngine, addLog) => {
  const [segments, setSegments] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0, stage: '' });
  const [mixPlans, setMixPlans] = useState([]);
  const [activeMix, setActiveMix] = useState(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);

  const segmentQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const graphRef = useRef(null);

  // Load persisted segments on mount
  useEffect(() => {
    loadPersistedSegments();
    loadPersistedMixPlans();
  }, []);

  const loadPersistedSegments = useCallback(async () => {
    try {
      const stored = await getAllSegments();
      setSegments(stored);
      if (stored.length > 0) {
        graphRef.current = buildSegmentGraph(stored, 8, 0.5);
        addLog(`Loaded ${stored.length} segments from database`, 'system');
      }
    } catch (error) {
      addLog(`Failed to load segments: ${error.message}`, 'error');
    }
  }, [addLog]);

  const loadPersistedMixPlans = useCallback(async () => {
    try {
      const plans = await getAllMixPlans();
      setMixPlans(plans);
    } catch (error) {
      console.error('Failed to load mix plans:', error);
    }
  }, []);

  /**
   * Process a track: chop into segments, extract features, store in IndexedDB.
   * @param {AudioBuffer} audioBuffer
   * @param {Object} trackMetadata
   */
  const processTrack = useCallback(async (audioBuffer, trackMetadata) => {
    const contextManager = AudioContextManager.getInstance();
    const audioContext = contextManager.getContext();

    if (!audioContext) {
      addLog('AudioContext not initialized', 'error');
      return;
    }

    setIsProcessing(true);
    setProcessProgress({ current: 0, total: 1, stage: 'analyzing' });
    addLog(`Chopping "${trackMetadata.name}" into segments...`, 'ai');

    try {
      const trackSegments = await analyzeAndChopTrack(audioBuffer, trackMetadata, audioContext);

      // Store each segment
      for (let i = 0; i < trackSegments.length; i++) {
        const seg = trackSegments[i];
        await storeSegment(seg, seg.buffer);

        setProcessProgress({
          current: i + 1,
          total: trackSegments.length,
          stage: 'storing',
        });
      }

      // Update local state
      const allSegments = await getAllSegments();
      setSegments(allSegments);

      // Rebuild graph
      graphRef.current = buildSegmentGraph(allSegments, 8, 0.5);

      addLog(
        `Created ${trackSegments.length} segments from "${trackMetadata.name}". Total pool: ${allSegments.length}`,
        'ai'
      );
    } catch (error) {
      addLog(`Segmentation failed: ${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
      setProcessProgress({ current: 0, total: 0, stage: '' });
    }
  }, [addLog]);

  /**
   * Process multiple tracks in batch.
   * @param {Array<{audioBuffer: AudioBuffer, metadata: Object}>} tracks
   */
  const processTracks = useCallback(async (tracks) => {
    setIsProcessing(true);
    setProcessProgress({ current: 0, total: tracks.length, stage: 'batch_processing' });

    for (let i = 0; i < tracks.length; i++) {
      const { audioBuffer, metadata } = tracks[i];
      await processTrack(audioBuffer, metadata);
      setProcessProgress({ current: i + 1, total: tracks.length, stage: 'batch_processing' });
    }

    setIsProcessing(false);
    addLog(`Batch processing complete. ${tracks.length} tracks segmented.`, 'ai');
  }, [processTrack, addLog]);

  /**
   * Generate a new mix plan.
   * @param {Object} options
   */
  const generateMixPlan = useCallback(async (options = {}) => {
    if (segments.length < 10) {
      addLog('Need at least 10 segments to generate a mix. Upload more tracks!', 'warning');
      return null;
    }

    addLog('Generating mix plan...', 'ai');

    const mix = generateMix(segments, {
      style: options.style || MIX_STYLES.JOURNEY,
      targetDuration: options.targetDuration || 300,
      minTransitionScore: options.minTransitionScore || 0.5,
      allowStemSwaps: options.allowStemSwaps || false,
    });

    // Save the plan
    const planId = await storeMixPlan({
      name: options.name || `Mix #${mixPlans.length + 1}`,
      style: options.style || MIX_STYLES.JOURNEY,
      segments: mix.segments.map(s => s.id),
      transitions: mix.transitions,
      totalDuration: mix.totalDuration,
    });

    const plan = { id: planId, ...mix };
    setMixPlans(prev => [...prev, plan]);

    addLog(
      `Mix "${options.name || 'New Mix'}" ready: ${mix.segments.length} segments, ${mix.totalDuration.toFixed(0)}s`,
      'ai'
    );

    return plan;
  }, [segments, mixPlans.length, addLog]);

  /**
   * Generate multiple mix variations at once.
   * @param {number} count
   * @param {Object} options
   */
  const generateVariations = useCallback(async (count = 3, options = {}) => {
    if (segments.length < 10) {
      addLog('Need more segments for mix generation', 'warning');
      return;
    }

    addLog(`Generating ${count} unique mix variations...`, 'ai');
    const variations = generateMixVariations(segments, count, options);

    const newPlans = [];
    for (let i = 0; i < variations.length; i++) {
      const mix = variations[i];
      const planId = await storeMixPlan({
        name: `${options.namePrefix || 'Variation'} ${i + 1}`,
        style: mix.style || MIX_STYLES.JOURNEY,
        segments: mix.segments.map(s => s.id),
        transitions: mix.transitions,
        totalDuration: mix.totalDuration,
      });
      newPlans.push({ id: planId, ...mix });
    }

    setMixPlans(prev => [...prev, ...newPlans]);
    addLog(`${count} mix variations generated and saved`, 'ai');
  }, [segments, addLog]);

  /**
   * Start playing a mix plan.
   * @param {Object} mixPlan
   */
  const playMix = useCallback(async (mixPlan) => {
    if (!audioEngine || !audioEngine.isInitialized) {
      addLog('Audio engine not ready', 'error');
      return;
    }

    setActiveMix(mixPlan);
    setActiveSegmentIndex(0);
    isPlayingRef.current = true;

    addLog(`Playing mix: ${mixPlan.name || 'Untitled'}`, 'system');

    // Start with first segment
    await playSegmentAtIndex(0);
  }, [audioEngine, addLog]);

  /**
   * Play a specific segment from the active mix.
   */
  const playSegmentAtIndex = useCallback(async (index) => {
    if (!activeMix || !audioEngine) return;

    const segmentId = activeMix.segments[index];
    if (!segmentId) return;

    const contextManager = AudioContextManager.getInstance();
    const audioContext = contextManager.getContext();

    try {
      // Load segment buffer from IndexedDB
      const buffer = await getSegmentBuffer(segmentId, audioContext);
      if (!buffer) {
        addLog(`Segment ${segmentId} buffer not found`, 'error');
        return;
      }

      // Load into active deck and play
      const deck = audioEngine.getActiveDeck() || 'A';
      audioEngine.loadTrackToDeck(deck, buffer, { name: `Segment ${index + 1}` });
      audioEngine.playDeck(deck);

      setActiveSegmentIndex(index);

      // Schedule next segment
      if (index < activeMix.segments.length - 1) {
        const transition = activeMix.transitions[index];
        const crossfadeTime = transition?.crossfadeDuration || 2.0;
        const segmentDuration = buffer.duration;

        // Start crossfade before segment ends
        const nextStartTime = (segmentDuration - crossfadeTime) * 1000;

        setTimeout(() => {
          if (isPlayingRef.current) {
            playSegmentAtIndex(index + 1);
          }
        }, Math.max(0, nextStartTime));
      } else {
        addLog('Mix complete', 'system');
        isPlayingRef.current = false;
      }
    } catch (error) {
      addLog(`Playback error: ${error.message}`, 'error');
    }
  }, [activeMix, audioEngine, addLog]);

  /**
   * Stop the current mix.
   */
  const stopMix = useCallback(() => {
    isPlayingRef.current = false;
    if (audioEngine) {
      audioEngine.stopDeck('A');
      audioEngine.stopDeck('B');
    }
    setActiveMix(null);
    setActiveSegmentIndex(0);
    addLog('Mix stopped', 'system');
  }, [audioEngine, addLog]);

  /**
   * Find compatible segments for a given segment (for manual exploration).
   * @param {string} segmentId
   * @param {number} [topN=5]
   */
  const findCompatibleSegments = useCallback((segmentId, topN = 5) => {
    if (!graphRef.current) return [];
    return graphRef.current.get(segmentId)?.slice(0, topN) || [];
  }, []);

  /**
   * Get mix statistics.
   */
  const getStats = useCallback(() => {
    const uniqueTracks = new Set(segments.map(s => s.trackId)).size;
    const avgEnergy = segments.length > 0
      ? segments.reduce((sum, s) => sum + (s.features?.avgEnergy || 0), 0) / segments.length
      : 0;

    return {
      totalSegments: segments.length,
      uniqueTracks,
      avgEnergy: avgEnergy.toFixed(2),
      mixPlansCount: mixPlans.length,
    };
  }, [segments, mixPlans]);

  /**
   * Process a track using a pre-computed DNA payload from the Neural Core.
   * Converts librosa-derived atoms directly into mixable segments.
   * @param {AudioBuffer} audioBuffer
   * @param {Object} trackMetadata
   * @param {Object} dna - DNA payload from VanguardAnalyzer
   */
  const processTrackWithDNA = useCallback(async (audioBuffer, trackMetadata, dna) => {
    const contextManager = AudioContextManager.getInstance();
    const audioContext = contextManager.getContext();

    if (!audioContext) {
      addLog('AudioContext not initialized', 'error');
      return;
    }

    if (!dna || !dna.atoms || dna.atoms.length === 0) {
      addLog('Invalid DNA payload, falling back to standard analysis', 'warning');
      return processTrack(audioBuffer, trackMetadata);
    }

    setIsProcessing(true);
    setProcessProgress({ current: 0, total: dna.atoms.length, stage: 'dna_atomizing' });
    addLog(`Importing ${dna.atoms.length} DNA atoms for "${trackMetadata.name}"...`, 'ai');

    try {
      const trackSegments = [];

      for (let i = 0; i < dna.atoms.length; i++) {
        const atom = dna.atoms[i];
        const start = atom.start_sec;
        const end = atom.end_sec;

        // Extract buffer slice for this atom
        const segmentBuffer = extractBufferSlice(audioBuffer, start, end, audioContext);

        // Build feature vector from atom data
        const features = {
          duration: atom.duration,
          bpm: dna.bpm || trackMetadata.bpm || 128,
          key: dna.key || trackMetadata.key || 'Unknown',
          avgEnergy: Math.min(1, atom.energy_level / 10),
          maxEnergy: Math.min(1, atom.energy_level / 10),
          energyVariance: 0.1,
          energyStart: atom.energy_level / 10,
          energyEnd: atom.energy_level / 10,
          spectralFlux: 0.3,
          zeroCrossingRate: 0.05,
          spectralRolloff: 0.4,
          dynamicRange: 0.5,
          vocalDensity: 0.3,
          isVocalHeavy: false,
          isPercussive: true,
          isBright: true,
        };

        trackSegments.push({
          id: `${trackMetadata.id || 'track'}_seg_${i}`,
          trackId: trackMetadata.id,
          trackName: trackMetadata.name,
          start,
          end,
          duration: atom.duration,
          buffer: segmentBuffer,
          features,
          stems: null,
        });

        // Store in IndexedDB
        await storeSegment(trackSegments[i], segmentBuffer);

        setProcessProgress({
          current: i + 1,
          total: dna.atoms.length,
          stage: 'storing_atoms',
        });
      }

      // Update local state
      const allSegments = await getAllSegments();
      setSegments(allSegments);

      // Rebuild graph
      graphRef.current = buildSegmentGraph(allSegments, 8, 0.5);

      addLog(
        `DNA imported: ${trackSegments.length} atoms from "${trackMetadata.name}". Total pool: ${allSegments.length}`,
        'ai'
      );
    } catch (error) {
      addLog(`DNA import failed: ${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
      setProcessProgress({ current: 0, total: 0, stage: '' });
    }
  }, [addLog, processTrack]);

  /**
   * Clear all segments and mix plans.
   */
  const clearAll = useCallback(async () => {
    await clearAllSegments();
    setSegments([]);
    setMixPlans([]);
    setActiveMix(null);
    graphRef.current = null;
    addLog('All segments and mixes cleared', 'system');
  }, [addLog]);

  return {
    // State
    segments,
    isProcessing,
    processProgress,
    mixPlans,
    activeMix,
    activeSegmentIndex,

    // Actions
    processTrack,
    processTracks,
    processTrackWithDNA,
    generateMixPlan,
    generateVariations,
    playMix,
    stopMix,
    findCompatibleSegments,
    getStats,
    clearAll,

    // Constants
    MIX_STYLES,
  };
};

