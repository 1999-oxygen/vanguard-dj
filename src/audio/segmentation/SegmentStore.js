/**
 * @fileoverview SegmentStore
 * IndexedDB-backed storage for audio segments and their metadata.
 * Manages hundreds of segments without bloating memory by storing
 * only metadata in RAM and audio buffers in IndexedDB.
 *
 * Storage Schema:
 *   - segments: { id, trackId, trackName, start, end, duration, features, bufferKey }
 *   - buffers: { key, arrayBuffer } (blobs stored separately)
 *   - mixPlans: { id, name, segments, transitions, createdAt }
 */

import { normalizeSegmentRecord, enrichSegmentForStorage } from './segmentMetadata.js';

const DB_NAME = 'VanguardSegmentDB';
export const DB_VERSION = 2;

const STORES = {
  SEGMENTS: 'segments',
  BUFFERS: 'buffers',
  MIX_PLANS: 'mixPlans',
};

let dbInstance = null;

/**
 * Open/create the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
export const openDatabase = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Segments store (metadata only)
      let segmentStore;
      if (!db.objectStoreNames.contains(STORES.SEGMENTS)) {
        segmentStore = db.createObjectStore(STORES.SEGMENTS, { keyPath: 'id' });
        segmentStore.createIndex('trackId', 'trackId', { unique: false });
        segmentStore.createIndex('bpm', 'features.bpm', { unique: false });
        segmentStore.createIndex('energy', 'features.avgEnergy', { unique: false });
        segmentStore.createIndex('paradigmKey', 'paradigmKey', { unique: false });
        segmentStore.createIndex('contentHash', 'contentHash', { unique: false });
      } else {
        segmentStore = event.target.transaction.objectStore(STORES.SEGMENTS);
        if (!segmentStore.indexNames.contains('paradigmKey')) {
          segmentStore.createIndex('paradigmKey', 'paradigmKey', { unique: false });
        }
        if (!segmentStore.indexNames.contains('contentHash')) {
          segmentStore.createIndex('contentHash', 'contentHash', { unique: false });
        }
      }

      // Buffers store (audio data as ArrayBuffers)
      if (!db.objectStoreNames.contains(STORES.BUFFERS)) {
        db.createObjectStore(STORES.BUFFERS, { keyPath: 'key' });
      }

      // Mix plans store
      if (!db.objectStoreNames.contains(STORES.MIX_PLANS)) {
        const mixStore = db.createObjectStore(STORES.MIX_PLANS, { keyPath: 'id', autoIncrement: true });
        mixStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

/**
 * Store a segment's metadata and audio buffer.
 * @param {Object} segment - Segment object with features.
 * @param {AudioBuffer} audioBuffer - The decoded audio buffer.
 * @returns {Promise<string>} The stored segment ID.
 */
export const storeSegment = async (segment, audioBuffer, trackMetadata = null, segmentIndex = 0, segmentSource = 'chop') => {
  await openDatabase();
  const bufferKey = `buf_${segment.id}`;

  // Convert AudioBuffer to a reconstructable representation for storage.
  // NOTE: We store PCM channel data + metadata (sampleRate, length, channels).
  // decodeAudioData() is for encoded audio (mp3/wav), not raw PCM.
  const storedPcm = audioBufferToStoredPcm(audioBuffer);

  // Store buffer
  await putInStore(STORES.BUFFERS, { key: bufferKey, ...storedPcm });

  const meta = trackMetadata || {
    id: segment.trackId,
    name: segment.trackName,
    bpm: segment.features?.bpm,
    key: segment.features?.key,
    mood: segment.moodHint,
  };

  const enriched = enrichSegmentForStorage(segment, meta, segmentIndex, segmentSource);

  // Store metadata (without the actual buffer to keep it lightweight)
  const metadata = {
    ...enriched,
    bufferKey,
    hasBuffer: true,
  };
  delete metadata.buffer; // Remove the AudioBuffer reference

  await putInStore(STORES.SEGMENTS, metadata);

  return segment.id;
};

/**
 * Retrieve a segment's metadata.
 * @param {string} segmentId
 * @returns {Promise<Object|null>}
 */
export const getSegment = async (segmentId) => {
  const row = await getFromStore(STORES.SEGMENTS, segmentId);
  if (!row) return null;
  try {
    return normalizeSegmentRecord(row);
  } catch {
    return null;
  }
};

/**
 * Retrieve a segment's audio buffer and reconstruct as AudioBuffer.
 * @param {string} segmentId
 * @param {AudioContext} audioContext
 * @returns {Promise<AudioBuffer|null>}
 */
export const getSegmentBuffer = async (segmentId, audioContext) => {
  const segment = await getSegment(segmentId);
  if (!segment || !segment.bufferKey) return null;

  const stored = await getFromStore(STORES.BUFFERS, segment.bufferKey);
  if (!stored || !stored.buffer) return null;

  // Reconstruct AudioBuffer from stored PCM.
  return storedPcmToAudioBuffer(stored, audioContext);
};

/**
 * Get all segment metadata (lightweight, no buffers).
 * @returns {Promise<Array<Object>>}
 */
export const getAllSegments = async () => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SEGMENTS, 'readonly');
    const store = transaction.objectStore(STORES.SEGMENTS);
    const request = store.getAll();

    request.onsuccess = () => {
      const rows = request.result || [];
      const normalized = rows
        .map((r) => {
          try {
            return normalizeSegmentRecord(r);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      resolve(normalized);
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get segments for a specific track.
 * @param {string} trackId
 * @returns {Promise<Array<Object>>}
 */
export const getSegmentsByTrack = async (trackId) => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SEGMENTS, 'readonly');
    const store = transaction.objectStore(STORES.SEGMENTS);
    const index = store.index('trackId');
    const request = index.getAll(trackId);

    request.onsuccess = () => {
      const rows = request.result || [];
      resolve(rows.map(normalizeSegmentRecord).filter(Boolean));
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Delete a segment and its buffer.
 * @param {string} segmentId
 */
export const deleteSegment = async (segmentId) => {
  const segment = await getSegment(segmentId);
  if (segment && segment.bufferKey) {
    await deleteFromStore(STORES.BUFFERS, segment.bufferKey);
  }
  await deleteFromStore(STORES.SEGMENTS, segmentId);
};

/**
 * Clear all stored segments.
 */
export const clearAllSegments = async () => {
  const db = await openDatabase();
  await clearStore(STORES.SEGMENTS);
  await clearStore(STORES.BUFFERS);
};

/**
 * Store a mix plan.
 * @param {Object} mixPlan
 * @returns {Promise<number>} Mix plan ID.
 */
export const storeMixPlan = async (mixPlan) => {
  const plan = {
    ...mixPlan,
    createdAt: new Date().toISOString(),
  };
  return putInStore(STORES.MIX_PLANS, plan);
};

/**
 * Get all stored mix plans.
 * @returns {Promise<Array<Object>>}
 */
export const getAllMixPlans = async () => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.MIX_PLANS, 'readonly');
    const store = transaction.objectStore(STORES.MIX_PLANS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// ================================================================
// Helpers
// ================================================================

const putInStore = (storeName, data) => {
  return new Promise((resolve, reject) => {
    openDatabase()
      .then(() => {
        const transaction = dbInstance.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
      .catch(reject);
  });
};

const getFromStore = (storeName, key) => {
  return new Promise((resolve, reject) => {
    openDatabase()
      .then(() => {
        const transaction = dbInstance.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      })
      .catch(reject);
  });
};

const deleteFromStore = (storeName, key) => {
  return new Promise((resolve, reject) => {
    openDatabase()
      .then(() => {
        const transaction = dbInstance.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
      .catch(reject);
  });
};

const clearStore = (storeName) => {
  return new Promise((resolve, reject) => {
    openDatabase()
      .then(() => {
        const transaction = dbInstance.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
      .catch(reject);
  });
};

/**
 * Convert AudioBuffer to a reconstructable, IndexedDB-friendly PCM payload.
 */
const audioBufferToStoredPcm = (audioBuffer) => {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const channels = Array.from({ length: numChannels }, (_, ch) => {
    // Copy to avoid retaining references to AudioBuffer-backed memory
    const data = audioBuffer.getChannelData(ch);
    const copy = new Float32Array(data.length);
    copy.set(data);
    return copy.buffer;
  });

  return {
    buffer: channels, // Array<ArrayBuffer>, one per channel
    sampleRate: audioBuffer.sampleRate,
    length,
    numberOfChannels: numChannels,
    format: 'pcm-f32-planar-v1',
  };
};

/**
 * Reconstruct an AudioBuffer from stored PCM (supports legacy interleaved payloads best-effort).
 */
const storedPcmToAudioBuffer = (stored, audioContext) => {
  const sampleRate = stored.sampleRate || audioContext.sampleRate;

  // New format: planar per-channel float32 buffers
  if (Array.isArray(stored.buffer) && stored.format === 'pcm-f32-planar-v1') {
    const numChannels = stored.numberOfChannels || stored.buffer.length || 1;
    const length = stored.length || (stored.buffer[0] ? new Float32Array(stored.buffer[0]).length : 0);
    if (!length) return null;

    const audioBuffer = audioContext.createBuffer(numChannels, length, sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      const channelFloats = new Float32Array(stored.buffer[ch]);
      audioBuffer.getChannelData(ch).set(channelFloats.subarray(0, length));
    }
    return audioBuffer;
  }

  // Legacy: a single interleaved Float32Array buffer (best-effort).
  // Older versions stored { buffer: ArrayBuffer } where data was interleaved [L,R,L,R,...]
  if (stored.buffer && stored.buffer instanceof ArrayBuffer) {
    const floats = new Float32Array(stored.buffer);
    const numChannels = stored.numberOfChannels || 2;
    const length = stored.length || Math.floor(floats.length / numChannels);
    if (!length) return null;

    const audioBuffer = audioContext.createBuffer(numChannels, length, sampleRate);
    for (let ch = 0; ch < numChannels; ch++) {
      const out = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        out[i] = floats[i * numChannels + ch] || 0;
      }
    }
    return audioBuffer;
  }

  return null;
};

