# Vanguard DJ - System Architecture

## 🏗️ Complete System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│                     http://localhost:5173                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP Requests
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VANGUARD DJ UI                              │
│                    (VanguardDJ.jsx)                              │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Upload &   │  │   Segment    │  │     Mix      │          │
│  │   Process    │  │   Library    │  │   Timeline   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              State Management                             │  │
│  │  • tracks[]    • segments[]    • mixes[]                  │  │
│  │  • timeline[]  • selectedSegment  • notifications         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ API Calls
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS API SERVER                            │
│                   http://localhost:8000                          │
│                     (server/index.js)                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    API ENDPOINTS                            │ │
│  │                                                             │ │
│  │  POST   /tracks/upload              Upload audio file      │ │
│  │  POST   /tracks/:id/process         Create segments        │ │
│  │  GET    /tracks                     List all tracks        │ │
│  │  GET    /segments                   List all segments      │ │
│  │  GET    /segments/:id               Get segment details    │ │
│  │  POST   /segments/:id/separate-stems Separate stems        │ │
│  │  POST   /mixes/create               Create mix             │ │
│  │  GET    /mixes                      List all mixes         │ │
│  │  GET    /mixes/:id                  Get mix details        │ │
│  │  GET    /data/segments/*            Serve segment files    │ │
│  │  GET    /data/stems/*               Serve stem files       │ │
│  │  GET    /data/mixes/*               Serve mix files        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
           │                    │                    │
           │                    │                    │
           ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Audio Processor │  │   Mix Engine     │  │    Database      │
│ audioProcessor.js│  │  mixEngine.js    │  │     db.js        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
           │                    │                    │
           │                    │                    │
           ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CORE OPERATIONS                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Audio Processor (audioProcessor.js)                        │ │
│  │  • getAudioMetadata()    - Extract file info               │ │
│  │  • detectBeats()         - RMS-based beat detection        │ │
│  │  • estimateBPM()         - Calculate tempo                 │ │
│  │  • analyzeEnergy()       - Measure intensity               │ │
│  │  • extractSegment()      - Slice audio at beat boundaries  │ │
│  │  • separateStems()       - Demucs or FFmpeg separation     │ │
│  │  • createSegments()      - Full segmentation pipeline      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Mix Engine (mixEngine.js)                                  │ │
│  │  • createMix()           - Render final mix                │ │
│  │  • crossfadeTransition() - Smooth volume blend             │ │
│  │  • beatmatchTransition() - Beat-synced with echo           │ │
│  │  • echoTransition()      - Creative echo effect            │ │
│  │  • cutTransition()       - Hard cut                        │ │
│  │  • concatenateSegments() - Join all segments               │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SQLITE DATABASE                             │
│                    (data/vanguard.db)                            │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │   tracks   │  │  segments  │  │   stems    │  │  mixes   │ │
│  ├────────────┤  ├────────────┤  ├────────────┤  ├──────────┤ │
│  │ id         │  │ id         │  │ id         │  │ id       │ │
│  │ filename   │  │ track_id   │  │ segment_id │  │ name     │ │
│  │ duration   │  │ start_time │  │ stem_type  │  │ duration │ │
│  │ bpm        │  │ end_time   │  │ audio_path │  │ created  │ │
│  │ key        │  │ duration   │  │ gain       │  └──────────┘ │
│  │ processed  │  │ bpm        │  └────────────┘               │ │
│  └────────────┘  │ energy     │                               │ │
│                  │ processed  │  ┌──────────────┐             │ │
│                  └────────────┘  │ mix_timeline │             │ │
│                                  ├──────────────┤             │ │
│                                  │ id           │             │ │
│                                  │ mix_id       │             │ │
│                                  │ segment_id   │             │ │
│                                  │ position     │             │ │
│                                  │ transition   │             │ │
│                                  └──────────────┘             │ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FILE SYSTEM                                 │
│                                                                  │
│  uploads/                    Temporary upload directory          │
│  ├── temp_file_1.wav                                            │
│  └── temp_file_2.mp3                                            │
│                                                                  │
│  data/segments/              Extracted audio segments            │
│  ├── seg_track_123_0.wav                                        │
│  ├── seg_track_123_1.wav                                        │
│  └── seg_track_456_0.wav                                        │
│                                                                  │
│  data/stems/                 Separated stem files                │
│  ├── seg_track_123_0/                                           │
│  │   ├── vocals.wav                                             │
│  │   ├── drums.wav                                              │
│  │   ├── bass.wav                                               │
│  │   └── other.wav                                              │
│  └── seg_track_123_1/                                           │
│      ├── vocals.wav                                             │
│      ├── drums.wav                                              │
│      ├── bass.wav                                               │
│      └── other.wav                                              │
│                                                                  │
│  data/mixes/                 Final rendered mixes                │
│  ├── mix_1234567890.wav                                         │
│  └── mix_1234567891.wav                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Examples

### 1. Upload Track Flow

```
User clicks upload area
        ↓
File selected in browser
        ↓
Frontend: handleFileUpload()
        ↓
POST /tracks/upload (FormData with file)
        ↓
Backend: Multer receives file → saves to uploads/
        ↓
Backend: audioProcessor.getAudioMetadata()
        ↓
Backend: Database INSERT into tracks table
        ↓
Backend: Returns { trackId, filename, metadata }
        ↓
Frontend: Updates tracks state
        ↓
Frontend: Shows success notification
        ↓
UI displays track in list
```

### 2. Process Track Flow

```
User clicks "Process Track"
        ↓
Frontend: processTrack(trackId)
        ↓
POST /tracks/:trackId/process
        ↓
Backend: Loads track from database
        ↓
Backend: audioProcessor.detectBeats()
        ↓
Backend: audioProcessor.estimateBPM()
        ↓
Backend: audioProcessor.createSegments()
        ↓
For each segment:
  ├─ audioProcessor.extractSegment()
  ├─ audioProcessor.analyzeEnergy()
  ├─ Save segment file to data/segments/
  └─ Database INSERT into segments table
        ↓
Backend: Update track.processed = true
        ↓
Backend: Returns { segmentCount, segments[] }
        ↓
Frontend: Updates tracks and segments state
        ↓
Frontend: Switches to Segment Library view
        ↓
UI displays all segments
```

### 3. Separate Stems Flow

```
User clicks "Separate Stems"
        ↓
Frontend: separateStems(segmentId)
        ↓
POST /segments/:segmentId/separate-stems
        ↓
Backend: Loads segment from database
        ↓
Backend: audioProcessor.separateStems()
        ↓
Backend: Check if Demucs is available
        ↓
If Demucs available:
  ├─ Run: demucs --two-stems=vocals
  ├─ Extract 4 stems from output
  └─ Save to data/stems/:segmentId/
Else:
  ├─ audioProcessor.separateWithFFmpeg()
  ├─ Extract frequency ranges
  └─ Save to data/stems/:segmentId/
        ↓
For each stem:
  └─ Database INSERT into stems table
        ↓
Backend: Update segment.processed = true
        ↓
Backend: Returns { stems[] }
        ↓
Frontend: Updates segments state
        ↓
Frontend: Shows success notification
        ↓
UI updates segment display with stem badges
```

### 4. Create Mix Flow

```
User arranges segments on timeline
        ↓
User configures transitions
        ↓
User clicks "Create Mix"
        ↓
Frontend: createMix()
        ↓
POST /mixes/create
Body: { name, timeline[] }
        ↓
Backend: Validates timeline
        ↓
Backend: Loads all segments from database
        ↓
Backend: mixEngine.createMix()
        ↓
For each timeline item:
  ├─ Load segment audio file
  ├─ Apply stem configuration
  └─ Process transition to next segment
        ↓
Backend: mixEngine.concatenateSegments()
        ↓
Backend: Render final mix to data/mixes/
        ↓
Backend: Database INSERT into mixes table
        ↓
For each timeline item:
  └─ Database INSERT into mix_timeline table
        ↓
Backend: Returns { mixId, path, duration }
        ↓
Frontend: Updates mixes state
        ↓
Frontend: Switches to Saved Mixes view
        ↓
Frontend: Shows success notification
        ↓
UI displays new mix with download button
```

---

## 🎯 Component Responsibilities

### Frontend (VanguardDJ.jsx)

**Responsibilities**:
- User interface rendering
- User interaction handling
- API communication
- State management
- Notifications
- View switching

**Does NOT**:
- Process audio
- Store data
- Create files
- Analyze audio

### Backend (server/index.js)

**Responsibilities**:
- API endpoint routing
- Request validation
- Response formatting
- Orchestrating operations
- Error handling

**Does NOT**:
- Process audio directly
- Render UI
- Store business logic

### Audio Processor (audioProcessor.js)

**Responsibilities**:
- Beat detection
- BPM estimation
- Energy analysis
- Segment extraction
- Stem separation
- File I/O

**Does NOT**:
- Handle HTTP requests
- Manage database
- Create mixes

### Mix Engine (mixEngine.js)

**Responsibilities**:
- Transition creation
- Segment concatenation
- Mix rendering
- Audio effects
- File output

**Does NOT**:
- Segment creation
- Beat detection
- Database operations

### Database (db.js)

**Responsibilities**:
- Schema definition
- Table creation
- Data persistence
- Relationships

**Does NOT**:
- Process audio
- Handle HTTP
- Business logic

---

## 🔐 Security Considerations

### File Upload
- Multer handles file uploads
- Files saved to `uploads/` directory
- Original filename preserved
- File size limits (configurable)

### API Access
- CORS enabled for localhost:5173
- No authentication (local development)
- Add authentication for production

### File Access
- Static file serving for segments, stems, mixes
- Direct file access via URL
- No path traversal protection (add for production)

### Database
- SQLite file-based database
- No SQL injection (using parameterized queries)
- No concurrent write protection (SQLite handles)

---

## 📊 Performance Characteristics

### Upload
- **Speed**: Network dependent
- **Bottleneck**: File size
- **Optimization**: Chunked upload (future)

### Processing
- **Speed**: ~5-10s per track
- **Bottleneck**: Beat detection
- **Optimization**: Parallel processing (future)

### Stem Separation
- **Demucs**: ~30s per segment
- **FFmpeg**: ~5s per segment
- **Bottleneck**: CPU
- **Optimization**: GPU acceleration (future)

### Mix Creation
- **Speed**: ~10-20s per mix
- **Bottleneck**: File I/O
- **Optimization**: Streaming (future)

---

## 🚀 Scalability

### Current Limits
- Single user (no multi-tenancy)
- Single server (no load balancing)
- File-based storage (no cloud)
- Synchronous processing (no queue)

### Future Improvements
- User authentication
- Job queue (Redis/Bull)
- Cloud storage (S3)
- Microservices architecture
- WebSocket for real-time updates
- Caching layer

---

## 🎓 Technology Stack

### Frontend
- **React** - UI framework
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **Fetch API** - HTTP requests

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **Multer** - File uploads
- **SQLite3** - Database
- **Fluent-FFmpeg** - Audio processing

### Audio Processing
- **FFmpeg** - Audio manipulation
- **Demucs** (optional) - AI stem separation

### Development
- **Vite** - Build tool
- **Concurrently** - Run multiple processes
- **Nodemon** - Auto-restart server

---

This architecture provides a **clean separation of concerns** with **clear data flow** and **well-defined responsibilities** for each component. The UI and backend work together seamlessly to provide a professional DJ mixing experience! 🎧🔥
