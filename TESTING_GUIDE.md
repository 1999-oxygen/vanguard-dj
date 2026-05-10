# Vanguard DJ Testing Guide

## 🧪 Testing the Complete System

This guide helps you verify that all components are working correctly.

---

## Prerequisites

1. Node.js installed
2. Dependencies installed (`npm install`)
3. Test audio files available

---

## Test 1: Backend Startup

### Start the backend

```bash
npm run dev:api
```

### Expected Output

```
Vanguard Node Backend on port 8000
✅ Database schema initialized
📊 Tables: tracks, segments, stems, mixes, mix_timeline

VITE v5.x.x ready in xxx ms
➜  Local:   http://localhost:5173/
```

### Verify

- [ ] Backend starts without errors
- [ ] Database tables created
- [ ] Frontend starts on port 5173
- [ ] No error messages in console

---

## Test 2: Health Check

### Test the API

```bash
curl http://localhost:8000/health
```

### Expected Response

```json
{
  "status": "ok",
  "version": "node-v1.0",
  "timestamp": "2024-XX-XXTXX:XX:XX.XXXZ"
}
```

### Verify

- [ ] Returns 200 status code
- [ ] JSON response is valid
- [ ] Timestamp is current

---

## Test 3: Track Upload

### Upload a test file

```bash
curl -X POST -F "file=@test_120bpm.wav" http://localhost:8000/tracks/upload
```

### Expected Response

```json
{
  "success": true,
  "trackId": "track_XXXXXXXXXX",
  "filename": "test_120bpm.wav",
  "metadata": {
    "duration": 30,
    "sampleRate": 44100,
    "channels": 2,
    "bitrate": 320000
  }
}
```

### Verify

- [ ] Returns success: true
- [ ] trackId is generated
- [ ] Metadata is extracted
- [ ] File appears in `uploads/` directory

---

## Test 4: Track Processing

### Process the uploaded track

```bash
curl -X POST http://localhost:8000/tracks/track_XXXXXXXXXX/process
```

(Replace `track_XXXXXXXXXX` with actual track ID from Test 3)

### Expected Response

```json
{
  "success": true,
  "trackId": "track_XXXXXXXXXX",
  "segmentCount": 6,
  "segments": [
    {
      "id": "seg_track_XXXXXXXXXX_0",
      "startTime": 0,
      "duration": 7.68,
      "energy": 0.75,
      "bpm": 120
    }
  ]
}
```

### Verify

- [ ] Returns success: true
- [ ] Segments are created
- [ ] Segment files exist in `data/segments/`
- [ ] Database has segment records

### Check Database

```bash
sqlite3 data/vanguard.db "SELECT COUNT(*) FROM segments;"
```

Should return the segment count.

---

## Test 5: List Segments

### Get all segments

```bash
curl http://localhost:8000/segments
```

### Expected Response

```json
{
  "success": true,
  "segments": [
    {
      "id": "seg_track_XXXXXXXXXX_0",
      "track_id": "track_XXXXXXXXXX",
      "track_filename": "test_120bpm.wav",
      "start_time": 0,
      "end_time": 7.68,
      "duration": 7.68,
      "bpm": 120,
      "energy": 0.75,
      "stems": []
    }
  ]
}
```

### Verify

- [ ] Returns success: true
- [ ] Segments array is populated
- [ ] Metadata is correct
- [ ] Stems array exists (empty initially)

---

## Test 6: Stem Separation

### Separate stems for a segment

```bash
curl -X POST http://localhost:8000/segments/seg_track_XXXXXXXXXX_0/separate-stems
```

### Expected Response

```json
{
  "success": true,
  "segmentId": "seg_track_XXXXXXXXXX_0",
  "stems": [
    {
      "id": "stem_seg_track_XXXXXXXXXX_0_vocals",
      "type": "vocals",
      "path": "/data/stems/seg_track_XXXXXXXXXX_0/vocals.wav"
    },
    {
      "id": "stem_seg_track_XXXXXXXXXX_0_drums",
      "type": "drums",
      "path": "/data/stems/seg_track_XXXXXXXXXX_0/drums.wav"
    },
    {
      "id": "stem_seg_track_XXXXXXXXXX_0_bass",
      "type": "bass",
      "path": "/data/stems/seg_track_XXXXXXXXXX_0/bass.wav"
    },
    {
      "id": "stem_seg_track_XXXXXXXXXX_0_other",
      "type": "other",
      "path": "/data/stems/seg_track_XXXXXXXXXX_0/other.wav"
    }
  ]
}
```

### Verify

- [ ] Returns success: true
- [ ] 4 stems are created
- [ ] Stem files exist in `data/stems/seg_track_XXXXXXXXXX_0/`
- [ ] Each stem is a valid WAV file

### Check Stem Files

```bash
ls -lh data/stems/seg_track_XXXXXXXXXX_0/
```

Should show 4 WAV files: vocals.wav, drums.wav, bass.wav, other.wav

---

## Test 7: Mix Creation

### Create a mix from segments

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "name": "Test Mix",
    "timeline": [
      {
        "segmentId": "seg_track_XXXXXXXXXX_0",
        "position": 0,
        "duration": 7.68,
        "transitionType": "crossfade",
        "transitionDuration": 2.0,
        "stemConfig": {
          "vocals": 1.0,
          "drums": 1.0,
          "bass": 1.0,
          "other": 1.0
        }
      },
      {
        "segmentId": "seg_track_XXXXXXXXXX_1",
        "position": 5.68,
        "duration": 7.68,
        "transitionType": "crossfade",
        "transitionDuration": 2.0,
        "stemConfig": {
          "vocals": 1.0,
          "drums": 1.0,
          "bass": 1.0,
          "other": 1.0
        }
      }
    ]
  }' \
  http://localhost:8000/mixes/create
```

### Expected Response

```json
{
  "success": true,
  "mixId": "mix_XXXXXXXXXX",
  "path": "/data/mixes/mix_XXXXXXXXXX.wav",
  "duration": 13.36
}
```

### Verify

- [ ] Returns success: true
- [ ] Mix file is created in `data/mixes/`
- [ ] Duration is calculated correctly
- [ ] Mix file is playable

### Check Mix File

```bash
ls -lh data/mixes/mix_XXXXXXXXXX.wav
```

Should show a WAV file with reasonable size.

---

## Test 8: List Mixes

### Get all mixes

```bash
curl http://localhost:8000/mixes
```

### Expected Response

```json
{
  "success": true,
  "mixes": [
    {
      "id": "mix_XXXXXXXXXX",
      "name": "Test Mix",
      "duration": 13.36,
      "created_at": "2024-XX-XXTXX:XX:XX.XXXZ",
      "timeline": [...]
    }
  ]
}
```

### Verify

- [ ] Returns success: true
- [ ] Mix appears in list
- [ ] Timeline is included
- [ ] Metadata is correct

---

## Test 9: Frontend UI

### Open the application

Open browser to: `http://localhost:5173`

### Test Upload Tab

1. Click "Upload & Process" tab
2. Upload a test audio file
3. Click "Process Track"

**Verify:**
- [ ] Upload completes successfully
- [ ] Track appears in list
- [ ] Processing completes
- [ ] Success message appears
- [ ] Automatically switches to Segment Library

### Test Segment Library

1. View segments in library
2. Check metadata display
3. Click "Separate Stems" on a segment

**Verify:**
- [ ] Segments are displayed
- [ ] Energy bars are visible
- [ ] Metadata is correct (BPM, key, energy)
- [ ] Stem separation completes
- [ ] Badge changes to "Stems Ready"

### Test Mix Timeline

1. Click "Mix Timeline" tab
2. Click segments to add to timeline
3. Configure transitions
4. Enter mix name
5. Click "Create Mix"

**Verify:**
- [ ] Segments add to timeline
- [ ] Transition controls work
- [ ] Mix creation completes
- [ ] Success message appears
- [ ] Mix appears in "Saved Mixes"

---

## Test 10: Static File Serving

### Access segment file

```bash
curl -I http://localhost:8000/data/segments/seg_track_XXXXXXXXXX_0.wav
```

### Expected Response

```
HTTP/1.1 200 OK
Content-Type: audio/wav
Content-Length: XXXXXX
```

### Verify

- [ ] Returns 200 status
- [ ] Content-Type is audio/wav
- [ ] File is accessible

### Access stem file

```bash
curl -I http://localhost:8000/data/stems/seg_track_XXXXXXXXXX_0/vocals.wav
```

### Verify

- [ ] Returns 200 status
- [ ] Stem file is accessible

### Access mix file

```bash
curl -I http://localhost:8000/data/mixes/mix_XXXXXXXXXX.wav
```

### Verify

- [ ] Returns 200 status
- [ ] Mix file is accessible

---

## Test 11: Database Integrity

### Check all tables

```bash
sqlite3 data/vanguard.db << EOF
SELECT COUNT(*) as tracks FROM tracks;
SELECT COUNT(*) as segments FROM segments;
SELECT COUNT(*) as stems FROM stems;
SELECT COUNT(*) as mixes FROM mixes;
SELECT COUNT(*) as timeline_items FROM mix_timeline;
EOF
```

### Verify

- [ ] All tables have records
- [ ] Counts match expected values
- [ ] No errors in queries

### Check foreign keys

```bash
sqlite3 data/vanguard.db << EOF
SELECT s.id, s.track_id, t.id 
FROM segments s 
LEFT JOIN tracks t ON s.track_id = t.id 
WHERE t.id IS NULL;
EOF
```

Should return no results (all foreign keys valid).

---

## Test 12: Error Handling

### Test invalid track ID

```bash
curl -X POST http://localhost:8000/tracks/invalid_id/process
```

### Expected Response

```json
{
  "success": false,
  "error": "Track not found"
}
```

### Verify

- [ ] Returns 404 status
- [ ] Error message is clear

### Test invalid segment ID

```bash
curl -X POST http://localhost:8000/segments/invalid_id/separate-stems
```

### Expected Response

```json
{
  "success": false,
  "error": "Segment not found"
}
```

### Verify

- [ ] Returns 404 status
- [ ] Error message is clear

---

## Test 13: Performance

### Measure processing times

1. Upload a 3-minute track
2. Time the processing steps

**Expected Times:**
- Upload: < 1 second
- Processing: 5-10 seconds
- Stem separation (FFmpeg): 5-10 seconds per segment
- Stem separation (Demucs): 20-30 seconds per segment
- Mix creation: 10-20 seconds

### Verify

- [ ] Processing completes in reasonable time
- [ ] No timeouts
- [ ] No memory errors

---

## Test 14: Cleanup

### Remove test data

```bash
# Remove segments
rm -rf data/segments/*

# Remove stems
rm -rf data/stems/*

# Remove mixes
rm -rf data/mixes/*

# Reset database
rm data/vanguard.db

# Restart server
npm run dev:api
```

### Verify

- [ ] Database recreates successfully
- [ ] Tables are empty
- [ ] Server starts normally

---

## Troubleshooting

### Backend won't start

**Check:**
1. Port 8000 is not in use: `lsof -i :8000`
2. Dependencies installed: `npm list`
3. Node version: `node --version` (should be 14+)

### Upload fails

**Check:**
1. File format is supported (WAV, MP3, FLAC)
2. File size is reasonable (< 100MB)
3. `uploads/` directory exists and is writable

### Processing fails

**Check:**
1. FFmpeg is installed: `npm list @ffmpeg-installer/ffmpeg`
2. Audio file is valid (play it in another app)
3. Disk space is available: `df -h`

### Stem separation fails

**Check:**
1. Segment file exists in `data/segments/`
2. Demucs is installed (optional): `which demucs`
3. FFmpeg fallback is working

### Mix creation fails

**Check:**
1. All segments exist in database
2. Segment files exist on disk
3. Disk space is available
4. Timeline has at least 1 segment

---

## Success Criteria

All tests should pass with:

- ✅ No errors in console
- ✅ All API endpoints responding
- ✅ Files created in correct directories
- ✅ Database records created
- ✅ Frontend UI working
- ✅ Audio files playable

---

## Automated Testing Script

Create `test.sh`:

```bash
#!/bin/bash

echo "🧪 Vanguard DJ Test Suite"
echo "=========================="

# Test 1: Health Check
echo "Test 1: Health Check"
curl -s http://localhost:8000/health | jq .
echo ""

# Test 2: Upload Track
echo "Test 2: Upload Track"
TRACK_ID=$(curl -s -X POST -F "file=@test_120bpm.wav" http://localhost:8000/tracks/upload | jq -r .trackId)
echo "Track ID: $TRACK_ID"
echo ""

# Test 3: Process Track
echo "Test 3: Process Track"
curl -s -X POST http://localhost:8000/tracks/$TRACK_ID/process | jq .
echo ""

# Test 4: List Segments
echo "Test 4: List Segments"
SEGMENT_ID=$(curl -s http://localhost:8000/segments | jq -r '.segments[0].id')
echo "Segment ID: $SEGMENT_ID"
echo ""

# Test 5: Separate Stems
echo "Test 5: Separate Stems"
curl -s -X POST http://localhost:8000/segments/$SEGMENT_ID/separate-stems | jq .
echo ""

echo "✅ All tests complete!"
```

Run with:
```bash
chmod +x test.sh
./test.sh
```

---

**Happy testing! 🧪✅**
