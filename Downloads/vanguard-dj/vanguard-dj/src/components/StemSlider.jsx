import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

const StemSlider = ({ label, value, onChange, color = 'purple', bpm }) => {
  const normalizedValue = value / 100;

  useEffect(() => {
    // BPM pulse effect
    if (bpm > 130) {
      // Exaggerate on high BPM
    }
  }, [bpm]);

  return (
    <motion.div 
      className="flex flex-col items-center gap-1 w-full flex-1 relative"
      whileHover={{ y: -4 }}
    >
      <span className="text-[9px] font-retro font-black uppercase tracking-[0.3em] neon-glow text-neon/cyan-400">
        {label}
      </span>
      
      {/* Circular knob */}
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
          <defs>
            <linearGradient id={`stemGrad-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={`var(--color-${color})`} />
              <stop offset="100%" stopColor={`var(--color-${color}-600)`} />
            </linearGradient>
          </defs>
          
          {/* Track */}
          <circle 
            cx="32" cy="32" r="28" 
            fill="none" 
            stroke="hsl(0 0% 100% / 0.1)"
            strokeWidth="6"
            className="retro-chrome"
          />
          
          {/* Fill */}
          <motion.circle
            cx="32" cy="32" r="28"
            fill="none"
            stroke={`url(#stemGrad-${label})`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="176"
            strokeDashoffset={176 * (1 - normalizedValue)}
            animate={{ strokeDashoffset: 176 * (1 - normalizedValue) }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ 
              '--color-purple': '#a78bfa',
              '--color-pink': '#ec4899', 
              '--color-cyan': '#06b6d4'
            }}
          />
          
          {/* Center knob */}
          <motion.circle
            cx="32" cy="32" r="12"
            className="retro-chrome shadow-[0_0_15px_var(--color-purple)]"
            animate={{ 
              rotate: normalizedValue * 360,
              scale: normalizedValue > 0.7 ? 1.1 : 1
            }}
            transition={{ duration: 0.4 }}
          >
            <animateTransform attributeName="transform" type="rotate" values="0;360" dur="20s" repeatCount="indefinite" />
          </motion.circle>
        </svg>
        
        {/* Value text */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center text-lg font-retro font-black drop-shadow-2xl"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ color: `var(--color-${color})` }}
        >
          {value}%
        </motion.div>
      </div>
    </motion.div>
  );
};

export default StemSlider;

