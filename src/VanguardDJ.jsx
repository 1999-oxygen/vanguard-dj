import { useState, useEffect, useRef } from 'react';
import { 
  Upload, Music, Scissors, Zap, Play, Pause, Download, 
  Trash2, Save, Plus, Settings, Volume2, Disc3, AudioWaveform,
  Clock, Activity, Database, CheckCircle, AlertCircle, Loader
} from 'lucide-react';

// Ensure we're using the correct API URL
const API_BASE = import.meta.env.VITE_API_URL || '';

export default function VanguardDJ() {
  const [activeView, setActiveView] = useState('upload');
  const [tracks, setTracks] = useState([]);
  const [segments, setSegments] = useState([]);
  const [mixes, setMixes] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [mixName, setMixName] = useState('');
  const [backendConnected, setBackendConnected] = useState(false);
  const [analysisMethods, setAnalysisMethods] = useState([]);
  const [currentTrackAnalysis, setCurrentTrackAnalysis] = useState(null);
  const [mixMode, setMixMode] = useState('intelligent'); // 'intelligent', 'random', 'hybrid'
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [reprocessProgress, setReprocessProgress] = useState(null);
  const [selectedSegments, setSelectedSegments] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [segmentSearch, setSegmentSearch] = useState('');
  const [mixSearch, setMixSearch] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    checkBackendConnection();
    loadTracks();
    loadSegments();
    loadMixes();
  }, []);

  const checkBackendConnection = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        setBackendConnected(true);
        console.log('✅ Backend connected:', API_BASE);
      } else {
        setBackendConnected(false);
        showNotification('⚠️ Backend not responding', 'error');
      }
    } catch (error) {
      setBackendConnected(false);
      showNotification(`❌ Cannot connect to backend at ${API_BASE}`, 'error');
      console.error('Backend connection error:', error);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadTracks = async () => {
    try {
      const res = await fetch(`${API_BASE}/tracks`);
      const data = await res.json();
      if (data.success) setTracks(data.tracks);
    } catch (error) {
      console.error('Failed to load tracks:', error);
    }
  };

  const loadSegments = async () => {
    try {
      const res = await fetch(`${API_BASE}/segments`);
      const data = await res.json();
      if (data.success) setSegments(data.segments);
    } catch (error) {
      console.error('Failed to load segments:', error);
    }
  };

  const loadMixes = async () => {
    try {
      const res = await fetch(`${API_BASE}/mixes`);
      const data = await res.json();
      if (data.success) setMixes(data.mixes);
    } catch (error) {
      console.error('Failed to load mixes:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch(`${API_BASE}/tracks/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        
        if (data.success) {
          showNotification(`✅ Uploaded: ${file.name}`);
          loadTracks();
        }
      } catch (error) {
        showNotification(`❌ Upload failed: ${file.name}`, 'error');
      }
    }
    setProcessing(false);
  };

  const processTrack = async (trackId) => {
    setProcessing(true);
    showNotification('🔄 Running 10 industry-leading analysis methods...', 'info');
    
    try {
      const res = await fetch(`${API_BASE}/tracks/${trackId}/process`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (data.success) {
        // Store analysis results
        setAnalysisMethods(data.analysisResults.methods);
        setCurrentTrackAnalysis({
          trackId,
          methodsUsed: data.analysisResults.methodsUsed,
          totalMethods: data.analysisResults.totalMethods,
          successRate: data.analysisResults.successRate,
          bpm: data.bpm,
          key: data.key
        });
        
        const successCount = data.analysisResults.methodsUsed;
        const totalCount = data.analysisResults.totalMethods;
        
        showNotification(`✅ Analysis complete! ${successCount}/${totalCount} methods successful - Created ${data.segmentCount} segments`);
        await loadTracks();
        await loadSegments();
        
        // Auto-switch to segments view to show results
        setActiveView('segments');
        
        // Suggest creating a mix
        setTimeout(() => {
          showNotification(`💡 Tip: Click "Auto-Create Mix" to combine all segments`, 'info');
        }, 2000);
      } else {
        showNotification(`❌ Processing failed: ${data.error}`, 'error');
      }
    } catch (error) {
      showNotification('❌ Processing failed: ' + error.message, 'error');
    }
    setProcessing(false);
  };

  const deleteTrack = async (trackId) => {
    if (!confirm('Are you sure you want to delete this track? This will also delete all associated segments.')) {
      return;
    }
    
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/tracks/${trackId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (data.success) {
        showNotification('✅ Track deleted successfully');
        await loadTracks();
        await loadSegments();
      } else {
        showNotification(`❌ Delete failed: ${data.error}`, 'error');
      }
    } catch (error) {
      showNotification(`❌ Delete failed: ` + error.message, 'error');
    }
    setProcessing(false);
  };

  const deleteAllSegments = async () => {
    if (!confirm('Are you sure you want to delete ALL segments? This cannot be undone.')) {
      return;
    }
    
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/segments`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (data.success) {
        showNotification('✅ All segments deleted successfully');
        await loadSegments();
        setSelectedSegments([]);
      } else {
        showNotification(`❌ Delete failed: ${data.error}`, 'error');
      }
    } catch (error) {
      showNotification(`❌ Delete failed: ` + error.message, 'error');
    }
    setProcessing(false);
  };

  const deleteAllTracks = async () => {
    if (!confirm('Are you sure you want to delete ALL tracks? This will also delete all associated segments and cannot be undone.')) {
      return;
    }
    
    setProcessing(true);
    try {
      // Delete all tracks one by one to ensure proper cleanup
      for (const track of tracks) {
        await fetch(`${API_BASE}/tracks/${track.id}`, {
          method: 'DELETE'
        });
      }
      
      showNotification('✅ All tracks deleted successfully');
      await loadTracks();
      await loadSegments();
    } catch (error) {
      showNotification(`❌ Delete failed: ` + error.message, 'error');
    }
    setProcessing(false);
  };

  const deleteMix = async (mixId) => {
    if (!confirm('Are you sure you want to delete this mix?')) {
      return;
    }
    
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/mixes/${mixId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (data.success) {
        showNotification('✅ Mix deleted successfully');
        await loadMixes();
      } else {
        showNotification(`❌ Delete failed: ${data.error}`, 'error');
      }
    } catch (error) {
      showNotification(`❌ Delete failed: ` + error.message, 'error');
    }
    setProcessing(false);
  };

  const createMixFromSelected = async () => {
    if (selectedSegments.length < 2) {
      showNotification('⚠️ Select at least 2 segments to create a mix', 'warning');
      return;
    }
    
    const selectedSegmentsData = segments.filter(seg => selectedSegments.includes(seg.id));
    
    if (!confirm(`Create a mix from ${selectedSegmentsData.length} selected segments?`)) {
      return;
    }
    
    setProcessing(true);
    try {
      const timeline = selectedSegmentsData.map(seg => ({
        segmentId: seg.id,
        audioPath: seg.audio_path,
        duration: seg.duration,
        startTime: seg.start_time || 0,
        transitionType: 'crossfade',
        transitionDuration: 2,
        fadeIn: 1,
        fadeOut: 2
      }));
      
      const mixName = `Custom Mix ${new Date().toLocaleTimeString()}`;
      
      const res = await fetch(`${API_BASE}/mixes/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mixName,
          timeline: timeline,
          mode: 'intelligent'
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        showNotification(`✅ Mix created: ${mixName} with ${selectedSegmentsData.length} segments`);
        await loadMixes();
        setActiveView('mixes');
        setSelectedSegments([]);
      } else {
        showNotification(`❌ Mix creation failed: ${data.error}`, 'error');
      }
    } catch (error) {
      showNotification(`❌ Mix creation failed: ` + error.message, 'error');
    }
    setProcessing(false);
  };

  const processAllTracks = async () => {
    const unprocessedTracks = tracks.filter(track => !track.processed);
    
    if (unprocessedTracks.length === 0) {
      showNotification('✅ All tracks already processed!', 'info');
      return;
    }
    
    setProcessing(true);
    showNotification(`🔄 Processing ${unprocessedTracks.length} tracks...`, 'info');
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < unprocessedTracks.length; i++) {
      const track = unprocessedTracks[i];
      
      try {
        showNotification(`🔄 Processing ${i + 1}/${unprocessedTracks.length}: ${track.filename}`, 'info');
        
        const res = await fetch(`${API_BASE}/tracks/${track.id}/process`, {
          method: 'POST'
        });
        const data = await res.json();
        
        if (data.success) {
          successCount++;
          console.log(`✅ Processed: ${track.filename}`);
        } else {
          failCount++;
          console.error(`❌ Failed: ${track.filename} - ${data.error}`);
        }
      } catch (error) {
        failCount++;
        console.error(`❌ Error processing ${track.filename}:`, error);
      }
    }
    
    await loadTracks();
    await loadSegments();
    
    if (successCount > 0) {
      showNotification(`✅ Processed ${successCount} tracks successfully! ${failCount > 0 ? `(${failCount} failed)` : ''}`);
      setActiveView('segments');
      
      setTimeout(() => {
        showNotification(`💡 Tip: Click "Auto-Create Mix" to combine all segments`, 'info');
      }, 2000);
    } else {
      showNotification(`❌ All tracks failed to process`, 'error');
    }
    
    setProcessing(false);
  };

  const processSelectedTracks = async () => {
    const selectedUnprocessedTracks = tracks.filter(track => 
      selectedTracks.includes(track.id) && !track.processed
    );
    
    if (selectedUnprocessedTracks.length === 0) {
      showNotification('⚠️ No unprocessed tracks selected', 'warning');
      return;
    }
    
    setProcessing(true);
    showNotification(`🔄 Processing ${selectedUnprocessedTracks.length} selected tracks...`, 'info');
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < selectedUnprocessedTracks.length; i++) {
      const track = selectedUnprocessedTracks[i];
      
      try {
        showNotification(`🔄 Processing ${i + 1}/${selectedUnprocessedTracks.length}: ${track.filename}`, 'info');
        
        const res = await fetch(`${API_BASE}/tracks/${track.id}/process`, {
          method: 'POST'
        });
        const data = await res.json();
        
        if (data.success) {
          successCount++;
          console.log(`✅ Processed: ${track.filename}`);
        } else {
          failCount++;
          console.error(`❌ Failed: ${track.filename} - ${data.error}`);
        }
      } catch (error) {
        failCount++;
        console.error(`❌ Error processing ${track.filename}:`, error);
      }
    }
    
    await loadTracks();
    await loadSegments();
    
    if (successCount > 0) {
      showNotification(`✅ Processed ${successCount} selected tracks successfully! ${failCount > 0 ? `(${failCount} failed)` : ''}`);
      setActiveView('segments');
      
      setTimeout(() => {
        showNotification(`💡 Tip: Click "Auto-Create Mix" to combine all segments`, 'info');
      }, 2000);
    }
    
    setProcessing(false);
  };

  const autoCreateMix = async () => {
    if (segments.length < 5) {
      showNotification('❌ Need at least 5 segments to create a mix', 'error');
      return;
    }

    setProcessing(true);
    showNotification('🎵 Creating intelligent auto-mix...', 'info');

    try {
      // Use new intelligent auto-mix endpoint (server-side, no payload issues)
      const res = await fetch(`${API_BASE}/mixes/create-auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Auto Mix ${new Date().toLocaleTimeString()}`,
          targetDuration: 300, // 5 minutes
          energyProfile: 'wave', // wave pattern for dynamic energy
          options: {
            minSegments: 20,
            maxSegments: 50,
            allowKeyChanges: true,
            maxBpmDiff: 6
          }
        })
      });

      const data = await res.json();
      
      if (data.success) {
        const mins = Math.floor(data.duration / 60);
        const secs = Math.floor(data.duration % 60);
        showNotification(
          `✨ Intelligent mix created! ${data.segments} segments, ${mins}:${secs.toString().padStart(2, '0')}, Harmony: ${data.metadata?.harmonyScore || 'N/A'}`,
          'success'
        );
        await loadMixes();
        setActiveView('mixes');
      } else {
        showNotification(`❌ Mix creation failed: ${data.error}`, 'error');
      }
    } catch (error) {
      showNotification('❌ Error creating mix', 'error');
      console.error(error);
    }
    
    setProcessing(false);
  };

  const createMixFromTimeline = async (timelineToUse = timeline) => {
    if (timelineToUse.length === 0 && mixMode !== 'flawless') {
      showNotification('Add segments to timeline first', 'error');
      return;
    }

    setProcessing(true);
    
    try {
      // Flawless mode uses a different endpoint
      if (mixMode === 'flawless') {
        showNotification('� Creating flawless mix with ML connector... This may take a while for optimal results.', 'info');
        
        const res = await fetch(`${API_BASE}/mixes/create-flawless`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: mixName || `Flawless Mix ${new Date().toLocaleTimeString()}`,
            targetDuration: null, // unlimited
            minSegments: 50,
            maxSegments: null, // unlimited
            energyProfile: 'narrative',
            allowKeyChanges: true,
            maxBpmDiff: 10
          })
        });

        const data = await res.json();
        
        if (data.success) {
          showNotification(`✅ Flawless mix created! ${data.metadata.segmentCount} segments, ${formatTime(data.duration)} - Avg compatibility: ${data.metadata.avgCompatibility.toFixed(1)}%`);
          await loadMixes();
          setMixName('');
          setActiveView('mixes');
          
          setTimeout(() => {
            const audioElement = document.querySelector(`audio[data-mix-id="${data.mixId}"]`);
            if (audioElement) {
              audioElement.play().catch(err => {
                console.log('Auto-play blocked by browser:', err);
                showNotification('Mix ready! Click play to listen', 'info');
              });
            }
          }, 500);
        }
      } else {
        // Regular mix modes
        showNotification('🎛️ Rendering mix with transitions...', 'info');
        
        const res = await fetch(`${API_BASE}/mixes/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: mixName || `${mixMode.toUpperCase()} Mix ${new Date().toLocaleTimeString()}`,
            mode: mixMode,
            timeline: timelineToUse.map(item => ({
              segmentId: item.segmentId,
              position: item.position,
              duration: item.duration,
              transitionType: item.transitionType,
              transitionDuration: item.transitionDuration,
              stemConfig: { vocals: 1.0, drums: 1.0, bass: 1.0, other: 1.0 }
            }))
          })
        });

        const data = await res.json();
        
        if (data.success) {
          showNotification(`✅ Mix created! Duration: ${formatTime(data.duration)} - Ready to play!`);
          await loadMixes();
          setMixName('');
          setActiveView('mixes');
          
          setTimeout(() => {
            const audioElement = document.querySelector(`audio[data-mix-id="${data.mixId}"]`);
            if (audioElement) {
              audioElement.play().catch(err => {
                console.log('Auto-play blocked by browser:', err);
                showNotification('Mix ready! Click play to listen', 'info');
              });
            }
          }, 500);
        }
      }
    } catch (error) {
      showNotification('❌ Mix creation failed: ' + error.message, 'error');
      console.error('Mix creation error:', error);
    }
    setProcessing(false);
  };

  const separateStems = async (segmentId) => {
    setProcessing(true);
    try {
      const res = await fetch(`${API_BASE}/segments/${segmentId}/separate-stems`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (data.success) {
        showNotification('✅ Stems separated successfully');
        loadSegments();
      }
    } catch (error) {
      showNotification('❌ Stem separation failed', 'error');
    }
    setProcessing(false);
  };

  const addToTimeline = (segment) => {
    const lastItem = timeline[timeline.length - 1];
    const position = lastItem 
      ? lastItem.position + lastItem.duration - 2.0 
      : 0;

    setTimeline([...timeline, {
      id: `timeline_${Date.now()}`,
      segmentId: segment.id,
      segment,
      position,
      duration: segment.duration,
      transitionType: 'crossfade',
      transitionDuration: 2.0
    }]);
    showNotification(`Added ${segment.id} to timeline`);
  };

  const removeFromTimeline = (itemId) => {
    setTimeline(timeline.filter(item => item.id !== itemId));
  };

  const updateTimelineItem = (itemId, updates) => {
    setTimeline(timeline.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ));
  };

  const createMix = async () => {
    await createMixFromTimeline();
  };

  const toggleTrackSelection = (trackId) => {
    setSelectedTracks(prev => 
      prev.includes(trackId) 
        ? prev.filter(id => id !== trackId)
        : [...prev, trackId]
    );
  };

  const selectAllTracks = () => {
    setSelectedTracks(tracks.map(t => t.id));
  };

  const deselectAllTracks = () => {
    setSelectedTracks([]);
  };

  const reprocessSelectedTracks = async () => {
    if (selectedTracks.length === 0) {
      showNotification('Please select tracks to reprocess', 'error');
      return;
    }

    setProcessing(true);
    setReprocessProgress({ current: 0, total: selectedTracks.length, results: [] });
    
    try {
      const res = await fetch(`${API_BASE}/tracks/reprocess-batch-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackIds: selectedTracks,
          options: {
            strict_validation: true,
            export_ml: true,
            ml_formats: ['json', 'csv']
          }
        })
      });

      const data = await res.json();

      if (data.success) {
        showNotification(
          `✅ Reprocessed ${data.successful}/${data.total} tracks with v2.0 engine!`,
          'success'
        );
        setReprocessProgress({
          current: data.total,
          total: data.total,
          results: data.results
        });
        
        // Reload tracks and segments
        await loadTracks();
        await loadSegments();
        
        // Clear selection
        setSelectedTracks([]);
      } else {
        showNotification(`❌ Reprocessing failed: ${data.error}`, 'error');
      }
    } catch (error) {
      showNotification('❌ Reprocessing error', 'error');
      console.error(error);
    }
    
    setProcessing(false);
  };

  const toggleSegmentSelection = (segmentId) => {
    setSelectedSegments(prev => 
      prev.includes(segmentId) 
        ? prev.filter(id => id !== segmentId)
        : [...prev, segmentId]
    );
  };

  const selectAllSegments = () => {
    setSelectedSegments(segments.map(s => s.id));
  };

  const deselectAllSegments = () => {
    setSelectedSegments([]);
  };

  const deleteSelectedSegments = async () => {
    if (selectedSegments.length === 0) {
      showNotification('Please select segments to delete', 'error');
      return;
    }

    setShowDeleteConfirm(false);
    setProcessing(true);
    
    try {
      const res = await fetch(`${API_BASE}/segments/delete-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentIds: selectedSegments })
      });

      const data = await res.json();

      if (data.success) {
        showNotification(
          `✅ Deleted ${data.deleted}/${data.total} segments!`,
          'success'
        );
        
        // Reload segments
        await loadSegments();
        
        // Clear selection
        setSelectedSegments([]);
      } else {
        showNotification(`❌ Delete failed: ${data.error}`, 'error');
      }
    } catch (error) {
      showNotification('❌ Delete error', 'error');
      console.error(error);
    }
    
    setProcessing(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEnergyColor = (energy) => {
    if (energy > 0.7) return 'from-pink-500 to-red-500';
    if (energy > 0.4) return 'from-cyan-500 to-blue-500';
    return 'from-blue-500 to-indigo-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg border ${
          notification.type === 'error' 
            ? 'bg-red-500/20 border-red-500/50 text-red-300' 
            : notification.type === 'info'
            ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
            : 'bg-green-500/20 border-green-500/50 text-green-300'
        } animate-slide-in`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-cyan-500/30 bg-black/40 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-pink-500 bg-clip-text text-transparent">
                Vanguard DJ
              </h1>
              <p className="text-sm text-gray-400 mt-1">Professional Audio Mixing Studio</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                backendConnected 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  backendConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                }`} />
                <span className={`text-sm ${
                  backendConnected ? 'text-green-300' : 'text-red-300'
                }`}>
                  {backendConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <Database className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-cyan-300">{tracks.length} Tracks</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <Scissors className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-purple-300">{segments.length} Segments</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-pink-500/10 border border-pink-500/30 rounded-lg">
                <Disc3 className="w-4 h-4 text-pink-400" />
                <span className="text-sm text-pink-300">{mixes.length} Mixes</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-cyan-500/20 bg-black/20 backdrop-blur-sm sticky top-[73px] z-30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between py-3">
            <div className="flex gap-2">
              {[
                { id: 'upload', label: 'Upload & Process', icon: Upload, step: 1 },
                { id: 'segments', label: 'Segment Library', icon: Scissors, step: 2 },
                { id: 'timeline', label: 'Mix Timeline', icon: Zap, step: 3 },
                { id: 'mixes', label: 'Saved Mixes', icon: Disc3, step: 4 }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all relative ${
                    activeView === tab.id
                      ? 'bg-cyan-500/30 border-2 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/20'
                      : 'bg-black/40 border border-cyan-500/20 text-gray-400 hover:bg-black/60 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="absolute -top-2 -left-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold">
                    {tab.step}
                  </div>
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
            
            {processing && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/40 rounded-lg">
                <Loader className="w-4 h-4 text-blue-400 animate-spin" />
                <span className="text-sm text-blue-300">Processing...</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Upload & Process View */}
        {activeView === 'upload' && (
          <div className="space-y-6">
            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-cyan-400 mb-6 flex items-center gap-2">
                <Upload className="w-6 h-6" />
                Upload Tracks
              </h2>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-cyan-500/40 rounded-xl p-16 text-center cursor-pointer hover:border-cyan-500/60 hover:bg-cyan-500/5 transition-all group"
              >
                <Upload className="w-20 h-20 mx-auto mb-4 text-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                <p className="text-xl text-cyan-300 mb-2">Click to upload audio files</p>
                <p className="text-sm text-gray-500">WAV, MP3, FLAC, M4A, OGG supported</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {tracks.length > 0 && (
              <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-cyan-400">Uploaded Tracks</h3>
                  <div className="flex gap-3">
                    {tracks.some(t => !t.processed) && (
                      <button
                        onClick={processAllTracks}
                        disabled={processing}
                        className="px-6 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 border border-cyan-500/40 rounded-lg text-cyan-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {processing ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Processing All...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            Process All ({tracks.filter(t => !t.processed).length})
                          </>
                        )}
                      </button>
                    )}
                    {selectedTracks.length > 0 && tracks.filter(t => selectedTracks.includes(t.id) && !t.processed).length > 0 && (
                      <button
                        onClick={processSelectedTracks}
                        disabled={processing}
                        className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/40 rounded-lg text-purple-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {processing ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Scissors className="w-4 h-4" />
                            Process Selected ({tracks.filter(t => selectedTracks.includes(t.id) && !t.processed).length})
                          </>
                        )}
                      </button>
                    )}
                    {tracks.length > 0 && (
                      <button
                        onClick={deleteAllTracks}
                        disabled={processing}
                        className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete All Tracks
                      </button>
                    )}
                  </div>
                </div>

                {/* Batch Reprocessing Controls */}
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-purple-400" />
                      <h3 className="text-lg font-bold text-purple-400">
                        Batch Reprocess with v2.0 Engine
                      </h3>
                    </div>
                    <div className="text-sm text-gray-400">
                      {selectedTracks.length} of {tracks.length} selected
                    </div>
                  </div>
                  
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={selectAllTracks}
                      className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded-lg text-purple-300 transition-colors text-sm"
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAllTracks}
                      className="px-4 py-2 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/40 rounded-lg text-gray-300 transition-colors text-sm"
                    >
                      Deselect All
                    </button>
                    <button
                      onClick={reprocessSelectedTracks}
                      disabled={processing || selectedTracks.length === 0}
                      className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-500/20"
                    >
                      {processing ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Reprocessing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Reprocess Selected ({selectedTracks.length})
                        </>
                      )}
                    </button>
                  </div>

                  {reprocessProgress && (
                    <div className="mt-4 p-3 bg-black/40 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300">Progress</span>
                        <span className="text-sm text-cyan-400 font-mono">
                          {reprocessProgress.current}/{reprocessProgress.total}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                          style={{ width: `${(reprocessProgress.current / reprocessProgress.total) * 100}%` }}
                        />
                      </div>
                      {reprocessProgress.results.length > 0 && (
                        <div className="mt-2 text-xs text-gray-400">
                          Last: {reprocessProgress.results[reprocessProgress.results.length - 1]?.trackId} - 
                          {reprocessProgress.results[reprocessProgress.results.length - 1]?.success 
                            ? ` ✓ ${reprocessProgress.results[reprocessProgress.results.length - 1]?.segmentCount} segments`
                            : ' ✗ Failed'
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {tracks.map(track => (
                    <div
                      key={track.id}
                      className="p-4 bg-black/50 border border-cyan-500/20 rounded-lg hover:border-cyan-500/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        {/* Selection Checkbox */}
                        <div className="flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={selectedTracks.includes(track.id)}
                            onChange={() => toggleTrackSelection(track.id)}
                            className="w-5 h-5 rounded border-2 border-purple-500 bg-transparent checked:bg-purple-500 cursor-pointer accent-purple-500"
                          />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Music className="w-5 h-5 text-cyan-400" />
                            <span className="text-lg text-cyan-300 font-medium">{track.filename}</span>
                          </div>
                          <div className="flex gap-4 text-sm text-gray-400">
                            <span>Duration: {track.duration?.toFixed(2)}s</span>
                            {track.bpm && <span>BPM: {track.bpm}</span>}
                            {track.key && <span>Key: {track.key}</span>}
                            <span>Sample Rate: {track.sample_rate}Hz</span>
                          </div>
                          {track.processed && (
                            <div className="mt-2 flex items-center gap-2 text-green-400 text-sm">
                              <CheckCircle className="w-4 h-4" />
                              Processed - Ready for mixing
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!track.processed ? (
                            <button
                              onClick={() => processTrack(track.id)}
                              disabled={processing}
                              className="px-6 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-lg text-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {processing ? (
                                <>
                                  <Loader className="w-4 h-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <Scissors className="w-4 h-4" />
                                  Process Track
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="px-6 py-2 bg-green-500/20 border border-green-500/40 rounded-lg text-green-400 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              Ready
                            </div>
                          )}
                          <button
                            onClick={() => deleteTrack(track.id)}
                            disabled={processing}
                            className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            title="Delete track"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analysis Methods Display */}
            {analysisMethods.length > 0 && currentTrackAnalysis && (
              <div className="bg-black/40 backdrop-blur-sm border border-purple-500/30 rounded-xl p-6 mt-6">
                <h3 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Analysis Methods ({currentTrackAnalysis.methodsUsed}/{currentTrackAnalysis.totalMethods} Successful)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {analysisMethods.map((method, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        method.success
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-red-500/10 border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          method.success
                            ? 'border-green-500 bg-green-500/20'
                            : 'border-red-500 bg-red-500/20'
                        }`}>
                          {method.success ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <span className="text-red-400 text-xs font-bold">✕</span>
                          )}
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${
                            method.success ? 'text-green-300' : 'text-red-300'
                          }`}>
                            {method.name.replace(/_/g, ' ')}
                          </div>
                          {method.success && method.confidence && (
                            <div className="text-xs text-gray-400">
                              Confidence: {(method.confidence * 100).toFixed(0)}%
                            </div>
                          )}
                          {!method.success && method.error && (
                            <div className="text-xs text-red-400/70">
                              {method.error}
                            </div>
                          )}
                        </div>
                      </div>
                      {method.success && method.bpm && (
                        <div className="text-xs text-cyan-400 font-mono">
                          {method.bpm.toFixed(1)} BPM
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">{currentTrackAnalysis.bpm.toFixed(1)}</div>
                    <div className="text-xs text-gray-400">Average BPM</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">{currentTrackAnalysis.key}</div>
                    <div className="text-xs text-gray-400">Musical Key</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">{(currentTrackAnalysis.successRate * 100).toFixed(0)}%</div>
                    <div className="text-xs text-gray-400">Success Rate</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Segments View */}
        {activeView === 'segments' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                    <Scissors className="w-6 h-6" />
                    Segment Library
                  </h2>
                  {segments.length > 0 && (
                    <button
                      onClick={autoCreateMix}
                      disabled={processing}
                      className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-cyan-500/20"
                    >
                      <Zap className="w-4 h-4" />
                      {processing ? 'Creating...' : 'Auto-Create Mix'}
                    </button>
                  )}
                </div>

                {segments.length > 0 && (
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Search segments by name, key, BPM..."
                      value={segmentSearch}
                      onChange={(e) => setSegmentSearch(e.target.value)}
                      className="w-full px-4 py-2 bg-black/50 border border-cyan-500/30 rounded-lg text-cyan-300 placeholder-gray-500 focus:outline-none focus:border-cyan-500/60"
                    />
                  </div>
                )}

                {segments.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <Scissors className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">No segments yet</p>
                    <p className="text-sm mt-2">Upload and process tracks to create segments</p>
                  </div>
                ) : (
                  <>
                    {/* Batch Delete Controls */}
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Trash2 className="w-5 h-5 text-red-400" />
                          <h3 className="text-lg font-bold text-red-400">
                            Segment Management
                          </h3>
                        </div>
                        <div className="text-sm text-gray-400">
                          {selectedSegments.length} of {segments.length} selected
                        </div>
                      </div>
                      
                      <div className="flex gap-3 flex-wrap">
                        <button
                          onClick={selectAllSegments}
                          className="px-4 py-2 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/40 rounded-lg text-gray-300 transition-colors text-sm"
                        >
                          Select All
                        </button>
                        <button
                          onClick={deselectAllSegments}
                          className="px-4 py-2 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/40 rounded-lg text-gray-300 transition-colors text-sm"
                        >
                          Deselect All
                        </button>
                        <button
                          onClick={deleteAllSegments}
                          disabled={processing}
                          className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete All Segments
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          disabled={processing || selectedSegments.length === 0}
                          className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Selected ({selectedSegments.length})
                        </button>
                        <button
                          onClick={createMixFromSelected}
                          disabled={processing || selectedSegments.length < 2}
                          className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-green-500/20"
                        >
                          <Zap className="w-4 h-4" />
                          Create Mix from Selected ({selectedSegments.length})
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                      {segments
                        .filter(segment => {
                          // Filter out invalid segments (must have audio path, duration, and valid type)
                          const isValid = segment.audio_path && 
                                          segment.duration && 
                                          segment.segment_type &&
                                          segment.segment_type !== 'INVALID' &&
                                          segment.segment_type !== 'CORRUPTED';
                          if (!isValid) return false;

                          // Search filter
                          if (!segmentSearch) return true;
                          const searchLower = segmentSearch.toLowerCase();
                          return (
                            segment.id?.toLowerCase().includes(searchLower) ||
                            segment.track_filename?.toLowerCase().includes(searchLower) ||
                            segment.key?.toLowerCase().includes(searchLower) ||
                            segment.bpm?.toString().includes(searchLower) ||
                            segment.segment_type?.toLowerCase().includes(searchLower)
                          );
                        })
                        .map(segment => (
                      <div
                        key={segment.id}
                        className={`p-4 rounded-lg border transition-all ${
                          selectedSegment?.id === segment.id
                            ? 'bg-cyan-500/20 border-cyan-400 shadow-lg shadow-cyan-500/20'
                            : 'bg-black/50 border-cyan-500/20 hover:border-cyan-500/40'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-3 flex-1" onClick={() => setSelectedSegment(segment)}>
                            <input
                              type="checkbox"
                              checked={selectedSegments.includes(segment.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSegmentSelection(segment.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-5 h-5 mt-1 rounded border-2 border-red-500 bg-transparent checked:bg-red-500 cursor-pointer accent-red-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <AudioWaveform className="w-4 h-4 text-cyan-400" />
                                <span className="text-sm font-mono text-cyan-300">{segment.id}</span>
                              </div>
                              <div className="text-xs text-gray-400">{segment.track_filename}</div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {segment.processed ? (
                              <div className="px-2 py-1 bg-green-500/20 border border-green-500/40 rounded text-xs text-green-400 flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Stems Ready
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  separateStems(segment.id);
                                }}
                                className="px-2 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 rounded text-xs text-yellow-400 transition-colors"
                              >
                                Separate Stems
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToTimeline(segment);
                              }}
                              className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded text-xs text-purple-400 transition-colors flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add to Mix
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                          <div>
                            <span className="text-gray-500">Time:</span>
                            <span className="text-cyan-300 ml-1 font-mono">
                              {segment.start_time.toFixed(1)}s
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Duration:</span>
                            <span className="text-cyan-300 ml-1 font-mono">
                              {segment.duration.toFixed(2)}s
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">BPM:</span>
                            <span className="text-pink-300 ml-1 font-mono">{segment.bpm}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Key:</span>
                            <span className="text-purple-300 ml-1 font-mono">{segment.key}</span>
                          </div>
                        </div>

                        {/* New: Segment Type and Characteristics */}
                        {segment.segment_type && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            <div className={`px-2 py-1 rounded text-xs font-medium ${
                              segment.segment_type === 'DROP' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                              segment.segment_type === 'PEAK' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                              segment.segment_type === 'BUILD' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                              'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                            }`}>
                              {segment.segment_type}
                            </div>
                            {segment.suitable_for && (
                              <div className="px-2 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-xs">
                                {segment.suitable_for}
                              </div>
                            )}
                            {segment.intensity && (
                              <div className="px-2 py-1 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded text-xs">
                                {segment.intensity}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Analysis Method Badge */}
                        {segment.derivation && (
                          <div className="text-xs text-gray-500 mb-2">
                            <span className="opacity-70">Derived from:</span>
                            <span className="ml-1 text-cyan-400 font-mono text-[10px]">
                              {segment.derivation.split(',')[0].replace(/_/g, ' ')}
                              {segment.derivation.split(',').length > 1 && ` +${segment.derivation.split(',').length - 1}`}
                            </span>
                          </div>
                        )}

                        <div className="mb-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-500">Energy</span>
                            <span className="text-cyan-300 font-mono">
                              {(segment.energy * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${getEnergyColor(segment.energy)} transition-all`}
                              style={{ width: `${segment.energy * 100}%` }}
                            />
                          </div>
                        </div>

                        {segment.stems && segment.stems.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-2 border-t border-gray-700/50">
                            {segment.stems.map(stem => (
                              <div
                                key={stem.id}
                                className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/40 rounded text-xs text-purple-300"
                              >
                                {stem.stem_type}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-6 sticky top-32">
                <h3 className="text-xl font-bold text-cyan-400 mb-4">Segment Details</h3>
                {selectedSegment ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                      <div className="text-sm font-mono text-cyan-300 mb-2">{selectedSegment.id}</div>
                      <div className="text-xs text-gray-400">{selectedSegment.track_filename}</div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Start Time:</span>
                        <span className="text-cyan-300 font-mono">{selectedSegment.start_time.toFixed(2)}s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">End Time:</span>
                        <span className="text-cyan-300 font-mono">{selectedSegment.end_time.toFixed(2)}s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Duration:</span>
                        <span className="text-cyan-300 font-mono">{selectedSegment.duration.toFixed(2)}s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">BPM:</span>
                        <span className="text-pink-300 font-mono">{selectedSegment.bpm}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Key:</span>
                        <span className="text-purple-300 font-mono">{selectedSegment.key}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Energy:</span>
                        <span className="text-cyan-300 font-mono">{(selectedSegment.energy * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Danceability:</span>
                        <span className="text-cyan-300 font-mono">{(selectedSegment.danceability * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    {selectedSegment.stems && selectedSegment.stems.length > 0 && (
                      <div className="pt-4 border-t border-gray-700/50">
                        <div className="text-sm font-bold text-purple-400 mb-2">Available Stems</div>
                        <div className="space-y-1">
                          {selectedSegment.stems.map(stem => (
                            <div key={stem.id} className="flex items-center justify-between text-xs">
                              <span className="text-purple-300">{stem.stem_type}</span>
                              <span className="text-gray-500 font-mono">Gain: {stem.gain.toFixed(1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => addToTimeline(selectedSegment)}
                      className="w-full px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded-lg text-purple-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add to Timeline
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Select a segment to view details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Timeline View */}
        {activeView === 'timeline' && (
          <div className="space-y-6">
            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                  <Zap className="w-6 h-6" />
                  Mix Timeline
                </h2>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-400">
                    Duration: <span className="text-cyan-400 font-mono">
                      {formatTime(timeline.reduce((sum, item) => sum + item.duration - (item.transitionDuration || 0), 0))}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">
                    Segments: <span className="text-cyan-400 font-mono">{timeline.length}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={mixName}
                    onChange={(e) => setMixName(e.target.value)}
                    placeholder="Mix name..."
                    className="flex-1 px-4 py-2 bg-black/50 border border-cyan-500/30 rounded-lg text-cyan-300 placeholder-gray-600 focus:outline-none focus:border-cyan-500/60"
                  />
                  <button
                    onClick={createMix}
                    disabled={timeline.length === 0 || processing}
                    className="px-6 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-lg text-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {processing ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Create Mix
                      </>
                    )}
                  </button>
                </div>

                {/* Mix Mode Selector */}
                <div className="flex gap-2 flex-wrap">
                  <div className="text-sm text-gray-400 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Mix Style:
                  </div>
                  <button
                    onClick={() => setMixMode('intelligent')}
                    className={`px-3 py-1 rounded text-xs transition-all ${
                      mixMode === 'intelligent'
                        ? 'bg-cyan-500/30 border border-cyan-500/50 text-cyan-300'
                        : 'bg-black/30 border border-gray-700 text-gray-500 hover:border-cyan-500/30'
                    }`}
                  >
                    🎯 Intelligent
                  </button>
                  <button
                    onClick={() => setMixMode('random')}
                    className={`px-3 py-1 rounded text-xs transition-all ${
                      mixMode === 'random'
                        ? 'bg-purple-500/30 border border-purple-500/50 text-purple-300'
                        : 'bg-black/30 border border-gray-700 text-gray-500 hover:border-purple-500/30'
                    }`}
                  >
                    🎲 Random
                  </button>
                  <button
                    onClick={() => setMixMode('hybrid')}
                    className={`px-3 py-1 rounded text-xs transition-all ${
                      mixMode === 'hybrid'
                        ? 'bg-pink-500/30 border border-pink-500/50 text-pink-300'
                        : 'bg-black/30 border border-gray-700 text-gray-500 hover:border-pink-500/30'
                    }`}
                  >
                    🎨 Hybrid
                  </button>
                  <button
                    onClick={() => setMixMode('flawless')}
                    className={`px-3 py-1 rounded text-xs transition-all ${
                      mixMode === 'flawless'
                        ? 'bg-gradient-to-r from-cyan-500/30 to-purple-500/30 border border-cyan-500/50 text-cyan-300'
                        : 'bg-black/30 border border-gray-700 text-gray-500 hover:border-cyan-500/30'
                    }`}
                  >
                    ✨ Flawless (ML)
                  </button>
                  <div className="text-xs text-gray-600 flex items-center ml-2">
                    {mixMode === 'intelligent' && '(Energy journey: intro → build → peak → outro)'}
                    {mixMode === 'random' && '(Completely unpredictable sequence)'}
                    {mixMode === 'hybrid' && '(70% intelligent + 30% random chaos)'}
                    {mixMode === 'flawless' && '(ML-powered compatibility scoring + unlimited duration)'}
                  </div>
                </div>
              </div>

              {timeline.length === 0 ? (
                <div className="text-center py-16 text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">
                  <Zap className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Timeline is empty</p>
                  <p className="text-sm mt-2">Add segments from the Segment Library</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {timeline.map((item, idx) => (
                    <div key={item.id}>
                      <div className="p-4 bg-black/50 border border-cyan-500/20 rounded-lg hover:border-cyan-500/40 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-gray-500">#{idx + 1}</span>
                              <span className="text-sm font-mono text-cyan-300">{item.segment?.id || item.segmentId}</span>
                            </div>
                            <div className="text-xs text-gray-400">
                              Position: {formatTime(item.position)} | Duration: {item.duration.toFixed(2)}s
                            </div>
                          </div>

                          <button
                            onClick={() => removeFromTimeline(item.id)}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {item.segment && (
                          <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                            <div>
                              <span className="text-gray-500">BPM:</span>
                              <span className="text-pink-300 ml-1 font-mono">{item.segment.bpm}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Key:</span>
                              <span className="text-purple-300 ml-1 font-mono">{item.segment.key}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Energy:</span>
                              <span className="text-cyan-300 ml-1 font-mono">
                                {(item.segment.energy * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <select
                            value={item.transitionType}
                            onChange={(e) => updateTimelineItem(item.id, { transitionType: e.target.value })}
                            className="flex-1 px-3 py-1.5 bg-black/50 border border-cyan-500/30 rounded text-xs text-cyan-300 focus:outline-none focus:border-cyan-500/60"
                          >
                            <option value="crossfade">Crossfade</option>
                            <option value="beatmatch">Beatmatch</option>
                            <option value="echo">Echo</option>
                            <option value="cut">Cut</option>
                          </select>

                          {item.transitionType !== 'cut' && (
                            <input
                              type="number"
                              value={item.transitionDuration}
                              onChange={(e) => updateTimelineItem(item.id, { transitionDuration: parseFloat(e.target.value) })}
                              min="0.5"
                              max="10"
                              step="0.5"
                              className="w-20 px-3 py-1.5 bg-black/50 border border-cyan-500/30 rounded text-xs text-cyan-300 focus:outline-none focus:border-cyan-500/60"
                            />
                          )}
                        </div>

                        {item.segment && (
                          <div className="mt-3 w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${getEnergyColor(item.segment.energy)}`}
                              style={{ width: `${item.segment.energy * 100}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {idx < timeline.length - 1 && (
                        <div className="flex items-center justify-center py-2">
                          <div className="text-xs text-gray-600 flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {item.transitionType} ({item.transitionDuration}s)
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mixes View */}
        {activeView === 'mixes' && (
          <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-cyan-400 mb-6 flex items-center gap-2">
              <Disc3 className="w-6 h-6" />
              Saved Mixes
            </h2>

            {mixes.length === 0 ? (
              <div className="text-center py-16 text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">
                <Disc3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">No mixes yet</p>
                <p className="text-sm mt-2">Create your first mix from the Timeline</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mixes.map(mix => (
                  <div
                    key={mix.id}
                    className="p-5 bg-black/50 border border-cyan-500/20 rounded-lg hover:border-cyan-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-cyan-300 mb-1">{mix.name}</h3>
                        <div className="text-xs text-gray-500 font-mono">{mix.id}</div>
                      </div>
                      <Disc3 className="w-5 h-5 text-pink-400" />
                    </div>

                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Duration:</span>
                        <span className="text-cyan-300 font-mono">{formatTime(mix.duration)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Segments:</span>
                        <span className="text-cyan-300 font-mono">{mix.timeline?.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Created:</span>
                        <span className="text-gray-500 text-xs">
                          {new Date(mix.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Audio Player */}
                    <div className="mb-3">
                      <audio
                        key={mix.id}
                        data-mix-id={mix.id}
                        controls
                        className="w-full"
                        preload="metadata"
                        style={{
                          filter: 'hue-rotate(180deg) saturate(2)',
                          height: '40px'
                        }}
                        onError={(e) => {
                          console.error('Audio error for mix:', mix.id, e);
                          showNotification(`Audio error for ${mix.name}`, 'error');
                        }}
                        onLoadedMetadata={(e) => {
                          console.log('Audio loaded for mix:', mix.id, 'duration:', e.target.duration, 'expected:', mix.duration);
                          if (e.target.duration && Math.abs(e.target.duration - mix.duration) > 5) {
                            console.warn('Duration mismatch detected:', {
                              actual: e.target.duration,
                              expected: mix.duration,
                              difference: Math.abs(e.target.duration - mix.duration)
                            });
                          }
                        }}
                      >
                        <source src={`${API_BASE}/mixes/${mix.id}/audio`} type="audio/wav" />
                        Your browser does not support audio playback.
                      </audio>
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={`${API_BASE}/mixes/${mix.id}/audio`}
                        download={`${mix.name}.wav`}
                        className="flex-1 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-lg text-cyan-400 transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download Mix
                      </a>
                      <button
                        onClick={() => deleteMix(mix.id)}
                        disabled={processing}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 rounded-lg text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        title="Delete mix"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-gray-900 border-2 border-red-500 rounded-xl p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
              <Trash2 className="w-6 h-6" />
              Confirm Delete
            </h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete <strong>{selectedSegments.length}</strong> segment{selectedSegments.length !== 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteSelectedSegments}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
