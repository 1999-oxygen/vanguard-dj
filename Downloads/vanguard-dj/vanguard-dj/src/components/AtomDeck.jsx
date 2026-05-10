import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Sparkles, Zap, Activity } from 'lucide-react';
import { useAtomPlayer } from '../hooks/useAtomPlayer.js';

/**
 * AtomDeck — Atom Matrix Trigger UI
 * Inspired by the user's inspo, adapted for Vanguard cyberpunk theme.
 *
 * Displays DNA atoms as triggerable pads with energy visualization.
 * Uses Ghost-Tail Anti-Click Envelopes via useAtomPlayer.
 */
const AtomDeck = ({ dna, audioBuffer, trackName }) => {
  const [activeAtomId, setActiveAtomId] = useState(null);
  const { isReady, playAtom } = useAtomPlayer(audioBuffer);

  // Reset active atom after its duration elapses
  useEffect(() => {
    if (!activeAtomId || !dna?.atoms) return;
    const atom = dna.atoms.find((a) => a.atom_id === activeAtomId);
    if (!atom) return;
    const durationMs = (atom.end_sec - atom.start_sec) * 1000;
    const timer = setTimeout(() => setActiveAtomId(null), durationMs);
    return () => clearTimeout(timer);
  }, [activeAtomId, dna]);

  const handleTriggerAtom = (atom) => {
    if (!isReady) return;
    setActiveAtomId(atom.atom_id);
    // Fire Ghost-Tail playback with slightly longer fades for punch
    playAtom(atom.start_sec, atom.end_sec, {
      fadeIn: 0.01,
      fadeOut: 0.01,
      gain: 0.9,
    });
  };

  if (!dna || !dna.atoms || dna.atoms.length === 0) {
    return (
      <div className="glass-retro rounded-3xl p-6 border border-neon/purple-500/10">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
          <Activity size={14} />
          No atom data available. Upload and analyze a track.
        </div>
      </div>
    );
  }

  const displayName = trackName || dna.track_name || 'Unknown Track';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-retro rounded-3xl p-6 border border-neon/purple-500/10 neon-glow"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-neon/cyan-400 font-retro font-black uppercase tracking-widest text-sm">
            {displayName}
          </h3>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-neon/pink-400 font-mono text-xs">
              {dna.bpm?.toFixed?.(1) || dna.bpm} BPM
            </p>
            <span className="text-slate-600">|</span>
            <p className="text-neon/purple-300 font-mono text-xs">
              Key: {dna.key}
            </p>
            <span className="text-slate-600">|</span>
            <p className="text-slate-400 font-mono text-xs">
              {dna.total_atoms || dna.atoms.length} Atoms
            </p>
          </div>
        </div>
        <div className="text-[10px] font-retro font-black uppercase tracking-widest flex items-center gap-2">
          {isReady ? (
            <span className="text-neon/emerald-400 flex items-center gap-1">
              <Zap size={12} className="fill-current" /> Engine Ready
            </span>
          ) : (
            <span className="text-slate-500 flex items-center gap-1 animate-pulse">
              <Activity size={12} /> Loading RAM...
            </span>
          )}
        </div>
      </div>

      {/* Atom Matrix Trigger Label */}
      <div className="text-[10px] font-retro font-black text-neon/purple-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
        <Sparkles size={12} className="neon-glow" /> Atom Matrix Trigger
      </div>

      {/* Atom Grid */}
      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide pr-1">
        {dna.atoms.map((atom, index) => {
          const isActive = activeAtomId === atom.atom_id;
          const energy = atom.energy_level || 0;
          const isHighEnergy = energy > 8;

          return (
            <motion.button
              key={atom.atom_id}
              disabled={!isReady}
              onClick={() => handleTriggerAtom(atom)}
              whileHover={isReady ? { scale: 1.02 } : {}}
              whileTap={isReady ? { scale: 0.98 } : {}}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all duration-150 ${
                isActive
                  ? 'bg-neon/purple-500/30 border-neon/purple-400/50 text-neon/cyan-300 shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                  : isHighEnergy
                    ? 'bg-slate-950/50 border-neon/pink-500/20 text-slate-300 hover:bg-neon/pink-500/10 hover:border-neon/pink-400/30'
                    : 'bg-slate-950/50 border-white/5 text-slate-400 hover:bg-neon/purple-500/10 hover:border-neon/purple-400/20'
              } ${!isReady ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-3">
                <Play
                  size={14}
                  className={isActive ? 'text-neon/pink-400 fill-current' : 'text-slate-500'}
                />
                <span className="font-mono text-xs uppercase tracking-wide">
                  {atom.atom_id}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {atom.start_sec.toFixed(2)}s — {atom.end_sec.toFixed(2)}s
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-retro uppercase tracking-widest text-slate-500">
                  Energy
                </span>
                {/* Energy Visualizer Bar */}
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(energy * 10, 100)}%` }}
                    transition={{ duration: 0.5, delay: index * 0.03 }}
                    className={`h-full rounded-full ${
                      isHighEnergy
                        ? 'bg-gradient-to-r from-neon/pink-500 to-neon/red-500'
                        : 'bg-gradient-to-r from-neon/cyan-500 to-neon/blue-500'
                    }`}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-500 w-6 text-right">
                  {energy.toFixed(1)}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default React.memo(AtomDeck);

