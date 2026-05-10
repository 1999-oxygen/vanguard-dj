# Vanguard DJ New Backend TODO (Node.js/Express)

## Approved Plan Progress

### 1. Delete pre-existing Python backend (api/)
- [x] rm -rf api/ ✅

### 2. Update dependencies and scripts
- [x] Edit package.json: add express, cors, multer, sqlite3, fluent-ffmpeg, @ffmpeg-installer/ffmpeg; update scripts.dev:api to concurrently nodemon server/index.js vite ✅

Current step: 3/7


### 2. Update dependencies and scripts
- [ ] Edit package.json: add express, cors, multer, sqlite3, fluent-ffmpeg, @ffmpeg-installer/ffmpeg; update scripts.dev:api to concurrently node server/index.js vite

### 3. Create server/ directory and core files
- [x] server/index.js (Express app with all endpoints: /health, /analyze, /analyze_batch, /universal/analyze, /fusion/query) ✅
- [x] server/db.js (SQLite setup, Track/Atom schemas, mock data) ✅
- [x] server/analyze.js (audio analysis using fluent-ffmpeg: BPM, energy, DNA sim) ✅

### 4. Update infrastructure
- [x] docker-compose.yml: Node service replacing Python ✅
- [x] Dockerfile.node created ✅

### 5. Install and test
- [ ] npm install
- [ ] npm run dev:api (test endpoints)

Current step: 5/7

### 4. Update infrastructure
- [ ] docker-compose.yml: Node service replacing Python
- [ ] .dockerignore, new Dockerfile for server if needed

### 5. Frontend adjustments (minimal)
- [ ] vite.config.js: confirm proxy
- [ ] Remove Python refs from docs/scripts

### 6. Install and test
- [ ] npm install
- [ ] npm run dev (test health/analyze)
- [ ] docker-compose up

### 7. Deploy updates
- [ ] Update README.md, DEPLOY.md for Node backend

Current step: 1/7

