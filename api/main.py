from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from analyzer import VanguardAnalyzer
from core.universal_core import UniversalAnalyzer
from core.fusion_engine import FusionQueryEngine
from core.recombinator import UniversalRecombinator, recombine_from_segments
import shutil
import os
import tempfile
import json

# Optional: QuantumMLExtractor (Demucs + Whisper)
try:
    from core.ml_extractor import QuantumMLExtractor
    ML_EXTRACTOR_AVAILABLE = True
except ImportError:
    ML_EXTRACTOR_AVAILABLE = False
    QuantumMLExtractor = None

app = FastAPI(title="Vanguard Neural Analysis Core", version="3.1.0")

# Allow CORS for all origins (Render is a public API)
# In production, restrict this to your frontend domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


@app.post("/recombine")
async def recombine_atoms(
    fusion_elements: list,
    master_bpm: float = Query(124.0, ge=60.0, le=200.0),
    master_key: str = Query("8A"),
    output_name: str = Query("dynamic_fusion")
):
    """
    Takes fusion-ready atoms and generates a phase-locked, BPM-synced
    'Flight Plan' for the audio engine.
    """
    try:
        recombinator = UniversalRecombinator(
            master_bpm=master_bpm,
            master_key=master_key
        )
        flight_plan = recombinator.build_flight_plan(
            fusion_elements,
            output_name=output_name
        )
        return {
            "success": True,
            "flight_plan": flight_plan
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recombination failed: {str(e)}")


@app.post("/recombine/segments")
async def recombine_segments(
    segments: list,
    master_bpm: float = Query(124.0, ge=60.0, le=200.0),
    master_key: str = Query("8A"),
    output_name: str = Query("auto_mix")
):
    """
    Takes raw segment data (from frontend IndexedDB) and generates
    a flight plan with elastic normalization.
    """
    try:
        flight_plan = recombine_from_segments(
            segments,
            master_bpm=master_bpm,
            master_key=master_key,
            output_name=output_name
        )
        return {
            "success": True,
            "flight_plan": flight_plan
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Segment recombination failed: {str(e)}")


@app.get("/flightplan/{fusion_id}")
async def get_flight_plan(fusion_id: str):
    """
    Retrieve a saved flight plan by its fusion ID.
    """
    try:
        cache_dir = "data/cache"
        # Search for the flight plan file
        for filename in os.listdir(cache_dir) if os.path.exists(cache_dir) else []:
            filepath = os.path.join(cache_dir, filename)
            with open(filepath, "r") as f:
                plan = json.load(f)
                if plan.get("fusion_id") == fusion_id:
                    return {"success": True, "flight_plan": plan}
        raise HTTPException(status_code=404, detail="Flight plan not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve flight plan: {str(e)}")


@app.post("/flightplan/render")
async def render_flight_plan(flight_plan: dict):
    """
    Render a flight plan to an audio file.
    Placeholder for actual audio rendering pipeline.
    """
    try:
        # TODO: Implement actual audio rendering with ffmpeg or sox
        return {
            "success": True,
            "message": "Flight plan accepted for rendering",
            "fusion_id": flight_plan.get("fusion_id"),
            "total_events": flight_plan.get("total_events"),
            "status": "queued"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Render failed: {str(e)}")


@app.post("/ml/extract")
async def ml_extract(file: UploadFile = File(...), output_dir: str = "data/processed"):
    """
    QuantumMLExtractor pipeline: Demucs stem separation + Whisper phonetic alignment.
    Returns stems, word-level timestamps (in integer samples), and atom metrics.
    """
    if not ML_EXTRACTOR_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="QuantumMLExtractor not available. Install: pip install openai-whisper demucs torch"
        )

    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file (audio/*).")

    suffix = os.path.splitext(file.filename or ".wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        extractor = QuantumMLExtractor(sample_rate=44100)
        result = extractor.process_track(tmp_path, output_dir=output_dir)
        return {
            "success": True,
            "track_path": result["track_path"],
            "stems": result["stems"],
            "total_words": result["total_words"],
            "atoms": result["atoms"],
            "sample_rate": result["sample_rate"],
            "device": result["device"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML extraction failed: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.post("/ml/phonetic")
async def ml_phonetic(file: UploadFile = File(...)):
    """
    Run only Whisper phonetic alignment on a vocal stem.
    Returns word-level timestamps in integer samples.
    """
    if not ML_EXTRACTOR_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="QuantumMLExtractor not available. Install: pip install openai-whisper torch"
        )

    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail="File must be an audio file (audio/*).")

    suffix = os.path.splitext(file.filename or ".wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        extractor = QuantumMLExtractor(sample_rate=44100)
        word_map = extractor.map_phonetic_timeline(tmp_path)
        return {
            "success": True,
            "word_count": len(word_map),
            "word_map": word_map
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Phonetic mapping failed: {str(e)}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
