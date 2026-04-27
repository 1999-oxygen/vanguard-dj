"""
VANGUARD UNIVERSAL - THE QUANTUM DATABASE
Stores tracks and atoms (segments) with deep-musicology metrics.
"""
from sqlalchemy import create_engine, Column, Integer, String, Float, JSON, ForeignKey
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
import os

Base = declarative_base()


class Track(Base):
    __tablename__ = 'tracks'

    id = Column(String, primary_key=True)  # MD5 Hash of file
    filename = Column(String)
    bpm = Column(Float)
    key_camelot = Column(String)
    duration_sec = Column(Float)

    # Relationship to its segments
    atoms = relationship("Atom", back_populates="track", cascade="all, delete")


class Atom(Base):
    """An 'Atom' is a segment of audio chopped using a specific derivation metric."""
    __tablename__ = 'atoms'

    atom_id = Column(String, primary_key=True)
    track_id = Column(String, ForeignKey('tracks.id'))

    # Derivation Method (How was this slice decided?)
    # e.g., 'BEAT_GRID_16', 'VOCAL_PHRASE', 'ENERGY_SPIKE', 'DRUM_FILL'
    derivation_type = Column(String)

    # Sub-sample perfect timestamps
    start_sample = Column(Integer)
    end_sample = Column(Integer)
    duration_sec = Column(Float)

    # --- DEEP METRICS ---
    energy_rms = Column(Float)         # Pure loudness
    spectral_centroid = Column(Float)  # Brightness / Sharpness
    dissonance = Column(Float)         # Harmonic tension (Chaos level)
    danceability = Column(Float)       # Rhythmic regularity
    lyric_density = Column(Float)      # Words per second (requires Whisper)

    # --- VECTORS (For AI Similarity Search) ---
    mfcc_vector = Column(JSON)         # Timbre/Texture fingerprint
    chroma_vector = Column(JSON)       # Musical notes present

    track = relationship("Track", back_populates="atoms")


# Initialize Database
db_path = os.path.join(os.path.dirname(__file__), '../../data/db/vanguard_quantum.db')
os.makedirs(os.path.dirname(db_path), exist_ok=True)

engine = create_engine(f'sqlite:///{db_path}')
Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)

