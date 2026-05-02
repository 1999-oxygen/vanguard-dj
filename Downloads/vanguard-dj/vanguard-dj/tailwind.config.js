/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['"SF Mono"', 'ui-monospace', 'monospace'],
        'retro': ['"Orbitron"', '"Rajdhani"', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in-from-top': 'slideInFromTop 0.3s ease-out',
        'neon-glow': 'neonGlow 2s ease-in-out infinite alternate',
        'scanline': 'scanline 0.1s linear infinite',
        'crt-flicker': 'crtFlicker 0.1s ease-in-out infinite',
        'pulse-retro': 'pulseRetro 1.5s cubic-bezier(0.66, 0, 0, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInFromTop: {
          '0%': { transform: 'translateY(-1rem)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        neonGlow: {
          '0%': { textShadow: '0 0 5px #a78bfa, 0 0 10px #a78bfa, 0 0 15px #a78bfa' },
          '100%': { textShadow: '0 0 10px #ec4899, 0 0 20px #ec4899, 0 0 30px #ec4899' },
        },
        scanline: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100%' },
        },
        crtFlicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.95' },
        },
        pulseRetro: {
          '0%, 100%': { transform: 'scale(1)', filter: 'hue-rotate(0deg)' },
          '50%': { transform: 'scale(1.05)', filter: 'hue-rotate(180deg)' },
        },
      },
      colors: {
        slate: {
          950: '#020617',
        },
        neon: {
          purple: { 50: '#f5f3ff', 400: '#c084fc', 500: '#a78bfa', 600: '#9333ea' },
          pink: { 400: '#f472b6', 500: '#ec4899', 600: '#db2777' },
          cyan: { 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2' },
          retro: {
            chrome: '#f3f4f6',
            scanline: '#00000020',
          }
        },
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
