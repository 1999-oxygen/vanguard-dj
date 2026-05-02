"""
Vanguard Neural Analysis Core — Secure FastAPI Backend
========================================================
Provides endpoints for:
  • /analyze          — Single-track DNA analysis
  • /analyze_batch    — Batch DNA analysis
  • /health           — Health check
  • /universal/analyze — Deep musicology core + DB storage
  • /fusion/query     — Quantum DB atom queries

Security hardening:
  • API Key auth (X-API-Key header)
  • Rate limiting (SlowAPI)
  • HTTPS redirect in production
  • Secure HTTP headers
  • File upload validation (type, size)
  • CORS from environment variable
"""
import os
import tempfile
import hashlib
from typing import List, Optional
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

# Load .env for local dev (ignored in production where env vars are injected)
load_dotenv()

# ============================================================================
# ENVIRONMENT CONFIGURATION
# ============================================================================
API_KEY = os.environ.get("VANGUARD_API_KEY")
CORS_ORIGINS_STR = os.environ.get("CORS_ORIGINS", "")
CORS_ORIGINS = [o.strip() for o in CORS_ORIGINS_STR.split(",") if o.strip()] or [
    "https://vanguard-api.onrender.com",
    "https://vanguard.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

# In production, force HTTPS
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT.lower() in ("production", "prod", "render")

# Upload limits
MAX_FILE_SIZE_MB = 100
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

# Allowed audio MIME types
ALLOWED_AUDIO_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/flac",
    "audio/x-flac",
    "audio/aiff",
    "audio/x-aiff",
    "audio/ogg",
    "audio/x-m4a",
    "audio/mp4",
}

# ============================================================================
# RATE LIMITER
# ============================================================================
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="Vanguard Neural Analysis Core",
    description="AI-powered audio analysis backend for Vanguard DJ",
    version="3.1.0",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ============================================================================
# MIDDLEWARE
# ============================================================================

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Trusted Hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[
        "vanguard-api.onrender.com",
        "vanguard-api.fly.dev",
        "localhost",
        "127.0.0.1",
        "*.koyeb.app",
    ],
)


@app.middleware("http")
async def https_redirect_middleware(request: Request, call_next):
    """Force HTTPS in production environments."""
    if IS_PRODUCTION:
        if request.headers.get("x-forwarded-proto") == "http":
            url = request.url.replace(scheme="https")
            return JSONResponse(
                status_code=status.HTTP_307_TEMPORARY_REDIRECT,
                headers={"location": str(url)},
            )
    response = await call_next(request)
    return response


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ============================================================================
# AUTHENTICATION
# ============================================================================
async def verify_api_key(request: Request):
    """
    Dependency to verify X-API-Key header.
    If VANGUARD_API_KEY is not set, authentication is skipped (dev mode).
    """
    if not API_KEY:
        # Dev mode: no key configured, allow all
        return True

    client_key = request.headers.get("X-API-Key")
    if not client_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header",
        )
    if client_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )
    return True


# ============================================================================
# IMPORT ANALYSIS MODULES (lazy to avoid heavy import time)
# ============================================================================
def get_analyzer():
    from analyzer import VanguardAnalyzer
    return VanguardAnalyzer()


def get_universal_analyzer():
    from core.universal_core import UniversalAnalyzer
    return UniversalAnalyzer()


def get_fusion_engine():
    from core.fusion_engine import FusionQueryEngine
    return FusionQueryEngine()


# ============================================================================
# HEALTH CHECK
# ============================================================================
@app.get("/health")
@limiter.limit("60/minute")
async def health_check(request: Request):
    """
    Health check endpoint. No API key required.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": ENVIRONMENT,
        "version": "3.1.0",
    }


# ============================================================================
# STANDARD ANALYSIS ENDPOINTS
# ============================================================================
@app.post("/analyze")
@limiter.limit("5/minute")
async def analyze(
    request: Request,
    file: UploadFile = File(...),
    auth: bool = Depends(verify_api_key),
):
    """
    Analyze a single audio file and return its DNA payload.
    Rate limit: 5 requests per minute per IP.
    """
    # Validate content type
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}. Allowed: {', '.join(ALLOWED_AUDIO_TYPES)}",
        )

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max size: {MAX_FILE_SIZE_MB}MB",
        )

    # Analyze
    try:
        analyzer = get_analyzer()
        result = analyzer.analyze_bytes(contents, filename=file.filename)
        return {"success": True, "dna": result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}",
        )


@app.post("/analyze_batch")
@limiter.limit("2/minute")
async def analyze_batch(
    request: Request,
    files: List[UploadFile] = File(...),
    auth: bool = Depends(verify_api_key),
):
    """
    Batch analyze multiple audio files.
    Rate limit: 2 requests per minute per IP.
    """
    if len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Max 10 files per batch",
        )

    results = []
    analyzer = get_analyzer()

    for f in files:
        if f.content_type not in ALLOWED_AUDIO_TYPES:
            results.append({
                "filename": f.filename,
                "success": False,
                "error": f"Unsupported type: {f.content_type}",
            })
            continue

        contents = await f.read()
        if len(contents) > MAX_FILE_SIZE_BYTES:
            results.append({
                "filename": f.filename,
                "success": False,
                "error": f"File too large (> {MAX_FILE_SIZE_MB}MB)",
            })
            continue

        try:
            result = analyzer.analyze_bytes(contents, filename=f.filename)
            results.append({"filename": f.filename, "success": True, "dna": result})
        except Exception as e:
            results.append({
                "filename": f.filename,
                "success": False,
                "error": str(e),
            })

    return {"success": True, "results": results}


# ============================================================================
# UNIVERSAL / DEEP MUSICOLOGY ENDPOINTS
# ============================================================================
@app.post("/universal/analyze")
@limiter.limit("3/minute")
async def universal_analyze(
    request: Request,
    file: UploadFile = File(...),
    auth: bool = Depends(verify_api_key),
):
    """
    Deep musicology analysis: zero-crossing slicing + metric extraction.
    Stores results in the Quantum Database.
    Rate limit: 3 requests per minute per IP.
    """
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max size: {MAX_FILE_SIZE_MB}MB",
        )

    # Write to temp file for librosa
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        ua = get_universal_analyzer()
        track_id = ua.process_master_track(tmp_path)
        return {"success": True, "track_id": track_id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Universal analysis failed: {str(e)}",
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.get("/fusion/query")
@limiter.limit("30/minute")
async def fusion_query(
    request: Request,
    min_energy: float = 0.0,
    max_energy: float = 1.0,
    min_danceability: float = 0.0,
    require_vocals: bool = False,
    derivation: str = "BEAT_GRID_4BAR",
    limit: int = 10,
    auth: bool = Depends(verify_api_key),
):
    """
    Query the Quantum Database for fusion-ready atoms.
    Rate limit: 30 requests per minute per IP.
    """
    try:
        engine = get_fusion_engine()
        atoms = engine.get_fusion_elements(
            min_energy=min_energy,
            max_energy=max_energy,
            min_danceability=min_danceability,
            require_vocals=require_vocals,
            derivation=derivation,
            limit=min(limit, 100),  # Cap at 100
        )
        return {"success": True, "atoms": atoms, "count": len(atoms)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fusion query failed: {str(e)}",
        )


# ============================================================================
# STARTUP EVENT
# ============================================================================
@app.on_event("startup")
async def startup_event():
    print(f"[Vanguard API] Starting up — Environment: {ENVIRONMENT}")
    if API_KEY:
        masked = API_KEY[:8] + "..." + API_KEY[-4:]
        print(f"[Vanguard API] API Key configured: {masked}")
    else:
        print("[Vanguard API] WARNING: No API_KEY set — running in open dev mode")
    print(f"[Vanguard API] CORS Origins: {CORS_ORIGINS}")
