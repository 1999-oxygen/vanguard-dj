import { useState, useEffect, useCallback } from 'react';

/**
 * @fileoverview useSpotify Hook
 * Manages Spotify OAuth (PKCE), track search, user playlist fetching,
 * playlist track resolution, and preview audio buffer loading.
 *
 * CRITICAL: Redirect URI is calculated at RUNTIME from window.location
 * so it always matches whatever URL you're actually using (localhost, IP, or Vercel).
 */
const DEFAULT_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;

// Calculate redirect URI dynamically at runtime so it ALWAYS matches the current URL
// This solves the #1 cause of "redirect_uri mismatch" errors
const getRuntimeRedirectUri = () => {
  // Use env var if explicitly set, otherwise auto-detect from browser URL
  const envUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
  if (envUri && envUri !== 'undefined' && envUri.trim() !== '') {
    return envUri;
  }
  // Auto-detect: https://current-host.com/callback
  return `${window.location.origin}/callback`;
};

const TOKEN_STORAGE_KEY = 'spotify_access_token'; // sessionStorage — cleared on tab close, XSS-resistant vs localStorage

/**
 * Validate that a client ID looks like a real Spotify client ID (32 hex chars).
 */
const isValidClientId = (id) => typeof id === 'string' && /^[a-f0-9]{32}$/i.test(id);

/**
 * Check if Spotify OAuth is properly configured.
 */
export const isSpotifyConfigured = () => isValidClientId(DEFAULT_CLIENT_ID);

/**
 * Get diagnostic info to help debug redirect URI issues.
 */
export const getSpotifyDiagnostics = () => {
  const runtimeUri = getRuntimeRedirectUri();
  const valid = isValidClientId(DEFAULT_CLIENT_ID);
  return {
    clientIdValid: valid ? '✅ Valid' : '❌ INVALID',
    clientIdValue: DEFAULT_CLIENT_ID || '(none)',
    clientIdSource: import.meta.env.VITE_SPOTIFY_CLIENT_ID ? 'from .env file' : 'hardcoded fallback (invalid)',
    runtimeRedirectUri: runtimeUri,
    currentOrigin: window.location.origin,
    currentHref: window.location.href,
  };
};

export const useSpotify = (clientId = DEFAULT_CLIENT_ID) => {
  // Use runtime-calculated redirect URI
  const redirectUri = getRuntimeRedirectUri();

  const [token, setToken] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Playlist state
  const [playlists, setPlaylists] = useState([]);
  const [playlistTracks, setPlaylistTracks] = useState({});
  const [playlistLoading, setPlaylistLoading] = useState(false);

  // Restore token from sessionStorage on mount (sessionStorage is cleared when tab closes)
  useEffect(() => {
    const savedToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Generate a cryptographically secure random string for PKCE
  const generateCodeVerifier = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  // Compute S256 code challenge from verifier
  const generateCodeChallenge = async (verifier) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  // Auth flow (PKCE)
  const login = useCallback(async () => {
    setAuthError(null);

    // DIAGNOSTIC: Log exactly what we're sending to Spotify
    const diagnostics = getSpotifyDiagnostics();
    console.group('🔑 Spotify OAuth Diagnostics');
    console.log('Client ID:', diagnostics.clientIdValue);
    console.log('Client ID valid:', diagnostics.clientIdValid);
    console.log('Redirect URI (SEND THIS TO SPOTIFY DASHBOARD):', diagnostics.runtimeRedirectUri);
    console.log('Current origin:', diagnostics.currentOrigin);
    console.log('Current href:', diagnostics.currentHref);
    console.groupEnd();

    const codeVerifier = generateCodeVerifier();
    sessionStorage.setItem('spotify_verifier', codeVerifier);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const scope = 'playlist-read-private user-library-read';
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scope,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    const authUrl = `https://accounts.spotify.com/authorize?${params}`;

    console.log('[Spotify OAuth] Redirecting to:', authUrl);
    window.location = authUrl;
  }, [clientId, redirectUri]);

  // Handle OAuth callback: Spotify returns ?code=... as query param
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (error) {
      console.error('[Spotify OAuth] Error from Spotify:', error, errorDescription);
      setAuthError(`Spotify error: ${errorDescription || error}. Redirect URI used: ${redirectUri}`);
    }

    if (code) {
      exchangeCodeForToken(code);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [redirectUri]);

  const exchangeCodeForToken = async (code) => {
    const verifier = sessionStorage.getItem('spotify_verifier');
    if (!verifier) {
      setAuthError('Missing PKCE verifier. Please try logging in again.');
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });

    try {
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('[Spotify Token] Full error response:', errData);
        const errMsg = errData.error_description || errData.error || `HTTP ${res.status}`;
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (!data.access_token) {
        throw new Error('No access_token in Spotify response');
      }

      setToken(data.access_token);
      sessionStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
      sessionStorage.removeItem('spotify_verifier');
      setAuthError(null);
    } catch (err) {
      console.error('Spotify auth failed:', err);
      setAuthError(err.message || 'Spotify authentication failed. Check your Client ID and Redirect URI.');
    }
  };

  // Search tracks
  const searchSpotify = useCallback(async (query) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setAuthError('Session expired. Please log in again.');
          return;
        }
        throw new Error(`Search failed: HTTP ${res.status}`);
      }
      const data = await res.json();
      setTracks(data.tracks.items.map(normalizeTrack));
    } catch (err) {
      console.error('Spotify search failed:', err);
      setAuthError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (searchQuery) searchSpotify(searchQuery);
  }, [searchQuery, searchSpotify]);

  /**
   * Fetch current user's playlists.
   */
  const fetchUserPlaylists = useCallback(async () => {
    if (!token) return;
    setPlaylistLoading(true);
    try {
      const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setAuthError('Session expired. Please log in again.');
          return;
        }
        throw new Error(`Fetch playlists failed: HTTP ${res.status}`);
      }
      const data = await res.json();
      const items = (data.items || []).map(pl => ({
        id: pl.id,
        name: pl.name,
        trackCount: pl.tracks?.total || 0,
        image: pl.images?.[0]?.url || null,
        owner: pl.owner?.display_name || 'Unknown',
      }));
      setPlaylists(items);
    } catch (err) {
      console.error('Failed to fetch playlists:', err);
      setAuthError(err.message);
    } finally {
      setPlaylistLoading(false);
    }
  }, [token]);

  /**
   * Fetch tracks for a specific playlist (paginated, resolves all pages).
   */
  const fetchPlaylistTracks = useCallback(async (playlistId) => {
    if (!token || !playlistId) return [];
    setPlaylistLoading(true);
    const allTracks = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

    try {
      while (url) {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (res.status === 401) {
            sessionStorage.removeItem(TOKEN_STORAGE_KEY);
            setToken(null);
            setAuthError('Session expired. Please log in again.');
            return [];
          }
          throw new Error(`Fetch playlist tracks failed: HTTP ${res.status}`);
        }
        const data = await res.json();
        const items = (data.items || [])
          .filter(item => item.track !== null)
          .map(item => normalizeTrack(item.track));
        allTracks.push(...items);
        url = data.next;
      }
      setPlaylistTracks(prev => ({ ...prev, [playlistId]: allTracks }));
      return allTracks;
    } catch (err) {
      console.error('Failed to fetch playlist tracks:', err);
      setAuthError(err.message);
      return [];
    } finally {
      setPlaylistLoading(false);
    }
  }, [token]);

  /**
   * Fetch the MP3 preview for a track as an ArrayBuffer.
   */
  const fetchPreviewBuffer = useCallback(async (previewUrl) => {
    if (!previewUrl) return null;
    try {
      const res = await fetch(previewUrl, { mode: 'cors' });
      if (!res.ok) return null;
      return await res.arrayBuffer();
    } catch (err) {
      console.error('Preview fetch failed:', err);
      return null;
    }
  }, []);

  return {
    login,
    token,
    searchQuery,
    setSearchQuery,
    spotifyTracks: tracks,
    isLoading,
    redirectUri,
    authError,
    setAuthError,

    // Playlists
    playlists,
    playlistTracks,
    playlistLoading,
    fetchUserPlaylists,
    fetchPlaylistTracks,
    fetchPreviewBuffer,
  };
};

/**
 * Normalize a Spotify API track object into our internal shape.
 */
function normalizeTrack(t) {
  return {
    id: t.id,
    name: t.name,
    artist: t.artists?.[0]?.name || 'Unknown Artist',
    spotifyUrl: t.external_urls?.spotify,
    previewUrl: t.preview_url,
    duration: t.duration_ms,
    bpm: 128 + Math.random() * 8,
    key: ['1A', '2A', '11B'][Math.floor(Math.random() * 3)],
  };
}
