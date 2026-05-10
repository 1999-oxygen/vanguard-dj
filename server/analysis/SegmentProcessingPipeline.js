/**
 * Segment Processing Pipeline
 * Orchestrates the entire segment analysis workflow
 */

import { SegmentMetadataBuilder } from './AnalysisEngine.js';
import { EnergyAnalyzer } from './analyzers/EnergyAnalyzer.js';
import { SpectralAnalyzer } from './analyzers/SpectralAnalyzer.js';
import stemSeparator from './StemSeparator.js';
import segmentIndexer from './SegmentIndexer.js';
import mlExporter from './MLTrainingExporter.js';
import db from '../db.js';

export class SegmentProcessingPipeline {
  constructor() {
    this.metadataBuilder = new SegmentMetadataBuilder();
    this.analyzers = [
      new EnergyAnalyzer(),
      new SpectralAnalyzer()
      // Add more analyzers here
    ];
    
    this.pipeline = [
      { name: 'analyze', fn: this.runAnalysis.bind(this) },
      { name: 'validate', fn: this.validateSegments.bind(this) },
      { name: 'enrich', fn: this.enrichMetadata.bind(this) },
      { name: 'separate_stems', fn: this.separateStems.bind(this), optional: true },
      { name: 'index', fn: this.indexSegments.bind(this) },
      { name: 'store', fn: this.storeSegments.bind(this) },
      { name: 'export_ml', fn: this.exportForML.bind(this), optional: true }
    ];
  }

  /**
   * Process a track through the entire pipeline
   */
  async processTrack(trackId, audioPath, metadata, options = {}) {
    console.log(`\n🔬 Starting advanced pipeline for track ${trackId}...`);
    
    const context = {
      trackId,
      audioPath,
      metadata,
      options,
      segments: [],
      analysisResults: [],
      processedSegments: [],
      timestamp: new Date().toISOString()
    };

    try {
      for (const step of this.pipeline) {
        if (step.optional && !options[step.name]) {
          console.log(`⏭️  Skipping optional step: ${step.name}`);
          continue;
        }

        console.log(`\n▶️  Pipeline step: ${step.name}...`);
        const startTime = Date.now();
        
        await step.fn(context);
        
        const duration = Date.now() - startTime;
        console.log(`✅ ${step.name} completed in ${duration}ms`);
      }

      console.log(`\n✅ Pipeline complete! Processed ${context.processedSegments.length} segments`);

      return {
        success: true,
        trackId,
        segmentCount: context.processedSegments.length,
        segments: context.processedSegments,
        pipeline_duration: Date.now() - new Date(context.timestamp).getTime(),
        steps_completed: this.pipeline.length
      };

    } catch (error) {
      console.error(`❌ Pipeline failed:`, error);
      return {
        success: false,
        trackId,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Step 1: Run all analyzers
   */
  async runAnalysis(context) {
    const results = await Promise.all(
      this.analyzers.map(analyzer => 
        analyzer.analyze(context.audioPath, context.metadata.duration, context.metadata)
      )
    );

    context.analysisResults = results;
    
    const successfulResults = results.filter(r => r.success);
    console.log(`   📊 Analysis: ${successfulResults.length}/${results.length} methods successful`);

    // Combine segments from all successful methods
    context.segments = this.combineSegments(successfulResults);
    console.log(`   🎵 Generated ${context.segments.length} raw segments`);
  }

  /**
   * Step 2: Validate segments musically
   */
  async validateSegments(context) {
    const validator = this.metadataBuilder.validator;
    const bpm = context.metadata.bpm || 120;

    context.segments = context.segments.map(seg => {
      const validation = validator.validateSegment(seg, bpm);
      
      return {
        ...seg,
        validation,
        musically_valid: validation.valid,
        validation_confidence: validation.confidence
      };
    });

    const validCount = context.segments.filter(s => s.musically_valid).length;
    console.log(`   ✓ Validation: ${validCount}/${context.segments.length} musically valid`);

    // Optionally filter out invalid segments
    if (context.options.strict_validation) {
      context.segments = context.segments.filter(s => s.musically_valid);
      console.log(`   🎯 Strict mode: kept ${context.segments.length} valid segments`);
    }
  }

  /**
   * Step 3: Enrich with comprehensive metadata
   */
  async enrichMetadata(context) {
    const enriched = [];

    for (let i = 0; i < context.segments.length; i++) {
      const segment = context.segments[i];
      
      // Generate segment ID
      segment.id = `seg_${context.trackId}_${i}`;
      segment.trackId = context.trackId;

      // Build rich metadata
      const metadata = await this.metadataBuilder.buildMetadata(
        segment,
        context.audioPath,
        context.metadata,
        segment.method
      );

      enriched.push(metadata);

      if ((i + 1) % 10 === 0) {
        console.log(`   ⚙️  Enriched ${i + 1}/${context.segments.length} segments`);
      }
    }

    context.processedSegments = enriched;
    console.log(`   💎 Enriched ${enriched.length} segments with full metadata`);
  }

  /**
   * Step 4: Separate stems (optional)
   */
  async separateStems(context) {
    if (!context.options.separate_stems) {
      return;
    }

    console.log(`   🎼 Separating stems for ${context.processedSegments.length} segments...`);

    // Process in batches to avoid overwhelming the system
    const batchSize = context.options.stem_batch_size || 3;
    
    for (let i = 0; i < context.processedSegments.length; i += batchSize) {
      const batch = context.processedSegments.slice(i, i + batchSize);
      
      const stemResults = await Promise.all(
        batch.map(async (seg) => {
          // Segment audio should be extracted first (handled in store step)
          const segmentPath = `data/segments/${seg.id}.wav`;
          return await stemSeparator.separateSegmentStems(segmentPath, seg.id);
        })
      );

      // Update segment metadata with stem info
      stemResults.forEach((result, idx) => {
        if (result.success) {
          const segIdx = i + idx;
          context.processedSegments[segIdx].stems = {
            separated: true,
            vocals_path: result.stems.vocals,
            drums_path: result.stems.drums,
            bass_path: result.stems.bass,
            other_path: result.stems.other,
            separation_method: result.method,
            separation_timestamp: result.timestamp,
            quality_score: result.quality_score
          };
        }
      });

      console.log(`   🎵 Stems: ${i + batchSize}/${context.processedSegments.length}`);
    }

    const stemsCount = context.processedSegments.filter(s => s.stems?.separated).length;
    console.log(`   ✓ Separated stems for ${stemsCount} segments`);
  }

  /**
   * Step 5: Index segments for fast retrieval
   */
  async indexSegments(context) {
    context.processedSegments.forEach(segment => {
      segmentIndexer.indexSegment(segment);
    });

    const stats = segmentIndexer.getStats();
    console.log(`   📇 Indexed across ${stats.total_segments} segments in ${stats.bpm_buckets} BPM buckets`);
  }

  /**
   * Step 6: Store in database
   */
  async storeSegments(context) {
    for (const segment of context.processedSegments) {
      await this.storeSegmentInDB(segment);
    }

    console.log(`   💾 Stored ${context.processedSegments.length} segments in database`);
  }

  /**
   * Step 7: Export for ML training (optional)
   */
  async exportForML(context) {
    if (!context.options.export_ml) {
      return;
    }

    const formats = context.options.ml_formats || ['json', 'csv'];
    
    for (const format of formats) {
      await mlExporter.exportTrainingData(context.processedSegments, format);
    }

    console.log(`   🤖 Exported ML training data in formats: ${formats.join(', ')}`);
  }

  /**
   * Combine segments from multiple analysis methods
   */
  combineSegments(analysisResults) {
    const allSegments = [];
    
    analysisResults.forEach(result => {
      if (result.segments) {
        result.segments.forEach(seg => {
          allSegments.push({
            ...seg,
            method: result.method,
            confidence: result.confidence || 0.7,
            bpm: result.bpm || seg.bpm
          });
        });
      }
    });

    // Deduplicate based on start/end/method
    return this.deduplicateSegments(allSegments);
  }

  /**
   * Deduplicate segments
   */
  deduplicateSegments(segments) {
    const unique = [];
    const seen = new Set();
    
    segments.sort((a, b) => a.startTime - b.startTime);
    
    for (const seg of segments) {
      const key = `${seg.startTime.toFixed(2)}_${seg.endTime.toFixed(2)}_${seg.method}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(seg);
      }
    }
    
    return unique;
  }

  /**
   * Store segment in database with full metadata
   */
  async storeSegmentInDB(segment) {
    await db.run(
      `INSERT OR REPLACE INTO segments_v2 (
        id, track_id, start_time, end_time, duration,
        bpm, key, camelot_key, time_signature, beats, phrase_length,
        segment_type, energy, intensity, suitable_for,
        analysis_method, analysis_version, confidence,
        musical_validity, beat_aligned,
        features_temporal, features_spectral, features_harmonic, features_rhythmic, features_timbral,
        mix_in_point, mix_out_point, loop_compatible,
        stems_separated, stems_vocals_path, stems_drums_path, stems_bass_path, stems_other_path,
        stems_method, stems_quality,
        tags, ml_trainable, quality_score,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        segment.id,
        segment.track_id,
        segment.start_time,
        segment.end_time,
        segment.duration,
        segment.musical?.bpm,
        segment.musical?.key,
        segment.musical?.camelot_key,
        segment.musical?.time_signature,
        segment.musical?.beats,
        segment.musical?.phrase_length,
        segment.classification?.type,
        segment.classification?.energy,
        segment.classification?.intensity,
        segment.classification?.suitable_for,
        segment.analysis?.method,
        segment.analysis?.method_version,
        segment.analysis?.confidence,
        segment.musical?.musical_validity,
        segment.musical?.beat_aligned,
        JSON.stringify(segment.features?.temporal || {}),
        JSON.stringify(segment.features?.spectral || {}),
        JSON.stringify(segment.features?.harmonic || {}),
        JSON.stringify(segment.features?.rhythmic || {}),
        JSON.stringify(segment.features?.timbral || {}),
        segment.mixing?.mix_in_point,
        segment.mixing?.mix_out_point,
        segment.mixing?.loop_compatible,
        segment.stems?.separated ? 1 : 0,
        segment.stems?.vocals_path,
        segment.stems?.drums_path,
        segment.stems?.bass_path,
        segment.stems?.other_path,
        segment.stems?.separation_method,
        segment.stems?.quality_score,
        JSON.stringify(segment.tags || []),
        segment.ml_metadata?.trainable ? 1 : 0,
        segment.ml_metadata?.quality_score,
        segment.created_at
      ]
    );
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    return {
      analyzers: this.analyzers.map(a => a.getMetadata()),
      pipeline_steps: this.pipeline.length,
      indexer_stats: segmentIndexer.getStats()
    };
  }
}

export default new SegmentProcessingPipeline();
