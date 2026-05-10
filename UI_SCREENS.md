# Vanguard DJ - UI Screen Guide

## 🎨 Visual Walkthrough

This guide shows you what each screen looks like and how to use it.

---

## 🏠 Main Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER                                                          │
│  ┌──────────────────┐                    ┌────────────────────┐ │
│  │ Vanguard DJ      │                    │ 5 Tracks           │ │
│  │ Professional     │                    │ 12 Segments        │ │
│  │ Audio Mixing     │                    │ 3 Mixes            │ │
│  └──────────────────┘                    └────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  NAVIGATION TABS                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────┐ │
│  │ Upload &    │ │ Segment     │ │ Mix         │ │ Saved    │ │
│  │ Process     │ │ Library     │ │ Timeline    │ │ Mixes    │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MAIN CONTENT AREA                                               │
│  (Changes based on selected tab)                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📤 Screen 1: Upload & Process

### Upload Area

```
┌─────────────────────────────────────────────────────────────────┐
│  Upload Tracks                                                   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │                        ⬆️                                  │  │
│  │                                                            │  │
│  │           Click to upload audio files                      │  │
│  │                                                            │  │
│  │        WAV, MP3, FLAC, M4A, OGG supported                  │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Track List

```
┌─────────────────────────────────────────────────────────────────┐
│  Uploaded Tracks                                                 │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🎵 my_song.wav                          [Process Track]   │  │
│  │ Duration: 180.5s | Sample Rate: 44100Hz | Channels: 2     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🎵 another_track.mp3                    [Ready ✓]         │  │
│  │ Duration: 240.0s | BPM: 128 | Key: Am                     │  │
│  │ ✅ Processed - Ready for mixing                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### What You See

- **Upload area**: Large, dashed border box
- **Track cards**: Each uploaded track in a card
- **Metadata**: Duration, sample rate, channels, BPM, key
- **Status**: Processing indicator or Ready checkmark
- **Action button**: "Process Track" or "Ready"

---

## 📚 Screen 2: Segment Library

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────┐  ┌──────────────────────────────┐ │
│  │  SEGMENT LIST           │  │  SEGMENT DETAILS             │ │
│  │  (Left Panel)           │  │  (Right Panel)               │ │
│  │                         │  │                              │ │
│  │  All segments from      │  │  Click a segment to view     │ │
│  │  all processed tracks   │  │  full details here           │ │
│  │                         │  │                              │ │
│  └─────────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Segment Card

```
┌─────────────────────────────────────────────────────────────────┐
│  🌊 seg_track_123_0                [Stems Ready ✓] [+ Add]     │
│  my_song.wav                                                    │
│                                                                  │
│  Time: 0.0s | Duration: 7.68s | BPM: 128 | Key: Am             │
│                                                                  │
│  Energy ████████████████░░░░░░░░ 75%                            │
│                                                                  │
│  [vocals] [drums] [bass] [other]                                │
└─────────────────────────────────────────────────────────────────┘
```

### Color Coding

**High Energy (>70%)**
```
Energy ████████████████████ 85%
       ↑ Pink/Red gradient
```

**Medium Energy (40-70%)**
```
Energy ████████████░░░░░░░░ 60%
       ↑ Cyan/Blue gradient
```

**Low Energy (<40%)**
```
Energy ██████░░░░░░░░░░░░░░ 30%
       ↑ Blue/Indigo gradient
```

### What You See

- **Segment ID**: Unique identifier
- **Track name**: Original filename
- **Metadata**: Time, duration, BPM, key
- **Energy bar**: Visual energy indicator (color-coded)
- **Stem badges**: If stems are separated
- **Action buttons**: "Separate Stems" or "Add to Mix"

---

## ⚡ Screen 3: Mix Timeline

### Timeline Header

```
┌─────────────────────────────────────────────────────────────────┐
│  Mix Timeline                                                    │
│                                                                  │
│  ┌────────────────────────────────┐  Duration: 2:45             │
│  │ Mix name...                    │  Segments: 5                │
│  └────────────────────────────────┘  [Create Mix]               │
└─────────────────────────────────────────────────────────────────┘
```

### Timeline Items

```
┌─────────────────────────────────────────────────────────────────┐
│  #1 seg_track_123_0                                      [🗑️]   │
│  Position: 0:00 | Duration: 7.68s                               │
│  BPM: 128 | Key: Am | Energy: 75%                               │
│                                                                  │
│  [Crossfade ▼]  [2.0s]                                          │
│  ████████████████░░░░░░░░                                       │
└─────────────────────────────────────────────────────────────────┘
│                    ⚡ crossfade (2.0s)                           │
┌─────────────────────────────────────────────────────────────────┐
│  #2 seg_track_456_1                                      [🗑️]   │
│  Position: 5:68 | Duration: 7.68s                               │
│  BPM: 130 | Key: Dm | Energy: 82%                               │
│                                                                  │
│  [Beatmatch ▼]  [3.0s]                                          │
│  ██████████████████░░                                           │
└─────────────────────────────────────────────────────────────────┘
│                    ⚡ beatmatch (3.0s)                           │
┌─────────────────────────────────────────────────────────────────┐
│  #3 seg_track_789_2                                      [🗑️]   │
│  Position: 10:36 | Duration: 7.68s                              │
│  BPM: 128 | Key: Am | Energy: 68%                               │
│                                                                  │
│  [Echo ▼]  [2.5s]                                               │
│  ██████████████░░░░░░                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Transition Selector

```
┌─────────────────────────────────────┐
│ Crossfade                        ▼  │
│ Beatmatch                           │
│ Echo                                │
│ Cut                                 │
└─────────────────────────────────────┘
```

### What You See

- **Position number**: Order in mix (#1, #2, #3...)
- **Segment ID**: Identifier
- **Timing**: Position and duration
- **Metadata**: BPM, key, energy
- **Transition controls**: Dropdown and duration input
- **Energy bar**: Visual indicator
- **Remove button**: Delete from timeline
- **Transition indicators**: Between segments

---

## 💿 Screen 4: Saved Mixes

### Mix Gallery

```
┌─────────────────────────────────────────────────────────────────┐
│  Saved Mixes                                                     │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 💿           │  │ 💿           │  │ 💿           │          │
│  │              │  │              │  │              │          │
│  │ My Epic Mix  │  │ Chill Vibes  │  │ Party Mix    │          │
│  │ mix_123456   │  │ mix_234567   │  │ mix_345678   │          │
│  │              │  │              │  │              │          │
│  │ Duration:    │  │ Duration:    │  │ Duration:    │          │
│  │ 15:30        │  │ 22:45        │  │ 18:20        │          │
│  │              │  │              │  │              │          │
│  │ Segments: 8  │  │ Segments: 12 │  │ Segments: 10 │          │
│  │              │  │              │  │              │          │
│  │ Created:     │  │ Created:     │  │ Created:     │          │
│  │ 5/8/2026     │  │ 5/7/2026     │  │ 5/6/2026     │          │
│  │              │  │              │  │              │          │
│  │ [Download]   │  │ [Download]   │  │ [Download]   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Mix Card Details

```
┌─────────────────────────────────────┐
│  💿                                 │
│                                     │
│  My Epic Mix                        │
│  mix_1234567890                     │
│                                     │
│  Duration: 15:30                    │
│  Segments: 8                        │
│  Created: 5/8/2026                  │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    ⬇️  Download Mix          │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### What You See

- **Mix cards**: Grid layout
- **Mix name**: Custom or auto-generated
- **Mix ID**: Unique identifier
- **Duration**: Total length
- **Segment count**: Number of segments
- **Created date**: When mix was made
- **Download button**: Get WAV file

---

## 🔔 Notifications

### Success Notification

```
┌─────────────────────────────────────┐
│  ✅ Track processed successfully!   │
│     12 segments created              │
└─────────────────────────────────────┘
```

### Error Notification

```
┌─────────────────────────────────────┐
│  ❌ Upload failed                    │
│     Please try again                 │
└─────────────────────────────────────┘
```

### Processing Notification

```
┌─────────────────────────────────────┐
│  ⏳ Processing track...              │
│     Please wait                      │
└─────────────────────────────────────┘
```

### What You See

- **Icon**: ✅ (success), ❌ (error), ⏳ (processing)
- **Message**: Clear, concise text
- **Auto-dismiss**: Disappears after 4 seconds
- **Animation**: Slides in from right

---

## 🎨 Color Guide

### Primary Colors

**Cyan** - Main accent
```
██████ #06b6d4
```

**Pink** - Secondary accent
```
██████ #ec4899
```

**Purple** - Tertiary accent
```
██████ #a855f7
```

### Status Colors

**Success (Green)**
```
██████ #10b981
```

**Error (Red)**
```
██████ #ef4444
```

**Warning (Yellow)**
```
██████ #eab308
```

**Processing (Cyan)**
```
██████ #06b6d4
```

### Energy Colors

**High Energy (>70%)**
```
████████████████████ Pink → Red
```

**Medium Energy (40-70%)**
```
████████████░░░░░░░░ Cyan → Blue
```

**Low Energy (<40%)**
```
██████░░░░░░░░░░░░░░ Blue → Indigo
```

---

## 🖱️ Interactive Elements

### Buttons

**Primary Button**
```
┌─────────────────────┐
│  Create Mix         │  ← Cyan background
└─────────────────────┘
```

**Secondary Button**
```
┌─────────────────────┐
│  Add to Timeline    │  ← Purple background
└─────────────────────┘
```

**Danger Button**
```
┌─────────────────────┐
│  🗑️ Remove           │  ← Red on hover
└─────────────────────┘
```

### Hover Effects

**Before Hover**
```
┌─────────────────────┐
│  Button             │  ← Normal state
└─────────────────────┘
```

**On Hover**
```
┌─────────────────────┐
│  Button             │  ← Brighter, glowing border
└─────────────────────┘
```

### Loading States

**Processing**
```
┌─────────────────────┐
│  ⏳ Processing...   │  ← Spinner animation
└─────────────────────┘
```

**Disabled**
```
┌─────────────────────┐
│  Button             │  ← Grayed out, no hover
└─────────────────────┘
```

---

## 📱 Responsive Design

### Desktop (>1024px)

```
┌────────────────────────────────────────────────────────┐
│  Header (full width)                                   │
├────────────────────────────────────────────────────────┤
│  Navigation (full width)                               │
├────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │  Left Panel      │  │  Right Panel             │   │
│  │  (2/3 width)     │  │  (1/3 width)             │   │
│  │                  │  │                          │   │
│  └──────────────────┘  └──────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

### Tablet (768px - 1024px)

```
┌────────────────────────────────────┐
│  Header                            │
├────────────────────────────────────┤
│  Navigation                        │
├────────────────────────────────────┤
│  ┌──────────────────────────────┐ │
│  │  Single Column               │ │
│  │  (full width)                │ │
│  │                              │ │
│  └──────────────────────────────┘ │
└────────────────────────────────────┘
```

### Mobile (<768px)

```
┌──────────────────┐
│  Header          │
├──────────────────┤
│  Nav (stacked)   │
├──────────────────┤
│  ┌────────────┐  │
│  │  Content   │  │
│  │  (full)    │  │
│  │            │  │
│  └────────────┘  │
└──────────────────┘
```

---

## 🎯 Visual Hierarchy

### Information Priority

**1. Most Important (Largest, Brightest)**
- Mix name
- Track name
- Action buttons

**2. Important (Medium Size)**
- Metadata (BPM, key, energy)
- Status indicators
- Segment IDs

**3. Supporting (Smaller, Dimmer)**
- Timestamps
- File paths
- Technical details

### Color Hierarchy

**1. Attention (Bright Colors)**
- Action buttons (cyan, pink)
- Success/error messages (green, red)
- High energy segments (pink)

**2. Information (Medium Colors)**
- Metadata text (cyan, purple)
- Energy bars (gradient)
- Borders (cyan/30%)

**3. Background (Dark Colors)**
- Cards (black/50%)
- Main background (gray-900)
- Disabled elements (gray)

---

This visual guide shows you exactly what to expect when using Vanguard DJ. The interface is designed to be intuitive, with clear visual feedback for every action! 🎨🎧
