import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * Vanguard Web Audio Core — Ghost-Tail Live Playback Engine
 * Handles sub-millisecond playback and Ghost-Tail Anti-Click Envelopes
 *
 * @param {AudioBuffer} [audioBuffer] — Pre-decoded AudioBuffer (from upload/IndexedDB)
 * @param {string} [audioUrl] — Fallback URL to fetch audio from
 */
export const useAtomPlayer = (audioBuffer, audioUrl) => {
  const audioContextRef = useRef(null);
  const bufferRef = useRef(audioBuffer || null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeSourceRef = useRef(null);

  // Initialize the engine and load the track into memory
  useEffect(() => {
    const initEngine = async () => {
      // Reuse existing context or create new one
      if (!audioContextRef.current) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = Ctor ? new Ctor() : null;
      }

      // If we already have an AudioBuffer, use it directly
      if (audioBuffer) {
        bufferRef.current = audioBuffer;
        setIsReady(true);
        return;
      }

      // Otherwise fetch from URL
      if (audioUrl) {
        try {
          console.log("> [VANGUARD CORE] Fetching audio to RAM...");
          const response = await fetch(audioUrl);
          const arrayBuffer = await response.arrayBuffer();

          console.log("> [VANGUARD CORE] Decoding audio buffer...");
          bufferRef.current = await audioContextRef.current.decodeAudioData(arrayBuffer);

          setIsReady(true);
          console.log("> [VANGUARD CORE] Memory Matrix Ready.");
        } catch (err) {
          console.error("> [VANGUARD CORE] Load failed:", err);
        }
      }
    };

    initEngine();

    return () => {
      if (activeSourceRef.current) {
        try { activeSourceRef.current.stop(); } catch (e) { /* ignore */ }
      }
    };
  }, [audioBuffer, audioUrl]);

  /**
   * Fires an "Atom" (a specific chopped segment of the track)
   * Implements "Ghost-Tails" (Zero-Crossing Envelopes) to prevent clicking
   *
   * @param {number} startSec — Start time in seconds
   * @param {number} endSec — End time in seconds
   * @param {Object} [options={}] — Playback options
   * @param {number} [options.fadeIn=0.01] — Fade-in duration in seconds
   * @param {number} [options.fadeOut=0.01] — Fade-out duration in seconds
   * @param {number} [options.gain=1.0] — Playback volume (0-1)
   */
  const playAtom = useCallback((startSec, endSec, options = {}) => {
    if (!audioContextRef.current || !bufferRef.current) return;

    // Resume context if suspended (browser autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = bufferRef.current;

    // Create a GainNode for volume control (The Ghost-Tail Envelope)
    const gainNode = audioContextRef.current.createGain();

    // Connect routing: Source -> Gain -> Master Output
    source.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    const duration = Math.max(0.01, endSec - startSec);
    const currentTime = audioContextRef.current.currentTime;
    const fadeIn = options.fadeIn ?? 0.01; // 10ms default
    const fadeOut = options.fadeOut ?? 0.01;
    const targetGain = options.gain ?? 1.0;

    // Ghost-Tail Envelope:
    // 1. Start volume at 0
    gainNode.gain.setValueAtTime(0, currentTime);

    // 2. Micro-fade IN to full volume (prevents initial pop)
    gainNode.gain.linearRampToValueAtTime(targetGain, currentTime + fadeIn);

    // 3. Keep full volume until right before the end
    if (duration > fadeIn + fadeOut) {
      gainNode.gain.setValueAtTime(targetGain, currentTime + duration - fadeOut);
    }

    // 4. Micro-fade OUT to 0 (prevents ending click)
    gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);

    // Track active source for cleanup
    activeSourceRef.current = source;
    setIsPlaying(true);

    source.onended = () => {
      setIsPlaying(false);
      activeSourceRef.current = null;
    };

    // Fire the engine!
    source.start(currentTime, startSec, duration);
  }, []);

  /**
   * Stop any currently playing atom immediately.
   */
  const stopAtom = useCallback(() => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch (e) { /* ignore */ }
      activeSourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  /**
   * Preview a segment by its start/end times.
   * Convenience wrapper around playAtom with sensible defaults.
   */
  const previewSegment = useCallback((startSec, endSec) => {
    playAtom(startSec, endSec, { fadeIn: 0.015, fadeOut: 0.015, gain: 0.85 });
  }, [playAtom]);

  return {
    isReady,
    isPlaying,
    playAtom,
    stopAtom,
    previewSegment,
    audioContext: audioContextRef.current,
  };
};

export default useAtomPlayer;

