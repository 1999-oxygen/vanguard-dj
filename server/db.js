import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/vanguard.db');

const db = new sqlite3.Database(DB_PATH);
db.get = promisify(db.get.bind(db));
db.all = promisify(db.all.bind(db));
db.run = promisify(db.run.bind(db));

await db.run(`
  CREATE TABLE IF NOT EXISTS tracks (
    id TEXT PRIMARY KEY,
    filename TEXT,
    original_path TEXT,
    duration REAL,
    bpm REAL,
    key TEXT,
    sample_rate INTEGER,
    channels INTEGER,
    processed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS segments (
    id TEXT PRIMARY KEY,
    track_id TEXT,
    start_time REAL,
    end_time REAL,
    duration REAL,
    bpm REAL,
    energy REAL,
    danceability REAL,
    valence REAL,
    key TEXT,
    beat_count INTEGER,
    derivation TEXT,
    audio_path TEXT,
    processed BOOLEAN DEFAULT 0,
    segment_type TEXT,
    peak_energy REAL,
    energy_variance REAL,
    intensity TEXT,
    suitable_for TEXT,
    harmonic_content TEXT,
    rhythmic_complexity REAL,
    spectral_brightness REAL,
    onset_density REAL,
    mix_in_point REAL,
    mix_out_point REAL,
    loop_compatible BOOLEAN DEFAULT 0,
    transition_type TEXT,
    audio_fingerprint TEXT,
    similarity_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks (id)
  )
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS segments_v2 (
    id TEXT PRIMARY KEY,
    track_id TEXT,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    duration REAL NOT NULL,
    bpm REAL,
    key TEXT,
    camelot_key TEXT,
    time_signature TEXT,
    beats INTEGER,
    phrase_length INTEGER,
    segment_type TEXT,
    energy REAL,
    intensity TEXT,
    suitable_for TEXT,
    analysis_method TEXT,
    analysis_version TEXT,
    confidence REAL,
    musical_validity INTEGER,
    beat_aligned INTEGER,
    features_temporal TEXT,
    features_spectral TEXT,
    features_harmonic TEXT,
    features_rhythmic TEXT,
    features_timbral TEXT,
    mix_in_point REAL,
    mix_out_point REAL,
    loop_compatible INTEGER,
    stems_separated INTEGER DEFAULT 0,
    stems_vocals_path TEXT,
    stems_drums_path TEXT,
    stems_bass_path TEXT,
    stems_other_path TEXT,
    stems_method TEXT,
    stems_quality REAL,
    tags TEXT,
    ml_trainable INTEGER DEFAULT 1,
    quality_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks (id)
  )
`);
await db.run(`CREATE INDEX IF NOT EXISTS idx_segments_v2_bpm ON segments_v2(bpm)`);
await db.run(`CREATE INDEX IF NOT EXISTS idx_segments_v2_key ON segments_v2(camelot_key)`);
await db.run(`CREATE INDEX IF NOT EXISTS idx_segments_v2_energy ON segments_v2(energy)`);
await db.run(`CREATE INDEX IF NOT EXISTS idx_segments_v2_type ON segments_v2(segment_type)`);
await db.run(`CREATE INDEX IF NOT EXISTS idx_segments_v2_duration ON segments_v2(duration)`);
await db.run(`CREATE INDEX IF NOT EXISTS idx_segments_v2_quality ON segments_v2(quality_score)`);

await db.run(`
  CREATE TABLE IF NOT EXISTS stems (
    id TEXT PRIMARY KEY,
    segment_id TEXT,
    stem_type TEXT,
    audio_path TEXT,
    gain REAL DEFAULT 1.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (segment_id) REFERENCES segments (id)
  )
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS mixes (
    id TEXT PRIMARY KEY,
    name TEXT,
    duration REAL,
    output_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

await db.run(`
  CREATE TABLE IF NOT EXISTS mix_timeline (
    id TEXT PRIMARY KEY,
    mix_id TEXT,
    segment_id TEXT,
    position REAL,
    duration REAL,
    transition_type TEXT,
    transition_duration REAL,
    stem_config TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mix_id) REFERENCES mixes (id),
    FOREIGN KEY (segment_id) REFERENCES segments (id)
  )
`);

console.log('✅ Database schema initialized');
console.log('📊 Tables: tracks, segments, stems, mixes, mix_timeline');

export default db;
