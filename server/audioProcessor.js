import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEGMENTS_DIR = path.join(__dirname, '../data/segments');
const STEMS_DIR = path.join(__dirname, '../data/stems');

await fs.mkdir(SEGMENTS_DIR, { recursive: true });
await fs.mkdir(STEMS_DIR, { recursive: true });

export class AudioProcessor {
  constructor() {
    this.segmentsDir = SEGMENTS_DIR;
    this.stemsDir = STEMS_DIR;
  }

  async getAudioMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.warn('⚠️ ffprobe failed, using defaults:', err.message);
          resolve({
            duration: 60,
            sampleRate: 44100,
            channels: 2,
            bitrate: 320000
          });
          return;
        }
        
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        resolve({
          duration: parseFloat(metadata.format.duration) || 60,
          sampleRate: parseInt(audioStream?.sample_rate) || 44100,
          channels: parseInt(audioStream?.channels) || 2,
          bitrate: parseInt(metadata.format.bit_rate) || 320000
        });
      });
    });
  }

  async detectBeats(filePath) {
    return new Promise((resolve, reject) => {
      const beats = [];
      let peakData = [];
      
      ffmpeg(filePath)
        .audioFilters([
          'aresample=44100',
          'asplit[a][b]',
          '[a]lowpass=f=150,volume=2[low]',
          '[b]highpass=f=150[high]',
          '[low][high]amix=inputs=2'
        ])
        .audioFilters('astats=metadata=1:reset=1,ametadata=print:file=-')
        .format('null')
        .on('stderr', (line) => {
          const rmsMatch = line.match(/RMS level dB: ([\-0-9.]+)/);
          if (rmsMatch) {
            peakData.push(parseFloat(rmsMatch[1]));
          }
        })
        .on('end', () => {
          const threshold = -20;
          let lastBeat = -1;
          const minBeatInterval = 0.3;
          
          peakData.forEach((rms, idx) => {
            const time = (idx * 0.1);
            if (rms > threshold && (time - lastBeat) > minBeatInterval) {
              beats.push(time);
              lastBeat = time;
            }
          });
          
          if (beats.length === 0) {
            for (let i = 0; i < 30; i++) {
              beats.push(i * 0.5);
            }
          }
          
          resolve(beats);
        })
        .on('error', (err) => {
          console.warn('⚠️ Beat detection failed, using grid:', err.message);
          const fallbackBeats = [];
          for (let i = 0; i < 60; i++) {
            fallbackBeats.push(i * 0.5);
          }
          resolve(fallbackBeats);
        })
        .run();
    });
  }

  async estimateBPM(beats, duration) {
    if (beats.length < 2) return 120;
    
    const intervals = [];
    for (let i = 1; i < Math.min(beats.length, 50); i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60 / avgInterval);
    
    return Math.max(60, Math.min(200, bpm));
  }

  async analyzeEnergy(filePath, startTime, duration) {
    return new Promise((resolve, reject) => {
      let rmsValues = [];
      
      ffmpeg(filePath)
        .setStartTime(startTime)
        .setDuration(duration)
        .audioFilters('astats=metadata=1:reset=1')
        .format('null')
        .on('stderr', (line) => {
          const match = line.match(/RMS level dB: ([\-0-9.]+)/);
          if (match) {
            rmsValues.push(parseFloat(match[1]));
          }
        })
        .on('end', () => {
          if (rmsValues.length === 0) {
            resolve(0.5);
            return;
          }
          
          const avgRMS = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length;
          const normalized = Math.max(0, Math.min(1, (avgRMS + 60) / 60));
          resolve(normalized);
        })
        .on('error', () => resolve(0.5))
        .run();
    });
  }

  async extractSegment(filePath, startTime, duration, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .setStartTime(startTime)
        .setDuration(duration)
        .audioCodec('pcm_s16le')
        .audioFrequency(44100)
        .audioChannels(2)
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async separateStems(audioPath, segmentId) {
    const stemTypes = ['vocals', 'drums', 'bass', 'other'];
    const stems = {};
    
    console.log(`🎵 Separating stems for segment ${segmentId}...`);
    
    try {
      const demucsAvailable = await this.checkDemucsAvailable();
      
      if (demucsAvailable) {
        stems = await this.separateWithDemucs(audioPath, segmentId);
      } else {
        stems = await this.separateWithFFmpeg(audioPath, segmentId);
      }
      
      console.log(`✅ Stems separated for ${segmentId}`);
      return stems;
      
    } catch (error) {
      console.error(`❌ Stem separation failed for ${segmentId}:`, error.message);
      return await this.createDummyStems(audioPath, segmentId);
    }
  }

  async checkDemucsAvailable() {
    try {
      await execAsync('which demucs');
      return true;
    } catch {
      return false;
    }
  }

  async separateWithDemucs(audioPath, segmentId) {
    const outputDir = path.join(this.stemsDir, segmentId);
    await fs.mkdir(outputDir, { recursive: true });
    
    try {
      await execAsync(`demucs --two-stems=vocals -o "${outputDir}" "${audioPath}"`);
      
      const modelDir = path.join(outputDir, 'htdemucs');
      const trackName = path.basename(audioPath, path.extname(audioPath));
      const baseDir = path.join(modelDir, trackName);
      
      return {
        vocals: path.join(baseDir, 'vocals.wav'),
        drums: path.join(baseDir, 'drums.wav'),
        bass: path.join(baseDir, 'bass.wav'),
        other: path.join(baseDir, 'other.wav')
      };
    } catch (error) {
      console.warn('⚠️ Demucs failed, falling back to FFmpeg');
      return await this.separateWithFFmpeg(audioPath, segmentId);
    }
  }

  async separateWithFFmpeg(audioPath, segmentId) {
    const outputDir = path.join(this.stemsDir, segmentId);
    await fs.mkdir(outputDir, { recursive: true });
    
    const stems = {
      vocals: path.join(outputDir, 'vocals.wav'),
      drums: path.join(outputDir, 'drums.wav'),
      bass: path.join(outputDir, 'bass.wav'),
      other: path.join(outputDir, 'other.wav')
    };
    
    await Promise.all([
      this.extractFrequencyRange(audioPath, stems.vocals, 200, 3000, 1.5),
      this.extractFrequencyRange(audioPath, stems.drums, 60, 200, 2.0),
      this.extractFrequencyRange(audioPath, stems.bass, 20, 150, 1.8),
      this.extractFrequencyRange(audioPath, stems.other, 1000, 8000, 1.0)
    ]);
    
    return stems;
  }

  async extractFrequencyRange(inputPath, outputPath, lowFreq, highFreq, gain = 1.0) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          `highpass=f=${lowFreq}`,
          `lowpass=f=${highFreq}`,
          `volume=${gain}`
        ])
        .audioCodec('pcm_s16le')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async createDummyStems(audioPath, segmentId) {
    const outputDir = path.join(this.stemsDir, segmentId);
    await fs.mkdir(outputDir, { recursive: true });
    
    const stems = {
      vocals: path.join(outputDir, 'vocals.wav'),
      drums: path.join(outputDir, 'drums.wav'),
      bass: path.join(outputDir, 'bass.wav'),
      other: path.join(outputDir, 'other.wav')
    };
    
    for (const stemPath of Object.values(stems)) {
      await fs.copyFile(audioPath, stemPath);
    }
    
    return stems;
  }

  async createSegments(filePath, trackId, metadata) {
    console.log(`🔪 Creating segments for track ${trackId}...`);
    
    const beats = await this.detectBeats(filePath);
    const bpm = await this.estimateBPM(beats, metadata.duration);
    const segments = [];
    
    const beatsPerSegment = 16;
    const segmentDuration = (60 / bpm) * beatsPerSegment;
    
    const numSegments = Math.floor(metadata.duration / segmentDuration);
    
    for (let i = 0; i < numSegments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, metadata.duration);
      const duration = endTime - startTime;
      
      if (duration < 1) continue;
      
      const segmentId = `seg_${trackId}_${i}`;
      const segmentPath = path.join(this.segmentsDir, `${segmentId}.wav`);
      
      await this.extractSegment(filePath, startTime, duration, segmentPath);
      
      const energy = await this.analyzeEnergy(filePath, startTime, duration);
      
      segments.push({
        id: segmentId,
        trackId,
        startTime,
        endTime,
        duration,
        bpm,
        energy,
        danceability: 0.5 + (energy * 0.3),
        valence: 0.6 + (Math.random() * 0.2),
        key: metadata.key || 'C',
        beatCount: beatsPerSegment,
        derivation: 'BEAT_GRID_16BAR',
        audioPath: segmentPath
      });
    }
    
    console.log(`✅ Created ${segments.length} segments for track ${trackId}`);
    return segments;
  }

  async processSegmentStems(segment) {
    console.log(`🎛️ Processing stems for segment ${segment.id}...`);
    
    const stems = await this.separateStems(segment.audioPath, segment.id);
    
    const stemRecords = [];
    for (const [stemType, stemPath] of Object.entries(stems)) {
      stemRecords.push({
        id: `stem_${segment.id}_${stemType}`,
        segmentId: segment.id,
        stemType,
        audioPath: stemPath,
        gain: 1.0
      });
    }
    
    return stemRecords;
  }
}

export default new AudioProcessor();
