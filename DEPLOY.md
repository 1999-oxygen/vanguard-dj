# Deploy Vanguard DJ to Vercel (Free Hosting)

This guide walks you through deploying the app to Vercel with free HTTPS, solving the Spotify OAuth connection issues permanently.

---

## Step 1: Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name it `vanguard-dj` (or any name)
3. Make it **Public** or **Private** (Vercel works with both)
4. Do NOT initialize with README (we already have one)
5. Click **Create repository**

Copy the push commands shown, then run in your terminal:

```bash
cd /Users/admin/Desktop/vanguard-dj
git remote add origin https://github.com/YOUR_USERNAME/vanguard-dj.git
git branch -M main
git push -u origin main
```

---

## Step 2: Sign Up for Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up** → choose **Continue with GitHub**
3. Authorize Vercel to access your repositories

---

## Step 3: Import & Deploy Your Project

1. In Vercel dashboard, click **Add New... → Project**
2. Find and select your `vanguard-dj` repository
3. Vercel will auto-detect Vite settings. Confirm:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Click **Deploy**

Wait ~1 minute for the build. You'll get a URL like:
```
https://vanguard-dj-abc123.vercel.app
```

---

## Step 4: Configure Environment Variables

In your Vercel project dashboard:

1. Go to **Settings → Environment Variables**
2. Add these two variables:

| Name | Value |
|------|-------|
| `VITE_SPOTIFY_CLIENT_ID` | `7d14eadd7bab468ea8cd6c291c97e565` |
| `VITE_SPOTIFY_REDIRECT_URI` | `https://vanguard-dj-abc123.vercel.app/callback` |

> Replace the URL with your actual Vercel deployment URL + `/callback`

3. Click **Save**
4. Go to **Deployments** tab and click the **...** menu on the latest deploy → **Redeploy**

---

## Step 5: Register Redirect URI in Spotify Dashboard

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Select your app
3. Click **Settings**
4. In **Redirect URIs**, add your exact Vercel URL:
   ```
   https://vanguard-dj-abc123.vercel.app/callback
   ```
5. Click **Save** at the bottom

---

## Step 6: Test the Live App

Open your Vercel URL in a browser. Click **"Connect Spotify"** — it should work immediately with no certificate warnings!

---

## Optional: Custom Domain

If you want a cleaner URL:

1. In Vercel dashboard → **Settings → Domains**
2. Add your domain (e.g., `dj.yourdomain.com`)
3. Follow DNS instructions
4. Update the `VITE_SPOTIFY_REDIRECT_URI` and Spotify Dashboard with the new domain
5. Redeploy

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | Check Vercel build logs; ensure `vercel.json` is in repo |
| Spotify says "redirect_uri_mismatch" | Double-check the URI matches exactly in both Vercel env vars and Spotify Dashboard |
| Blank page after deploy | Check browser console; Vite `base` path may need adjustment |

---

## Files Added for Deployment

- `vercel.json` — Vercel build configuration
- `.github/workflows/deploy.yml` — Auto-deploy on git push (optional)
- `DEPLOY.md` — This guide
