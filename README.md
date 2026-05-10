# Vanguard DJ Elite v4.0.0

Professional DJ software with AI-powered audio processing, stem separation, and seamless mix creation.

## 🎯 Core Features

### Audio Processing
- **Automatic Beat Detection** — RMS-based beat detection with BPM estimation
- **Intelligent Segmentation** — 16-bar segments aligned to beat grid
- **Stem Separation** — AI-powered isolation of vocals, drums, bass, and other elements
- **Energy Analysis** — Real-time energy, danceability, and valence metrics

### Mix Engine
- **Seamless Transitions** — Crossfade, beatmatch, echo, and cut transitions
- **Visual Timeline** — Drag-and-drop mix creation with real-time preview
- **Stem Mixing** — Individual control over vocals, drums, bass, and other elements
- **Database-Driven** — SQLite storage for tracks, segments, stems, and mixes

### User Interface
- **Segment Library** — Browse and manage processed audio segments
- **Mix Timeline** — Visual arrangement of segments with transition controls
- **Real-time Metadata** — BPM, key, energy, and stem information
- **Dark Cyberpunk UI** — Modern interface with Tailwind CSS

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd vanguard-dj
npm install
```

### 2. Start the Backend

```bash
npm run dev:api
```

This starts:
- **Backend API** on `http://localhost:8000`
- **Frontend UI** on `http://localhost:5173`

### 3. Upload & Process Tracks

1. Open `http://localhost:5173`
2. Go to **Upload & Process** tab
3. Upload your audio files (WAV, MP3, FLAC)
4. Click **Process Track** to create segments
5. View segments in **Segment Library**
6. Click **Separate Stems** for individual element control

### 4. Create Your First Mix

1. Go to **Mix Timeline** tab
2. Select segments from the library
3. Arrange them on the timeline
4. Choose transition types (crossfade, beatmatch, echo, cut)
5. Click **Create Mix**
6. Download your seamless DJ mix!

## 🏗️ Backend Architecture

The Vanguard DJ backend is built with **Node.js + Express** and provides comprehensive audio processing capabilities.

### Core Modules

| Module | File | Purpose |
|--------|------|---------|
| **API Server** | `server/index.js` | Express server with all endpoints |
| **Database** | `server/db.js` | SQLite schema for tracks, segments, stems, mixes |
| **Audio Processor** | `server/audioProcessor.js` | Beat detection, segmentation, stem separation |
| **Mix Engine** | `server/mixEngine.js` | Seamless transitions and mix creation |

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tracks/upload` | POST | Upload audio file |
| `/tracks/:id/process` | POST | Create segments from track |
| `/segments` | GET | List all segments with metadata |
| `/segments/:id/separate-stems` | POST | Separate vocals, drums, bass, other |
| `/mixes/create` | POST | Create mix from timeline |
| `/mixes` | GET | List all created mixes |

See **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** for complete API reference.

### Advanced Stem Separation

For professional-grade stem separation, install **Demucs**:

```bash
pip install demucs
```

The system will automatically use Demucs when available, or fall back to FFmpeg-based frequency separation.

## 📁 Project Structure

```
vanguard-dj/
├── server/                      # Backend (Node.js + Express)
│   ├── index.js                 # API server with all endpoints
│   ├── db.js                    # SQLite database schema
│   ├── audioProcessor.js        # Beat detection, segmentation, stems
│   ├── mixEngine.js             # Mix creation with transitions
│   └── analyze.js               # Legacy audio analysis
│
├── src/                         # Frontend (React + Vite)
│   ├── components/
│   │   ├── VanguardDJStudio.jsx # Main application component
│   │   ├── SegmentLibrary.jsx   # Segment browser with metadata
│   │   ├── MixTimeline.jsx      # Visual mix timeline
│   │   ├── FileUpload.jsx       # Track upload interface
│   │   └── ...                  # Other UI components
│   ├── hooks/                   # React hooks for state management
│   ├── services/                # API client services
│   └── App.jsx                  # Main app entry
│
├── data/                        # Generated data (gitignored)
│   ├── vanguard.db              # SQLite database
│   ├── segments/                # Extracted audio segments
│   ├── stems/                   # Separated stem files
│   └── mixes/                   # Created DJ mixes
│
├── uploads/                     # Temporary upload directory
├── API_DOCUMENTATION.md         # Complete API reference
├── BACKEND_GUIDE.md             # Backend setup and usage guide
└── README.md                    # This file
```

## 🎵 Complete Workflow

### 1. Upload Track
```bash
curl -X POST -F "file=@song.wav" http://localhost:8000/tracks/upload
```

### 2. Process into Segments
```bash
curl -X POST http://localhost:8000/tracks/track_1234567890/process
```

**What happens:**
- Beat detection analyzes RMS energy
- Track is sliced into 16-bar segments
- Each segment gets metadata (BPM, energy, key)
- Segments saved to `data/segments/`

### 3. Separate Stems (Optional)
```bash
curl -X POST http://localhost:8000/segments/seg_track_1234567890_0/separate-stems
```

**What happens:**
- Segment is processed through Demucs or FFmpeg
- 4 stems created: vocals, drums, bass, other
- Stems saved to `data/stems/`

### 4. Create Mix
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"My Mix","timeline":[...]}' \
  http://localhost:8000/mixes/create
```

**What happens:**
- Segments are loaded from database
- Transitions are applied (crossfade, beatmatch, etc.)
- Final mix is rendered to `data/mixes/`

### 5. Download Mix
```bash
curl -O http://localhost:8000/data/mixes/mix_1234567890.wav
```

## 🎨 Transition Types

### Crossfade
Smooth volume blend between segments. Best for similar energy levels.

### Beatmatch
Beat-synchronized transition with echo effects. Best for maintaining rhythm.

### Echo
Creative echo-based transition with frequency filtering. Best for dramatic changes.

### Cut
Hard cut with no transition. Best for genre changes and drops.

## 📚 Documentation

- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** — Complete API reference with all endpoints
- **[BACKEND_GUIDE.md](BACKEND_GUIDE.md)** — Backend setup, configuration, and troubleshooting
- **[TODO.md](TODO.md)** — Development roadmap and progress

## 🚀 Deployment

### Frontend
```bash
npm run build
```
Deploy `dist/` to Vercel, Netlify, or any static hosting.

### Backend
The Node.js backend can be deployed to:
- **Render** — Easy deployment with automatic builds
- **Railway** — Simple Node.js hosting
- **AWS EC2** — Full control
- **DigitalOcean** — Droplet with Node.js

Set `PORT` environment variable for production.

## 🎯 Roadmap

- ✅ Automatic beat detection and segmentation
- ✅ Stem separation (vocals, drums, bass, other)
- ✅ Visual mix timeline
- ✅ Seamless transitions (crossfade, beatmatch, echo, cut)
- ✅ Database-driven segment management
- 🔄 Real-time waveform visualization
- 🔄 Web Audio API playback engine
- 🔄 Drag-and-drop timeline editing
- 🔄 Multi-deck sync
- 🔄 Live performance mode

## 📄 License

MIT License - Feel free to use and modify for your projects.

---

**Vanguard DJ Elite v4.0.0** — Professional DJ mixing powered by AI 🎧🔥
