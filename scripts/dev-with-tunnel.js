import { createServer } from 'vite';
import localtunnel from 'localtunnel';

async function start() {
  console.log('\n🚀 Starting Vanguard DJ with HTTPS tunnel...\n');

  // Start Vite dev server on HTTP (localtunnel will provide HTTPS)
  const server = await createServer({
    configFile: './vite.config.js',
    server: {
      port: 5173,
      https: false,
    },
    root: process.cwd(),
  });

  await server.listen();
  console.log('✅ Vite server running at http://localhost:5173/');

  // Wait a moment to ensure server is fully ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Start localtunnel AFTER server is ready
  const tunnel = await localtunnel({ port: 5173 });
  const tunnelUrl = tunnel.url;
  const redirectUri = `${tunnelUrl}/callback`;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 Tunnel URL:', tunnelUrl);
  console.log('🔗 Spotify Redirect URI:', redirectUri);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n⚠️  IMPORTANT: Add this Redirect URI to your Spotify app:');
  console.log('   → https://developer.spotify.com/dashboard');
  console.log('   → Edit Settings → Redirect URIs → Add → Save');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Set env var for Vite (for any runtime usage)
  process.env.VITE_SPOTIFY_REDIRECT_URI = redirectUri;

  console.log('✅ Public tunnel at', tunnelUrl);
  console.log('\nPress Ctrl+C to stop\n');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    await server.close();
    tunnel.close();
    process.exit(0);
  });

  tunnel.on('close', () => {
    console.log('\n⚠️  Tunnel closed. Restart to get a new URL.');
    server.close();
    process.exit(0);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
