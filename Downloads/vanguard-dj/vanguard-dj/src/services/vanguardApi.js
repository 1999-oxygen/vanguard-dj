/**
 * @fileoverview Vanguard Neural Analysis Core API Client
 * Bridges the React frontend to the Python FastAPI backend.
 * Falls back to client-side JS analysis if the backend is unreachable.
 */

const API_BASE_URL = import.meta.env.VITE_VANGUARD_API_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_VANGUARD_API_KEY;

// Track active controllers for aborting requests
const activeControllers = new Map();

/**
 * Abort all active API requests to disconnect from backend.
 */
export const disconnectApi = () => {
  activeControllers.forEach((controller, key) => {
    console.log(`[VanguardAPI] Aborting request: ${key}`);
    controller.abort();
  });
  activeControllers.clear();
  console.log('[VanguardAPI] Disconnected from all backend connections');
};

/**
 * Create an abortable fetch with automatic controller tracking.
 */
const abortableFetch = async (url, options = {}, requestKey = 'default') => {
  const controller = new AbortController();
  activeControllers.set(requestKey, controller);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    activeControllers.delete(requestKey);
  }
};

/**
 * Default headers for all Vanguard API requests.
 */
const getAuthHeaders = () => {
  const headers = {};
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  return headers;
};

/**
 * Upload an audio file to the Vanguard backend for DNA analysis.
 * @param {File} file - Audio file from input/drop.
 * @returns {Promise<{success: boolean, dna: Object}|null>}
 */
export const analyzeTrack = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: getAuthHeaders(),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('[VanguardAPI] Analysis request timed out');
    } else {
      console.warn('[VanguardAPI] Backend unreachable, will fallback to client-side:', error.message);
    }
    return null;
  }
};

/**
 * Batch upload multiple audio files.
 * @param {File[]} files
 * @returns {Promise<{success: boolean, results: Array}|null>}
 */
export const analyzeBatch = async (files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  try {
    const response = await fetch(`${API_BASE_URL}/analyze_batch`, {
      method: 'POST',
      body: formData,
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('[VanguardAPI] Batch analysis failed:', error.message);
    return null;
  }
};

/**
 * Health check the backend.
 * @returns {Promise<boolean>}
 */
export const isBackendOnline = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: getAuthHeaders(),
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};
