import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Search, Mic, Activity, Disc, ArrowRightLeft, Zap, Wind, Waves } from 'lucide-react';

/**
 * QuantumCrate
 * Visual Atom Database — categorizes segments by Audio Utility, not artist/song.
 *
 * FEATURES:
 * - Deep Utility Filtering: WPS, Energy, Stem type, Semantic tags
 * - Instant Swappability: Click SWAP → recalculates time_stretch_ratio for master BPM lock
 * - Visual DNA Profiles: Color-coded stem isolation (Purple=Vocals, Blue=Bass, Green=Drums)
 * - Semantic Tagging: "Aggressive/Staccato", "Ethereal/Legato", etc.
 */

const CATEGORY_FILTERS = ['ALL', 'VOCALS', 'BASS', 'DRUMS', 'MASTER'];

const STEM_META = {
  vocals: {
    icon: Mic,
    label: 'VOCALS',
    color: 'purple',
    bg: 'bg-purple-500/5',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/20',
    gradient: 'from-purple-500/20 to-purple-600/10',
  },
  bass: {
    icon: Activity,
    label: 'BASS',
    color: 'blue',
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/20',
    gradient: 'from-blue-500/20 to-blue-600/10',
  },
  drums: {
    icon: Zap,
    label: 'DRUMS',
    color: 'emerald',
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
    gradient: 'from-emerald-500/20 to-emerald-600/10',
  },
  master: {
    icon: Disc,
    label: 'MASTER',
    color: 'cyan',
    bg: 'bg-cyan-500/5',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    glow: 'shadow-cyan-500/20',
    gradient: 'from-cyan-500/20 to-cyan-600/10',
  },
};

const QuantumCrate = ({ atoms, masterBpm, onSwap, className }) => {
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredAtom, setHoveredAtom] = useState(null);

  const filteredAtoms = useMemo(() => {
    if (!atoms || atoms.length === 0) return [];
    return atoms.filter((atom) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        atom.id?.toLowerCase().includes(q) ||
        atom.source?.toLowerCase().includes(q) ||
        atom.tags?.join(' ').toLowerCase().includes(q) ||
        atom.type?.toLowerCase().includes(q);
      const matchesCategory =
        categoryFilter === 'ALL' || atom.type?.toUpperCase() === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [atoms, categoryFilter, searchQuery]);

  const handleSwap = (atom) => {
    if (!onSwap) return;
    // Recalculate elastic normalization: time_stretch_ratio = masterBPM / atomBPM
    const stretchRatio = masterBpm > 0 && atom.bpm > 0 ? masterBpm / atom.bpm : 1.0;
    onSwap(atom, stretchRatio);
  };

  return (
    <div className={`flex flex-col h-full glass-retro rounded-3xl overflow-hidden ${className || ''}`}>
      {/* Header */}
      <div className="p-5 border-b border-neon/retro/scanline bg-slate-950/40">
        <h2 className="font-retro text-xs font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4">
          <Database size={16} className="text-neon/emerald-400" />
          Quantum Crate
        </h2>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            type="text"
            placeholder="Search atoms, tags, metrics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/50 border border-neon/cyan-500/20 rounded-xl py-2 pl-9 pr-4 text-[11px] font-mono text-neon/cyan-300 focus:outline-none focus:border-neon/emerald-400 transition-all"
          />
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full border text-[10px] font-retro font-black uppercase tracking-widest transition-all ${
                categoryFilter === cat
                  ? 'bg-neon/emerald-500/20 border-neon/emerald-500/50 text-neon/emerald-400'
                  : 'bg-slate-900/40 border-neon/retro/scanline text-slate-500 hover:text-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Atom List */}
      <div className="flex-grow overflow-y-auto p-3 space-y-3 custom-scrollbar">
        <AnimatePresence>
          {filteredAtoms.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Waves size={32} className="mx-auto text-slate-600 mb-3" />
              <p className="text-xs text-slate-500 font-mono">No atoms match your filters</p>
              <p className="text-[10px] text-slate-600 font-mono mt-1">Upload tracks to populate the crate</p>
            </motion.div>
          )}

          {filteredAtoms.map((atom) => {
            const meta = STEM_META[atom.type] || STEM_META.master;
            const Icon = meta.icon;

            return (
              <motion.div
                key={atom.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onMouseEnter={() => setHoveredAtom(atom.id)}
                onMouseLeave={() => setHoveredAtom(null)}
                className={`p-4 rounded-2xl border ${meta.border} ${meta.bg} hover:brightness-125 transition-all group relative overflow-hidden`}
              >
                {/* Top row: ID + Swap button */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={meta.text} />
                    <span className={`text-xs font-black uppercase ${meta.text}`}>{atom.id}</span>
                  </div>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{
                      opacity: hoveredAtom === atom.id ? 1 : 0,
                      scale: hoveredAtom === atom.id ? 1 : 0.8,
                    }}
                    onClick={() => handleSwap(atom)}
                    className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-[9px] font-black uppercase transition-all text-white"
                  >
                    <ArrowRightLeft size={10} /> Swap
                  </motion.button>
                </div>

                {/* Source */}
                <p className="text-[9px] font-mono text-slate-400 mb-3 truncate">{atom.source}</p>

                {/* Metrics grid */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase text-slate-500 font-black tracking-wider">Length</span>
                    <span className="text-[10px] font-mono font-bold text-slate-200">{atom.duration_sec?.toFixed(1)}s</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase text-slate-500 font-black tracking-wider">BPM</span>
                    <span className="text-[10px] font-mono font-bold text-slate-200">{atom.bpm?.toFixed(1)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase text-slate-500 font-black tracking-wider">Energy</span>
                    <span className="text-[10px] font-mono font-bold text-slate-200">{atom.energy?.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase text-slate-500 font-black tracking-wider">WPS</span>
                    <span className="text-[10px] font-mono font-bold text-slate-200">{atom.wps?.toFixed(1)}</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex gap-1.5 flex-wrap">
                  {atom.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="text-[8px] font-black bg-black/40 px-1.5 py-0.5 rounded uppercase text-slate-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Micro-waveform */}
                <div className="absolute bottom-0 left-0 right-0 h-4 flex items-end justify-between opacity-20 pointer-events-none px-2">
                  {Array.from({ length: 30 }, (_, i) => (
                    <div
                      key={i}
                      className={`w-0.5 rounded-t-full ${meta.text.replace('text-', 'bg-')}`}
                      style={{ height: `${20 + Math.random() * 80}%` }}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Stats footer */}
      <div className="p-3 border-t border-neon/retro/scanline bg-slate-950/40">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>{filteredAtoms.length} atoms</span>
          <span>Master: {masterBpm} BPM</span>
        </div>
      </div>
    </div>
  );
};

export default QuantumCrate;

