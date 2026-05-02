import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square } from 'lucide-react';

const DeckPlayButton = ({ isLive, onToggle }) => {
  return (
    <motion.button
      onClick={onToggle}
      className={`group relative w-full py-8 px-6 rounded-3xl flex items-center justify-center gap-4 font-retro font-black text-xl uppercase tracking-[0.3em] transition-all duration-300 overflow-hidden shadow-2xl active:scale-[0.97] ${
        isLive
          ? 'bg-gradient-to-r from-neon/pink-600/30 via-neon/pink-500/20 to-neon/purple-600/30 text-neon/pink-300 border-4 border-neon/pink-500/40 hover:from-neon/pink-500/40 shadow-neon/pink-500/60 pulse-retro'
          : 'bg-gradient-to-br from-neon/cyan-500/20 via-neon/purple-500/20 to-neon/pink-500/20 text-white border-4 border-transparent hover:border-neon/cyan-400/50 shadow-neon/cyan-400/40 hover:shadow-neon-glow-lg'
      } glass-retro`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Glow rings */}
      <motion.div 
        className="absolute inset-0 rounded-3xl bg-gradient-to-r from-neon/pink-500/30 to-neon/cyan-500/30 blur-xl opacity-0 group-hover:opacity-100"
        animate={{ scale: isLive ? [1, 1.3, 1] : 1 }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      
      {/* Icon */}
      <AnimatePresence mode="wait">
        {isLive ? (
          <motion.div
            key="stop"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
          >
            <Square size={28} strokeWidth={4} className="drop-shadow-2xl" />
          </motion.div>
        ) : (
          <motion.div
            key="play"
            initial={{ scale: 0.8, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.8, rotate: 180 }}
          >
            <Play size={28} fill="currentColor" strokeWidth={0} className="drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>
      
      <span>{isLive ? 'TERMINATE' : 'LAUNCH'}</span>
      <span className="text-[12px] tracking-normal opacity-80">VANGUARD</span>
      
      {/* Live particles stub (confetti effect) */}
      {isLive && (
        <motion.div
          className="absolute top-2 right-2 w-4 h-4 bg-neon/pink-400 rounded-full shadow-neon-glow animate-ping"
          animate={{ 
            x: [0, 10, 0],
            y: [0, -5, 0],
            opacity: [1, 0.5, 1]
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
};

export default DeckPlayButton;

