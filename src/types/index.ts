export type NavigationTab =
  | 'dashboard'
  | 'ai-chat'
  | 'interview-practice'
  | 'coding-assistant'
  | 'resume-analyzer'
  | 'question-bank'
  | 'history'
  | 'settings';

export interface SystemInfoData {
  platform: string;
  arch: string;
  memoryTotalGB: number;
  memoryFreeGB: number;
  cpus: number;
}

export interface LocalAIStatusData {
  engine: string;
  status: 'ready' | 'starting' | 'offline';
  model: string;
  mock: boolean;
  ollamaRunning?: boolean;
  backendOnline?: boolean;
}

export interface FeatureCardItem {
  id: NavigationTab;
  title: string;
  description: string;
  category: 'Practice' | 'Assistance' | 'Tools';
  badge?: string;
  iconName: string;
  isReadyInPhase1: boolean;
}

export interface InterviewSession {
  id: string;
  title: string;
  role: string;
  type: 'Behavioral' | 'Technical' | 'System Design' | 'Live Coding';
  date: string;
  durationMinutes: number;
  score: number;
  totalQuestions: number;
  status: 'Completed' | 'In Progress' | 'Abandoned';
  isMock: boolean;
}

export interface QuestionItem {
  id: string;
  title: string;
  category: 'Frontend' | 'Backend' | 'System Design' | 'Algorithms' | 'Behavioral';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags: string[];
  description: string;
  sampleAnswerHint?: string;
}

export type ExplanationStyle = 'short' | 'detailed' | 'beginner-friendly';
export type AnswerStyle = 'concise' | 'detailed' | 'beginner-friendly' | 'interview-ready-english';

export interface StructuredAnswer {
  direct_answer: string;
  simple_explanation: string;
  example: string;
  important_keywords: string[];
}

export interface QuestionProcessResponse {
  question: string;
  style: AnswerStyle;
  model_used: string;
  structured_answer: StructuredAnswer;
  raw_markdown: string;
  latency_ms: number;
  is_mock_fallback: boolean;
  warning?: string | null;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  explanationStyle?: ExplanationStyle;
  isMock?: boolean;
  modelUsed?: string;
  latencyMs?: number;
  error?: boolean;
}

export interface RecommendedModelInfo {
  name: string;
  tag: string;
  parameters: string;
  disk_size_gb: number;
  ram_required_gb: number;
  recommended_for_8gb_ram: boolean;
  description: string;
  download_command: string;
}

export interface ModelsApiResponse {
  ollama_running: boolean;
  ollama_version: string | null;
  default_model: string;
  downloaded_models: string[];
  recommended_models: RecommendedModelInfo[];
  hardware_note: string;
}

export interface BackendHealthResponse {
  status: string;
  service: string;
  ollama_connected: boolean;
  ollama_url: string;
  active_model: string;
  hardware_target: string;
  ram_recommendation: string;
}

export interface ResumeAnalysisResult {
  score: number;
  roleTarget: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  isMock: boolean;
}

// Phase 4 Audio Capture & Speech-to-Text Types
export type AudioDeviceCategory = 'microphone' | 'bluetooth_headset' | 'playback_loopback' | 'other';

export interface AudioDeviceInfo {
  device_id: number;
  name: string;
  hostapi_name: string;
  max_input_channels: number;
  max_output_channels: number;
  default_samplerate: number;
  category: AudioDeviceCategory;
  is_default_input: boolean;
  is_default_output: boolean;
  supports_loopback: boolean;
}

export interface AudioDevicesResponse {
  devices: AudioDeviceInfo[];
  default_input_id: number | null;
  default_output_id: number | null;
  windows_note: string;
}

export interface AudioTestResponse {
  device_id: number | null;
  device_name: string;
  rms_energy: number;
  peak_amplitude: number;
  db_level: number;
  audio_detected: boolean;
  success: boolean;
  message: string;
}

export interface TranscriptSegment {
  id: string;
  timestamp: string;
  text: string;
  is_final: boolean;
  confidence?: number;
}

export interface AudioSessionStatusResponse {
  state: 'idle' | 'recording' | 'transcribing' | 'paused' | 'stopped' | 'error';
  device_id: number | null;
  device_name: string;
  model_name: string;
  chunk_duration_sec: number;
  current_volume_rms: number;
  is_silent: boolean;
  finalized_segments: TranscriptSegment[];
  partial_segment?: TranscriptSegment | null;
  duration_seconds: number;
  error_message?: string | null;
}

export interface AppSettings {
  aiEngine: 'ollama' | 'fastapi-local' | 'mock';
  modelName: string;
  ollamaEndpoint: string;
  backendEndpoint: string;
  contextWindow: number;
  temperature: number;
  explanationStyle: ExplanationStyle;
  allowMockFallback: boolean;
  enableMic: boolean;
  theme: 'dark-slate' | 'dark-oled' | 'dark-zinc' | 'light';
  hardwareMode: 'low-ram-8gb' | 'standard';
}

// Phase 5 Question Detection Types
export type QuestionCategory = 'technical' | 'coding' | 'behavioral' | 'hr' | 'general';

export interface DetectedQuestion {
  id: string;
  text: string;
  category: QuestionCategory;
  confidence: number;
  timestamp: string;
  source_chunks: string[];
  status: 'pending_review' | 'auto_submitted' | 'answered' | 'dismissed';
}

export interface QuestionDetectionConfig {
  min_length_chars?: number;
  min_confidence?: number;
  debounce_seconds?: number;
  deduplication_threshold?: number;
  auto_answer_enabled?: boolean;
}

export interface QuestionDetectionRequest {
  chunks: TranscriptSegment[];
  config?: QuestionDetectionConfig;
  existing_detected_questions?: DetectedQuestion[];
}

export interface QuestionDetectionResponse {
  detected_questions: DetectedQuestion[];
  raw_processed_text: string;
  ignored_phrases_count: number;
  duplicates_filtered_count: number;
}

export interface SyntheticScenario {
  id: string;
  title: string;
  description: string;
  chunks: TranscriptSegment[];
  expected_category: string;
}

export interface SyntheticScenariosResponse {
  scenarios: SyntheticScenario[];
}
