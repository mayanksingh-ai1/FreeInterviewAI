from typing import List, Optional, Literal
from pydantic import BaseModel, Field

ExplanationStyle = Literal["short", "detailed", "beginner-friendly"]
AnswerStyle = Literal["concise", "detailed", "beginner-friendly", "interview-ready-english"]

class StructuredAnswer(BaseModel):
    direct_answer: str = Field(..., description="The direct, high-impact executive answer")
    simple_explanation: str = Field(..., description="Conceptual breakdown or architectural principles")
    example: str = Field(..., description="Concrete code or real-world system scenario")
    important_keywords: List[str] = Field(default_factory=list, description="Crucial technical keywords")

class QuestionProcessRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=10000, description="The interview question to answer")
    style: AnswerStyle = Field("detailed", description="concise | detailed | beginner-friendly | interview-ready-english")
    model: Optional[str] = Field(None, description="Model tag e.g. llama3.2:3b")
    allow_mock_fallback: bool = Field(True, description="Fall back to local mock response if Ollama is not running")

class QuestionProcessResponse(BaseModel):
    question: str
    style: AnswerStyle
    model_used: str
    structured_answer: StructuredAnswer
    raw_markdown: str
    latency_ms: int
    is_mock_fallback: bool = False
    warning: Optional[str] = None

class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(..., min_length=1, max_length=20000)

class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1)
    model: Optional[str] = Field(None, description="Model tag e.g. llama3.2:3b")
    temperature: Optional[float] = Field(0.7, ge=0.0, le=1.5)
    explanation_style: ExplanationStyle = Field("detailed", description="short | detailed | beginner-friendly")
    allow_mock_fallback: bool = Field(True, description="Fall back to local mock response if Ollama is not running")

class ChatResponse(BaseModel):
    message: ChatMessage
    model_used: str
    explanation_style: ExplanationStyle
    latency_ms: int
    is_mock_fallback: bool = False
    warning: Optional[str] = None

class RecommendedModelInfo(BaseModel):
    name: str
    tag: str
    parameters: str
    disk_size_gb: float
    ram_required_gb: float
    recommended_for_8gb_ram: bool
    description: str
    download_command: str

class ModelsResponse(BaseModel):
    ollama_running: bool
    ollama_version: Optional[str] = None
    default_model: str
    downloaded_models: List[str]
    recommended_models: List[RecommendedModelInfo]
    hardware_note: str

class HealthResponse(BaseModel):
    status: str
    service: str
    ollama_connected: bool
    ollama_url: str
    active_model: str
    hardware_target: str
    ram_recommendation: str

class ErrorResponse(BaseModel):
    code: str
    detail: str
    suggestion: Optional[str] = None

# Phase 4 Audio Capture & Speech-to-Text Schemas
AudioDeviceCategory = Literal["microphone", "bluetooth_headset", "playback_loopback", "other"]

class AudioDeviceInfo(BaseModel):
    device_id: int
    name: str
    hostapi_name: str
    max_input_channels: int
    max_output_channels: int
    default_samplerate: float
    category: AudioDeviceCategory
    is_default_input: bool
    is_default_output: bool
    supports_loopback: bool

class AudioDevicesResponse(BaseModel):
    devices: List[AudioDeviceInfo]
    default_input_id: Optional[int] = None
    default_output_id: Optional[int] = None
    windows_note: str

class AudioTestRequest(BaseModel):
    device_id: Optional[int] = None
    duration_sec: float = Field(1.0, ge=0.5, le=3.0)

class AudioTestResponse(BaseModel):
    device_id: Optional[int]
    device_name: str
    rms_energy: float
    peak_amplitude: float
    db_level: float
    audio_detected: bool
    success: bool
    message: str

class TranscriptSegment(BaseModel):
    id: str
    timestamp: str
    text: str
    is_final: bool
    confidence: float = 1.0

class AudioSessionStartRequest(BaseModel):
    device_id: Optional[int] = None
    model_name: str = Field("tiny.en", description="tiny.en (~39MB) | base.en (~74MB)")
    chunk_duration_sec: float = Field(3.0, ge=1.5, le=6.0)
    is_loopback: bool = False

class AudioSessionStatusResponse(BaseModel):
    state: Literal["idle", "recording", "transcribing", "paused", "stopped", "error"]
    device_id: Optional[int] = None
    device_name: str
    model_name: str
    chunk_duration_sec: float
    current_volume_rms: float
    is_silent: bool
    finalized_segments: List[TranscriptSegment]
    partial_segment: Optional[TranscriptSegment] = None
    duration_seconds: int
    error_message: Optional[str] = None

# Phase 5 Question Detection from Transcript Schemas
QuestionCategory = Literal["technical", "coding", "behavioral", "hr", "general"]

class DetectedQuestion(BaseModel):
    id: str
    text: str
    category: QuestionCategory
    confidence: float
    timestamp: str
    source_chunks: List[str] = Field(default_factory=list)
    status: Literal["pending_review", "approved", "rejected", "auto_submitted"] = "pending_review"

class QuestionDetectionConfig(BaseModel):
    min_length_chars: int = Field(15, ge=5, le=100)
    debounce_window_sec: float = Field(1.5, ge=0.5, le=5.0)
    min_confidence: float = Field(0.60, ge=0.1, le=1.0)
    deduplication_threshold: float = Field(0.80, ge=0.5, le=1.0)
    auto_answer_enabled: bool = False

class QuestionDetectionRequest(BaseModel):
    chunks: List[TranscriptSegment]
    config: Optional[QuestionDetectionConfig] = None
    existing_detected: Optional[List[DetectedQuestion]] = None

class QuestionDetectionResponse(BaseModel):
    detected_questions: List[DetectedQuestion]
    raw_processed_text: str
    ignored_phrases_count: int
    duplicates_filtered_count: int
