# Vanguard DJ Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies

```bash
cd vanguard-dj
npm install
```

### Step 2: Start the Application

```bash
npm run dev:api
```

This command starts:
- **Backend API** on http://localhost:8000
- **Frontend UI** on http://localhost:5173

You should see:
```
Vanguard Node Backend on port 8000
✅ Database schema initialized
📊 Tables: tracks, segments, stems, mixes, mix_timeline

VITE v5.x.x ready in xxx ms
➜  Local:   http://localhost:5173/
```

### Step 3: Open the Application

Open your browser to: **http://localhost:5173**

---

## 🎵 Your First Mix

### 1. Upload a Track

1. Click the **"Upload & Process"** tab
2. Click the upload area or drag-and-drop an audio file
3. Supported formats: WAV, MP3, FLAC, M4A, OGG

**What you'll see:**
- Track appears in the "Uploaded Tracks" list
- Metadata displayed (duration, sample rate, channels)
- "Process Track" button becomes available

### 2. Process the Track

1. Click **"Process Track"** next to your uploaded file
2. Wait for processing to complete (~5-10 seconds)

**What happens:**
- Backend analyzes the audio file
- Detects beats using RMS energy analysis
- Estimates BPM from beat intervals
- Slices track into 16-bar segments
- Analyzes energy for each segment
- Saves segments to database

**What you'll see:**
- Success message: "✅ Track processed! X segments created"
- Track status changes to "Ready"
- Automatically switches to "Segment Library" tab

### 3. View Your Segments

The **Segment Library** tab shows all your segments with:

- **Segment ID** - Unique identifier
- **Time Range** - Start and end times
- **Duration** - Length in seconds
- **BPM** - Beats per minute
- **Key** - Musical key
- **Energy** - Energy level (0-100%)
- **Energy Bar** - Visual energy indicator

**Color Coding:**
- 🔴 **Pink** - High energy (>70%)
- 🔵 **Cyan** - Medium energy (40-70%)
- 🟦 **Blue** - Low energy (<40%)

### 4. Separate Stems (Optional)

For advanced mixing with individual control over vocals, drums, bass, and other elements:

1. Click **"Separate Stems"** on any segment
2. Wait for processing (~5-30 seconds depending on method)

**What happens:**
- If Demucs is installed: AI-powered stem separation
- Otherwise: FFmpeg frequency-based separation
- Creates 4 stems: vocals, drums, bass, other
- Saves stems to database

**What you'll see:**
- Success message: "✅ Stems separated for segment X"
- Segment badge changes to "Stems Ready"
- Stem tags appear below segment info

### 5. Create Your Mix

1. Switch to **"Mix Timeline"** tab
2. Click segments from the library to add them to the timeline
3. Segments appear in order on the timeline

**For each segment on the timeline:**

- **Position** - Where it starts in the mix
- **Duration** - How long it plays
- **Transition Type** - How it blends with the next segment
  - **Crossfade** - Smooth volume blend
  - **Beatmatch** - Beat-synchronized with echo
  - **Echo** - Creative echo transition
  - **Cut** - Hard cut (no transition)
- **Transition Duration** - Length of transition (0.5s - 10s)

**Customize transitions:**
1. Click a segment on the timeline
2. Use the dropdown to change transition type
3. Adjust transition duration with the number input

### 6. Save Your Mix

1. Enter a name in the "Mix name" field (optional)
2. Click **"Create Mix"**
3. Wait for processing (~10-20 seconds)

**What happens:**
- Backend loads all segments
- Applies transitions between segments
- Renders final mix to WAV file
- Saves mix to database

**What you'll see:**
- Success message with mix ID and duration
- Mix appears in "Saved Mixes" section
- Can click saved mix to load it back to timeline

### 7. Download Your Mix

Your mix is saved at:
```
http://localhost:8000/data/mixes/mix_XXXXXXXXXX.wav
```

Copy the URL from the success message and paste it in your browser to download.

---

## 🎛️ Advanced Features

### Stem Mixing

After separating stems, you can control individual elements:

1. Add a segment with stems to the timeline
2. Click the segment to select it
3. Adjust stem levels:
   - **Vocals** - 0.0 to 2.0 (0 = muted, 1.0 = normal, 2.0 = boosted)
   - **Drums** - 0.0 to 2.0
   - **Bass** - 0.0 to 2.0
   - **Other** - 0.0 to 2.0

**Example use cases:**
- Mute vocals for instrumental version
- Boost drums for high-energy sections
- Swap vocals between different songs
- Create acapella sections

### Energy-Based Selection

Filter segments by energy level:

1. In Segment Library, use the filter buttons:
   - **All** - Show all segments
   - **Processed** - Only segments with stems
   - **Unprocessed** - Segments without stems

2. Sort segments by clicking column headers

### Timeline Editing

Rearrange your mix:

1. Click **Trash** icon to remove a segment
2. Segments automatically reposition
3. Transitions update automatically

---

## 🔧 Troubleshooting

### Backend Won't Start

**Error:** `EADDRINUSE: address already in use`

**Solution:**
```bash
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=8001 node server/index.js
```

### Upload Fails

**Error:** `Failed to upload file`

**Solutions:**
1. Check file format (WAV, MP3, FLAC supported)
2. Check file size (large files may timeout)
3. Check backend is running (http://localhost:8000/health)

### Processing Fails

**Error:** `Track processing failed`

**Solutions:**
1. Check FFmpeg is installed: `npm list @ffmpeg-installer/ffmpeg`
2. Check audio file is valid (play it in another app)
3. Check backend logs for detailed error

### Stem Separation Fails

**Error:** `Stem separation failed`

**Solutions:**
1. This is normal - system falls back to FFmpeg
2. For better quality, install Demucs: `pip install demucs`
3. Check segment file exists in `data/segments/`

### Mix Creation Fails

**Error:** `Failed to create mix`

**Solutions:**
1. Check all segments exist in database
2. Check disk space is available
3. Try with fewer segments first
4. Check backend logs for details

---

## 💡 Tips & Best Practices

### For Best Results

1. **Use WAV files** - Best quality, no compression artifacts
2. **Similar BPMs** - Easier to beatmatch (±10 BPM works well)
3. **Energy matching** - Transition from similar energy levels
4. **Longer transitions** - 2-4 seconds for smooth blends
5. **Test first** - Create short mixes to test transitions

### Workflow Tips

1. **Process all tracks first** - Then browse segments
2. **Separate stems selectively** - Only when needed (saves time)
3. **Save mixes frequently** - Can reload and modify later
4. **Name your mixes** - Easier to find later
5. **Backup database** - Copy `data/vanguard.db` regularly

### Performance Tips

1. **One track at a time** - Don't upload multiple simultaneously
2. **Close unused tabs** - Saves memory
3. **Clear old data** - Delete unused segments/mixes
4. **Use SSD** - Faster processing
5. **Restart backend** - If it becomes slow

---

## 📊 Understanding the Data

### Segment Metadata

- **BPM** - Beats per minute (tempo)
- **Key** - Musical key (C, Cm, D, etc.)
- **Energy** - 0.0 to 1.0 (intensity level)
- **Danceability** - 0.0 to 1.0 (how danceable)
- **Valence** - 0.0 to 1.0 (musical positivity)
- **Beat Count** - Number of beats in segment

### Mix Timeline

- **Position** - Start time in seconds
- **Duration** - Length in seconds
- **Transition Type** - Blend method
- **Transition Duration** - Overlap length
- **Stem Config** - Individual stem levels

---

## 🎯 Next Steps

Now that you've created your first mix:

1. **Experiment with transitions** - Try different types
2. **Use stem separation** - Create unique remixes
3. **Build a library** - Process multiple tracks
4. **Create longer mixes** - Combine many segments
5. **Share your mixes** - Export and share WAV files

## 📚 Learn More

- **[README.md](README.md)** - Full project overview
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Complete API reference
- **[BACKEND_GUIDE.md](BACKEND_GUIDE.md)** - Backend deep dive

---

**Happy mixing! 🎧🔥**
