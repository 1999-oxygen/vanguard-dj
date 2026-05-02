# Vanguard DJ Elite v3.1.0

Custom DJ software with AI-powered harmonic mixing recommendations via Gemini **and** a real-time Neural Analysis Core powered by librosa.

## Features
- BPM Engine with live drift simulation
- Neural AI track analysis (Gemini integration)
- **Neural Analysis Core** — librosa-powered backend for real beat detection, key analysis, and 4-beat atom segmentation
- **Ghost-Tail Live Playback Engine** — Sub-millisecond atom player with micro-fade anti-click envelopes
- **Universal/Computational Grade Engine** — Physics-based zero-crossing slicing, deep-musicology metrics, SQL-queryable atom database
- **Quantum Crate** — Visual Atom Database with Audio Utility filtering and instant swappability
- **Recombinator Timeline** — DAW-style dual-pane workstation with elastic normalization
- 3D waveform visualization
- Terminal-style logs
- Stem mixer controls
- Dark cyberpunk UI (Tailwind + Vite)

## Quick Start (Frontend Only)

1. **Install Node dependencies:**
   ```bash
   cd vanguard-dj
   npm install
   ```

2. **Add Gemini API key:**
   Create `.env`:
   ```
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```
   Open http://localhost:5173

## Neural Analysis Core (Backend)

The frontend integrates with a Python FastAPI backend that runs your original `VanguardAnalyzer` using **librosa** for professional-grade audio analysis.

### Backend Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r api/requirements.txt
   ```

2. **Run the backend:**
   ```bash
   python api/run.py
   ```
   The API will start on `http://localhost:8000`.

3. **Run frontend + backend together:**
   ```bash
   npm run dev:api
   ```
   This uses `concurrently` to start both the Python server and Vite dev server.

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/analyze` | POST | Upload audio file → returns Track DNA JSON |
| `/analyze_batch` | POST | Upload multiple files → batch DNA analysis |
| `/universal/analyze` | POST | Universal Core — zero-crossing atom shredding |
| `/fusion/query` | GET | Query Quantum DB by energy, danceability, vocals |
| `/recombine` | POST | Generate Flight Plan from fusion elements |
| `/recombine/segments` | POST | Generate Flight Plan from raw segments |
| `/ml/extract` | POST | Demucs + Whisper full pipeline |
| `/ml/phonetic` | POST | Whisper phonetic alignment only |

### Environment Variables

Create `.env` in the project root:
```
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_VANGUARD_API_URL=http://localhost:8000   # Optional: defaults to localhost
```

### Remote Backend (Windows Machine)

If your Python backend runs on a separate Windows machine (e.g., with GPU for Demucs/Whisper):

1. **On the Windows machine**, start the backend:
   ```powershell
   cd vanguard-dj\api
   pip install -r requirements.txt
   python run.py --host 0.0.0.0 --port 8000
   ```

2. **On the frontend machine** (macOS), point to the Windows IP:
   ```bash
   # Find Windows IP (on Windows: ipconfig)
   # Example: Windows machine is at 192.168.1.100
   
   # Create .env
   echo "VITE_VANGUARD_API_URL=http://192.168.1.100:8000" > .env
   echo "VITE_GEMINI_API_KEY=your_key" >> .env
   
   npm run dev
   ```

3. **CORS is pre-configured** in `api/main.py` for LAN access. The frontend auto-detects backend health and falls back to client-side analysis if unreachable.

## Quantum Crate (Visual Atom Database)

The FUSION mode features a **dual-pane workstation**:

### Left Pane: Quantum Crate
- **Audio Utility Filtering**: Filter atoms by WPS (Words Per Second), Energy, Stem type, Semantic tags
- **Visual DNA Profiles**: Purple=Vocals, Blue=Bass, Green=Drums, Cyan=Master
- **Instant Swappability**: Hover any card → click SWAP → timeline recalculates `time_stretch_ratio = masterBPM / atomBPM`
- **Semantic Tags**: Auto-generated from ML features: `Vocal-Heavy`, `Percussive`, `Bright`, `High-Energy`, `Low-Energy`

### Right Pane: Recombinator Timeline
- **DAW-style lanes**: Separate rows for vocals, bass, drums, master
- **Elastic Normalization**: Any atom locks to master BPM without pitch shift
- **Sample-Accurate Scheduling**: Integer samples at 44.1kHz
- **Ghost-Tail Envelopes**: Micro-fades prevent click artifacts

## Architecture

```
src/
├── api/
│   ├── analyzer.py          # VanguardAnalyzer librosa implementation
│   ├── main.py              # FastAPI server
│   ├── requirements.txt     # Python deps
│   └── run.py               # CLI entry point
├── services/
│   ├── universalApi.js      # Universal Core + Fusion Engine client
│   └── vanguardApi.js       # DNA Analysis client + fallback
├── hooks/
│   ├── useVanguard.js       # AI + state + Gemini
│   ├── useTrackAnalyzer.js  # Hooks into Neural Core (with client fallback)
│   ├── useSegmentEngine.js  # Segmentation pipeline (DNA-aware)
│   ├── useAtomPlayer.js     # Ghost-Tail Live Playback Engine
│   └── useFlightPlanPlayer.js # Sample-accurate flight plan executor
├── components/
│   ├── AtomDeck.jsx         # Atom Matrix Trigger UI
│   ├── DnaBadge.jsx         # Cyberpunk DNA display
│   ├── QuantumCrate.jsx     # Visual Atom Database
│   ├── FlightPlanTimeline.jsx # DAW-style timeline
│   └── SegmentVisualizer.jsx # Segment grid
├── App.jsx                  # Main UI + demo tracks
├── main.jsx                 # Entry
└── index.css                # Tailwind globals
```

## Standalone CLI Analysis

Analyze any track from the command line without the UI:

```bash
python scripts/analyze_track.py ./music/my_track.wav
```

Outputs `track_dna.json` with BPM, key, energy atoms, and more.

## Ghost-Tail Live Playback Engine

The `useAtomPlayer` hook provides sub-millisecond, click-free segment previews using Web Audio API.

### Features
- **10ms micro-fade IN** — Prevents initial pops on playback start
- **10ms micro-fade OUT** — Prevents ending clicks on playback stop
- **Resume on suspend** — Automatically handles browser autoplay policy
- **Buffer reuse** — Works with pre-decoded `AudioBuffer` objects

## Universal/Computational Grade Architecture

Beyond the standard DNA analyzer, Vanguard includes a **Universal/Computational Grade** engine.

### Four-Module Python Stack

| Module | File | Purpose |
|--------|------|---------|
| **Quantum Database** | `api/db/schema.py` | SQLAlchemy SQLite with deep-musicology metrics |
| **Zero-Crossing Slicer** | `api/core/slicer.py` | Physics-based cutting at amplitude `0.0` |
| **Universal Core** | `api/core/universal_core.py` | Orchestrates Demucs v4, Whisper, CREPE, Essentia |
| **Fusion Engine** | `api/core/fusion_engine.py` | Query database for fusion-ready atoms |
| **Recombinator** | `api/core/recombinator.py` | Builds phase-locked Flight Plans |
| **ML Extractor** | `api/core/ml_extractor.py` | Demucs + Whisper with sub-sample accuracy |

## Deployment Notes

- **Frontend**: Static build deploys to Vercel as before.
- **Backend**: The Python FastAPI server needs separate hosting for production. The frontend gracefully falls back to client-side JS analysis when the backend is unreachable.

## Next Steps
- Web Audio API for real playback/scratch
- Drag-drop track import
- Waveform rendering (Howler.js?)
- Multi-deck sync
- Export mixes

Kernel powered by Vanguard v3.1.0
