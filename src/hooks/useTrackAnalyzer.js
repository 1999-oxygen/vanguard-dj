import { useCallback, useEffect, useState, useRef } from 'react';

let essentiaInstance = null;

const initEssentia = async () => {
  if (!essentiaInstance) {
    // Fallback mock analysis - Essentia WASM complex for client
    console.log('Essentia mock - full impl needs WASM worker');
    essentiaInstance = {
      PercivalBpmEstimator: (data) => [124],
      Windowing: (data, type) => data,
      RMS: (frames) => new Array(100).fill(0.1).map(() => Math.random() * 0.5),
      BeatTracker: (rms, bpm) => [0, 4.16, 8.33],
    };
  }
  return essentiaInstance;
};

/**
 * @param {Function} [externalLog] - Optional external logging function.
 *   If not provided, logs go to console.
 */
export const useTrackAnalyzer = (externalLog) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const audioBufferRef = useRef(null);

  const addLog = useCallback(
    (text, type = 'system') => {
      if (externalLog) {
        externalLog(text, type);
      } else {
        console.log(`[TrackAnalyzer] ${text}`);
      }
    },
    [externalLog]
  );

  const analyzeTrack = useCallback(async (audioBuffer) => {
    setIsAnalyzing(true);
    addLog('Starting Essentia analysis...', 'ai');
    
    try {
      const essentia = await initEssentia();
      audioBufferRef.current = audioBuffer;
      
      // Audio downsample (44.1kHz -> 44.1kHz ok, but vectorize)
      const audioData = audioBuffer.getChannelData(0);
      const frameSize = 4096;
      const hopSize = 2048;
      
      // BPM via Percival algorithm
      const bpmArray = essentia.PercivalBpmEstimator(audioData);
      const bpm = bpmArray[0];
      
      // Energy curve (RMS)
      const windowedFrames = essentia.Windowing(audioData, "hann").frame(2048, 1024);
      const rms = essentia.RMS(windowedFrames);
      
      // Beatgrid (simple peaks)
      const beats = essentia.BeatTracker(rms, bpm);
      
      // Silence/phrase segments (low energy)
      const segments = [];
      for (let i = 0; i < rms.length; i += 100) {
        if (rms[i] < 0.05) segments.push(i * hopSize / essentia.sampleRate);
      }
      
      // Lyrics density stub (would use Whisper.js or API)
      const lyricsDensity = Array.from({ length: Math.floor(audioBuffer.duration / 5) }, () => Math.random() * 0.8 + 0.1);
      
      const trackAnalysis = {
        bpm: Math.round(bpm),
        energyCurve: rms.slice(-100), // last 100 frames
        beatPositions: beats,
        phraseSegments: segments,
        lyricsDensity,
        key: 'Auto-est (needs Chroma)', // future
        duration: audioBuffer.duration
      };
      
      setAnalysis(trackAnalysis);
      addLog(`Analysis complete: ${bpm} BPM | ${segments.length} phrases`, 'ai');
      
      return trackAnalysis;
    } catch (error) {
      addLog(`Analysis error: ${error.message}`, 'error');
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [addLog]);

  // Chop into segments
  const chopSegments = useCallback((segments, buffer) => {
    const chopped = [];
    segments.forEach((start, i) => {
      const end = segments[i + 1] || buffer.duration;
      if (end - start > 2) { // min 2s
        chopped.push({ start, end, buffer: extractBuffer(buffer, start, end) });
      }
    });
    return chopped;
  }, []);

  const extractBuffer = (buffer, start, end) => {
    const newBuffer = buffer.context.createBuffer(1, (end - start) * buffer.sampleRate, buffer.sampleRate);
    const data = buffer.getChannelData(0);
    newBuffer.getChannelData(0).set(data.slice(start * buffer.sampleRate, end * buffer.sampleRate));
    return newBuffer;
  };

  return {
    analysis,
    analyzeTrack,
    isAnalyzing,
    chopSegments
  };
};

export default useTrackAnalyzer;

