import crypto from 'crypto';

/**
 * Advanced Segment Indexing and Matching System
 * Creates fingerprints and finds compatible segments for seamless mixing
 */
export class SegmentIndexer {
  constructor() {
    this.compatibilityMatrix = {};
  }

  /**
   * Generate unique fingerprint for a segment
   * Based on BPM, key, energy, and rhythmic characteristics
   */
  generateFingerprint(segment) {
    const features = {
      bpm: Math.round(segment.bpm || 120),
      key: segment.key || 'C',
      energy: Math.round((segment.energy || 0.5) * 100),
      segmentType: segment.segmentType || 'REGULAR',
      intensity: segment.characteristics?.intensity || 'MEDIUM',
      duration: Math.round(segment.duration || 0)
    };
    
    const fingerprintString = JSON.stringify(features);
    return crypto.createHash('md5').update(fingerprintString).digest('hex').substring(0, 16);
  }

  /**
   * Generate similarity hash for matching
   * Groups segments with similar characteristics
   */
  generateSimilarityHash(segment) {
    // Round BPM to nearest 5 for grouping
    const bpmGroup = Math.round((segment.bpm || 120) / 5) * 5;
    
    // Key compatibility (circle of fifths)
    const keyGroup = this.getKeyGroup(segment.key || 'C');
    
    // Energy level (LOW, MEDIUM, HIGH)
    const energyLevel = (segment.energy || 0.5) < 0.4 ? 'LOW' : 
                       (segment.energy || 0.5) > 0.7 ? 'HIGH' : 'MEDIUM';
    
    // Segment type
    const typeGroup = segment.segmentType || 'REGULAR';
    
    return `${bpmGroup}_${keyGroup}_${energyLevel}_${typeGroup}`;
  }

  /**
   * Get key group for harmonic mixing (Camelot wheel)
   */
  getKeyGroup(key) {
    const camelotWheel = {
      'C': '8B', 'Am': '8A',
      'G': '9B', 'Em': '9A',
      'D': '10B', 'Bm': '10A',
      'A': '11B', 'F#m': '11A',
      'E': '12B', 'C#m': '12A',
      'B': '1B', 'G#m': '1A',
      'F#': '2B', 'D#m': '2A',
      'Db': '3B', 'Bbm': '3A',
      'Ab': '4B', 'Fm': '4A',
      'Eb': '5B', 'Cm': '5A',
      'Bb': '6B', 'Gm': '6A',
      'F': '7B', 'Dm': '7A'
    };
    
    return camelotWheel[key] || '8B';
  }

  /**
   * Calculate mix-in and mix-out points for seamless transitions
   */
  calculateMixPoints(segment, bpm) {
    const beatDuration = 60 / (bpm || 120);
    
    // Mix-in point: 4 beats from start (for intro)
    const mixInPoint = Math.min(beatDuration * 4, segment.duration * 0.25);
    
    // Mix-out point: 8 beats from end (for outro)
    const mixOutPoint = Math.max(segment.duration - (beatDuration * 8), segment.duration * 0.75);
    
    return {
      mixInPoint,
      mixOutPoint,
      mixDuration: mixOutPoint - mixInPoint
    };
  }

  /**
   * Determine if segment is loop-compatible
   * Checks if start and end are beat-aligned and similar
   */
  isLoopCompatible(segment, bpm) {
    const beatDuration = 60 / (bpm || 120);
    
    // Check if duration is multiple of 4, 8, or 16 beats
    const beatsInSegment = segment.duration / beatDuration;
    const isMultipleOf4 = Math.abs(beatsInSegment % 4) < 0.1;
    const isMultipleOf8 = Math.abs(beatsInSegment % 8) < 0.1;
    const isMultipleOf16 = Math.abs(beatsInSegment % 16) < 0.1;
    
    return isMultipleOf16 || isMultipleOf8 || isMultipleOf4;
  }

  /**
   * Determine best transition type for segment
   */
  getTransitionType(segment) {
    const segmentType = segment.segmentType || 'REGULAR';
    const energy = segment.energy || 0.5;
    const variance = segment.energyVariance || 0;
    
    if (segmentType === 'DROP') return 'ECHO_OUT';
    if (segmentType === 'PEAK') return 'BEATMATCH';
    if (segmentType === 'BUILD') return 'CROSSFADE';
    
    if (variance > 0.2) return 'DYNAMIC_EQ';
    if (energy > 0.7) return 'BEATMATCH';
    if (energy < 0.3) return 'SMOOTH_FADE';
    
    return 'CROSSFADE';
  }

  /**
   * Calculate rhythmic complexity score
   */
  calculateRhythmicComplexity(segment) {
    const variance = segment.energyVariance || 0;
    const onsetDensity = segment.onsetDensity || 0.5;
    
    // Higher variance and onset density = more complex
    return (variance * 0.6) + (onsetDensity * 0.4);
  }

  /**
   * Find compatible segments for mixing
   */
  findCompatibleSegments(targetSegment, allSegments) {
    const compatible = [];
    
    const targetBPM = targetSegment.bpm || 120;
    const targetKey = this.getKeyGroup(targetSegment.key || 'C');
    const targetEnergy = targetSegment.energy || 0.5;
    
    for (const segment of allSegments) {
      if (segment.id === targetSegment.id) continue;
      
      const segmentBPM = segment.bpm || 120;
      const segmentKey = this.getKeyGroup(segment.key || 'C');
      const segmentEnergy = segment.energy || 0.5;
      
      // BPM compatibility (within 5%)
      const bpmDiff = Math.abs(targetBPM - segmentBPM) / targetBPM;
      const bpmCompatible = bpmDiff < 0.05;
      
      // Key compatibility (same or adjacent on Camelot wheel)
      const keyCompatible = this.areKeysCompatible(targetKey, segmentKey);
      
      // Energy compatibility (within 0.3)
      const energyDiff = Math.abs(targetEnergy - segmentEnergy);
      const energyCompatible = energyDiff < 0.3;
      
      // Calculate overall compatibility score
      const compatibilityScore = 
        (bpmCompatible ? 0.4 : 0) +
        (keyCompatible ? 0.4 : 0) +
        (energyCompatible ? 0.2 : 0);
      
      if (compatibilityScore > 0.6) {
        compatible.push({
          segment,
          compatibilityScore,
          bpmDiff,
          energyDiff,
          keyCompatible
        });
      }
    }
    
    // Sort by compatibility score
    compatible.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    
    return compatible;
  }

  /**
   * Check if two keys are compatible for harmonic mixing
   */
  areKeysCompatible(key1, key2) {
    if (key1 === key2) return true;
    
    // Extract number and letter
    const num1 = parseInt(key1);
    const num2 = parseInt(key2);
    const letter1 = key1.slice(-1);
    const letter2 = key2.slice(-1);
    
    // Same number, different letter (relative major/minor)
    if (num1 === num2 && letter1 !== letter2) return true;
    
    // Adjacent numbers, same letter (perfect fifth)
    if (Math.abs(num1 - num2) === 1 && letter1 === letter2) return true;
    
    // Wrap around (12 and 1 are adjacent)
    if ((num1 === 12 && num2 === 1) || (num1 === 1 && num2 === 12)) {
      if (letter1 === letter2) return true;
    }
    
    return false;
  }

  /**
   * Create segment index entry with all metadata
   */
  createSegmentIndex(segment, bpm) {
    const fingerprint = this.generateFingerprint(segment);
    const similarityHash = this.generateSimilarityHash(segment);
    const mixPoints = this.calculateMixPoints(segment, bpm);
    const loopCompatible = this.isLoopCompatible(segment, bpm);
    const transitionType = this.getTransitionType(segment);
    const rhythmicComplexity = this.calculateRhythmicComplexity(segment);
    
    return {
      ...segment,
      audio_fingerprint: fingerprint,
      similarity_hash: similarityHash,
      mix_in_point: mixPoints.mixInPoint,
      mix_out_point: mixPoints.mixOutPoint,
      loop_compatible: loopCompatible ? 1 : 0,
      transition_type: transitionType,
      rhythmic_complexity: rhythmicComplexity,
      spectral_brightness: segment.spectralBrightness || 0.5,
      onset_density: segment.onsetDensity || 0.5,
      harmonic_content: this.getKeyGroup(segment.key || 'C')
    };
  }

  /**
   * Build compatibility matrix for all segments
   */
  buildCompatibilityMatrix(segments) {
    const matrix = {};
    
    for (const segment of segments) {
      const compatible = this.findCompatibleSegments(segment, segments);
      matrix[segment.id] = compatible.map(c => ({
        id: c.segment.id,
        score: c.compatibilityScore,
        bpmDiff: c.bpmDiff,
        energyDiff: c.energyDiff,
        keyCompatible: c.keyCompatible
      }));
    }
    
    this.compatibilityMatrix = matrix;
    return matrix;
  }

  /**
   * Get best mixing sequence for a set of segments
   */
  getOptimalMixSequence(segments) {
    if (segments.length === 0) return [];
    if (segments.length === 1) return segments;
    
    // Start with highest energy segment
    const sorted = [...segments].sort((a, b) => (b.energy || 0) - (a.energy || 0));
    const sequence = [sorted[0]];
    const remaining = sorted.slice(1);
    
    // Greedily add most compatible segments
    while (remaining.length > 0) {
      const current = sequence[sequence.length - 1];
      const compatible = this.findCompatibleSegments(current, remaining);
      
      if (compatible.length > 0) {
        const best = compatible[0].segment;
        sequence.push(best);
        const idx = remaining.findIndex(s => s.id === best.id);
        remaining.splice(idx, 1);
      } else {
        // No compatible segments, add highest energy remaining
        sequence.push(remaining[0]);
        remaining.shift();
      }
    }
    
    return sequence;
  }

  /**
   * Calculate transition parameters between two segments
   */
  calculateTransitionParameters(segmentA, segmentB) {
    const bpmDiff = Math.abs((segmentA.bpm || 120) - (segmentB.bpm || 120));
    const energyDiff = Math.abs((segmentA.energy || 0.5) - (segmentB.energy || 0.5));
    
    // Determine transition duration (in beats)
    let transitionBeats = 8; // Default
    
    if (bpmDiff > 5) transitionBeats = 16; // Longer for BPM changes
    if (energyDiff > 0.5) transitionBeats = 16; // Longer for energy changes
    if (segmentA.segmentType === 'DROP' || segmentB.segmentType === 'PEAK') {
      transitionBeats = 4; // Shorter for dramatic moments
    }
    
    const avgBPM = ((segmentA.bpm || 120) + (segmentB.bpm || 120)) / 2;
    const transitionDuration = (60 / avgBPM) * transitionBeats;
    
    // Determine transition type
    let transitionType = 'CROSSFADE';
    
    if (bpmDiff < 2 && energyDiff < 0.2) {
      transitionType = 'BEATMATCH'; // Perfect for similar segments
    } else if (energyDiff > 0.5) {
      transitionType = 'DYNAMIC_EQ'; // For energy changes
    } else if (segmentA.segmentType === 'DROP') {
      transitionType = 'ECHO_OUT';
    } else if (segmentB.segmentType === 'BUILD') {
      transitionType = 'FILTER_SWEEP';
    }
    
    return {
      duration: transitionDuration,
      type: transitionType,
      mixOutPoint: segmentA.mix_out_point || segmentA.duration * 0.75,
      mixInPoint: segmentB.mix_in_point || segmentB.duration * 0.25,
      eqCurve: this.calculateEQCurve(segmentA, segmentB),
      volumeCurve: this.calculateVolumeCurve(energyDiff)
    };
  }

  /**
   * Calculate EQ curve for transition
   */
  calculateEQCurve(segmentA, segmentB) {
    const brightnessA = segmentA.spectralBrightness || 0.5;
    const brightnessB = segmentB.spectralBrightness || 0.5;
    
    if (brightnessB > brightnessA) {
      return 'HIGH_PASS_SWEEP'; // Gradually introduce highs
    } else if (brightnessA > brightnessB) {
      return 'LOW_PASS_SWEEP'; // Gradually reduce highs
    }
    
    return 'FLAT'; // No EQ change needed
  }

  /**
   * Calculate volume curve for transition
   */
  calculateVolumeCurve(energyDiff) {
    if (energyDiff < 0.2) return 'LINEAR';
    if (energyDiff < 0.4) return 'EXPONENTIAL';
    return 'LOGARITHMIC'; // For large energy changes
  }
}

export default new SegmentIndexer();
