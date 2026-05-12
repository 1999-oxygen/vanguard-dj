import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/health':      { target: 'http://localhost:8000', changeOrigin: true },
      '/tracks':      { target: 'http://localhost:8000', changeOrigin: true },
      '/segments':    { target: 'http://localhost:8000', changeOrigin: true },
      '/mixes':       { target: 'http://localhost:8000', changeOrigin: true },
      '/analyze':     { target: 'http://localhost:8000', changeOrigin: true },
      '/dj-segments': { target: 'http://localhost:8000', changeOrigin: true },
      '/dj':          { target: 'http://localhost:8000', changeOrigin: true },
      '/pools':       { target: 'http://localhost:8000', changeOrigin: true },
      '/data':        { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
