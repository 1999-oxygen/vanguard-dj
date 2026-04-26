# Vanguard DJ Elite v3.0.1

Custom DJ software with AI-powered harmonic mixing recommendations via Gemini.

## Features
- BPM Engine with live drift simulation
- Neural AI track analysis (Gemini integration)
- Track library search & selection
- Animated waveform visualization
- Terminal-style logs
- Stem mixer controls
- Dark cyberpunk UI (Tailwind + Vite)

## Quick Start

1. **Install dependencies:**
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

4. **Build for production:**
   ```bash
   npm run build
   ```

## Architecture
```
src/
├── hooks/useVanguard.js     # AI + state + Gemini
├── App.jsx                  # Main UI + demo tracks
├── main.jsx                 # Entry
└── index.css                # Tailwind globals
```

## Next Steps
- Web Audio API for real playback/scratch
- Drag-drop track import
- Waveform rendering (Howler.js?)
- Multi-deck sync
- Export mixes

Kernel powered by Vanguard v3.0.1
