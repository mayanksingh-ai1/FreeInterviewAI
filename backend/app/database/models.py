"""
SQLite schema models for local persistence in FreeInterviewAI.
Uses SQLAlchemy 2.0 ORM.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class SessionRecord(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    role = Column(String, nullable=False)
    session_type = Column(String, nullable=False) # Behavioral, Technical, System Design
    duration_seconds = Column(Integer, default=0)
    score = Column(Float, default=0.0)
    transcript_json = Column(Text, nullable=True)
    feedback_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class QuestionRecord(Base):
    __tablename__ = "questions"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    category = Column(String, index=True)
    difficulty = Column(String, index=True)
    tags = Column(String) # Comma-separated
    description = Column(Text, nullable=False)
    sample_answer = Column(Text, nullable=True)

class SettingRecord(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
