import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Plus, Trash2, Save, Download, Zap, Music } from 'lucide-react';

export default function MixTimeline({ segments = [] }) {
  const [timeline, setTimeline] = useState([]);
  const [mixName, setMixName] = useState('');
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [mixes, setMixes] = useState([]);
  const timelineRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    loadMixes();
  }, []);

  const loadMixes = async () => {
    try {
      const response = await fetch('http://localhost:8000/mixes');
      const data = await response.json();
      if (data.success) {
        setMixes(data.mixes);
      }
    } catch (error) {
      console.error('Failed to load mixes:', error);
    }
  };

  const addSegmentToTimeline = (segment) => {
    const lastItem = timeline[timeline.length - 1];
    const position = lastItem ? lastItem.position + lastItem.duration - (lastItem.transitionDuration || 2.0) : 0;

    const newItem = {
      id: `timeline_${Date.now()}`,
      segmentId: segment.id,
      segment,
      position,
      duration: segment.duration,
      transitionType: 'crossfade',
      transitionDuration: 2.0,
      stemConfig: {
        vocals: 1.0,
        drums: 1.0,
        bass: 1.0,
        other: 1.0
      }
    };

    setTimeline([...timeline, newItem]);
  };

  const removeFromTimeline = (itemId) => {
    setTimeline(timeline.filter(item => item.id !== itemId));
    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
    }
  };

  const updateTimelineItem = (itemId, updates) => {
    setTimeline(timeline.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ));
  };

  const createMix = async () => {
    if (timeline.length === 0) {
      alert('Add segments to timeline first');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/mixes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mixName || `Mix ${new Date().toLocaleString()}`,
          timeline: timeline.map(item => ({
            segmentId: item.segmentId,
            position: item.position,
            duration: item.duration,
            transitionType: item.transitionType,
            transitionDuration: item.transitionDuration,
            stemConfig: item.stemConfig
          }))
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Mix created successfully!\nID: ${data.mixId}\nDuration: ${data.duration.toFixed(2)}s`);
        loadMixes();
        setMixName('');
      }
    } catch (error) {
      console.error('Failed to create mix:', error);
      alert('❌ Failed to create mix');
    }
  };

  const loadMix = async (mixId) => {
    try {
      const response = await fetch(`http://localhost:8000/mixes/${mixId}`);
      const data = await response.json();
      
      if (data.success) {
        const loadedTimeline = data.mix.timeline.map((item, idx) => ({
          id: `timeline_${Date.now()}_${idx}`,
          segmentId: item.segment_id,
          segment: {
            id: item.segment_id,
            duration: item.segment_duration,
            energy: item.energy,
            bpm: item.bpm,
            key: item.key
          },
          position: item.position,
          duration: item.duration,
          transitionType: item.transition_type,
          transitionDuration: item.transition_duration,
          stemConfig: JSON.parse(item.stem_config || '{}')
        }));
        
        setTimeline(loadedTimeline);
        setMixName(data.mix.name);
      }
    } catch (error) {
      console.error('Failed to load mix:', error);
    }
  };

  const getTotalDuration = () => {
    if (timeline.length === 0) return 0;
    let total = 0;
    timeline.forEach((item, idx) => {
      total += item.duration;
      if (idx < timeline.length - 1 && item.transitionType !== 'cut') {
        total -= item.transitionDuration;
      }
    });
    return total;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getEnergyColor = (energy) => {
    if (energy > 0.7) return 'bg-pink-500';
    if (energy > 0.4) return 'bg-cyan-500';
    return 'bg-blue-500';
  };

  return (
    <div className="h-full flex flex-col bg-black/40 backdrop-blur-sm border border-cyan-500/30 rounded-lg">
      <div className="p-4 border-b border-cyan-500/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
            <Music className="w-5 h-5" />
            Mix Timeline
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">
              Duration: <span className="text-cyan-400 font-mono">{formatTime(getTotalDuration())}</span>
            </span>
            <span className="text-sm text-gray-400">
              Segments: <span className="text-cyan-400 font-mono">{timeline.length}</span>
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={mixName}
            onChange={(e) => setMixName(e.target.value)}
            placeholder="Mix name..."
            className="flex-1 px-3 py-2 bg-black/50 border border-cyan-500/30 rounded text-cyan-300 placeholder-gray-600 focus:outline-none focus:border-cyan-500/60"
          />
          <button
            onClick={createMix}
            disabled={timeline.length === 0}
            className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded text-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Create Mix
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {timeline.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <Plus className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Timeline is empty</p>
            <p className="text-sm mt-1">Select segments from the library to add them</p>
          </div>
        ) : (
          <div className="space-y-2">
            {timeline.map((item, idx) => (
              <div key={item.id} className="relative">
                <div
                  onClick={() => setSelectedItem(item)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedItem?.id === item.id
                      ? 'bg-cyan-500/30 border-cyan-400 shadow-lg shadow-cyan-500/20'
                      : 'bg-black/50 border-cyan-500/20 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-500">#{idx + 1}</span>
                        <span className="text-sm font-mono text-cyan-300">
                          {item.segment?.id || item.segmentId}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        Position: {formatTime(item.position)} | Duration: {item.duration.toFixed(2)}s
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromTimeline(item.id);
                      }}
                      className="p-1 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {item.segment && (
                    <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                      <div>
                        <span className="text-gray-500">BPM:</span>
                        <span className="text-pink-300 font-mono ml-1">{item.segment.bpm}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Key:</span>
                        <span className="text-purple-300 font-mono ml-1">{item.segment.key}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Energy:</span>
                        <span className="text-cyan-300 font-mono ml-1">
                          {(item.segment.energy * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    <select
                      value={item.transitionType}
                      onChange={(e) => updateTimelineItem(item.id, { transitionType: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 px-2 py-1 bg-black/50 border border-cyan-500/30 rounded text-xs text-cyan-300 focus:outline-none focus:border-cyan-500/60"
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
                        onClick={(e) => e.stopPropagation()}
                        min="0.5"
                        max="10"
                        step="0.5"
                        className="w-20 px-2 py-1 bg-black/50 border border-cyan-500/30 rounded text-xs text-cyan-300 focus:outline-none focus:border-cyan-500/60"
                      />
                    )}
                  </div>

                  {item.segment && (
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${getEnergyColor(item.segment.energy)}`}
                        style={{ width: `${item.segment.energy * 100}%` }}
                      />
                    </div>
                  )}
                </div>

                {idx < timeline.length - 1 && (
                  <div className="flex items-center justify-center py-1">
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

      {mixes.length > 0 && (
        <div className="p-4 border-t border-cyan-500/30">
          <h3 className="text-sm font-bold text-cyan-400 mb-2">Saved Mixes</h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {mixes.map((mix) => (
              <div
                key={mix.id}
                onClick={() => loadMix(mix.id)}
                className="p-2 bg-black/50 border border-cyan-500/20 hover:border-cyan-500/40 rounded cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cyan-300">{mix.name}</span>
                  <span className="text-xs text-gray-500 font-mono">
                    {formatTime(mix.duration)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 border-t border-cyan-500/30 bg-black/60">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded text-cyan-400 transition-colors"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          
          <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all"
              style={{ width: `${(playbackPosition / getTotalDuration()) * 100}%` }}
            />
          </div>
          
          <span className="text-sm text-gray-400 font-mono min-w-[60px] text-right">
            {formatTime(playbackPosition)}
          </span>
        </div>
      </div>
    </div>
  );
}

export { addSegmentToTimeline as addToTimeline };
