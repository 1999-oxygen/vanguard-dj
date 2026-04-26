import React from 'react';
import { Play, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const TrackCard = ({ track, isActive, onSelect, search }) => {
  const matchIndex = track.name.toLowerCase().indexOf(search.toLowerCase());

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, zIndex: 10 }}
      className={`group relative p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer overflow-hidden glass-retro neon-glow ${
        isActive 
          ? 'border-neon/pink-500 bg-gradient-to-r from-neon/pink-500/10 shadow-neon-glow-lg shadow-neon/pink-500/50 pulse-retro-border' 
          : 'border-transparent hover:border-neon/cyan-400/50 hover:bg-neon/cyan-500/5'
      }`}
      onClick={() => onSelect(track)}
    >
      {/* Retro scanline overlay */}
      <div className="absolute inset-0 opacity-20 scanlines pointer-events-none" />
      
      {/* Play indicator */}
      {isActive && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 w-12 h-12 bg-neon/pink-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-neon/pink-600/50 border-4 border-neon/pink-400/50"
        >
          <Play size={16} className="text-white drop-shadow-lg" />
        </motion.div>
      )}
      
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-retro text-lg font-black text-neon/purple-400 group-hover:text-neon/pink-400 truncate">
            {matchIndex > -1 
              ? (
                <>
                  {track.name.slice(0, matchIndex)}
                  <mark className="bg-neon/cyan-400/30 text-neon/cyan-400 px-1 rounded font-bold">
                    {track.name.slice(matchIndex, matchIndex + search.length)}
                  </mark>
                  {track.name.slice(matchIndex + search.length)}
                </>
              ) 
              : track.name
            }
          </h3>
          <span className="ml-2 px-2 py-0.5 bg-neon/retro/chrome/50 text-neon/purple-600 text-xs font-mono font-black rounded-full shadow-inner">
            {track.key}
          </span>
        </div>
        
        <p className="text-xs text-slate-400 font-mono tracking-wider mb-1">{track.artist}</p>
        
        <div className="flex items-center justify-between text-xs font-retro tracking-[0.2em] uppercase">
          <span className="opacity-75">{track.mood}</span>
          <span className="text-neon/cyan-400 font-black bg-neon/cyan-500/10 px-2 py-0.5 rounded-full shadow-neon-glow-sm">
            {track.bpm} BPM
          </span>
        </div>
      </div>
      
      {/* Hover zap effect */}
      <Zap className="absolute -bottom-2 -right-2 w-6 h-6 text-neon/pink-400 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0" />
    </motion.div>
  );
};

export default TrackCard;

