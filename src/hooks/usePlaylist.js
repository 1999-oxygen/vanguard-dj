import { useState, useEffect, useCallback } from 'react';
import { AudioContextManager } from '../audio/index.js';

const STORAGE_KEY = 'vanguard-playlist';

/**
 * @fileoverview usePlaylist Hook
 * Manages the track library, localStorage persistence, and track import.
 */
export const usePlaylist = () => {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);

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
   * Add a track with pre-computed metadata (from upstream analysis).
   * This is the primary path for local files that were already analyzed.
   * @param {Object} trackData - Pre-computed track metadata object.
   */
  const addTrack = useCallback((trackData) => {
    if (!trackData || !trackData.id) {
      console.error('[usePlaylist] Invalid track data');
      return;
    }
    const updated = [...tracks, trackData];
    saveTracks(updated);
  }, [tracks, saveTracks]);

  /**
   * Add a raw file with optional metadata. If no metadata provided,
   * creates a basic entry with filename.
   * @param {File} file - Audio file.
   * @param {Object} [metadata={}] - Optional pre-computed metadata.
   */
  const addFile = useCallback(async (file, metadata = {}) => {
    setLoading(true);
    try {
      const trackData = {
        id: metadata.id || Date.now() + Math.random(),
        name: metadata.name || file.name,
        artist: metadata.artist || 'Unknown',
        duration: metadata.duration || 0,
        bpm: metadata.bpm || 128,
        key: metadata.key || 'Unknown',
        mood: metadata.mood || 'Unknown',
        source: metadata.source || 'local',
        hasAnalysis: metadata.hasAnalysis || false,
        uploadedAt: new Date().toISOString(),
        file: URL.createObjectURL(file),
        ...metadata,
      };
      const updated = [...tracks, trackData];
      saveTracks(updated);
      return trackData;
    } catch (error) {
      console.error('[usePlaylist] Add file failed:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [tracks, saveTracks]);

  const removeTrack = useCallback((id) => {
    const victim = tracks.find((t) => t.id === id);
    if (victim?.file && String(victim.file).startsWith('blob:')) {
      try {
        URL.revokeObjectURL(victim.file);
      } catch { /* ignore */ }
    }
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
    addFile,
    removeTrack,
    updateTrack,
    searchTracks,
  };
};

export default usePlaylist;

