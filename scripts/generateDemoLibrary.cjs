#!/usr/bin/env node
/**
 * @fileoverview Generate 100 synthetic demo tracks for Vanguard DJ
 * These are metadata-only entries (no audio files) for UI testing.
 * Run: node scripts/generateDemoLibrary.js
 */

const fs = require('fs');
const path = require('path');

const GENRES = [
  'Techno', 'House', 'Deep House', 'Tech House', 'Minimal',
  'Progressive House', 'Trance', 'Psytrance', 'Dubstep', 'Drum & Bass',
  'Ambient', 'Downtempo', 'Lo-Fi', 'Synthwave', 'Industrial',
  'Electro', 'Breakbeat', 'Garage', 'Trap', 'Future Bass',
];

const MOODS = [
  'Dark / Industrial', 'Energetic / Bright', 'Minimal / Cold',
  'Ambient / Deep', 'Futuristic / Drive', 'Chill / Nostalgic',
  'Melodic / Emotional', 'Raw / Underground', 'Uplifting / Euphoric',
  'Hypnotic / Groovy', 'Aggressive / Hard', 'Dreamy / Ethereal',
];

const ARTISTS = [
  'Neural Ghost', 'Deep Technic', 'Synthwave Pro', 'Resonance',
  'Retro Synth', 'Digital Ghosts', 'Unknown', 'Subterranean',
  'Granular Labs', 'Cyber Pulse', 'Vapor Drift', 'Echo Chamber',
  'Quantum Beats', 'Dark Matter', 'Neon Horizon', 'Acid Rain',
  'Binary Soul', 'Circuit Breaker', 'Data Stream', 'Electric Dreams',
  'Frequency Mod', 'Glitch Mob', 'Harmonic Resonance', 'Ion Storm',
  'Junction Box', 'Kinetic Energy', 'Laser Beam', 'Magnetic Field',
  'Neural Net', 'Oscillator', 'Pulse Width', 'Quantum Leap',
  'Resonant Filter', 'Signal Path', 'Time Domain', 'Ultraviolet',
  'Voltage Ctrl', 'Waveform', 'Xenon Flash', 'Yield Curve',
  'Zero Crossing', 'Alpha Wave', 'Beta Particle', 'Gamma Ray',
  'Delta Sleep', 'Epsilon Core', 'Zeta Function', 'Eta Meson',
  'Theta State', 'Iota Point',
];

const PREFIXES = [
  'Subterranean', 'Neon', 'Deep', 'Granular', 'Cyber', 'Vapor',
  'Quantum', 'Dark', 'Acid', 'Binary', 'Electric', 'Frequency',
  'Glitch', 'Harmonic', 'Ion', 'Junction', 'Kinetic', 'Laser',
  'Magnetic', 'Neural', 'Oscillator', 'Pulse', 'Resonant', 'Signal',
  'Time', 'Ultra', 'Voltage', 'Wave', 'Xenon', 'Zero',
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta',
];

const SUFFIXES = [
  'Vibe', 'Horizon', 'Techno', 'Echoes', 'Pulse', 'Drift',
  'Ghost', 'Pro', 'Drive', 'Rain', 'Soul', 'Dreams',
  'Mod', 'Mob', 'Storm', 'Box', 'Energy', 'Beam',
  'Field', 'Net', 'Width', 'Leap', 'Filter', 'Path',
  'Domain', 'Violet', 'Ctrl', 'Form', 'Flash', 'Curve',
  'Crossing', 'Wave', 'Particle', 'Ray', 'Sleep', 'Core',
  'Function', 'Meson', 'State', 'Point', 'Sequence', 'Loop',
  'Pattern', 'Grid', 'Matrix', 'Vector', 'Scalar', 'Tensor',
];

const CAMEL_KEYS = [
  '1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A',
  '1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B', '10B', '11B', '12B',
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateTrackName() {
  const prefix = randomItem(PREFIXES);
  const suffix = randomItem(SUFFIXES);
  const num = Math.random() > 0.5 ? ` ${String(randomInt(1, 99)).padStart(2, '0')}` : '';
  return `${prefix} ${suffix}${num}`;
}

function generateDemoTracks(count = 100) {
  const tracks = [];

  for (let i = 0; i < count; i++) {
    const genre = randomItem(GENRES);
    const bpmBase = genre === 'Techno' ? 130 :
                    genre === 'House' ? 125 :
                    genre === 'Drum & Bass' ? 174 :
                    genre === 'Dubstep' ? 140 :
                    genre === 'Trance' ? 138 :
                    genre === 'Ambient' ? 90 :
                    genre === 'Lo-Fi' ? 85 :
                    genre === 'Synthwave' ? 110 :
                    128;

    tracks.push({
      id: `demo_${Date.now()}_${i}`,
      name: generateTrackName(),
      artist: randomItem(ARTISTS),
      genre,
      key: randomItem(CAMEL_KEYS),
      bpm: bpmBase + randomInt(-5, 5),
      mood: randomItem(MOODS),
      duration: randomInt(180, 420),
      source: 'demo',
      hasAnalysis: false,
      uploadedAt: new Date().toISOString(),
    });
  }

  return tracks;
}

function main() {
  console.log('[Vanguard Demo] Generating 100 synthetic tracks...');

  const demoTracks = generateDemoTracks(100);

  // Save to a JSON file that can be imported
  const outputPath = path.join(__dirname, '..', 'public', 'demo-library.json');

  // Ensure public directory exists
  const publicDir = path.dirname(outputPath);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(demoTracks, null, 2));
  console.log(`[Vanguard Demo] Saved to ${outputPath}`);

  // Also create a browser-compatible JS module for direct import
  const jsOutputPath = path.join(__dirname, '..', 'src', 'data', 'demoLibrary.js');
  const dataDir = path.dirname(jsOutputPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(
    jsOutputPath,
    `// Auto-generated demo library - 100 synthetic tracks\nexport const DEMO_LIBRARY = ${JSON.stringify(demoTracks, null, 2)};\n`
  );
  console.log(`[Vanguard Demo] JS module saved to ${jsOutputPath}`);

  // Create an inject script for localStorage
  const injectPath = path.join(__dirname, '..', 'scripts', 'inject-demo-library.js');
  fs.writeFileSync(
    injectPath,
    `// Paste this in your browser console to inject demo tracks\nconst tracks = ${JSON.stringify(demoTracks)};\nconst existing = JSON.parse(localStorage.getItem('vanguard-playlist') || '[]');\nconst merged = [...existing, ...tracks];\nlocalStorage.setItem('vanguard-playlist', JSON.stringify(merged));\nconsole.log('Injected', tracks.length, 'demo tracks. Total:', merged.length);\nwindow.location.reload();\n`
  );
  console.log(`[Vanguard Demo] Inject script saved to ${injectPath}`);
  console.log('[Vanguard Demo] Done! Run the inject script in your browser console or import the JS module.');
}

main();

