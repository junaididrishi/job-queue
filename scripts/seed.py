"""Seed a default admin user. Run: python scripts/seed.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.security import hash_password
from app.models.user import User
from app.db.base import Base

settings = get_settings()
engine = create_engine(settings.DATABASE_URL_SYNC)

with Session(engine) as db:
    existing = db.query(User).filter_by(email="admin@jobqueue.dev").first()
    if not existing:
        user = User(email="admin@jobqueue.dev", password_hash=hash_password("password123"), name="Admin User")
        db.add(user)
        db.commit()
        print("Seeded: admin@jobqueue.dev / password123")
    else:
        print("User already exists")
