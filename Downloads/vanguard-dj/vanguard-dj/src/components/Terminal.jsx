import React, { useState } from 'react';
import { Terminal as TerminalIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Terminal = ({ logs, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <motion.div 
      className={`w-full h-32 md:h-36 ${className} glass-retro scanlines crt-screen rounded-2xl p-4 font-mono text-[10px] border border-neon/purple-500/20 overflow-hidden relative`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* CRT top bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neon/purple-500 to-neon/pink-500 shadow-glow" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-neon/retro/scanline">
        <div className="flex items-center gap-2 text-neon/cyan-400 font-retro font-black tracking-widest text-xs uppercase neon-glow">
          <TerminalIcon size={12} />
          VANGUARD CORE v3.0.1
        </div>
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded-full glass-retro hover:bg-neon/purple-500/20 transition-all"
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.1 }}
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </motion.button>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={isExpanded ? 'content' : 'collapsed'}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-hidden"
          style={{ maxHeight: isExpanded ? '200px' : 0 }}
        >
          <div className="space-y-1.5 pr-2 max-h-24 overflow-y-auto custom-scrollbar-thin">
            {logs.slice(-12).map((log) => (
              <motion.p
                key={log.id}
                className={`whitespace-pre-wrap pr-1 leading-relaxed transition-colors ${
                  log.type === 'ai' 
                    ? 'text-neon/purple-400 pl-4 ml-1 border-l-2 border-neon/purple-400 bg-neon/purple-500/5 shadow-inner' 
                    : log.type === 'error' 
                    ? 'text-neon/pink-400 pl-4 ml-1 border-l-2 border-neon/pink-400 bg-neon/pink-500/5 shadow-inner' 
                    : 'text-slate-400'
                }`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
              >
                ▸ {log.text}
              </motion.p>
            ))}
          </div>
          
          {!isExpanded && (
            <motion.p 
              className="text-slate-500 italic text-[9px] mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {logs.length} logs • tap to expand
            </motion.p>
          )}
        </motion.div>
      </AnimatePresence>
      
      {/* Bottom status bar */}
      <div className="absolute bottom-2 right-2 left-2 flex items-center justify-between text-[9px] text-slate-500 font-mono tracking-widest">
        <span>REALTIME</span>
        <span className="text-neon/cyan-400 font-retro">ACTIVE</span>
      </div>
      
      {/* Custom thin scrollbar */}
      <style jsx>{`
        .custom-scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar-thin::-webkit-scrollbar-thumb {
          background: neon/cyan/400;
          border-radius: 2px;
        }
      `}</style>
    </motion.div>
  );
};

export default Terminal;

