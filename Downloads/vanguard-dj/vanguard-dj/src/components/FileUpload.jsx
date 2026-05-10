import React from 'react';
import { Upload, Music, X } from 'lucide-react';
import { motion } from 'framer-motion';

const FileUpload = ({ onAddTracks, className = '' }) => {
  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
    files.forEach(file => onAddTracks(file));
  };

  const handleChange = (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('audio/'));
    files.forEach(file => onAddTracks(file));
    e.target.value = ''; // Reset for same file
  };

  return (
    <motion.div
      className={`glass-retro border-2 border-dashed border-neon/purple-500/30 rounded-3xl p-8 text-center hover:border-neon/cyan-400/50 transition-all cursor-pointer neon-glow ${className}`}
      whileHover={{ scale: 1.02, borderColor: '#a78bfa' }}
      drag
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onDragEnter={(e) => e.currentTarget.style.borderColor = '#a78bfa'}
      onDragLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
    >
      <div className="space-y-4">
        <Upload size={48} className="mx-auto text-neon/purple-400 neon-glow" />
        <div>
          <h3 className="font-retro text-xl font-black text-neon/purple-300 uppercase tracking-wide mb-1">
            Drag & Drop Audio Files
          </h3>
          <p className="text-sm text-slate-400 font-mono">MP3, WAV, OGG (Multi-select OK)</p>
        </div>
        <label className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-neon/purple-600/50 to-neon/cyan-600/50 text-white font-retro font-black rounded-xl hover:from-neon/purple-500 cursor-pointer transition-all shadow-lg shadow-neon/purple-500/30">
          <Music size={16} />
          Choose Files
          <input 
            type="file" 
            multiple 
            accept="audio/*"
            onChange={handleChange}
            className="hidden"
          />
        </label>
      </div>
    </motion.div>
  );
};

export default FileUpload;
