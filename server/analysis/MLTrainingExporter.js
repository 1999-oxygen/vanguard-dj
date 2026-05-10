/**
 * ML Training Data Exporter
 * Exports segments and metadata in ML-ready formats
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class MLTrainingExporter {
  constructor() {
    this.exportDir = path.join(__dirname, '../../ml_training_data');
    this.formats = ['json', 'csv', 'tfrecord', 'parquet'];
  }

  /**
   * Export segments for ML training
   */
  async exportTrainingData(segments, format = 'json', options = {}) {
    console.log(`📊 Exporting ${segments.length} segments as ${format}...`);

    await fs.mkdir(this.exportDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `training_data_${timestamp}`;

    switch (format) {
      case 'json':
        return await this.exportJSON(segments, filename, options);
      case 'csv':
        return await this.exportCSV(segments, filename, options);
      case 'tfrecord':
        return await this.exportTFRecord(segments, filename, options);
      case 'parquet':
        return await this.exportParquet(segments, filename, options);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Export as JSON (best for inspection and debugging)
   */
  async exportJSON(segments, filename, options) {
    const data = {
      metadata: {
        export_timestamp: new Date().toISOString(),
        total_segments: segments.length,
        version: '2.0',
        schema_version: '2.0'
      },
      segments: segments.map(seg => this.prepareSegmentForExport(seg, options))
    };

    const filepath = path.join(this.exportDir, `${filename}.json`);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));

    console.log(`✅ Exported to ${filepath}`);
    return { success: true, filepath, format: 'json', count: segments.length };
  }

  /**
   * Export as CSV (best for pandas/R analysis)
   */
  async exportCSV(segments, filename, options) {
    const rows = segments.map(seg => this.flattenSegmentForCSV(seg));
    
    if (rows.length === 0) {
      throw new Error('No segments to export');
    }

    // Get all unique keys from all rows
    const allKeys = [...new Set(rows.flatMap(Object.keys))];
    
    // Create CSV header
    const header = allKeys.join(',');
    
    // Create CSV rows
    const csvRows = rows.map(row => 
      allKeys.map(key => {
        const value = row[key];
        // Escape commas and quotes in values
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    );

    const csv = [header, ...csvRows].join('\n');
    
    const filepath = path.join(this.exportDir, `${filename}.csv`);
    await fs.writeFile(filepath, csv);

    console.log(`✅ Exported to ${filepath}`);
    return { success: true, filepath, format: 'csv', count: segments.length };
  }

  /**
   * Export as TFRecord format (for TensorFlow)
   */
  async exportTFRecord(segments, filename, options) {
    // Placeholder for TFRecord export
    // In production, use @tensorflow/tfjs-node for actual TFRecord writing
    
    const tfData = segments.map(seg => ({
      features: this.extractFeatureVector(seg),
      label: this.extractLabel(seg, options)
    }));

    const filepath = path.join(this.exportDir, `${filename}.tfrecord.json`);
    await fs.writeFile(filepath, JSON.stringify(tfData, null, 2));

    console.log(`✅ Exported to ${filepath} (JSON format, convert to TFRecord separately)`);
    return { success: true, filepath, format: 'tfrecord_json', count: segments.length };
  }

  /**
   * Export as Parquet (for big data processing)
   */
  async exportParquet(segments, filename, options) {
    // Placeholder for Parquet export
    // In production, use parquetjs library
    
    const parquetData = segments.map(seg => this.flattenSegmentForCSV(seg));
    
    const filepath = path.join(this.exportDir, `${filename}.parquet.json`);
    await fs.writeFile(filepath, JSON.stringify(parquetData, null, 2));

    console.log(`✅ Exported to ${filepath} (JSON format, convert to Parquet separately)`);
    return { success: true, filepath, format: 'parquet_json', count: segments.length };
  }

  /**
   * Prepare segment for export
   */
  prepareSegmentForExport(segment, options = {}) {
    return {
      // Core identification
      id: segment.id,
      track_id: segment.track_id,
      
      // Timing
      start_time: segment.start_time,
      end_time: segment.end_time,
      duration: segment.duration,
      
      // Musical metadata
      musical: segment.musical || {},
      
      // Classification
      classification: segment.classification || {},
      
      // Features (rich ML data)
      features: segment.features || {},
      
      // Analysis metadata
      analysis: segment.analysis || {},
      
      // Mixing metadata
      mixing: segment.mixing || {},
      
      // Stems (if available)
      stems: segment.stems || {},
      
      // Tags for filtering
      tags: segment.tags || [],
      
      // ML metadata
      ml_metadata: segment.ml_metadata || {}
    };
  }

  /**
   * Flatten segment to single-level object for CSV
   */
  flattenSegmentForCSV(segment) {
    const flat = {
      id: segment.id,
      track_id: segment.track_id,
      start_time: segment.start_time,
      end_time: segment.end_time,
      duration: segment.duration,
      
      // Musical
      bpm: segment.musical?.bpm,
      key: segment.musical?.key,
      camelot_key: segment.musical?.camelot_key,
      beats: segment.musical?.beats,
      
      // Classification
      type: segment.classification?.type,
      energy: segment.classification?.energy,
      intensity: segment.classification?.intensity,
      suitable_for: segment.classification?.suitable_for,
      
      // Analysis
      method: segment.analysis?.method,
      confidence: segment.analysis?.confidence,
      
      // Features (flatten nested objects)
      ...this.flattenFeatures(segment.features || {}),
      
      // Mixing
      mix_in_point: segment.mixing?.mix_in_point,
      mix_out_point: segment.mixing?.mix_out_point,
      loop_compatible: segment.mixing?.loop_compatible,
      
      // Stems
      has_stems: segment.stems?.separated ? 1 : 0,
      stems_method: segment.stems?.separation_method,
      
      // Tags
      tags: (segment.tags || []).join('|'),
      
      // ML
      trainable: segment.ml_metadata?.trainable ? 1 : 0,
      quality_score: segment.ml_metadata?.quality_score
    };

    return flat;
  }

  /**
   * Flatten nested features object
   */
  flattenFeatures(features) {
    const flat = {};
    
    // Temporal features
    if (features.temporal) {
      Object.entries(features.temporal).forEach(([key, value]) => {
        if (typeof value === 'number') {
          flat[`temporal_${key}`] = value;
        }
      });
    }
    
    // Spectral features
    if (features.spectral) {
      Object.entries(features.spectral).forEach(([key, value]) => {
        if (typeof value === 'number') {
          flat[`spectral_${key}`] = value;
        }
      });
    }
    
    // Harmonic features
    if (features.harmonic) {
      Object.entries(features.harmonic).forEach(([key, value]) => {
        if (typeof value === 'number') {
          flat[`harmonic_${key}`] = value;
        } else if (Array.isArray(value) && value.length === 12) {
          // Chroma vector
          value.forEach((v, i) => {
            flat[`chroma_${i}`] = v;
          });
        }
      });
    }
    
    // Rhythmic features
    if (features.rhythmic) {
      Object.entries(features.rhythmic).forEach(([key, value]) => {
        if (typeof value === 'number') {
          flat[`rhythmic_${key}`] = value;
        }
      });
    }
    
    // Timbral features
    if (features.timbral) {
      Object.entries(features.timbral).forEach(([key, value]) => {
        if (typeof value === 'number') {
          flat[`timbral_${key}`] = value;
        } else if (Array.isArray(value) && key.includes('mfcc')) {
          // MFCC coefficients
          value.forEach((v, i) => {
            flat[`mfcc_${i}`] = v;
          });
        }
      });
    }
    
    return flat;
  }

  /**
   * Extract feature vector for ML models
   */
  extractFeatureVector(segment) {
    const vector = [];
    
    // Add numeric features in consistent order
    const features = segment.features || {};
    
    // Temporal (10 features)
    if (features.temporal) {
      vector.push(
        features.temporal.rms_mean || 0,
        features.temporal.rms_std || 0,
        features.temporal.rms_max || 0,
        features.temporal.rms_min || 0,
        features.temporal.zcr_mean || 0,
        features.temporal.zcr_std || 0,
        features.temporal.attack_time || 0,
        features.temporal.decay_time || 0,
        features.temporal.sustain_level || 0,
        features.temporal.release_time || 0
      );
    }
    
    // Spectral (10 features)
    if (features.spectral) {
      vector.push(
        features.spectral.centroid_mean || 0,
        features.spectral.centroid_std || 0,
        features.spectral.rolloff_mean || 0,
        features.spectral.rolloff_std || 0,
        features.spectral.flux_mean || 0,
        features.spectral.flux_std || 0,
        features.spectral.flatness_mean || 0,
        features.spectral.flatness_std || 0,
        features.spectral.bandwidth_mean || 0,
        features.spectral.bandwidth_std || 0
      );
    }
    
    // Chroma (12 features)
    if (features.harmonic?.chroma_vector) {
      vector.push(...features.harmonic.chroma_vector);
    }
    
    // Rhythmic (7 features)
    if (features.rhythmic) {
      vector.push(
        features.rhythmic.onset_strength_mean || 0,
        features.rhythmic.onset_strength_std || 0,
        features.rhythmic.onset_density || 0,
        features.rhythmic.tempo_stability || 0,
        features.rhythmic.beat_strength || 0,
        features.rhythmic.syncopation || 0,
        features.rhythmic.groove_consistency || 0
      );
    }
    
    // MFCC (13 features)
    if (features.timbral?.mfcc_mean) {
      vector.push(...features.timbral.mfcc_mean);
    }
    
    // Musical features (5 features)
    vector.push(
      segment.musical?.bpm || 120,
      segment.musical?.beats || 16,
      segment.classification?.energy || 0.5,
      segment.analysis?.confidence || 0.7,
      segment.ml_metadata?.quality_score || 0.7
    );
    
    return vector;
  }

  /**
   * Extract label for supervised learning
   */
  extractLabel(segment, options = {}) {
    if (options.labelType === 'energy') {
      return segment.classification?.energy || 0.5;
    }
    
    if (options.labelType === 'type') {
      return segment.classification?.type || 'REGULAR';
    }
    
    if (options.labelType === 'quality') {
      return segment.ml_metadata?.quality_score || 0.7;
    }
    
    // Default: multi-class classification by segment type
    return {
      type: segment.classification?.type || 'REGULAR',
      energy: segment.classification?.energy || 0.5,
      quality: segment.ml_metadata?.quality_score || 0.7
    };
  }

  /**
   * Create training/validation split
   */
  async createTrainValSplit(segments, trainRatio = 0.8) {
    const shuffled = [...segments].sort(() => Math.random() - 0.5);
    const splitIdx = Math.floor(segments.length * trainRatio);
    
    const trainSet = shuffled.slice(0, splitIdx);
    const valSet = shuffled.slice(splitIdx);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    await this.exportJSON(trainSet, `train_${timestamp}`, {});
    await this.exportJSON(valSet, `val_${timestamp}`, {});
    
    console.log(`✅ Created train/val split: ${trainSet.length}/${valSet.length}`);
    
    return {
      train: trainSet.length,
      val: valSet.length,
      total: segments.length
    };
  }
}

export default new MLTrainingExporter();
