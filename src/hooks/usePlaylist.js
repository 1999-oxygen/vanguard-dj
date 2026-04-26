import { useState, useEffect, useCallback } from 'react';
import { useTrackAnalyzer } from './useTrackAnalyzer.js';
import { AudioContextManager } from '../audio/index.js';

const STORAGE_KEY = 'vanguard-playlist';

/**
 * @fileoverview usePlaylist Hook
 * Manages the track library, localStorage persistence, and track import.
 * Supports three import paths:
 *   1. Local file → decode → real analysis
 *   2. Spotify track with previewUrl → fetch → decode → real analysis
 *   3. Spotify track without previewUrl → metadata only (mock analysis)
 */
export const usePlaylist = () => {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const { analyzeTrack } = useTrackAnalyzer();

  // Load persisted tracks on mount
  useEffect(() => {
    let saved = localStorage.getItem(STORAGE_KEY);
    let initialTracks = [];
    if (!saved) {
      initialTracks = [
        { id: 1, name: "Subterranean Vibe", artist: "Deep Technic", key: "1A", bpm: 124, mood: "Dark / Industrial", source: 'mock' },
        { id: 2, name: "Neon Horizon", artist: "Synthwave Pro", key: "3A", bpm: 126, mood: "Energetic / Bright", source: 'mock' },
        { id: 3, name: "Deep Techno 04", artist: "Unknown", key: "12B", bpm: 122, mood: "Minimal / Cold", source: 'mock' },
        { id: 4, name: "Granular Echoes", artist: "Resonance", key: "1B", bpm: 124, mood: "Ambient / Deep", source: 'mock' },
        { id: 5, name: "Cyber Pulse Drive", artist: "Retro Synth", key: "8A", bpm: 128, mood: "Futuristic / Drive", source: 'mock' },
        { id: 6, name: "Vaporwave Drift", artist: "Digital Ghosts", key: "5A", bpm: 118, mood: "Chill / Nostalgic", source: 'mock' },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialTracks));
    } else {
      try {
        initialTracks = JSON.parse(saved);
      } catch {
        initialTracks = [];
      }
    }
    setTracks(initialTracks);
  }, []);

  const saveTracks = useCallback((newTracks) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTracks));
    setTracks(newTracks);
  }, []);

  /**
   * Add a track to the library.
   * @param {File|Object} input - File for local, track object for Spotify.
   * @param {boolean} isSpotify - Whether input is a Spotify track.
   * @param {AudioBuffer} [audioBuffer] - Pre-decoded buffer from preview (optional).
   */
  const addTrack = useCallback(async (input, isSpotify = false, audioBuffer = null) => {
    setLoading(true);
    try {
      let trackData;

      if (isSpotify) {
        // If we have a decoded AudioBuffer from the preview, run real analysis
        if (audioBuffer) {
          const analysis = await analyzeTrack(audioBuffer);
          trackData = {
            id: input.id || `spotify_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: input.name,
            artist: input.artist,
            spotifyUrl: input.spotifyUrl,
            previewUrl: input.previewUrl,
            duration: input.duration,
            source: 'spotify-preview',
            hasAnalysis: true,
            ...analysis,
            uploadedAt: new Date().toISOString(),
          };
        } else {
          // No preview available: metadata-only with mock analysis
          trackData = {
            id: input.id || `spotify_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: input.name,
            artist: input.artist,
            spotifyUrl: input.spotifyUrl,
            previewUrl: input.previewUrl,
            duration: input.duration,
            bpm: input.bpm || 128 + Math.random() * 12,
            key: input.key || ['1A', '2A', '11B', '9A'][Math.floor(Math.random() * 4)],
            mood: input.mood || ['Dark', 'Bright', 'Minimal', 'Energetic'][Math.floor(Math.random() * 4)],
            source: 'spotify',
            needsLocalFile: true,
            hasAnalysis: false,
            uploadedAt: new Date().toISOString(),
          };
        }
      } else {
        // Local file: use shared AudioContext for decode
        const file = input;
        const contextManager = AudioContextManager.getInstance();
        const audioContext = contextManager.getContext() || contextManager.init();

        const arrayBuffer = await file.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const analysis = await analyzeTrack(decodedBuffer);

        if (analysis) {
          trackData = {
            id: Date.now() + Math.random(),
            name: file.name,
            duration: decodedBuffer.duration,
            ...analysis,
            uploadedAt: new Date().toISOString(),
            file: URL.createObjectURL(file),
            source: 'local',
            hasAnalysis: true,
          };
        }
      }

      if (trackData) {
        const updated = [...tracks, trackData];
        saveTracks(updated);
      }
    } catch (error) {
      console.error('[usePlaylist] Add track failed:', error);
    } finally {
      setLoading(false);
    }
  }, [tracks, saveTracks, analyzeTrack]);

  const removeTrack = useCallback((id) => {
    const filtered = tracks.filter((t) => t.id !== id);
    saveTracks(filtered);
  }, [tracks, saveTracks]);

  const updateTrack = useCallback((id, updates) => {
    const updated = tracks.map((t) => (t.id === id ? { ...t, ...updates } : t));
    saveTracks(updated);
  }, [tracks, saveTracks]);

  const searchTracks = useCallback((query) => {
    if (!query) return tracks;
    const q = query.toLowerCase();
    return tracks.filter((t) =>
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.artist && t.artist.toLowerCase().includes(q)) ||
      (t.mood && t.mood.toLowerCase().includes(q))
    );
  }, [tracks]);

  return {
    tracks,
    loading,
    addTrack,
    removeTrack,
    updateTrack,
    searchTracks,
  };
};

export default usePlaylist;

