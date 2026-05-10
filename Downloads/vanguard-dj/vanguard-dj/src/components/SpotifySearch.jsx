import React, { useState, useCallback } from 'react';
import { Search, LogIn, Disc, ListMusic, CheckSquare, Square, Download, Music, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TrackCard from './TrackCard.jsx';
import { useSpotify, isSpotifyConfigured } from '../hooks/useSpotify.js';
import { AudioContextManager } from '../audio/index.js';
import { fetchAudioBufferFromUrl } from '../audio/utils/buffers.js';

const TAB_SEARCH = 'search';
const TAB_PLAYLISTS = 'playlists';

/**
 * SpotifySearch Component
 * Dual-tab interface:
 *   - Search: Find individual tracks on Spotify
 *   - Playlists: Browse user's playlists, select tracks, import with real analysis
 *
 * @param {Function} onAddTrack - (trackObj, isSpotify=true, audioBuffer|null) => void
 * @param {Function} onProcessTrack - (audioBuffer, metadata) => Promise<void>  [segment engine]
 * @param {Function} addLog - (text, type) => void
 */
const SpotifySearch = ({ onAddTrack, onProcessTrack, addLog }) => {
  const {
    login,
    token,
    spotifyTracks,
    searchQuery,
    setSearchQuery,
    isLoading,
    redirectUri,
    authError,
    setAuthError,
    playlists,
    playlistTracks,
    playlistLoading,
    fetchUserPlaylists,
    fetchPlaylistTracks,
  } = useSpotify();

  const [activeTab, setActiveTab] = useState(TAB_SEARCH);
  const [expandedPlaylist, setExpandedPlaylist] = useState(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState(new Set());
  const [importingIds, setImportingIds] = useState(new Set());
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // Load playlists when tab switches to playlists and user is authenticated
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === TAB_PLAYLISTS && token && playlists.length === 0) {
      fetchUserPlaylists();
    }
  }, [token, playlists.length, fetchUserPlaylists]);

  const togglePlaylist = useCallback(async (playlist) => {
    if (expandedPlaylist === playlist.id) {
      setExpandedPlaylist(null);
      return;
    }
    setExpandedPlaylist(playlist.id);
    if (!playlistTracks[playlist.id]) {
      await fetchPlaylistTracks(playlist.id);
    }
  }, [expandedPlaylist, playlistTracks, fetchPlaylistTracks]);

  const toggleTrackSelection = useCallback((trackId) => {
    setSelectedTrackIds(prev => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }, []);

  const selectAllInPlaylist = useCallback((playlistId) => {
    const tracks = playlistTracks[playlistId] || [];
    setSelectedTrackIds(prev => {
      const next = new Set(prev);
      tracks.forEach(t => next.add(t.id));
      return next;
    });
  }, [playlistTracks]);

  const clearSelection = useCallback(() => {
    setSelectedTrackIds(new Set());
  }, []);

  /**
   * Import selected tracks: fetch preview → decode → analyze → add to playlist + segment.
   */
  const handleImportSelected = useCallback(async () => {
    const allTracks = Object.values(playlistTracks).flat();
    const toImport = allTracks.filter(t => selectedTrackIds.has(t.id));
    if (toImport.length === 0) return;

    setImportProgress({ current: 0, total: toImport.length });
    setImportingIds(new Set(selectedTrackIds));
    addLog(`Importing ${toImport.length} tracks from Spotify...`, 'ai');

    const contextManager = AudioContextManager.getInstance();
    const audioContext = contextManager.getContext() || contextManager.init();

    for (let i = 0; i < toImport.length; i++) {
      const track = toImport[i];
      try {
        if (track.previewUrl) {
          addLog(`Downloading preview: ${track.name}`, 'system');
          const audioBuffer = await fetchAudioBufferFromUrl(track.previewUrl, audioContext);

          // Add to playlist with real analysis
          await onAddTrack(track, true, audioBuffer);

          // Also segment via the segment engine
          if (onProcessTrack) {
            await onProcessTrack(audioBuffer, {
              id: track.id,
              name: track.name,
              artist: track.artist,
              bpm: track.bpm || 128,
            });
          }

          addLog(`Analyzed & segmented: ${track.name}`, 'success');
        } else {
          // No preview: add as metadata-only
          await onAddTrack(track, true, null);
          addLog(`Added metadata-only: ${track.name} (no preview)`, 'warning');
        }
      } catch (err) {
        addLog(`Import failed for ${track.name}: ${err.message}`, 'error');
      }
      setImportProgress({ current: i + 1, total: toImport.length });
    }

    setImportingIds(new Set());
    setSelectedTrackIds(new Set());
    setImportProgress({ current: 0, total: 0 });
    addLog(`Playlist import complete.`, 'ai');
  }, [selectedTrackIds, playlistTracks, onAddTrack, onProcessTrack, addLog]);

  /**
   * Handle adding a single track from search results with preview buffer.
   */
  const handleAddSearchTrack = useCallback(async (track) => {
    if (!track.previewUrl) {
      // No preview available, add as metadata-only
      await onAddTrack(track, true, null);
      addLog(`Added metadata-only: ${track.name} (no preview)`, 'warning');
      return;
    }

    try {
      addLog(`Downloading preview: ${track.name}`, 'system');
      const contextManager = AudioContextManager.getInstance();
      const audioContext = contextManager.getContext() || contextManager.init();
      const audioBuffer = await fetchAudioBufferFromUrl(track.previewUrl, audioContext);

      await onAddTrack(track, true, audioBuffer);

      if (onProcessTrack) {
        await onProcessTrack(audioBuffer, {
          id: track.id,
          name: track.name,
          artist: track.artist,
          bpm: track.bpm || 128,
        });
      }

      addLog(`Analyzed & segmented: ${track.name}`, 'success');
    } catch (err) {
      addLog(`Failed to add ${track.name}: ${err.message}`, 'error');
      // Fallback: add without buffer
      await onAddTrack(track, true, null);
    }
  }, [onAddTrack, onProcessTrack, addLog]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="space-y-4 p-6 glass-retro rounded-2xl border-neon/purple-500/20"
    >
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-neon/purple-500/10 to-neon/pink-500/10 rounded-xl border border-neon/purple-400/20">
        <Disc size={24} className="text-neon/purple-400 neon-glow" />
        <h3 className="font-retro text-lg font-black text-neon/purple-300 uppercase tracking-wide">Spotify Import</h3>
      </div>

      {/* Configuration Warning */}
      {!isSpotifyConfigured() && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2"
        >
          <div className="flex items-center gap-2 text-amber-400">
            <AlertCircle size={18} />
            <span className="text-xs font-retro font-black uppercase tracking-widest">Spotify Not Configured</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
            No Spotify Client ID found. Create a <code className="text-amber-400">.env</code> file in the project root with <code className="text-amber-400">VITE_SPOTIFY_CLIENT_ID=your_client_id</code> and restart the dev server.
          </p>
        </motion.div>
      )}

      {/* Auth Error Display */}
      {authError && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle size={18} />
              <span className="text-xs font-retro font-black uppercase tracking-widest">Connection Error</span>
            </div>
            <button
              onClick={() => setAuthError(null)}
              className="text-[10px] text-slate-500 hover:text-slate-300 font-mono"
            >
              Dismiss
            </button>
          </div>
          <p className="text-[11px] text-slate-400 font-mono leading-relaxed">{authError}</p>
          <p className="text-[10px] text-amber-400 font-mono">
            Common fixes: Ensure your Redirect URI in <code className="text-cyan-400">.env</code> exactly matches what's in your <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-neon/cyan-400 hover:underline">Spotify Dashboard</a>.
          </p>
        </motion.div>
      )}

      {/* HTTPS Localhost Notice */}
      {!token && isSpotifyConfigured() && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 space-y-3"
        >
          <div className="flex items-center gap-2 text-cyan-400">
            <AlertCircle size={18} />
            <span className="text-xs font-retro font-black uppercase tracking-widest">HTTPS Localhost Setup</span>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
              This app runs on <strong className="text-cyan-400">https://localhost:5173</strong> with a self-signed certificate.
            </p>
            <ol className="text-[11px] text-slate-400 font-mono space-y-1 list-decimal list-inside">
              <li><strong className="text-amber-400">Browser warning:</strong> When you open the app, your browser will show "Your connection is not private". Click <strong>Advanced → Proceed to localhost</strong> to continue.</li>
              <li><strong className="text-amber-400">Spotify Redirect URI:</strong> Copy the pink URI below and paste it into your <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-neon/cyan-400 hover:underline">Spotify Dashboard</a> → App Settings → Redirect URIs → Save.</li>
            </ol>
            <div className="p-3 rounded-xl bg-slate-950/50 border border-cyan-500/30 space-y-2">
              <p className="text-[10px] text-cyan-400 font-retro uppercase tracking-widest">Copy this exact Redirect URI into Spotify:</p>
              <code className="block p-2 rounded bg-black/40 font-mono text-[11px] text-neon/pink-400 break-all select-all cursor-pointer" onClick={(e) => { navigator.clipboard.writeText(redirectUri); e.target.style.background = '#2d1b4e'; setTimeout(() => e.target.style.background = '', 300); }} title="Click to copy">
                {redirectUri}
              </code>
            </div>
            <p className="text-[10px] text-amber-400 font-mono">
              ⚠️ The URI must match <strong>exactly</strong> including <strong>https://</strong> and the <strong>/callback</strong> path.
            </p>
          </div>
        </motion.div>
      )}

      {!token && isSpotifyConfigured() && (
        <div className="space-y-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={login}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-neon/purple-600 to-neon/pink-600 text-white font-retro font-black rounded-xl shadow-2xl shadow-neon/purple-500/40 hover:from-neon/purple-500 transition-all pulse-retro-border"
          >
            <LogIn size={20} />
            <span className="tracking-[0.2em] uppercase">Connect Spotify</span>
          </motion.button>
          <p className="text-[10px] text-slate-500 font-mono text-center">
            Redirect URI: <span className="text-neon/cyan-400">{redirectUri}</span>
          </p>
        </div>
      )}

      {token && (
        <>
          {/* Tab Switcher */}
          <div className="flex rounded-lg bg-slate-900/50 border border-neon/purple-500/20 overflow-hidden">
            <button
              onClick={() => handleTabChange(TAB_SEARCH)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-retro font-black uppercase tracking-widest transition-all ${
                activeTab === TAB_SEARCH
                  ? 'bg-neon/purple-500/20 text-neon/purple-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Search size={12} />
              Search
            </button>
            <button
              onClick={() => handleTabChange(TAB_PLAYLISTS)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-retro font-black uppercase tracking-widest transition-all ${
                activeTab === TAB_PLAYLISTS
                  ? 'bg-neon/purple-500/20 text-neon/purple-300'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <ListMusic size={12} />
              Playlists
            </button>
          </div>

          {activeTab === TAB_SEARCH && (
            <>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neon/cyan-400" size={18} />
                <input
                  type="text"
                  placeholder="Search Spotify tracks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-950/50 border border-neon/cyan-500/30 rounded-xl font-mono text-neon/cyan-300 focus:border-neon/pink-400 focus:ring-2 focus:ring-neon/pink-500/30 transition-all"
                />
              </div>

              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon/purple-400"></div>
                  <span className="ml-3 text-sm text-neon/purple-400 font-mono">Scanning Spotify...</span>
                </div>
              )}

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {spotifyTracks.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    onSelect={() => handleAddSearchTrack(track)}
                    isActive={false}
                    search=""
                  />
                ))}
              </div>
            </>
          )}

          {activeTab === TAB_PLAYLISTS && (
            <div className="space-y-3">
              {playlistLoading && playlists.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon/purple-400"></div>
                  <span className="ml-3 text-sm text-neon/purple-400 font-mono">Loading playlists...</span>
                </div>
              )}

              {/* Selection toolbar */}
              {selectedTrackIds.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-neon/purple-500/10 border border-neon/purple-500/30"
                >
                  <span className="text-xs font-mono text-neon/purple-300">
                    {selectedTrackIds.size} selected
                  </span>
                  <div className="flex items-center gap-2">
                    {importProgress.total > 0 ? (
                      <span className="text-xs font-mono text-neon/cyan-300">
                        {importProgress.current}/{importProgress.total}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={clearSelection}
                          className="px-2 py-1 rounded text-[10px] font-retro uppercase tracking-widest text-slate-400 hover:text-slate-200"
                        >
                          Clear
                        </button>
                        <button
                          onClick={handleImportSelected}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neon/pink-500/20 text-neon/pink-300 border border-neon/pink-500/30 text-[10px] font-retro font-black uppercase tracking-widest hover:bg-neon/pink-500/30 transition-all"
                        >
                          <Download size={10} />
                          Import & Analyze
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )}

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {playlists.map((playlist) => {
                  const isExpanded = expandedPlaylist === playlist.id;
                  const tracksInPlaylist = playlistTracks[playlist.id] || [];
                  const hasPreviewCount = tracksInPlaylist.filter(t => t.previewUrl).length;

                  return (
                    <div key={playlist.id} className="rounded-xl border border-neon/retro/scanline overflow-hidden">
                      <button
                        onClick={() => togglePlaylist(playlist)}
                        className="w-full flex items-center gap-3 p-3 bg-slate-900/30 hover:bg-slate-900/50 transition-all text-left"
                      >
                        {playlist.image ? (
                          <img src={playlist.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-neon/purple-500/20 flex items-center justify-center">
                            <ListMusic size={18} className="text-neon/purple-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono text-neon/cyan-300 truncate">{playlist.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {playlist.trackCount} tracks · {playlist.owner}
                            {isExpanded && tracksInPlaylist.length > 0 && (
                              <span className="text-neon/purple-400 ml-2">{hasPreviewCount} previews available</span>
                            )}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500">
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-2 space-y-1 bg-slate-950/30">
                              {tracksInPlaylist.length === 0 && playlistLoading && (
                                <div className="flex items-center justify-center py-4">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-neon/purple-400"></div>
                                </div>
                              )}

                              {tracksInPlaylist.length > 0 && (
                                <div className="flex items-center justify-between px-2 py-1">
                                  <button
                                    onClick={() => selectAllInPlaylist(playlist.id)}
                                    className="text-[10px] font-retro uppercase tracking-widest text-neon/cyan-400 hover:text-neon/cyan-300"
                                  >
                                    Select All
                                  </button>
                                </div>
                              )}

                              {tracksInPlaylist.map((track) => {
                                const isSelected = selectedTrackIds.has(track.id);
                                const isImporting = importingIds.has(track.id);
                                const hasPreview = !!track.previewUrl;

                                return (
                                  <div
                                    key={track.id}
                                    onClick={() => toggleTrackSelection(track.id)}
                                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                                      isSelected
                                        ? 'bg-neon/purple-500/20 border border-neon/purple-500/30'
                                        : 'hover:bg-slate-900/50 border border-transparent'
                                    }`}
                                  >
                                    {isImporting ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-neon/pink-400 shrink-0" />
                                    ) : (
                                      <div className="shrink-0">
                                        {isSelected ? (
                                          <CheckSquare size={16} className="text-neon/purple-400" />
                                        ) : (
                                          <Square size={16} className="text-slate-600" />
                                        )}
                                      </div>
                                    )}

                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-mono text-slate-300 truncate">{track.name}</p>
                                      <p className="text-[10px] text-slate-500 truncate">{track.artist}</p>
                                    </div>

                                    <div className="shrink-0 flex items-center gap-1">
                                      {!hasPreview && (
                                        <AlertCircle size={12} className="text-amber-500" title="No preview available" />
                                      )}
                                      {hasPreview && (
                                        <Music size={12} className="text-neon/cyan-500" title="Preview available" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default SpotifySearch;

