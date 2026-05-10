# Vanguard DJ Backend API Documentation

## Overview

The Vanguard DJ backend provides a comprehensive API for professional DJ mixing with AI-powered audio processing, stem separation, and seamless mix creation.

## Base URL

```
http://localhost:8000
```

## Endpoints

### Health Check

#### GET `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "version": "node-v1.0",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### Track Management

#### POST `/tracks/upload`

Upload an audio file for processing.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (audio file)

**Response:**
```json
{
  "success": true,
  "trackId": "track_1234567890",
  "filename": "my_song.wav",
  "metadata": {
    "duration": 180.5,
    "sampleRate": 44100,
    "channels": 2,
    "bitrate": 320000
  }
}
```

#### POST `/tracks/:trackId/process`

Process a track to create segments with beat detection and analysis.

**Response:**
```json
{
  "success": true,
  "trackId": "track_1234567890",
  "segmentCount": 12,
  "segments": [
    {
      "id": "seg_track_1234567890_0",
      "startTime": 0,
      "duration": 7.68,
      "energy": 0.75,
      "bpm": 128
    }
  ]
}
```

#### GET `/tracks`

Get all uploaded tracks.

**Response:**
```json
{
  "success": true,
  "tracks": [
    {
      "id": "track_1234567890",
      "filename": "my_song.wav",
      "duration": 180.5,
      "bpm": 128,
      "key": "Am",
      "processed": true,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Segment Management

#### GET `/segments`

Get all segments with optional filtering.

**Query Parameters:**
- `trackId` (optional): Filter by track ID
- `processed` (optional): Filter by stem separation status (`true`/`false`)

**Response:**
```json
{
  "success": true,
  "segments": [
    {
      "id": "seg_track_1234567890_0",
      "track_id": "track_1234567890",
      "track_filename": "my_song.wav",
      "start_time": 0,
      "end_time": 7.68,
      "duration": 7.68,
      "bpm": 128,
      "energy": 0.75,
      "danceability": 0.72,
      "valence": 0.68,
      "key": "Am",
      "beat_count": 16,
      "derivation": "BEAT_GRID_16BAR",
      "audio_path": "/path/to/segment.wav",
      "processed": true,
      "stems": [
        {
          "id": "stem_seg_track_1234567890_0_vocals",
          "segment_id": "seg_track_1234567890_0",
          "stem_type": "vocals",
          "audio_path": "/path/to/vocals.wav",
          "gain": 1.0
        }
      ]
    }
  ]
}
```

#### GET `/segments/:segmentId`

Get a specific segment with its stems.

**Response:**
```json
{
  "success": true,
  "segment": {
    "id": "seg_track_1234567890_0",
    "track_id": "track_1234567890",
    "start_time": 0,
    "end_time": 7.68,
    "duration": 7.68,
    "bpm": 128,
    "energy": 0.75,
    "stems": [...]
  }
}
```

#### POST `/segments/:segmentId/separate-stems`

Separate a segment into individual stems (vocals, drums, bass, other).

**Response:**
```json
{
  "success": true,
  "segmentId": "seg_track_1234567890_0",
  "stems": [
    {
      "id": "stem_seg_track_1234567890_0_vocals",
      "type": "vocals",
      "path": "/data/stems/seg_track_1234567890_0/vocals.wav"
    },
    {
      "id": "stem_seg_track_1234567890_0_drums",
      "type": "drums",
      "path": "/data/stems/seg_track_1234567890_0/drums.wav"
    },
    {
      "id": "stem_seg_track_1234567890_0_bass",
      "type": "bass",
      "path": "/data/stems/seg_track_1234567890_0/bass.wav"
    },
    {
      "id": "stem_seg_track_1234567890_0_other",
      "type": "other",
      "path": "/data/stems/seg_track_1234567890_0/other.wav"
    }
  ]
}
```

---

### Mix Creation

#### POST `/mixes/create`

Create a mix from timeline segments with seamless transitions.

**Request Body:**
```json
{
  "name": "My Epic Mix",
  "timeline": [
    {
      "segmentId": "seg_track_1234567890_0",
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
      "segmentId": "seg_track_1234567890_1",
      "position": 5.68,
      "duration": 7.68,
      "transitionType": "beatmatch",
      "transitionDuration": 3.0,
      "stemConfig": {
        "vocals": 0.8,
        "drums": 1.2,
        "bass": 1.0,
        "other": 0.9
      }
    }
  ]
}
```

**Transition Types:**
- `crossfade`: Smooth volume crossfade
- `beatmatch`: Beat-synchronized transition with echo
- `echo`: Echo-based transition
- `cut`: Hard cut (no transition)

**Response:**
```json
{
  "success": true,
  "mixId": "mix_1234567890",
  "path": "/data/mixes/mix_1234567890.wav",
  "duration": 180.5
}
```

#### GET `/mixes`

Get all created mixes.

**Response:**
```json
{
  "success": true,
  "mixes": [
    {
      "id": "mix_1234567890",
      "name": "My Epic Mix",
      "duration": 180.5,
      "created_at": "2024-01-01T00:00:00.000Z",
      "timeline": [...]
    }
  ]
}
```

#### GET `/mixes/:mixId`

Get a specific mix with its timeline.

**Response:**
```json
{
  "success": true,
  "mix": {
    "id": "mix_1234567890",
    "name": "My Epic Mix",
    "duration": 180.5,
    "created_at": "2024-01-01T00:00:00.000Z",
    "timeline": [
      {
        "id": "timeline_mix_1234567890_0",
        "mix_id": "mix_1234567890",
        "segment_id": "seg_track_1234567890_0",
        "position": 0,
        "duration": 7.68,
        "transition_type": "crossfade",
        "transition_duration": 2.0,
        "stem_config": "{\"vocals\":1.0,\"drums\":1.0,\"bass\":1.0,\"other\":1.0}",
        "audio_path": "/path/to/segment.wav",
        "segment_duration": 7.68,
        "energy": 0.75,
        "bpm": 128,
        "key": "Am"
      }
    ]
  }
}
```

---

### Legacy Endpoints

#### POST `/analyze`

Analyze a single audio file (legacy endpoint).

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (audio file)

**Response:**
```json
{
  "success": true,
  "bpm": 128,
  "key": "Cm",
  "duration": 60,
  "segments": [...],
  "beats": [...],
  "energy_curve": [...],
  "source": "node-ffmpeg-backend"
}
```

#### POST `/analyze_batch`

Analyze multiple audio files (legacy endpoint).

**Request:**
- Content-Type: `multipart/form-data`
- Body: `files` (array of audio files, max 10)

**Response:**
```json
{
  "success": true,
  "results": [...]
}
```

---

## Audio Processing Features

### Beat Detection
- Automatic beat detection using RMS energy analysis
- Configurable beat grid generation
- BPM estimation from beat intervals

### Segment Creation
- Automatic segmentation at beat boundaries
- 16-bar segments by default
- Energy analysis for each segment
- Metadata extraction (BPM, key, danceability, valence)

### Stem Separation
- **Demucs** (if installed): State-of-the-art AI stem separation
- **FFmpeg fallback**: Frequency-based stem extraction
- Stems: vocals, drums, bass, other
- Individual gain control per stem

### Mix Engine
- **Crossfade**: Smooth volume transitions
- **Beatmatch**: Beat-synchronized mixing with echo effects
- **Echo**: Echo-based creative transitions
- **Cut**: Hard cuts for dramatic changes
- Configurable transition durations
- Per-segment stem mixing

---

## Database Schema

### Tables

#### tracks
- `id`: Unique track identifier
- `filename`: Original filename
- `original_path`: File system path
- `duration`: Track duration in seconds
- `bpm`: Beats per minute
- `key`: Musical key
- `sample_rate`: Audio sample rate
- `channels`: Number of audio channels
- `processed`: Processing status
- `created_at`: Upload timestamp

#### segments
- `id`: Unique segment identifier
- `track_id`: Parent track reference
- `start_time`: Start time in seconds
- `end_time`: End time in seconds
- `duration`: Segment duration
- `bpm`: Beats per minute
- `energy`: Energy level (0-1)
- `danceability`: Danceability score (0-1)
- `valence`: Musical positivity (0-1)
- `key`: Musical key
- `beat_count`: Number of beats
- `derivation`: Segmentation method
- `audio_path`: File system path
- `processed`: Stem separation status
- `created_at`: Creation timestamp

#### stems
- `id`: Unique stem identifier
- `segment_id`: Parent segment reference
- `stem_type`: vocals, drums, bass, or other
- `audio_path`: File system path
- `gain`: Volume gain multiplier
- `created_at`: Creation timestamp

#### mixes
- `id`: Unique mix identifier
- `name`: Mix name
- `duration`: Total duration
- `created_at`: Creation timestamp

#### mix_timeline
- `id`: Unique timeline item identifier
- `mix_id`: Parent mix reference
- `segment_id`: Segment reference
- `position`: Position in timeline (seconds)
- `duration`: Item duration
- `transition_type`: Transition method
- `transition_duration`: Transition length
- `stem_config`: JSON stem configuration
- `created_at`: Creation timestamp

---

## Error Handling

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200`: Success
- `404`: Resource not found
- `500`: Server error

---

## Static File Serving

The following directories are served statically:

- `/data/segments`: Segment audio files
- `/data/stems`: Stem audio files
- `/data/mixes`: Mix audio files

Access files directly via:
```
http://localhost:8000/data/segments/seg_track_1234567890_0.wav
http://localhost:8000/data/stems/seg_track_1234567890_0/vocals.wav
http://localhost:8000/data/mixes/mix_1234567890.wav
```

---

## Workflow Example

1. **Upload a track:**
   ```bash
   curl -X POST -F "file=@song.wav" http://localhost:8000/tracks/upload
   ```

2. **Process the track:**
   ```bash
   curl -X POST http://localhost:8000/tracks/track_1234567890/process
   ```

3. **Get segments:**
   ```bash
   curl http://localhost:8000/segments?trackId=track_1234567890
   ```

4. **Separate stems for a segment:**
   ```bash
   curl -X POST http://localhost:8000/segments/seg_track_1234567890_0/separate-stems
   ```

5. **Create a mix:**
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     -d '{"name":"My Mix","timeline":[...]}' \
     http://localhost:8000/mixes/create
   ```

6. **Download the mix:**
   ```bash
   curl -O http://localhost:8000/data/mixes/mix_1234567890.wav
   ```
