# Vanguard DJ Elite v3.1.0

Custom DJ software with AI-powered harmonic mixing recommendations via Gemini **and** a real-time Neural Analysis Core powered by librosa.

## Features
- BPM Engine with live drift simulation
- Neural AI track analysis (Gemini integration)
- **Neural Analysis Core** — librosa-powered backend for real beat detection, key analysis, and 4-beat atom segmentation
- **Ghost-Tail Live Playback Engine** — Sub-millisecond atom player with micro-fade anti-click envelopes
- **Universal/Computational Grade Engine** — Physics-based zero-crossing slicing, deep-musicology metrics, SQL-queryable atom database
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

### Environment Variables

Create `.env` in the project root:
```
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_VANGUARD_API_URL=http://localhost:8000   # Optional: defaults to localhost
```

## Architecture

```
src/
├── api/
│   ├── analyzer.py          # VanguardAnalyzer librosa implementation
│   ├── main.py              # FastAPI server
│   ├── requirements.txt     # Python deps
│   └── run.py               # CLI entry point
├── services/
│   └── vanguardApi.js       # Frontend API client + fallback
├── hooks/
│   ├── useVanguard.js       # AI + state + Gemini
│   ├── useTrackAnalyzer.js  # Hooks into Neural Core (with client fallback)
│   ├── useSegmentEngine.js  # Segmentation pipeline (now DNA-aware)
│   └── useAtomPlayer.js     # Ghost-Tail Live Playback Engine
├── components/
│   ├── AtomDeck.jsx         # Atom Matrix Trigger UI with energy bars
│   ├── DnaBadge.jsx         # Cyberpunk DNA display
│   └── SegmentVisualizer.jsx # Segment grid with per-cell preview
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

### How to use

```javascript
import { useAtomPlayer } from './hooks/useAtomPlayer.js';

const atomPlayer = useAtomPlayer(audioBuffer);

// Preview a specific segment (click-free)
atomPlayer.previewSegment(startSec, endSec);

// Or use playAtom with custom options
atomPlayer.playAtom(startSec, endSec, {
  fadeIn: 0.02,
  fadeOut: 0.02,
  gain: 0.8,
});

// Stop immediately
atomPlayer.stopAtom();
```

### UI Integration

**AtomDeck Component** — A dedicated Atom Matrix Trigger panel in the Segment view:
- Each atom appears as a triggerable button with energy visualization bar
- High-energy atoms (> 8.0) glow in neon pink/red; normal atoms in cyan/blue
- Active atoms get a purple glow shadow and filled Play icon
- Click any atom to fire it instantly with Ghost-Tail envelopes
- Auto-resets UI after playback duration elapses

In the **Segment** view, hover over any segment cell and click the **speaker icon** to instantly preview that atom with Ghost-Tail envelopes.

## Universal/Computational Grade Architecture

Beyond the standard DNA analyzer, Vanguard now includes a **Universal/Computational Grade** engine that abandons basic peak detection for physics-based, ML-orchestrated analysis.

### Four-Module Python Stack

| Module | File | Purpose |
|--------|------|---------|
| **Quantum Database** | `api/db/schema.py` | SQLAlchemy SQLite with deep-musicology metrics (energy, dissonance, danceability, lyric density, MFCC/chroma vectors) |
| **Zero-Crossing Slicer** | `api/core/slicer.py` | Physics-based cutting at amplitude `0.0` — zero clicks, no fades needed |
| **Universal Core** | `api/core/universal_core.py` | Orchestrates S.O.T.A. ML: Demucs v4, Whisper, CREPE, Essentia. Multi-derivation slicing (beat-grid, vocal phrases, energy drops, drum fills) |
| **Fusion Engine** | `api/core/fusion_engine.py` | Query the database: `get_fusion_elements(min_energy=0.8, require_vocals=True)` → returns perfectly sliced, zero-click atoms |

### Universal API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Engine status with all module flags |
| `/universal/analyze` | POST | **Universal Core** — shreds track into zero-crossing atoms, stores in Quantum DB |
| `/fusion/query` | GET | **Fusion Engine** — query atoms by energy, danceability, vocals, derivation |

### Why This Is Life-Changing

1. **Database Replaces the Crate**: Query `engine.get_fusion_elements(require_vocals=True, min_energy=0.8)` → AI hands you 50 perfectly sliced vocal drops
2. **Zero-Crossing Physics**: `playback_bounds` samples load directly into engines — loop forever with zero clicks, no volume fades
3. **Multi-Derivation**: One track becomes an entire sample pack (beat-grid + vocal phrases + drum fills + energy drops)

## Deployment Notes

- **Frontend**: Static build deploys to Vercel as before.
- **Backend**: The Python FastAPI server needs separate hosting (Render, Railway, AWS Lambda, etc.) for production use. The frontend gracefully falls back to client-side JS analysis when the backend is unreachable.

## Next Steps
- Web Audio API for real playback/scratch
- Drag-drop track import
- Waveform rendering (Howler.js?)
- Multi-deck sync
- Export mixes

Kernel powered by Vanguard v3.1.0
