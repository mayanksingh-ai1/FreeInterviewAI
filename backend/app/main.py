"""
FreeInterviewAI - Local Python AI Backend Service (Phase 2 Local AI Integration)
Offline-first REST API interfacing with local Ollama runtime and SQLite storage.
Strictly local-only: No cloud APIs, no external telemetry.
"""
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.schemas import (
    HealthResponse,
    ModelsResponse,
    ChatRequest,
    ChatResponse,
    ChatMessage,
    QuestionProcessRequest,
    QuestionProcessResponse,
    AudioDevicesResponse,
    AudioTestRequest,
    AudioTestResponse,
    AudioSessionStartRequest,
    AudioSessionStatusResponse,
    QuestionDetectionRequest,
    QuestionDetectionResponse,
    QuestionDetectionConfig,
    TranscriptSegment,
    ErrorResponse
)
from app.services.ollama_service import ollama_service, RECOMMENDED_8GB_MODELS
from app.services.audio_service import audio_service
from app.services.question_detector import question_detector

app = FastAPI(
    title=settings.APP_NAME,
    description="Offline-first local AI interview assistance backend tuned for Intel Core i5 / 8 GB RAM laptops",
    version="0.2.0"
)

# CORS enabled for local desktop renderer access (Vite dev server and Electron app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint: confirms backend is running and provides interactive links."""
    return {
        "service": "FreeInterviewAI Local AI Backend",
        "status": "online",
        "docs_url": "http://127.0.0.1:8000/docs",
        "health_check": "http://127.0.0.1:8000/health",
        "models_url": "http://127.0.0.1:8000/models",
        "message": "Backend is running successfully on 127.0.0.1:8000"
    }

@app.get("/health", response_model=HealthResponse)
async def get_health():
    """Health check endpoint: reports local service and Ollama daemon connectivity."""
    ollama_ok, _ = await ollama_service.check_health()
    return HealthResponse(
        status="healthy",
        service="FreeInterviewAI-LocalBackend",
        ollama_connected=ollama_ok,
        ollama_url=settings.OLLAMA_BASE_URL,
        active_model=settings.DEFAULT_MODEL,
        hardware_target="Intel Core i5-1135G7 (4 cores) / 8 GB RAM",
        ram_recommendation="Safe model envelope: <= 3.8B parameters (Q4_K_M) consuming <= 2.4 GB RAM"
    )

@app.get("/models", response_model=ModelsResponse)
async def get_models():
    """Returns local downloaded Ollama models and safe 8 GB RAM recommendations with disk/RAM specs."""
    ollama_ok, downloaded, _ = await ollama_service.list_downloaded_models()
    return ModelsResponse(
        ollama_running=ollama_ok,
        ollama_version="Local Ollama" if ollama_ok else None,
        default_model=settings.DEFAULT_MODEL,
        downloaded_models=downloaded,
        recommended_models=RECOMMENDED_8GB_MODELS,
        hardware_note=(
            "On an 8 GB RAM laptop without dedicated GPU, running 7B or 14B models will trigger "
            "severe memory swapping and slow down your machine. Stick to 1B–3.8B quantized models (Q4_K_M)."
        )
    )

@app.post("/chat", response_model=ChatResponse)
async def post_chat(req: ChatRequest):
    """
    Main interview chat inference endpoint.
    Accepts conversation history and generates response via local Ollama or simulated mock fallback.
    """
    result = await ollama_service.generate_chat(req)
    return ChatResponse(
        message=ChatMessage(role="assistant", content=result["content"]),
        model_used=result["model_used"],
        explanation_style=result["explanation_style"],
        latency_ms=result["latency_ms"],
        is_mock_fallback=result["is_mock_fallback"],
        warning=result.get("warning")
    )

@app.post("/api/v1/interview/process-question", response_model=QuestionProcessResponse)
@app.post("/question/answer", response_model=QuestionProcessResponse)
async def process_interview_question(req: QuestionProcessRequest):
    """
    Phase 3: Processes interview question into a structured 4-part answer:
    1. Direct Answer
    2. Simple Explanation
    3. Practical Example
    4. Important Keywords
    Supports concise, detailed, beginner-friendly, and interview-ready-english.
    """
    result = await ollama_service.process_question(req)
    return QuestionProcessResponse(
        question=result["question"],
        style=result["style"],
        model_used=result["model_used"],
        structured_answer=result["structured_answer"],
        raw_markdown=result["raw_markdown"],
        latency_ms=result["latency_ms"],
        is_mock_fallback=result["is_mock_fallback"],
        warning=result.get("warning")
    )

# --- Phase 4 Audio Capture & Speech-to-Text Endpoints ---

@app.get("/api/v1/audio/devices", response_model=AudioDevicesResponse)
async def get_audio_devices():
    """Lists and classifies Windows audio endpoints (Microphones, Bluetooth headsets, Loopback)."""
    devices = audio_service.list_devices()
    def_in = next((d.device_id for d in devices if d.is_default_input), None)
    def_out = next((d.device_id for d in devices if d.is_default_output), None)
    return AudioDevicesResponse(
        devices=devices,
        default_input_id=def_in,
        default_output_id=def_out,
        windows_note=(
            "Bluetooth Earbud Note: Bluetooth audio routing in Windows separates recording (Hands-Free HFP) "
            "from playback (Stereo A2DP). Test your selected endpoint with the diagnostic meter below before recording."
        )
    )

@app.post("/api/v1/audio/test-device", response_model=AudioTestResponse)
async def test_audio_device(req: AudioTestRequest):
    """Tests an audio endpoint for connectivity and calculates real-time RMS / peak decibel level."""
    return audio_service.test_device(device_id=req.device_id, duration_sec=req.duration_sec)

@app.post("/api/v1/audio/session/start")
async def start_audio_session(req: AudioSessionStartRequest):
    """Starts live local audio capture and faster-whisper INT8 transcription."""
    audio_service.start_session(
        device_id=req.device_id,
        model_name=req.model_name,
        chunk_duration_sec=req.chunk_duration_sec,
        is_loopback=req.is_loopback
    )
    return {"status": "started", "device_name": audio_service.device_name}

@app.post("/api/v1/audio/session/pause")
async def pause_audio_session():
    """Pauses live audio capture."""
    audio_service.pause_session()
    return {"status": "paused"}

@app.post("/api/v1/audio/session/resume")
async def resume_audio_session():
    """Resumes paused audio capture."""
    audio_service.resume_session()
    return {"status": "resumed"}

@app.post("/api/v1/audio/session/stop")
async def stop_audio_session():
    """Stops audio capture and flushes the remaining audio buffer."""
    audio_service.stop_session()
    return {"status": "stopped"}

@app.post("/api/v1/audio/session/clear")
async def clear_audio_transcript():
    """Clears transcript from in-memory storage (no files on disk)."""
    audio_service.clear_transcript()
    return {"status": "cleared"}

@app.get("/api/v1/audio/session/status", response_model=AudioSessionStatusResponse)
async def get_audio_session_status():
    """Returns live streaming transcript, volume levels, and recording status."""
    return audio_service.get_status()

# --- Phase 5 Question Detection from Transcript Endpoints ---

@app.post("/api/v1/detection/detect-questions", response_model=QuestionDetectionResponse)
async def detect_questions_from_transcript(req: QuestionDetectionRequest):
    """
    Phase 5: Detects interview questions from speech transcript chunks,
    combining multi-chunk questions and filtering background noise/duplicates.
    """
    return question_detector.process_transcript_chunks(
        chunks=req.chunks,
        config=req.config,
        existing_detected=req.existing_detected,
    )

@app.get("/api/v1/detection/synthetic-scenarios")
async def get_synthetic_test_scenarios():
    """
    Returns pre-configured synthetic interview transcript test scenarios for testing:
    1. Multi-chunk split question.
    2. Rapid speech with conversational noise & fillers.
    3. Duplicate questions asked with minor phrasing variations.
    4. Mixed technical, behavioral, and coding questions.
    """
    return {
        "scenarios": [
            {
                "id": "scenario-multi-chunk",
                "title": "Split Multi-Chunk Question",
                "description": "Simulates an interviewer asking a question across 3 rapid chunks",
                "chunks": [
                    {"id": "c1", "timestamp": "00:02", "text": "Can you walk me through...", "is_final": True},
                    {"id": "c2", "timestamp": "00:05", "text": "how you would design a distributed caching layer...", "is_final": True},
                    {"id": "c3", "timestamp": "00:08", "text": "with LRU eviction and replication?", "is_final": True},
                ]
            },
            {
                "id": "scenario-noise-fillers",
                "title": "Rapid Speech with Background Fillers & Incomplete Phrases",
                "description": "Simulates casual conversation and mic test artifacts that should be ignored",
                "chunks": [
                    {"id": "n1", "timestamp": "00:01", "text": "Can you hear me?", "is_final": True},
                    {"id": "n2", "timestamp": "00:03", "text": "Yeah okay great sounds good.", "is_final": True},
                    {"id": "n3", "timestamp": "00:06", "text": "So basically um...", "is_final": True},
                    {"id": "n4", "timestamp": "00:09", "text": "What is the time complexity of QuickSort in the worst case?", "is_final": True},
                ]
            },
            {
                "id": "scenario-duplicates",
                "title": "Duplicate Question Suppression",
                "description": "Interviewer repeats question with slight variation",
                "chunks": [
                    {"id": "d1", "timestamp": "00:02", "text": "Tell me about a time you handled a critical outage?", "is_final": True},
                    {"id": "d2", "timestamp": "00:06", "text": "I mean, can you tell me about a time you handled a critical outage in production?", "is_final": True},
                ]
            },
            {
                "id": "scenario-behavioral-hr",
                "title": "Behavioral & HR Questions",
                "description": "Tests classification of STAR and culture-fit inquiries",
                "chunks": [
                    {"id": "b1", "timestamp": "00:04", "text": "Describe a situation where you had a disagreement with your engineering manager.", "is_final": True},
                    {"id": "b2", "timestamp": "00:10", "text": "Why do you want to work for our team specifically?", "is_final": True},
                ]
            }
        ]
    }

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": f"HTTP_{exc.status_code}"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.BACKEND_HOST, port=settings.BACKEND_PORT, reload=True)
