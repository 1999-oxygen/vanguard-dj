# 🔧 Issue Fixed: CORS and Protocol Mismatch

## ❌ The Problem

You were seeing this error:
```
unsafe attempt to load url localhost5173 from frame with url chrome-error://chromewebdata/
Domains, protocols and ports must match
```

## ✅ What Was Fixed

### 1. **Removed HTTPS from Vite**
- **Problem**: Vite was running with HTTPS enabled, but backend was HTTP
- **Fix**: Disabled HTTPS in `vite.config.js`
- **Result**: Both frontend and backend now use HTTP protocol

### 2. **Added Backend Connection Check**
- **Added**: Connection status indicator in UI header
- **Shows**: Green "Connected" or Red "Disconnected"
- **Helps**: You can immediately see if backend is running

### 3. **Improved Error Handling**
- **Added**: Better error messages
- **Shows**: Exact API URL being used
- **Helps**: Debug connection issues faster

---

## 🚀 How to Start Fresh

### 1. Stop All Running Processes

```bash
# Kill any existing processes on ports 8000 and 5173
lsof -ti:8000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### 2. Start the Application

```bash
npm run dev:api
```

This will start:
- **Backend** on `http://localhost:8000` (HTTP, not HTTPS)
- **Frontend** on `http://localhost:5173` (HTTP, not HTTPS)

### 3. Open Your Browser

Navigate to: **http://localhost:5173** (make sure it's HTTP, not HTTPS)

---

## ✅ What You Should See

### In the Terminal

```
Vanguard Node Backend on port 8000
✅ Database schema initialized
📊 Tables: tracks, segments, stems, mixes, mix_timeline

VITE v5.x.x ready in xxx ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### In the Browser

**Header should show**:
- 🟢 **Connected** (green indicator with pulsing dot)
- Track/Segment/Mix counters

**If you see**:
- 🔴 **Disconnected** (red indicator)
- Then the backend isn't running - restart with `npm run dev:api`

---

## 🔍 Verify Everything Works

### Test 1: Check Backend

Open a new terminal and run:
```bash
curl http://localhost:8000/health
```

**Expected response**:
```json
{
  "status": "ok",
  "version": "node-v1.0",
  "timestamp": "2026-05-08T..."
}
```

### Test 2: Check Frontend

Open browser to: `http://localhost:5173`

**You should see**:
- Vanguard DJ header
- Green "Connected" indicator
- Upload & Process tab
- Navigation working

### Test 3: Upload a File

1. Click the upload area
2. Select an audio file (WAV, MP3, FLAC)
3. Wait for upload to complete
4. You should see a green notification: "✅ Uploaded: filename.wav"

---

## 🐛 If Still Not Working

### Check 1: Ports in Use

```bash
lsof -i :8000 -i :5173
```

**Should show**:
- `node` process on port 8000 (backend)
- `node` process on port 5173 (frontend)

### Check 2: Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors

**You should see**:
```
✅ Backend connected: http://localhost:8000
```

**If you see errors**:
- Check that both servers are running
- Verify you're using `http://` not `https://`
- Clear browser cache and reload

### Check 3: Network Tab

1. Open browser DevTools (F12)
2. Go to Network tab
3. Reload the page
4. Look for requests to `localhost:8000`

**Should see**:
- GET `/health` - Status 200
- GET `/tracks` - Status 200
- GET `/segments` - Status 200
- GET `/mixes` - Status 200

### Check 4: CORS Headers

In Network tab, click on any request to `localhost:8000`

**Response Headers should include**:
```
Access-Control-Allow-Origin: http://localhost:5173
```

---

## 📝 Files Changed

### `vite.config.js`
- ❌ Removed `basicSsl` plugin
- ❌ Removed `https: true`
- ✅ Now uses HTTP only

### `src/VanguardDJ.jsx`
- ✅ Added `backendConnected` state
- ✅ Added `checkBackendConnection()` function
- ✅ Added connection status indicator in header
- ✅ Better error messages

---

## 🎯 Quick Restart Guide

If anything goes wrong, follow these steps:

```bash
# 1. Stop everything
lsof -ti:8000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# 2. Clear node modules (if needed)
rm -rf node_modules package-lock.json
npm install

# 3. Start fresh
npm run dev:api

# 4. Open browser
# Navigate to: http://localhost:5173
```

---

## ✅ Success Checklist

- [ ] Backend running on port 8000
- [ ] Frontend running on port 5173
- [ ] Both using HTTP (not HTTPS)
- [ ] Browser shows "Connected" indicator (green)
- [ ] No CORS errors in console
- [ ] Can upload files
- [ ] Can see tracks/segments/mixes

---

## 🎉 You're Ready!

Once you see the green "Connected" indicator, you're all set to:

1. Upload tracks
2. Process them into segments
3. Separate stems
4. Create mixes
5. Download your creations

**Happy mixing! 🎧🔥**
