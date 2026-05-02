import React, { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

/**
 * @fileoverview Waveform
 * Visualizes audio output using real-time frequency and time-domain data
 * from the MasterBus AnalyserNode. Falls back to a BPM-synced mock animation
 * when no audio engine data is available.
 *
 * Props:
 *   - isLive: boolean
 *   - bpm: number
 *   - getFrequencyData: () => Uint8Array | null
 *   - getTimeData: () => Uint8Array | null
 *   - progress: number (0.0 - 1.0)
 *   - masterLevel: number (0.0 - 1.0)
 */

const Waveform = ({
  isLive,
  bpm,
  getFrequencyData,
  getTimeData,
  progress = 0,
  masterLevel = 0,
}) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const barCount = 80;

  /**
   * Draw the waveform visualization onto a canvas.
   * Uses real analyser data when live; otherwise shows a static preview.
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear with glass-retro background color
    ctx.fillStyle = 'rgba(15, 15, 35, 0.4)';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }

    if (isLive && getFrequencyData) {
      const freqData = getFrequencyData();
      const timeData = getTimeData ? getTimeData() : null;

      if (freqData && freqData.length > 0) {
        const barWidth = width / barCount;
        const binStep = Math.floor(freqData.length / barCount);

        for (let i = 0; i < barCount; i++) {
          // Use frequency magnitude for bar height
          const binIndex = i * binStep;
          const value = freqData[binIndex] || 0;
          const normalized = value / 255;

          // Add some time-domain ripple for organic feel
          let timeValue = 0;
          if (timeData) {
            const timeIndex = Math.floor((i / barCount) * timeData.length);
            timeValue = Math.abs((timeData[timeIndex] || 128) - 128) / 128;
          }

          const barHeight = (normalized * 0.7 + timeValue * 0.3) * height * 0.9;
          const x = i * barWidth;
          const y = height - barHeight;

          // Gradient color based on frequency position (low = cyan, high = pink)
          const hue = 180 + (i / barCount) * 140; // 180 (cyan) -> 320 (pink)
          const saturation = 80 + normalized * 20;
          const lightness = 50 + normalized * 20;

          const gradient = ctx.createLinearGradient(x, height, x, y);
          gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.8)`);
          gradient.addColorStop(1, `hsla(${hue + 20}, ${saturation}%, ${lightness + 10}%, 0.3)`);

          ctx.fillStyle = gradient;
          ctx.fillRect(x + 1, y, barWidth - 2, barHeight);

          // Top glow cap
          ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${normalized * 0.6})`;
          ctx.fillRect(x + 1, y, barWidth - 2, 2);
        }
      }
    } else {
      // Static / idle preview using sinusoidal mock data
      const barWidth = width / barCount;
      for (let i = 0; i < barCount; i++) {
        const t = Date.now() * 0.002 + i * 0.4;
        const barHeight = 8 + Math.sin(i * 0.3) * 4 + Math.sin(t) * 2;
        const x = i * barWidth;
        const y = height - barHeight;

        ctx.fillStyle = 'rgba(100, 116, 139, 0.3)';
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
      }
    }

    // Draw playhead
    const playheadX = progress * width;
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.8)'; // neon pink
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(236, 72, 153, 0.6)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw master level indicator (right edge)
    const levelHeight = masterLevel * height;
    ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
    ctx.fillRect(width - 4, height - levelHeight, 4, levelHeight);

    animationRef.current = requestAnimationFrame(draw);
  }, [isLive, getFrequencyData, getTimeData, progress, masterLevel]);

  // Start/stop animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Set canvas resolution to match display size for crisp rendering
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
    }

    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="h-28 w-full relative flex items-end justify-between gap-0.5 overflow-hidden rounded-2xl glass-retro scanlines crt-screen"
    >
      {/* Background grid */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50 pointer-events-none" />

      {/* Canvas for real-time waveform */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: 'crisp-edges' }}
      />

      {/* Retro labels */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-retro uppercase text-neon/pink-400 tracking-widest neon-glow pointer-events-none">
        {isLive ? 'MASTER WAVEFORM • LIVE' : 'MASTER WAVEFORM'}
      </div>
    </motion.div>
  );
};

export default React.memo(Waveform);

