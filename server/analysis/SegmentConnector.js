/**
 * Industry-Leading Intelligent Segment Connector
 * Uses ML-based compatibility scoring, audio analysis, and music theory
 * for flawless segment transitions
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class IntelligentSegmentConnector {
  constructor(db, segmentIndexer) {
    this.db = db;
    this.segmentIndexer = segmentIndexer;
    this.trainingData = [];
    this.connectionPatterns = new Map();
    this.compatibilityCache = new Map();
    
    // Camelot Wheel for harmonic mixing
    this.camelotWheel = {
      'C': '8B', 'Am': '8A', 'G': '9B', 'Em': '9A',
      'D': '10B', 'Bm': '10A', 'A': '11B', 'F#m': '11A',
      'E': '12B', 'C#m': '12A', 'B': '1B', 'G#m': '1A',
      'Gb': '2B', 'Ebm': '2A', 'Db': '3B', 'Bbm': '3A',
      'Ab': '4B', 'Fm': '4A', 'Eb': '5B', 'Cm': '5A',
      'Bb': '6B', 'Gm': '6A', 'F': '7B', 'Dm': '7A'
    };
    
    this.loadTrainingData();
  }

  /**
   * Load training data from previous successful mixes
   */
  async loadTrainingData() {
    try {
      const trainingPath = path.join(__dirname, '../../data/training/segment_connections.json');
      const data = await fs.readFile(trainingPath, 'utf-8');
      this.trainingData = JSON.parse(data);
      console.log(`📚 Loaded ${this.trainingData.length} training examples`);
      this.buildConnectionPatterns();
    } catch (err) {
      console.log('📚 No training data found, starting fresh');
      this.trainingData = [];
    }
  }

  /**
   * Save training data for future use
   */
  async saveTrainingData() {
    try {
      const trainingDir = path.join(__dirname, '../../data/training');
      await fs.mkdir(trainingDir, { recursive: true });
      const trainingPath = path.join(trainingDir, 'segment_connections.json');
      await fs.writeFile(trainingPath, JSON.stringify(this.trainingData, null, 2));
      console.log(`💾 Saved ${this.trainingData.length} training examples`);
    } catch (err) {
      console.error('Error saving training data:', err);
    }
  }

  /**
   * Add a successful connection to training data
   */
  async trainConnection(segmentA, segmentB, quality) {
    const connection = {
      from: {
        id: segmentA.id,
        bpm: segmentA.bpm,
        key: segmentA.key,
        energy: segmentA.energy,
        segment_type: segmentA.segment_type,
        spectral_centroid: segmentA.spectral_centroid,
        spectral_rolloff: segmentA.spectral_rolloff
      },
      to: {
        id: segmentB.id,
        bpm: segmentB.bpm,
        key: segmentB.key,
        energy: segmentB.energy,
        segment_type: segmentB.segment_type,
        spectral_centroid: segmentB.spectral_centroid,
        spectral_rolloff: segmentB.spectral_rolloff
      },
      quality,
      timestamp: Date.now()
    };
    
    this.trainingData.push(connection);
    
    // Save every 10 new connections
    if (this.trainingData.length % 10 === 0) {
      await this.saveTrainingData();
    }
    
    this.buildConnectionPatterns();
  }

  /**
   * Build connection patterns from training data
   */
  buildConnectionPatterns() {
    this.connectionPatterns.clear();
    
    for (const connection of this.trainingData) {
      const patternKey = this.getPatternKey(connection.from, connection.to);
      
      if (!this.connectionPatterns.has(patternKey)) {
        this.connectionPatterns.set(patternKey, {
          count: 0,
          avgQuality: 0,
          examples: []
        });
      }
      
      const pattern = this.connectionPatterns.get(patternKey);
      pattern.count++;
      pattern.avgQuality = (pattern.avgQuality * (pattern.count - 1) + connection.quality) / pattern.count;
      pattern.examples.push(connection);
    }
    
    console.log(`🧠 Built ${this.connectionPatterns.size} connection patterns`);
  }

  /**
   * Get pattern key for connection
   */
  getPatternKey(segmentA, segmentB) {
    const bpmDiff = Math.abs(segmentA.bpm - segmentB.bpm);
    const energyDiff = Math.abs(segmentA.energy - segmentB.energy);
    const keyCompat = this.calculateKeyCompatibility(segmentA.key, segmentB.key);
    
    return `${segmentA.segment_type}->${segmentB.segment_type}_bpm${Math.floor(bpmDiff/5)}_energy${Math.floor(energyDiff*10)}_key${Math.floor(keyCompat*10)}`;
  }

  /**
   * Calculate comprehensive compatibility score between two segments
   */
  calculateCompatibility(segmentA, segmentB, context = {}) {
    const cacheKey = `${segmentA.id}-${segmentB.id}`;
    
    if (this.compatibilityCache.has(cacheKey)) {
      return this.compatibilityCache.get(cacheKey);
    }
    
    let score = 0;
    const weights = {
      bpm: 0.20,
      key: 0.20,
      energy: 0.15,
      spectral: 0.15,
      type: 0.10,
      duration: 0.05,
      learned: 0.15
    };
    
    // 1. BPM Compatibility (20%)
    const bpmScore = this.calculateBPMCompatibility(segmentA.bpm, segmentB.bpm);
    score += bpmScore * weights.bpm * 100;
    
    // 2. Key Compatibility (20%) - Harmonic mixing
    const keyScore = this.calculateKeyCompatibility(segmentA.key, segmentB.key);
    score += keyScore * weights.key * 100;
    
    // 3. Energy Flow (15%)
    const energyScore = this.calculateEnergyFlow(
      segmentA.energy,
      segmentB.energy,
      context.targetEnergy || segmentB.energy
    );
    score += energyScore * weights.energy * 100;
    
    // 4. Spectral Compatibility (15%)
    const spectralScore = this.calculateSpectralCompatibility(segmentA, segmentB);
    score += spectralScore * weights.spectral * 100;
    
    // 5. Segment Type Compatibility (10%)
    const typeScore = this.calculateTypeCompatibility(
      segmentA.segment_type,
      segmentB.segment_type,
      context.narrativePhase
    );
    score += typeScore * weights.type * 100;
    
    // 6. Duration Compatibility (5%)
    const durationScore = this.calculateDurationCompatibility(segmentA.duration, segmentB.duration);
    score += durationScore * weights.duration * 100;
    
    // 7. Learned Patterns (15%)
    const learnedScore = this.getLearnedScore(segmentA, segmentB);
    score += learnedScore * weights.learned * 100;
    
    this.compatibilityCache.set(cacheKey, score);
    return score;
  }

  /**
   * Calculate BPM compatibility using tempo matching rules
   */
  calculateBPMCompatibility(bpmA, bpmB) {
    const diff = Math.abs(bpmA - bpmB);
    
    // Perfect match
    if (diff === 0) return 1.0;
    
    // Double/half tempo (harmonic tempo)
    if (Math.abs(bpmA - bpmB * 2) < 2 || Math.abs(bpmB - bpmA * 2) < 2) return 0.95;
    
    // Very close (within 2 BPM)
    if (diff <= 2) return 0.9;
    
    // Close (within 5 BPM)
    if (diff <= 5) return 0.8;
    
    // Acceptable (within 10 BPM)
    if (diff <= 10) return 0.6;
    
    // Marginal (within 15 BPM)
    if (diff <= 15) return 0.4;
    
    // Poor match
    return Math.max(0, 1 - (diff / 30));
  }

  /**
   * Calculate key compatibility using Camelot Wheel
   */
  calculateKeyCompatibility(keyA, keyB) {
    if (!keyA || !keyB) return 0.5;
    
    const camelotA = this.getCamelotKey(keyA);
    const camelotB = this.getCamelotKey(keyB);
    
    if (!camelotA || !camelotB) return 0.5;
    
    // Same key - perfect
    if (camelotA === camelotB) return 1.0;
    
    const numA = parseInt(camelotA);
    const numB = parseInt(camelotB);
    const letterA = camelotA.slice(-1);
    const letterB = camelotB.slice(-1);
    
    // Same letter (major/minor), adjacent numbers (perfect fifth)
    if (letterA === letterB && Math.abs(numA - numB) === 1) return 0.95;
    if (letterA === letterB && (numA === 12 && numB === 1 || numA === 1 && numB === 12)) return 0.95;
    
    // Relative major/minor (same number, different letter)
    if (numA === numB && letterA !== letterB) return 0.9;
    
    // Energy boost (+7 numbers, same letter)
    if (letterA === letterB && (numB - numA === 7 || numA - numB === 5)) return 0.85;
    
    // Adjacent keys (within 2 steps)
    if (Math.abs(numA - numB) <= 2) return 0.7;
    
    // Moderate compatibility
    if (Math.abs(numA - numB) <= 3) return 0.5;
    
    return 0.3;
  }

  /**
   * Get Camelot key notation
   */
  getCamelotKey(key) {
    if (!key) return null;
    
    // If already in Camelot notation
    if (/^\d{1,2}[AB]$/.test(key)) return key;
    
    // Convert from standard notation
    return this.camelotWheel[key] || null;
  }

  /**
   * Calculate energy flow score
   */
  calculateEnergyFlow(energyA, energyB, targetEnergy) {
    const actualChange = energyB - energyA;
    const desiredChange = targetEnergy - energyA;
    
    // If moving in the right direction
    if (Math.sign(actualChange) === Math.sign(desiredChange) || desiredChange === 0) {
      const diff = Math.abs(energyB - targetEnergy);
      return Math.max(0, 1 - diff);
    }
    
    // Moving in wrong direction
    return Math.max(0, 0.5 - Math.abs(actualChange));
  }

  /**
   * Calculate spectral compatibility
   */
  calculateSpectralCompatibility(segmentA, segmentB) {
    let score = 0;
    let count = 0;
    
    // Spectral centroid similarity
    if (segmentA.spectral_centroid && segmentB.spectral_centroid) {
      const centroidDiff = Math.abs(segmentA.spectral_centroid - segmentB.spectral_centroid);
      score += Math.max(0, 1 - centroidDiff / 5000);
      count++;
    }
    
    // Spectral rolloff similarity
    if (segmentA.spectral_rolloff && segmentB.spectral_rolloff) {
      const rolloffDiff = Math.abs(segmentA.spectral_rolloff - segmentB.spectral_rolloff);
      score += Math.max(0, 1 - rolloffDiff / 8000);
      count++;
    }
    
    // Zero crossing rate similarity
    if (segmentA.zero_crossing_rate && segmentB.zero_crossing_rate) {
      const zcrDiff = Math.abs(segmentA.zero_crossing_rate - segmentB.zero_crossing_rate);
      score += Math.max(0, 1 - zcrDiff / 0.2);
      count++;
    }
    
    return count > 0 ? score / count : 0.5;
  }

  /**
   * Calculate segment type compatibility
   */
  calculateTypeCompatibility(typeA, typeB, narrativePhase) {
    const flowRules = {
      'INTRO': ['INTRO', 'BUILD', 'VERSE', 'REGULAR'],
      'BUILD': ['BUILD', 'DROP', 'CLIMAX', 'RISE'],
      'DROP': ['DROP', 'CLIMAX', 'BREAK', 'BUILD'],
      'CLIMAX': ['CLIMAX', 'DROP', 'BREAK', 'FALLING'],
      'BREAK': ['BREAK', 'BUILD', 'VERSE', 'OUTRO'],
      'VERSE': ['VERSE', 'BUILD', 'CHORUS', 'REGULAR'],
      'CHORUS': ['CHORUS', 'DROP', 'VERSE', 'BREAK'],
      'OUTRO': ['OUTRO', 'BREAK', 'VERSE'],
      'REGULAR': ['REGULAR', 'BUILD', 'VERSE', 'BREAK']
    };
    
    const allowedTransitions = flowRules[typeA] || ['REGULAR'];
    
    if (allowedTransitions.includes(typeB)) {
      // Bonus for narrative phase alignment
      if (narrativePhase) {
        if (narrativePhase === 'intro' && typeB === 'INTRO') return 1.0;
        if (narrativePhase === 'buildup' && (typeB === 'BUILD' || typeB === 'RISE')) return 1.0;
        if (narrativePhase === 'climax' && (typeB === 'DROP' || typeB === 'CLIMAX')) return 1.0;
        if (narrativePhase === 'falling' && typeB === 'BREAK') return 1.0;
        if (narrativePhase === 'outro' && typeB === 'OUTRO') return 1.0;
      }
      return 0.8;
    }
    
    return 0.4;
  }

  /**
   * Calculate duration compatibility
   */
  calculateDurationCompatibility(durationA, durationB) {
    const diff = Math.abs(durationA - durationB);
    
    // Similar durations are better for flow
    if (diff <= 2) return 1.0;
    if (diff <= 4) return 0.8;
    if (diff <= 8) return 0.6;
    
    return Math.max(0.3, 1 - diff / 20);
  }

  /**
   * Get learned score from training data
   */
  getLearnedScore(segmentA, segmentB) {
    const patternKey = this.getPatternKey(segmentA, segmentB);
    const pattern = this.connectionPatterns.get(patternKey);
    
    if (pattern && pattern.count >= 3) {
      // Use learned quality score
      return pattern.avgQuality;
    }
    
    return 0.5; // Neutral score if no training data
  }

  /**
   * Calculate optimal crossfade duration
   */
  calculateCrossfadeDuration(segmentA, segmentB) {
    const compatibility = this.calculateCompatibility(segmentA, segmentB);
    const avgBpm = (segmentA.bpm + segmentB.bpm) / 2;
    
    // Base duration on BPM (faster = shorter crossfade)
    const bpmFactor = Math.max(0.5, Math.min(1.5, 128 / avgBpm));
    
    // Base duration: 2 seconds
    let duration = 2.0;
    
    // Adjust based on compatibility (higher = longer crossfade for smoother blend)
    duration += (compatibility / 100) * 3 * bpmFactor;
    
    // Adjust based on energy difference (larger = longer crossfade)
    const energyDiff = Math.abs(segmentA.energy - segmentB.energy);
    duration += energyDiff * 2;
    
    // Clamp between 1.5 and 6 seconds
    return Math.max(1.5, Math.min(6, duration));
  }

  /**
   * Find best next segment from library
   */
  async findBestNextSegment(currentSegment, usedSegmentIds, context = {}) {
    console.log(`🔍 Searching for best match for segment ${currentSegment.id}...`);
    
    // Get all available segments
    const allSegments = await this.db.all('SELECT * FROM segments');
    const availableSegments = allSegments.filter(s => !usedSegmentIds.has(s.id));
    
    if (availableSegments.length === 0) {
      console.warn('⚠️ No available segments');
      return null;
    }
    
    console.log(`📊 Analyzing ${availableSegments.length} candidates...`);
    
    // Score all candidates
    const scored = availableSegments.map(segment => ({
      segment,
      score: this.calculateCompatibility(currentSegment, segment, context)
    }));
    
    // Sort by score
    scored.sort((a, b) => b.score - a.score);
    
    // Log top candidates
    console.log(`🏆 Top 5 candidates:`);
    scored.slice(0, 5).forEach((item, idx) => {
      console.log(`   ${idx + 1}. Score: ${item.score.toFixed(2)} - ${item.segment.segment_type} (BPM: ${item.segment.bpm}, Key: ${item.segment.key}, Energy: ${item.segment.energy?.toFixed(2)})`);
    });
    
    // Return top candidate with some randomness for variety
    const topCandidates = scored.slice(0, Math.min(5, scored.length));
    const weights = topCandidates.map((_, idx) => Math.pow(0.7, idx)); // Exponential decay
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    
    let random = Math.random() * totalWeight;
    for (let i = 0; i < topCandidates.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return topCandidates[i].segment;
      }
    }
    
    return topCandidates[0].segment;
  }

  /**
   * Create a flawless mix with unlimited duration
   */
  async createFlawlessMix(options = {}) {
    const {
      targetDuration = null, // null = unlimited
      minSegments = 50,
      maxSegments = null, // null = unlimited
      energyProfile = 'narrative',
      startSegmentId = null,
      allowKeyChanges = true,
      maxBpmDiff = 10
    } = options;
    
    console.log(`🎼 Creating flawless mix...`);
    console.log(`   Target duration: ${targetDuration ? targetDuration + 's' : 'unlimited'}`);
    console.log(`   Energy profile: ${energyProfile}`);
    console.log(`   Max segments: ${maxSegments || 'unlimited'}`);
    
    const sequence = [];
    const usedSegmentIds = new Set();
    let currentDuration = 0;
    
    // Get all segments for analysis
    const allSegments = await this.db.all('SELECT * FROM segments');
    console.log(`📚 Analyzing library of ${allSegments.length} segments`);
    
    // Select starting segment
    let currentSegment;
    if (startSegmentId) {
      currentSegment = allSegments.find(s => s.id === startSegmentId);
    } else {
      // Find best intro segment
      const introSegments = allSegments.filter(s => 
        s.segment_type === 'INTRO' || s.energy < 0.4
      );
      currentSegment = introSegments.length > 0 ? introSegments[0] : allSegments[0];
    }
    
    sequence.push(currentSegment);
    usedSegmentIds.add(currentSegment.id);
    currentDuration += currentSegment.duration;
    
    console.log(`🎬 Starting with: ${currentSegment.segment_type} (${currentSegment.duration}s)`);
    
    // Build sequence
    let iteration = 0;
    while (true) {
      iteration++;
      
      // Check stopping conditions
      if (maxSegments && sequence.length >= maxSegments) {
        console.log(`✋ Reached max segments: ${maxSegments}`);
        break;
      }
      
      if (targetDuration && currentDuration >= targetDuration) {
        console.log(`✋ Reached target duration: ${targetDuration}s`);
        break;
      }
      
      if (usedSegmentIds.size >= allSegments.length) {
        console.log(`✋ Used all available segments`);
        break;
      }
      
      // Calculate progress and target energy
      const progress = targetDuration ? currentDuration / targetDuration : sequence.length / (maxSegments || 100);
      const targetEnergy = this.getTargetEnergy(progress, energyProfile);
      const isEnding = targetDuration ? (currentDuration / targetDuration > 0.85) : false;
      
      // Determine narrative phase
      let narrativePhase = 'regular';
      if (progress < 0.2) narrativePhase = 'intro';
      else if (progress < 0.4) narrativePhase = 'buildup';
      else if (progress < 0.6) narrativePhase = 'climax';
      else if (progress < 0.8) narrativePhase = 'falling';
      else narrativePhase = 'outro';
      
      // Find best next segment
      const nextSegment = await this.findBestNextSegment(currentSegment, usedSegmentIds, {
        targetEnergy,
        narrativePhase,
        isEnding,
        allowKeyChanges,
        maxBpmDiff
      });
      
      if (!nextSegment) {
        console.log(`⚠️ No more suitable segments found`);
        break;
      }
      
      sequence.push(nextSegment);
      usedSegmentIds.add(nextSegment.id);
      currentDuration += nextSegment.duration;
      currentSegment = nextSegment;
      
      if (iteration % 10 === 0) {
        console.log(`📍 Progress: ${sequence.length} segments, ${currentDuration.toFixed(1)}s, phase: ${narrativePhase}`);
      }
    }
    
    console.log(`✅ Mix sequence complete: ${sequence.length} segments, ${currentDuration.toFixed(1)}s`);
    
    // Calculate transitions
    const timeline = this.calculateTransitions(sequence);
    
    return {
      segments: sequence,
      timeline: timeline.items,
      totalDuration: timeline.totalDuration,
      metadata: {
        segmentCount: sequence.length,
        avgCompatibility: this.calculateAvgCompatibility(sequence),
        energyProfile,
        keyChanges: this.countKeyChanges(sequence),
        bpmRange: this.getBPMRange(sequence)
      }
    };
  }

  /**
   * Calculate transitions with optimal crossfades
   */
  calculateTransitions(sequence) {
    const items = [];
    let currentTime = 0;
    
    for (let i = 0; i < sequence.length; i++) {
      const segment = sequence[i];
      const nextSegment = sequence[i + 1];
      
      let crossfadeDuration = 2;
      if (nextSegment) {
        crossfadeDuration = this.calculateCrossfadeDuration(segment, nextSegment);
      }
      
      items.push({
        segmentId: segment.id,
        startTime: currentTime,
        duration: segment.duration,
        fadeIn: i === 0 ? 0.5 : crossfadeDuration,
        fadeOut: nextSegment ? crossfadeDuration : 2,
        transitionType: nextSegment ? 'intelligent_crossfade' : 'fadeout',
        transitionDuration: crossfadeDuration,
        metadata: {
          original_start: segment.start_time,
          original_end: segment.end_time,
          track_filename: segment.track_filename,
          compatibility: nextSegment ? this.calculateCompatibility(segment, nextSegment) : 100
        }
      });
      
      currentTime += segment.duration;
    }
    
    // The total duration is simply the sum of all segment durations
    // because the current mix engine (createMixInSections) concatenates
    // segments linearly without overlapping them.
    const totalDuration = sequence.reduce((sum, seg) => sum + seg.duration, 0);
    
    return {
      items,
      totalDuration
    };
  }

  /**
   * Get target energy based on profile
   */
  getTargetEnergy(progress, profile) {
    switch (profile) {
      case 'narrative':
        if (progress < 0.2) return 0.3 + (progress / 0.2) * 0.2;
        if (progress < 0.4) return 0.5 + ((progress - 0.2) / 0.2) * 0.3;
        if (progress < 0.6) return 0.8 + ((progress - 0.4) / 0.2) * 0.1;
        if (progress < 0.8) return 0.9 - ((progress - 0.6) / 0.2) * 0.3;
        return 0.6 - ((progress - 0.8) / 0.2) * 0.3;
      
      case 'build':
        return 0.3 + progress * 0.6;
      
      case 'wave':
        return 0.5 + Math.sin(progress * Math.PI * 2) * 0.3;
      
      case 'steady':
        return 0.65;
      
      default:
        return 0.6;
    }
  }

  /**
   * Calculate average compatibility across sequence
   */
  calculateAvgCompatibility(sequence) {
    if (sequence.length < 2) return 100;
    
    let total = 0;
    for (let i = 0; i < sequence.length - 1; i++) {
      total += this.calculateCompatibility(sequence[i], sequence[i + 1]);
    }
    
    return total / (sequence.length - 1);
  }

  /**
   * Count key changes in sequence
   */
  countKeyChanges(sequence) {
    let changes = 0;
    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i].key !== sequence[i - 1].key) {
        changes++;
      }
    }
    return changes;
  }

  /**
   * Get BPM range
   */
  getBPMRange(sequence) {
    const bpms = sequence.map(s => s.bpm).filter(b => b);
    if (bpms.length === 0) return { min: 0, max: 0 };
    
    return {
      min: Math.min(...bpms),
      max: Math.max(...bpms),
      avg: bpms.reduce((a, b) => a + b, 0) / bpms.length
    };
  }
}
