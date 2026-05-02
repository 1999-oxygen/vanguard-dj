import React, { useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, Layers, Play, Square, GitCommit, Cpu, FastForward } from 'lucide-react';

const FlightPlanTimeline = ({ flightPlan, isPlaying, currentTime, onPlay, onStop, onSeek, className }) => {
  const containerRef = useRef(null);
  const SAMPLE_RATE = 44100;

  const stemColors = {
    master: { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.5)', text: 'text-purple-400', label: 'MASTER' },
    vocals: { bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.5)', text: 'text-pink-400', label: 'VOCALS' },
    drums: { bg: 'rgba(6,182,212,0.15)', border: 'rgba(6,182,212,0.5)', text: 'text-cyan-400', label: 'DRUMS' },
    bass: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.5)', text: 'text-blue-400', label: 'BASS' },
    melody: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.5)', text: 'text-yellow-400', label: 'MELODY' },
  };

  const timelineData = useMemo(() => {
    if (!flightPlan?.timeline) return null;
    const maxSamples = Math.max(...flightPlan.timeline.map(e => {
      const triggerSample = e.trigger_sample_master || 0;
      const durationSamples = (e.source_end_sample || 0) - (e.source_start_sample || 0);
      const warpedDuration = durationSamples / (e.time_stretch_ratio || 1);
      return triggerSample + warpedDuration;
    }));
    const totalDurationSec = maxSamples / SAMPLE_RATE;
    const events = flightPlan.timeline.map(event => {
      const triggerSample = event.trigger_sample_master || 0;
      const durationSamples = (event.source_end_sample || 0) - (event.source_start_sample || 0);
      const warpedDurationSamples = durationSamples / (event.time_stretch_ratio || 1);
      return {
        ...event,
        startSec: triggerSample / SAMPLE_RATE,
        durationSec: warpedDurationSamples / SAMPLE_RATE,
        leftPct: (triggerSample / maxSamples) * 100,
        widthPct: (warpedDurationSamples / maxSamples) * 100,
      };
    });
    return { totalDurationSec, maxSamples, events };
  }, [flightPlan]);

  const lanes = useMemo(() => {
    if (!timelineData) return [];
    const laneMap = {};
    timelineData.events.forEach(event => {
      const stem = event.stem_target || 'master';
      if (!laneMap[stem]) laneMap[stem] = [];
      laneMap[stem].push(event);
    });
    return Object.entries(laneMap).map(([stem, events]) => ({
      stem, events,
      label: stemColors[stem]?.label || stem.toUpperCase(),
      theme: stemColors[stem] || stemColors.master,
    }));
  }, [timelineData]);

  const playheadPos = useMemo(() => {
    if (!timelineData || !isPlaying) return 0;
    return (currentTime / timelineData.totalDurationSec) * 100;
  }, [timelineData, currentTime, isPlaying]);

  const handleTimelineClick = useCallback((e) => {
    if (!containerRef.current || !timelineData) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek?.(ratio * timelineData.totalDurationSec);
  }, [timelineData, onSeek]);

  if (!flightPlan || !timelineData) {
    return React.createElement('div', { className: `glass-retro rounded-3xl p-8 text-center ${className || ''}` },
      React.createElement(Layers, { size: 48, className: 'mx-auto text-purple-400/50 mb-4' }),
      React.createElement('p', { className: 'text-sm text-slate-500 font-mono' }, 'No flight plan loaded')
    );
  }

  const { totalDurationSec, maxSamples, events } = timelineData;

  return React.createElement('div', { className: `glass-retro rounded-3xl p-6 space-y-4 ${className || ''}` },
    /* Header */
    React.createElement('div', { className: 'flex items-center justify-between' },
      React.createElement('div', { className: 'flex items-center gap-3' },
        React.createElement(Layers, { size: 16, className: 'text-purple-400' }),
        React.createElement('div', null,
          React.createElement('h3', { className: 'font-retro text-xs font-black uppercase tracking-widest text-cyan-400' },
            `Flight Plan: ${flightPlan.title || 'Untitled'}`
          ),
          React.createElement('p', { className: 'text-[10px] text-slate-500 font-mono' },
            `${flightPlan.total_events} events | ${totalDurationSec.toFixed(2)}s | ${flightPlan.global_bpm} BPM | Key ${flightPlan.global_key} | ${maxSamples.toLocaleString()} samples`
          )
        )
      ),
      React.createElement('div', { className: 'flex items-center gap-2' },
        isPlaying
          ? React.createElement('button', {
              onClick: onStop,
              className: 'p-2 rounded-xl bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 transition-all'
            }, React.createElement(Square, { size: 14, fill: 'currentColor' }))
          : React.createElement('button', {
              onClick: onPlay,
              className: 'p-2 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-all'
            }, React.createElement(Play, { size: 14, fill: 'currentColor' }))
      )
    ),

    /* Diagnostics */
    React.createElement('div', { className: 'grid grid-cols-3 gap-3' },
      React.createElement('div', { className: 'flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/50 border border-white/5' },
        React.createElement(GitCommit, { size: 12, className: 'text-purple-400' }),
        React.createElement('div', null,
          React.createElement('div', { className: 'text-[9px] font-black text-slate-500 uppercase tracking-widest' }, 'Recombination'),
          React.createElement('div', { className: 'text-[10px] font-mono text-slate-300' }, 'Phase-Locked Grid')
        )
      ),
      React.createElement('div', { className: 'flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/50 border border-white/5' },
        React.createElement(FastForward, { size: 12, className: 'text-cyan-400' }),
        React.createElement('div', null,
          React.createElement('div', { className: 'text-[9px] font-black text-slate-500 uppercase tracking-widest' }, 'Elastic Engine'),
          React.createElement('div', { className: 'text-[10px] font-mono text-slate-300' }, 'Real-Time')
        )
      ),
      React.createElement('div', { className: 'flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/50 border border-white/5' },
        React.createElement(Cpu, { size: 12, className: 'text-pink-400' }),
        React.createElement('div', null,
          React.createElement('div', { className: 'text-[9px] font-black text-slate-500 uppercase tracking-widest' }, 'Anti-Click'),
          React.createElement('div', { className: 'text-[10px] font-mono text-slate-300' }, 'Ghost-Tails Armed')
        )
      )
    ),

    /* Ruler */
    React.createElement('div', { className: 'flex items-center gap-2 text-[10px] font-mono text-slate-600 px-2' },
      React.createElement(Clock, { size: 10 }),
      React.createElement('span', null, '0.000s'),
      React.createElement('div', { className: 'flex-1 h-px bg-white/10' }),
      React.createElement('span', { className: 'text-emerald-400/50 flex items-center gap-1' },
        React.createElement(GitCommit, { size: 10 }),
        ' Sample-Accurate Scheduling Active'
      ),
      React.createElement('div', { className: 'flex-1 h-px bg-white/10' }),
      React.createElement('span', null, `${totalDurationSec.toFixed(3)}s`)
    ),

    /* Timeline Canvas */
    React.createElement('div', {
      ref: containerRef,
      className: 'relative h-72 bg-slate-950/50 rounded-2xl border border-white/5 overflow-hidden cursor-pointer',
      onClick: handleTimelineClick
    },
      /* Grid */
      Array.from({ length: 10 }, (_, i) =>
        React.createElement('div', {
          key: i,
          className: 'absolute top-0 bottom-0 w-px bg-white/5',
          style: { left: `${i * 10}%` }
        })
      ),
      /* Playhead */
      isPlaying && React.createElement(motion.div, {
        className: 'absolute top-0 bottom-0 w-px bg-pink-400 z-50 pointer-events-none',
        style: { left: `${playheadPos}%` },
        animate: { left: `${playheadPos}%` },
        transition: { duration: 0.05 }
      },
        React.createElement('div', { className: 'absolute top-0 -left-1.5 w-3 h-3 bg-pink-400 rounded-sm' }),
        React.createElement('div', { className: 'absolute bottom-0 -left-1.5 w-3 h-3 bg-pink-400 rounded-sm' }),
        React.createElement('div', { className: 'absolute top-1/2 -translate-y-1/2 -right-20 px-2 py-1 bg-pink-500/20 rounded text-[9px] font-mono text-pink-400 border border-pink-500/30' },
          `${currentTime.toFixed(2)}s`
        )
      ),
      /* Lanes */
      React.createElement('div', { className: 'absolute inset-0 flex flex-col py-2' },
        lanes.map((lane) =>
          React.createElement('div', { key: lane.stem, className: 'flex-1 flex items-center relative border-b border-white/5' },
            React.createElement('div', { className: 'absolute left-2 z-10 px-2 py-1 bg-slate-900/80 rounded text-[9px] font-black uppercase text-slate-400 tracking-widest border border-white/5' },
              `${lane.label} BUS`
            ),
            lane.events.map((event) =>
              React.createElement(motion.div, {
                key: event.sequence_id,
                initial: { scaleX: 0, opacity: 0 },
                animate: { scaleX: 1, opacity: 1 },
                transition: { duration: 0.3, delay: event.sequence_id * 0.05 },
                className: 'absolute h-14 rounded-lg border flex flex-col justify-center px-3 overflow-hidden group cursor-pointer hover:brightness-125 transition-all',
                style: {
                  left: `${event.leftPct}%`,
                  width: `${Math.max(event.widthPct, 0.5)}%`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  backgroundColor: lane.theme.bg,
                  borderColor: lane.theme.border,
                  boxShadow: `0 0 20px ${lane.theme.bg}`,
                }
              },
                React.createElement('div', { className: 'absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-transparent to-white/10' }),
                React.createElement('div', { className: 'absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-l from-transparent to-white/10' }),
                React.createElement('div', { className: 'text-[10px] font-black text-white/90 truncate z-10' },
                  event.track_name || event.atom_id
                ),
                React.createElement('div', { className: 'flex items-center gap-2 mt-1 z-10' },
                  React.createElement('span', { className: 'text-[8px] font-mono text-slate-400 bg-black/40 px-1.5 py-0.5 rounded' },
                    `x${event.time_stretch_ratio.toFixed(3)}`
                  ),
                  event.pitch_shift_semitones !== 0 && React.createElement('span', {
                    className: `text-[8px] font-black px-1.5 py-0.5 rounded bg-black/40 ${lane.theme.text}`
                  }, `#${event.pitch_shift_semitones > 0 ? '+' : ''}${event.pitch_shift_semitones.toFixed(1)}`),
                  event.ui_metrics?.vocals_wps > 0 && React.createElement('span', {
                    className: `text-[8px] font-black px-1.5 py-0.5 rounded bg-black/40 ${lane.theme.text}`
                  }, `WPS: ${event.ui_metrics.vocals_wps}`)
                ),
                React.createElement('div', { className: 'absolute inset-0 flex items-center justify-between opacity-15 px-2 pointer-events-none' },
                  Array.from({ length: 20 }, (_, i) =>
                    React.createElement('div', {
                      key: i,
                      className: 'w-0.5 bg-white rounded-full',
                      style: { height: `${20 + Math.random() * 60}%` }
                    })
                  )
                )
              )
            )
          )
        )
      )
    ),

    /* Event List */
    React.createElement('div', { className: 'space-y-1 max-h-32 overflow-y-auto' },
      events.slice(0, 5).map((event) =>
        React.createElement('div', { key: event.sequence_id, className: 'flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900/30 text-[10px] font-mono' },
          React.createElement('span', { className: 'text-purple-400 w-4' }, event.sequence_id),
          React.createElement('span', { className: 'text-slate-300 flex-1 truncate' }, event.track_name || event.atom_id),
          React.createElement('span', { className: 'text-slate-500' }, `${event.startSec.toFixed(2)}s`),
          React.createElement('span', { className: 'text-cyan-400/70' }, `x${event.time_stretch_ratio.toFixed(3)}`),
          event.pitch_shift_semitones !== 0 && React.createElement('span', { className: 'text-pink-400/70' },
            `#${event.pitch_shift_semitones > 0 ? '+' : ''}${event.pitch_shift_semitones.toFixed(1)}`
          )
        )
      ),
      events.length > 5 && React.createElement('p', { className: 'text-[10px] text-slate-600 font-mono text-center' },
        `...and ${events.length - 5} more events`
      )
    )
  );
};

export default FlightPlanTimeline;
