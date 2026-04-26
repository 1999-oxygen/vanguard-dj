import os

content = r"""import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Sparkles, RefreshCcw, Search, Cpu, Menu, Activity, Sliders, Layers, GitBranch, Shuffle } from 'lucide-react';
import TrackCard from './components/TrackCard.jsx';
import Waveform from './components/Waveform.jsx';
import StemSlider from './components/StemSlider.jsx';
import Terminal from './components/Terminal.jsx';
import BpmDial from './components/BpmDial.jsx';
import DeckPlayButton from './components/DeckPlayButton.jsx';
import SegmentVisualizer from './components/SegmentVisualizer.jsx';
import { useVanguard } from './hooks/useVanguard.js';
import { useAudioEngine } from './hooks/useAudioEngine.js';
import usePlaylist from './hooks/usePlaylist.js';
import useAutoMix from './hooks/useAutoMix.js';
import { useSegmentEngine } from './hooks/useSegmentEngine.js';
import SpotifySearch from './components/SpotifySearch.jsx';
import FileUpload from './components/FileUpload.jsx';
import { AudioContextManager } from './audio/index.js';

const INITIAL_LIBRARY = [
  { id: 1, name: "Subterranean Vibe", artist: "Deep Technic", key: "1A", bpm: 124, mood: "Dark / Industrial" },
  { id: 2, name: "Neon Horizon", artist: "Synthwave Pro", key: "3A", bpm: 126, mood: "Energetic / Bright" },
  { id: 3, name: "Deep Techno 04", artist: "Unknown", key: "12B", bpm: 122, mood: "Minimal / Cold" },
  { id: 4, name: "Granular Echoes", artist: "Resonance", key: "1B", bpm: 124, mood: "Ambient / Deep" },
  { id: 5, name: "Cyber Pulse Drive", artist: "Retro Synth", key: "8A", bpm: 128, mood: "Futuristic / Drive" },
  { id: 6, name: "Vaporwave Drift", artist: "Digital Ghosts", key: "5A", bpm: 118, mood: "Chill / Nostalgic" },
];

const defaultTrack = INITIAL_LIBRARY[0];

export default function App() {
  const [appMode, setAppMode] = useState('deck');
  const [search, setSearch] = useState('');
  const [stems, setStems] = useState({ D: 85, B: 70, V: 50, M: 65 });
  const [currentTrack, setCurrentTrack] = useState(defaultTrack);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDjMode, setIsDjMode] = useState(false);
  const [crossfaderPos, setCrossfaderPos] = useState(0);
  const [compatibleSegs, setCompatibleSegs] = useState([]);

  const v = useVanguard(INITIAL_LIBRARY);
  const ae = useAudioEngine(v.addLog);
  const pl = usePlaylist();
  const se = useSegmentEngine(ae, v.addLog);

  const engineAPI = useMemo(() => ({
    playPause: ae.playPause,
    setCrossfader: ae.setCrossfader,
    setDeckBPM: ae.setDeckBPM,
    switchActiveDeck: ae.switchActiveDeck,
    getDeckState: ae.getDeckState,
  }), [ae]);

  const am = useAutoMix(pl.tracks, engineAPI, v.addLog);
  const stats = useMemo(() => se.getStats(), [se]);
  const filteredLibrary = useMemo(() => pl.searchTracks(search), [search, pl]);

  const handleTrackSelect = (track) => { setCurrentTrack(track); setIsDrawerOpen(false); };
  const handleStemChange = useCallback((key, val) => { setStems(p => ({ ...p, [key]: val })); ae.setStemLevel(key, val); }, [ae]);

  const handleFileUpload = useCallback(async (file) => {
    const ctx = AudioContextManager.getInstance();
    const ac = ctx.getContext() || ctx.init();
    try {
      const ab = await file.arrayBuffer();
      const buf = await ac.decodeAudioData(ab);
      await se.processTrack(buf, { id: Date.now() + Math.random(), name: file.name, bpm: 128 });
      pl.addTrack(file, false);
    } catch (e) { v.addLog(`Upload failed: ${e.message}`, 'error'); }
  }, [se, pl, v]);

  const handleGenerateMix = useCallback(async (style) => {
    const mix = await se.generateMixPlan({ style, targetDuration: 300, name: `${style} Mix` });
    if (mix) await se.playMix(mix);
  }, [se]);

  const handleSegmentClick = useCallback((seg) => {
    setCompatibleSegs(se.findCompatibleSegments(seg.id, 6));
    v.addLog(`Selected: ${seg.trackName} (${seg.id.slice(-8)})`, 'system');
  }, [se, v]);

  useEffect(() => {
    let i;
    if (v.isLive && appMode === 'deck') {
      i = setInterval(() => v.setBpm(p => Math.max(110, Math.min(150, p + (Math.random() - 0.5) * (isDjMode ? 1 : 0.5)))), isDjMode ? 300 : 500);
    }
    return () => clearInterval(i);
  }, [v.isLive, isDjMode, v.setBpm, appMode]);

  const modeBtns = [
    { k: 'deck', l: 'DECK', i: Sliders },
    { k: 'segment', l: 'SEGMENTS', i: Layers },
    { k: 'fusion', l: 'FUSION', i: GitBranch },
  ];

  return (
    <motion.div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="fixed inset-0 pointer-events-none opacity-10 scanlines" />
      <header className="h-12 glass-retro border-b border-neon/retro/scanline flex items-center justify-between px-4 md:px-6 z-50 shadow-neon-glow">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2 glass-retro rounded-xl hover:bg-neon/purple-500/10" onClick={() => setIsDrawerOpen(true)}><Menu size={18} className="neon-glow" /></button>
          <div className="flex items-center gap-2">
            <motion.div className="w-8 h-8 bg-gradient-to-br from-neon/purple-500 to-neon/pink-500 rounded-lg flex items-center justify-center shadow-2xl shadow-neon/purple-500/50 pulse-retro" whileHover={{ scale: 1.1 }}>
              <Zap size={16} className="text-white drop-shadow-lg fill-current" />
            </motion.div>
            <h1 className="font-retro text-sm font-black tracking-widest text-neon/cyan-400 uppercase">Vanguard <span className="text-neon/pink-400 neon-glow">Elite v3.1</span></h1>
          </div>
          <div className="hidden md:flex items-center gap-4 text-[10px] font-retro uppercase tracking-[0.2em] text-neon/cyan-400">
            <span className="flex items-center gap-1"><Cpu size={12} className="neon-glow" /> Neural Live</span>
            <span className="flex items-center gap-1 text-neon/pink-400"><Activity size={12} /> {v.isLive ? 'LIVE' : 'STANDBY'}</span>
          </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1 glass-retro rounded-full p-0.5">
            {modeBtns.map(m => (
              <button key={m.k} onClick={() => setAppMode(m.k)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-retro font-black uppercase tracking-widest transition-all ${appMode === m.k ? 'bg-neon/purple-500/30 text-neon/cyan-400' : 'text-slate-500 hover:text-slate-300'}`}>
                <m.i size={12} /> {m.l}
              </button>
            ))}
          </div>
          <motion.button onClick={() => setIsDjMode(!isDjMode)} className={`hidden lg:block px-3 py-1.5 rounded-full text-[10px] font-retro font-black uppercase tracking-widest transition-all glass-retro ${isDjMode ? 'bg-neon/pink-500/20 text-neon/pink-300 border border-neon/pink-400/30 neon-glow' : 'text-slate-400 hover:text-neon/purple-400'}`} whileHover={{ scale: 1.05 }}>DJ MODE</motion.button>
          <motion.button onClick={() => v.runAnalysis(currentTrack, pl.tracks)} disabled={v.isAnalyzing} className="flex items-center gap-2 bg-gradient-to-r from-neon/purple-500/20 to-neon/cyan-500/20 hover:from-neon/purple-500/30 text-neon/purple-300 px-4 py-1.5 rounded-xl font-retro font-black text-[10px] tracking-widest transition-all shadow-neon-glow glass-retro border border-neon/purple-500/30 disabled:opacity-50" whileHover={{ scale: 1.05 }}>
            {v.isAnalyzing ? <RefreshCcw size={14} className="animate-spin neon-glow" /> : <Sparkles size={14} className="neon-glow fill-current" />} AI SYNC
          </motion.button>
        </div>
      </header>

      <AnimatePresence>{isDrawerOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsDrawerOpen(false)} />}</AnimatePresence>

      <main className="flex-grow p-4 md:p-6 gap-6 overflow-hidden relative flex flex-col md:flex-row">
        <aside className={`w-full md:w-80 flex-shrink-0 glass-retro rounded-3xl p-6 md:relative fixed md:static z-30 md:z-auto ${isDrawerOpen ? 'hidden md:block' : 'block'}`}>
          <div className="space-y-4">
            <LibraryPanel search={search} setSearch={setSearch} filteredLibrary={filteredLibrary} currentTrack={currentTrack} onTrackSelect={handleTrackSelect} />
            <SpotifySearch onAddTrack={t => pl.addTrack(t, true)} />
          </div>
        </aside>

        <div className="flex-grow flex flex-col gap-6 max-w-5xl mx-auto overflow-y-auto scrollbar-hide">
          {appMode === 'deck' && (
            <>
              <motion.div layout className="glass-retro rounded-3xl p-8 space-y-6 crt-screen">
                <div className="flex flex-col lg:flex-row lg:items-end lg:gap-8">
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-3">
                      {['A','B'].map(d => (
                        <button key={d} onClick={() => ae.switchActiveDeck(d)} className={`px-3 py-1 rounded-lg text-[10px] font-retro font-black uppercase tracking-widest transition-all ${ae.activeDeck === d ? 'bg-neon/purple-500/30 text-neon/cyan-400 border border-neon/purple-400/40' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}>Deck {d}</button>
                      ))}
                      <span className="text-[10px] font-mono text-slate-500 ml-2">{isDjMode ? 'Dual Mode' : 'Master Deck'}</span>
                    </div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-block px-4 py-1.5 bg-gradient-to-r from-neon/purple-500/20 to-neon/pink-500/20 rounded-xl border border-neon/purple-400/30 text-[11px] font-retro font-black uppercase tracking-widest neon-glow mb-4">{isDjMode ? `DJ Deck ${ae.activeDeck}` : 'Master Deck'}</motion.div>
                    <motion.h2 layout className="text-4xl lg:text-5xl font-retro font-black tracking-tight uppercase leading-tight text-neon/cyan-400 drop-shadow-2xl">{currentTrack.name}</motion.h2>
                    <p className="text-sm font-mono tracking-wide text-slate-400 mt-3 flex items-center gap-2">{currentTrack.artist} &bull; <span className="text-neon/pink-400 font-retro">{currentTrack.mood}</span></p>
                  </div>
                  <BpmDial bpm={v.bpm} isLive={v.isLive} />
                </div>
                <AnimatePresence>
                  {v.aiRecommendation && (
                    <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }} className="glass-retro rounded-2xl p-6 border border-neon/purple-500/20 neon-glow scanlines">
                      <div className="flex items-center gap-2 mb-3 text-neon/purple-400 text-[11px] font-retro font-black uppercase tracking-widest"><Sparkles size={16} className="fill-current neon-glow" /> Neural Intelligence</div>
                      <p className="text-sm leading-relaxed text-slate-300 font-mono opacity-95 whitespace-pre-wrap">{v.aiRecommendation}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <div className="space-y-6">
                <Waveform isLive={v.isLive} bpm={v.bpm} getFrequencyData={ae.getFrequencyData} getTimeData={ae.getTimeData} progress={ae.playbackProgress} masterLevel={ae.masterLevel} />
                <AnimatePresence>
                  {isDjMode && (
