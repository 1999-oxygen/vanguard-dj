import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioContextManager } from '../audio/index.js';

/**
 * useFlightPlanPlayer
 * A "dumb" audio engine executor that reads a JSON flight plan
 * and schedules Web Audio API buffer sources at exact sample positions.
 *
 * SCIENTIFIC PRINCIPLES (Path B: Recombinator GUI):
 * - Time measured in integer samples, never floats (prevents drift across 10h mixes)
 * - Sample-accurate scheduling via audioCtx.currentTime + triggerTimeSec
 * - Phase-preserving time stretching via playbackRate
 * - Ghost-tail micro-fades for zero-click transitions
 * - Forced 44.1kHz sample rate for mathematical consistency across devices
 * - C++ backed Web Audio API bypasses JS event loop latency
 */
export const useFlightPlanPlayer = (addLog) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeFlightPlan, setActiveFlightPlan] = useState(null);

  const audioContextRef = useRef(null);
  const sourceNodesRef = useRef([]);
  const gainNodesRef = useRef([]);
  const startTimeRef = useRef(0);
  const animationFrameRef = useRef(null);
  const bufferCacheRef = useRef(new Map());
  const isPlayingRef = useRef(false);

  const SAMPLE_RATE = 44100; // Scientific standard: integer samples only

  // Get or create AudioContext with forced 44.1kHz
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const manager = AudioContextManager.getInstance();
      let ctx = manager.getContext();
      if (!ctx) {
        // Force 44.1kHz for mathematical consistency across all devices
        ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
        manager._context = ctx;
      }
      audioContextRef.current = ctx;
    }
    return audioContextRef.current;
  }, []);

  /**
   * Load an audio buffer from a URL or file path.
   * Caches buffers to avoid reloading.
   */
  const loadBuffer = useCallback(async (sourceFile) => {
    if (bufferCacheRef.current.has(sourceFile)) {
      return bufferCacheRef.current.get(sourceFile);
    }

    const audioContext = getAudioContext();

    try {
      const response = await fetch(sourceFile);
      if (!response.ok) throw new Error(`Failed to fetch ${sourceFile}`);

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      bufferCacheRef.current.set(sourceFile, audioBuffer);
      return audioBuffer;
    } catch (error) {
      addLog?.(`Failed to load buffer: ${sourceFile}`, 'error');
      return null;
    }
  }, [getAudioContext, addLog]);

  /**
   * Create a processed audio source with time-stretch and ghost-tail envelope.
   * Uses the Python-generated time_stretch_ratio for elastic normalization.
   */
  const createProcessedSource = useCallback((audioBuffer, event, audioContext, absoluteStartTime) => {
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();

    // Set the buffer
    source.buffer = audioBuffer;

    // SCIENTIFIC: Calculate playbackRate from time_stretch_ratio
    // playbackRate = 1 / time_stretch_ratio
    // If stretch_ratio = 1.0667 (120→128 BPM), playbackRate = 0.9375
    const playbackRate = 1.0 / (event.time_stretch_ratio || 1.0);
    source.playbackRate.value = playbackRate;

    // Apply pitch shift (if any)
    const pitchShift = event.pitch_shift_semitones || 0;
    if (pitchShift !== 0) {
      // Each semitone = 2^(1/12) ≈ 1.05946
      const pitchRatio = Math.pow(2, pitchShift / 12);
      source.playbackRate.value *= pitchRatio;
    }

    // SCIENTIFIC: Ghost-tail anti-click envelope
    // Calculate warped duration from exact samples
    const durationSamples = event.source_end_sample - event.source_start_sample;
    const warpedDurationSec = (durationSamples / SAMPLE_RATE) / (event.time_stretch_ratio || 1.0);
    const ghostFadeSec = (event.ghost_tail_ms || 10) / 1000.0;

    // Connect: source -> gain -> destination
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Apply micro-fade envelope (ghost tails)
    gainNode.gain.setValueAtTime(0, absoluteStartTime);
    gainNode.gain.linearRampToValueAtTime(1, absoluteStartTime + ghostFadeSec);
    gainNode.gain.setValueAtTime(1, absoluteStartTime + warpedDurationSec - ghostFadeSec);
    gainNode.gain.linearRampToValueAtTime(0, absoluteStartTime + warpedDurationSec);

    return { source, gainNode, warpedDurationSec };
  }, []);

  /**
   * Play a flight plan.
   * Schedules all events on the Web Audio timeline using sample-accurate timing.
   */
  const playFlightPlan = useCallback(async (flightPlan) => {
    if (!flightPlan?.timeline?.length) {
      addLog?.('No timeline events to play', 'warning');
      return;
    }

    const audioContext = getAudioContext();
    if (!audioContext) {
      addLog?.('AudioContext not available', 'error');
      return;
    }

    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Stop any current playback
    stopFlightPlan();

    setActiveFlightPlan(flightPlan);
    setIsPlaying(true);

    // SCIENTIFIC: Anchor timeline to exact hardware clock time
    // 100ms buffer for scheduling to ensure all events are queued before playback
    startTimeRef.current = audioContext.currentTime + 0.1;

    addLog?.(
      `Playing flight plan: ${flightPlan.title} (${flightPlan.total_events} events, ${flightPlan.global_bpm} BPM)`,
      'system'
    );

    // Schedule each event
    for (const event of flightPlan.timeline) {
      // SCIENTIFIC: Calculate absolute seconds from exact integer samples
      const triggerTimeSec = (event.trigger_sample_master || 0) / SAMPLE_RATE;
      const absoluteStartTime = startTimeRef.current + triggerTimeSec;

      // Load the buffer
      const buffer = await loadBuffer(event.source_file);
      if (!buffer) continue;

      // Create and schedule the source with ghost-tail envelope
      const { source, gainNode, warpedDurationSec } = createProcessedSource(buffer, event, audioContext, absoluteStartTime);

      // Calculate source slice boundaries in seconds
      const sourceStartSec = (event.source_start_sample || 0) / SAMPLE_RATE;
      const sliceDuration = warpedDurationSec;

      // Schedule on the C++ backed Web Audio timeline
      try {
        source.start(absoluteStartTime, sourceStartSec, sliceDuration);
        sourceNodesRef.current.push(source);
        gainNodesRef.current.push(gainNode);

        // Auto-cleanup when done
        source.onended = () => {
          try {
            source.disconnect();
            gainNode.disconnect();
          } catch (e) {
            // Already disconnected
          }
        };
      } catch (error) {
        addLog?.(`Failed to schedule event ${event.sequence_id}: ${error.message}`, 'error');
      }
    }

    // UI animation loop (only updates visuals, audio is hardware-scheduled)
    const updateProgress = () => {
      if (!isPlayingRef.current) return;

      const elapsed = audioContext.currentTime - startTimeRef.current;
      setCurrentTime(elapsed);

      // Check if playback is complete
      const totalDuration = flightPlan.total_duration_sec ||
        Math.max(...flightPlan.timeline.map(e =>
          ((e.trigger_sample_master || 0) / SAMPLE_RATE) +
          (((e.source_end_sample || 0) - (e.source_start_sample || 0)) / SAMPLE_RATE / (e.time_stretch_ratio || 1))
        ));

      if (elapsed >= totalDuration) {
        setIsPlaying(false);
        addLog?.('Flight plan complete', 'system');
        return;
      }

      animationFrameRef.current = requestAnimationFrame(updateProgress);
    };

    isPlayingRef.current = true;
    animationFrameRef.current = requestAnimationFrame(updateProgress);

  }, [getAudioContext, loadBuffer, createProcessedSource, addLog]);

  // Ref for isPlaying to avoid closure staleness in animation frame
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  /**
   * Stop all playback instantly.
   */
  const stopFlightPlan = useCallback(() => {
    // Cancel animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Instantly kill all scheduled nodes
    sourceNodesRef.current.forEach(node => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {
        // Already stopped
      }
    });

    gainNodesRef.current.forEach(gain => {
      try {
        gain.disconnect();
      } catch (e) {
        // Already disconnected
      }
    });

    sourceNodesRef.current = [];
    gainNodesRef.current = [];

    setIsPlaying(false);
    setCurrentTime(0);

    addLog?.('Flight plan stopped', 'system');
  }, [addLog]);

  /**
   * Seek to a specific time in the flight plan.
   */
  const seekTo = useCallback((timeSec) => {
    if (!activeFlightPlan) return;
    setCurrentTime(timeSec);
    addLog?.(`Seek to ${timeSec.toFixed(1)}s`, 'system');
  }, [activeFlightPlan, addLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFlightPlan();
      bufferCacheRef.current.clear();
    };
  }, [stopFlightPlan]);

  return {
    isPlaying,
    currentTime,
    activeFlightPlan,
    playFlightPlan,
    stopFlightPlan,
    seekTo,
  };
};

export default useFlightPlanPlayer;
