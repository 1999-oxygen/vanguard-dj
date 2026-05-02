/**
 * @fileoverview Universal API Client
 * Bridges the React frontend to the Python FastAPI backend's
 * Universal Core, Fusion Engine, and Recombinator endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_VANGUARD_API_URL || 'https://vanguard-api-v3.onrender.com';

/**
 * Upload an audio file for universal (computational grade) analysis.
 * Returns a track_id that can be used to query atoms.
 */
export const universalAnalyze = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE_URL}/universal/analyze`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('[UniversalAPI] Universal analysis failed:', error.message);
    return null;
  }
};

/**
 * Query the Quantum Database for fusion-ready atoms.
 */
export const fusionQuery = async (params = {}) => {
  const queryParams = new URLSearchParams({
    min_energy: params.min_energy ?? 0.0,
    max_energy: params.max_energy ?? 1.0,
    min_danceability: params.min_danceability ?? 0.0,
    require_vocals: params.require_vocals ?? false,
    derivation: params.derivation ?? 'BEAT_GRID_4BAR',
    limit: params.limit ?? 10,
  });

  try {
    const response = await fetch(`${API_BASE_URL}/fusion/query?${queryParams}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('[UniversalAPI] Fusion query failed:', error.message);
    return null;
  }
};

/**
 * Send fusion elements to the Recombinator to generate a Flight Plan.
 * Calculates time-stretch ratios and pitch shifts to lock everything
 * to the master BPM/key.
 */
export const recombineAtoms = async (fusionElements, options = {}) => {
  const queryParams = new URLSearchParams({
    master_bpm: options.master_bpm ?? 124.0,
    master_key: options.master_key ?? '8A',
    output_name: options.output_name ?? 'dynamic_fusion',
  });

  try {
    const response = await fetch(`${API_BASE_URL}/recombine?${queryParams}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fusionElements),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('[UniversalAPI] Recombination failed:', error.message);
    return null;
  }
};

/**
 * Send raw segments (from frontend IndexedDB) to the Recombinator.
 * Uses the backend's segment-to-flight-plan conversion.
 */
export const recombineSegments = async (segments, options = {}) => {
  const queryParams = new URLSearchParams({
    master_bpm: options.master_bpm ?? 124.0,
    master_key: options.master_key ?? '8A',
    output_name: options.output_name ?? 'auto_mix',
  });

  try {
    const response = await fetch(`${API_BASE_URL}/recombine/segments?${queryParams}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(segments),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('[UniversalAPI] Segment recombination failed:', error.message);
    return null;
  }
};

/**
 * Retrieve a saved flight plan by its fusion ID.
 */
export const getFlightPlan = async (fusionId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/flightplan/${fusionId}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('[UniversalAPI] Flight plan retrieval failed:', error.message);
    return null;
  }
};

/**
 * Submit a flight plan for server-side audio rendering.
 */
export const renderFlightPlan = async (flightPlan) => {
  try {
    const response = await fetch(`${API_BASE_URL}/flightplan/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flightPlan),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('[UniversalAPI] Render submission failed:', error.message);
    return null;
  }
};

/**
 * QuantumMLExtractor: Full pipeline (Demucs stems + Whisper phonetics).
 * Returns stems, word-level timestamps in integer samples, and atom metrics.
 */
export const mlExtract = async (file, outputDir = 'data/processed') => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE_URL}/ml/extract?output_dir=${encodeURIComponent(outputDir)}`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(300000), // 5 min timeout for heavy ML
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('[UniversalAPI] ML extraction failed:', error.message);
    return null;
  }
};

/**
 * QuantumMLExtractor: Phonetic alignment only (Whisper word timestamps).
 * Returns word_map with start_sample / end_sample (integer samples).
 */
export const mlPhonetic = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE_URL}/ml/phonetic`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(120000), // 2 min timeout
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('[UniversalAPI] Phonetic mapping failed:', error.message);
    return null;
  }
};
