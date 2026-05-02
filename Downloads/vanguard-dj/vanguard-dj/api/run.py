#!/usr/bin/env python3
"""
Convenience entry point for the Vanguard Neural Analysis Core.
Usage:
    python api/run.py              # Start dev server on 0.0.0.0:8000
    python api/run.py --port 8080  # Start on custom port
"""
import argparse
import uvicorn

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Vanguard Neural Analysis Core")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    args = parser.parse_args()

    uvicorn.run(
        "main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )

