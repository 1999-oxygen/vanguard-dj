import { useState, useRef } from 'react';
import { Upload, Disc, Scissors, Zap } from 'lucide-react';
import SegmentLibrary from './SegmentLibrary';
import MixTimeline from './MixTimeline';

export default function VanguardDJStudio() {
  const [activeTab, setActiveTab] = useState('upload');
  const [uploadedTracks, setUploadedTracks] = useState([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const timelineRef = useRef(null);

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
      await uploadTrack(file);
    }
  };

  const uploadTrack = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/tracks/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        setUploadedTracks(prev => [...prev, {
          id: data.trackId,
          filename: data.filename,
          metadata: data.metadata,
          processed: false
        }]);
        
        console.log(`✅ Uploaded: ${data.filename}`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`❌ Failed to upload ${file.name}`);
    }
  };

  const processTrack = async (trackId) => {
    setProcessing(true);
    try {
      const response = await fetch(`/tracks/${trackId}/process`, {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.success) {
        setUploadedTracks(prev => prev.map(track => 
          track.id === trackId ? { ...track, processed: true, segmentCount: data.segmentCount } : track
        ));
        
        alert(`✅ Track processed!\n${data.segmentCount} segments created`);
        setActiveTab('segments');
      }
    } catch (error) {
      console.error('Processing failed:', error);
      alert('❌ Track processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleSegmentSelect = (segment) => {
    if (timelineRef.current) {
      timelineRef.current.addSegmentToTimeline(segment);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 mb-2">
            Vanguard DJ Studio
          </h1>
          <p className="text-gray-400">
            Professional DJ mixing with AI-powered segmentation and stem separation
          </p>
        </header>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'upload'
                ? 'bg-cyan-500/30 border-2 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/20'
                : 'bg-black/40 border border-cyan-500/30 text-gray-400 hover:bg-black/60'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload & Process
          </button>
          <button
            onClick={() => setActiveTab('segments')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'segments'
                ? 'bg-cyan-500/30 border-2 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/20'
                : 'bg-black/40 border border-cyan-500/30 text-gray-400 hover:bg-black/60'
            }`}
          >
            <Scissors className="w-4 h-4" />
            Segment Library
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'bg-cyan-500/30 border-2 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/20'
                : 'bg-black/40 border border-cyan-500/30 text-gray-400 hover:bg-black/60'
            }`}
          >
            <Zap className="w-4 h-4" />
            Mix Timeline
          </button>
        </div>

        {activeTab === 'upload' && (
          <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
              <Upload className="w-6 h-6" />
              Upload Tracks
            </h2>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-cyan-500/40 rounded-lg p-12 text-center cursor-pointer hover:border-cyan-500/60 hover:bg-cyan-500/5 transition-all"
            >
              <Upload className="w-16 h-16 mx-auto mb-4 text-cyan-400 opacity-50" />
              <p className="text-cyan-300 mb-2">Click to upload audio files</p>
              <p className="text-sm text-gray-500">Supports WAV, MP3, FLAC, and more</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {uploadedTracks.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-bold text-cyan-400 mb-3">Uploaded Tracks</h3>
                <div className="space-y-2">
                  {uploadedTracks.map((track) => (
                    <div
                      key={track.id}
                      className="p-4 bg-black/50 border border-cyan-500/20 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Disc className="w-4 h-4 text-cyan-400" />
                            <span className="text-cyan-300">{track.filename}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Duration: {track.metadata.duration.toFixed(2)}s | 
                            Sample Rate: {track.metadata.sampleRate}Hz | 
                            Channels: {track.metadata.channels}
                          </div>
                          {track.processed && (
                            <div className="text-xs text-green-400 mt-1">
                              ✅ Processed - {track.segmentCount} segments created
                            </div>
                          )}
                        </div>

                        {!track.processed ? (
                          <button
                            onClick={() => processTrack(track.id)}
                            disabled={processing}
                            className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 rounded text-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processing ? 'Processing...' : 'Process Track'}
                          </button>
                        ) : (
                          <div className="px-4 py-2 bg-green-500/20 border border-green-500/40 rounded text-green-400">
                            Ready
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <h3 className="text-sm font-bold text-cyan-400 mb-2">How it works:</h3>
              <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                <li>Upload your audio files (WAV, MP3, FLAC, etc.)</li>
                <li>Click "Process Track" to analyze and segment the audio</li>
                <li>The system will detect beats, analyze energy, and create segments</li>
                <li>Each segment is automatically sliced at beat boundaries</li>
                <li>Go to "Segment Library" to view and separate stems</li>
                <li>Use "Mix Timeline" to arrange segments and create seamless mixes</li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === 'segments' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SegmentLibrary onSegmentSelect={handleSegmentSelect} />
            
            <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/30 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-cyan-400 mb-4">Segment Details</h2>
              <div className="text-gray-400 text-center py-12">
                <Scissors className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Select a segment to view details</p>
                <p className="text-sm mt-2">
                  Click "Separate Stems" to extract vocals, drums, bass, and other elements
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <SegmentLibrary onSegmentSelect={handleSegmentSelect} />
            </div>
            <div className="lg:col-span-2">
              <MixTimeline ref={timelineRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
