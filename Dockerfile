# Vanguard Neural Analysis Core - Docker Image
# Runs the Python FastAPI backend with all ML dependencies pre-built

FROM python:3.11-slim-bookworm

WORKDIR /app

# Install system dependencies for audio processing
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    libfftw3-dev \
    libblas-dev \
    liblapack-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python packages
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY api/ ./api/

# Create data directory for SQLite database
RUN mkdir -p /app/data/db

# Expose the API port
EXPOSE 8000

# Run the FastAPI server
CMD ["python", "api/run.py", "--host", "0.0.0.0", "--port", "8000"]

