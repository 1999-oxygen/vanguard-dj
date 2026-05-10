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

const DB_NAME = 'VanguardSegmentDB';
const DB_VERSION = 1;

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
      if (!db.objectStoreNames.contains(STORES.SEGMENTS)) {
        const segmentStore = db.createObjectStore(STORES.SEGMENTS, { keyPath: 'id' });
        segmentStore.createIndex('trackId', 'trackId', { unique: false });
        segmentStore.createIndex('bpm', 'features.bpm', { unique: false });
        segmentStore.createIndex('energy', 'features.avgEnergy', { unique: false });
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
export const storeSegment = async (segment, audioBuffer) => {
  const db = await openDatabase();
  const bufferKey = `buf_${segment.id}`;

  // Convert AudioBuffer to raw ArrayBuffer for storage
  const rawBuffer = audioBufferToArrayBuffer(audioBuffer);

  // Store buffer
  await putInStore(STORES.BUFFERS, { key: bufferKey, buffer: rawBuffer, sampleRate: audioBuffer.sampleRate });

  // Store metadata (without the actual buffer to keep it lightweight)
  const metadata = {
    ...segment,
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
  return getFromStore(STORES.SEGMENTS, segmentId);
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

  // Reconstruct AudioBuffer from stored ArrayBuffer
  return await audioContext.decodeAudioData(stored.buffer.slice(0));
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

    request.onsuccess = () => resolve(request.result);
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

    request.onsuccess = () => resolve(request.result);
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
    const transaction = dbInstance.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getFromStore = (storeName, key) => {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

const deleteFromStore = (storeName, key) => {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const clearStore = (storeName) => {
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Convert AudioBuffer to a serializable ArrayBuffer (interleaved stereo).
 * @param {AudioBuffer} audioBuffer
 * @returns {ArrayBuffer}
 */
const audioBufferToArrayBuffer = (audioBuffer) => {
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const interleaved = new Float32Array(length * numChannels);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      interleaved[i * numChannels + ch] = channelData[i];
    }
  }

  return interleaved.buffer;
};

