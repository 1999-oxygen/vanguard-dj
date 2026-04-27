/**
 * @fileoverview SegmentVisualizer
 * Displays the segment pool as an interactive grid/matrix.
 * Each cell represents a segment colored by energy, timbre, and compatibility.
 * Users can click segments to preview, see connections, and build custom mixes.
 */

import React, { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, GitMerge, Zap, Music, Layers, Volume2 } from 'lucide-react';

const SegmentVisualizer = ({
  segments,
  activeMix,
  activeSegmentIndex,
  onSegmentClick,
  onPreviewSegment,
  onPlayMix,
  onStopMix,
  isPlaying,
  compatibleSegments,
  stats,
}) => {
  const [hoveredSegment, setHoveredSegment] = useState(null);
  const [viewMode, setViewMode] = useState('energy'); // energy, timbre, timeline

  // Group segments by track for color coding
  const trackColors = useMemo(() => {
    const colors = [
      '#06b6d4', // cyan
      '#a78bfa', // purple
      '#ec4899', // pink
      '#10b981', // emerald
      '#f59e0b', // amber
      '#3b82f6', // blue
      '#ef4444', // red
      '#8b5cf6', // violet
    ];
    const map = new Map();
    let colorIdx = 0;
    segments.forEach(seg => {
      if (!map.has(seg.trackId)) {
        map.set(seg.trackId, colors[colorIdx % colors.length]);
        colorIdx++;
      }
    });
    return map;
  }, [segments]);

  const getSegmentColor = useCallback((seg) => {
    const baseColor = trackColors.get(seg.trackId) || '#64748b';

    if (viewMode === 'energy') {
      const energy = seg.features?.avgEnergy || 0.5;
      return `hsla(${180 + energy * 140}, 80%, ${30 + energy * 40}%, 0.85)`;
    }

    if (viewMode === 'timbre') {
      const brightness = seg.features?.spectralRolloff || 0.5;
      return `hsla(${200 + brightness * 120}, 70%, 50%, 0.85)`;
    }

    return baseColor;
  }, [viewMode, trackColors]);

  const getSegmentOpacity = useCallback((seg, index) => {
    if (!activeMix) return 1;
    const isInMix = activeMix.segments?.includes(seg.id);
    const isActive = activeMix.segments?.[activeSegmentIndex] === seg.id;

    if (isActive) return 1;
    if (isInMix) return 0.7;
    return 0.25;
  }, [activeMix, activeSegmentIndex]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-retro rounded-3xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers size={16} className="text-neon/cyan-400" />
          <h3 className="font-retro text-xs font-black uppercase tracking-[0.3em] text-neon/cyan-400">
            Segment Matrix
          </h3>
          {stats && (
            <span className="text-[10px] font-mono text-slate-500">
              {stats.totalSegments} segs / {stats.uniqueTracks} tracks
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {['energy', 'timbre', 'timeline'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${
                viewMode === mode
                  ? 'bg-neon/cyan-500/20 text-neon/cyan-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Segment Grid */}
      <div className="grid grid-cols-8 md:grid-cols-12 lg:grid-cols-16 gap-1 max-h-48 overflow-y-auto scrollbar-hide p-1">
        {segments.map((seg, index) => (
          <motion.div
            key={seg.id}
            className="aspect-square rounded cursor-pointer relative group"
            style={{
              backgroundColor: getSegmentColor(seg),
              opacity: getSegmentOpacity(seg, index),
            }}
            whileHover={{ scale: 1.3, zIndex: 10 }}
            onClick={() => onSegmentClick?.(seg)}
            onMouseEnter={() => setHoveredSegment(seg)}
            onMouseLeave={() => setHoveredSegment(null)}
          >
            {/* Active indicator */}
            {activeMix?.segments?.[activeSegmentIndex] === seg.id && (
              <motion.div
                className="absolute inset-0 border-2 border-white rounded"
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            )}

            {/* Preview button on hover */}
            {onPreviewSegment && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }}
                whileHover={{ opacity: 1, scale: 1.2 }}
                animate={{ opacity: hoveredSegment?.id === seg.id ? 1 : 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onPreviewSegment(seg.start, seg.end);
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded"
                title={`Preview ${seg.trackName} (${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s)`}
              >
                <Volume2 size={14} className="text-white drop-shadow-lg" />
              </motion.button>
            )}
          </motion.div>
        ))}
      </div>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredSegment && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-retro rounded-xl p-3 text-[10px] font-mono space-y-1 border border-neon/purple-500/20"
          >
            <div className="flex items-center gap-2 text-neon/cyan-400">
              <Music size={12} />
              {hoveredSegment.trackName}
            </div>
            <div className="grid grid-cols-3 gap-2 text-slate-400">
              <span>Energy: {(hoveredSegment.features?.avgEnergy * 100).toFixed(0)}%</span>
              <span>BPM: {hoveredSegment.features?.bpm}</span>
              <span>Key: {hoveredSegment.features?.key}</span>
              <span>Dur: {formatDuration(hoveredSegment.duration)}</span>
              <span>Flux: {(hoveredSegment.features?.spectralFlux * 100).toFixed(0)}%</span>
              <span>Vocal: {(hoveredSegment.features?.vocalDensity * 100).toFixed(0)}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compatible segments list */}
      {compatibleSegments && compatibleSegments.length > 0 && (
        <div className="border-t border-neon/retro/scanline pt-3">
          <h4 className="text-[10px] font-retro font-black uppercase tracking-widest text-neon/pink-400 mb-2">
            Compatible Matches
          </h4>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {compatibleSegments.map((match) => (
              <button
                key={match.segment.id}
                onClick={() => onSegmentClick?.(match.segment)}
                className="flex-shrink-0 glass-retro rounded-lg px-3 py-2 text-left hover:bg-neon/purple-500/10 transition-all"
              >
                <div className="text-[9px] font-mono text-neon/cyan-400">
                  {match.segment.trackName}
                </div>
                <div className="text-[8px] text-slate-500">
                  Score: {(match.score * 100).toFixed(0)}% • {match.type}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Playback controls */}
      {activeMix && (
        <div className="flex items-center gap-3 border-t border-neon/retro/scanline pt-3">
          <button
            onClick={isPlaying ? onStopMix : onPlayMix}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-retro font-black uppercase tracking-widest transition-all ${
              isPlaying
                ? 'bg-neon/pink-500/20 text-neon/pink-300 border border-neon/pink-400/30'
                : 'bg-neon/cyan-500/20 text-neon/cyan-300 border border-neon/cyan-400/30'
            }`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'Stop Mix' : 'Play Mix'}
          </button>

          <div className="flex-grow">
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-neon/cyan-400 to-neon/pink-400"
                animate={{
                  width: `${((activeSegmentIndex + 1) / (activeMix.segments?.length || 1)) * 100}%`,
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="text-[9px] font-mono text-slate-500 mt-1 text-center">
              Segment {activeSegmentIndex + 1} / {activeMix.segments?.length || 0}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SegmentVisualizer);

