import React from 'react';
import { motion } from 'framer-motion';

const BpmDial = ({ bpm, isLive }) => {
  const normalizedBpm = ((bpm - 100) / 60) * 360; // 100-160 BPM → 0-360°

  return (
    <motion.div 
      className="relative w-32 h-32 flex items-center justify-center"
      animate={{ rotate: isLive ? [0, 5, -5, 0] : 0 }}
      transition={{ duration: isLive ? 2 : 0, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Outer ring */}
      <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90 absolute inset-0">
        <defs>
          <linearGradient id="bpmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="neon/purple/400" />
            <stop offset="50%" stopColor="neon/pink/500" />
            <stop offset="100%" stopColor="neon/cyan/400" />
          </linearGradient>
        </defs>
        
        {/* Track */}
        <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(0 0% 100% / 0.1)" strokeWidth="8" className="retro-chrome" />
        
        {/* BPM arc */}
        <motion.circle
          cx="60" cy="60" r="52"
          fill="none"
          stroke="url(#bpmGrad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="327"
          strokeDashoffset={327 - (normalizedBpm / 360 * 327)}
          pathLength={1}
          animate={{ strokeDashoffset: 327 - (normalizedBpm / 360 * 327) }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        
        {/* Tick marks */}
        {Array.from({ length: 13 }, (_, i) => {
          const angle = (i / 12) * 360;
          const x1 = 60 + 48 * Math.cos((angle * Math.PI) / 180);
          const y1 = 60 + 48 * Math.sin((angle * Math.PI) / 180);
          const x2 = 60 + 44 * Math.cos((angle * Math.PI) / 180);
          const y2 = 60 + 44 * Math.sin((angle * Math.PI) / 180);
          const isMajor = i % 3 === 0;
          
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="neon/retro/chrome"
              strokeWidth={isMajor ? 3 : 1.5}
              strokeLinecap="round"
            />
          );
        })}
        
        {/* BPM labels */}
        {[120, 130, 140].map((tick, i) => {
          const angle = ((tick - 100) / 60) * 360 * (Math.PI / 180);
          const x = 60 + 35 * Math.cos(angle);
          const y = 60 + 35 * Math.sin(angle);
          
          return (
            <text
              key={tick}
              x={x} y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="neon/cyan-400"
              fontFamily="font-retro"
              fontSize="9"
              fontWeight="bold"
              className="neon-glow drop-shadow-lg"
            >
              {tick}
            </text>
          );
        })}
      </svg>
      
      {/* Center display */}
      <div className="absolute text-center font-retro font-black text-3xl leading-none bg-glass-retro rounded-2xl px-4 py-2 shadow-2xl neon-glow crt-screen">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={`text-neon/pink-400 ${isLive ? 'pulse-retro' : ''}`}
        >
          {bpm.toFixed(1)}
        </motion.div>
        <div className="text-[8px] uppercase tracking-[0.3em] text-neon/cyan-400 opacity-80 mt-0.5">
          BPM
        </div>
      </div>
      
      {/* Status ring */}
      <motion.div
        className="absolute inset-0 rounded-full border-4 border-transparent bg-neon/purple-500/20"
        animate={{ 
          borderColor: isLive ? '#ec4899' : 'transparent',
          scale: isLive ? [1, 1.15, 1] : 1
        }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    </motion.div>
  );
};

export default BpmDial;

