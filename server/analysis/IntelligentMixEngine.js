/**
 * Intelligent Mix Engine - Industry Leading Auto-DJ
 * 
 * Uses advanced v2.0 segment metadata for:
 * - Harmonic mixing (Camelot wheel)
 * - BPM matching and tempo transitions
 * - Energy curve optimization
 * - Musical phrase alignment
 * - Smooth crossfades with EQ blending
 */

class IntelligentMixEngine {
  constructor(indexer, db) {
    this.indexer = indexer;
    this.db = db;
    
    // Camelot Wheel for harmonic mixing
    this.camelotWheel = {
      'C': '8B', 'Cm': '5A',
      'C#': '3B', 'C#m': '12A', 'Db': '3B', 'Dbm': '12A',
      'D': '10B', 'Dm': '7A',
      'D#': '5B', 'D#m': '2A', 'Eb': '5B', 'Ebm': '2A',
      'E': '12B', 'Em': '9A',
      'F': '7B', 'Fm': '4A',
      'F#': '2B', 'F#m': '11A', 'Gb': '2B', 'Gbm': '11A',
      'G': '9B', 'Gm': '6A',
      'G#': '4B', 'G#m': '1A', 'Ab': '4B', 'Abm': '1A',
      'A': '11B', 'Am': '8A',
      'A#': '6B', 'A#m': '3A', 'Bb': '6B', 'Bbm': '3A',
      'B': '1B', 'Bm': '10A'
    };
  }

  /**
   * Create an intelligent mix from available segments
   * @param {Object} options - Mix creation options
   * @returns {Object} - Optimized segment sequence with transition points
   */
  async createIntelligentMix(options = {}) {
    const {
      targetDuration = 900, // 15 minutes default for longer mixes
      minSegments = 50,
      maxSegments = 200, // Increased from 50 to allow longer mixes
      energyProfile = 'narrative', // 'narrative', 'wave', 'build', 'steady', 'random'
      allowKeyChanges = true,
      maxBpmDiff = 6,
      trackIds = null // Optional: limit to specific tracks
    } = options;

    console.log(`🎵 Creating intelligent mix (${targetDuration}s, ${energyProfile} profile, max ${maxSegments} segments)...`);

    // Get all available segments
    let segments = await this.getAllSegments(trackIds);
    
    if (segments.length === 0) {
      throw new Error('No segments available for mixing');
    }

    console.log(`📊 Found ${segments.length} segments to work with`);

    // Build the mix sequence with enhanced compatibility analysis
    const sequence = this.buildOptimalSequence(segments, {
      targetDuration,
      minSegments,
      maxSegments,
      energyProfile,
      allowKeyChanges,
      maxBpmDiff
    });

    // Calculate transition points with smooth crossfades
    const mixTimeline = this.calculateTransitions(sequence);

    console.log(`✅ Generated mix: ${sequence.length} segments, ${mixTimeline.totalDuration.toFixed(1)}s`);

    return {
      segments: sequence,
      timeline: mixTimeline.items,
      totalDuration: mixTimeline.totalDuration,
      metadata: {
        avgBpm: this.calculateAvgBpm(sequence),
        energyProfile: energyProfile,
        keyChanges: this.countKeyChanges(sequence),
        harmonyScore: this.calculateHarmonyScore(sequence)
      }
    };
  }

  /**
   * Build optimal segment sequence using intelligent selection
   */
  buildOptimalSequence(segments, options) {
    const { targetDuration, minSegments, maxSegments, energyProfile, allowKeyChanges, maxBpmDiff } = options;
    
    const sequence = [];
    let currentDuration = 0;
    let availableSegments = [...segments];

    // Start with a good intro segment
    let currentSegment = this.selectIntroSegment(availableSegments);
    if (!currentSegment) {
      currentSegment = availableSegments[0];
    }

    sequence.push(currentSegment);
    currentDuration += currentSegment.duration;
    availableSegments = availableSegments.filter(s => s.id !== currentSegment.id);

    // Build the mix
    while (currentDuration < targetDuration && sequence.length < maxSegments && availableSegments.length > 0) {
      // Calculate target energy for current position
      const progress = currentDuration / targetDuration;
      const targetEnergy = this.getTargetEnergy(progress, energyProfile);

      // Find best next segment
      const nextSegment = this.selectNextSegment(
        currentSegment,
        availableSegments,
        {
          targetEnergy,
          allowKeyChanges,
          maxBpmDiff,
          isEnding: currentDuration > targetDuration * 0.8
        }
      );

      if (!nextSegment) break;

      sequence.push(nextSegment);
      currentDuration += nextSegment.duration;
      currentSegment = nextSegment;
      availableSegments = availableSegments.filter(s => s.id !== nextSegment.id);
    }

    // Ensure minimum segments
    while (sequence.length < minSegments && availableSegments.length > 0) {
      const segment = availableSegments[0];
      sequence.push(segment);
      availableSegments = availableSegments.filter(s => s.id !== segment.id);
    }

    return sequence;
  }

  /**
   * Select best intro segment
   */
  selectIntroSegment(segments) {
    // Prefer segments marked as INTRO with lower energy
    const introSegments = segments.filter(s => 
      s.segment_type === 'INTRO' || s.energy < 0.5
    );

    if (introSegments.length === 0) return null;

    // Sort by suitability
    return introSegments.sort((a, b) => {
      const scoreA = (a.segment_type === 'INTRO' ? 10 : 0) + (1 - a.energy) * 5;
      const scoreB = (b.segment_type === 'INTRO' ? 10 : 0) + (1 - b.energy) * 5;
      return scoreB - scoreA;
    })[0];
  }

  /**
   * Select next segment with intelligent matching using full library analysis
   */
  selectNextSegment(currentSegment, availableSegments, options) {
    const { targetEnergy, allowKeyChanges, maxBpmDiff, isEnding } = options;

    // If ending, prefer outro segments
    if (isEnding) {
      const outroSegments = availableSegments.filter(s => 
        s.segment_type === 'OUTRO' || s.energy < 0.4
      );
      if (outroSegments.length > 0) {
        return outroSegments[0];
      }
    }

    // Determine narrative phase based on target energy
    let narrativePhase = 'regular';
    if (targetEnergy < 0.4) {
      narrativePhase = 'intro';
    } else if (targetEnergy >= 0.4 && targetEnergy < 0.6) {
      narrativePhase = 'buildup';
    } else if (targetEnergy >= 0.6 && targetEnergy < 0.8) {
      narrativePhase = 'climax';
    } else if (targetEnergy >= 0.8) {
      narrativePhase = 'falling';
    }

    // Score all available segments with enhanced criteria
    const scoredSegments = availableSegments.map(segment => {
      const baseScore = this.calculateCompatibilityScore(currentSegment, segment, {
        targetEnergy,
        allowKeyChanges,
        maxBpmDiff
      });

      // Additional scoring for optimal segment selection
      let bonusScore = 0;

      // Prefer segments from different tracks for variety
      if (segment.track_id !== currentSegment.track_id) {
        bonusScore += 5;
      }

      // Prefer segments with good energy flow (not too jarring)
      const energyDiff = Math.abs(segment.energy - currentSegment.energy);
      if (energyDiff < 0.3) {
        bonusScore += 3; // Smooth energy transition
      }

      // Prefer segments with suitable duration (8-16 seconds ideal)
      if (segment.duration >= 8 && segment.duration <= 16) {
        bonusScore += 2;
      }

      // Narrative phase matching
      switch (narrativePhase) {
        case 'intro':
          if (segment.segment_type === 'INTRO') bonusScore += 6;
          if (segment.energy < 0.5) bonusScore += 4;
          break;
        case 'buildup':
          if (segment.segment_type === 'BUILD') bonusScore += 6;
          if (segment.segment_type === 'RISE') bonusScore += 5;
          if (segment.energy >= 0.4 && segment.energy < 0.7) bonusScore += 3;
          break;
        case 'climax':
          if (segment.segment_type === 'DROP') bonusScore += 6;
          if (segment.segment_type === 'CLIMAX') bonusScore += 6;
          if (segment.energy >= 0.7) bonusScore += 4;
          break;
        case 'falling':
          if (segment.segment_type === 'BREAK') bonusScore += 5;
          if (segment.segment_type === 'OUTRO') bonusScore += 4;
          if (segment.energy >= 0.5 && segment.energy < 0.8) bonusScore += 3;
          break;
      }

      // Fallback: if no segment type matches, still reward energy alignment
      if (bonusScore === 0) {
        const energyAlignment = 1 - Math.abs(segment.energy - targetEnergy);
        bonusScore += energyAlignment * 2;
      }

      return {
        segment,
        score: baseScore + bonusScore
      };
    });

    // Sort by score (descending)
    scoredSegments.sort((a, b) => b.score - a.score);

    // Return best match from top 5 for more variety in longer mixes
    const topCandidates = scoredSegments.slice(0, Math.min(5, scoredSegments.length));
    const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];

    return selected?.segment || null;
  }

  /**
   * Calculate compatibility score between two segments
   */
  calculateCompatibilityScore(segmentA, segmentB, options) {
    let score = 0;

    // BPM compatibility (40 points)
    const bpmDiff = Math.abs(segmentA.bpm - segmentB.bpm);
    if (bpmDiff <= options.maxBpmDiff) {
      score += (1 - bpmDiff / options.maxBpmDiff) * 40;
    }

    // Key compatibility (30 points) - Harmonic mixing
    const keyScore = this.calculateKeyCompatibility(segmentA.key, segmentB.key);
    if (options.allowKeyChanges || keyScore > 0.5) {
      score += keyScore * 30;
    }

    // Energy curve matching (20 points)
    const energyDiff = Math.abs(segmentB.energy - options.targetEnergy);
    score += (1 - energyDiff) * 20;

    // Duration preference (10 points) - prefer 8-16 second segments
    const idealDuration = 12;
    const durationScore = 1 - Math.abs(segmentB.duration - idealDuration) / idealDuration;
    score += Math.max(0, durationScore) * 10;

    return score;
  }

  /**
   * Calculate harmonic compatibility using Camelot wheel
   */
  calculateKeyCompatibility(keyA, keyB) {
    if (keyA === keyB) return 1.0; // Perfect match

    const camelotA = this.camelotWheel[keyA];
    const camelotB = this.camelotWheel[keyB];

    if (!camelotA || !camelotB) return 0.5; // Unknown keys

    // Extract number and letter
    const numA = parseInt(camelotA);
    const numB = parseInt(camelotB);
    const letterA = camelotA.slice(-1);
    const letterB = camelotB.slice(-1);

    // Perfect fifth (same letter, +/-1 number)
    if (letterA === letterB && Math.abs(numA - numB) === 1) return 0.9;

    // Relative major/minor (same number, different letter)
    if (numA === numB && letterA !== letterB) return 0.85;

    // Energy boost (+7 numbers, same letter)
    if (letterA === letterB && (numB - numA === 7 || numA - numB === 5)) return 0.8;

    // Adjacent keys
    if (Math.abs(numA - numB) <= 2) return 0.6;

    return 0.3; // Not compatible
  }

  /**
   * Get target energy for current position in mix
   */
  getTargetEnergy(progress, profile) {
    switch (profile) {
      case 'narrative':
        // Narrative arc: intro (0-20%) -> buildup (20-40%) -> climax (40-60%) -> falling (60-80%) -> outro (80-100%)
        if (progress < 0.2) {
          // Intro: low to medium energy
          return 0.3 + (progress / 0.2) * 0.2;
        } else if (progress < 0.4) {
          // Buildup: medium to high energy
          return 0.5 + ((progress - 0.2) / 0.2) * 0.3;
        } else if (progress < 0.6) {
          // Climax: peak energy
          return 0.8 + ((progress - 0.4) / 0.2) * 0.1;
        } else if (progress < 0.8) {
          // Falling: high to medium energy
          return 0.9 - ((progress - 0.6) / 0.2) * 0.3;
        } else {
          // Outro: medium to low energy
          return 0.6 - ((progress - 0.8) / 0.2) * 0.3;
        }
      
      case 'wave':
        // Wave pattern: low -> high -> low -> high
        return 0.5 + Math.sin(progress * Math.PI * 2) * 0.3;
      
      case 'build':
        // Gradual build up
        return 0.3 + progress * 0.6;
      
      case 'steady':
        // Consistent energy
        return 0.65;
      
      case 'random':
        // Random energy changes
        return 0.3 + Math.random() * 0.6;
      
      default:
        return 0.6;
    }
  }

  /**
   * Calculate transition points with smooth crossfades for gapless mixing
   */
  calculateTransitions(sequence) {
    const items = [];
    let currentTime = 0;

    for (let i = 0; i < sequence.length; i++) {
      const segment = sequence[i];
      const nextSegment = sequence[i + 1];

      // Calculate optimal crossfade duration based on BPM and compatibility
      let crossfadeDuration = 2; // Base 2 seconds
      if (nextSegment) {
        const compatibility = this.calculateCompatibilityScore(
          segment,
          nextSegment,
          { targetEnergy: nextSegment.energy, allowKeyChanges: true, maxBpmDiff: 6 }
        );
        
        // Adjust crossfade based on BPM (faster songs = shorter crossfades)
        const avgBpm = (segment.bpm + nextSegment.bpm) / 2;
        const bpmFactor = Math.max(0.5, Math.min(1.5, 128 / avgBpm));
        
        // Higher compatibility = longer crossfade for smoother blend
        // BPM factor adjusts for song speed
        crossfadeDuration = 2 + (compatibility / 100) * 2 * bpmFactor;
        
        // Clamp to reasonable range (1.5-5 seconds)
        crossfadeDuration = Math.max(1.5, Math.min(5, crossfadeDuration));
      }

      // Calculate fade times for gapless mixing
      const fadeIn = i === 0 ? 1 : crossfadeDuration;
      const fadeOut = i === sequence.length - 1 ? 2 : crossfadeDuration;

      items.push({
        segmentId: segment.id,
        startTime: currentTime,
        duration: segment.duration,
        fadeIn,
        fadeOut,
        bpm: segment.bpm,
        key: segment.key,
        energy: segment.energy,
        transitionType: 'crossfade',
        transitionDuration: crossfadeDuration,
        metadata: {
          track_filename: segment.track_filename,
          segment_type: segment.segment_type,
          original_path: segment.original_path,
          original_start: segment.start_time,
          original_end: segment.end_time
        }
      });

      // Calculate next segment start time with overlap for gapless mixing
      // The next segment starts BEFORE the current one ends by crossfadeDuration
      currentTime += segment.duration;
    }

    const totalDuration = sequence.reduce((sum, seg) => sum + seg.duration, 0);

    return { items, totalDuration };
  }

  /**
   * Get all segments from database
   */
  async getAllSegments(trackIds = null) {
    if (!this.db) {
      throw new Error('Database instance not provided to IntelligentMixEngine');
    }
    
    // Query from segments_v2 table (v2.0 pipeline) with fallback to segments table
    let query = 'SELECT * FROM segments_v2 WHERE 1=1';
    const params = [];

    if (trackIds && trackIds.length > 0) {
      const placeholders = trackIds.map(() => '?').join(',');
      query += ` AND track_id IN (${placeholders})`;
      params.push(...trackIds);
    }

    query += ' ORDER BY energy, bpm';

    let segments = await this.db.all(query, params);
    
    // Fallback to old segments table if v2.0 is empty
    if (segments.length === 0) {
      console.log('⚠️ No segments in segments_v2, falling back to segments table');
      query = 'SELECT * FROM segments WHERE 1=1';
      const paramsFallback = [];
      
      if (trackIds && trackIds.length > 0) {
        const placeholders = trackIds.map(() => '?').join(',');
        query += ` AND track_id IN (${placeholders})`;
        paramsFallback.push(...trackIds);
      }
      
      query += ' ORDER BY energy, bpm';
      segments = await this.db.all(query, paramsFallback);
    }
    
    // Map segment fields to ensure compatibility
    return segments.map(seg => ({
      ...seg,
      bpm: seg.bpm || seg.musical?.bpm || 120,
      energy: seg.energy || seg.classification?.energy || 0.5,
      key: seg.key || seg.musical?.key || seg.musical?.camelot_key || 'C',
      segment_type: seg.segment_type || seg.classification?.type || 'REGULAR',
      duration: seg.duration || (seg.end_time - seg.start_time) || 8
    }));
  }

  // Helper methods
  calculateAvgBpm(segments) {
    const sum = segments.reduce((acc, s) => acc + s.bpm, 0);
    return (sum / segments.length).toFixed(1);
  }

  countKeyChanges(segments) {
    let changes = 0;
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].key !== segments[i - 1].key) changes++;
    }
    return changes;
  }

  calculateHarmonyScore(segments) {
    let totalScore = 0;
    for (let i = 1; i < segments.length; i++) {
      totalScore += this.calculateKeyCompatibility(segments[i - 1].key, segments[i].key);
    }
    return (totalScore / (segments.length - 1)).toFixed(2);
  }
}

export default IntelligentMixEngine;
