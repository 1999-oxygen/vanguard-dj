# Vanguard DJ - User Interface Guide

## 🎨 Overview

The Vanguard DJ interface is a modern, intuitive web application that connects directly to your backend API. Every button, every interaction triggers real backend operations for professional audio processing.

---

## 🚀 Getting Started

### Launch the Application

```bash
npm run dev:api
```

This starts:
- **Backend API** on `http://localhost:8000`
- **Frontend UI** on `http://localhost:5173`

Open your browser to: **http://localhost:5173**

---

## 📱 Interface Layout

### Header Bar

Located at the top, shows:
- **Vanguard DJ** logo and title
- **Track Counter** - Number of uploaded tracks
- **Segment Counter** - Number of created segments
- **Mix Counter** - Number of saved mixes

### Navigation Tabs

Four main sections:
1. **Upload & Process** - Upload audio files and create segments
2. **Segment Library** - Browse and manage segments
3. **Mix Timeline** - Arrange segments and create mixes
4. **Saved Mixes** - View and download your mixes

---

## 🎵 Workflow Guide

### 1. Upload & Process View

#### Upload Tracks

**Action**: Click the upload area or drag-and-drop files

**What happens**:
- Files are uploaded to backend
- Backend extracts metadata (duration, sample rate, channels)
- Track appears in "Uploaded Tracks" list
- Green notification confirms upload

**Backend API**: `POST /tracks/upload`

#### Process Track

**Action**: Click "Process Track" button on any uploaded track

**What happens**:
- Backend analyzes the audio file
- Detects beats using RMS energy analysis
- Estimates BPM from beat intervals
- Slices track into 16-bar segments
- Each segment gets metadata (BPM, key, energy)
- Segments saved to database and disk
- Automatically switches to Segment Library view

**Backend API**: `POST /tracks/:trackId/process`

**Processing Time**: 5-10 seconds per track

**Visual Feedback**:
- Button shows "Processing..." with spinner
- Track status changes to "Ready" when complete
- Green checkmark appears

---

### 2. Segment Library View

#### Left Panel: Segment List

Shows all segments with:
- **Segment ID** - Unique identifier
- **Track Name** - Original track filename
- **Time Range** - Start time in seconds
- **Duration** - Length in seconds
- **BPM** - Beats per minute
- **Key** - Musical key
- **Energy Bar** - Visual energy indicator (color-coded)

**Color Coding**:
- 🔴 **Pink/Red** - High energy (>70%)
- 🔵 **Cyan/Blue** - Medium energy (40-70%)
- 🟦 **Blue/Indigo** - Low energy (<40%)

#### Segment Actions

**Separate Stems**:
- Click "Separate Stems" button
- Backend processes segment through Demucs or FFmpeg
- Creates 4 stems: vocals, drums, bass, other
- Badge changes to "Stems Ready"
- Stem tags appear below segment

**Backend API**: `POST /segments/:segmentId/separate-stems`

**Processing Time**: 5-30 seconds per segment

**Add to Mix**:
- Click "Add to Mix" button
- Segment is added to timeline
- Notification confirms addition
- Can switch to Timeline view to see it

#### Right Panel: Segment Details

Click any segment to view:
- Full segment information
- All metadata fields
- Available stems (if separated)
- Quick "Add to Timeline" button

---

### 3. Mix Timeline View

#### Timeline Header

Shows:
- **Total Duration** - Combined length of all segments
- **Segment Count** - Number of segments in timeline
- **Mix Name Input** - Enter a name for your mix
- **Create Mix Button** - Render the final mix

#### Timeline Items

Each segment on the timeline shows:
- **Position Number** - Order in the mix
- **Segment ID** - Identifier
- **Position & Duration** - Timing information
- **BPM, Key, Energy** - Metadata
- **Transition Controls** - Dropdown and duration input
- **Energy Bar** - Visual energy indicator
- **Remove Button** - Delete from timeline

#### Transition Types

**Crossfade**:
- Smooth volume blend
- Best for similar energy levels
- Duration: 0.5s - 10s

**Beatmatch**:
- Echo effect on outgoing segment
- Beat-synchronized mixing
- Best for maintaining rhythm
- Duration: 2s - 5s

**Echo**:
- Creative echo transition
- Frequency filtering
- Best for dramatic changes
- Duration: 2s - 4s

**Cut**:
- Hard cut, no transition
- Instant change
- Best for drops and genre changes
- No duration setting

#### Transition Controls

**Select Transition Type**:
- Click dropdown menu
- Choose from 4 types
- Updates immediately

**Adjust Duration**:
- Use number input (only for crossfade, beatmatch, echo)
- Range: 0.5s - 10s
- Step: 0.5s

#### Create Mix

**Action**: Click "Create Mix" button

**What happens**:
- Backend loads all segments from database
- Applies transitions between segments
- Renders final mix to WAV file
- Saves mix to database with timeline
- Shows success notification with duration
- Automatically switches to Saved Mixes view

**Backend API**: `POST /mixes/create`

**Processing Time**: 10-20 seconds

**Requirements**:
- At least 1 segment in timeline
- All segments must exist in database

---

### 4. Saved Mixes View

#### Mix Cards

Each mix shows:
- **Mix Name** - Custom name or auto-generated
- **Mix ID** - Unique identifier
- **Duration** - Total length
- **Segment Count** - Number of segments used
- **Created Date** - When mix was created
- **Download Button** - Get WAV file

#### Download Mix

**Action**: Click "Download Mix" button

**What happens**:
- Browser downloads WAV file
- File location: `data/mixes/mix_XXXXXXXXXX.wav`
- Full quality, uncompressed audio

**File Format**:
- WAV (PCM 16-bit)
- 44.1kHz sample rate
- Stereo (2 channels)

---

## 🎛️ Real-Time Backend Communication

### Every Action Triggers API Calls

**Upload File**:
```
Frontend → POST /tracks/upload → Backend
Backend → Saves file, extracts metadata → Database
Backend → Returns track info → Frontend
Frontend → Updates UI, shows notification
```

**Process Track**:
```
Frontend → POST /tracks/:id/process → Backend
Backend → Analyzes audio, creates segments → Database
Backend → Returns segment list → Frontend
Frontend → Updates UI, switches to Segments view
```

**Separate Stems**:
```
Frontend → POST /segments/:id/separate-stems → Backend
Backend → Processes audio, creates stems → Database
Backend → Returns stem info → Frontend
Frontend → Updates segment display
```

**Create Mix**:
```
Frontend → POST /mixes/create → Backend
Backend → Loads segments, applies transitions → Renders mix
Backend → Saves mix file → Database
Backend → Returns mix info → Frontend
Frontend → Updates UI, switches to Mixes view
```

### Auto-Refresh

The UI automatically refreshes data after:
- Uploading tracks
- Processing tracks
- Separating stems
- Creating mixes

This ensures you always see the latest data from the backend.

---

## 🎨 Visual Feedback

### Notifications

**Success** (Green):
- ✅ Upload successful
- ✅ Processing complete
- ✅ Stems separated
- ✅ Mix created

**Error** (Red):
- ❌ Upload failed
- ❌ Processing failed
- ❌ Stem separation failed
- ❌ Mix creation failed

**Auto-dismiss**: 4 seconds

### Loading States

**Processing Indicator**:
- Spinner icon
- "Processing..." text
- Button disabled
- Prevents duplicate requests

**Energy Bars**:
- Animated gradient
- Color-coded by energy level
- Real-time visual feedback

### Interactive Elements

**Hover Effects**:
- Buttons brighten on hover
- Borders glow
- Smooth transitions

**Click Feedback**:
- Immediate visual response
- State changes
- Notifications appear

---

## 🔧 Advanced Features

### Segment Selection

**Click segment** to:
- View full details in right panel
- See all metadata
- Check available stems
- Quick add to timeline

**Multiple segments**:
- Add as many as you want to timeline
- Arrange in any order
- Mix different tracks together

### Timeline Editing

**Reorder segments**:
- Remove unwanted segments
- Add more segments
- Adjust transitions
- Change durations

**Transition Customization**:
- Different type per segment
- Custom durations
- Preview energy levels

### Mix Management

**Download anytime**:
- All mixes saved permanently
- Download multiple times
- Share with others

---

## 💡 Tips & Best Practices

### For Best Results

1. **Upload WAV files** - Best quality
2. **Process one track at a time** - Prevents overload
3. **Separate stems selectively** - Only when needed
4. **Test transitions** - Try different types
5. **Name your mixes** - Easier to find later

### Workflow Optimization

1. **Upload all tracks first**
2. **Process them one by one**
3. **Browse segments, separate stems for key ones**
4. **Build timeline with best segments**
5. **Experiment with transitions**
6. **Create and download mix**

### Performance Tips

1. **Close unused tabs** - Saves memory
2. **Wait for processing to complete** - Don't spam buttons
3. **Refresh page if slow** - Clears state
4. **Check backend is running** - Look for console output

---

## 🐛 Troubleshooting

### Upload Not Working

**Check**:
1. Backend is running (`npm run dev:api`)
2. File format is supported (WAV, MP3, FLAC)
3. File size is reasonable (<100MB)
4. Browser console for errors

### Processing Stuck

**Check**:
1. Backend console for errors
2. Audio file is valid (play in another app)
3. Disk space available
4. Refresh page and try again

### Stems Not Separating

**This is normal**:
- System uses FFmpeg fallback if Demucs not installed
- Still creates stems, just lower quality
- Install Demucs for better results: `pip install demucs`

### Mix Creation Fails

**Check**:
1. Timeline has at least 1 segment
2. All segments exist in database
3. Disk space available
4. Backend console for details

### UI Not Updating

**Solutions**:
1. Refresh the page (F5)
2. Check backend is running
3. Check browser console for errors
4. Clear browser cache

---

## 🎯 Keyboard Shortcuts

Currently, all interactions are mouse/touch-based. Future versions may include:
- Space: Play/Pause
- Delete: Remove selected segment
- Ctrl+S: Save mix
- Ctrl+Z: Undo

---

## 📊 Understanding the Data

### Track Metadata

- **Duration** - Length in seconds
- **Sample Rate** - Audio quality (44100Hz = CD quality)
- **Channels** - 2 = Stereo, 1 = Mono
- **BPM** - Beats per minute (tempo)
- **Key** - Musical key (C, Cm, D, etc.)

### Segment Metadata

- **Start/End Time** - Position in original track
- **Duration** - Length of segment
- **BPM** - Tempo (inherited from track)
- **Key** - Musical key
- **Energy** - Intensity level (0-100%)
- **Danceability** - How danceable (0-100%)
- **Beat Count** - Number of beats (usually 16)

### Mix Information

- **Duration** - Total length including transitions
- **Segment Count** - Number of segments used
- **Timeline** - Complete arrangement data
- **Created Date** - When mix was made

---

## 🎓 Learning Path

### Beginner

1. Upload 1 track
2. Process it
3. View segments
4. Add 2-3 segments to timeline
5. Create your first mix

### Intermediate

1. Upload multiple tracks
2. Process all of them
3. Separate stems for key segments
4. Build longer mixes (5-10 segments)
5. Experiment with transition types

### Advanced

1. Build segment library from many tracks
2. Use stem separation strategically
3. Create complex mixes with varied transitions
4. Match BPMs and keys for smooth mixing
5. Build sets for specific moods/energy levels

---

## 🚀 Next Steps

Now that you understand the UI:

1. **Start the application**: `npm run dev:api`
2. **Upload your first track**
3. **Process it into segments**
4. **Create your first mix**
5. **Download and share**

---

## 📚 Additional Resources

- **[README.md](README.md)** - Project overview
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - API reference
- **[BACKEND_GUIDE.md](BACKEND_GUIDE.md)** - Backend details
- **[QUICKSTART.md](QUICKSTART.md)** - Quick start guide
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Testing instructions

---

**Happy mixing! 🎧🔥**

The UI is fully connected to your backend - every click, every interaction triggers real audio processing operations!
