# FreeInterviewAI - Local Backend Architecture

This directory contains the Python FastAPI backend planned for Phase 2 integration.

## Design for 8 GB RAM / Intel i5-1135G7:
- Runs locally bound to `127.0.0.1:8000`.
- Connects directly to local Ollama daemon (`127.0.0.1:11434`) running lightweight quantized models:
  - `llama3.2:3b` (~2.0 GB RAM footprint)
  - `qwen2.5-coder:3b` (~2.1 GB RAM footprint)
- Local SQLite database file stored at `%APPDATA%/FreeInterviewAI/freeinterview.db`.
- Whisper STT (base or tiny model via `faster-whisper` or `whisper.cpp`) with CPU INT8 quantization.
