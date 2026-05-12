/**
 * Intelligent API Routes
 * ----------------------
 * Mounts the new "industry-leading" pipeline alongside the existing v1/v2
 * endpoints. Nothing here mutates the legacy `segments` table.
 *
 *   POST /dj/wipe                       — clear dj_segments + their audio
 *   POST /tracks/:trackId/dj-process    — run intelligent segmenter on track
 *   POST /tracks/dj-process-all         — batch process every track in DB
 *   GET  /dj-segments                   — list intelligent segments (filters)
 *   GET  /pools                         — pool summary for the UI
 *   GET  /pools/:poolName/segments      — segments inside a single pool
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import audioProcessor from '../audioProcessor.js';
import db from '../db.js';
import { segmentTrack } from './IntelligentSegmenter.js';
import { computePoolsForSegment, summarisePools } from './PoolManager.js';
import seamlessMixEngine from './SeamlessMixEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DJ_SEGMENTS_DIR = path.join(__dirname, '..', '..', 'data', 'dj_segments');
await fs.mkdir(DJ_SEGMENTS_DIR, { recursive: true });

// ----------------------------- helpers ----------------------------------

const CAMELOT_FROM_KEY = {
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
  'F': '7B', 'Dm': '7A',
};

function camelotOf(key) {
  if (!key) return null;
  return CAMELOT_FROM_KEY[key] || null;
}

// ── Camelot wheel distance (0 = same key, 1 = harmonically adjacent, 3 = clash) ──
function camelotDistance(keyA, keyB) {
  if (!keyA || !keyB) return 0;
  const parse = k => { const m = String(k).match(/^(\d+)([AB])$/i); return m ? { n: parseInt(m[1]), m: m[2].toUpperCase() } : null; };
  const a = parse(keyA); const b = parse(keyB);
  if (!a || !b) return 0;
  if (a.n === b.n && a.m === b.m) return 0;
  if (a.n === b.n) return 1;
  const diff = Math.min(Math.abs(a.n - b.n), 12 - Math.abs(a.n - b.n));
  if (diff === 1 && a.m === b.m) return 1;
  if (diff <= 2) return 2;
  return 3;
}

// ── Type-flow rules: which segment type naturally follows another ──
const GOOD_NEXT = {
  INTRO:   new Set(['INTRO', 'VERSE', 'BUILDUP']),
  VERSE:   new Set(['VERSE', 'CHORUS', 'BUILDUP']),
  BUILDUP: new Set(['DROP', 'CHORUS', 'PEAK']),
  DROP:    new Set(['DROP', 'BREAK', 'BUILDUP']),
  CHORUS:  new Set(['CHORUS', 'VERSE', 'BUILDUP', 'DROP']),
  BREAK:   new Set(['DROP', 'BUILDUP', 'VERSE', 'CHORUS']),
  PEAK:    new Set(['DROP', 'BREAK']),
  OUTRO:   new Set(['OUTRO']),
};

function typeFlowPenalty(typeA, typeB) {
  if (!typeA || !typeB) return 0;
  const good = GOOD_NEXT[typeA.toUpperCase()];
  return (good && good.has(typeB.toUpperCase())) ? 0 : 0.4;
}

// ── Pick the best audio transition between two adjacent segments ──
function selectTransition(segA, segB) {
  const tA = (segA?.type || '').toUpperCase();
  const tB = (segB?.type || '').toUpperCase();
  const bpmDiff = Math.abs((segA?.bpm || 120) - (segB?.bpm || 120));
  const cDist = camelotDistance(segA?.camelot_key, segB?.camelot_key);
  // Tension-release moments: hard cut on the drop
  if ((tA === 'BUILDUP' || tA === 'PEAK') && tB === 'DROP') return { type: 'cut' };
  // Two drops / two choruses: tight beatmatch blend
  if ((tA === 'DROP' && tB === 'DROP') || (tA === 'CHORUS' && tB === 'CHORUS'))
    return { type: 'crossfade', duration: bpmDiff < 5 ? 4 : 2 };
  // Transition to a breakdown or verse: long echo fade
  if (tB === 'BREAK' || tB === 'VERSE' || tA === 'OUTRO')
    return { type: 'echo_fade', duration: 8 };
  // Harmonically far: quick blend to mask the clash
  if (cDist >= 3) return { type: 'crossfade', duration: 2 };
  // Default: smooth EQ-swap crossfade (duration auto-computed from BPM)
  return { type: 'eq_swap', duration: null };
}

// ── Multi-factor segment scorer (lower = better match) ──
function segmentScore(seg, prev, targetEnergy) {
  const energyDist  = Math.abs((seg.energy || 0.5) - targetEnergy);
  const camelotDist = camelotDistance(prev?.camelot_key, seg.camelot_key) / 3;
  const bpmDist     = Math.min(Math.abs((seg.bpm || 120) - (prev?.bpm || 120)) / 30, 1);
  const flowPenalty = typeFlowPenalty(prev?.type, seg.type);
  return 0.35 * energyDist + 0.30 * camelotDist + 0.15 * bpmDist + 0.20 * flowPenalty;
}

async function processOneTrack(track, opts = {}) {
  if (!track.original_path) {
    throw new Error('Track has no original_path');
  }

  // Pass the track's canonical BPM (from essentia) as a prior to the segmenter
  // so phrase-snapping uses the correct tempo instead of the half-time onset estimate.
  const priorBpm = track.bpm && track.bpm > 60 ? track.bpm : null;
  const result = await segmentTrack(track.original_path, { ...opts, bpm: priorBpm });

  // Canonical BPM: prefer the track's essentia-analysed value; fall back to the
  // segmenter's onset estimate only if the track has none.
  const canonicalBpm = priorBpm || result.bpm || 120;
  console.log(`   BPM: track=${track.bpm || '?'} segmenter=${result.bpm} → using ${canonicalBpm}`);

  // 2. Persist each segment + extract audio file for it.
  const created = [];
  for (let i = 0; i < result.segments.length; i++) {
    const seg = result.segments[i];
    const id = `dj_${track.id}_${i}`;
    const audioPath = path.join(DJ_SEGMENTS_DIR, `${id}.wav`);

    try {
      await audioProcessor.extractSegment(
        track.original_path,
        seg.startTime,
        seg.duration,
        audioPath,
      );
    } catch (err) {
      console.warn(`  ⚠️  extract failed for ${id}: ${err.message}`);
      continue;
    }

    const camelot = camelotOf(track.key);
    const poolTags = computePoolsForSegment({
      bpm: canonicalBpm,
      energy: seg.energy,
      camelot_key: camelot,
      type: seg.type,
    });

    await db.run(
      `INSERT OR REPLACE INTO dj_segments (
         id, track_id, audio_path,
         start_time, end_time, duration,
         bpm, key, camelot_key,
         type, intensity, energy, low_energy, high_energy, flux,
         onset_density, energy_slope,
         mix_in_offset, mix_out_offset, quality, pool_tags
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, track.id, audioPath,
        seg.startTime, seg.endTime, seg.duration,
        canonicalBpm, track.key || null, camelot,
        seg.type, seg.intensity, seg.energy, seg.lowEnergy, seg.highEnergy, seg.flux,
        seg.onsetDensity, seg.energySlope,
        seg.mixInOffset, seg.mixOutOffset, seg.quality, JSON.stringify(poolTags),
      ],
    );

    created.push({ id, ...seg, bpm: canonicalBpm, camelot_key: camelot, pool_tags: poolTags });
  }

  return {
    trackId: track.id,
    bpm: canonicalBpm,
    totalDuration: result.totalDuration,
    segmentCount: created.length,
    segments: created,
  };
}

// ------------------------------ routes ----------------------------------

export function registerIntelligentRoutes(app) {
  // Static serving for the new audio files.
  app.use('/data/dj_segments', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache');
    next();
  });

  /**
   * Wipe everything intelligent.
   * Optional ?keepFiles=true to leave audio files in place (default: delete).
   */
  app.post('/dj/wipe', async (req, res) => {
    try {
      const keepFiles = String(req.query.keepFiles || 'false') === 'true';
      const all = await db.all('SELECT id, audio_path FROM dj_segments');
      await db.run('DELETE FROM dj_segments');

      let removed = 0;
      if (!keepFiles) {
        for (const s of all) {
          try { await fs.unlink(s.audio_path); removed++; } catch (_) {}
        }
      }
      console.log(`🧹 Wiped ${all.length} dj_segments rows, ${removed} files removed`);
      res.json({ success: true, rowsDeleted: all.length, filesRemoved: removed });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Wipe legacy segments too, when requested explicitly. The user opted into
   * a clean slate.
   */
  app.post('/segments/wipe-legacy', async (req, res) => {
    try {
      const keepFiles = String(req.query.keepFiles || 'false') === 'true';
      const all = await db.all('SELECT id, audio_path FROM segments');
      await db.run('DELETE FROM segments');
      await db.run('DELETE FROM segments_v2');
      let removed = 0;
      if (!keepFiles) {
        for (const s of all) {
          if (!s.audio_path) continue;
          try { await fs.unlink(s.audio_path); removed++; } catch (_) {}
        }
      }
      console.log(`🧹 Wiped ${all.length} legacy segments, ${removed} files removed`);
      res.json({ success: true, rowsDeleted: all.length, filesRemoved: removed });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Run intelligent segmentation on a single track.
   */
  app.post('/tracks/:trackId/dj-process', async (req, res) => {
    try {
      const { trackId } = req.params;
      const opts = req.body || {};
      const track = await db.get('SELECT * FROM tracks WHERE id = ?', [trackId]);
      if (!track) return res.status(404).json({ success: false, error: 'Track not found' });

      // Drop any previous DJ segments for this track so re-processing is clean.
      const existing = await db.all('SELECT id, audio_path FROM dj_segments WHERE track_id = ?', [trackId]);
      for (const s of existing) {
        try { await fs.unlink(s.audio_path); } catch (_) {}
      }
      await db.run('DELETE FROM dj_segments WHERE track_id = ?', [trackId]);

      const result = await processOneTrack(track, opts);

      // Persist BPM on the parent track if it didn't have one.
      if (!track.bpm && result.bpm) {
        await db.run('UPDATE tracks SET bpm = ? WHERE id = ?', [result.bpm, trackId]);
      }

      res.json({ success: true, ...result });
    } catch (err) {
      console.error('dj-process error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Batch — runs the intelligent segmenter over every track.
   * Slow; intended as a one-shot to populate the database.
   */
  app.post('/tracks/dj-process-all', async (req, res) => {
    try {
      const opts = req.body || {};
      const tracks = await db.all('SELECT * FROM tracks');
      console.log(`🎯 dj-process-all: ${tracks.length} tracks`);

      const results = [];
      for (const track of tracks) {
        try {
          // Skip already-processed tracks unless force=true.
          if (!opts.force) {
            const has = await db.get('SELECT COUNT(*) as c FROM dj_segments WHERE track_id = ?', [track.id]);
            if (has && has.c > 0) {
              results.push({ trackId: track.id, skipped: true, segmentCount: has.c });
              continue;
            }
          }
          const r = await processOneTrack(track, opts);
          results.push(r);
          console.log(`  ✓ ${track.id}: ${r.segmentCount} DJ segments`);
        } catch (err) {
          console.warn(`  ✗ ${track.id}: ${err.message}`);
          results.push({ trackId: track.id, error: err.message });
        }
      }

      res.json({
        success: true,
        processed: results.filter((r) => r.segmentCount > 0).length,
        skipped: results.filter((r) => r.skipped).length,
        failed: results.filter((r) => r.error).length,
        results,
      });
    } catch (err) {
      console.error('dj-process-all error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Query DJ segments with filters.
   *   ?type=DROP&minBpm=120&maxBpm=130&minEnergy=0.5&pool=high-energy:DROP&limit=100
   */
  app.get('/dj-segments', async (req, res) => {
    try {
      const where = [];
      const params = [];
      if (req.query.trackId)   { where.push('track_id = ?');     params.push(req.query.trackId); }
      if (req.query.type)      { where.push('type = ?');         params.push(req.query.type); }
      if (req.query.minBpm)    { where.push('bpm >= ?');         params.push(parseFloat(req.query.minBpm)); }
      if (req.query.maxBpm)    { where.push('bpm <= ?');         params.push(parseFloat(req.query.maxBpm)); }
      if (req.query.minEnergy) { where.push('energy >= ?');      params.push(parseFloat(req.query.minEnergy)); }
      if (req.query.maxEnergy) { where.push('energy <= ?');      params.push(parseFloat(req.query.maxEnergy)); }
      if (req.query.pool)      { where.push('pool_tags LIKE ?'); params.push(`%"${req.query.pool}"%`); }

      const limit = Math.max(1, Math.min(500, parseInt(req.query.limit || '200', 10)));
      const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
      const sql = `SELECT d.*, COALESCE(t.title, t.filename, 'Unknown Track') AS track_title
                   FROM dj_segments d
                   LEFT JOIN tracks t ON d.track_id = t.id
                   ${whereClause}
                   ORDER BY d.quality DESC, d.created_at DESC LIMIT ?`;
      params.push(limit);

      const rows = await db.all(sql, params);
      const segments = rows.map((r) => ({ ...r, pool_tags: JSON.parse(r.pool_tags || '[]') }));
      res.json({ success: true, total: segments.length, segments });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Stream a single dj_segment's audio file for UI preview.
   */
  app.get('/dj-segments/:id/audio', async (req, res) => {
    try {
      const row = await db.get('SELECT audio_path FROM dj_segments WHERE id = ?', [req.params.id]);
      if (!row?.audio_path) return res.status(404).json({ success: false, error: 'not found' });
      res.setHeader('Content-Type', 'audio/wav');
      res.sendFile(row.audio_path);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Pool summary for the UI.
   */
  app.get('/pools', async (req, res) => {
    try {
      const rows = await db.all('SELECT id, pool_tags FROM dj_segments');
      const pools = summarisePools(rows);
      const grouped = {};
      for (const p of pools) {
        (grouped[p.axis] ||= []).push(p);
      }
      res.json({ success: true, total: pools.length, pools, grouped });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * All segments inside a single pool.
   */
  app.get('/pools/:poolName/segments', async (req, res) => {
    try {
      const pool = req.params.poolName;
      const rows = await db.all(
        'SELECT * FROM dj_segments WHERE pool_tags LIKE ? ORDER BY quality DESC',
        [`%"${pool}"%`],
      );
      const segments = rows.map((r) => ({ ...r, pool_tags: JSON.parse(r.pool_tags || '[]') }));
      res.json({ success: true, pool, total: segments.length, segments });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /mixes/build
   * -----------------
   * Build a seamless DJ mix from the dj_segments pool.
   *
   * Body:
   *   name          string   (optional) display name
   *   targetMinutes number   desired mix length in minutes (default 20)
   *   energyProfile string   flat | rise | wave | drop | peak_time (default wave)
   *   pool          string   (optional) restrict to a single pool tag
   *   type          string   (optional) segment type filter (DROP, BUILDUP, …)
   *   minBpm        number   (optional)
   *   maxBpm        number   (optional)
   */
  app.post('/mixes/build', async (req, res) => {
    try {
      const {
        name,
        targetMinutes = 20,
        energyProfile = 'wave',
        pool,
        type,
        minBpm,
        maxBpm,
      } = req.body || {};

      const targetSecs = Math.max(60, Math.min(180 * 60, parseFloat(targetMinutes) * 60));
      console.log(`\n🎛️  /mixes/build — profile=${energyProfile}, target=${targetSecs}s`);

      // -------- 1. Fetch candidate segments --------
      const where = [];
      const params = [];
      if (type)   { where.push('type = ?');        params.push(type); }
      if (minBpm) { where.push('bpm >= ?');         params.push(parseFloat(minBpm)); }
      if (maxBpm) { where.push('bpm <= ?');         params.push(parseFloat(maxBpm)); }
      if (pool)   { where.push('pool_tags LIKE ?'); params.push(`%"${pool}"%`); }

      // Fetch ALL dj_segments — no limit, scoring picks the best
      const sql = `SELECT * FROM dj_segments
                   ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                   ORDER BY quality DESC`;
      let djCandidates = await db.all(sql, params);

      // Also pull processed regular segments to widen the pool
      const regularRows = await db.all(
        `SELECT id, track_id, audio_path,
                start_time, end_time, duration, bpm, key, energy,
                segment_type AS type, NULL AS intensity,
                mix_in_point AS mix_in_offset, mix_out_point AS mix_out_offset,
                0.5 AS quality, '[]' AS pool_tags
         FROM segments
         WHERE processed = 1 AND audio_path IS NOT NULL AND duration > 10`,
        [],
      );
      const regularMapped = regularRows.map((s) => ({
        ...s,
        camelot_key: camelotOf(s.key) || null,
        pool_tags: [],
      }));

      let candidates = [...djCandidates, ...regularMapped];
      console.log(`  🗂️  Pool: ${djCandidates.length} dj_segments + ${regularMapped.length} segments = ${candidates.length} total`);

      if (candidates.length < 2) {
        return res.status(400).json({
          success: false,
          error: `Not enough segments (${candidates.length}). Upload and process some tracks first.`,
        });
      }

      // -------- 2. Verify audio files exist --------
      candidates = (
        await Promise.all(
          candidates.map(async (s) => {
            try { await fs.access(s.audio_path); return s; } catch { return null; }
          }),
        )
      ).filter(Boolean);

      if (candidates.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Not enough segments with valid audio files.',
        });
      }

      // -------- 2b. Sub-divide long segments into 10-20s chunks --------
      const TARGET_SUB = 15;  // ideal sub-segment length (seconds)
      const MIN_SUB    = 10;  // minimum usable length
      const MAX_SUB    = 25;  // anything shorter → use as-is
      const subCandidates = [];
      for (const seg of candidates) {
        const dur = seg.duration || ((seg.end_time || 0) - (seg.start_time || 0));
        if (dur <= MAX_SUB) {
          subCandidates.push(seg);
        } else {
          // Divide into TARGET_SUB-second chunks with a small overlap
          const step = TARGET_SUB;
          for (let offset = 0; offset + MIN_SUB <= dur; offset += step) {
            const subDur = Math.min(TARGET_SUB + 5, dur - offset);
            if (subDur < MIN_SUB) continue;
            subCandidates.push({
              ...seg,
              id: `${seg.id}_s${Math.round(offset)}`,
              _sub_start:     offset,
              duration:       subDur,
              mix_in_offset:  0,
              mix_out_offset: subDur,
            });
          }
        }
      }
      candidates = subCandidates;
      console.log(`  ✂️  After sub-division: ${candidates.length} candidate chunks (${MIN_SUB}-${MAX_SUB + 5}s each)`);

      // -------- 3. Energy-profile curve --------
      function energyTargetAtFraction(f) {
        switch (energyProfile) {
          case 'rise':       return f;
          case 'drop':       return 1 - f;
          case 'flat':       return 0.6;
          case 'peak_time':  return f < 0.2 ? f * 2 : f < 0.8 ? 1.0 : (1 - f) * 5;
          case 'wave':
          default:           return 0.5 + 0.5 * Math.sin(f * Math.PI * 2);
        }
      }

      // -------- 4. Fill timeline — multi-factor scoring --------
      // Scores: energy (35%) + Camelot key (30%) + BPM proximity (15%) + type flow (20%)
      // No hard MAX_REPEATS — a soft repeat penalty in the score keeps variety natural.
      const timeline = [];
      let totalDur = 0;
      const trackUses = new Map(); // track_id → use count for soft penalty

      while (totalDur < targetSecs) {
        const fraction = totalDur / targetSecs;
        const targetEnergy = energyTargetAtFraction(fraction);
        const prev = timeline[timeline.length - 1];
        const prevTrackId = prev?.track_id;

        let best = null;
        let bestScore = Infinity;
        for (const seg of candidates) {
          if (seg.track_id === prevTrackId) continue; // never back-to-back same track
          const uses = trackUses.get(seg.track_id) || 0;
          const repeatPenalty = uses * 0.15;
          const jitter = (Math.random() - 0.5) * 0.08; // ±0.04 noise for variety
          const score = segmentScore(seg, prev, targetEnergy) + repeatPenalty + jitter;
          if (score < bestScore) { bestScore = score; best = seg; }
        }
        // Fallback: allow same track if nothing else fits
        if (!best) {
          for (const seg of candidates) {
            const uses = trackUses.get(seg.track_id) || 0;
            const jitter = (Math.random() - 0.5) * 0.08;
            const score = segmentScore(seg, prev, targetEnergy) + uses * 0.15 + jitter;
            if (score < bestScore) { bestScore = score; best = seg; }
          }
        }
        if (!best) break;

        const segDur = best.duration || ((best.end_time || 0) - (best.start_time || 0));
        const transition = selectTransition(prev, best);
        timeline.push({ ...best, _transition: transition });
        totalDur += segDur;
        trackUses.set(best.track_id, (trackUses.get(best.track_id) || 0) + 1);
        if (timeline.length > 1000) break; // safety cap only
      }

      if (timeline.length === 0) {
        return res.status(400).json({ success: false, error: 'Could not build a timeline.' });
      }

      console.log(`  📋 Timeline: ${timeline.length} segments, ~${totalDur.toFixed(0)}s planned`);

      // -------- 5. Render with SeamlessMixEngine --------
      const mixId = `mix_${Date.now()}`;
      const result = await seamlessMixEngine.createMix(mixId, timeline);

      // -------- 6. Persist --------
      const mixName = name || `Smart Mix · ${energyProfile} · ${new Date().toLocaleString()}`;
      await db.run(
        'INSERT INTO mixes (id, name, duration, output_path) VALUES (?, ?, ?, ?)',
        [mixId, mixName, result.duration, result.path],
      );

      console.log(`✅ /mixes/build complete: ${mixId} (${result.duration.toFixed(1)}s)`);

      res.json({
        success: true,
        mixId,
        duration: result.duration,
        plannedDuration: totalDur,
        segments: timeline.length,
        energyProfile,
        audioUrl: `/data/mixes/${mixId}.wav`,
        name: mixName,
      });
    } catch (err) {
      console.error('❌ /mixes/build error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

export default { registerIntelligentRoutes };
