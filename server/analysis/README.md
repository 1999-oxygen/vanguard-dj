# 🎵 Vanguard DJ Analysis Engine v2.0

## Industry-Leading Segment Analysis System

### Overview
This is a **modular, ML-ready, and musically accurate** segment analysis engine designed for professional DJ applications and machine learning research.

---

## 🏗️ Architecture

```
AnalysisEngine.js (Core Components)
├── BaseAnalyzer (Abstract base for all analyzers)
├── MusicalTheoryValidator (Validates segments musically)
├── AudioFeatureExtractor (Extracts 60+ audio features)
└── SegmentMetadataBuilder (Builds rich metadata)

analyzers/ (Pluggable Analyzers)
├── EnergyAnalyzer.js (Energy-based segmentation)
├── SpectralAnalyzer.js (Spectral analysis)
└── [Add more analyzers here]

SegmentProcessingPipeline.js (Main orchestrator)
├── 1. Analysis (Run all analyzers)
├── 2. Validation (Musical theory validation)
├── 3. Enrichment (Add rich metadata)
├── 4. Stem Separation (Optional)
├── 5. Indexing (Multi-dimensional indexing)
├── 6. Storage (Database persistence)
└── 7. ML Export (Training data export)

StemSeparator.js (Stem separation)
├── Spleeter integration
├── Demucs integration
└── Hybrid method

SegmentIndexer.js (Advanced indexing)
├── BPM index
├── Key index
├── Energy index
├── Type index
├── Duration index
├── Tag index
└── Feature similarity index

MLTrainingExporter.js (ML export)
├── JSON export
├── CSV export
├── TFRecord export
└── Parquet export
```

---

## 📊 Rich Metadata Schema

Each segment includes:

### Core Identification
- `id`: Unique segment identifier
- `track_id`: Parent track reference
- `version`: Schema version
- `created_at`: Timestamp

### Timing
- `start_time`: Start time in seconds
- `end_time`: End time in seconds
- `duration`: Duration in seconds

### Musical Properties
- `bpm`: Beats per minute
- `key`: Musical key (e.g., "C", "Am")
- `camelot_key`: Camelot notation (e.g., "8A")
- `compatible_keys`: Array of harmonically compatible keys
- `time_signature`: Time signature (e.g., "4/4")
- `beats`: Number of beats in segment
- `phrase_length`: Nearest standard phrase length (4, 8, 16, 32, 64)
- `beat_aligned`: Boolean indicating beat alignment
- `musical_validity`: Musical theory validation score
- `musical_confidence`: Confidence in musical validity

### Classification
- `type`: Segment type (INTRO, VERSE, CHORUS, BREAKDOWN, BUILD, DROP, TRANSITION, OUTRO)
- `energy`: Energy level (0-1)
- `intensity`: Intensity level (LOW, MEDIUM, HIGH)
- `suitable_for`: Use case (opening, verse, climax, breakdown, buildup, drop, transition, ending)
- `is_intro`, `is_outro`, `is_buildup`, etc.: Boolean flags

### Analysis Metadata
- `method`: Analysis method name
- `method_version`: Analyzer version
- `confidence`: Analysis confidence score
- `analyzer_name`: Analyzer identifier
- `analysis_timestamp`: When analysis was performed

### Audio Features (60+ features for ML)

#### Temporal Features (10)
- `rms_mean`, `rms_std`, `rms_max`, `rms_min`
- `zcr_mean`, `zcr_std`
- `attack_time`, `decay_time`, `sustain_level`, `release_time`

#### Spectral Features (10)
- `centroid_mean`, `centroid_std`
- `rolloff_mean`, `rolloff_std`
- `flux_mean`, `flux_std`
- `flatness_mean`, `flatness_std`
- `bandwidth_mean`, `bandwidth_std`

#### Harmonic Features (17)
- `chroma_vector` (12 dimensions)
- `key_strength`
- `harmonic_ratio`
- `inharmonicity`
- `tuning_frequency`

#### Rhythmic Features (7)
- `onset_strength_mean`, `onset_strength_std`
- `onset_density`
- `tempo_stability`
- `beat_strength`
- `syncopation`
- `groove_consistency`

#### Timbral Features (30+)
- `mfcc_mean` (13 dimensions)
- `mfcc_std` (13 dimensions)
- `spectral_contrast_mean` (7 dimensions)
- `spectral_contrast_std` (7 dimensions)
- `brightness`, `warmth`, `roughness`

### Mixing Metadata
- `mix_in_point`: Recommended mix-in point (seconds)
- `mix_out_point`: Recommended mix-out point (seconds)
- `loop_compatible`: Boolean indicating loop compatibility
- `crossfade_recommended`: Boolean for crossfade recommendation
- `optimal_transition_duration`: Recommended transition duration

### Stem Separation
- `separated`: Boolean indicating stem separation status
- `vocals_path`, `drums_path`, `bass_path`, `other_path`: Stem file paths
- `separation_method`: Method used (spleeter, demucs, hybrid)
- `separation_timestamp`: When stems were separated
- `quality_score`: Stem separation quality (0-1)

### Indexing Tags
Array of searchable tags:
- BPM tags (e.g., "120bpm")
- Key tags
- Beat count tags
- Energy tags (high_energy, low_energy, medium_energy)
- Type tags (intro, verse, chorus, etc.)
- Feature tags (bright, dark, busy, melodic)
- Validity tags (musically_valid, beat_aligned)

### ML Training Metadata
- `trainable`: Boolean indicating if ready for ML
- `quality_score`: Overall quality score (0-1)
- `feature_vector_ready`: Boolean for feature vector availability
- `labeled`: Boolean indicating if labeled
- `label_confidence`: Label confidence score

---

## 🔌 Creating Custom Analyzers

```javascript
import { BaseAnalyzer } from '../AnalysisEngine.js';

export class MyCustomAnalyzer extends BaseAnalyzer {
  constructor() {
    super('MY_ANALYZER_NAME', '1.0');
  }

  async analyze(audioPath, duration, metadata) {
    try {
      // Your analysis logic here
      const segments = [];
      
      // Create segments with timing and properties
      segments.push({
        startTime: 0,
        endTime: 8,
        duration: 8,
        energy: 0.7,
        segmentType: 'INTRO',
        bpm: metadata.bpm || 120,
        confidence: 0.9,
        characteristics: {
          dynamic: false,
          intensity: 'MEDIUM',
          suitable_for: 'opening'
        }
      });

      return {
        success: true,
        method: this.name,
        version: this.version,
        confidence: 0.85,
        segments,
        metadata: {
          // Additional metadata
        }
      };
    } catch (error) {
      return {
        success: false,
        method: this.name,
        error: error.message
      };
    }
  }
}
```

Add your analyzer to the pipeline:
```javascript
// In SegmentProcessingPipeline.js
import { MyCustomAnalyzer } from './analyzers/MyCustomAnalyzer.js';

constructor() {
  this.analyzers = [
    new EnergyAnalyzer(),
    new SpectralAnalyzer(),
    new MyCustomAnalyzer() // Add here
  ];
}
```

---

## 🚀 Usage

### Basic Usage
```javascript
import pipeline from './analysis/SegmentProcessingPipeline.js';

const result = await pipeline.processTrack(
  'track_123',
  '/path/to/audio.wav',
  { duration: 180, bpm: 120, key: 'Am' }
);
```

### With Stem Separation
```javascript
const result = await pipeline.processTrack(
  'track_123',
  '/path/to/audio.wav',
  { duration: 180, bpm: 120, key: 'Am' },
  {
    separate_stems: true,
    stem_batch_size: 3
  }
);
```

### With ML Export
```javascript
const result = await pipeline.processTrack(
  'track_123',
  '/path/to/audio.wav',
  { duration: 180, bpm: 120, key: 'Am' },
  {
    export_ml: true,
    ml_formats: ['json', 'csv', 'tfrecord']
  }
);
```

### Querying Segments
```javascript
import segmentIndexer from './analysis/SegmentIndexer.js';

// Find segments by criteria
const segments = segmentIndexer.query({
  bpm: 120,
  key: '8A',
  energy: { min: 0.6, max: 0.9 },
  type: 'CHORUS',
  duration: { min: 8, max: 16 },
  tags: ['high_energy', 'melodic']
});

// Find similar segments
const similar = segmentIndexer.findSimilar('seg_track_123_0', 10);
```

### Exporting for ML Training
```javascript
import mlExporter from './analysis/MLTrainingExporter.js';

// Export as JSON
await mlExporter.exportTrainingData(segments, 'json');

// Export as CSV (for pandas)
await mlExporter.exportTrainingData(segments, 'csv');

// Create train/validation split
await mlExporter.createTrainValSplit(segments, 0.8);
```

---

## 🤖 Machine Learning Integration

### Feature Vector
Each segment exports a **57-dimensional feature vector**:
- Temporal: 10 features
- Spectral: 10 features
- Chroma: 12 features
- Rhythmic: 7 features
- MFCC: 13 features
- Musical: 5 features

### Training Data Format
```json
{
  "features": [0.5, 0.1, 0.8, ...], // 57 dimensions
  "label": {
    "type": "CHORUS",
    "energy": 0.85,
    "quality": 0.9
  }
}
```

### Example: Training a Segment Classifier
```python
import pandas as pd
import json

# Load exported data
df = pd.read_csv('training_data_*.csv')

# Features are flattened with prefixes
temporal_features = [col for col in df.columns if col.startswith('temporal_')]
spectral_features = [col for col in df.columns if col.startswith('spectral_')]
mfcc_features = [col for col in df.columns if col.startswith('mfcc_')]

X = df[temporal_features + spectral_features + mfcc_features]
y = df['type']

# Train your model
from sklearn.ensemble import RandomForestClassifier
model = RandomForestClassifier()
model.fit(X, y)
```

---

## 📈 Performance Optimization

### Indexing Performance
- **BPM queries**: O(1) lookup, O(k) scan where k = bucket size
- **Key queries**: O(1) lookup
- **Energy queries**: O(1) lookup per bucket
- **Similarity search**: O(n) for full scan, O(log n) with feature hashing

### Memory Usage
- Average segment: ~5KB (with features)
- 1000 segments: ~5MB
- Indexes add ~20% overhead

### Batch Processing
```javascript
// Process multiple tracks efficiently
const tracks = [track1, track2, track3];

for (const track of tracks) {
  await pipeline.processTrack(track.id, track.path, track.metadata);
}
```

---

## 🎯 Best Practices

1. **Always validate segments musically** - Use strict_validation for production
2. **Index segments immediately** - Enables fast querying
3. **Separate stems in batches** - Avoid overwhelming CPU/disk
4. **Export ML data regularly** - Build training datasets incrementally
5. **Use appropriate analyzers** - Match analyzers to music genre
6. **Monitor quality scores** - Filter low-quality segments
7. **Keep metadata rich** - More data = better ML models

---

## 🔧 Configuration

Add to pipeline options:
```javascript
{
  strict_validation: true,      // Only keep musically valid segments
  separate_stems: true,          // Enable stem separation
  stem_batch_size: 3,            // Parallel stem separation limit
  export_ml: true,               // Export ML training data
  ml_formats: ['json', 'csv'],   // Export formats
  min_confidence: 0.7,           // Minimum analysis confidence
  min_duration: 2,               // Minimum segment duration (seconds)
  max_duration: 32               // Maximum segment duration (seconds)
}
```

---

## 📚 Database Schema

### segments_v2 Table
- 38 columns of rich metadata
- 6 indexes for fast queries
- JSON fields for nested structures
- Foreign key to tracks table

### Indexes
- `idx_segments_v2_bpm`: BPM-based queries
- `idx_segments_v2_key`: Key-based queries
- `idx_segments_v2_energy`: Energy-based queries
- `idx_segments_v2_type`: Type-based queries
- `idx_segments_v2_duration`: Duration-based queries
- `idx_segments_v2_quality`: Quality-based queries

---

## 🎓 Future Enhancements

- [ ] Real Spleeter/Demucs integration
- [ ] GPU-accelerated feature extraction
- [ ] Distributed processing for large libraries
- [ ] Real-time analysis mode
- [ ] Advanced similarity metrics (DTW, cosine)
- [ ] Genre-specific analyzers
- [ ] Cloud storage integration
- [ ] Collaborative filtering for recommendations
- [ ] Active learning for segment labeling

---

## 📄 License
Part of Vanguard DJ v3.3 - Elite Auto DJ System
