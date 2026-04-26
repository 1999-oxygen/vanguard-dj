/**
 * @fileoverview Harmonic Utilities
 * Camelot wheel key parsing and distance calculation for harmonic mixing.
 */

const camelotKeys = [
  '1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A',
  '1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B', '10B', '11B', '12B',
];

/**
 * Parse a key string into Camelot number and mode.
 * @param {string} key - e.g., "1A", "12B"
 * @returns {{number: number, mode: string}} Parsed key.
 */
export const parseKey = (key) => {
  if (!key || typeof key !== 'string') return { number: 0, mode: 'A' };
  const match = key.match(/(\d+)([AB])/);
  if (!match) return { number: 0, mode: 'A' };
  return { number: parseInt(match[1], 10), mode: match[2] };
};

/**
 * Calculate Camelot distance between two keys.
 * 0 = same key, 1 = adjacent number same mode or same number other mode,
 * higher = less compatible.
 * @param {string} keyA
 * @param {string} keyB
 * @returns {number} Distance (0 = perfect match, higher = worse).
 */
export const camelotDistance = (keyA, keyB) => {
  const a = parseKey(keyA);
  const b = parseKey(keyB);

  if (a.number === 0 || b.number === 0) return 7; // Unknown keys = max distance

  // Same key
  if (a.number === b.number && a.mode === b.mode) return 0;

  // Same mode, adjacent numbers (wrapping 12->1)
  const numDiff = Math.min(
    Math.abs(a.number - b.number),
    12 - Math.abs(a.number - b.number)
  );

  if (a.mode === b.mode) {
    if (numDiff === 1) return 1; // Adjacent on wheel
    if (numDiff === 0) return 0; // Same
    return numDiff;
  }

  // Different mode
  if (a.number === b.number) return 2; // Same number, different mode (relative major/minor)
  if (numDiff === 1) return 3; // Adjacent + mode shift
  return numDiff + 2;
};

/**
 * Get compatible keys for a given key.
 * @param {string} key
 * @returns {Array<string>} Compatible Camelot keys.
 */
export const getCompatibleKeys = (key) => {
  const parsed = parseKey(key);
  if (parsed.number === 0) return camelotKeys;

  const compat = [];
  for (const k of camelotKeys) {
    if (camelotDistance(key, k) <= 2) {
      compat.push(k);
    }
  }
  return compat;
};

