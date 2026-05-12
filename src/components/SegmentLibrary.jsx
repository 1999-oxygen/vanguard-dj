import { useState, useEffect } from 'react';
import { Music, Disc3, Zap, Play, Scissors, Waveform } from 'lucide-react';

export default function SegmentLibrary({ onSegmentSelect }) {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ processed: null, trackId: null });
  const [selectedSegment, setSelectedSegment] = useState(null);

  useEffect(() => {
    loadSegments();
  }, [filter]);

  const loadSegments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.processed !== null) params.append('processed', filter.processed);
      if (filter.trackId) params.append('trackId', filter.trackId);
      
      const response = await fetch(`/segments?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setSegments(data.segments);
      }
    } catch (error) {
      console.error('Failed to load segments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSegmentClick = (segment) => {
    setSelectedSegment(segment);
    if (onSegmentSelect) {
      onSegmentSelect(segment);
    }
  };

  const processStemSeparation = async (segmentId) => {
    try {
      const response = await fetch(`/segments/${segmentId}/separate-stems`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        loadSegments();
        alert(`✅ Stems separated for segment ${segmentId}`);
      }
    } catch (error) {
      console.error('Failed to separate stems:', error);
      alert('❌ Stem separation failed');
    }
  };

  const getEnergyColor = (energy) => {
    if (energy > 0.7) return 'text-pink-400';
    if (energy > 0.4) return 'text-cyan-400';
    return 'text-blue-400';
  };

  const getEnergyBg = (energy) => {
    if (energy > 0.7) return 'bg-pink-500/20 border-pink-500/40';
    if (energy > 0.4) return 'bg-cyan-500/20 border-cyan-500/40';
    return 'bg-blue-500/20 border-blue-500/40';
  };

  return (
    <div className="h-full flex flex-col bg-black/40 backdrop-blur-sm border border-cyan-500/30 rounded-lg">
      <div className="p-4 border-b border-cyan-500/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
            <Disc3 className="w-5 h-5" />
            Segment Library
          </h2>
          <button
            onClick={loadSegments}
            className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded text-cyan-400 text-sm transition-colors"
          >
            Refresh
          </button>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setFilter({ ...filter, processed: null })}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter.processed === null
                ? 'bg-cyan-500/30 border border-cyan-500/60 text-cyan-300'
                : 'bg-gray-800/50 border border-gray-700 text-gray-400 hover:bg-gray-800'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter({ ...filter, processed: true })}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter.processed === true
                ? 'bg-green-500/30 border border-green-500/60 text-green-300'
                : 'bg-gray-800/50 border border-gray-700 text-gray-400 hover:bg-gray-800'
            }`}
          >
            Processed
          </button>
          <button
            onClick={() => setFilter({ ...filter, processed: false })}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter.processed === false
                ? 'bg-yellow-500/30 border border-yellow-500/60 text-yellow-300'
                : 'bg-gray-800/50 border border-gray-700 text-gray-400 hover:bg-gray-800'
            }`}
          >
            Unprocessed
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="text-center text-cyan-400 py-8">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading segments...
          </div>
        ) : segments.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No segments found</p>
            <p className="text-sm mt-1">Upload and process tracks to create segments</p>
          </div>
        ) : (
          segments.map((segment) => (
            <div
              key={segment.id}
              onClick={() => handleSegmentClick(segment)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedSegment?.id === segment.id
                  ? 'bg-cyan-500/30 border-cyan-400 shadow-lg shadow-cyan-500/20'
                  : `${getEnergyBg(segment.energy)} hover:bg-cyan-500/10`
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Waveform className={`w-4 h-4 ${getEnergyColor(segment.energy)}`} />
                    <span className="text-sm font-mono text-gray-300">
                      {segment.id}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Track: {segment.track_filename}
                  </div>
                </div>
                
                {segment.processed ? (
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/40 rounded text-xs text-green-400">
                    <Scissors className="w-3 h-3" />
                    Stems Ready
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      processStemSeparation(segment.id);
                    }}
                    className="px-2 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 rounded text-xs text-yellow-400 transition-colors"
                  >
                    Separate Stems
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Time:</span>
                  <span className="text-cyan-300 font-mono">
                    {segment.start_time.toFixed(1)}s - {segment.end_time.toFixed(1)}s
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Duration:</span>
                  <span className="text-cyan-300 font-mono">
                    {segment.duration.toFixed(2)}s
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">BPM:</span>
                  <span className="text-pink-300 font-mono">{segment.bpm}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Key:</span>
                  <span className="text-purple-300 font-mono">{segment.key}</span>
                </div>
              </div>

              <div className="mt-2">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className={`w-3 h-3 ${getEnergyColor(segment.energy)}`} />
                  <span className="text-xs text-gray-500">Energy</span>
                  <span className={`text-xs font-mono ${getEnergyColor(segment.energy)}`}>
                    {(segment.energy * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      segment.energy > 0.7 ? 'bg-pink-500' : segment.energy > 0.4 ? 'bg-cyan-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${segment.energy * 100}%` }}
                  />
                </div>
              </div>

              {segment.stems && segment.stems.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700/50">
                  <div className="flex flex-wrap gap-1">
                    {segment.stems.map((stem) => (
                      <div
                        key={stem.id}
                        className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/40 rounded text-xs text-purple-300"
                      >
                        {stem.stem_type}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
