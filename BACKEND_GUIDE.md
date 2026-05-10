# Vanguard DJ Backend Guide

## 🎯 Overview

The Vanguard DJ backend is a professional-grade audio processing system built with Node.js, Express, and FFmpeg. It provides:

- **Automatic Track Segmentation**: Beat-aware slicing of audio files
- **Stem Separation**: AI-powered isolation of vocals, drums, bass, and other elements
- **Mix Engine**: Seamless transitions with crossfading, beatmatching, and effects
- **Database Management**: SQLite-based storage for tracks, segments, stems, and mixes
- **Visual Timeline**: Real-time visualization of mix creation

---

## 🏗️ Architecture

```
server/
├── index.js           # Express server & API endpoints
├── db.js              # Database schema & initialization
├── analyze.js         # Audio analysis (legacy)
├── audioProcessor.js  # Segment creation & stem separation
└── mixEngine.js       # Mix creation & transitions

data/
├── vanguard.db        # SQLite database
├── segments/          # Extracted audio segments
├── stems/             # Separated stem files
└── mixes/             # Generated mix files

uploads/               # Temporary upload directory
```

---

## 🚀 Setup & Installation

### 1. Install Dependencies

```bash
npm install
```

Required packages:
- `express` - Web server
- `cors` - Cross-origin requests
- `multer` - File uploads
- `sqlite3` - Database
- `fluent-ffmpeg` - Audio processing
- `@ffmpeg-installer/ffmpeg` - FFmpeg binaries

### 2. Optional: Install Demucs for Advanced Stem Separation

For professional-grade stem separation:

```bash
# Install Python 3.8+
pip install demucs

# Verify installation
demucs --help
```

If Demucs is not installed, the system will fall back to FFmpeg-based frequency separation.

### 3. Start the Backend

```bash
npm run dev:api
```

This starts both the backend (port 8000) and frontend (port 5173).

Or start backend only:

```bash
node server/index.js
```

---

## 📊 Database Schema

### Tables Overview

1. **tracks** - Uploaded audio files
2. **segments** - Beat-aligned audio segments
3. **stems** - Separated audio elements (vocals, drums, bass, other)
4. **mixes** - Created DJ mixes
5. **mix_timeline** - Timeline items for each mix

### Key Relationships

```
tracks (1) → (many) segments
segments (1) → (many) stems
mixes (1) → (many) mix_timeline
mix_timeline (many) → (1) segments
```

---

## 🎵 Audio Processing Pipeline

### Step 1: Upload Track

```javascript
POST /tracks/upload
```

- Accepts audio files (WAV, MP3, FLAC, etc.)
- Extracts metadata (duration, sample rate, channels)
- Stores in database with `processed = false`

### Step 2: Process Track

```javascript
POST /tracks/:trackId/process
```

**What happens:**

1. **Beat Detection**
   - Analyzes RMS energy levels
   - Detects peaks above threshold
   - Estimates BPM from beat intervals

2. **Segment Creation**
   - Slices audio at 16-bar boundaries
   - Extracts each segment to separate WAV file
   - Analyzes energy, danceability, valence

3. **Metadata Storage**
   - Saves segment info to database
   - Links segments to parent track
   - Updates track with BPM and key

**Output:**
- Multiple segment files in `data/segments/`
- Database records for each segment
- Segment metadata (BPM, energy, key, etc.)

### Step 3: Separate Stems (Optional)

```javascript
POST /segments/:segmentId/separate-stems
```

**Demucs Method (if installed):**
- Uses state-of-the-art AI model
- Separates into 4 stems: vocals, drums, bass, other
- High-quality separation
- Processing time: ~30s per segment

**FFmpeg Fallback Method:**
- Frequency-based separation
- Fast processing (~5s per segment)
- Lower quality but always available

**Output:**
- 4 stem files per segment in `data/stems/`
- Database records for each stem
- Ready for individual mixing

### Step 4: Create Mix

```javascript
POST /mixes/create
```

**Timeline Structure:**
```json
{
  "name": "My Mix",
  "timeline": [
    {
      "segmentId": "seg_track_123_0",
      "position": 0,
      "duration": 7.68,
      "transitionType": "crossfade",
      "transitionDuration": 2.0,
      "stemConfig": {
        "vocals": 1.0,
        "drums": 1.2,
        "bass": 0.8,
        "other": 1.0
      }
    }
  ]
}
```

**Mix Engine Process:**

1. **Load Segments**
   - Retrieves audio files for each timeline item
   - Applies stem configuration (gain adjustments)

2. **Apply Transitions**
   - **Crossfade**: Smooth volume blend
   - **Beatmatch**: Echo + synchronized fade
   - **Echo**: Creative echo-based transition
   - **Cut**: No transition (hard cut)

3. **Concatenate**
   - Merges all segments with transitions
   - Outputs single WAV file

4. **Save to Database**
   - Stores mix metadata
   - Saves timeline configuration
   - Links to segments

**Output:**
- Single mix file in `data/mixes/`
- Database record with timeline
- Ready for playback/download

---

## 🎛️ Transition Types Explained

### Crossfade
```
Segment 1: ████████▓▓▓▓░░░░
Segment 2:         ░░░░▓▓▓▓████████
```
- Smooth volume transition
- Best for: Similar energy levels
- Duration: 0.5s - 10s

### Beatmatch
```
Segment 1: ████████▓▓▓▓░░░░ (with echo)
Segment 2:         ░░░░▓▓▓▓████████
```
- Echo effect on outgoing segment
- Quadratic crossfade curve
- Best for: Beat-synchronized mixing
- Duration: 2s - 5s

### Echo
```
Segment 1: ████████▓▓▓▓░░░░ (echo + highpass)
Segment 2:         ░░░░▓▓▓▓████████
```
- Echo on segment 1
- Highpass filter on segment 2
- Exponential crossfade
- Best for: Creative transitions
- Duration: 2s - 4s

### Cut
```
Segment 1: ████████|
Segment 2:         |████████
```
- No transition
- Instant change
- Best for: Dramatic drops, genre changes

---

## 🔧 Configuration & Customization

### Segment Length

Edit `audioProcessor.js`:

```javascript
const beatsPerSegment = 16;  // Change to 8, 32, etc.
```

### Beat Detection Sensitivity

Edit `audioProcessor.js`:

```javascript
const threshold = -20;  // Lower = more sensitive
const minBeatInterval = 0.3;  // Minimum time between beats
```

### Transition Defaults

Edit `mixEngine.js`:

```javascript
const defaultTransitionDuration = 2.0;  // seconds
const defaultTransitionType = 'crossfade';
```

---

## 📁 File Organization

### Segment Files
```
data/segments/
  seg_track_1234567890_0.wav
  seg_track_1234567890_1.wav
  seg_track_1234567890_2.wav
  ...
```

### Stem Files
```
data/stems/
  seg_track_1234567890_0/
    vocals.wav
    drums.wav
    bass.wav
    other.wav
  seg_track_1234567890_1/
    vocals.wav
    drums.wav
    bass.wav
    other.wav
  ...
```

### Mix Files
```
data/mixes/
  mix_1234567890.wav
  mix_1234567891.wav
  ...
```

---

## 🐛 Troubleshooting

### FFmpeg Not Found

**Error:** `Cannot find ffmpeg`

**Solution:**
```bash
npm install @ffmpeg-installer/ffmpeg
```

### Database Locked

**Error:** `database is locked`

**Solution:**
- Close other connections to the database
- Restart the server
- Delete `data/vanguard.db` to reset (loses all data)

### Stem Separation Fails

**Error:** `Stem separation failed`

**Solutions:**
1. Install Demucs: `pip install demucs`
2. Use FFmpeg fallback (automatic)
3. Check audio file format (WAV recommended)

### Out of Memory

**Error:** `JavaScript heap out of memory`

**Solution:**
```bash
NODE_OPTIONS="--max-old-space-size=4096" node server/index.js
```

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solution:**
```bash
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>
```

---

## 🎯 Best Practices

### Audio Quality
- Use WAV files for best quality
- 44.1kHz or 48kHz sample rate
- 16-bit or 24-bit depth
- Stereo (2 channels)

### Segment Processing
- Process tracks one at a time for stability
- Wait for processing to complete before uploading more
- Monitor disk space (segments can be large)

### Stem Separation
- Only separate stems when needed (saves time/space)
- Demucs provides best quality but is slower
- FFmpeg fallback is fast but lower quality

### Mix Creation
- Test transitions with 2-3 segments first
- Use similar BPMs for beatmatching
- Adjust transition durations based on energy levels
- Save mixes frequently

### Database Maintenance
- Backup `data/vanguard.db` regularly
- Clean up old segments/stems periodically
- Monitor database size

---

## 🚀 Performance Optimization

### Processing Speed
- **Beat Detection**: ~5-10s per track
- **Segment Creation**: ~1s per segment
- **Stem Separation (Demucs)**: ~30s per segment
- **Stem Separation (FFmpeg)**: ~5s per segment
- **Mix Creation**: ~10s per mix

### Disk Space
- **Original Track**: ~30-50 MB (3-minute song)
- **Segments**: ~5-10 MB each
- **Stems**: ~20-40 MB per segment (4 stems)
- **Mix**: ~50-100 MB (10-minute mix)

### Optimization Tips
1. Delete unused segments/stems
2. Use MP3 for final mixes (smaller size)
3. Process in batches during off-peak hours
4. Use SSD for faster I/O

---

## 📚 API Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tracks/upload` | POST | Upload audio file |
| `/tracks/:id/process` | POST | Create segments |
| `/segments` | GET | List all segments |
| `/segments/:id/separate-stems` | POST | Separate stems |
| `/mixes/create` | POST | Create mix |
| `/mixes` | GET | List all mixes |
| `/mixes/:id` | GET | Get mix details |

See `API_DOCUMENTATION.md` for full details.

---

## 🎓 Advanced Features

### Custom Derivation Methods

Add new segmentation strategies in `audioProcessor.js`:

```javascript
// Example: Vocal phrase detection
async createVocalSegments(filePath, trackId) {
  // Detect vocal phrases
  // Create segments at phrase boundaries
  // Return segments
}
```

### Custom Transition Effects

Add new transitions in `mixEngine.js`:

```javascript
async customTransition(path1, path2, outputPath, duration) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(path1)
      .input(path2)
      .complexFilter([
        // Your custom FFmpeg filters
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}
```

### Metadata Extraction

Extend metadata in `audioProcessor.js`:

```javascript
// Add tempo stability, harmonic content, etc.
const metadata = {
  ...existingMetadata,
  tempoStability: calculateTempoStability(beats),
  harmonicComplexity: analyzeHarmonics(filePath)
};
```

---

## 🎉 Next Steps

1. ✅ Upload your first track
2. ✅ Process it into segments
3. ✅ Separate stems for creative mixing
4. ✅ Create your first mix with transitions
5. ✅ Experiment with different transition types
6. ✅ Build a library of segments for quick mixing

Happy mixing! 🎧🔥
