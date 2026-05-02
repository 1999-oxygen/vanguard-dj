#!/usr/bin/env node
/**
 * @fileoverview Download royalty-free music from legitimate Creative Commons sources.
 *
 * Sources supported:
 *   - Free Music Archive (FMA) - requires API key
 *   - Jamendo - requires API key
 *   - ccMixter - direct downloads (no key needed)
 *
 * Usage:
 *   node scripts/downloadRoyaltyFree.cjs --source jamendo --api-key YOUR_KEY --count 50
 *   node scripts/downloadRoyaltyFree.cjs --source ccmixter --count 20
 *   node scripts/downloadRoyaltyFree.cjs --source fma --api-key YOUR_KEY --count 30
 *
 * IMPORTANT: This script only downloads music explicitly marked as Creative Commons
 * or royalty-free by the respective platforms. You are responsible for complying
 * with each track's specific license terms (attribution, non-commercial, etc.).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DOWNLOAD_DIR = path.join(__dirname, '..', 'public', 'music');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const file = fs.createWriteStream(dest);
    client.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(dest);
      });
    }).on('error', reject);
  });
}

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// ─── Jamendo ───
async function downloadFromJamendo(apiKey, count = 20) {
  console.log(`[Jamendo] Fetching ${count} tracks...`);
  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${apiKey}&format=json&limit=${count}&order=popularity_total&ccsa=1&audioformat=mp32`;

  const data = await fetchJSON(url);
  if (!data.results || data.results.length === 0) {
    console.log('[Jamendo] No tracks found. Check your API key.');
    return;
  }

  ensureDir(DOWNLOAD_DIR);
  let downloaded = 0;

  for (const track of data.results) {
    const filename = `${track.artist_name} - ${track.name}.mp3`.replace(/[^a-zA-Z0-9\s\-_\.]/g, '');
    const dest = path.join(DOWNLOAD_DIR, filename);

    if (fs.existsSync(dest)) {
      console.log(`[Jamendo] Skip (exists): ${filename}`);
      continue;
    }

    try {
      console.log(`[Jamendo] Downloading: ${filename}`);
      await downloadFile(track.audio, dest);
      console.log(`[Jamendo] Saved: ${filename}`);
      downloaded++;
    } catch (err) {
      console.error(`[Jamendo] Failed: ${filename} - ${err.message}`);
    }
  }

  console.log(`[Jamendo] Done. Downloaded ${downloaded}/${data.results.length} tracks.`);
  console.log(`[Jamendo] Files saved to: ${DOWNLOAD_DIR}`);
}

// ─── Free Music Archive (FMA) ───
async function downloadFromFMA(apiKey, count = 20) {
  console.log(`[FMA] Fetching ${count} tracks...`);
  console.log('[FMA] Note: FMA API v2 requires an API key from https://freemusicarchive.org/api');

  // FMA API endpoint (v2)
  const url = `https://freemusicarchive.org/api/get/tracks.json?api_key=${apiKey}&limit=${count}`;

  try {
    const data = await fetchJSON(url);
    if (!data.dataset || data.dataset.length === 0) {
      console.log('[FMA] No tracks found. Check your API key.');
      return;
    }

    ensureDir(DOWNLOAD_DIR);
    let downloaded = 0;

    for (const track of data.dataset) {
      const filename = `${track.artist_name} - ${track.track_title}.mp3`.replace(/[^a-zA-Z0-9\s\-_\.]/g, '');
      const dest = path.join(DOWNLOAD_DIR, filename);

      if (fs.existsSync(dest)) {
        console.log(`[FMA] Skip (exists): ${filename}`);
        continue;
      }

      // FMA provides download URLs in the track data
      const downloadUrl = track.track_url || track.track_file_url;
      if (!downloadUrl) {
        console.log(`[FMA] No download URL for: ${filename}`);
        continue;
      }

      try {
        console.log(`[FMA] Downloading: ${filename}`);
        await downloadFile(downloadUrl, dest);
        console.log(`[FMA] Saved: ${filename}`);
        downloaded++;
      } catch (err) {
        console.error(`[FMA] Failed: ${filename} - ${err.message}`);
      }
    }

    console.log(`[FMA] Done. Downloaded ${downloaded}/${data.dataset.length} tracks.`);
  } catch (err) {
    console.error(`[FMA] Error: ${err.message}`);
    console.log('[FMA] The FMA API may have changed or require different authentication.');
  }
}

// ─── ccMixter ───
async function downloadFromCcMixter(count = 20) {
  console.log(`[ccMixter] Fetching ${count} tracks...`);
  console.log('[ccMixter] Using ccMixter API (no key required for basic access)');

  // ccMixter API for recent uploads
  const url = `http://ccmixter.org/api/query?f=json&limit=${count}&sort=rank&tags=remix`;

  try {
    const data = await fetchJSON(url);
    if (!Array.isArray(data) || data.length === 0) {
      console.log('[ccMixter] No tracks found.');
      return;
    }

    ensureDir(DOWNLOAD_DIR);
    let downloaded = 0;

    for (const track of data) {
      const filename = `${track.user_name} - ${track.upload_name}.mp3`.replace(/[^a-zA-Z0-9\s\-_\.]/g, '');
      const dest = path.join(DOWNLOAD_DIR, filename);

      if (fs.existsSync(dest)) {
        console.log(`[ccMixter] Skip (exists): ${filename}`);
        continue;
      }

      // ccMixter files are at files.ccmixter.org
      const fileUrl = track.files?.[0]?.download_url || track.file_page_url;
      if (!fileUrl) {
        console.log(`[ccMixter] No download URL for: ${filename}`);
        continue;
      }

      try {
        console.log(`[ccMixter] Downloading: ${filename}`);
        await downloadFile(fileUrl, dest);
        console.log(`[ccMixter] Saved: ${filename}`);
        downloaded++;
      } catch (err) {
        console.error(`[ccMixter] Failed: ${filename} - ${err.message}`);
      }
    }

    console.log(`[ccMixter] Done. Downloaded ${downloaded}/${data.length} tracks.`);
  } catch (err) {
    console.error(`[ccMixter] Error: ${err.message}`);
    console.log('[ccMixter] The ccMixter API may be temporarily unavailable.');
  }
}

// ─── Main ───
function main() {
  const args = process.argv.slice(2);
  const source = args.find(a => a.startsWith('--source='))?.split('=')[1] || 'jamendo';
  const apiKey = args.find(a => a.startsWith('--api-key='))?.split('=')[1];
  const count = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1] || '20', 10);

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Vanguard DJ - Royalty-Free Music Downloader            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  This tool downloads Creative Commons licensed music       ║');
  console.log('║  from legitimate sources. You MUST comply with each        ║');
  console.log('║  track\'s license (attribution, non-commercial, etc.).      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log();

  if (source === 'jamendo') {
    if (!apiKey) {
      console.log('❌ Jamendo requires an API key.');
      console.log('   Get one free at: https://developer.jamendo.com/v3.0');
      console.log('   Usage: node scripts/downloadRoyaltyFree.cjs --source=jamendo --api-key=YOUR_KEY --count=50');
      return;
    }
    downloadFromJamendo(apiKey, count);
  } else if (source === 'fma') {
    if (!apiKey) {
      console.log('❌ FMA requires an API key.');
      console.log('   Get one at: https://freemusicarchive.org/api');
      console.log('   Usage: node scripts/downloadRoyaltyFree.cjs --source=fma --api-key=YOUR_KEY --count=30');
      return;
    }
    downloadFromFMA(apiKey, count);
  } else if (source === 'ccmixter') {
    downloadFromCcMixter(count);
  } else {
    console.log(`❌ Unknown source: ${source}`);
    console.log('   Supported: jamendo, fma, ccmixter');
  }
}

main();

