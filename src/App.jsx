import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Square, Layers, Database, 
  Cpu, Clock, Zap, Sparkles, 
  Fingerprint, Radar, Activity, 
  Radiation, Orbit, Terminal, 
  BoxSelect, AudioLines, Waves, Crosshair,
  SignalHigh, Menu, Search, Sliders, Shuffle, GitBranch
} from 'lucide-react';

import TrackCard from './components/TrackCard.jsx';
import Waveform from './components/Waveform.jsx';
import StemSlider from './components/StemSlider.jsx';
import UiTerminal from './components/Terminal.jsx';
import BpmDial from './components/BpmDial.jsx';
import DeckPlayButton from './components/DeckPlayButton.jsx';
import SegmentVisualizer from './components/SegmentVisualizer.jsx';
import DnaBadge from './components/DnaBadge.jsx';
import AtomDeck from './components/AtomDeck.jsx';
import BackendStatus from './components/BackendStatus.jsx';
import PreIngestLibrary from './components/PreIngestLibrary.jsx';
import VanguardStudio from './components/VanguardStudio.jsx';

import { useVanguard } from './hooks/useVanguard.js';
import { useAudioEngine } from './hooks/useAudioEngine.js';
import { useTrackAnalyzer } from './hooks/useTrackAnalyzer.js';
import usePlaylist from './hooks/usePlaylist.js';
import useAutoMix from './hooks/useAutoMix.js';
import { useSegmentEngine } from './hooks/useSegmentEngine.js';
import { useAtomPlayer } from './hooks/useAtomPlayer.js';
import { AudioContextManager } from './audio/index.js';
import { fetchAudioBufferFromUrl } from './audio/utils/buffers.js';

const INITIAL_LIBRARY = [
  { id: 1, name: "Subterranean Vibe", artist: "Deep Technic", key: "1A", bpm: 124, mood: "Dark / Industrial", color: "#a855f7" },
  { id: 2, name: "Neon Horizon", artist: "Synthwave Pro", key: "3A", bpm: 126, mood: "Energetic / Bright", color: "#3b82f6" },
  { id: 3, name: "Deep Techno 04", artist: "Unknown", key: "12B", bpm: 122, mood: "Minimal / Cold", color: "#10b981" },
];

export default function App() {
  // V10 States + Existing
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPulse, setIsPulse] = useState(false);
  const [signalType, setSignalType] = useState(null);
  const [systemLoad, setSystemLoad] = useState(15);
  const [macroPos, setMacroPos] = useState({ x: 50, y: 50 });
  const [glitchActive, setGlitchActive] = useState(false);
  const [phaseAlignment, setPhaseAlignment] = useState(0);
  const [appMode, setAppMode] = useState('deck');
  const [search, setSearch] = useState('');
  const [stems, setStems] = useState({ D: 85, B: 70, V: 50, M: 65 });
  const [currentTrack, setCurrentTrack] = useState(INITIAL_LIBRARY[0]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [crossfaderPos, setCrossfaderPos] = useState(0);
  const [compatibleSegs, setCompatibleSegs] = useState([]);
  const [lastUploaded, setLastUploaded] = useState(null); // { audioBuffer, metadata }

  // Existing Hooks
  const v = useVanguard(INITIAL_LIBRARY);
  const ae = useAudioEngine(v.addLog);
  const ta = useTrackAnalyzer(v.addLog);
  const pl = usePlaylist();
  const se = useSegmentEngine(ae, v.addLog);
  const atomPlayer = useAtomPlayer();
  const am = useAutoMix(pl.tracks, ae, v.addLog);

  const requestRef = useRef();
  const startTimeRef = useRef();
  const lastBeatRef = useRef(0);
  const localFileCacheRef = useRef(new Map());
  /** Full analysis payloads (atoms, curves) kept in RAM — avoids huge localStorage writes */
  const analysisSnapshotsRef = useRef(new Map());

  const filteredLibrary = useMemo(() => pl.searchTracks(search), [search, pl]);
  const stats = useMemo(() => se.getStats(), [se]);

  const decodeTrackToBuffer = useCallback(async (track) => {
    const ctxMgr = AudioContextManager.getInstance();
    const audioContext = ctxMgr.getContext() || ctxMgr.init();
    await ctxMgr.resume();
    const cachedFile = localFileCacheRef.current.get(track.id);
    if (cachedFile) {
      const raw = await cachedFile.arrayBuffer();
      return audioContext.decodeAudioData(raw.slice(0));
    }
    if (track.file) {
      return fetchAudioBufferFromUrl(track.file, audioContext);
    }
    throw new Error('No local file reference for this track');
  }, []);

  // Existing handlers
  const handleTrackSelect = useCallback((track) => { setCurrentTrack(track); setIsDrawerOpen(false); }, []);
  const handleStemChange = useCallback((key, val) => { setStems(p => ({ ...p, [key]: val })); ae.setStemLevel(key, val); }, [ae]);
  const handleAddLocalFiles = useCallback(async (file) => {
    try {
      const ctxMgr = AudioContextManager.getInstance();
      const audioContext = ctxMgr.getContext() || ctxMgr.init();
      await ctxMgr.resume();

      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

      const trackId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const trackMetadata = {
        id: trackId,
        name: file.name,
        artist: 'Local Upload',
        bpm: 128,
        key: 'Unknown',
        mood: 'Local',
        source: 'local',
        hasAnalysis: false,
        duration: audioBuffer.duration,
      };

      const trackData = await pl.addFile(file, trackMetadata);
      if (trackData?.id) localFileCacheRef.current.set(trackData.id, file);

      v.addLog(`Queued "${file.name}" in ingest (${audioBuffer.duration.toFixed(1)}s) — Analyze or Segment when ready`, 'system');
    } catch (e) {
      v.addLog(`Add failed: ${e.message}`, 'error');
    }
  }, [pl, v]);

  const handleAnalyzeLibraryTrack = useCallback(async (track) => {
    try {
      const audioBuffer = await decodeTrackToBuffer(track);
      const cachedFile = localFileCacheRef.current.get(track.id);
      const analysis = await ta.analyzeTrack(audioBuffer, cachedFile ?? null, { name: track.name });
      if (analysis) {
        analysisSnapshotsRef.current.set(track.id, analysis);
        pl.updateTrack(track.id, {
          hasAnalysis: true,
          bpm: analysis.bpm ?? track.bpm,
          key: analysis.key ?? track.key,
          analysisAtomCount: analysis.totalAtoms ?? analysis.atoms?.length ?? 0,
        });
        setLastUploaded({
          audioBuffer,
          metadata: { ...track, bpm: analysis.bpm, key: analysis.key, hasAnalysis: true },
        });
        v.addLog(`Analyzed "${track.name}"`, 'ai');
      }
    } catch (e) {
      v.addLog(`Analyze failed: ${e.message}`, 'error');
    }
  }, [decodeTrackToBuffer, ta, pl, v]);

  const handleSegmentLibraryTrack = useCallback(async (track) => {
    try {
      const audioBuffer = await decodeTrackToBuffer(track);
      const snap = analysisSnapshotsRef.current.get(track.id);
      const meta = {
        id: track.id,
        name: track.name,
        artist: track.artist || 'Local Upload',
        bpm: track.bpm || 128,
        key: track.key || 'Unknown',
        mood: track.mood || 'Local',
        source: track.source || 'local',
      };
      if (snap?.atoms?.length) {
        await se.processTrackWithDNA(audioBuffer, meta, {
          atoms: snap.atoms,
          bpm: snap.bpm ?? meta.bpm,
          key: snap.key ?? meta.key,
        });
      } else {
        await se.processTrack(audioBuffer, meta);
      }
      setLastUploaded({ audioBuffer, metadata: meta });
      v.addLog(`Segments created for "${track.name}"`, 'ai');
    } catch (e) {
      v.addLog(`Segment failed: ${e.message}`, 'error');
    }
  }, [decodeTrackToBuffer, se, v]);
  const handleToggleLive = useCallback(() => {
    const next = !v.isLive;
    v.setIsLive(next);
    ae.playPause(next);
    setIsPlaying(next);
  }, [v, ae]);
  const handleSegmentClick = useCallback((seg) => {
    setCompatibleSegs(se.findCompatibleSegments(seg.id, 6));
    v.addLog(`Selected: ${seg.trackName}`, 'system');
  }, [se, v]);

  // V10 Animation Engine (sync with audio)
  const animate = (time) => {
    if (!startTimeRef.current) startTimeRef.current = time;
    const elapsed = (time - startTimeRef.current) / 1000;
    const beatDuration = 60 / ae.bpm || 128;
    const currentBeat = Math.floor(elapsed / beatDuration);
    
    if (currentBeat !== lastBeatRef.current) {
      lastBeatRef.current = currentBeat;
      setIsPulse(true);
      setTimeout(() => setIsPulse(false), 120);
    }

    setPhaseAlignment(prev => {
      const target = ae.isPlaying ? 95 : 0;
      return prev + (target - prev) * 0.1;
    });

    setSystemLoad(prev => Math.min(65, prev + (Math.random() - 0.5) * 3));

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isPlaying && ae.isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, ae.isPlaying]);

  return (
    <div className="min-h-screen bg-[#020204] text-slate-400 font-sans p-6 transition-all duration-300 overflow-hidden select-none relative">
      {/* V10 Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute inset-0 opacity-10 ${isPulse ? 'scale-110' : ''}`} 
             style={{ 
               backgroundImage: 'linear-gradient(#3b82f615 1px, transparent 1px), linear-gradient(90deg, #3b82f615 1px, transparent 1px)', 
               backgroundSize: '60px 60px'
             }} />
        <div className="absolute inset-0" style={{ backgroundImage: `repeating-linear-gradient(${phaseAlignment * 3.6}deg, transparent, transparent 40px, rgba(255,255,255,0.02) 40px, rgba(255,255,255,0.02) 41px)` }} />
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full blur-[150px] transition-all ${isPulse ? 'bg-blue-600/10' : 'bg-blue-800/5'}`} />
      </div>



      <div className="max-w-[1900px] mx-auto flex flex-col gap-6 h-full relative z-10">
        
        {/* V10 Header with modes */}
        <header className="flex justify-between items-center bg-black/30 border border-slate-700/50 p-6 rounded-3xl backdrop-blur-sm shadow-lg relative overflow-hidden">
          <div className="flex items-center gap-3">
            <AudioLines className={`text-blue-400 transition-all ${isPulse ? 'scale-110' : ''}`} size={36} />
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight uppercase flex items-center gap-1">
                Vanguard <span className="text-blue-400">V10</span>
              </h1>
              <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-slate-500">
                <BackendStatus />
                <span>{ae.isInitialized ? 'LIVE' : 'STANDBY'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode buttons */}
            {['deck', 'segment', 'studio'].map(mode => (
              <button key={mode} onClick={() => setAppMode(mode)} className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all ${appMode === mode ? 'bg-blue-400/20 text-blue-300 border border-blue-400/40' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'}`}>
                {mode.toUpperCase()}
              </button>
            ))}
            <button 
              onClick={handleToggleLive}
              className={`group px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-wide transition-all border-2 ${
                isPlaying 
                  ? 'bg-slate-900/50 text-slate-300 border-slate-600/50 hover:bg-slate-800/50 hover:border-slate-500/50' 
                  : 'bg-white text-slate-900 border-white hover:shadow-lg hover:shadow-white/20'
              }`}
            >
              {isPlaying ? <Square size={16} className="inline mr-1 group-hover:scale-110" /> : <Play size={16} className="inline mr-1 group-hover:scale-110" />}
              {isPlaying ? 'Stop' : 'Start'}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[75vh]">
          {/* Left: Library & Telemetry */}
          <aside className="lg:col-span-3 space-y-6">
            <motion.div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur-sm flex flex-col gap-3 shadow-sm" animate={{ opacity: 1 }} initial={{ opacity: 0 }}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[12px] font-mono font-semibold uppercase tracking-wide text-slate-400">Analysis</span>
                <Activity size={14} className={`transition-colors ${ta.isAnalyzing ? 'text-emerald-400 animate-pulse' : 'text-blue-400'}`} />
              </div>
              {ta.isAnalyzing ? (
                <div className="space-y-2">
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full animate-pulse" style={{ width: '75%' }} />
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 text-center">Neural Core processing...</div>
                </div>
              ) : ta.analysis ? (
                <div className="space-y-2">
                  <DnaBadge dna={ta.analysis} />
                  <div className="text-[11px] font-mono text-slate-400">
                    {ta.analysis.totalAtoms || 0} atoms • {ta.analysis.bpm} BPM
                  </div>
                  <button
                    onClick={() => {
                      if (!lastUploaded?.audioBuffer) return;
                      ae.loadTrackToDeck('A', lastUploaded.audioBuffer, lastUploaded.metadata);
                      ae.playDeck('A');
                    }}
                    disabled={!lastUploaded?.audioBuffer}
                    className="w-full px-3 py-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-sm font-mono rounded-lg hover:bg-emerald-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Play Last Uploaded Track
                  </button>
                </div>
              ) : (
                <p className="text-[11px] font-mono text-slate-500 text-center leading-relaxed">
                  Use the ingest queue below — add tracks, optionally analyze with Neural Core, then segment into the pool.
                </p>
              )}
            </motion.div>

            <PreIngestLibrary
              tracks={pl.tracks}
              isAnalyzing={ta.isAnalyzing}
              onAddFiles={handleAddLocalFiles}
              onAnalyzeTrack={handleAnalyzeLibraryTrack}
              onSegmentTrack={handleSegmentLibraryTrack}
              onRemoveTrack={(id) => {
                localFileCacheRef.current.delete(id);
                analysisSnapshotsRef.current.delete(id);
                pl.removeTrack(id);
              }}
            />

            <motion.div className="flex-grow bg-black/40 border border-white/5 rounded-[2.5rem] p-6 backdrop-blur-xl overflow-hidden flex flex-col min-h-[160px] max-h-[40vh]">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 shrink-0">Library</h3>
                <div className="relative flex-1 min-w-[120px] max-w-[220px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter…"
                    className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-black/45 border border-slate-700/50 text-[11px] font-mono text-slate-300 placeholder:text-slate-600"
                  />
                </div>
              </div>
              <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                {filteredLibrary.map((atom) => (
                  <button
                    type="button"
                    key={atom.id}
                    className={`w-full text-left p-3 rounded-xl cursor-pointer transition-all border ${currentTrack?.id === atom.id ? 'bg-blue-500/15 border-blue-400/35' : 'bg-white/5 border-transparent hover:bg-white/10'}`}
                    onClick={() => handleTrackSelect(atom)}
                  >
                    <div className="text-xs font-mono text-slate-200 truncate">{atom.name || atom.id}</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {atom.mood?.split(' / ')[0] || atom.source || 'track'} • {atom.bpm != null ? `${Math.round(atom.bpm)} BPM` : ''}{atom.key ? ` · ${atom.key}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </aside>

          {/* Middle: Main Reactor */}
          <section className="lg:col-span-6 space-y-6">
            <motion.div className="h-96 bg-black/40 border border-white/5 rounded-[3rem] p-8 backdrop-blur-xl overflow-hidden relative">
              <div className="absolute inset-0 flex items-center justify-center">
                {appMode === 'deck' && <Waveform progress={ae.playbackProgress} />}
                {appMode === 'segment' && (
                  <SegmentVisualizer
                    segments={se.segments}
                    activeMix={se.activeMix}
                    activeSegmentIndex={se.activeSegmentIndex}
                    onSegmentClick={handleSegmentClick}
                    compatibleSegments={compatibleSegs}
                    stats={stats}
                    onPlayMix={() => se.activeMix && se.playMix(se.activeMix)}
                    onStopMix={se.stopMix}
                    isPlaying={se.mixPlaybackActive}
                  />
                )}
                {appMode === 'studio' && (
                  <VanguardStudio
                    segments={se.segments}
                    activeMix={se.activeMix}
                    activeSegmentIndex={se.activeSegmentIndex}
                    isPlayingMix={se.mixPlaybackActive}
                    onPlayMix={se.playMix}
                    onStopMix={se.stopMix}
                    addLog={v.addLog}
                  />
                )}
              </div>
              <div className="absolute left-8 top-8 flex flex-col gap-2">
                <BpmDial bpm={v.bpm} />
                <DeckPlayButton isLive={v.isLive} onToggle={handleToggleLive} />
              </div>
            </motion.div>

            {/* Physics/Deconvolution */}
            <div className="grid grid-cols-2 gap-6">
              <motion.div className="bg-black/40 border border-white/5 rounded-[2.5rem] p-6">
                <span className="text-xs font-black uppercase text-slate-500 mb-4 block">Phase Alignment</span>
                <div className="w-full h-32 bg-white/5 rounded-2xl flex items-center justify-center">
                  <div className="text-2xl font-mono">{phaseAlignment.toFixed(1)}%</div>
                </div>
              </motion.div>
              <motion.div className="bg-black/40 border border-white/5 rounded-[2.5rem] p-6">
                <span className="text-xs font-black uppercase text-slate-500 mb-4 block">Compatibility</span>
                <div className="w-full h-32 bg-white/5 rounded-2xl flex items-center justify-center">
                  <div className="text-2xl font-mono">{am.compatibilityScore || 0}%</div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* Right: Controls */}
          <aside className="lg:col-span-3 space-y-6">
            <motion.div className="bg-black/40 border border-white/5 rounded-[2.5rem] p-6 h-48 flex flex-col justify-center">
              <span className="text-xs font-black uppercase text-slate-500 mb-4 block text-center">Morph Pad (Stems)</span>
              <div className="grid grid-cols-2 gap-2 text-center">
                <StemSlider label="D" value={stems.D} onChange={v => handleStemChange('D', v)} />
                <StemSlider label="B" value={stems.B} onChange={v => handleStemChange('B', v)} />
                <StemSlider label="V" value={stems.V} onChange={v => handleStemChange('V', v)} />
                <StemSlider label="M" value={stems.M} onChange={v => handleStemChange('M', v)} />
              </div>
            </motion.div>

            <motion.div className="bg-black/40 border border-white/5 rounded-[2.5rem] p-6">
              <span className="text-xs font-black uppercase text-slate-500 mb-4 block">AutoMix</span>
              <button onClick={() => am.setAutoMode(!am.autoMode)} className="w-full p-3 bg-white/10 rounded-xl text-sm font-mono transition-all hover:bg-white/20">
                {am.autoMode ? 'Stop' : 'Start'} ({am.queue.length} tracks)
              </button>
            </motion.div>

            <motion.div className="bg-black/40 border border-white/5 rounded-[2.5rem] p-6 h-32">
              <DnaBadge dna={ta.analysis} />
            </motion.div>
          </aside>
        </div>

        {/* Terminal */}
        <motion.div className="bg-black/60 border border-white/5 rounded-[2rem] p-6 backdrop-blur-xl mt-auto">
<UiTerminal logs={v.terminalLogs} />
        </motion.div>
      </div>

      <style>{`
        @keyframes scanning { 0% { transform: translateY(-100%); } 100% { transform: translateY(1000%); } }
        .animate-scanning { animation: scanning 6s linear infinite; }
      `}</style>
    </div>
  );
}
