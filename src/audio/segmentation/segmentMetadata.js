/**
 * Shared segment metadata / paradigm helpers for storage, filtering, and dedup.
 */

export const SEGMENT_SCHEMA_VERSION = 2;

/**
 * FNV-1a style 32-bit hash to hex (fast, dependency-free).
 * @param {string} str
 */
export const hashString = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `h_${(h >>> 0).toString(16)}`;
};

export const computeContentHash = (trackId, startSec, endSec) => {
  const s = `${trackId}|${Number(startSec).toFixed(4)}|${Number(endSec).toFixed(4)}`;
  return hashString(s);
};

const bpmBand = (bpm) => {
  const n = Number(bpm) || 0;
  if (n < 110) return 'slow';
  if (n < 124) return 'groove';
  if (n < 132) return 'peak';
  return 'fast';
};

const energyTier = (avg) => {
  const e = Number(avg);
  if (Number.isNaN(e)) return 'mid';
  if (e < 0.35) return 'low';
  if (e < 0.65) return 'mid';
  return 'high';
};

/**
 * Paradigm key groups segments for Studio filters (IndexedDB index + UI).
 */
export const buildParadigmKey = (segment, trackMeta = {}) => {
  const f = segment.features || {};
  const bpm = f.bpm || trackMeta.bpm || 0;
  const mood = (trackMeta.mood || 'unknown').split('/')[0].trim().toLowerCase().replace(/\s+/g, '_');
  const band = bpmBand(bpm);
  const ener = energyTier(f.avgEnergy);
  const type = segment.segmentSource || 'chop';
  return `${band}|${ener}|${type}|${mood}`;
};

export const inferLabels = (segment, trackMeta = {}) => {
  const f = segment.features || {};
  const labels = new Set();
  labels.add(bpmBand(f.bpm || trackMeta.bpm || 128));
  labels.add(`energy_${energyTier(f.avgEnergy)}`);
  if (f.isPercussive) labels.add('percussive');
  if (f.isBright) labels.add('bright');
  if (f.isVocalHeavy) labels.add('vocal');
  const mood = trackMeta.mood;
  if (mood && typeof mood === 'string') {
    mood.split('/').forEach((p) => {
      const t = p.trim();
      if (t) labels.add(`mood:${t.toLowerCase()}`);
    });
  }
  if (segment.segmentSource === 'dna') labels.add('dna_atom');
  else labels.add('chopped');
  return [...labels];
};

/**
 * Attach durable metadata before IndexedDB write.
 */
export const enrichSegmentForStorage = (segment, trackMetadata, segmentIndex, segmentSource) => {
  const start = Number(segment.start);
  const end = Number(segment.end);
  const contentHash = computeContentHash(trackMetadata.id, start, end);
  const labels = inferLabels({ ...segment, segmentSource }, trackMetadata);
  const paradigmKey = buildParadigmKey({ ...segment, segmentSource }, trackMetadata);

  return {
    ...segment,
    schemaVersion: SEGMENT_SCHEMA_VERSION,
    segmentIndex,
    sourceStartSec: start,
    sourceEndSec: end,
    sourceDurationSec: Math.max(0, end - start),
    trackTitle: trackMetadata.name,
    contentHash,
    labels,
    paradigmKey,
    segmentSource,
  };
};

/**
 * Normalize a record read from IDB so downstream code never sees null features.
 */
export const normalizeSegmentRecord = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id != null ? String(raw.id) : `orphan_${Math.random().toString(36).slice(2)}`;
  const start = Number(raw.sourceStartSec ?? raw.start ?? 0);
  const end = Number(raw.sourceEndSec ?? raw.end ?? start);

  const defaultFeatures = {
    duration: Math.max(0.01, end - start || Number(raw.duration) || 0.01),
    bpm: Number(raw.features?.bpm) || 128,
    key: raw.features?.key || 'Unknown',
    avgEnergy: 0.5,
    maxEnergy: 0.5,
    energyVariance: 0.1,
    energyStart: 0.05,
    energyEnd: 0.05,
    spectralFlux: 0.3,
    zeroCrossingRate: 0.05,
    spectralRolloff: 0.4,
    dynamicRange: 0.5,
    vocalDensity: 0.3,
    isVocalHeavy: false,
    isPercussive: true,
    isBright: false,
  };

  const mergedFeatures = {
    ...defaultFeatures,
    ...(raw.features || {}),
  };

  const trackId = raw.trackId != null ? raw.trackId : 'unknown_track';
  const trackName = raw.trackName || raw.trackTitle || 'Unknown track';

  return {
    ...raw,
    id,
    trackId,
    trackName,
    start,
    end,
    duration: Number(raw.duration) > 0 ? Number(raw.duration) : Math.max(0.01, end - start),
    features: mergedFeatures,
    schemaVersion: raw.schemaVersion || 1,
    segmentIndex: raw.segmentIndex ?? 0,
    sourceStartSec: start,
    sourceEndSec: end,
    labels: Array.isArray(raw.labels) ? raw.labels : inferLabels(raw, { mood: raw.moodHint }),
    contentHash:
      raw.contentHash ||
      computeContentHash(trackId, start, end),
    paradigmKey:
      raw.paradigmKey ||
      buildParadigmKey({ ...raw, segmentSource: raw.segmentSource || 'legacy' }, { mood: raw.moodHint, bpm: mergedFeatures.bpm }),
    segmentSource: raw.segmentSource || 'legacy',
  };
};

/**
 * Filter segments for Studio paradigms (client-side query).
 */
export const filterSegmentsByParadigm = (segments, filterId) => {
  if (!filterId || filterId === 'all') return segments;

  return segments.filter((s) => {
    const pk = (s.paradigmKey || '').split('|');
    const labels = new Set(s.labels || []);

    switch (filterId) {
      case 'bpm_slow':
        return pk[0] === 'slow';
      case 'bpm_groove':
        return pk[0] === 'groove';
      case 'bpm_peak':
        return pk[0] === 'peak';
      case 'bpm_fast':
        return pk[0] === 'fast';
      case 'energy_low':
        return pk[1] === 'low';
      case 'energy_mid':
        return pk[1] === 'mid';
      case 'energy_high':
        return pk[1] === 'high';
      case 'type_dna':
        return s.segmentSource === 'dna' || labels.has('dna_atom');
      case 'type_chop':
        return s.segmentSource === 'chop' || labels.has('chopped');
      case 'percussive':
        return labels.has('percussive');
      case 'bright':
        return labels.has('bright');
      default:
        return labels.has(filterId) || (s.paradigmKey || '').includes(filterId);
    }
  });
};
