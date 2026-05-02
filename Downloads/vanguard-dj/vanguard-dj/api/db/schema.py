"""
VANGUARD UNIVERSAL - THE QUANTUM DATABASE (Hardened)
Stores tracks and atoms (segments) with deep-musicology metrics.
Supports both SQLite (local dev) and PostgreSQL (production/Render).

SECURITY FEATURES:
  • PostgreSQL SSL enforcement in production
  • Optional field-level encryption for sensitive JSON vectors (MFCC, Chroma)
  • Encrypted using Fernet (AES-128-CBC + HMAC) when VANGUARD_DB_ENCRYPTION_KEY is set
"""
import os
import json
import base64

from sqlalchemy import create_engine, Column, Integer, String, Float, JSON, ForeignKey, TypeDecorator, Text
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2

Base = declarative_base()

# ============================================================================
# ENCRYPTION SETUP
# ============================================================================
ENCRYPTION_KEY = os.environ.get("VANGUARD_DB_ENCRYPTION_KEY")

_fernet = None
if ENCRYPTION_KEY:
    # Derive a 32-byte key from the passphrase using PBKDF2
    kdf = PBKDF2(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"vanguard_salt_2024",  # Fixed salt — deterministic encryption
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(ENCRYPTION_KEY.encode()))
    _fernet = Fernet(key)
    print("[Quantum DB] Field-level encryption ENABLED for sensitive vectors")


class EncryptedJSON(TypeDecorator):
    """
    SQLAlchemy TypeDecorator that transparently encrypts/decrypts JSON data.
    Falls back to plain JSON if no encryption key is configured.
    """
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        json_str = json.dumps(value)
        if _fernet:
            return _fernet.encrypt(json_str.encode()).decode()
        return json_str

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if _fernet:
            try:
                decrypted = _fernet.decrypt(value.encode()).decode()
                return json.loads(decrypted)
            except Exception:
                # Fallback: may be unencrypted legacy data
                return json.loads(value)
        return json.loads(value)


# ============================================================================
# ORM MODELS
# ============================================================================
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
    # ENCRYPTED: These contain sensitive audio fingerprints
    mfcc_vector = Column(EncryptedJSON)   # Timbre/Texture fingerprint
    chroma_vector = Column(EncryptedJSON) # Musical notes present

    track = relationship("Track", back_populates="atoms")


# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================
database_url = os.environ.get('DATABASE_URL')

if database_url:
    # Render provides DATABASE_URL starting with postgres://, SQLAlchemy needs postgresql://
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)

    # Enforce SSL for PostgreSQL in production
    connect_args = {"sslmode": "require"}
    engine = create_engine(database_url, connect_args=connect_args)
    print("[Quantum DB] PostgreSQL engine initialized with SSL required")
else:
    # Local SQLite fallback
    db_path = os.path.join(os.path.dirname(__file__), '../../data/db/vanguard_quantum.db')
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    engine = create_engine(f'sqlite:///{db_path}')
    print("[Quantum DB] SQLite engine initialized (local dev)")

Base.metadata.create_all(engine)
SessionLocal = sessionmaker(bind=engine)
