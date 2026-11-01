# FreeInterviewAI

**Free, Local-First AI Interview Practice & Assistance Desktop Application**

FreeInterviewAI is an offline-first desktop application designed for software engineers preparing for technical, behavioral, and system design interviews. It runs 100% locally on your machine without mandatory cloud APIs, subscription paywalls, or privacy telemetry leaks.

---

## Target Hardware Profile & Memory Limits

This application is strictly tuned for modest consumer hardware:
- **Processor:** Intel Core i5-1135G7 (11th Gen, 4 cores / 8 threads)
- **RAM:** 8 GB DDR4 / LPDDR4x
- **Storage:** ~512 GB SSD
- **Graphics:** Intel Iris Xe Integrated Graphics (No dedicated GPU assumed)
- **OS:** Windows 10 / 11 (64-bit)

### 8 GB RAM Boundary & Model Safety Envelope
Running LLMs larger than 4 Billion parameters on an 8 GB RAM laptop requires > 5 GB RAM, triggering Windows disk paging, audio buffer underruns, and unresponsiveness. 

FreeInterviewAI limits local models to **3B–4B Q4_K_M quantized models** and **compact INT8 Whisper models**:
- **LLM (`llama3.2:3b`):** ~2.0 GB RAM footprint, ~2.0 GB disk space. Optimal balance of reasoning and CPU speed.
- **STT (`faster-whisper` `tiny.en`):** ~150 MB RAM footprint, ~39 MB model file. High-speed CPU inference with INT8 quantization.
- **Combined Memory Overhead:** ~2.15 GB RAM, leaving ~5.85 GB RAM free for Windows OS, background services, and development tools.

> **Zero Cloud Data Transmission:**  
> All model queries, prompt histories, audio buffers, and transcripts remain strictly on `127.0.0.1`. No data leaves your machine.

---

## Phase 4 Architecture: Local Audio Capture & Speech-to-Text

```text
┌────────────────────────────────────────────────────────┐
│               Electron Desktop Renderer                │
│  - Tab 1: Live Audio Capture & Speech-to-Text (STT)    │
│  - Tab 2: Interview Question Processing & Structure    │
│  - Real-time Audio VU Meter (-60 dB to 0 dB, RMS)      │
│  - 6 Controls: Start, Pause, Resume, Stop, Clear, Test │
│  - Visible Recording Banner: Red Pulsating Pill        │
└───────────────────────────┬────────────────────────────┘
                            │ Safe Local REST & Polling (Port 8000)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Python FastAPI Audio & AI Service          │
│  - sounddevice (PortAudio WASAPI / MME / DirectSound)  │
│  - Audio Classification: Mic, Bluetooth, Loopback      │
│  - Silence Gate: Skips inference during silence (<0.003)│
│  - In-Memory Circular Buffer: Zero Audio Files on Disk │
│  - faster-whisper (CTranslate2 INT8 CPU Execution)     │
└────────────────────────────────────────────────────────┘
```

---

## Phase 4 Core Features & Windows Audio Research

### 1. Maintained Local Speech-to-Text Implementation
- Built using **`faster-whisper`** (backed by CTranslate2 and ONNX Runtime).
- Configured specifically for Windows on Intel Core i5 CPU with **`compute_type="int8"`**, **`cpu_threads=4`**, and **`beam_size=1`**.
- Models supported:
  - **`tiny.en` (Default):** ~39 MB download, ~150 MB RAM. Generates transcript segments in sub-second CPU time.
  - **`base.en`:** ~74 MB download, ~250 MB RAM. Higher transcription accuracy for specialized vocabulary.

### 2. Audio Endpoint Selection & Classification
The application classifies connected Windows audio endpoints into clear categories:
- **`microphone`:** Built-in laptop microphones and external USB microphones.
- **`bluetooth_headset`:** Bluetooth hands-free recording inputs (e.g. Airdopes 161, AirPods, Headset profiles).
- **`playback_loopback`:** Stereo playback output endpoints (WASAPI Loopback and Stereo Mix).

### 3. Bluetooth Earbuds Windows Routing Guide
> **Important Operating System Distinction:**  
> Windows separates Bluetooth audio devices into two distinct profiles:  
> 1. **Headset (Hands-Free HFP):** Low-bandwidth recording input for your voice.  
> 2. **Headphones (Stereo A2DP):** High-fidelity playback output for hearing the interviewer.  
> Microphone capture only captures what *you* speak; it does **not** capture incoming audio played into your earbuds. FreeInterviewAI provides an endpoint selector and diagnostic test so you can verify exactly which endpoint is active before starting an interview session.

### 4. Six Explicit User Controls
- **Start Recording:** Begins in-memory audio capture.
- **Pause Recording:** Temporarily pauses audio ingestion without losing elapsed time.
- **Resume Recording:** Continues live streaming transcription.
- **Stop Recording:** Flushes remaining buffer and finalizes transcript.
- **Clear Transcript:** Explicitly wipes transcript from RAM.
- **Test Audio / Endpoint Diagnostics:** Records a 1.0s sample, computes RMS energy, peak amplitude, and decibel level to confirm device health.

### 5. Live Transcript with Segment Differentiation
- **Timestamps:** Every segment is tagged with session elapsed time (`[00:03]`, `[00:15]`, etc.).
- **Finalized Segments:** Rendered as solid white cards with green checkmark confirmation.
- **Partial / In-Flight Segment:** Highlighted in amber italic text with an active typing indicator while the speaker is mid-sentence.
- **1-Click Bridge to Question Processor:** Any transcribed segment can be sent directly to the Phase 3 Structured Answer Panel with a single click.

### 6. Strict Privacy & Security Compliance
- **Explicit Visible Recording Status:** A prominent red pulsating badge (`● RECORDING IN PROGRESS`) and live timer are always displayed. Recording never occurs secretly.
- **Non-Storage by Default:** Audio buffers are held in memory solely for chunk duration, then discarded. Zero raw WAV or MP3 files are written to disk.
- **User-Controlled Transcript Saving:** Saving transcripts to session history is strictly opt-in via the "Save Transcript" button.
- **No Meeting Permissions Bypass:** Adheres strictly to standard Windows PortAudio APIs without hooking or stealth bypasses.

---

## Windows Setup & Execution Guide

Open PowerShell in `C:\Users\mayank singh\Desktop\FreeInterviewAI`:

### 1. Prerequisites
- **Node.js:** v18+ (v22 tested)
- **Python:** 3.10+ (Python 3.13 tested)
- **Ollama for Windows:** Download from [https://ollama.com/download](https://ollama.com/download)

### 2. Node.js Frontend & Electron Setup
```powershell
# Install Node dependencies
npm install

# Build production assets
npm run build
```

### 3. Python Backend Virtual Environment Setup
```powershell
# 1. Create Python virtual environment
python -m venv backend/venv

# 2. Activate virtual environment
.\backend\venv\Scripts\Activate.ps1

# 3. Install requirements (including sounddevice, faster-whisper, soundfile)
pip install -r backend/requirements.txt
```

### 4. Running the Application

#### Option A: Full Stack Development (Recommended)
Starts the FastAPI backend on port 8000, Vite dev server on port 5173, and launches the Electron desktop window:
```powershell
npm run dev:full
```

#### Option B: Standalone Services
```powershell
# Terminal 1: Start Python FastAPI Backend (127.0.0.1:8000)
npm run backend

# Terminal 2: Start Vite + Electron Desktop App
npm run dev
```

#### Option C: Run Production Build
```powershell
npm start
```

---

## Phase 5 Architecture: Question Detection from Existing Transcript

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      Electron Desktop Renderer                         │
│  - Tab 1: Live Audio Capture & Speech-to-Text (STT)                    │
│  - Tab 2: Question Detection Engine & Triage (Phase 5)                 │
│      * Real-time Debounce Window (0.5s - 5.0s) & Min Length Filter     │
│      * Category Badges: [Technical], [Coding], [Behavioral], [HR]      │
│      * Sequence Matcher Deduplication & Filler Noise Elimination       │
│      * Inline Question Editing & Approval Flow                         │
│      * User-Controlled Auto-Answer Toggle & Pause/Resume Controls      │
│      * Synthetic Scenarios Test Suite (Target Laptop Verification)     │
│  - Tab 3: Interview Question Processing & Structured Answer Panel      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Safe Local REST & Polling (Port 8000)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Python FastAPI Detection & AI Service                │
│  - POST /api/v1/detection/detect-questions                             │
│  - GET  /api/v1/detection/synthetic-scenarios                          │
│  - Multi-Chunk Sentence Accumulator (Ellipsis & Terminal Handling)     │
│  - Regex Interview Trigger Patterns & Syntactic Interrogative Scoring  │
│  - Sequence Matcher (difflib) Deduplication (>85% similarity filter)   │
│  - Zero Cloud Telemetry: 100% Local Heuristics & Local LLM Answering   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 5 Core Features & Capabilities

### 1. Robust Multi-Chunk Question Accumulation
- Transcribed speech frequently breaks questions across multiple pause boundaries (e.g., `"Can you walk me through..."` -> `"how you would design a distributed caching layer..."` -> `"with LRU eviction and replication?"`).
- The Phase 5 Question Detector tracks sentence terminals, pauses, and ellipses (`...`), combining fragmented speech chunks into complete, cohesive questions without premature truncation.

### 2. Interview Question Categorization & Confidence Scoring
- Regex triggers and interrogative syntax evaluate candidate sentences against five core interview categories:
  - **`technical`:** System design, caching, microservices, databases, CAP theorem, concurrency.
  - **`coding`:** Big-O complexity, algorithms, data structures, coding challenges.
  - **`behavioral`:** STAR method prompts, conflict management, production outages, leadership.
  - **`hr`:** Culture fit, compensation expectations, career aspirations.
  - **`general`:** Clarifications and open-ended technical discussions.
- Confidence scores (0%–100%) quantify pattern strength and grammatical interrogative markers (`?`, WH-words, auxiliary verbs).

### 3. Noise Artifact Filtering & Sequence Matcher Deduplication
- **Noise Rejection:** Automatically filters audio test artifacts, greeting boilerplate (`"can you hear me"`, `"am i audible"`), and casual filler affirmations (`"yeah okay great"`, `"so basically um"`).
- **Deduplication:** Interviewers frequently rephrase or restate questions. FreeInterviewAI runs sequence similarity matching (configurable cutoff, default 85%) to prevent re-submitting duplicate questions to the local LLM.

### 4. Interactive Review & Triage UI
- **Never Assumes STT is 100% Correct:** Speech models occasionally mishear acronyms or technical jargon. The triage UI displays candidate questions with confidence scores and provides an **inline editor** so users can refine words before generating an answer.
- **Explicit User Control:**
  - **Approve & Answer:** Sends approved questions to the local LLM answer generator.
  - **Auto-Answer Toggle:** When enabled, questions with high confidence (>85%) are automatically dispatched for inference.
  - **Detection Pause / Resume:** Halts evaluation at any time without terminating the audio recording.
  - **Dismiss / Restore:** Hides false positives while allowing quick restoration.

### 5. Built-in Synthetic Test Suite
- Includes 4 pre-configured synthetic transcript scenarios accessible directly from the UI:
  1. *Multi-Chunk System Design:* Combines 3 fragmented chunks into a single technical question.
  2. *Casual Speech & Noise Filter:* Rejects mic checks and filler words while capturing a QuickSort question.
  3. *Repetition & Deduplication:* Suppresses duplicate questions asked twice in succession.
  4. *Behavioral & HR Inquiries:* Triages managerial conflict and company motivation prompts.

---

## Automated Backend Unit Test Suite

Phase 5 includes **19 automated test cases** verifying all REST endpoints, question detection, audio device discovery, audio testing, session lifecycle, and local Whisper INT8 transcription on CPU:

```powershell
npm run backend:test
```

Or run directly with pytest:
```powershell
.\backend\venv\Scripts\python -m pytest -c backend/pytest.ini backend/tests -v
```

### Verified Test Cases (19/19 Passed):
1. `test_health_endpoint`: Verifies `/health` returns status, Ollama status, and 8 GB hardware target.
2. `test_models_endpoint`: Verifies `/models` returns 8 GB safe models with disk and RAM requirement limits.
3. `test_chat_mock_fallback_short`: Verifies concise bullet response generation under 150 words.
4. `test_chat_mock_fallback_detailed`: Verifies staff-level architectural explanations.
5. `test_chat_mock_fallback_beginner`: Verifies analogy-driven beginner-friendly explanations.
6. `test_chat_offline_ollama_no_fallback_raises_503`: Verifies clean HTTP 503 error handling when Ollama is offline.
7. `test_process_question_concise`: Verifies 4 structured sections generated in concise style.
8. `test_process_question_interview_ready_english`: Verifies executive phrasing and keywords.
9. `test_process_question_beginner_friendly`: Verifies analogy-driven structured answer.
10. `test_process_question_validation_error`: Verifies request validation for inputs < 3 characters.
11. `test_audio_devices_endpoint`: Verifies endpoint listing and Bluetooth device classification.
12. `test_audio_device_test_endpoint`: Verifies RMS, peak, and dB calculation on audio input.
13. `test_audio_session_lifecycle`: Verifies start, pause, resume, clear lifecycle states.
14. `test_whisper_numpy_transcription`: Verifies `faster-whisper` INT8 CPU transcription of in-memory float32 numpy buffers.
15. `test_detect_questions_multi_chunk`: Verifies multi-chunk question combination with trailing ellipses into a single complete technical question.
16. `test_detect_questions_noise_filtering`: Verifies rejection of noise, mic checks, and casual speech fillers.
17. `test_detect_questions_deduplication`: Verifies sequence matcher deduplication (>85% similarity).
18. `test_detect_questions_categories`: Verifies classification into technical, coding, behavioral, and HR categories.
19. `test_synthetic_scenarios_endpoint`: Verifies `/api/v1/detection/synthetic-scenarios` returns built-in test fixtures.

---

## Feature Implementation & Testing Status

| Feature | Implementation State | Verification Status |
| :--- | :--- | :--- |
| **Question Detection from Transcript** | Multi-chunk sentence compiler with terminal tracking | **Tested & Active** |
| **Category Triage** | Technical, Coding, Behavioral, HR, General regex scoring | **Tested & Active** |
| **Noise & Artifact Filter** | Rejection of greetings, mic checks, and conversational fillers | **Tested & Active** |
| **Deduplication Engine** | Sequence matcher similarity filtering (>85% cutoff) | **Tested & Active** |
| **Candidate Review & Inline Edit** | Edit text, approve, dismiss, and restore questions | **Tested & Active** |
| **Auto-Answer & Pause Controls** | User toggle for automatic dispatch and engine pause | **Tested & Active** |
| **Synthetic Test Suite** | 4 built-in simulation scenarios in UI and API | **Tested & Active** |
| **Local Speech-to-Text** | `faster-whisper` `tiny.en` / `base.en` (INT8 CPU) | **Tested & Active** |
| **Audio Source Selection** | Microphones, Bluetooth headsets, Loopback | **Tested & Active** |
| **Dedicated Answer Window** | Resizable, always-on-top, font zoom floating panel | **Tested & Active** |
| **Automated Test Suite** | 19 pytest unit tests | **19/19 Passed** |
