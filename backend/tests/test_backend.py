import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.ollama_service import RECOMMENDED_8GB_MODELS

@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "ollama_connected" in data
        assert "hardware_target" in data
        assert "8 GB RAM" in data["hardware_target"]

@pytest.mark.asyncio
async def test_models_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/models")
        assert res.status_code == 200
        data = res.json()
        assert "ollama_running" in data
        assert "recommended_models" in data
        assert len(data["recommended_models"]) >= 4
        # Verify recommended models include RAM and disk specs
        llama32 = next((m for m in data["recommended_models"] if "3.2 3B" in m["name"]), None)
        assert llama32 is not None
        assert llama32["disk_size_gb"] <= 2.5
        assert llama32["ram_required_gb"] <= 2.5
        assert llama32["recommended_for_8gb_ram"] is True

@pytest.mark.asyncio
async def test_chat_mock_fallback_short():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "messages": [{"role": "user", "content": "Explain binary search"}],
            "explanation_style": "short",
            "model": "mock-fallback-model",
            "allow_mock_fallback": True
        }
        res = await client.post("/chat", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["explanation_style"] == "short"
        assert len(data["message"]["content"]) > 10
        assert data["is_mock_fallback"] is True
        assert data["warning"] is not None

@pytest.mark.asyncio
async def test_chat_mock_fallback_detailed():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "messages": [{"role": "user", "content": "How does Redis LRU work?"}],
            "explanation_style": "detailed",
            "model": "mock-fallback-model",
            "allow_mock_fallback": True
        }
        res = await client.post("/chat", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["explanation_style"] == "detailed"
        assert "Architectural" in data["message"]["content"] or "Trade-off" in data["message"]["content"]
        assert data["is_mock_fallback"] is True

@pytest.mark.asyncio
async def test_chat_mock_fallback_beginner():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "messages": [{"role": "user", "content": "What is an API?"}],
            "explanation_style": "beginner-friendly",
            "model": "mock-fallback-model",
            "allow_mock_fallback": True
        }
        res = await client.post("/chat", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["explanation_style"] == "beginner-friendly"
        assert "coffee shop" in data["message"]["content"].lower() or "imagine" in data["message"]["content"].lower()
        assert data["is_mock_fallback"] is True

@pytest.mark.asyncio
async def test_chat_offline_or_missing_model_no_fallback():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "messages": [{"role": "user", "content": "Test offline"}],
            "explanation_style": "detailed",
            "model": "nonexistent-model-xyz",
            "allow_mock_fallback": False
        }
        res = await client.post("/chat", json=payload)
        assert res.status_code in (404, 503)
        data = res.json()
        assert "Ollama" in data["detail"] or "Model" in data["detail"]

@pytest.mark.asyncio
async def test_process_question_concise():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "question": "What is debounce vs throttle?",
            "style": "concise",
            "model": "mock-fallback-model",
            "allow_mock_fallback": True
        }
        res = await client.post("/api/v1/interview/process-question", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["style"] == "concise"
        ans = data["structured_answer"]
        assert len(ans["direct_answer"]) > 10
        assert len(ans["simple_explanation"]) > 10
        assert len(ans["example"]) > 5
        assert len(ans["important_keywords"]) >= 2
        assert data["is_mock_fallback"] is True

@pytest.mark.asyncio
async def test_process_question_interview_ready_english():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "question": "How do you handle technical debt while meeting product deadlines?",
            "style": "interview-ready-english",
            "model": "mock-fallback-model",
            "allow_mock_fallback": True
        }
        res = await client.post("/api/v1/interview/process-question", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["style"] == "interview-ready-english"
        ans = data["structured_answer"]
        assert "prioritize" in ans["direct_answer"].lower() or "approach" in ans["direct_answer"].lower()
        assert len(ans["important_keywords"]) >= 3
        assert data["is_mock_fallback"] is True

@pytest.mark.asyncio
async def test_process_question_beginner_friendly():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "question": "What is a database index?",
            "style": "beginner-friendly",
            "model": "mock-fallback-model",
            "allow_mock_fallback": True
        }
        res = await client.post("/question/answer", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["style"] == "beginner-friendly"
        ans = data["structured_answer"]
        assert "kitchen" in ans["direct_answer"].lower() or "imagine" in ans["direct_answer"].lower() or "pizza" in ans["direct_answer"].lower()
        assert data["is_mock_fallback"] is True

@pytest.mark.asyncio
async def test_process_question_validation_error():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "question": "Hi",  # Too short (< 3 chars)
            "style": "concise"
        }
        res = await client.post("/api/v1/interview/process-question", json=payload)
        assert res.status_code == 422

# Phase 4 Audio Tests
@pytest.mark.asyncio
async def test_audio_devices_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/audio/devices")
        assert res.status_code == 200
        data = res.json()
        assert "devices" in data
        assert len(data["devices"]) > 0
        assert "Bluetooth Earbud Note" in data["windows_note"]
        # Check that classified categories exist
        categories = {d["category"] for d in data["devices"]}
        assert any(c in categories for c in ["microphone", "bluetooth_headset", "playback_loopback", "other"])

@pytest.mark.asyncio
async def test_audio_device_test_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Test default device with short 0.5s duration
        payload = {"duration_sec": 0.5}
        res = await client.post("/api/v1/audio/test-device", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "rms_energy" in data
        assert "peak_amplitude" in data
        assert "db_level" in data
        assert "device_name" in data

@pytest.mark.asyncio
async def test_audio_session_lifecycle():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Check initial status
        res = await client.get("/api/v1/audio/session/status")
        assert res.status_code == 200
        data = res.json()
        assert "state" in data
        assert "finalized_segments" in data

        # Clear transcript
        res_clear = await client.post("/api/v1/audio/session/clear")
        assert res_clear.status_code == 200
        assert res_clear.json()["status"] == "cleared"

@pytest.mark.asyncio
async def test_whisper_numpy_transcription():
    import numpy as np
    from app.services.audio_service import audio_service
    # Synthesize 1 second of silence / tone
    audio_test = np.zeros(16000, dtype=np.float32)
    model = audio_service.get_whisper_model("tiny.en")
    segments, info = model.transcribe(audio_test, beam_size=1)
    assert info.duration >= 0.9

# --- Phase 5 Question Detection from Transcript Tests ---

@pytest.mark.asyncio
async def test_detect_questions_multi_chunk():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "chunks": [
                {"id": "c1", "timestamp": "00:02", "text": "Can you walk me through...", "is_final": True},
                {"id": "c2", "timestamp": "00:05", "text": "how you would design a distributed caching layer...", "is_final": True},
                {"id": "c3", "timestamp": "00:08", "text": "with LRU eviction and replication?", "is_final": True},
            ],
            "config": {"min_length_chars": 15, "min_confidence": 0.60}
        }
        res = await client.post("/api/v1/detection/detect-questions", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert len(data["detected_questions"]) >= 1
        q = data["detected_questions"][0]
        assert "distributed caching layer" in q["text"]
        assert q["category"] == "technical"
        assert q["confidence"] >= 0.75

@pytest.mark.asyncio
async def test_detect_questions_noise_filtering():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "chunks": [
                {"id": "n1", "timestamp": "00:01", "text": "Can you hear me?", "is_final": True},
                {"id": "n2", "timestamp": "00:03", "text": "Yeah okay great.", "is_final": True},
                {"id": "n3", "timestamp": "00:05", "text": "So basically um...", "is_final": True},
                {"id": "n4", "timestamp": "00:08", "text": "What is the time complexity of QuickSort in the worst case?", "is_final": True},
            ]
        }
        res = await client.post("/api/v1/detection/detect-questions", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert len(data["detected_questions"]) == 1
        assert "QuickSort" in data["detected_questions"][0]["text"]
        assert data["detected_questions"][0]["category"] == "coding"
        assert data["ignored_phrases_count"] >= 2

@pytest.mark.asyncio
async def test_detect_questions_deduplication():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "chunks": [
                {"id": "d1", "timestamp": "00:02", "text": "Tell me about a time you handled a critical outage?", "is_final": True},
                {"id": "d2", "timestamp": "00:06", "text": "I mean, tell me about a time you handled a critical outage?", "is_final": True},
            ],
            "config": {"deduplication_threshold": 0.75}
        }
        res = await client.post("/api/v1/detection/detect-questions", json=payload)
        assert res.status_code == 200
        data = res.json()
        # The duplicate question must be filtered out
        assert len(data["detected_questions"]) == 1
        assert data["duplicates_filtered_count"] >= 1
        assert data["detected_questions"][0]["category"] == "behavioral"

@pytest.mark.asyncio
async def test_detect_questions_categories():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "chunks": [
                {"id": "q_coding", "timestamp": "00:02", "text": "Write a function to implement binary search on a sorted array.", "is_final": True},
                {"id": "q_behavioral", "timestamp": "00:05", "text": "Describe a situation where you had a disagreement with your manager.", "is_final": True},
                {"id": "q_hr", "timestamp": "00:08", "text": "Why do you want to work for this company specifically?", "is_final": True},
            ]
        }
        res = await client.post("/api/v1/detection/detect-questions", json=payload)
        assert res.status_code == 200
        data = res.json()
        cats = [q["category"] for q in data["detected_questions"]]
        assert "coding" in cats
        assert "behavioral" in cats
        assert "hr" in cats

@pytest.mark.asyncio
async def test_synthetic_scenarios_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/detection/synthetic-scenarios")
        assert res.status_code == 200
        data = res.json()
        assert "scenarios" in data
        assert len(data["scenarios"]) >= 4

# --- Regression & Workflow Integration Tests (Post Phase 5 Audit) ---

@pytest.mark.asyncio
async def test_detect_questions_ignores_partial_segments():
    """Verify that in-flight partial segments (is_final=False) do not trigger repeated questions."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "chunks": [
                {"id": "part-1", "timestamp": "00:01", "text": "What is the Big O time complexity of", "is_final": False},
                {"id": "final-1", "timestamp": "00:04", "text": "What is the time complexity of QuickSort in the worst case?", "is_final": True},
            ]
        }
        res = await client.post("/api/v1/detection/detect-questions", json=payload)
        assert res.status_code == 200
        data = res.json()
        # Should only detect the finalized question, discarding the in-flight partial fragment
        assert len(data["detected_questions"]) == 1
        assert "QuickSort" in data["detected_questions"][0]["text"]
        assert data["detected_questions"][0]["source_chunks"] == ["final-1"]

@pytest.mark.asyncio
async def test_detect_questions_auto_answer_mode():
    """Verify that auto_answer_enabled flag marks candidate questions with auto_submitted status."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "chunks": [
                {"id": "auto-1", "timestamp": "00:02", "text": "How does the Python Global Interpreter Lock affect multithreading?", "is_final": True},
            ],
            "config": {
                "auto_answer_enabled": True,
                "min_confidence": 0.60
            }
        }
        res = await client.post("/api/v1/detection/detect-questions", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert len(data["detected_questions"]) == 1
        q = data["detected_questions"][0]
        assert q["status"] == "auto_submitted"
        assert q["category"] == "technical"

@pytest.mark.asyncio
async def test_audio_session_output_endpoint_error():
    """Verify that attempting to start capture on a 0-input channel output endpoint reports clean error status."""
    from app.services.audio_service import audio_service
    # Search for an output-only device
    devices = audio_service.list_devices()
    output_dev = next((d for d in devices if d.max_input_channels == 0 and not d.supports_loopback), None)
    if output_dev is not None:
        audio_service.start_session(device_id=output_dev.device_id, is_loopback=False)
        assert audio_service.state == "error"
        assert "0 input channels" in audio_service.error_message
        audio_service.state = "idle"

@pytest.mark.asyncio
async def test_audio_loopback_endpoint_test():
    """Verify real system loopback endpoint testing via /api/v1/audio/test-device."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Find a device supporting loopback
        dev_res = await client.get("/api/v1/audio/devices")
        data = dev_res.json()
        loopback_dev = next((d for d in data["devices"] if d["supports_loopback"] or d["category"] == "playback_loopback"), None)
        if loopback_dev is not None:
            res = await client.post("/api/v1/audio/test-device", json={"device_id": loopback_dev["device_id"], "duration_sec": 0.5})
            assert res.status_code == 200
            test_data = res.json()
            assert test_data["success"] is True
            assert "Loopback" in test_data["device_name"] or "loopback" in test_data["message"].lower()

@pytest.mark.asyncio
async def test_audio_loopback_session_lifecycle():
    """Verify real system loopback session start, status polling, and stop."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        dev_res = await client.get("/api/v1/audio/devices")
        data = dev_res.json()
        loopback_dev = next((d for d in data["devices"] if d["supports_loopback"] or d["category"] == "playback_loopback"), None)
        if loopback_dev is not None:
            # Start loopback capture
            start_res = await client.post("/api/v1/audio/session/start", json={
                "device_id": loopback_dev["device_id"],
                "model_name": "tiny.en",
                "chunk_duration_sec": 2.0,
                "is_loopback": True
            })
            assert start_res.status_code == 200
            
            # Poll status
            status_res = await client.get("/api/v1/audio/session/status")
            assert status_res.status_code == 200
            status_data = status_res.json()
            assert status_data["state"] in ["recording", "transcribing"]
            
            # Stop session
            stop_res = await client.post("/api/v1/audio/session/stop")
            assert stop_res.status_code == 200
            assert stop_res.json()["status"] == "stopped"
