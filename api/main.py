from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from analyzer import VanguardAnalyzer
from core.universal_core import UniversalAnalyzer
from core.fusion_engine import FusionQueryEngine
import shutil
import os
import tempfile

app = FastAPI(title="Vanguard Neural Analysis Core", version="3.1.0")

# Allow CORS for local dev and Vercel preview/production
origins = [
    "http://localhost:5173",
    "https://localhost:5173",
    "http://localhost:3000",
    "https://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global analyzer instances (librosa models cached on first use)
analyzer = VanguardAnalyzer(target_sr=44100)
universal_analyzer = UniversalAnalyzer(target_sr=44100)
fusion_engine = FusionQueryEngine()


@app.get("/health")
def health_check():
    return {
        "status": "online",
        "engine": "Vanguard Neural Core v3.1",
        "models_loaded": True,
        "modules": {
            "dna_analyzer": True,
            "universal_core": True,
            "fusion_engine": True,
            "quantum_db": True
        }
    }


@app.post("/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    """
    Accept an audio file, run the full VanguardAnalyzer pipeline,
    and return the DNA payload JSON.
    """
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file (audio/*).")

    suffix = os.path.splitext(file.filename or ".wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        dna = analyzer.analyze_track(tmp_path)
        dna["track_name"] = file.filename or dna["track_name"]
        return {"success": True, "dna": dna}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.post("/analyze_batch")
async def analyze_batch(files: list[UploadFile] = File(...)):
    """
    Batch analysis endpoint. Returns a list of DNA payloads.
    """
    results = []
    for upload in files:
        suffix = os.path.splitext(upload.filename or ".wav")[1] or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(upload.file, tmp)
            tmp_path = tmp.name

        try:
            dna = analyzer.analyze_track(tmp_path)
            dna["track_name"] = upload.filename or dna["track_name"]
            results.append({"success": True, "dna": dna})
        except Exception as e:
            results.append({"success": False, "error": str(e), "track_name": upload.filename})
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return {"success": True, "results": results}


@app.post("/universal/analyze")
async def universal_analyze(file: UploadFile = File(...)):
    """
    Universal/Computational Grade analysis.
    Runs the Deep Musicology Core with zero-crossing slicing,
    stores atoms in the Quantum Database, and returns the track ID.
    """
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file (audio/*).")

    suffix = os.path.splitext(file.filename or ".wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        track_id = universal_analyzer.process_master_track(tmp_path)
        return {
            "success": True,
            "track_id": track_id,
            "message": "Track shredded into perfect zero-crossing atoms and stored in Quantum Database."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Universal analysis failed: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.get("/fusion/query")
async def fusion_query(
    min_energy: float = Query(0.0, ge=0.0, le=1.0),
    max_energy: float = Query(1.0, ge=0.0, le=1.0),
    min_danceability: float = Query(0.0, ge=0.0, le=1.0),
    require_vocals: bool = Query(False),
    derivation: str = Query("BEAT_GRID_4BAR"),
    limit: int = Query(10, ge=1, le=100)
):
    """
    Query the Quantum Database for fusion-ready atoms.
    Filter by energy, danceability, vocals, derivation type, etc.
    """
    try:
        results = fusion_engine.get_fusion_elements(
            min_energy=min_energy,
            max_energy=max_energy,
            min_danceability=min_danceability,
            require_vocals=require_vocals,
            derivation=derivation,
            limit=limit
        )
        return {
            "success": True,
            "count": len(results),
            "query": {
                "min_energy": min_energy,
                "max_energy": max_energy,
                "min_danceability": min_danceability,
                "require_vocals": require_vocals,
                "derivation": derivation,
                "limit": limit
            },
            "atoms": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fusion query failed: {str(e)}")
