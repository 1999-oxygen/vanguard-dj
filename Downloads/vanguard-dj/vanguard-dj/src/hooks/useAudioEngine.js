import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/index.js';

/**
 * @fileoverview useAudioEngine Hook
 * React hook interface for the modular AudioEngine.
 * Manages the singleton engine lifecycle, dual-deck state,
 * and exposes a clean API for components.
 *
 * Architecture:
 *   - Single AudioEngine instance persisted across renders via ref.
 *   - UI state (isPlaying, progress, levels) synced via React state.
 *   - Stem controls target the "active" deck for single-deck UI mode.
 */

export const useAudioEngine = (addLog) => {
  // --- Engine Ref ---
  // The AudioEngine is a heavy class; we persist it in a ref
  // so it survives React re-renders without reconstruction.
  const engineRef = useRef(null);

  // --- UI State ---
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentTrackAudio, setCurrentTrackAudio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeDeck, setActiveDeck] = useState('A');
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [masterLevel, setMasterLevel] = useState(0);

  // --- Internal Refs ---
  const progressIntervalRef = useRef(null);
  const fileBufferRef = useRef(null);

  /**
   * Lazy-initialize the AudioEngine.
   * Must be triggered by a user gesture (click/touch) due to browser autoplay policies.
   */
  const initEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new AudioEngine(addLog);
    }
    if (!isInitialized) {
      engineRef.current.init();
      setIsInitialized(true);

      // Start progress polling loop (30fps)
      progressIntervalRef.current = setInterval(() => {
        const engine = engineRef.current;
        if (!engine || !engine.isInitialized) return;

        const deckState = engine.getDeckState(engine.getActiveDeck());
        setPlaybackProgress(deckState.progress || 0);
        setMasterLevel(engine.getAverageLevel() || 0);
        setIsPlaying(deckState.isPlaying || false);
      }, 33);
    }
  }, [addLog, isInitialized]);

  /**
   * Load a File object into the active deck.
   * Decodes the ArrayBuffer and passes metadata to the engine.
   *
   * @param {Event} e - File input change event.
   */
  const uploadTrack = useCallback(
    async (e) => {
      const engine = engineRef.current;
      if (!engine) return;

      const file = e.target.files?.[0];
      if (!file) return;

      // Ensure context is running before decode
      await engine.resume();

      try {
        const audioBuffer = await engine.loadFileToDeck(activeDeck, file, {
          name: file.name,
        });
        fileBufferRef.current = audioBuffer;
        setCurrentTrackAudio(file);
        addLog(`Loaded: ${file.name} | ${audioBuffer.duration.toFixed(1)}s`, 'system');
      } catch (error) {
        addLog(`Load error: ${error.message}`, 'error');
      }
    },
    [activeDeck, addLog]
  );

  /**
   * Toggle play/pause on the active deck.
   * Backward-compatible with the old isLive boolean pattern.
   *
   * @param {boolean} shouldPlay - True to play, false to pause.
   */
  const playPause = useCallback(
    (shouldPlay) => {
      const engine = engineRef.current;
      if (!engine || !engine.isInitialized) return;

      if (shouldPlay) {
        engine.playDeck(activeDeck);
        setIsPlaying(true);
        addLog('Master playback engaged', 'system');
      } else {
        engine.pauseDeck(activeDeck);
        setIsPlaying(false);
        addLog('Playback suspended', 'system');
      }
    },
    [activeDeck, addLog]
  );

  /**
   * Set the gain level for a stem on the active deck.
   * Maps UI percentage (0-100) to linear gain (0.0-1.0).
   *
   * @param {string} stem - Stem key: 'D', 'B', 'V', 'M'.
   * @param {number} level - 0 to 100.
   */
  const setStemLevel = useCallback(
    (stem, level) => {
      const engine = engineRef.current;
      if (!engine || !engine.isInitialized) return;
      engine.setDeckStemLevel(activeDeck, stem, level);
    },
    [activeDeck]
  );

  /**
   * Switch which deck is the "active" deck for single-deck UI controls.
   * @param {'A'|'B'} deckId
   */
  const switchActiveDeck = useCallback((deckId) => {
    const engine = engineRef.current;
    if (engine) {
      engine._activeDeck = deckId; // Internal switch
    }
    setActiveDeck(deckId);
  }, []);

  /**
   * Set the crossfader position between Deck A and Deck B.
   * @param {number} position - -1.0 (full A) to +1.0 (full B).
   */
  const setCrossfader = useCallback((position) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setCrossfader(position);
    }
  }, []);

  /**
   * Set the master output gain.
   * @param {number} level - 0.0 to 1.0.
   */
  const setMasterGain = useCallback((level) => {
    const engine = engineRef.current;
    if (engine) {
      engine.setMasterGain(level);
    }
  }, []);

  /**
   * Get real-time frequency data from the master analyser.
   * Returns null if engine not ready.
   * @returns {Uint8Array|null}
   */
  const getFrequencyData = useCallback(() => {
    const engine = engineRef.current;
    return engine ? engine.getFrequencyData() : null;
  }, []);

  /**
   * Get real-time waveform data from the master analyser.
   * @returns {Uint8Array|null}
   */
  const getTimeData = useCallback(() => {
    const engine = engineRef.current;
    return engine ? engine.getTimeData() : null;
  }, []);

  /**
   * Get the current state of a specific deck.
   * @param {'A'|'B'} deckId
   * @returns {Object}
   */
  const getDeckState = useCallback((deckId) => {
    const engine = engineRef.current;
    return engine ? engine.getDeckState(deckId) : {};
  }, []);

  /**
   * Seek to a time position in the active deck.
   * @param {number} time - Seconds.
   */
  const seek = useCallback(
    (time) => {
      const engine = engineRef.current;
      if (engine) {
        engine.seekDeck(activeDeck, time);
      }
    },
    [activeDeck]
  );

  /**
   * Set the BPM for the active deck (time-stretch to target).
   * @param {number} bpm
   */
  const setDeckBPM = useCallback(
    (bpm) => {
      const engine = engineRef.current;
      if (engine) {
        engine.setDeckBPM(activeDeck, bpm);
      }
    },
    [activeDeck]
  );

  // --- Lifecycle ---

  /**
   * Auto-init on first user click anywhere in the document.
   * Browsers block AudioContext until a user gesture occurs.
   */
  useEffect(() => {
    const handleInteraction = () => initEngine();
    document.addEventListener('click', handleInteraction, { once: true });
    return () => document.removeEventListener('click', handleInteraction);
  }, [initEngine]);

  /**
   * Cleanup on unmount: stop polling, destroy engine.
   */
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  return {
    // Core state
    isInitialized,
    currentTrackAudio,
    isPlaying,
    activeDeck,
    playbackProgress,
    masterLevel,

    // Playback controls
    playPause,
    seek,
    uploadTrack,
    initEngine,

    // Mixing controls
    setStemLevel,
    setCrossfader,
    setMasterGain,
    setDeckBPM,
    switchActiveDeck,

    // Visualization
    getFrequencyData,
    getTimeData,
    getDeckState,
  };
};

