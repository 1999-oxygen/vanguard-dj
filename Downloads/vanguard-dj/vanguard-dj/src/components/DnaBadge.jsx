import React from 'react';
import { motion } from 'framer-motion';
import { Dna, Zap, Activity, Music } from 'lucide-react';

/**
 * Cyberpunk-styled badge showing Track DNA summary from VanguardAnalyzer.
 */
const DnaBadge = ({ dna, source = 'librosa-backend' }) => {
  if (!dna) return null;

  const isBackend = source === 'librosa-backend';
  const atomCount = dna.totalAtoms || dna.atoms?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-retro rounded-2xl p-4 border border-neon/purple-500/20"
    >
      <div className="flex items-center gap-2 mb-3">
        <Dna size={16} className={`${isBackend ? 'text-neon/purple-400' : 'text-neon/cyan-400'} neon-glow`} />
        <span className="text-[11px] font-retro font-black uppercase tracking-widest text-neon/cyan-400">
          Track DNA
        </span>
        <span
          className={`ml-auto text-[9px] font-mono px-2 py-0.5 rounded-full ${
            isBackend
              ? 'bg-neon/purple-500/20 text-neon/purple-300'
              : 'bg-neon/cyan-500/20 text-neon/cyan-300'
          }`}
        >
          {isBackend ? 'Neural Core' : 'Client'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-neon/pink-400 mb-1">
            <Zap size={12} />
            <span className="text-[10px] font-retro uppercase">BPM</span>
          </div>
          <span className="text-lg font-retro font-black text-slate-200">{dna.bpm}</span>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-neon/cyan-400 mb-1">
            <Music size={12} />
            <span className="text-[10px] font-retro uppercase">Key</span>
          </div>
          <span className="text-lg font-retro font-black text-slate-200">{dna.key}</span>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-neon/purple-400 mb-1">
            <Activity size={12} />
            <span className="text-[10px] font-retro uppercase">Atoms</span>
          </div>
          <span className="text-lg font-retro font-black text-slate-200">{atomCount}</span>
        </div>
      </div>

      {dna.atoms && dna.atoms.length > 0 && (
        <div className="mt-3 pt-3 border-t border-neon/retro/scanline">
          <div className="flex items-center gap-1 mb-2">
            <Activity size={10} className="text-neon/purple-400" />
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">Energy Map</span>
          </div>
          <div className="flex items-end gap-px h-8">
            {dna.atoms.slice(0, 32).map((atom, i) => (
              <motion.div
                key={atom.atom_id || i}
                initial={{ height: 0 }}
                animate={{ height: `${(atom.energy_level || 0) * 10}%` }}
                transition={{ delay: i * 0.02 }}
                className="flex-1 bg-neon/purple-500/40 hover:bg-neon/pink-500/60 rounded-sm min-w-[2px]"
                title={`Atom ${i}: ${atom.energy_level} energy`}
              />
            ))}
            {dna.atoms.length > 32 && (
              <span className="text-[8px] text-slate-500 self-center ml-1">+{dna.atoms.length - 32}</span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default DnaBadge;

