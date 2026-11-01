# FreeInterviewAI

**Free, Local-First AI Interview Practice & Assistance Desktop Application**

FreeInterviewAI is an offline-first desktop application designed for software engineers preparing for technical, behavioral, and system design interviews. It runs 100% locally on your machine without mandatory cloud APIs, subscription paywalls, or privacy telemetry leaks, while also offering seamless live web deployment.

---

## 🚀 Live Deployments & Links

| Service | Environment | URL |
| :--- | :--- | :--- |
| **Frontend Web App** | GitHub Pages (Production SPA) | **[https://mayanksingh-ai1.github.io/FreeInterviewAI/](https://mayanksingh-ai1.github.io/FreeInterviewAI/)** |
| **Backend API (Cloud Edge)** | Cloudflare Edge Tunnel | **[https://automobile-platforms-ultra-excluding.trycloudflare.com](https://automobile-platforms-ultra-excluding.trycloudflare.com/health)** |
| **Backend API (Local)** | Localhost Uvicorn Server | `http://127.0.0.1:8000` |
| **GitHub Repository** | Source Code & Releases | **[https://github.com/mayanksingh-ai1/FreeInterviewAI](https://github.com/mayanksingh-ai1/FreeInterviewAI)** |

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

FreeInterviewAI limits local models to **1B–3.8B Q4_K_M quantized models** and **compact INT8 Whisper models**:
- **LLM (`llama3.2:1b` / `llama3.2:3b`):** ~1.1–2.0 GB RAM footprint. Ultra-fast CPU token generation.
- **STT (`faster-whisper` `tiny.en` / `tiny` multilingual):** ~150 MB RAM footprint, ~39 MB model file. High-speed CPU inference with INT8 quantization (~0.4s latency).
- **Combined Memory Overhead:** ~1.3–2.15 GB RAM, leaving ample RAM free for Windows OS, background services, and IDEs.

> **Zero Cloud Data Transmission:**  
> All model queries, prompt histories, audio buffers, and transcripts remain strictly on your machine. No data leaves without your approval.

---

## Architecture & System Design

```text
┌────────────────────────────────────────────────────────┐
│               Electron Desktop & Web App               │
│  - Tab 1: Live Audio Capture & Speech-to-Text (STT)    │
│  - Tab 2: Question Detection Engine & Triage           │
│  - Tab 3: Structured Answer Panel (4 Sections)         │
│  - Real-time Audio VU Meter (-60 dB to 0 dB, RMS)      │
│  - Themes: Light Mode, Dark Slate, OLED Black, Zinc    │
└───────────────────────────┬────────────────────────────┘
                            │ Safe Local / Cloud REST API
                            ▼
┌────────────────────────────────────────────────────────┐
│             Python FastAPI Audio & AI Service          │
│  - sounddevice & soundcard WASAPI Loopback Capture     │
│  - Audio Classification: Mic, Bluetooth, Loopback      │
│  - Silence Gate: Skips inference during silence (<0.002)│
│  - In-Memory Circular Buffer: Zero Audio Files on Disk │
│  - faster-whisper (CTranslate2 INT8 CPU Execution)     │
│  - Ollama Engine (llama3.2:1b local model)             │
└────────────────────────────────────────────────────────┘
```

---

## Core Features & Capabilities

### 1. Real Audio Capture & Windows System Audio Loopback
- **Microphone Capture:** Supports built-in laptop microphones, external USB microphones, and Bluetooth headset microphones.
- **Windows WASAPI Loopback:** Directly captures audio playing inside Google Meet, Zoom, browser tabs, or Bluetooth earbuds.
- **Live VU Meter & Diagnostics:** Real-time RMS decibel meter (-60 dB to 0 dB) and 1.0s sample test button.

### 2. High-Speed Local Speech-to-Text (`faster-whisper`)
- Powered by CTranslate2 with `compute_type="int8"` and 4 physical CPU threads.
- **`tiny.en`:** ~39 MB download, sub-second (0.4s) transcription on Intel Core i5.
- **`tiny` (Multilingual):** Supports English, Hindi, and Hinglish.
- **Silence Gate:** Skips inference when audio RMS is below 0.002 to save CPU cycles and battery.

### 3. Interview Question Detection & Categorization
- Automatically compiles fragmented speech chunks into complete questions.
- Categorizes questions into **Technical**, **Coding**, **Behavioral**, **HR**, and **General**.
- Filters greetings (`"can you hear me"`), affirmations, and background audio noise.
- Deduplication engine suppresses repeated questions using sequence similarity matching (>85%).

### 4. Structured 4-Part Answer Panel
Every detected or manually entered question is processed into:
1. **Direct Answer:** High-impact executive summary.
2. **Simple Explanation:** Architectural and conceptual breakdown.
3. **Example:** Production scenario or clean code snippet.
4. **Important Keywords:** Crucial technical terms for interviewer recall.

### 5. Multi-Theme UI (Light & Dark Modes)
- ☀️ **Clean Light:** High-contrast crisp daytime mode.
- 🌙 **Dark Slate:** Balanced cool dark theme (Default).
- ✨ **Midnight OLED:** 100% true pitch black (`#000000`).
- 🎛️ **Modern Zinc:** Neutral studio dark aesthetic.
- Dynamically persisted in `localStorage`.

---

## Windows Local Setup & Execution Guide

Open PowerShell in the project directory:

### 1. Prerequisites
- **Node.js:** v18+ (v22 tested)
- **Python:** 3.10+ (Python 3.13 tested)
- **Ollama for Windows:** Download from [https://ollama.com/download](https://ollama.com/download)
- Pull model: `ollama run llama3.2:1b`

### 2. Install Dependencies
```powershell
# Install Node dependencies
npm install

# Setup Python virtual environment
python -m venv backend/venv
.\backend\venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

### 3. Running the Full Stack
```powershell
# Launches FastAPI (8000), Vite (5173), and Electron Desktop Window
npm run dev:full
```

---

## Automated Test Suite

All 24 backend automated tests pass successfully:

```powershell
npm run backend:test
```

```text
============================= 24 passed in 4.62s =============================
```

---

## License

MIT License. Free and open source for all developers.
