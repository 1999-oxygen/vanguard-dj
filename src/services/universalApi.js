/**
 * @fileoverview Vanguard Universal/Computational Grade API Client
 * Bridges the React frontend to the Python Universal Core backend.
 */

const API_BASE_URL = import.meta.env.VITE_VANGUARD_API_URL || '';

const forceSecureForHttpsPage = () => {
  if (typeof window === 'undefined') return API_BASE_URL;
  try {
    const loc = window.location;
    if (loc.protocol === 'https:' && API_BASE_URL.startsWith('http://')) {
      return API_BASE_URL.replace(/^http:/, 'https:');
    }
  } catch {
    // ignore
  }
  return API_BASE_URL;
};

const getApiBaseUrl = () => forceSecureForHttpsPage();

/**
 * Run Universal/Computational Grade analysis on an audio file.
 * This runs the Deep Musicology Core with zero-crossing slicing
 * and stores atoms in the Quantum Database.
 * @param {File} file - Audio file from input/drop.
 * @returns {Promise<{success: boolean, track_id: string}|null>}
 */
export const universalAnalyze = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for heavy ML

    const response = await fetch(`${API_BASE_URL}/universal/analyze`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('[UniversalAPI] Analysis request timed out');
    } else {
      console.warn('[UniversalAPI] Backend unreachable:', error.message);
    }
    return null;
  }
};

/**
 * Query the Quantum Database for fusion-ready atoms.
 * @param {Object} params - Query parameters.
 * @param {number} [params.min_energy=0.0] - Minimum RMS energy (0-1).
 * @param {number} [params.max_energy=1.0] - Maximum RMS energy (0-1).
 * @param {number} [params.min_danceability=0.0] - Minimum danceability (0-1).
 * @param {boolean} [params.require_vocals=false] - Require lyric density > 0.5.
 * @param {string} [params.derivation='BEAT_GRID_4BAR'] - Derivation type filter.
 * @param {number} [params.limit=10] - Max results.
 * @returns {Promise<{success: boolean, atoms: Array, count: number}|null>}
 */
export const fusionQuery = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.min_energy !== undefined) query.set('min_energy', params.min_energy);
  if (params.max_energy !== undefined) query.set('max_energy', params.max_energy);
  if (params.min_danceability !== undefined) query.set('min_danceability', params.min_danceability);
  if (params.require_vocals !== undefined) query.set('require_vocals', params.require_vocals);
  if (params.derivation) query.set('derivation', params.derivation);
  if (params.limit !== undefined) query.set('limit', params.limit);

  try {
    const response = await fetch(`${API_BASE_URL}/fusion/query?${query.toString()}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('[UniversalAPI] Fusion query failed:', error.message);
    return null;
  }
};
