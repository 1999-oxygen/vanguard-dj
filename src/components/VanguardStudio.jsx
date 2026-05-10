import React, { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Square, SlidersHorizontal, Clock, GitBranch } from 'lucide-react';
import { generateMix, MIX_STYLES } from '../audio/segmentation/MixEngine.js';
import { filterSegmentsByParadigm } from '../audio/segmentation/segmentMetadata.js';
import { coerceSegmentFeatures } from '../audio/segmentation/SegmentMatcher.js';

const PARADIGM_OPTIONS = [
  { id: 'all', label: 'All segments' },
  { id: 'bpm_slow', label: 'BPM · slow (<110)' },
  { id: 'bpm_groove', label: 'BPM · groove (110–123)' },
  { id: 'bpm_peak', label: 'BPM · peak (124–131)' },
  { id: 'bpm_fast', label: 'BPM · fast (132+)' },
  { id: 'energy_low', label: 'Energy · low' },
  { id: 'energy_mid', label: 'Energy · mid' },
  { id: 'energy_high', label: 'Energy · high' },
  { id: 'type_dna', label: 'Source · DNA atoms' },
  { id: 'type_chop', label: 'Source · chopped' },
  { id: 'percussive', label: 'Timbre · percussive' },
  { id: 'bright', label: 'Timbre · bright' },
];

/**
 * Studio: paradigm filter + join preview timeline + play filtered mix.
 */
const VanguardStudio = ({
  segments,
  activeMix,
  activeSegmentIndex,
  isPlayingMix,
  onPlayMix,
  onStopMix,
  addLog,
}) => {
  const [paradigm, setParadigm] = useState('all');
  const [previewPlan, setPreviewPlan] = useState(null);

  const filtered = useMemo(
    () => filterSegmentsByParadigm(segments, paradigm),
    [segments, paradigm]
  );

  const rebuildPreview = useCallback(() => {
    const plan = buildPlanFromPool();
    if (!plan) setPreviewPlan(null);
  }, [buildPlanFromPool]);

  const buildPlanFromPool = useCallback(() => {
    const minNeed = 3;
    if (filtered.length < minNeed) {
      addLog?.(`Studio: need ≥${minNeed} matching segments (have ${filtered.length})`, 'warning');
      return null;
    }
    const mix = generateMix(filtered, {
      style: MIX_STYLES.JOURNEY,
      targetDuration: Math.min(420, Math.max(90, filtered.length * 12)),
      minTransitionScore: 0.35,
    });
    if (!mix.segments?.length) return null;
    const plan = {
      name: `Studio · ${PARADIGM_OPTIONS.find((p) => p.id === paradigm)?.label || paradigm}`,
      segments: mix.segments.map((s) => s.id),
      transitions: mix.transitions,
      totalDuration: mix.totalDuration,
      segmentObjects: mix.segments,
    };
    setPreviewPlan(plan);
    addLog?.(
      `Studio join: ${mix.segments.length} clips · ~${mix.totalDuration.toFixed(0)}s`,
      'ai'
    );
    return plan;
  }, [filtered, paradigm, addLog]);

  const handlePlay = useCallback(() => {
    const plan = previewPlan?.segments?.length ? previewPlan : buildPlanFromPool();
    if (!plan?.segments?.length) {
      addLog?.('Studio: nothing to play — adjust filter or add segments', 'warning');
      return;
    }
    const { segmentObjects: _o, ...rest } = plan;
    onPlayMix?.(rest);
  }, [previewPlan, buildPlanFromPool, onPlayMix, addLog]);

  const timeline = previewPlan?.segmentObjects || [];
  const totalDur =
    previewPlan?.totalDuration ||
    timeline.reduce((s, x) => s + (x.duration || 0), 0) ||
    1;

  return (
    <motion.div
      className="flex flex-col gap-4 h-full min-h-[320px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-400">
          <SlidersHorizontal size={16} className="text-blue-400" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Studio join</span>
        </div>
        <select
          value={paradigm}
          onChange={(e) => {
            setParadigm(e.target.value);
            setPreviewPlan(null);
          }}
          className="flex-1 min-w-[200px] bg-black/50 border border-slate-600/50 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-200"
        >
          {PARADIGM_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
          {filtered.length} / {segments.length} match
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={rebuildPreview}
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-[11px] font-mono uppercase tracking-wide text-slate-200 hover:bg-white/15"
        >
          Build join preview
        </button>
        <button
          type="button"
          onClick={handlePlay}
          disabled={!previewPlan?.segments?.length}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/25 border border-blue-400/50 text-[11px] font-mono uppercase text-blue-200 hover:bg-blue-500/35 disabled:opacity-40"
        >
          <Play size={14} />
          Play mix
        </button>
        <button
          type="button"
          onClick={() => onStopMix?.()}
          disabled={!isPlayingMix}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-[11px] font-mono uppercase text-rose-300 hover:bg-rose-500/25 disabled:opacity-40"
        >
          <Square size={14} />
          Stop
        </button>
      </div>

      {/* Timeline strip */}
      <div className="rounded-2xl border border-slate-700/50 bg-black/40 p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            Join timeline
          </span>
          <span>{totalDur.toFixed(1)}s</span>
        </div>
        <div className="relative h-14 rounded-xl bg-slate-900/80 overflow-hidden border border-slate-800">
          {timeline.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-slate-600">
              Build join preview to see clips & transitions
            </div>
          )}
          <div className="absolute inset-y-0 left-0 flex">
            {timeline.map((seg, i) => {
              const w = Math.max(2, (seg.duration / totalDur) * 100);
              const f = coerceSegmentFeatures(seg);
              const hue = 200 + f.avgEnergy * 100;
              const curId = activeMix?.segments?.[activeSegmentIndex];
              const isActive = curId === seg.id || curId === seg.id?.toString();
              return (
                <div
                  key={`${seg.id}-${i}`}
                  className="relative h-full border-r border-black/40 flex-shrink-0"
                  style={{
                    width: `${w}%`,
                    minWidth: '4px',
                    background: `hsla(${hue}, 55%, ${isActive ? 42 : 28}%, 0.9)`,
                  }}
                  title={`${seg.trackName || ''} · ${seg.duration?.toFixed(1)}s`}
                >
                  <span className="absolute bottom-1 left-1 text-[8px] font-mono text-white/80 truncate max-w-full pr-1">
                    {i + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Transition markers */}
        {previewPlan?.transitions?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {previewPlan.transitions.slice(0, 12).map((tr, i) => (
              <span
                key={`${tr.from}-${tr.to}-${i}`}
                className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700/50"
                title={`Score ${(tr.score * 100).toFixed(0)}% · xf ${(tr.crossfadeDuration ?? 0).toFixed(1)}s`}
              >
                <GitBranch size={10} className="text-amber-400/80" />
                {tr.type?.replace(/_/g, ' ') || 'cut'}
                <span className="text-slate-600">·</span>
                {(tr.crossfadeDuration ?? 0).toFixed(1)}s
              </span>
            ))}
            {previewPlan.transitions.length > 12 && (
              <span className="text-[9px] font-mono text-slate-600">
                +{previewPlan.transitions.length - 12} more
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default VanguardStudio;
