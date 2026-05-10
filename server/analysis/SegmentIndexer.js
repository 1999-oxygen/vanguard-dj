/**
 * Advanced Segment Indexing System
 * Multi-dimensional indexing for fast segment retrieval and matching
 */

export class AdvancedSegmentIndexer {
  constructor() {
    this.indexes = {
      bpm: new Map(),           // BPM-based index
      key: new Map(),           // Key-based index
      energy: new Map(),        // Energy-based index
      type: new Map(),          // Type-based index
      duration: new Map(),      // Duration-based index
      tags: new Map(),          // Tag-based index
      features: new Map(),      // Feature similarity index
      compatibility: new Map()  // Pre-computed compatibility scores
    };
    
    this.segments = new Map(); // Master segment store
  }

  /**
   * Index a segment across all dimensions
   */
  indexSegment(segment) {
    this.segments.set(segment.id, segment);
    
    // BPM index (grouped by 5 BPM ranges)
    const bpmBucket = Math.floor((segment.musical?.bpm || 120) / 5) * 5;
    this.addToIndex(this.indexes.bpm, bpmBucket, segment.id);
    
    // Key index
    const key = segment.musical?.camelot_key || 'Unknown';
    this.addToIndex(this.indexes.key, key, segment.id);
    
    // Energy index (grouped by 0.1 ranges)
    const energyBucket = Math.floor((segment.classification?.energy || 0.5) * 10) / 10;
    this.addToIndex(this.indexes.energy, energyBucket, segment.id);
    
    // Type index
    const type = segment.classification?.type || 'REGULAR';
    this.addToIndex(this.indexes.type, type, segment.id);
    
    // Duration index (grouped by 2-second ranges)
    const durationBucket = Math.floor(segment.duration / 2) * 2;
    this.addToIndex(this.indexes.duration, durationBucket, segment.id);
    
    // Tag index (multi-valued)
    (segment.tags || []).forEach(tag => {
      this.addToIndex(this.indexes.tags, tag, segment.id);
    });
    
    // Feature similarity index (using LSH or similar)
    if (segment.features) {
      const featureHash = this.hashFeatures(segment.features);
      this.addToIndex(this.indexes.features, featureHash, segment.id);
    }
  }

  /**
   * Add segment to a specific index
   */
  addToIndex(index, key, segmentId) {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key).add(segmentId);
  }

  /**
   * Query segments by multiple criteria
   */
  query(criteria) {
    let results = new Set(this.segments.keys());
    
    // Filter by BPM range
    if (criteria.bpm) {
      const bpmResults = this.queryBPMRange(
        criteria.bpm.min || criteria.bpm - 10,
        criteria.bpm.max || criteria.bpm + 10
      );
      results = this.intersect(results, bpmResults);
    }
    
    // Filter by key compatibility
    if (criteria.key) {
      const keyResults = this.queryCompatibleKeys(criteria.key);
      results = this.intersect(results, keyResults);
    }
    
    // Filter by energy range
    if (criteria.energy) {
      const energyResults = this.queryEnergyRange(
        criteria.energy.min || criteria.energy - 0.2,
        criteria.energy.max || criteria.energy + 0.2
      );
      results = this.intersect(results, energyResults);
    }
    
    // Filter by type
    if (criteria.type) {
      const typeResults = this.indexes.type.get(criteria.type) || new Set();
      results = this.intersect(results, typeResults);
    }
    
    // Filter by duration range
    if (criteria.duration) {
      const durationResults = this.queryDurationRange(
        criteria.duration.min || criteria.duration - 4,
        criteria.duration.max || criteria.duration + 4
      );
      results = this.intersect(results, durationResults);
    }
    
    // Filter by tags (any match)
    if (criteria.tags && criteria.tags.length > 0) {
      const tagResults = this.queryTags(criteria.tags);
      results = this.intersect(results, tagResults);
    }
    
    // Get full segment objects
    return Array.from(results).map(id => this.segments.get(id)).filter(Boolean);
  }

  /**
   * Query BPM range
   */
  queryBPMRange(min, max) {
    const results = new Set();
    const minBucket = Math.floor(min / 5) * 5;
    const maxBucket = Math.floor(max / 5) * 5;
    
    for (let bpm = minBucket; bpm <= maxBucket; bpm += 5) {
      const bucket = this.indexes.bpm.get(bpm);
      if (bucket) {
        bucket.forEach(id => {
          const seg = this.segments.get(id);
          if (seg && seg.musical?.bpm >= min && seg.musical?.bpm <= max) {
            results.add(id);
          }
        });
      }
    }
    
    return results;
  }

  /**
   * Query harmonically compatible keys
   */
  queryCompatibleKeys(key) {
    const results = new Set();
    const keyEntry = this.segments.get(key);
    const compatibleKeys = keyEntry?.musical?.compatible_keys || [key];
    
    compatibleKeys.forEach(k => {
      const bucket = this.indexes.key.get(k);
      if (bucket) {
        bucket.forEach(id => results.add(id));
      }
    });
    
    return results;
  }

  /**
   * Query energy range
   */
  queryEnergyRange(min, max) {
    const results = new Set();
    const minBucket = Math.floor(min * 10) / 10;
    const maxBucket = Math.floor(max * 10) / 10;
    
    for (let e = minBucket; e <= maxBucket; e = Math.round((e + 0.1) * 10) / 10) {
      const bucket = this.indexes.energy.get(e);
      if (bucket) {
        bucket.forEach(id => {
          const seg = this.segments.get(id);
          if (seg && seg.classification?.energy >= min && seg.classification?.energy <= max) {
            results.add(id);
          }
        });
      }
    }
    
    return results;
  }

  /**
   * Query duration range
   */
  queryDurationRange(min, max) {
    const results = new Set();
    const minBucket = Math.floor(min / 2) * 2;
    const maxBucket = Math.floor(max / 2) * 2;
    
    for (let d = minBucket; d <= maxBucket; d += 2) {
      const bucket = this.indexes.duration.get(d);
      if (bucket) {
        bucket.forEach(id => {
          const seg = this.segments.get(id);
          if (seg && seg.duration >= min && seg.duration <= max) {
            results.add(id);
          }
        });
      }
    }
    
    return results;
  }

  /**
   * Query by tags (any tag match)
   */
  queryTags(tags) {
    const results = new Set();
    
    tags.forEach(tag => {
      const bucket = this.indexes.tags.get(tag);
      if (bucket) {
        bucket.forEach(id => results.add(id));
      }
    });
    
    return results;
  }

  /**
   * Find similar segments using feature similarity
   */
  findSimilar(segmentId, limit = 10) {
    const segment = this.segments.get(segmentId);
    if (!segment) return [];
    
    const allSegments = Array.from(this.segments.values());
    
    // Calculate similarity scores
    const similarities = allSegments
      .filter(s => s.id !== segmentId)
      .map(s => ({
        segment: s,
        score: this.calculateSimilarity(segment, s)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return similarities;
  }

  /**
   * Calculate similarity between two segments
   */
  calculateSimilarity(seg1, seg2) {
    let score = 0;
    
    // BPM similarity (0-25 points)
    const bpmDiff = Math.abs((seg1.musical?.bpm || 120) - (seg2.musical?.bpm || 120));
    score += Math.max(0, 25 - bpmDiff);
    
    // Energy similarity (0-20 points)
    const energyDiff = Math.abs(
      (seg1.classification?.energy || 0.5) - (seg2.classification?.energy || 0.5)
    );
    score += Math.max(0, 20 - energyDiff * 40);
    
    // Duration similarity (0-15 points)
    const durationDiff = Math.abs(seg1.duration - seg2.duration);
    score += Math.max(0, 15 - durationDiff * 2);
    
    // Type match (0-15 points)
    if (seg1.classification?.type === seg2.classification?.type) {
      score += 15;
    }
    
    // Key compatibility (0-25 points)
    const compatible_keys = seg1.musical?.compatible_keys || [];
    if (compatible_keys.includes(seg2.musical?.camelot_key)) {
      score += 25;
    }
    
    return score / 100; // Normalize to 0-1
  }

  /**
   * Hash features for similarity search (simplified LSH)
   */
  hashFeatures(features) {
    const hash = [];
    
    // Hash temporal features
    if (features.temporal?.rms_mean) {
      hash.push(Math.floor(features.temporal.rms_mean * 10));
    }
    
    // Hash spectral features
    if (features.spectral?.centroid_mean) {
      hash.push(Math.floor(features.spectral.centroid_mean / 1000));
    }
    
    // Hash rhythmic features
    if (features.rhythmic?.onset_density) {
      hash.push(Math.floor(features.rhythmic.onset_density));
    }
    
    return hash.join('_');
  }

  /**
   * Set intersection helper
   */
  intersect(set1, set2) {
    const result = new Set();
    set1.forEach(item => {
      if (set2.has(item)) {
        result.add(item);
      }
    });
    return result;
  }

  /**
   * Remove a segment from all indexes
   */
  removeSegment(segmentId) {
    // Remove from BPM index
    for (const [bpm, segments] of this.indexes.bpm.entries()) {
      const filtered = segments.filter(s => s.id !== segmentId);
      if (filtered.length > 0) {
        this.indexes.bpm.set(bpm, filtered);
      } else {
        this.indexes.bpm.delete(bpm);
      }
    }
    
    // Remove from key index
    for (const [key, segments] of this.indexes.key.entries()) {
      const filtered = segments.filter(s => s.id !== segmentId);
      if (filtered.length > 0) {
        this.indexes.key.set(key, filtered);
      } else {
        this.indexes.key.delete(key);
      }
    }
    
    // Remove from energy index
    for (const [energy, segments] of this.indexes.energy.entries()) {
      const filtered = segments.filter(s => s.id !== segmentId);
      if (filtered.length > 0) {
        this.indexes.energy.set(energy, filtered);
      } else {
        this.indexes.energy.delete(energy);
      }
    }
    
    // Remove from type index
    for (const [type, segments] of this.indexes.type.entries()) {
      const filtered = segments.filter(s => s.id !== segmentId);
      if (filtered.length > 0) {
        this.indexes.type.set(type, filtered);
      } else {
        this.indexes.type.delete(type);
      }
    }
    
    // Remove from duration index
    for (const [duration, segments] of this.indexes.duration.entries()) {
      const filtered = segments.filter(s => s.id !== segmentId);
      if (filtered.length > 0) {
        this.indexes.duration.set(duration, filtered);
      } else {
        this.indexes.duration.delete(duration);
      }
    }
    
    // Remove from tag index
    for (const [tag, segments] of this.indexes.tags.entries()) {
      const filtered = segments.filter(s => s.id !== segmentId);
      if (filtered.length > 0) {
        this.indexes.tags.set(tag, filtered);
      } else {
        this.indexes.tags.delete(tag);
      }
    }
    
    // Remove from feature index
    delete this.indexes.features[segmentId];
    
    console.log(`🗑️  Removed segment ${segmentId} from all indexes`);
  }

  /**
   * Get index statistics
   */
  getStats() {
    return {
      total_segments: this.segments.size,
      bpm_buckets: this.indexes.bpm.size,
      key_buckets: this.indexes.key.size,
      energy_buckets: this.indexes.energy.size,
      type_buckets: this.indexes.type.size,
      duration_buckets: this.indexes.duration.size,
      unique_tags: this.indexes.tags.size,
      feature_buckets: this.indexes.features.size
    };
  }

  /**
   * Clear all indexes
   */
  clear() {
    this.segments.clear();
    Object.values(this.indexes).forEach(index => index.clear());
  }
}

export default new AdvancedSegmentIndexer();
