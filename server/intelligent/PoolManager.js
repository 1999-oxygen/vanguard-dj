/**
 * Pool Manager
 * ------------
 * Auto-derives meaningful "pools" of DJ segments from their metadata so
 * the user can mix from coherent groups without manually tagging anything.
 *
 * Pool axes:
 *   - BPM band      → "120-125bpm", "126-130bpm", … (5 BPM buckets)
 *   - Type          → "DROP", "BUILDUP", "BREAK", "CHORUS", "VERSE", "INTRO", "OUTRO"
 *   - Energy tier   → "low" (<0.4), "mid" (0.4-0.7), "high" (>0.7)
 *   - Key family    → "minor" / "major" (from camelot A/B)
 *
 * A segment belongs to several pools simultaneously (one per axis + a few
 * cross-products like "high-energy DROP @ 124-128bpm"). This makes filter
 * UIs trivial: any combination of dropdowns becomes a SQL LIKE on pool_tags.
 */

const BPM_BUCKETS = [
  [60, 90,  '60-90bpm'],
  [90, 100, '90-100bpm'],
  [100, 110, '100-110bpm'],
  [110, 120, '110-120bpm'],
  [120, 125, '120-125bpm'],
  [125, 130, '125-130bpm'],
  [130, 135, '130-135bpm'],
  [135, 140, '135-140bpm'],
  [140, 150, '140-150bpm'],
  [150, 200, '150bpm+'],
];

function bpmBucket(bpm) {
  for (const [lo, hi, label] of BPM_BUCKETS) {
    if (bpm >= lo && bpm < hi) return label;
  }
  return 'unknown-bpm';
}

function energyTier(energy) {
  if (energy >= 0.7) return 'high';
  if (energy <= 0.4) return 'low';
  return 'mid';
}

function keyFamily(camelotKey) {
  if (!camelotKey) return 'unknown-key';
  if (camelotKey.endsWith('A')) return 'minor';
  if (camelotKey.endsWith('B')) return 'major';
  return 'unknown-key';
}

/**
 * Compute the list of pool names that a given segment belongs to.
 */
export function computePoolsForSegment(segment) {
  const pools = new Set();
  const bpm = bpmBucket(segment.bpm || 120);
  const tier = energyTier(segment.energy ?? 0.5);
  const fam = keyFamily(segment.camelot_key || segment.camelotKey);
  const type = (segment.type || 'REGULAR').toUpperCase();

  // Single-axis pools
  pools.add(`bpm:${bpm}`);
  pools.add(`type:${type}`);
  pools.add(`energy:${tier}`);
  pools.add(`key:${fam}`);

  // Useful cross-products
  pools.add(`${type}@${bpm}`);
  pools.add(`${tier}-energy:${type}`);

  return Array.from(pools);
}

/**
 * Roll up a list of segments into pool definitions for UI display.
 * Returns: [{ name, count, sampleSegmentId, axis }]
 */
export function summarisePools(segments) {
  const counter = new Map();

  for (const seg of segments) {
    const tags = JSON.parse(seg.pool_tags || '[]');
    for (const tag of tags) {
      if (!counter.has(tag)) {
        counter.set(tag, { name: tag, count: 0, sampleSegmentId: seg.id });
      }
      counter.get(tag).count += 1;
    }
  }

  // Annotate axis for grouping in the UI.
  const pools = Array.from(counter.values()).map((p) => {
    let axis = 'cross';
    if (p.name.startsWith('bpm:')) axis = 'bpm';
    else if (p.name.startsWith('type:')) axis = 'type';
    else if (p.name.startsWith('energy:')) axis = 'energy';
    else if (p.name.startsWith('key:')) axis = 'key';
    return { ...p, axis };
  });

  pools.sort((a, b) => {
    if (a.axis !== b.axis) return a.axis.localeCompare(b.axis);
    return b.count - a.count;
  });

  return pools;
}

export default { computePoolsForSegment, summarisePools };
