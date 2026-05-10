/**
 * Intelligent Mix Sequencer
 * Creates unpredictable, industry-leading DJ mixes with smart transitions
 */

export class IntelligentMixSequencer {
  constructor() {
    this.transitionTypes = [
      'BEATMATCH',
      'CROSSFADE',
      'ECHO_OUT',
      'FILTER_SWEEP',
      'DYNAMIC_EQ',
      'SMOOTH_FADE',
      'HARD_CUT',
      'REVERB_TAIL',
      'SPINBACK',
      'BRAKE_EFFECT'
    ];
  }

  /**
   * Create an intelligent, unpredictable mix sequence
   * Uses energy flow, harmonic mixing, and creative transitions
   */
  createIntelligentSequence(segments) {
    if (segments.length === 0) return [];
    
    console.log(`🎯 Creating intelligent sequence from ${segments.length} segments...`);
    
    // Analyze segments
    const analyzedSegments = segments.map(seg => ({
      ...seg,
      energyScore: this.calculateEnergyScore(seg),
      harmonicScore: this.calculateHarmonicScore(seg),
      rhythmicScore: this.calculateRhythmicScore(seg),
      uniqueness: Math.random() // Add randomness
    }));
    
    // Create energy journey (build, peak, release)
    const sequence = this.createEnergyJourney(analyzedSegments);
    
    // Add intelligent transitions
    const sequenceWithTransitions = this.addIntelligentTransitions(sequence);
    
    console.log(`✅ Created ${sequenceWithTransitions.length} segment sequence`);
    return sequenceWithTransitions;
  }

  /**
   * Create an energy journey: intro → build → peak → outro
   */
  createEnergyJourney(segments) {
    const journey = [];
    const totalSegments = segments.length;
    
    // Sort by energy for selection
    const lowEnergy = segments.filter(s => s.energy < 0.4).sort(() => Math.random() - 0.5);
    const midEnergy = segments.filter(s => s.energy >= 0.4 && s.energy < 0.7).sort(() => Math.random() - 0.5);
    const highEnergy = segments.filter(s => s.energy >= 0.7).sort(() => Math.random() - 0.5);
    
    // Phase 1: Intro (20%) - Low to mid energy
    const introCount = Math.max(1, Math.floor(totalSegments * 0.2));
    for (let i = 0; i < introCount && (lowEnergy.length > 0 || midEnergy.length > 0); i++) {
      const seg = (lowEnergy.length > 0 ? lowEnergy : midEnergy).shift();
      if (seg) journey.push({ ...seg, phase: 'INTRO' });
    }
    
    // Phase 2: Build (30%) - Mid to high energy
    const buildCount = Math.max(1, Math.floor(totalSegments * 0.3));
    for (let i = 0; i < buildCount && (midEnergy.length > 0 || highEnergy.length > 0); i++) {
      const seg = (midEnergy.length > 0 ? midEnergy : highEnergy).shift();
      if (seg) journey.push({ ...seg, phase: 'BUILD' });
    }
    
    // Phase 3: Peak (30%) - High energy
    const peakCount = Math.max(1, Math.floor(totalSegments * 0.3));
    for (let i = 0; i < peakCount && highEnergy.length > 0; i++) {
      const seg = highEnergy.shift();
      if (seg) journey.push({ ...seg, phase: 'PEAK' });
    }
    
    // Phase 4: Outro (20%) - High to mid to low
    const outroCount = Math.max(1, totalSegments - journey.length);
    const remaining = [...highEnergy, ...midEnergy, ...lowEnergy].sort((a, b) => b.energy - a.energy);
    for (let i = 0; i < outroCount && remaining.length > 0; i++) {
      const seg = remaining.shift();
      if (seg) journey.push({ ...seg, phase: 'OUTRO' });
    }
    
    return journey;
  }

  /**
   * Add intelligent transitions based on segment characteristics
   */
  addIntelligentTransitions(sequence) {
    return sequence.map((seg, index) => {
      const nextSeg = sequence[index + 1];
      
      if (!nextSeg) {
        return {
          ...seg,
          position: index,
          transitionType: 'FADE_OUT',
          transitionDuration: 4.0
        };
      }
      
      // Calculate transition based on energy difference and phase
      const energyDiff = Math.abs(seg.energy - nextSeg.energy);
      const bpmDiff = Math.abs((seg.bpm || 120) - (nextSeg.bpm || 120));
      
      const transition = this.selectIntelligentTransition(
        seg,
        nextSeg,
        energyDiff,
        bpmDiff
      );
      
      return {
        ...seg,
        position: index,
        ...transition
      };
    });
  }

  /**
   * Select the best transition type based on segment characteristics
   */
  selectIntelligentTransition(currentSeg, nextSeg, energyDiff, bpmDiff) {
    const phase = currentSeg.phase;
    
    // INTRO phase - smooth, subtle transitions
    if (phase === 'INTRO') {
      if (energyDiff < 0.2) {
        return {
          transitionType: 'SMOOTH_FADE',
          transitionDuration: 8.0
        };
      }
      return {
        transitionType: 'CROSSFADE',
        transitionDuration: 6.0
      };
    }
    
    // BUILD phase - creative, building transitions
    if (phase === 'BUILD') {
      if (nextSeg.energy > currentSeg.energy) {
        // Building energy - use filter sweep or dynamic EQ
        return Math.random() > 0.5 ? {
          transitionType: 'FILTER_SWEEP',
          transitionDuration: 4.0
        } : {
          transitionType: 'DYNAMIC_EQ',
          transitionDuration: 4.0
        };
      }
      return {
        transitionType: 'CROSSFADE',
        transitionDuration: 4.0
      };
    }
    
    // PEAK phase - energetic, impactful transitions
    if (phase === 'PEAK') {
      if (bpmDiff < 3 && energyDiff < 0.3) {
        // Perfect for beatmatching
        return {
          transitionType: 'BEATMATCH',
          transitionDuration: 2.0
        };
      }
      
      if (nextSeg.segment_type === 'DROP') {
        // Dramatic transition to drop
        return Math.random() > 0.5 ? {
          transitionType: 'SPINBACK',
          transitionDuration: 1.0
        } : {
          transitionType: 'BRAKE_EFFECT',
          transitionDuration: 1.5
        };
      }
      
      // Random creative transition
      const creativeTransitions = ['ECHO_OUT', 'REVERB_TAIL', 'HARD_CUT'];
      return {
        transitionType: creativeTransitions[Math.floor(Math.random() * creativeTransitions.length)],
        transitionDuration: 2.0
      };
    }
    
    // OUTRO phase - smooth, closing transitions
    if (phase === 'OUTRO') {
      if (energyDiff > 0.3) {
        return {
          transitionType: 'ECHO_OUT',
          transitionDuration: 6.0
        };
      }
      return {
        transitionType: 'SMOOTH_FADE',
        transitionDuration: 8.0
      };
    }
    
    // Default - standard crossfade
    return {
      transitionType: 'CROSSFADE',
      transitionDuration: 4.0
    };
  }

  /**
   * Calculate energy score (0-1)
   */
  calculateEnergyScore(segment) {
    const energy = segment.energy || 0.5;
    const peakEnergy = segment.peak_energy || energy;
    const variance = segment.energy_variance || 0;
    
    return (energy * 0.6) + (peakEnergy * 0.3) + (variance * 0.1);
  }

  /**
   * Calculate harmonic score based on key compatibility
   */
  calculateHarmonicScore(segment) {
    // Simplified - could use Camelot wheel
    const key = segment.key || 'C';
    const harmonicContent = segment.harmonic_content || '8B';
    
    // Higher score for clear harmonic content
    return harmonicContent ? 0.8 : 0.5;
  }

  /**
   * Calculate rhythmic score
   */
  calculateRhythmicScore(segment) {
    const rhythmicComplexity = segment.rhythmic_complexity || 0.5;
    const onsetDensity = segment.onset_density || 0.5;
    
    return (rhythmicComplexity * 0.5) + (onsetDensity * 0.5);
  }

  /**
   * Create a completely random, unpredictable sequence
   */
  createRandomSequence(segments) {
    console.log(`🎲 Creating random unpredictable sequence...`);
    
    // Shuffle segments randomly
    const shuffled = [...segments].sort(() => Math.random() - 0.5);
    
    // Add random transitions
    return shuffled.map((seg, index) => {
      const randomTransition = this.transitionTypes[
        Math.floor(Math.random() * this.transitionTypes.length)
      ];
      
      const randomDuration = [1.0, 2.0, 4.0, 6.0, 8.0][
        Math.floor(Math.random() * 5)
      ];
      
      return {
        ...seg,
        position: index,
        transitionType: randomTransition,
        transitionDuration: randomDuration,
        phase: 'RANDOM'
      };
    });
  }

  /**
   * Create a hybrid sequence - intelligent with random elements
   */
  createHybridSequence(segments) {
    console.log(`🎨 Creating hybrid intelligent-random sequence...`);
    
    // 70% intelligent, 30% random
    const intelligentCount = Math.floor(segments.length * 0.7);
    
    // Get intelligent sequence
    const intelligent = this.createIntelligentSequence(segments.slice(0, intelligentCount));
    
    // Get random sequence for remaining
    const random = this.createRandomSequence(segments.slice(intelligentCount));
    
    // Merge and reposition
    const hybrid = [...intelligent, ...random].map((seg, index) => ({
      ...seg,
      position: index
    }));
    
    console.log(`✅ Created hybrid sequence: ${intelligent.length} intelligent + ${random.length} random`);
    return hybrid;
  }
}

export default new IntelligentMixSequencer();
