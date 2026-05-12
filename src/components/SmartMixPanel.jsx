/**
 * Smart Mix Panel
 * ---------------
 * DJ Segments / Pools explorer + Build Smart Mix UI.
 * Talks directly to the intelligent API endpoints.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Layers, Clock, Play, Square, RefreshCw,
  ChevronDown, ChevronRight, Music, BarChart2,
  AlertTriangle, CheckCircle2, Loader2, Sliders,
  Search, X, Info, ListPlus,
} from 'lucide-react';

const API = '';

const ENERGY_PROFILES = [
  { id: 'wave',      label: 'Wave',      desc: 'Rises and falls — classic set arc' },
  { id: 'rise',      label: 'Rise',      desc: 'Builds energy from start to finish' },
  { id: 'drop',      label: 'Drop',      desc: 'High energy first, then cool down' },
  { id: 'flat',      label: 'Flat',      desc: 'Consistent mid-range energy' },
  { id: 'peak_time', label: 'Peak Time', desc: 'Warm-up → peak → outro' },
];

const TYPE_COLORS = {
  DROP:    '#ef4444',
  BUILDUP: '#f97316',
  BREAK:   '#3b82f6',
  INTRO:   '#8b5cf6',
  OUTRO:   '#6b7280',
  GROOVE:  '#10b981',
  PEAK:    '#fbbf24',
};

function typeColor(t) { return TYPE_COLORS[t] || '#64748b'; }

function fmtDur(s) {
  if (!s && s !== 0) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ─── mini energy bar ──────────────────────────────────────────────────────────
function EnergyBar({ value = 0 }) {
  const pct = Math.round((value || 0) * 100);
  const hue = 120 - pct * 1.2;
  return (
    <div className="flex items-center gap-1.5 min-w-[60px]">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `hsl(${hue},70%,50%)` }} />
      </div>
      <span className="text-[9px] font-mono text-slate-500 w-6 text-right">{pct}%</span>
    </div>
  );
}

// ─── Segment row ─────────────────────────────────────────────────────────────
function chunkCount(dur) {
  if (!dur || dur <= 25) return 1;
  return Math.ceil(dur / 15);
}

function SegmentRow({ seg, onClick }) {
  const dur = seg.duration || ((seg.end_time || 0) - (seg.start_time || 0));
  const chunks = chunkCount(dur);
  return (
    <button
      onClick={() => onClick?.(seg)}
      className="w-full grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group text-left"
    >
      {/* Type badge */}
      <span
        className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0"
        style={{ background: typeColor(seg.type) + '33', color: typeColor(seg.type) }}
      >
        {seg.type || '?'}
      </span>

      {/* Track title */}
      <span className="text-[11px] text-slate-200 truncate font-medium" title={seg.track_title}>
        {seg.track_title || seg.id}
      </span>

      {/* Camelot key */}
      <span className="text-[10px] font-mono text-cyan-400 w-8 text-center shrink-0">
        {seg.camelot_key || '—'}
      </span>

      {/* BPM */}
      <span className="text-[10px] font-mono text-slate-400 w-14 text-right shrink-0">
        {seg.bpm ? `${Math.round(seg.bpm)} BPM` : '—'}
      </span>

      {/* Duration + chunks */}
      <span className="text-[10px] font-mono text-slate-400 w-20 text-right shrink-0">
        {fmtDur(dur)}
        {chunks > 1 && (
          <span className="ml-1 text-[9px] text-slate-600">×{chunks}</span>
        )}
      </span>

      {/* Energy bar */}
      <div className="w-16 shrink-0">
        <EnergyBar value={seg.energy} />
      </div>
    </button>
  );
}

// ─── Segment detail modal ────────────────────────────────────────────────────
function SegmentDetailModal({ seg, onClose, onPreview, onAddToTimeline }) {
  if (!seg) return null;
  const dur = seg.duration || ((seg.end_time || 0) - (seg.start_time || 0));
  const fields = [
    ['Track',      seg.track_title || '—'],
    ['Type',       seg.type || '—'],
    ['Key',        seg.camelot_key || '—'],
    ['BPM',        seg.bpm ? Math.round(seg.bpm) : '—'],
    ['Duration',   dur ? `${dur.toFixed(1)}s (${chunkCount(dur)} chunks)` : '—'],
    ['Energy',     seg.energy != null ? `${Math.round(seg.energy * 100)}%` : '—'],
    ['Intensity',  seg.intensity || '—'],
    ['Quality',    seg.quality != null ? seg.quality.toFixed(2) : '—'],
    ['Low energy', seg.low_energy != null ? seg.low_energy.toFixed(3) : '—'],
    ['High energy', seg.high_energy != null ? seg.high_energy.toFixed(3) : '—'],
    ['Flux',       seg.flux != null ? seg.flux.toFixed(3) : '—'],
    ['Onset dens.', seg.onset_density != null ? seg.onset_density.toFixed(3) : '—'],
    ['Slope',      seg.energy_slope != null ? seg.energy_slope.toFixed(3) : '—'],
    ['Mix-in',     seg.mix_in_offset != null ? `${seg.mix_in_offset.toFixed(1)}s` : '—'],
    ['Mix-out',    seg.mix_out_offset != null ? `${seg.mix_out_offset.toFixed(1)}s` : '—'],
    ['Segment ID', seg.id],
  ];
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          className="bg-slate-900 border border-slate-700 rounded-2xl p-5 min-w-[420px] max-w-[560px] max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded"
                style={{ background: typeColor(seg.type) + '33', color: typeColor(seg.type) }}
              >
                {seg.type || '?'}
              </span>
              <h3 className="text-sm font-bold text-slate-100 truncate">{seg.track_title || 'Segment'}</h3>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-200">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-mono mb-4">
            {fields.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-800/60 py-1">
                <span className="text-slate-500">{k}</span>
                <span className="text-slate-200 truncate ml-2">{v}</span>
              </div>
            ))}
          </div>

          {!!seg.pool_tags?.length && (
            <div className="mb-4">
              <div className="text-[9px] font-mono uppercase text-slate-500 mb-1">Pool tags</div>
              <div className="flex flex-wrap gap-1">
                {seg.pool_tags.map((t) => (
                  <span key={t} className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => onPreview?.(seg)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/20 border border-blue-400/40 text-[11px] font-mono text-blue-200 hover:bg-blue-500/30"
            >
              <Play size={12} /> Preview
            </button>
            <button
              onClick={() => onAddToTimeline?.(seg)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-green-500/20 border border-green-400/40 text-[11px] font-mono text-green-200 hover:bg-green-500/30"
            >
              <ListPlus size={12} /> Queue
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Pool chip ────────────────────────────────────────────────────────────────
function PoolChip({ pool, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-xl text-[10px] font-mono transition-all border ${
        selected
          ? 'bg-blue-500/25 border-blue-400/50 text-blue-300'
          : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:border-slate-500/60 hover:text-slate-300'
      }`}
    >
      {pool.name} <span className="opacity-60">({pool.count})</span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SmartMixPanel({ addLog }) {
  // Segments / Pools state
  const [segments, setSegments]     = useState([]);
  const [pools, setPools]           = useState([]);
  const [groupedPools, setGrouped]  = useState({});
  const [selectedPool, setSelectedPool] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [segPage, setSegPage]       = useState(0);
  const SEG_PAGE = 40;

  // Search + detail + queue state
  const [searchQuery, setSearchQuery]   = useState('');
  const [selectedSeg, setSelectedSeg]   = useState(null);
  const [queue, setQueue]               = useState([]); // auto-fill timeline

  // Build-mix state
  const [targetMinutes, setTargetMinutes] = useState(20);
  const [energyProfile, setEnergyProfile] = useState('wave');
  const [filterType, setFilterType]       = useState('');
  const [building, setBuilding]           = useState(false);
  const [buildResult, setBuildResult]     = useState(null);
  const [buildError, setBuildError]       = useState(null);

  // Playback
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const rafRef = useRef(null);

  // ── load segments & pools ───────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, pRes] = await Promise.all([
        fetch(`${API}/dj-segments?limit=500`),
        fetch(`${API}/pools`),
      ]);
      const [sData, pData] = await Promise.all([sRes.json(), pRes.json()]);
      if (sData.success) setSegments(sData.segments || []);
      if (pData.success) {
        setPools(pData.pools || []);
        setGrouped(pData.grouped || {});
      }
    } catch (e) {
      addLog?.(`SmartMix load error: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  useEffect(() => { load(); }, [load]);

  // ── filter segments by search, pool, type ────────────────────────────
  const displayed = (() => {
    let list = segments;
    if (selectedPool) list = list.filter((s) => (s.pool_tags || []).includes(selectedPool));
    if (filterType)   list = list.filter((s) => s.type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      // support bpm:, key:, type: shortcuts + free text
      list = list.filter((s) => {
        const title  = (s.track_title || '').toLowerCase();
        const type   = (s.type || '').toLowerCase();
        const key    = (s.camelot_key || '').toLowerCase();
        const pools  = (s.pool_tags || []).join(' ').toLowerCase();
        const bpm    = String(Math.round(s.bpm || 0));
        const hay = `${title} ${type} ${key} ${pools} ${bpm}bpm ${bpm}`;
        // AND across space-separated tokens
        return q.split(/\s+/).every((tok) => hay.includes(tok));
      });
    }
    return list;
  })();

  // ── auto-populate queue with highest-quality usable segments ─────────
  useEffect(() => {
    if (!segments.length) { setQueue([]); return; }
    // "Usable" = has audio_path + BPM + type; rank by quality × energy, take top 20
    const usable = segments
      .filter((s) => s.audio_path && s.bpm && s.type && s.type !== 'REGULAR')
      .map((s) => ({ ...s, _score: (s.quality ?? 0.5) * 0.7 + (s.energy ?? 0.5) * 0.3 }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 20);
    setQueue(usable);
  }, [segments]);

  const pageSegs = displayed.slice(segPage * SEG_PAGE, (segPage + 1) * SEG_PAGE);
  const totalPages = Math.ceil(displayed.length / SEG_PAGE);

  // ── unique types in current view ────────────────────────────────────────
  const allTypes = [...new Set(segments.map((s) => s.type).filter(Boolean))];

  // ── build mix ───────────────────────────────────────────────────────────
  const handleBuild = useCallback(async () => {
    setBuildError(null);
    setBuildResult(null);
    setBuilding(true);
    addLog?.(`🎛️  Building smart mix: ${targetMinutes}min · ${energyProfile}`, 'ai');
    try {
      const res = await fetch(`${API}/mixes/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetMinutes,
          energyProfile,
          pool: selectedPool || undefined,
          type: filterType || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setBuildResult(data);
      addLog?.(`✅ Smart mix ready: ${fmtDur(data.duration)} · ${data.segments} segs`, 'ai');
    } catch (e) {
      setBuildError(e.message);
      addLog?.(`❌ Build failed: ${e.message}`, 'error');
    } finally {
      setBuilding(false);
    }
  }, [targetMinutes, energyProfile, selectedPool, filterType, addLog]);

  // ── playback ────────────────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    if (!buildResult?.mixId) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      cancelAnimationFrame(rafRef.current);
    } else {
      if (!audio.src || !audio.src.includes(buildResult.mixId)) {
        audio.src = `${API}/mixes/${buildResult.mixId}/audio`;
      }
      audio.play().then(() => {
        setPlaying(true);
        const tick = () => {
          if (audio.duration) setPlayProgress(audio.currentTime / audio.duration);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }).catch(() => {});
    }
  }, [playing, buildResult]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden text-slate-300">
      <audio ref={audioRef} onEnded={() => { setPlaying(false); setPlayProgress(0); }} />

      {/* ── TOP ROW: stats + refresh ───────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <Layers size={14} className="text-blue-400" />
          <span>{segments.length} segments</span>
          <span className="text-slate-600">·</span>
          <span className="text-green-400">
            {segments.reduce((s, seg) => s + chunkCount(seg.duration || ((seg.end_time||0)-(seg.start_time||0))), 0)} mix chunks
          </span>
          <span className="text-slate-600">·</span>
          <span>{pools.length} pools</span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-[10px] font-mono text-slate-400 hover:text-slate-200 hover:border-slate-500/50 transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── BODY: two-column layout ────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* LEFT: Pools + Segment list */}
        <div className="flex flex-col gap-3 w-[55%] min-w-0">

          {/* Pool chips grouped by axis */}
          <div className="bg-black/40 border border-slate-700/40 rounded-2xl p-3 flex flex-col gap-2">
            <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1">
              Pools
            </div>
            {loading && segments.length === 0 ? (
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                <Loader2 size={12} className="animate-spin" /> Loading pools…
              </div>
            ) : Object.keys(groupedPools).length === 0 ? (
              <p className="text-[10px] font-mono text-slate-600">
                No pools yet — run <code className="text-blue-400">dj-process-all</code> first.
              </p>
            ) : (
              Object.entries(groupedPools).map(([axis, axPools]) => (
                <div key={axis} className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[9px] font-mono text-slate-600 uppercase w-10 shrink-0">{axis}</span>
                  {axPools.map((p) => (
                    <PoolChip
                      key={p.name}
                      pool={p}
                      selected={selectedPool === p.name}
                      onClick={() => {
                        setSelectedPool(selectedPool === p.name ? null : p.name);
                        setSegPage(0);
                      }}
                    />
                  ))}
                </div>
              ))
            )}

            {/* Type filter */}
            {allTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center pt-1 border-t border-slate-800/60">
                <span className="text-[9px] font-mono text-slate-600 uppercase w-10 shrink-0">type</span>
                {allTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setFilterType(filterType === t ? '' : t); setSegPage(0); }}
                    className={`px-2 py-0.5 rounded text-[9px] font-black border transition-all ${
                      filterType === t
                        ? 'border-opacity-100 opacity-100'
                        : 'opacity-50 hover:opacity-80 border-transparent'
                    }`}
                    style={{
                      borderColor: typeColor(t),
                      background: typeColor(t) + (filterType === t ? '33' : '15'),
                      color: typeColor(t),
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Segment list */}
          <div className="flex-1 min-h-0 bg-black/40 border border-slate-700/40 rounded-2xl overflow-hidden flex flex-col">
            {/* Search box */}
            <div className="px-3 py-2 border-b border-slate-800/60 flex items-center gap-2">
              <Search size={12} className="text-slate-500 shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSegPage(0); }}
                placeholder="Search by track, type, key (8A), BPM, pool tag…"
                className="flex-1 bg-transparent outline-none text-[11px] font-mono text-slate-200 placeholder:text-slate-600"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300 shrink-0">
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
                {displayed.length} segments
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setSegPage(p => Math.max(0, p - 1))} disabled={segPage === 0}
                    className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800/60 rounded hover:bg-slate-700/60 disabled:opacity-30">‹</button>
                  <span className="text-[10px] font-mono text-slate-500">{segPage + 1}/{totalPages}</span>
                  <button onClick={() => setSegPage(p => Math.min(totalPages - 1, p + 1))} disabled={segPage >= totalPages - 1}
                    className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800/60 rounded hover:bg-slate-700/60 disabled:opacity-30">›</button>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {pageSegs.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-[10px] font-mono text-slate-600">
                  {segments.length === 0 ? 'No segments — process tracks first' : 'No matches for current filter'}
                </div>
              ) : (
                <div className="py-1">
                  {/* Column headers */}
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-2 px-3 pb-1 mb-1 border-b border-slate-800/40">
                    <span className="text-[8px] font-mono uppercase text-slate-600">Type</span>
                    <span className="text-[8px] font-mono uppercase text-slate-600">Track</span>
                    <span className="text-[8px] font-mono uppercase text-slate-600 w-8 text-center">Key</span>
                    <span className="text-[8px] font-mono uppercase text-slate-600 w-14 text-right">BPM</span>
                    <span className="text-[8px] font-mono uppercase text-slate-600 w-20 text-right">Duration</span>
                    <span className="text-[8px] font-mono uppercase text-slate-600 w-16 text-right">Energy</span>
                  </div>
                  {pageSegs.map((seg) => (
                    <SegmentRow key={seg.id} seg={seg} onClick={setSelectedSeg} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Auto-queued "usable sections" timeline preview */}
          {queue.length > 0 && (
            <div className="bg-black/40 border border-green-900/40 rounded-2xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListPlus size={12} className="text-green-400" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-green-400">
                    Auto-queued ({queue.length})
                  </span>
                </div>
                <span className="text-[9px] font-mono text-slate-500">
                  top quality × energy
                </span>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {queue.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSeg(s)}
                    className="shrink-0 flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg border transition-colors hover:bg-slate-800/60"
                    style={{
                      borderColor: typeColor(s.type) + '66',
                      background: typeColor(s.type) + '15',
                    }}
                    title={`${s.track_title} · ${s.type} · ${s.camelot_key || '—'}`}
                  >
                    <span className="text-[8px] font-black" style={{ color: typeColor(s.type) }}>
                      {s.type}
                    </span>
                    <span className="text-[8px] font-mono text-slate-400">
                      {s.camelot_key || '—'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Build Smart Mix */}
        <div className="flex flex-col gap-3 w-[45%] min-w-0">

          {/* Controls card */}
          <div className="bg-black/40 border border-slate-700/40 rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-300">
                Build Smart Mix
              </span>
            </div>

            {/* Duration */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Clock size={11} /> Target duration
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={5} max={120} step={5}
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(Number(e.target.value))}
                  className="flex-1 accent-blue-400"
                />
                <span className="text-[13px] font-black font-mono text-white w-16 text-right">
                  {targetMinutes} min
                </span>
              </div>
            </div>

            {/* Energy profile */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <BarChart2 size={11} /> Energy profile
              </label>
              <div className="grid grid-cols-1 gap-1">
                {ENERGY_PROFILES.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => setEnergyProfile(ep.id)}
                    className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                      energyProfile === ep.id
                        ? 'bg-blue-500/20 border-blue-400/50 text-blue-200'
                        : 'bg-slate-900/40 border-slate-700/40 text-slate-400 hover:border-slate-500/50 hover:text-slate-300'
                    }`}
                  >
                    <span className="text-[11px] font-black font-mono w-20 shrink-0">{ep.label}</span>
                    <span className="text-[10px] font-mono opacity-70">{ep.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filter summary */}
            {(selectedPool || filterType) && (
              <div className="flex flex-wrap gap-1.5 text-[9px] font-mono">
                <span className="text-slate-500">Filters:</span>
                {selectedPool && (
                  <span className="px-2 py-0.5 bg-blue-500/15 border border-blue-400/30 text-blue-300 rounded-lg">
                    pool: {selectedPool}
                  </span>
                )}
                {filterType && (
                  <span className="px-2 py-0.5 rounded-lg border" style={{ background: typeColor(filterType) + '20', borderColor: typeColor(filterType) + '60', color: typeColor(filterType) }}>
                    type: {filterType}
                  </span>
                )}
              </div>
            )}

            {/* Build button */}
            <button
              onClick={handleBuild}
              disabled={building || segments.length === 0}
              className="w-full py-3 rounded-2xl font-black text-sm uppercase tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-lg shadow-blue-900/30"
            >
              {building ? (
                <><Loader2 size={16} className="animate-spin" /> Rendering mix…</>
              ) : (
                <><Zap size={16} /> Build Smart Mix</>
              )}
            </button>
          </div>

          {/* Result card */}
          <AnimatePresence>
            {buildError && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-red-950/40 border border-red-500/40 rounded-2xl p-4 flex items-start gap-3"
              >
                <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-black text-red-300 mb-1">Build failed</div>
                  <div className="text-[10px] font-mono text-red-400">{buildError}</div>
                </div>
              </motion.div>
            )}

            {buildResult && !buildError && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span className="text-[11px] font-black text-emerald-300">Mix ready</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 uppercase text-[9px]">Duration</span>
                    <span className="text-white font-black">{fmtDur(buildResult.duration)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 uppercase text-[9px]">Segments</span>
                    <span className="text-white font-black">{buildResult.segments}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 uppercase text-[9px]">Profile</span>
                    <span className="text-emerald-300 font-black capitalize">{buildResult.energyProfile}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-500 uppercase text-[9px]">Mix ID</span>
                    <span className="text-slate-400 truncate">{buildResult.mixId?.slice(-12)}</span>
                  </div>
                </div>

                {/* Waveform progress bar */}
                <div
                  className="relative h-8 bg-slate-900/80 rounded-xl overflow-hidden cursor-pointer border border-slate-700/40"
                  onClick={(e) => {
                    const audio = audioRef.current;
                    if (!audio?.duration) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const frac = (e.clientX - rect.left) / rect.width;
                    audio.currentTime = frac * audio.duration;
                    setPlayProgress(frac);
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-emerald-500/20 transition-none"
                    style={{ width: `${playProgress * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono text-slate-500">
                    {playing ? fmtDur(audioRef.current?.currentTime) : 'Click to seek'}
                  </div>
                </div>

                {/* Play / Stop */}
                <div className="flex gap-2">
                  <button
                    onClick={handlePlayPause}
                    className="flex-1 py-2 rounded-xl font-black text-[11px] uppercase transition-all flex items-center justify-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                  >
                    {playing ? <><Square size={13} /> Stop</> : <><Play size={13} /> Play</>}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Detail modal */}
      <SegmentDetailModal
        seg={selectedSeg}
        onClose={() => setSelectedSeg(null)}
        onPreview={(s) => {
          if (!audioRef.current) return;
          audioRef.current.src = `${API}/dj-segments/${encodeURIComponent(s.id.replace(/_s\d+$/, ''))}/audio`;
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {
            addLog?.(`Preview unavailable for ${s.id}`, 'error');
          });
        }}
        onAddToTimeline={(s) => {
          if (!queue.find((q) => q.id === s.id)) setQueue((q) => [...q, s]);
          setSelectedSeg(null);
          addLog?.(`➕ Queued ${s.type} · ${s.track_title}`, 'info');
        }}
      />
    </div>
  );
}
