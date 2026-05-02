#!/bin/bash
# Vanguard DJ - Push to GitHub & Deploy to Vercel
# Run these commands one by one in your terminal

echo "=== STEP 1: Create GitHub Repo ==="
echo "1. Go to https://github.com/new"
echo "2. Name: vanguard-dj"
echo "3. Choose Public or Private"
echo "4. DO NOT initialize with README"
echo "5. Click 'Create repository'"
echo ""
echo "After creating, copy the HTTPS URL (e.g., https://github.com/YOURNAME/vanguard-dj.git)"
echo ""

read -p "Paste your GitHub repo URL here: " REPO_URL

echo ""
echo "=== STEP 2: Push Code to GitHub ==="
cd /Users/admin/Desktop/vanguard-dj
git remote add origin "$REPO_URL"
git branch -M main
git push -u origin main

echo ""
echo "=== STEP 3: Vercel Deployment ==="
echo "1. Go to https://vercel.com/signup"
echo "2. Click 'Continue with GitHub'"
echo "3. Authorize Vercel"
echo "4. Click 'Add New... → Project'"
echo "5. Find 'vanguard-dj' and click Import"
echo "6. Vercel auto-detects Vite. Click 'Deploy'"
echo ""

echo "=== STEP 4: Environment Variables ==="
echo "After deploy, in Vercel dashboard:"
echo "1. Go to Settings → Environment Variables"
echo "2. Add: VITE_SPOTIFY_CLIENT_ID = 7d14eadd7bab468ea8cd6c291c97e565"
echo "3. Add: VITE_SPOTIFY_REDIRECT_URI = https://YOUR-PROJECT.vercel.app/callback"
echo "4. Click Save, then Redeploy"
echo ""

echo "=== STEP 5: Spotify Dashboard ==="
echo "1. Go to https://developer.spotify.com/dashboard"
echo "2. Select your app → Settings"
echo "3. Add Redirect URI: https://YOUR-PROJECT.vercel.app/callback"
echo "4. Click Save"
echo ""

echo "Done! Your app will be live with working Spotify OAuth."
