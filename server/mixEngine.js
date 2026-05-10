import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIXES_DIR = path.join(__dirname, '../data/mixes');

await fs.mkdir(MIXES_DIR, { recursive: true });

export class MixEngine {
  constructor() {
    this.mixesDir = MIXES_DIR;
  }

  async createMix(mixId, timelineItems) {
    console.log(`🎚️ Creating mix ${mixId} with ${timelineItems.length} segments...`);
    
    // Use WAV format for accurate duration metadata
    const mixPath = path.join(this.mixesDir, `${mixId}.wav`);
    const tempDir = path.join(this.mixesDir, `temp_${mixId}`);
    
    // Create temp directory
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (err) {
      console.error('Error creating temp directory:', err);
    }

    // If too many segments, process in sections to avoid overwhelming FFmpeg
    if (timelineItems.length > 10) {
      console.log(`📦 Processing ${timelineItems.length} segments in sections...`);
      return await this.createMixInSections(mixId, timelineItems, tempDir, mixPath);
    }
    
    // Process each segment
    const tempFiles = [];
    
    try {
      const processedSegments = [];
      
      for (let i = 0; i < timelineItems.length; i++) {
        const item = timelineItems[i];
        const nextItem = timelineItems[i + 1];
        
        const processed = await this.processSegmentForMix(
          item,
          nextItem,
          i,
          mixId
        );
        
        processedSegments.push(processed);
        tempFiles.push(processed.path);
      }
      
      await this.concatenateSegments(processedSegments, mixPath);
      
      for (const tempFile of tempFiles) {
        try {
          await fs.unlink(tempFile);
        } catch (err) {
        }
      }
      
      const stats = await fs.stat(mixPath);
      
      // Get actual duration from the audio file using ffprobe
      const actualDuration = await this.getAudioDuration(mixPath);
      
      console.log(`✅ Mix created: ${mixPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${actualDuration.toFixed(2)}s)`);
      
      return {
        path: mixPath,
        duration: actualDuration // Use actual duration from audio file
      };
      
    } catch (error) {
      for (const tempFile of tempFiles) {
        try {
          await fs.unlink(tempFile);
        } catch (err) {
        }
      }
      throw error;
    }
  }

  async processSegmentForMix(item, nextItem, index, mixId) {
    const tempPath = path.join(this.mixesDir, `temp_${mixId}_${index}.wav`);
    
    // stemConfig is already an object from the API, no need to parse
    const stemConfig = item.stemConfig || {
      vocals: 1.0,
      drums: 1.0,
      bass: 1.0,
      other: 1.0
    };
    
    const transitionDuration = item.transitionDuration || 2.0;
    const hasTransition = nextItem && item.transitionType !== 'cut';
    
    if (hasTransition) {
      await this.applyFadeOut(item.audioPath, tempPath, transitionDuration);
    } else {
      await fs.copyFile(item.audioPath, tempPath);
    }
    
    return {
      path: tempPath,
      duration: item.duration,
      hasTransition,
      transitionDuration
    };
  }

  async applyFadeOut(inputPath, outputPath, fadeDuration) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          `afade=t=out:st=${fadeDuration}:d=${fadeDuration}`
        ])
        .audioCodec('pcm_s16le')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async applyFadeIn(inputPath, outputPath, fadeDuration) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFilters([
          `afade=t=in:st=0:d=${fadeDuration}`
        ])
        .audioCodec('pcm_s16le')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async concatenateSegments(segments, outputPath) {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      
      segments.forEach(seg => {
        command.input(seg.path);
      });
      
      const filterComplex = [];
      let currentTime = 0;
      
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const nextSeg = segments[i + 1];
        
        if (nextSeg && seg.hasTransition) {
          const crossfadeDuration = seg.transitionDuration;
          const offset = currentTime + seg.duration - crossfadeDuration;
          
          filterComplex.push(
            `[${i}][${i + 1}]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri[a${i}]`
          );
          
          currentTime = offset + nextSeg.duration;
        } else {
          filterComplex.push(`[${i}]anull[a${i}]`);
          currentTime += seg.duration;
        }
      }
      
      if (filterComplex.length > 0) {
        const concatInputs = filterComplex.map((_, i) => `[a${i}]`).join('');
        filterComplex.push(`${concatInputs}concat=n=${segments.length}:v=0:a=1[out]`);
        
        command
          .complexFilter(filterComplex)
          .outputOptions('-map', '[out]')
          .audioCodec('pcm_s16le')
          .output(outputPath)
          .on('end', () => resolve(outputPath))
          .on('error', reject)
          .run();
      } else {
        command
          .mergeToFile(outputPath, this.mixesDir)
          .on('end', () => resolve(outputPath))
          .on('error', reject);
      }
    });
  }

  async createTransition(segment1Path, segment2Path, transitionType, duration) {
    const outputPath = path.join(
      this.mixesDir,
      `transition_${Date.now()}.wav`
    );
    
    switch (transitionType) {
      case 'crossfade':
        return await this.crossfadeTransition(segment1Path, segment2Path, outputPath, duration);
      
      case 'beatmatch':
        return await this.beatmatchTransition(segment1Path, segment2Path, outputPath, duration);
      
      case 'echo':
        return await this.echoTransition(segment1Path, segment2Path, outputPath, duration);
      
      case 'cut':
      default:
        return await this.cutTransition(segment1Path, segment2Path, outputPath);
    }
  }

  async crossfadeTransition(path1, path2, outputPath, duration) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(path1)
        .input(path2)
        .complexFilter([
          `[0]afade=t=out:st=0:d=${duration}[a0]`,
          `[1]afade=t=in:st=0:d=${duration}[a1]`,
          `[a0][a1]acrossfade=d=${duration}:c1=tri:c2=tri`
        ])
        .audioCodec('pcm_s16le')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async beatmatchTransition(path1, path2, outputPath, duration) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(path1)
        .input(path2)
        .complexFilter([
          `[0]afade=t=out:st=0:d=${duration},aecho=0.8:0.9:${duration * 1000}:0.3[a0]`,
          `[1]afade=t=in:st=0:d=${duration}[a1]`,
          `[a0][a1]acrossfade=d=${duration}:c1=qua:c2=qua`
        ])
        .audioCodec('pcm_s16le')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async echoTransition(path1, path2, outputPath, duration) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(path1)
        .input(path2)
        .complexFilter([
          `[0]afade=t=out:st=0:d=${duration},aecho=0.8:0.88:60:0.4[a0]`,
          `[1]afade=t=in:st=0:d=${duration},highpass=f=200[a1]`,
          `[a0][a1]acrossfade=d=${duration}:c1=exp:c2=exp`
        ])
        .audioCodec('pcm_s16le')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async cutTransition(path1, path2, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(path1)
        .input(path2)
        .complexFilter('[0][1]concat=n=2:v=0:a=1')
        .audioCodec('pcm_s16le')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async applyStemMix(segmentPath, stemConfig, outputPath) {
    const { vocals = 1.0, drums = 1.0, bass = 1.0, other = 1.0 } = stemConfig;
    
    return new Promise((resolve, reject) => {
      ffmpeg(segmentPath)
        .audioFilters([
          `volume=${vocals}`,
        ])
        .audioCodec('pcm_s16le')
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .run();
    });
  }

  async createMixInSections(mixId, timelineItems, tempDir, finalMixPath) {
    console.log(`📦 Using simple concatenation method (robust alternative)...`);
    
    const segmentPaths = [];
    
    // Extract each segment individually (simple, no complex filters)
    for (let i = 0; i < timelineItems.length; i++) {
      const item = timelineItems[i];
      const segmentPath = path.join(tempDir, `seg_${i}.wav`);
      
      if (i % 10 === 0) {
        console.log(`🎵 Processing segment ${i + 1}/${timelineItems.length}...`);
      }
      
      try {
        // Simple extraction with fade (no complex processing)
        await this.extractSegmentSimple(item, segmentPath);
        segmentPaths.push(segmentPath);
      } catch (error) {
        console.warn(`⚠️ Skipping segment ${i + 1}: ${error.message}`);
      }
    }
    
    if (segmentPaths.length === 0) {
      throw new Error('No segments could be processed');
    }
    
    console.log(`✅ Extracted ${segmentPaths.length} segments`);
    console.log(`🔗 Joining segments using concat demuxer (stable method)...`);
    
    // Use concat demuxer (most stable method)
    await this.concatWithDemuxer(segmentPaths, finalMixPath, tempDir);
    
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.error('Cleanup warning:', err.message);
    }
    
    const stats = await fs.stat(finalMixPath);
    
    // Get actual duration from the audio file using ffprobe
    const actualDuration = await this.getAudioDuration(finalMixPath);
    
    console.log(`✅ Mix complete: ${(stats.size / 1024 / 1024).toFixed(2)}MB, ${actualDuration.toFixed(2)}s`);
    
    return {
      path: finalMixPath,
      duration: actualDuration, // Use actual duration from audio file
      size: stats.size
    };
  }

  async getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error('Error getting audio duration:', err);
          // Fallback: estimate based on file size and WAV format
          // WAV at 44.1kHz, 16-bit, stereo: ~176.4 KB per second
          const stats = require('fs').statSync(filePath);
          const estimatedDuration = stats.size / 176400;
          console.log(`Using estimated duration: ${estimatedDuration.toFixed(2)}s`);
          resolve(estimatedDuration);
          return;
        }
        const duration = metadata.format.duration;
        console.log(`Actual audio duration from ffprobe: ${duration.toFixed(2)}s`);
        resolve(duration);
      });
    });
  }

  async extractSegmentSimple(item, outputPath) {
    return new Promise((resolve, reject) => {
      const inputPath = item.audioPath || item.original_path || item.metadata?.original_path;
      const startTime = item.metadata?.original_start || item.startTime || item.start_time || 0;
      const duration = item.duration || 10;
      
      // Use provided fade times or calculate for gapless mixing
      const fadeIn = Math.min(item.fadeIn || 0.5, duration / 4);
      const fadeOut = Math.min(item.fadeOut || 2, duration / 4);
      
      console.log(`🎵 Extracting segment: input=${inputPath}, start=${startTime}s, duration=${duration}s, fadeIn=${fadeIn}s, fadeOut=${fadeOut}s`);
      
      // Check if input file exists
      if (!inputPath) {
        return reject(new Error('No audio path provided for segment'));
      }
      
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .audioFilters([
          `afade=t=in:st=0:d=${fadeIn}`,
          `afade=t=out:st=${duration - fadeOut}:d=${fadeOut}`
        ])
        .audioCodec('pcm_s16le')
        .audioChannels(2)
        .audioFrequency(44100)
        .outputOptions(['-f', 'wav'])
        .output(outputPath)
        .on('start', (cmd) => console.log(`🎬 FFmpeg extract: ${cmd}`))
        .on('end', () => {
          console.log(`✅ Extracted: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`❌ Extraction error for ${inputPath}:`, err.message);
          reject(err);
        })
        .run();
    });
  }

  async concatWithDemuxer(segmentPaths, outputPath, tempDir) {
    const concatListPath = path.join(tempDir, 'concat_list.txt');
    
    // Use absolute paths and escape single quotes
    const concatContent = segmentPaths.map(p => {
      const absolutePath = path.resolve(p);
      // Escape single quotes for FFmpeg
      const escapedPath = absolutePath.replace(/'/g, "'\\''");
      return `file '${escapedPath}'`;
    }).join('\n');
    
    await fs.writeFile(concatListPath, concatContent);
    
    console.log(`📝 Concat list created with ${segmentPaths.length} files`);
    
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .audioCodec('pcm_s16le') // Use PCM for accurate duration metadata
        .audioChannels(2)
        .audioFrequency(44100)
        .outputOptions(['-f', 'wav'])
        .output(outputPath)
        .on('start', (cmd) => console.log(`🎬 FFmpeg command: ${cmd}`))
        .on('end', resolve)
        .on('error', (err) => {
          console.error(`❌ FFmpeg concat error: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  async joinSections(sectionPaths, outputPath) {
    const concatListPath = path.join(path.dirname(sectionPaths[0]), 'sections_list.txt');
    
    // Use absolute paths and escape single quotes
    const concatContent = sectionPaths.map(p => {
      const absolutePath = path.resolve(p);
      const escapedPath = absolutePath.replace(/'/g, "'\\''");
      return `file '${escapedPath}'`;
    }).join('\n');
    
    await fs.writeFile(concatListPath, concatContent);
    
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .audioCodec('libmp3lame')
        .audioBitrate('320k')
        .output(outputPath)
        .on('end', () => {
          fs.unlink(concatListPath).catch(() => {});
          resolve();
        })
        .on('error', (err) => {
          console.error(`❌ Section join error: ${err.message}`);
          reject(err);
        })
        .run();
    });
  }

  calculateMixDuration(timelineItems) {
    if (timelineItems.length === 0) return 0;
    
    let totalDuration = 0;
    
    for (let i = 0; i < timelineItems.length; i++) {
      const item = timelineItems[i];
      const nextItem = timelineItems[i + 1];
      
      totalDuration += item.duration;
      
      if (nextItem && item.transitionType !== 'cut') {
        totalDuration -= (item.transitionDuration || 2.0);
      }
    }
    
    return totalDuration;
  }
}

export default new MixEngine();
