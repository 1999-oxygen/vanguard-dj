# Vanguard DJ Deployment Guide

## Free Backend Hosting Options

### Option 1: Render.com (Recommended - Easiest)
**Pros:** Native GitHub integration, simple setup, automatic deploys, FREE PostgreSQL
**Cons:** Free web service sleeps after 15 min inactivity (cold start ~30s)

1. Go to [render.com](https://render.com) and sign up with GitHub
2. Click "New +" → "Blueprint"
3. Connect your `1999-oxygen/vanguard-dj` repo
4. Render will auto-detect `render.yaml` and configure:
   - **Web Service:** `vanguard-api` (Python/FastAPI)
   - **Database:** `vanguard-postgres` (PostgreSQL, free tier)
5. Your backend will be live at `https://vanguard-api.onrender.com`

**After deploy, set Vercel env var:**
```
VITE_VANGUARD_API_URL=https://vanguard-api.onrender.com
```

---

### Option 2: Fly.io (Stays Running - Best Performance)
**Pros:** Free tier stays awake, 3 apps, good for production
**Cons:** Requires CLI installation, slightly more complex

1. Install Fly CLI: `powershell -Command "irm https://fly.io/install.ps1 | iex"`
2. Sign up: `fly auth signup`
3. Deploy:
```bash
fly launch --dockerfile Dockerfile
fly deploy
```
4. Your backend will be live at `https://vanguard-api.fly.dev`

**After deploy, set Vercel env var:**
```
VITE_VANGUARD_API_URL=https://vanguard-api.fly.dev
```

---

### Option 3: Koyeb (Stays Running - Good Alternative)
**Pros:** Free tier stays awake, GitHub integration, easy UI
**Cons:** 2 apps limit on free tier

1. Go to [koyeb.com](https://koyeb.com) and sign up with GitHub
2. Click "Create App" → "GitHub"
3. Select `1999-oxygen/vanguard-dj`
4. Set:
   - **Build command:** `pip install -r api/requirements.txt`
   - **Run command:** `python api/run.py --host 0.0.0.0 --port 8000`
   - **Port:** `8000`
5. Deploy

**After deploy, set Vercel env var:**
```
VITE_VANGUARD_API_URL=https://your-app-name.koyeb.app
```

---

## Updating Vercel Frontend Environment Variables

1. Go to [vercel.com](https://vercel.com) → Your project
2. Click **Settings** → **Environment Variables**
3. Add:
   - `Name:` `VITE_VANGUARD_API_URL`
   - `Value:` Your backend URL (from above)
4. Click **Save**
5. Redeploy: Go to **Deployments** → Click **...** on latest → **Redeploy**

---

## Important Notes for Audio Processing Backends

- **Free tier limitations:** Audio analysis with librosa is CPU/memory intensive. For heavy usage, consider upgrading.
- **File uploads:** Free tiers have request size limits (usually ~100MB). Large audio files may fail.
- **Database:** The backend auto-detects `DATABASE_URL` for PostgreSQL (production) and falls back to SQLite (local dev).

