import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { analyzeTrack, universalAnalyze, analyzeBatch } from './analyze.js';
import audioProcessor from './audioProcessor.js';
import advancedAnalyzer from './advancedAudioAnalyzer.js';
import segmentIndexer from './segmentIndexer.js';
import intelligentSequencer from './intelligentMixSequencer.js';
import mixEngine from './mixEngine.js';
import db from './db.js';
import IntelligentMixEngine from './analysis/IntelligentMixEngine.js';
import advancedIndexer from './analysis/SegmentIndexer.js';
import pipeline from './analysis/SegmentProcessingPipeline.js';
import stemSeparator from './analysis/StemSeparator.js';
import mlExporter from './analysis/MLTrainingExporter.js';
import { IntelligentSegmentConnector } from './analysis/SegmentConnector.js';
import { registerIntelligentRoutes } from './intelligent/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const app = express();
const upload = multer({ dest: UPLOAD_DIR });

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      /^https?:\/\/100\.\d+\.\d+\.\d+(:\d+)?$/.test(origin) ||
      origin === 'https://vanguard.vercel.app'
    ) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' })); // Increase limit to avoid 413 errors
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/data/segments', express.static(path.join(__dirname, '../data/segments')));
app.use('/data/stems', express.static(path.join(__dirname, '../data/stems')));
app.use('/data/mixes', express.static(path.join(__dirname, '../data/mixes')));
app.use('/data/dj_segments', express.static(path.join(__dirname, '../data/dj_segments')));

// Initialize intelligent mix engine
const intelligentMixer = new IntelligentMixEngine(advancedIndexer, db);

// Initialize intelligent segment connector
const segmentConnector = new IntelligentSegmentConnector(db, advancedIndexer);

// Mount the new "industry-leading" intelligent pipeline routes.
registerIntelligentRoutes(app);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: 'node-v1.0', timestamp: new Date().toISOString() });
});
app.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    const dna = await analyzeTrack(req.file.path);
    res.json(dna);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/analyze_batch', upload.array('files', 10), async (req, res) => {
  try {
    const filePaths = req.files.map(f => f.path);
    const results = await analyzeBatch(filePaths);
    res.json(results);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/tracks/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('❌ No file uploaded');
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    console.log('📤 Upload received:', req.file.originalname);
    console.log('📁 File path:', req.file.path);
    
    const trackId = `track_${Date.now()}`;
    
    // Get metadata with fallback
    let metadata;
    try {
      metadata = await audioProcessor.getAudioMetadata(req.file.path);
      console.log('✅ Metadata extracted:', metadata);
    } catch (metaError) {
      console.warn('⚠️ Metadata extraction failed, using defaults:', metaError.message);
      metadata = {
        duration: 60,
        sampleRate: 44100,
        channels: 2,
        bitrate: 320000
      };
    }
    
    // Insert into database
    await db.run(
      `INSERT INTO tracks (id, filename, original_path, duration, sample_rate, channels, processed) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [trackId, req.file.originalname, req.file.path, metadata.duration, metadata.sampleRate, metadata.channels, 0]
    );
    
    console.log('✅ Track saved to database:', trackId);
    
    res.json({ 
      success: true, 
      trackId,
      filename: req.file.originalname,
      metadata 
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/tracks/:trackId/process', async (req, res) => {
  try {
    const { trackId } = req.params;
    console.log(`🔄 Processing track with ADVANCED MULTI-METHOD ANALYSIS: ${trackId}`);
    
    const track = await db.get('SELECT * FROM tracks WHERE id = ?', [trackId]);
    
    if (!track) {
      console.error(`❌ Track not found: ${trackId}`);
      return res.status(404).json({ success: false, error: 'Track not found' });
    }
    
    console.log(`📁 Track file: ${track.original_path}`);
    
    // Get metadata with fallback
    let metadata;
    try {
      metadata = await audioProcessor.getAudioMetadata(track.original_path);
      console.log(`✅ Metadata: duration=${metadata.duration}s, sr=${metadata.sampleRate}Hz`);
    } catch (metaError) {
      console.warn('⚠️ Using default metadata:', metaError.message);
      metadata = {
        duration: 180, // Default to 3 minutes
        sampleRate: 44100,
        channels: 2,
        key: 'C'
      };
    }
    
    // Run advanced multi-method analysis
    console.log(`\n🎯 Running 10 industry-leading analysis methods...`);
    const analysisResults = await advancedAnalyzer.analyzeTrack(track.original_path, metadata.duration);
    
    // Combine segments from all successful methods
    const combinedSegments = advancedAnalyzer.combineSegments(analysisResults);
    console.log(`✅ Combined ${combinedSegments.length} segments from ${analysisResults.successfulMethods.length} methods`);
    
    // Extract segments to audio files and insert into database
    const finalSegments = [];
    for (let i = 0; i < combinedSegments.length; i++) {
      const seg = combinedSegments[i];
      const segmentId = `seg_${trackId}_${i}`;
      const segmentPath = path.join(__dirname, '../data/segments', `${segmentId}.wav`);
      
      try {
        // Extract audio segment
        await audioProcessor.extractSegment(track.original_path, seg.startTime, seg.duration, segmentPath);
        
        // Create indexed segment with advanced metadata
        const indexedSegment = segmentIndexer.createSegmentIndex(seg, seg.bpm || 120);
        
        // Insert into database with full metadata
        await db.run(
          `INSERT INTO segments (
            id, track_id, start_time, end_time, duration, bpm, energy, danceability, valence, key, 
            beat_count, derivation, audio_path, processed,
            segment_type, peak_energy, energy_variance, intensity, suitable_for,
            harmonic_content, rhythmic_complexity, spectral_brightness, onset_density,
            mix_in_point, mix_out_point, loop_compatible, transition_type,
            audio_fingerprint, similarity_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            segmentId,
            trackId,
            seg.startTime,
            seg.endTime,
            seg.duration,
            seg.bpm || 120,
            seg.energy || 0.5,
            0.7, // danceability
            0.6, // valence
            seg.key || metadata.key || 'C',
            16, // beat_count
            seg.method,
            segmentPath,
            0, // processed
            indexedSegment.segmentType || seg.segmentType || 'REGULAR',
            indexedSegment.peakEnergy || seg.peakEnergy || seg.energy || 0.5,
            indexedSegment.energyVariance || seg.energyVariance || 0,
            indexedSegment.intensity || seg.characteristics?.intensity || 'MEDIUM',
            indexedSegment.suitable_for || seg.characteristics?.suitable_for || 'general',
            indexedSegment.harmonic_content,
            indexedSegment.rhythmic_complexity,
            indexedSegment.spectral_brightness,
            indexedSegment.onset_density,
            indexedSegment.mix_in_point,
            indexedSegment.mix_out_point,
            indexedSegment.loop_compatible,
            indexedSegment.transition_type,
            indexedSegment.audio_fingerprint,
            indexedSegment.similarity_hash
          ]
        );
        
        finalSegments.push({
          id: segmentId,
          startTime: seg.startTime,
          duration: seg.duration,
          energy: seg.energy,
          bpm: seg.bpm,
          method: seg.method,
          confidence: seg.confidence,
          segmentType: seg.segmentType,
          suitableFor: seg.characteristics?.suitable_for,
          fingerprint: indexedSegment.audio_fingerprint,
          similarityHash: indexedSegment.similarity_hash
        });
        
      } catch (extractError) {
        console.error(`⚠️ Failed to extract segment ${i}:`, extractError.message);
      }
    }
    
    // Calculate average BPM from successful methods
    const bpmValues = analysisResults.successfulMethods
      .filter(r => r.bpm)
      .map(r => r.bpm);
    const avgBPM = bpmValues.length > 0 
      ? bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length 
      : 120;
    
    // Get key from chroma analysis if available
    const chromaResult = analysisResults.results.find(r => r.method === 'CHROMA_FEATURE_ANALYSIS' && r.success);
    const key = chromaResult?.key || metadata.key || 'C';
    
    await db.run('UPDATE tracks SET bpm = ?, key = ?, processed = 1 WHERE id = ?', [avgBPM, key, trackId]);
    
    console.log(`✅ Track processed successfully: ${trackId}`);
    console.log(`📊 Analysis Results:`);
    console.log(`   - Methods used: ${analysisResults.successfulMethods.length}/10`);
    console.log(`   - Success rate: ${(analysisResults.successRate * 100).toFixed(1)}%`);
    console.log(`   - Segments created: ${finalSegments.length}`);
    console.log(`   - Average BPM: ${avgBPM.toFixed(1)}`);
    console.log(`   - Key: ${key}`);
    
    res.json({ 
      success: true, 
      trackId,
      segmentCount: finalSegments.length,
      analysisResults: {
        methodsUsed: analysisResults.successfulMethods.length,
        totalMethods: 10,
        successRate: analysisResults.successRate,
        methods: analysisResults.results.map(r => ({
          name: r.method,
          success: r.success,
          error: r.error,
          confidence: r.confidence,
          bpm: r.bpm,
          key: r.key
        }))
      },
      bpm: avgBPM,
      key,
      segments: finalSegments
    });
  } catch (error) {
    console.error('❌ Processing error:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

app.post('/segments/:segmentId/separate-stems', async (req, res) => {
  try {
    const { segmentId } = req.params;
    const segment = await db.get('SELECT * FROM segments WHERE id = ?', [segmentId]);
    
    if (!segment) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }
    
    const stems = await audioProcessor.processSegmentStems(segment);
    
    for (const stem of stems) {
      await db.run(
        'INSERT INTO stems (id, segment_id, stem_type, audio_path, gain) VALUES (?, ?, ?, ?, ?)',
        [stem.id, stem.segmentId, stem.stemType, stem.audioPath, stem.gain]
      );
    }
    
    await db.run('UPDATE segments SET processed = 1 WHERE id = ?', [segmentId]);
    
    res.json({ 
      success: true, 
      segmentId,
      stems: stems.map(s => ({
        id: s.id,
        type: s.stemType,
        path: s.audioPath
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/segments', async (req, res) => {
  try {
    const { trackId, processed } = req.query;
    let query = 'SELECT s.*, t.filename as track_filename FROM segments s JOIN tracks t ON s.track_id = t.id WHERE 1=1';
    const params = [];
    
    if (trackId) {
      query += ' AND s.track_id = ?';
      params.push(trackId);
    }
    
    if (processed !== undefined) {
      query += ' AND s.processed = ?';
      params.push(processed === 'true' ? 1 : 0);
    }
    
    query += ' ORDER BY s.created_at DESC';
    
    const segments = await db.all(query, params);
    
    const segmentsWithStems = await Promise.all(segments.map(async (seg) => {
      const stems = await db.all('SELECT * FROM stems WHERE segment_id = ?', [seg.id]);
      return { ...seg, stems };
    }));
    
    res.json({ success: true, segments: segmentsWithStems });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/segments/:segmentId', async (req, res) => {
  try {
    const { segmentId } = req.params;
    const segment = await db.get('SELECT * FROM segments WHERE id = ?', [segmentId]);
    
    if (!segment) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }
    
    const stems = await db.all('SELECT * FROM stems WHERE segment_id = ?', [segmentId]);
    
    res.json({ success: true, segment: { ...segment, stems } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/mixes/create', async (req, res) => {
  try {
    const { name, timeline, mode } = req.body; // mode: 'intelligent', 'random', 'hybrid'
    const mixId = `mix_${Date.now()}`;
    
    console.log(`🎚️ Creating ${mode || 'intelligent'} mix with ${timeline.length} segments...`);
    
    // Get full segment data
    const fullSegments = await Promise.all(timeline.map(async (item) => {
      const segment = await db.get('SELECT * FROM segments WHERE id = ?', [item.segmentId]);
      if (!segment) throw new Error(`Segment ${item.segmentId} not found`);
      return { ...segment, ...item };
    }));
    
    // Create intelligent sequence
    let intelligentTimeline;
    if (mode === 'random') {
      intelligentTimeline = intelligentSequencer.createRandomSequence(fullSegments);
    } else if (mode === 'hybrid') {
      intelligentTimeline = intelligentSequencer.createHybridSequence(fullSegments);
    } else {
      intelligentTimeline = intelligentSequencer.createIntelligentSequence(fullSegments);
    }
    
    console.log(`✨ Intelligent sequencing complete: ${intelligentTimeline.length} segments`);
    
    // Get audio paths for sequenced segments
    const timelineWithPaths = await Promise.all(intelligentTimeline.map(async (item) => {
      console.log(`📁 [${item.phase || 'RANDOM'}] ${item.id}: ${item.transitionType} (${item.transitionDuration}s)`);
      
      // Check if audio file exists, use original track as fallback
      let audioPath = item.audio_path;
      try {
        await fs.access(item.audio_path);
      } catch (err) {
        console.warn(`⚠️ Segment audio missing, using original track`);
        const track = await db.get('SELECT * FROM tracks WHERE id = ?', [item.track_id]);
        if (track && track.original_path) {
          audioPath = track.original_path;
        }
      }
      
      return {
        ...item,
        segmentId: item.id,
        audioPath,
        duration: item.duration || 8
      };
    }));
    
    // Get all segments for fallback logic
    const allSegments = await db.all('SELECT * FROM segments');
    
    const result = await mixEngine.createMix(mixId, timelineWithPaths, allSegments);
    
    await db.run(
      'INSERT INTO mixes (id, name, duration, output_path) VALUES (?, ?, ?, ?)',
      [mixId, name || `Mix ${new Date().toISOString()}`, result.duration, result.path]
    );
    
    for (const item of timeline) {
      const timelineId = `timeline_${mixId}_${Date.now()}_${Math.random()}`;
      await db.run(
        `INSERT INTO mix_timeline (id, mix_id, segment_id, position, duration, transition_type, transition_duration, stem_config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [timelineId, mixId, item.segmentId, item.position, item.duration, 
         item.transitionType || 'crossfade', item.transitionDuration || 2.0, 
         JSON.stringify(item.stemConfig || {})]
      );
    }
    
    console.log(`✅ Mix created successfully: ${mixId}`);
    
    res.json({ 
      success: true, 
      mixId,
      path: result.path,
      duration: result.duration
    });
  } catch (error) {
    console.error('❌ Mix creation error:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

app.get('/segments/:segmentId/compatible', async (req, res) => {
  try {
    const { segmentId } = req.params;
    const targetSegment = await db.get('SELECT * FROM segments WHERE id = ?', [segmentId]);
    
    if (!targetSegment) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }
    
    // Get all segments
    const allSegments = await db.all('SELECT * FROM segments');
    
    // Find compatible segments
    const compatible = segmentIndexer.findCompatibleSegments(targetSegment, allSegments);
    
    res.json({
      success: true,
      targetSegment: {
        id: targetSegment.id,
        bpm: targetSegment.bpm,
        key: targetSegment.key,
        energy: targetSegment.energy,
        segmentType: targetSegment.segment_type
      },
      compatibleSegments: compatible.slice(0, 20), // Top 20
      totalFound: compatible.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/segments/search/:similarityHash', async (req, res) => {
  try {
    const { similarityHash } = req.params;
    
    // Find all segments with matching similarity hash
    const segments = await db.all(
      'SELECT * FROM segments WHERE similarity_hash = ? ORDER BY energy DESC',
      [similarityHash]
    );
    
    res.json({
      success: true,
      similarityHash,
      segments,
      count: segments.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/mixes/:mixId/audio', async (req, res) => {
  try {
    const { mixId } = req.params;
    const mix = await db.get('SELECT * FROM mixes WHERE id = ?', [mixId]);
    
    if (!mix) {
      return res.status(404).json({ success: false, error: 'Mix not found' });
    }
    
    // Prefer WAV for accurate duration metadata
    const mixPathWav = path.join(__dirname, '../data/mixes', `${mixId}.wav`);
    const mixPathMp3 = path.join(__dirname, '../data/mixes', `${mixId}.mp3`);
    
    // Try .wav first for accurate duration, then .mp3 as fallback
    try {
      await fs.access(mixPathWav);
      const stats = await fs.stat(mixPathWav);
      
      // Set proper headers for audio streaming
      res.setHeader('Content-Type', 'audio/wav');
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-cache');
      
      console.log(`🎵 Serving WAV audio for mix ${mixId}: ${stats.size} bytes`);
      res.sendFile(mixPathWav);
    } catch (wavErr) {
      try {
        await fs.access(mixPathMp3);
        const stats = await fs.stat(mixPathMp3);
        
        // Set proper headers for audio streaming
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache');
        
        console.log(`🎵 Serving MP3 audio for mix ${mixId}: ${stats.size} bytes`);
        res.sendFile(mixPathMp3);
      } catch (mp3Err) {
        res.status(404).json({ success: false, error: 'Mix audio file not found' });
      }
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/mixes', async (req, res) => {
  try {
    const mixes = await db.all('SELECT * FROM mixes ORDER BY created_at DESC');

    const mixesWithTimeline = await Promise.all(mixes.map(async (mix) => {
      // Backfill: if the stored duration disagrees with the actual audio file
      // (e.g. legacy mixes that stored the planner's predicted duration),
      // re-probe and correct it so the UI matches the real file length.
      let duration = mix.duration;
      try {
        if (mix.output_path) {
          await fs.access(mix.output_path);
          const realDuration = await mixEngine.getAudioDuration(mix.output_path);
          if (realDuration && Math.abs(realDuration - mix.duration) > 1) {
            await db.run('UPDATE mixes SET duration = ? WHERE id = ?', [realDuration, mix.id]);
            duration = realDuration;
          }
        }
      } catch (_) {
        // File missing or probe failed — leave stored duration alone.
      }

      const timeline = await db.all(
        `SELECT mt.*, s.audio_path, s.duration as segment_duration, s.energy, s.bpm
         FROM mix_timeline mt
         JOIN segments s ON mt.segment_id = s.id
         WHERE mt.mix_id = ?
         ORDER BY mt.position`,
        [mix.id]
      );
      return { ...mix, duration, timeline };
    }));

    res.json({ success: true, mixes: mixesWithTimeline });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/mixes/:mixId', async (req, res) => {
  try {
    const { mixId } = req.params;
    const mix = await db.get('SELECT * FROM mixes WHERE id = ?', [mixId]);
    
    if (!mix) {
      return res.status(404).json({ success: false, error: 'Mix not found' });
    }
    
    const timeline = await db.all(
      `SELECT mt.*, s.audio_path, s.duration as segment_duration, s.energy, s.bpm, s.key
       FROM mix_timeline mt
       JOIN segments s ON mt.segment_id = s.id
       WHERE mt.mix_id = ?
       ORDER BY mt.position`,
      [mixId]
    );
    
    res.json({ success: true, mix: { ...mix, timeline } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/tracks', async (req, res) => {
  try {
    const tracks = await db.all('SELECT * FROM tracks ORDER BY created_at DESC');
    res.json({ success: true, tracks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== V2.0 ADVANCED ANALYSIS ENGINE ====================

app.post('/tracks/:trackId/process-v2', async (req, res) => {
  try {
    const { trackId } = req.params;
    const options = req.body || {};

    console.log(`\n🚀 Processing track ${trackId} with v2.0 pipeline...`);
    console.log(`Options:`, options);

    const track = await db.get('SELECT * FROM tracks WHERE id = ?', [trackId]);

    if (!track) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }

    // Get metadata
    let metadata;
    try {
      metadata = await audioProcessor.getAudioMetadata(track.original_path);
    } catch (error) {
      metadata = {
        duration: 180,
        sampleRate: 44100,
        channels: 2,
        key: 'C',
        bpm: 120
      };
    }

    // Run advanced pipeline
    const result = await pipeline.processTrack(
      trackId,
      track.original_path,
      metadata,
      {
        strict_validation: options.strict_validation || false,
        separate_stems: options.separate_stems || false,
        stem_batch_size: options.stem_batch_size || 3,
        export_ml: options.export_ml || false,
        ml_formats: options.ml_formats || ['json', 'csv']
      }
    );

    if (result.success) {
      // Update track as processed
      await db.run('UPDATE tracks SET processed = 1 WHERE id = ?', [trackId]);

      console.log(`✅ Track ${trackId} processed with v2.0 pipeline`);

      res.json({
        success: true,
        trackId,
        version: '2.0',
        segmentCount: result.segmentCount,
        pipeline_duration_ms: result.pipeline_duration,
        steps_completed: result.steps_completed,
        segments: result.segments.map(s => ({
          id: s.id,
          type: s.classification?.type,
          duration: s.duration,
          energy: s.classification?.energy,
          bpm: s.musical?.bpm,
          key: s.musical?.camelot_key,
          quality: s.ml_metadata?.quality_score,
          has_stems: s.stems?.separated
        }))
      });
    } else {
      throw new Error(result.error);
    }

  } catch (error) {
    console.error('❌ v2.0 processing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Query segments with advanced indexer
app.post('/segments/query', async (req, res) => {
  try {
    const criteria = req.body;
    console.log(`🔍 Querying segments:`, criteria);

    const segments = advancedIndexer.query(criteria);

    res.json({
      success: true,
      count: segments.length,
      segments: segments.slice(0, 100) // Limit response
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Find similar segments
app.get('/segments/:segmentId/similar', async (req, res) => {
  try {
    const { segmentId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const similar = advancedIndexer.findSimilar(segmentId, limit);

    res.json({
      success: true,
      segmentId,
      similar: similar.map(s => ({
        segment: {
          id: s.segment.id,
          type: s.segment.classification?.type,
          duration: s.segment.duration,
          energy: s.segment.classification?.energy
        },
        similarity: s.score
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Separate stems for a segment
app.post('/segments/:segmentId/separate-stems-v2', async (req, res) => {
  try {
    const { segmentId } = req.params;
    const method = req.body.method || 'hybrid';

    console.log(`🎼 Separating stems for ${segmentId}...`);

    const segment = await db.get('SELECT * FROM segments WHERE id = ?', [segmentId]);
    if (!segment) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }

    const result = await stemSeparator.separateSegmentStems(
      segment.audio_path,
      segmentId,
      method
    );

    if (result.success) {
      // Update segment in database
      await db.run(
        `UPDATE segments_v2 SET 
         stems_separated = 1,
         stems_vocals_path = ?,
         stems_drums_path = ?,
         stems_bass_path = ?,
         stems_other_path = ?,
         stems_method = ?,
         stems_quality = ?
         WHERE id = ?`,
        [
          result.stems.vocals,
          result.stems.drums,
          result.stems.bass,
          result.stems.other,
          result.method,
          result.quality_score,
          segmentId
        ]
      );
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export ML training data
app.post('/ml/export', async (req, res) => {
  try {
    const { format = 'json', limit = 1000 } = req.body;

    console.log(`🤖 Exporting ML training data in ${format} format...`);

    // Get segments from database
    const segments = await db.all(
      `SELECT * FROM segments_v2 WHERE ml_trainable = 1 LIMIT ?`,
      [limit]
    );

    // Parse JSON fields
    const parsedSegments = segments.map(seg => ({
      ...seg,
      features: {
        temporal: JSON.parse(seg.features_temporal || '{}'),
        spectral: JSON.parse(seg.features_spectral || '{}'),
        harmonic: JSON.parse(seg.features_harmonic || '{}'),
        rhythmic: JSON.parse(seg.features_rhythmic || '{}'),
        timbral: JSON.parse(seg.features_timbral || '{}')
      },
      tags: JSON.parse(seg.tags || '[]')
    }));

    const result = await mlExporter.exportTrainingData(parsedSegments, format);

    res.json({
      success: true,
      format,
      count: segments.length,
      filepath: result.filepath
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pipeline statistics
app.get('/analysis/stats', async (req, res) => {
  try {
    const stats = pipeline.getStats();
    const indexStats = advancedIndexer.getStats();

    res.json({
      success: true,
      pipeline: stats,
      indexer: indexStats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch reprocess existing tracks
app.post('/tracks/reprocess-batch-v2', async (req, res) => {
  try {
    const { trackIds, options = {} } = req.body;
    
    if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'trackIds array is required' 
      });
    }
    
    console.log(`\n🔄 Batch reprocessing ${trackIds.length} tracks with v2.0...`);
    
    const results = [];
    let successful = 0;
    let failed = 0;
    
    for (let i = 0; i < trackIds.length; i++) {
      const trackId = trackIds[i];
      console.log(`\n[${i + 1}/${trackIds.length}] Processing ${trackId}...`);
      
      try {
        const track = await db.get('SELECT * FROM tracks WHERE id = ?', [trackId]);
        
        if (!track) {
          console.log(`⚠️ Track ${trackId} not found, skipping`);
          results.push({ trackId, success: false, error: 'Track not found' });
          failed++;
          continue;
        }
        
        // Get metadata
        let metadata;
        try {
          metadata = await audioProcessor.getAudioMetadata(track.original_path);
        } catch (error) {
          metadata = {
            duration: 180,
            sampleRate: 44100,
            channels: 2,
            key: 'C',
            bpm: 120
          };
        }
        
        // Clear old segments for this track
        await db.run('DELETE FROM segments WHERE track_id = ?', [trackId]);
        await db.run('DELETE FROM segments_v2 WHERE track_id = ?', [trackId]);
        console.log(`🗑️  Cleared old segments for ${trackId}`);
        
        // Run v2.0 pipeline
        const result = await pipeline.processTrack(
          trackId,
          track.original_path,
          metadata,
          {
            strict_validation: options.strict_validation || false,
            separate_stems: options.separate_stems || false,
            stem_batch_size: options.stem_batch_size || 2,
            export_ml: options.export_ml || false,
            ml_formats: options.ml_formats || ['json']
          }
        );
        
        if (result.success) {
          await db.run('UPDATE tracks SET processed = 1 WHERE id = ?', [trackId]);
          results.push({
            trackId,
            success: true,
            segmentCount: result.segmentCount,
            duration_ms: result.pipeline_duration
          });
          successful++;
          console.log(`✅ [${i + 1}/${trackIds.length}] ${trackId}: ${result.segmentCount} segments`);
        } else {
          results.push({
            trackId,
            success: false,
            error: result.error
          });
          failed++;
          console.log(`❌ [${i + 1}/${trackIds.length}] ${trackId}: ${result.error}`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${trackId}:`, error.message);
        results.push({
          trackId,
          success: false,
          error: error.message
        });
        failed++;
      }
    }
    
    console.log(`\n✅ Batch reprocessing complete!`);
    console.log(`   Successful: ${successful}/${trackIds.length}`);
    console.log(`   Failed: ${failed}/${trackIds.length}`);
    
    res.json({
      success: true,
      total: trackIds.length,
      successful,
      failed,
      results
    });
    
  } catch (error) {
    console.error('❌ Batch reprocessing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete segments (batch)
app.post('/segments/delete-batch', async (req, res) => {
  try {
    const { segmentIds } = req.body;
    
    if (!segmentIds || !Array.isArray(segmentIds) || segmentIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'segmentIds array is required' 
      });
    }
    
    console.log(`🗑️  Deleting ${segmentIds.length} segments...`);
    
    let deleted = 0;
    let failed = 0;
    
    for (const segmentId of segmentIds) {
      try {
        // Delete from both tables
        await db.run('DELETE FROM segments WHERE id = ?', [segmentId]);
        await db.run('DELETE FROM segments_v2 WHERE id = ?', [segmentId]);
        
        // Remove from indexer
        advancedIndexer.removeSegment(segmentId);
        
        deleted++;
      } catch (error) {
        console.error(`❌ Failed to delete ${segmentId}:`, error.message);
        failed++;
      }
    }
    
    console.log(`✅ Deleted ${deleted}/${segmentIds.length} segments`);
    
    res.json({
      success: true,
      deleted,
      failed,
      total: segmentIds.length
    });
    
  } catch (error) {
    console.error('❌ Batch delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete single segment
app.delete('/segments/:segmentId', async (req, res) => {
  try {
    const { segmentId } = req.params;
    
    // Remove from indexer
    advancedIndexer.removeSegment(segmentId);
    
    // Delete from database
    await db.run('DELETE FROM segments WHERE id = ?', [segmentId]);
    await db.run('DELETE FROM segments_v2 WHERE id = ?', [segmentId]);
    
    console.log(`🗑️  Deleted segment ${segmentId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete segment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/segments', async (req, res) => {
  try {
    // Delete all segments from database
    await db.run('DELETE FROM segments');
    await db.run('DELETE FROM segments_v2');
    
    // Clear indexer
    advancedIndexer.clear();
    
    console.log(`🗑️  Deleted all segments`);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete all segments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/tracks/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;
    
    // Get track info to delete audio file
    const track = await db.get('SELECT * FROM tracks WHERE id = ?', [trackId]);
    if (!track) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }
    
    // Delete segments
    await db.run('DELETE FROM segments WHERE track_id = ?', [trackId]);
    await db.run('DELETE FROM segments_v2 WHERE track_id = ?', [trackId]);
    
    // Delete from mixes timeline
    await db.run('DELETE FROM mix_timeline WHERE segment_id IN (SELECT id FROM segments WHERE track_id = ?)', [trackId]);
    
    // Delete track from database
    await db.run('DELETE FROM tracks WHERE id = ?', [trackId]);
    
    // Delete audio file if exists
    if (track.original_path) {
      try {
        await fs.unlink(track.original_path);
      } catch (err) {
        // Ignore if file doesn't exist
      }
    }
    
    console.log(`🗑️  Deleted track ${trackId} and all its segments`);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete track error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/mixes/:mixId', async (req, res) => {
  try {
    const { mixId } = req.params;
    
    // Get mix info to delete audio file
    const mix = await db.get('SELECT * FROM mixes WHERE id = ?', [mixId]);
    if (!mix) {
      return res.status(404).json({ success: false, error: 'Mix not found' });
    }
    
    // Delete mix timeline
    await db.run('DELETE FROM mix_timeline WHERE mix_id = ?', [mixId]);
    
    // Delete mix from database
    await db.run('DELETE FROM mixes WHERE id = ?', [mixId]);
    
    // Delete audio file if exists (try both .wav and .mp3)
    const mixPathWav = path.join(__dirname, '../data/mixes', `${mixId}.wav`);
    const mixPathMp3 = path.join(__dirname, '../data/mixes', `${mixId}.mp3`);
    
    try {
      await fs.unlink(mixPathWav);
      console.log(`🗑️  Deleted WAV file: ${mixPathWav}`);
    } catch (err) {
      // Ignore if file doesn't exist
    }
    
    try {
      await fs.unlink(mixPathMp3);
      console.log(`🗑️  Deleted MP3 file: ${mixPathMp3}`);
    } catch (err) {
      // Ignore if file doesn't exist
    }
    
    console.log(`🗑️  Deleted mix ${mixId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete mix error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== INTELLIGENT AUTO-MIX ENGINE ====================

/**
 * Create intelligent auto-mix (optimized, no payload issues)
 * Uses advanced v2.0 metadata for harmonic mixing and smooth transitions
 */
app.post('/mixes/create-auto', async (req, res) => {
  try {
    const {
      name,
      targetDuration = 300,
      energyProfile = 'wave',
      trackIds = null,
      options = {}
    } = req.body;

    console.log(`\n🎵 Creating intelligent auto-mix...`);
    console.log(`   Duration: ${targetDuration}s`);
    console.log(`   Energy: ${energyProfile}`);

    // Create intelligent mix using v2.0 engine
    const mixResult = await intelligentMixer.createIntelligentMix({
      targetDuration,
      energyProfile,
      trackIds,
      ...options
    });

    // Generate mix ID
    const mixId = `mix_${Date.now()}`;

    // Prepare timeline for mix engine
    const timelineWithPaths = await Promise.all(mixResult.timeline.map(async (item) => {
      // Get full segment data
      const segment = await db.get('SELECT * FROM segments WHERE id = ?', [item.segmentId]);
      
      if (!segment) {
        console.warn(`⚠️ Segment ${item.segmentId} not found, skipping`);
        return null;
      }

      // Check if audio file exists
      let audioPath = segment.audio_path;
      try {
        await fs.access(audioPath);
      } catch (err) {
        console.warn(`⚠️ Segment audio missing, using original track`);
        const track = await db.get('SELECT * FROM tracks WHERE id = ?', [segment.track_id]);
        if (track && track.original_path) {
          audioPath = track.original_path;
        }
      }

      return {
        ...item,
        audioPath,
        segmentId: item.segmentId,
        startTime: 0, // audioPath is already the pre-extracted segment WAV; seek from 0
        duration: item.duration,
        fadeIn: item.fadeIn,
        fadeOut: item.fadeOut,
        transitionType: 'intelligent_crossfade',
        transitionDuration: item.fadeOut
      };
    }));

    // Filter out nulls
    const validTimeline = timelineWithPaths.filter(item => item !== null);

    if (validTimeline.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid segments found for mix creation'
      });
    }

    console.log(`\n🎛️  Rendering mix: ${validTimeline.length} segments...`);

    // Get all segments for fallback logic
    const allSegments = await db.all('SELECT * FROM segments');

    // Create the actual audio mix
    const mixPath = await mixEngine.createMix(mixId, validTimeline, allSegments);

    // Use the actual rendered audio duration (from ffprobe), not the planner's
    // predicted duration, so the player UI matches the real file length.
    const renderedDuration = mixPath.duration || mixResult.totalDuration;

    // Store in database
    await db.run(
      'INSERT INTO mixes (id, name, duration, output_path) VALUES (?, ?, ?, ?)',
      [
        mixId,
        name || `Auto Mix ${new Date().toLocaleString()}`,
        renderedDuration,
        mixPath.path
      ]
    );

    // Store timeline
    for (let i = 0; i < validTimeline.length; i++) {
      const item = validTimeline[i];
      const timelineId = `timeline_${mixId}_${i}`;
      
      await db.run(
        `INSERT INTO mix_timeline (id, mix_id, segment_id, position, duration, transition_type, transition_duration, stem_config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          timelineId,
          mixId,
          item.segmentId,
          i,
          item.duration,
          item.transitionType || 'intelligent_crossfade',
          item.transitionDuration || 3.0,
          JSON.stringify({
            bpm: item.bpm,
            key: item.key,
            energy: item.energy,
            fadeIn: item.fadeIn,
            fadeOut: item.fadeOut
          })
        ]
      );
    }

    console.log(`\n✅ Intelligent mix created: ${mixId}`);
    console.log(`   Segments: ${validTimeline.length}`);
    console.log(`   Planned duration: ${mixResult.totalDuration.toFixed(1)}s`);
    console.log(`   Rendered duration: ${renderedDuration.toFixed(1)}s`);
    console.log(`   Avg BPM: ${mixResult.metadata.avgBpm}`);
    console.log(`   Harmony Score: ${mixResult.metadata.harmonyScore}`);
    console.log(`   Key Changes: ${mixResult.metadata.keyChanges}`);

    res.json({
      success: true,
      mixId,
      path: mixPath.path,
      duration: renderedDuration,
      plannedDuration: mixResult.totalDuration,
      segments: validTimeline.length,
      metadata: mixResult.metadata
    });

  } catch (error) {
    console.error('❌ Auto-mix creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ==================== END V2.0 ENDPOINTS ====================

// ==================== FLAWLESS MIX ENGINE ====================

/**
 * Create a flawless mix using the intelligent segment connector
 * Supports unlimited duration and uses ML-based compatibility scoring
 */
app.post('/mixes/create-flawless', async (req, res) => {
  try {
    const {
      name,
      targetDuration = null, // null = unlimited
      minSegments = 50,
      maxSegments = null, // null = unlimited
      energyProfile = 'narrative',
      startSegmentId = null,
      allowKeyChanges = true,
      maxBpmDiff = 10
    } = req.body;

    console.log(`\n🎼 Creating flawless mix with intelligent connector...`);
    console.log(`   Target duration: ${targetDuration ? targetDuration + 's' : 'unlimited'}`);
    console.log(`   Energy profile: ${energyProfile}`);
    console.log(`   Max segments: ${maxSegments || 'unlimited'}`);

    // Create flawless mix
    const mixResult = await segmentConnector.createFlawlessMix({
      targetDuration,
      minSegments,
      maxSegments,
      energyProfile,
      startSegmentId,
      allowKeyChanges,
      maxBpmDiff
    });

    // Generate mix ID
    const mixId = `mix_${Date.now()}`;

    // Prepare timeline for mix engine
    const timelineWithPaths = await Promise.all(mixResult.timeline.map(async (item) => {
      // Get full segment data
      const segment = await db.get('SELECT * FROM segments WHERE id = ?', [item.segmentId]);
      
      if (!segment) {
        console.warn(`⚠️ Segment ${item.segmentId} not found, skipping`);
        return null;
      }

      // Check if audio file exists
      let audioPath = segment.audio_path;
      try {
        await fs.access(audioPath);
      } catch (err) {
        console.warn(`⚠️ Segment audio missing, using original track`);
        const track = await db.get('SELECT * FROM tracks WHERE id = ?', [segment.track_id]);
        if (track && track.original_path) {
          audioPath = track.original_path;
        }
      }

      return {
        ...item,
        audioPath,
        segmentId: item.segmentId,
        startTime: 0, // audioPath is already the pre-extracted segment WAV; seek from 0
        duration: item.duration,
        fadeIn: item.fadeIn,
        fadeOut: item.fadeOut,
        transitionType: item.transitionType,
        transitionDuration: item.transitionDuration,
        energy: segment.energy,
        bpm: segment.bpm,
        track_id: segment.track_id
      };
    }));

    // Filter out nulls
    const validTimeline = timelineWithPaths.filter(item => item !== null);

    if (validTimeline.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid segments found for mix creation'
      });
    }

    console.log(`\n🎛️  Rendering flawless mix: ${validTimeline.length} segments...`);

    // Get all segments for fallback logic
    const allSegments = await db.all('SELECT * FROM segments');

    // Create the actual audio mix
    const mixPath = await mixEngine.createMix(mixId, validTimeline, allSegments);

    // Use the actual rendered audio duration (from ffprobe), not the planner's
    // predicted duration, so the player UI matches the real file length.
    const renderedDuration = mixPath.duration || mixResult.totalDuration;

    // Store in database
    await db.run(
      'INSERT INTO mixes (id, name, duration, output_path) VALUES (?, ?, ?, ?)',
      [
        mixId,
        name || `Flawless Mix ${new Date().toLocaleString()}`,
        renderedDuration,
        mixPath.path
      ]
    );

    // Store timeline
    for (let i = 0; i < validTimeline.length; i++) {
      const item = validTimeline[i];
      const timelineId = `timeline_${mixId}_${i}`;
      
      await db.run(
        `INSERT INTO mix_timeline (id, mix_id, segment_id, position, duration, transition_type, transition_duration, stem_config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          timelineId,
          mixId,
          item.segmentId,
          i,
          item.duration,
          item.transitionType || 'intelligent_crossfade',
          item.transitionDuration || 2.0,
          JSON.stringify({})
        ]
      );
    }

    // Train the connector with successful connections
    console.log(`🧠 Training segment connector with successful connections...`);
    for (let i = 0; i < mixResult.segments.length - 1; i++) {
      const segmentA = mixResult.segments[i];
      const segmentB = mixResult.segments[i + 1];
      const compatibility = validTimeline[i].metadata?.compatibility || 80;
      
      // Train with quality score based on compatibility
      await segmentConnector.trainConnection(segmentA, segmentB, compatibility / 100);
    }

    console.log(`✅ Flawless mix created: ${mixId}`);
    console.log(`   Segments: ${validTimeline.length}`);
    console.log(`   Planned duration: ${mixResult.totalDuration.toFixed(1)}s`);
    console.log(`   Rendered duration: ${renderedDuration.toFixed(1)}s`);
    console.log(`   Avg Compatibility: ${mixResult.metadata.avgCompatibility.toFixed(1)}`);

    res.json({
      success: true,
      mixId,
      path: mixPath.path,
      duration: renderedDuration,
      plannedDuration: mixResult.totalDuration,
      metadata: mixResult.metadata
    });
  } catch (error) {
    console.error('❌ Flawless mix creation error:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

/**
 * Train the segment connector with user feedback
 */
app.post('/connector/train', async (req, res) => {
  try {
    const { segmentAId, segmentBId, quality } = req.body;
    
    const segmentA = await db.get('SELECT * FROM segments WHERE id = ?', [segmentAId]);
    const segmentB = await db.get('SELECT * FROM segments WHERE id = ?', [segmentBId]);
    
    if (!segmentA || !segmentB) {
      return res.status(404).json({ success: false, error: 'Segments not found' });
    }
    
    await segmentConnector.trainConnection(segmentA, segmentB, quality);
    
    res.json({ success: true, message: 'Training data saved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get compatibility score between two segments
 */
app.get('/connector/compatibility/:segmentAId/:segmentBId', async (req, res) => {
  try {
    const { segmentAId, segmentBId } = req.params;
    
    const segmentA = await db.get('SELECT * FROM segments WHERE id = ?', [segmentAId]);
    const segmentB = await db.get('SELECT * FROM segments WHERE id = ?', [segmentBId]);
    
    if (!segmentA || !segmentB) {
      return res.status(404).json({ success: false, error: 'Segments not found' });
    }
    
    const compatibility = segmentConnector.calculateCompatibility(segmentA, segmentB);
    const crossfadeDuration = segmentConnector.calculateCrossfadeDuration(segmentA, segmentB);
    
    res.json({
      success: true,
      compatibility,
      crossfadeDuration,
      details: {
        bpm: segmentConnector.calculateBPMCompatibility(segmentA.bpm, segmentB.bpm),
        key: segmentConnector.calculateKeyCompatibility(segmentA.key, segmentB.key),
        spectral: segmentConnector.calculateSpectralCompatibility(segmentA, segmentB)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== END FLAWLESS MIX ENGINE ====================

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Vanguard Node Backend on port ${PORT}`);
  console.log(`✨ v2.0 Analysis Engine loaded`);
  console.log(`📊 Advanced indexing enabled`);
  console.log(`🤖 ML export ready`);
  console.log(`🎼 Flawless mix engine ready`);
});

export default app;
