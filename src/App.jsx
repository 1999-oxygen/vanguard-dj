import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { useTrackAnalyzer } from './hooks/useTrackAnalyzer.js';
import usePlaylist from './hooks/usePlaylist.js';
import useAutoMix from './hooks/useAutoMix.js';
import { useSegmentEngine } from './hooks/useSegmentEngine.js';
import SpotifySearch from './components/SpotifySearch.jsx';
import FileUpload from './components/FileUpload.jsx';
import DnaBadge from './components/DnaBadge.jsx';
import { DEMO_LIBRARY } from './data/demoLibrary.js';
import AtomDeck from './components/AtomDeck.jsx';
import { useFlightPlanPlayer } from './hooks/useFlightPlanPlayer.js';
import FlightPlanTimeline from './components/FlightPlanTimeline.jsx';
import QuantumCrate from './components/QuantumCrate.jsx';
import { recombineSegments } from './services/universalApi.js';
import BackendStatus from './components/BackendStatus.jsx';
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
  const [previewBuffer, setPreviewBuffer] = useState(null);
  const [flightPlan, setFlightPlan] = useState(null);
  const [isGeneratingFlightPlan, setIsGeneratingFlightPlan] = useState(false);

  const v = useVanguard(INITIAL_LIBRARY);
  const ae = useAudioEngine(v.addLog);
  const ta = useTrackAnalyzer(v.addLog);
  const pl = usePlaylist();
  const se = useSegmentEngine(ae, v.addLog);
  const fpp = useFlightPlanPlayer(v.addLog);

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
      setPreviewBuffer(buf);
      const metadata = { id: Date.now() + Math.random(), name: file.name, bpm: 128 };

      // Run analysis (tries backend first, falls back to client-side)
      const analysis = await ta.analyzeTrack(buf, file, metadata);

      if (analysis && analysis.atoms && analysis.atoms.length > 0) {
        // Use DNA-powered atom segmentation
        await se.processTrackWithDNA(buf, metadata, {
          bpm: analysis.bpm,
          key: analysis.key,
          total_atoms: analysis.totalAtoms,
          atoms: analysis.atoms,
        });
      } else {
        // Fallback to standard JS segmentation
        await se.processTrack(buf, metadata);
      }

      // Add to playlist with pre-computed metadata
      pl.addFile(file, {
        id: metadata.id,
        name: file.name,
        duration: buf.duration,
        bpm: analysis?.bpm || 128,
        key: analysis?.key || 'Unknown',
        hasAnalysis: !!analysis,
        source: analysis?.source || 'local',
      });

      v.addLog(`Added "${file.name}" to library`, 'system');
    } catch (e) {
      v.addLog(`Upload failed: ${e.message}`, 'error');
      // Still add the file even if analysis failed
      pl.addFile(file, { name: file.name, hasAnalysis: false });
    }
  }, [se, pl, v, ta]);

  const handleGenerateMix = useCallback(async (style) => {
    const mix = await se.generateMixPlan({ style, targetDuration: 300, name: `${style} Mix` });
    if (mix) await se.playMix(mix);
  }, [se]);

  const handleGenerateFlightPlan = useCallback(async () => {
    if (se.segments.length < 2) {
      v.addLog('Need at least 2 segments to generate a flight plan', 'warning');
      return;
    }

    setIsGeneratingFlightPlan(true);
    v.addLog('Generating Universal Flight Plan...', 'ai');

    try {
      // Convert segments to the format the recombinator expects
      const segmentData = se.segments.map(seg => ({
        id: seg.id,
        trackName: seg.trackName,
        start: seg.start,
        end: seg.end,
        duration: seg.duration,
        features: seg.features || {},
        stem_target: seg.stem_target || 'master',
      }));

      const result = await recombineSegments(segmentData, {
        master_bpm: v.bpm,
        master_key: currentTrack.key || '8A',
        output_name: `fusion_${Date.now()}`,
      });

      if (result?.success && result.flight_plan) {
        setFlightPlan(result.flight_plan);
        v.addLog(
          `Flight plan ready: ${result.flight_plan.total_events} events, ` +
          `${result.flight_plan.total_duration_sec}s at ${result.flight_plan.global_bpm} BPM`,
          'ai'
        );
      } else {
        v.addLog('Flight plan generation failed', 'error');
      }
    } catch (error) {
      v.addLog(`Flight plan error: ${error.message}`, 'error');
    } finally {
      setIsGeneratingFlightPlan(false);
    }
  }, [se, v, currentTrack]);

  const handleLoadDemoTracks = useCallback(() => {
    DEMO_LIBRARY.forEach((track) => {
      pl.addTrack(track);
    });
    v.addLog(`Loaded ${DEMO_LIBRARY.length} demo tracks into library`, 'system');
  }, [pl, v]);

  const handleSegmentClick = useCallback((seg) => {
    setCompatibleSegs(se.findCompatibleSegments(seg.id, 6));
    v.addLog(`Selected: ${seg.trackName} (${seg.id.slice(-8)})`, 'system');
  }, [se, v]);

  const handleToggleLive = useCallback(() => {
    const next = !v.isLive;
    v.setIsLive(next);
  }, [v, ae]);

  const handlePlayMix = useCallback(() => {
    if (se.activeMix) {
      se.playMix(se.activeMix);
    }
  }, [se]);

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
            <span className="text-neon/purple-400"><Cpu size={12} /></span>
            <span>{ae.isInitialized ? 'ENGINE ONLINE' : 'STANDBY'}</span>
            <span className="w-px h-3 bg-neon/retro/scanline" />
<span className={v.isLive ? 'text-neon/pink-400 animate-pulse' : 'text-slate-500'}>
              {v.isLive ? '● LIVE' : '○ IDLE'}
            </span>
            <span className="w-px h-3 bg-neon/retro/scanline" />
            <BackendStatus />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {modeBtns.map(({ k, l, i: Icon }) => (
            <button
              key={k}
              onClick={() => setAppMode(k)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-retro font-black uppercase tracking-widest transition-all ${
                appMode === k
                  ? 'bg-neon/purple-500/20 text-neon/purple-300 border border-neon/purple-500/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={12} className="inline mr-1" />
              {l}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Mobile Drawer */}
        <AnimatePresence>
          {isDrawerOpen && (
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed inset-y-0 left-0 w-80 bg-slate-950/95 backdrop-blur-xl border-r border-neon/purple-500/20 z-50 flex flex-col"
            >
              <div className="p-4 border-b border-neon/retro/scanline flex items-center justify-between">
                <h2 className="font-retro text-xs font-black uppercase tracking-widest text-neon/cyan-400">Library</h2>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 glass-retro rounded-lg hover:bg-neon/pink-500/10">
                  <Menu size={16} />
                </button>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neon/cyan-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search tracks..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-neon/cyan-500/20 rounded-xl font-mono text-xs text-neon/cyan-300 focus:border-neon/pink-400 focus:ring-1 focus:ring-neon/pink-500/30 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  {filteredLibrary.map((track) => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      isActive={currentTrack.id === track.id}
                      onSelect={handleTrackSelect}
                      search={search}
                    />
                  ))}
                </div>
                <FileUpload onAddTracks={handleFileUpload} />
                <button
                  onClick={handleLoadDemoTracks}
                  className="w-full px-4 py-3 rounded-xl bg-neon/cyan-500/10 text-neon/cyan-300 border border-neon/cyan-500/20 hover:bg-neon/cyan-500/20 transition-all text-[10px] font-retro font-black uppercase tracking-widest"
                >
                  Load 100 Demo Tracks
                </button>
                <SpotifySearch
                  onAddTrack={(track, isSpotify, audioBuffer) => {
                    // Convert old API to new playlist API
                    if (audioBuffer) {
                      pl.addSpotifyTrack(track, true);
                    } else {
                      pl.addSpotifyTrack(track, false);
                    }
                  }}
                  onProcessTrack={se.processTrack}
                  addLog={v.addLog}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-80 flex-col border-r border-neon/retro/scanline bg-slate-950/50 backdrop-blur-sm">
          <div className="p-4 border-b border-neon/retro/scanline">
            <h2 className="font-retro text-xs font-black uppercase tracking-widest text-neon/cyan-400 flex items-center gap-2">
              <Layers size={12} />
              Track Library
            </h2>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neon/cyan-400" size={14} />
              <input
                type="text"
                placeholder="Search tracks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-900/50 border border-neon/cyan-500/20 rounded-xl font-mono text-xs text-neon/cyan-300 focus:border-neon/pink-400 focus:ring-1 focus:ring-neon/pink-500/30 transition-all"
              />
            </div>
            <div className="space-y-2">
              {filteredLibrary.map((track) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  isActive={currentTrack.id === track.id}
                  onSelect={handleTrackSelect}
                  search={search}
                />
              ))}
            </div>
            <FileUpload onAddTracks={handleFileUpload} />
            <button
              onClick={handleLoadDemoTracks}
              className="w-full px-4 py-3 rounded-xl bg-neon/cyan-500/10 text-neon/cyan-300 border border-neon/cyan-500/20 hover:bg-neon/cyan-500/20 transition-all text-[10px] font-retro font-black uppercase tracking-widest"
            >
              Load 100 Demo Tracks
            </button>
                <SpotifySearch
                  onAddTrack={(track, isSpotify, audioBuffer) => {
                    // Convert old API to new playlist API
                    if (audioBuffer) {
                      pl.addSpotifyTrack(track, true);
                    } else {
                      pl.addSpotifyTrack(track, false);
                    }
                  }}
                  onProcessTrack={se.processTrack}
                  addLog={v.addLog}
                />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 space-y-6">
          {appMode === 'deck' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Deck Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: BPM & Info */}
                <div className="glass-retro rounded-3xl p-6 flex flex-col items-center justify-center gap-4">
                  <BpmDial bpm={v.bpm} isLive={v.isLive} />
                  <div className="text-center">
                    <h3 className="font-retro text-lg font-black text-neon/purple-300">{currentTrack.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{currentTrack.artist} • {currentTrack.key} • {currentTrack.bpm} BPM</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsDjMode(!isDjMode)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-retro font-black uppercase tracking-widest transition-all ${
                        isDjMode
                          ? 'bg-neon/pink-500/20 text-neon/pink-300 border border-neon/pink-500/30'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <Activity size={12} className="inline mr-1" />
                      DJ Mode
                    </button>
                    <button
                      onClick={() => v.runAnalysis(currentTrack, pl.tracks)}
                      className="px-3 py-1 rounded-lg text-[10px] font-retro font-black uppercase tracking-widest text-slate-500 hover:text-neon/purple-300 transition-all"
                    >
                      <Sparkles size={12} className="inline mr-1" />
                      AI Analyze
                    </button>
                  </div>
                </div>

                {/* Center: Waveform & Play */}
                <div className="lg:col-span-2 space-y-4">
                  <Waveform
                    isLive={v.isLive}
                    bpm={v.bpm}
                    getFrequencyData={ae.getFrequencyData}
                    getTimeData={ae.getTimeData}
                    progress={ae.playbackProgress}
                    masterLevel={ae.masterLevel}
                  />
                  <DeckPlayButton isLive={v.isLive} onToggle={handleToggleLive} />
                </div>
              </div>

              {/* Stem Controls */}
              <div className="glass-retro rounded-3xl p-6">
                <h3 className="font-retro text-xs font-black uppercase tracking-widest text-neon/cyan-400 mb-4 flex items-center gap-2">
                  <Sliders size={12} />
                  Stem Mixer
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StemSlider label="Drums" value={stems.D} onChange={(v) => handleStemChange('D', v)} color="purple" bpm={v.bpm} />
                  <StemSlider label="Bass" value={stems.B} onChange={(v) => handleStemChange('B', v)} color="pink" bpm={v.bpm} />
                  <StemSlider label="Vocals" value={stems.V} onChange={(v) => handleStemChange('V', v)} color="cyan" bpm={v.bpm} />
                  <StemSlider label="Melody" value={stems.M} onChange={(v) => handleStemChange('M', v)} color="purple" bpm={v.bpm} />
                </div>
              </div>

              {/* Crossfader */}
              <div className="glass-retro rounded-3xl p-6">
                <h3 className="font-retro text-xs font-black uppercase tracking-widest text-neon/cyan-400 mb-4">Crossfader</h3>
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-neon/purple-400">A</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={crossfaderPos}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setCrossfaderPos(val);
                      ae.setCrossfader(val);
                    }}
                    className="flex-1 h-2 bg-slate-800 rounded-full appearance-none cursor-pointer"
                  />
                  <span className="text-xs font-mono text-neon/pink-400">B</span>
                </div>
              </div>

              {/* AutoMix */}
              <div className="glass-retro rounded-3xl p-6">
                <h3 className="font-retro text-xs font-black uppercase tracking-widest text-neon/cyan-400 mb-4 flex items-center gap-2">
                  <Shuffle size={12} />
                  AutoMix
                </h3>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => am.setAutoMode(!am.autoMode)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-retro font-black uppercase tracking-widest transition-all ${
                      am.autoMode
                        ? 'bg-neon/pink-500/20 text-neon/pink-300 border border-neon/pink-500/30'
                        : 'bg-neon/cyan-500/20 text-neon/cyan-300 border border-neon/cyan-500/30'
                    }`}
                  >
                    {am.autoMode ? 'Stop AutoMix' : 'Start AutoMix'}
                  </button>
                  <span className="text-xs text-slate-400 font-mono">
                    Queue: {am.queue.length} tracks
                  </span>
                  {am.compatibilityScore > 0 && (
                    <span className="text-xs text-neon/purple-400 font-mono">
                      Compatibility: {am.compatibilityScore}%
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {appMode === 'segment' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="glass-retro rounded-3xl p-6">
                <h2 className="font-retro text-lg font-black text-neon/cyan-400 uppercase tracking-widest mb-4">Segment Analysis</h2>
                <p className="text-sm text-slate-400 font-mono mb-4">
                  Upload tracks to analyze and segment them into mixable parts.
                  {ta.backendAvailable && (
                    <span className="text-neon/purple-400 ml-2">● Neural Core online</span>
                  )}
                </p>
                <FileUpload onAddTracks={handleFileUpload} />
              </div>

              {ta.analysis && ta.analysis.source === 'librosa-backend' && (
                <DnaBadge dna={ta.analysis} source={ta.analysis.source} />
              )}

              {ta.analysis && ta.analysis.atoms && (
                <AtomDeck
                  dna={ta.analysis}
                  audioBuffer={previewBuffer}
                  trackName={ta.analysis.track_name}
                />
              )}

              <SegmentVisualizer
                segments={se.segments}
                activeMix={se.activeMix}
                activeSegmentIndex={se.activeSegmentIndex}
                onSegmentClick={handleSegmentClick}
                onPreviewSegment={(seg) => {
                  // Preview segment using the audio engine
                  if (previewBuffer) {
                    const ctx = AudioContextManager.getInstance();
                    const ac = ctx.getContext();
                    const source = ac.createBufferSource();
                    source.buffer = previewBuffer;
                    source.connect(ac.destination);
                    source.start(0, seg.start, seg.duration);
                  }
                }}
                onPlayMix={handlePlayMix}
                onStopMix={se.stopMix}
                isPlaying={!!se.activeMix}
                compatibleSegments={compatibleSegs}
                stats={stats}
              />

              {se.isProcessing && (
                <div className="glass-retro rounded-3xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-neon/purple-400" />
                    <span className="text-sm text-neon/purple-400 font-mono">
                      Processing... {se.processProgress.current}/{se.processProgress.total} {se.processProgress.stage}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {appMode === 'fusion' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col md:flex-row gap-4 h-[calc(100vh-8rem)]"
            >
              {/* LEFT: Quantum Crate — Visual Atom Database */}
              <div className="w-full md:w-[420px] flex-shrink-0 h-full">
                <QuantumCrate
                  atoms={se.segments.map((seg) => ({
                    id: seg.id,
                    source: seg.trackName || 'Unknown',
                    type: seg.stem_target || 'master',
                    duration_sec: seg.duration,
                    bpm: seg.features?.bpm || 128,
                    key: seg.features?.key || '8A',
                    energy: seg.features?.avgEnergy || 0.5,
                    wps: seg.features?.vocalDensity || 0,
                    tags: [
                      seg.features?.isVocalHeavy ? 'Vocal-Heavy' : null,
                      seg.features?.isPercussive ? 'Percussive' : null,
                      seg.features?.isBright ? 'Bright' : null,
                      seg.features?.avgEnergy > 0.7 ? 'High-Energy' : seg.features?.avgEnergy < 0.3 ? 'Low-Energy' : null,
                    ].filter(Boolean),
                  }))}
                  masterBpm={v.bpm}
                  onSwap={(atom, stretchRatio) => {
                    // Update flight plan: swap atom on matching stem_target lane
                    setFlightPlan((prev) => {
                      if (!prev) return prev;
                      const newTimeline = prev.timeline.map((event) => {
                        if (event.stem_target === atom.type) {
                          return {
                            ...event,
                            atom_id: atom.id,
                            time_stretch_ratio: stretchRatio,
                            ui_metrics: {
                              energy: atom.energy,
                              vocals_wps: atom.wps,
                            },
                          };
                        }
                        return event;
                      });
                      return { ...prev, timeline: newTimeline };
                    });
                    v.addLog(
                      `Swapped ${atom.type} atom → ${atom.id} (stretch: ${stretchRatio.toFixed(3)}x)`,
                      'system'
                    );
                  }}
                />
              </div>

              {/* RIGHT: Recombinator Timeline */}
              <div className="flex-grow flex flex-col gap-4 h-full overflow-hidden">
                {/* Header */}
                <div className="glass-retro rounded-3xl p-4 flex items-center justify-between flex-shrink-0">
                  <div>
                    <h2 className="font-retro text-xs font-black uppercase tracking-widest text-neon/cyan-400 flex items-center gap-2">
                      <Layers size={14} />
                      Universal Timeline
                    </h2>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">
                      Master: {v.bpm} BPM | Key: {currentTrack.key} | Elastic Sync: Active
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleGenerateFlightPlan}
                      disabled={isGeneratingFlightPlan || se.segments.length < 2}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-neon/purple-500/20 to-neon/cyan-500/20 text-neon/cyan-300 border border-neon/purple-500/30 hover:from-neon/purple-500/30 transition-all text-[10px] font-retro font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      {isGeneratingFlightPlan ? (
                        <span className="flex items-center gap-2">
                          <RefreshCcw size={12} className="animate-spin" />
                          Generating...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <GitBranch size={12} />
                          Generate Plan
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Flight Plan Timeline */}
                <div className="flex-grow overflow-hidden">
                  {flightPlan ? (
                    <FlightPlanTimeline
                      flightPlan={flightPlan}
                      isPlaying={fpp.isPlaying}
                      currentTime={fpp.currentTime}
                      onPlay={() => fpp.playFlightPlan(flightPlan)}
                      onStop={fpp.stopFlightPlan}
                      onSeek={fpp.seekTo}
                      className="h-full"
                    />
                  ) : (
                    <div className="h-full glass-retro rounded-3xl flex flex-col items-center justify-center text-center p-8">
                      <Layers size={48} className="text-neon/purple-400/30 mb-4" />
                      <p className="text-sm text-slate-500 font-mono mb-2">No Flight Plan Generated</p>
                      <p className="text-xs text-slate-600 font-mono max-w-xs">
                        Upload tracks and analyze them, then click "Generate Plan" to create a mathematically perfect fusion timeline.
                      </p>
                    </div>
                  )}
                </div>

                {/* Saved Mix Plans */}
                {se.mixPlans.length > 0 && (
                  <div className="glass-retro rounded-3xl p-4 flex-shrink-0 max-h-40 overflow-y-auto">
                    <h3 className="font-retro text-[10px] font-black uppercase tracking-widest text-neon/cyan-400 mb-2">
                      Saved Mix Plans
                    </h3>
                    <div className="space-y-1">
                      {se.mixPlans.map((plan) => (
                        <div
                          key={plan.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-900/50 border border-neon/retro/scanline"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neon/cyan-300 font-mono">{plan.name || 'Untitled'}</span>
                            <span className="text-[10px] text-slate-500">{plan.segments?.length || 0} segs</span>
                          </div>
                          <button
                            onClick={() => se.playMix(plan)}
                            className="px-2 py-1 rounded-lg bg-neon/cyan-500/20 text-neon/cyan-300 text-[9px] font-retro font-black uppercase hover:bg-neon/cyan-500/30 transition-all"
                          >
                            Play
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Terminal */}
          <Terminal logs={v.terminalLogs} />
        </main>
      </div>
    </motion.div>
  );
}

