import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Slice, Trash2, Disc3 } from 'lucide-react';
import FileUpload from './FileUpload.jsx';

/**
 * Tracks queued locally before chopping / segmentation — scrollable list.
 */
const PreIngestLibrary = ({
  tracks,
  isAnalyzing,
  onAddFiles,
  onAnalyzeTrack,
  onSegmentTrack,
  onRemoveTrack,
}) => {
  const localTracks = tracks.filter((t) => t.source === 'local');

  return (
    <motion.div
      className="bg-slate-950/70 border border-slate-700/50 rounded-2xl p-4 flex flex-col gap-3 shadow-sm min-h-[220px] max-h-[42vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Disc3 size={16} className="text-cyan-400" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
            Ingest queue
          </span>
          <span className="text-[10px] font-mono text-slate-600">(pre-segment)</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500">{localTracks.length} local</span>
      </div>

      <div className="rounded-xl border border-slate-800/80 overflow-hidden">
        <FileUpload onAddTracks={onAddFiles} className="!p-4 !rounded-none border-0" />
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-[120px]">
        {localTracks.length === 0 && (
          <p className="text-[11px] font-mono text-slate-600 text-center py-6">
            Add audio files — they appear here before segmentation.
          </p>
        )}
        {localTracks.map((t) => (
          <motion.div
            key={t.id}
            layout
            className="flex flex-wrap items-center gap-2 rounded-xl bg-black/35 border border-white/10 px-3 py-2.5 hover:border-blue-400/25 transition-colors"
          >
            <div className="flex-1 min-w-[140px]">
              <div className="text-xs font-semibold text-slate-200 truncate" title={t.name}>
                {t.name}
              </div>
              <div className="text-[10px] font-mono text-slate-500 truncate">
                {t.bpm != null ? `${Math.round(t.bpm)} BPM` : '— BPM'}
                {t.key ? ` · ${t.key}` : ''}
                {t.hasAnalysis ? ' · analyzed' : ''}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                disabled={isAnalyzing || !t.file}
                onClick={() => onAnalyzeTrack(t)}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/40 text-[10px] font-mono uppercase text-violet-300 hover:bg-violet-500/25 disabled:opacity-35"
                title="Run analysis (Neural Core or client fallback)"
              >
                <Cpu size={12} />
                Analyze
              </button>
              <button
                type="button"
                disabled={isAnalyzing || !t.file}
                onClick={() => onSegmentTrack(t)}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-mono uppercase text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-35"
                title="Chop / import DNA segments into the pool"
              >
                <Slice size={12} />
                Segment
              </button>
              <button
                type="button"
                onClick={() => onRemoveTrack(t.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Remove from library"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <p className="text-[9px] font-mono text-slate-600 leading-relaxed">
        Flow: add files → optional <span className="text-violet-400">Analyze</span> →{' '}
        <span className="text-emerald-400">Segment</span> to feed the segment pool & Studio.
      </p>
    </motion.div>
  );
};

export default PreIngestLibrary;
