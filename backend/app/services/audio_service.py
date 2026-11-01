import time
import math
import threading
import uuid
import ctypes
from typing import List, Optional, Dict, Any, Tuple
import numpy as np
import sounddevice as sd
import soundcard as sc
from faster_whisper import WhisperModel

from app.schemas import (
    AudioDeviceInfo,
    AudioDeviceCategory,
    AudioTestResponse,
    TranscriptSegment,
    AudioSessionStatusResponse,
)

def _init_com():
    """Initializes Windows COM on current thread for WASAPI / Media Foundation audio access."""
    try:
        ctypes.windll.ole32.CoInitialize(None)
    except Exception:
        pass

def _uninit_com():
    """Uninitializes Windows COM on current thread."""
    try:
        ctypes.windll.ole32.CoUninitialize()
    except Exception:
        pass

class AudioService:
    def __init__(self):
        self._model: Optional[WhisperModel] = None
        self._current_model_name: Optional[str] = None
        self._model_lock = threading.Lock()

        # Audio streaming session state
        self.state: str = "idle"  # idle | recording | transcribing | paused | stopped | error
        self.device_id: Optional[int] = None
        self.device_name: str = "Default Microphone"
        self.chunk_duration_sec: float = 3.0
        self.is_silent: bool = True
        self.current_volume_rms: float = 0.0
        self.error_message: Optional[str] = None
        self.start_time: float = 0.0
        self.pause_time: float = 0.0
        self.accumulated_pause_sec: float = 0.0
        self.is_loopback_active: bool = False

        # Transcript storage in memory only (never written to disk automatically)
        self.finalized_segments: List[TranscriptSegment] = []
        self.partial_segment: Optional[TranscriptSegment] = None

        # Audio stream and worker threads
        self._stream: Optional[sd.InputStream] = None
        self._audio_buffer: List[float] = []
        self._buffer_lock = threading.Lock()
        self._worker_thread: Optional[threading.Thread] = None
        self._loopback_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()

    def get_whisper_model(self, model_name: str = "tiny.en") -> WhisperModel:
        """Lazily load and cache the compact Whisper model on CPU."""
        with self._model_lock:
            if self._model is None or self._current_model_name != model_name:
                # Optimized INT8 quantization for Intel Core i5 CPU
                self._model = WhisperModel(
                    model_name,
                    device="cpu",
                    compute_type="int8",
                    cpu_threads=4,
                    num_workers=1,
                )
                self._current_model_name = model_name
            return self._model

    def _get_soundcard_loopback(self, dev_name: Optional[str] = None):
        """Finds the corresponding Windows WASAPI loopback endpoint using soundcard."""
        _init_com()
        try:
            loop_mics = [m for m in sc.all_microphones(include_loopback=True) if m.isloopback]
            if not loop_mics:
                return None
            if dev_name:
                clean = dev_name.lower()
                for m in loop_mics:
                    if m.name.lower() in clean or clean in m.name.lower():
                        return m
            return loop_mics[0]
        except Exception:
            return None

    def list_devices(self) -> List[AudioDeviceInfo]:
        """Query and classify all Windows audio endpoints using sounddevice and soundcard."""
        devices = sd.query_devices()
        hostapis = sd.query_hostapis()
        default_in, default_out = sd.default.device

        classified: List[AudioDeviceInfo] = []

        for idx, dev in enumerate(devices):
            name = str(dev.get("name", f"Device {idx}"))
            max_in = int(dev.get("max_input_channels", 0))
            max_out = int(dev.get("max_output_channels", 0))
            sr = float(dev.get("default_samplerate", 44100.0))
            api_idx = dev.get("hostapi", 0)
            api_name = hostapis[api_idx]["name"] if api_idx < len(hostapis) else "Unknown"

            if max_in == 0 and max_out == 0:
                continue

            lower_name = name.lower()
            category: AudioDeviceCategory = "other"
            supports_loop = False

            # Classify device categories
            if any(term in lower_name for term in ["airpod", "headset", "hands-free", "airdopes", "bluetooth", "bthhfenum"]) and max_in > 0:
                category = "bluetooth_headset"
                supports_loop = False
            elif any(term in lower_name for term in ["stereo mix", "what u hear"]):
                category = "playback_loopback"
                supports_loop = True
                max_in = 2
            elif max_in > 0:
                category = "microphone"
                supports_loop = False
            elif max_out > 0:
                # Playback endpoint: check if WASAPI loopback is supported
                if api_name in ["Windows WASAPI", "Windows DirectSound"] and any(k in lower_name for k in ["speakers", "headphones", "sound mapper", "primary sound driver"]):
                    category = "playback_loopback"
                    supports_loop = True
                    max_in = 2  # WASAPI loopback captures stereo output
                else:
                    category = "other"
                    supports_loop = False

            is_def_in = (idx == default_in)
            is_def_out = (idx == default_out)

            classified.append(
                AudioDeviceInfo(
                    device_id=idx,
                    name=name,
                    hostapi_name=api_name,
                    max_input_channels=max_in,
                    max_output_channels=max_out,
                    default_samplerate=sr,
                    category=category,
                    is_default_input=is_def_in,
                    is_default_output=is_def_out,
                    supports_loopback=supports_loop,
                )
            )

        return classified

    def test_device(self, device_id: Optional[int] = None, duration_sec: float = 1.0) -> AudioTestResponse:
        """
        Record a real 1-second sample from chosen endpoint to test signal strength,
        RMS volume, and peak amplitude. Confirms device connectivity with real measurements.
        """
        target_dev = device_id if device_id is not None else sd.default.device[0]
        dev_info = sd.query_devices(target_dev)
        dev_name = str(dev_info.get("name", f"Device {target_dev}"))
        max_in = int(dev_info.get("max_input_channels", 0))
        lower_name = dev_name.lower()

        is_loop = (
            any(k in lower_name for k in ["loopback", "stereo mix", "what u hear", "sound driver", "sound mapper", "speakers", "headphones", "primary"])
            or (dev_info.get("max_output_channels", 0) > 0 and max_in == 0)
        )

        samplerate = 16000
        frames_to_record = int(samplerate * duration_sec)

        # 1. Real System Loopback Test via soundcard
        if is_loop:
            try:
                loop_mic = self._get_soundcard_loopback(dev_name)
                if loop_mic is None:
                    return AudioTestResponse(
                        device_id=target_dev,
                        device_name=dev_name,
                        rms_energy=0.0,
                        peak_amplitude=0.0,
                        db_level=-100.0,
                        audio_detected=False,
                        success=False,
                        message="Windows WASAPI Loopback device not accessible.",
                    )

                with loop_mic.recorder(samplerate=samplerate, channels=1) as rec:
                    data = rec.record(numframes=frames_to_record)

                flat = data.flatten()
                peak = float(np.max(np.abs(flat))) if len(flat) > 0 else 0.0
                rms = float(np.sqrt(np.mean(flat**2))) if len(flat) > 0 else 0.0
                db = 20.0 * math.log10(max(rms, 1e-5))
                audio_detected = (peak > 0.008 or rms > 0.002)

                msg = (
                    f"System loopback audio signal detected ({db:.1f} dB, Peak: {peak:.2f}) from playing audio."
                    if audio_detected
                    else f"System loopback active ({db:.1f} dB). Ready to capture audio when playing from Meet/Zoom/Browser."
                )

                return AudioTestResponse(
                    device_id=target_dev,
                    device_name=f"{dev_name} [System Loopback]",
                    rms_energy=round(rms, 4),
                    peak_amplitude=round(peak, 4),
                    db_level=round(db, 1),
                    audio_detected=audio_detected,
                    success=True,
                    message=msg,
                )
            except Exception as e:
                return AudioTestResponse(
                    device_id=target_dev,
                    device_name=dev_name,
                    rms_energy=0.0,
                    peak_amplitude=0.0,
                    db_level=-100.0,
                    audio_detected=False,
                    success=False,
                    message=f"Loopback test failed: {str(e)}",
                )

        # 2. Pure output device with 0 inputs that does not support loopback
        if max_in <= 0:
            return AudioTestResponse(
                device_id=target_dev,
                device_name=dev_name,
                rms_energy=0.0,
                peak_amplitude=0.0,
                db_level=-100.0,
                audio_detected=False,
                success=False,
                message=f"Endpoint '{dev_name}' has 0 input channels. Select an input microphone or loopback endpoint.",
            )

        # 3. Real Microphone Test via sounddevice / soundcard
        try:
            recording = sd.rec(
                frames=frames_to_record,
                samplerate=samplerate,
                channels=1,
                dtype="float32",
                device=target_dev,
                blocking=True,
            )

            flat = recording.flatten()
            peak = float(np.max(np.abs(flat))) if len(flat) > 0 else 0.0
            rms = float(np.sqrt(np.mean(flat**2))) if len(flat) > 0 else 0.0
            db = 20.0 * math.log10(max(rms, 1e-5))

            audio_detected = (peak > 0.008 or rms > 0.002)

            msg = (
                f"Audio signal detected ({db:.1f} dB, Peak: {peak:.2f})"
                if audio_detected
                else f"Low signal / Silence detected ({db:.1f} dB). Check device mute or speak closer to mic."
            )

            return AudioTestResponse(
                device_id=target_dev,
                device_name=dev_name,
                rms_energy=round(rms, 4),
                peak_amplitude=round(peak, 4),
                db_level=round(db, 1),
                audio_detected=audio_detected,
                success=True,
                message=msg,
            )
        except Exception as e:
            return AudioTestResponse(
                device_id=target_dev,
                device_name=dev_name,
                rms_energy=0.0,
                peak_amplitude=0.0,
                db_level=-100.0,
                audio_detected=False,
                success=False,
                message=f"Device test failed: {str(e)}. Device may be disconnected or busy.",
            )

    def _audio_callback(self, indata, frames, time_info, status):
        """Streaming callback invoked by PortAudio for microphone recording."""
        if status:
            pass
        if self._pause_event.is_set():
            return

        flat = indata[:, 0].copy()
        rms = float(np.sqrt(np.mean(flat**2))) if len(flat) > 0 else 0.0
        self.current_volume_rms = rms
        self.is_silent = (rms < 0.0025)

        with self._buffer_lock:
            self._audio_buffer.extend(flat.tolist())

    def _loopback_worker(self, dev_name: str):
        """Continuous background streaming worker for Windows WASAPI loopback capture."""
        _init_com()
        try:
            loop_mic = self._get_soundcard_loopback(dev_name)
            if not loop_mic:
                self.state = "error"
                self.error_message = "Windows WASAPI loopback device could not be acquired."
                return

            with loop_mic.recorder(samplerate=16000, channels=1) as rec:
                while not self._stop_event.is_set():
                    if self._pause_event.is_set():
                        time.sleep(0.1)
                        continue

                    # Record in 100ms chunks (1600 frames)
                    data = rec.record(numframes=1600)
                    flat = data.flatten()
                    rms = float(np.sqrt(np.mean(flat**2))) if len(flat) > 0 else 0.0
                    self.current_volume_rms = rms
                    self.is_silent = (rms < 0.0025)

                    with self._buffer_lock:
                        self._audio_buffer.extend(flat.tolist())
        except Exception as e:
            if not self._stop_event.is_set():
                self.state = "error"
                self.error_message = f"Loopback streaming error: {str(e)}"
        finally:
            _uninit_com()

    def start_session(
        self,
        device_id: Optional[int] = None,
        model_name: str = "tiny.en",
        chunk_duration_sec: float = 3.0,
        is_loopback: bool = False,
    ):
        """Start a live audio recording & transcription session."""
        if self.state in ["recording", "transcribing"]:
            return

        self.device_id = device_id
        target_dev_idx = device_id if device_id is not None else sd.default.device[0]
        dev_info = sd.query_devices(target_dev_idx)
        max_in = int(dev_info.get("max_input_channels", 0))
        self.device_name = str(dev_info.get("name", "Microphone"))
        self.chunk_duration_sec = chunk_duration_sec
        self.error_message = None

        lower_name = self.device_name.lower()
        is_loop = is_loopback or any(k in lower_name for k in ["loopback", "stereo mix", "what u hear"])
        self.is_loopback_active = is_loop

        self.start_time = time.time()
        self.accumulated_pause_sec = 0.0
        self.state = "recording"

        with self._buffer_lock:
            self._audio_buffer.clear()

        self._stop_event.clear()
        self._pause_event.clear()

        if is_loop:
            # Start loopback capture thread
            self._loopback_thread = threading.Thread(
                target=self._loopback_worker,
                args=(self.device_name,),
                daemon=True,
            )
            self._loopback_thread.start()
        elif max_in <= 0:
            self.state = "error"
            self.error_message = (
                f"Selected endpoint '{self.device_name}' has 0 input channels. "
                "Windows does not support recording directly from pure playback endpoints without WASAPI Loopback or Stereo Mix."
            )
            return
        else:
            # Start microphone input stream at 16000Hz mono
            try:
                self._stream = sd.InputStream(
                    samplerate=16000,
                    channels=1,
                    dtype="float32",
                    device=device_id,
                    callback=self._audio_callback,
                    blocksize=1024,
                )
                self._stream.start()
            except Exception as e:
                self.state = "error"
                self.error_message = f"Failed to open audio endpoint: {str(e)}"
                return

        # Start background worker thread that processes audio chunks with faster-whisper
        self._worker_thread = threading.Thread(
            target=self._transcription_worker,
            args=(model_name,),
            daemon=True,
        )
        self._worker_thread.start()

    def _transcription_worker(self, model_name: str):
        """Background worker thread that incrementally transcribes accumulated audio chunks."""
        samplerate = 16000
        chunk_size = int(samplerate * self.chunk_duration_sec)
        model = self.get_whisper_model(model_name)

        while not self._stop_event.is_set():
            time.sleep(0.25)

            if self._pause_event.is_set():
                continue

            chunk_to_process = None
            with self._buffer_lock:
                if len(self._audio_buffer) >= chunk_size:
                    # Extract the chunk and slide forward
                    chunk_to_process = np.array(self._audio_buffer[:chunk_size], dtype=np.float32)
                    # Keep a 0.3s overlap for speech continuity across boundaries
                    overlap_samples = int(samplerate * 0.3)
                    self._audio_buffer = self._audio_buffer[chunk_size - overlap_samples:]

            if chunk_to_process is not None:
                # 1. Silence Gate: If chunk is silent, skip inference to save CPU and battery
                rms = float(np.sqrt(np.mean(chunk_to_process**2)))
                if rms < 0.002:
                    self.partial_segment = None
                    if self.state == "transcribing":
                        self.state = "recording"
                    continue

                # 2. Incremental in-memory transcription using faster-whisper
                prev_state = self.state
                try:
                    self.state = "transcribing"
                    elapsed = max(0, int(time.time() - self.start_time - self.accumulated_pause_sec))
                    timestamp_str = f"{elapsed // 60:02d}:{elapsed % 60:02d}"

                    # Explicit English for .en models; auto-detect multilingual (Hindi/Hinglish) for 'tiny'
                    lang = "en" if model_name.endswith(".en") else None

                    segments, _ = model.transcribe(
                        chunk_to_process,
                        beam_size=1,
                        language=lang,
                        vad_filter=True,
                    )

                    text_chunks = [s.text.strip() for s in segments if s.text.strip()]
                    joined_text = " ".join(text_chunks).strip()

                    if joined_text:
                        # Avoid duplicates from consecutive chunks
                        if not self.finalized_segments or self.finalized_segments[-1].text != joined_text:
                            seg_id = str(uuid.uuid4())[:8]
                            final_seg = TranscriptSegment(
                                id=seg_id,
                                timestamp=timestamp_str,
                                text=joined_text,
                                is_final=True,
                                confidence=0.95,
                            )
                            self.finalized_segments.append(final_seg)
                        self.partial_segment = None
                except Exception as e:
                    self.error_message = f"Transcription error: {str(e)}"
                finally:
                    if self.state == "transcribing":
                        self.state = prev_state

    def pause_session(self):
        """Pause audio capture."""
        if self.state in ["recording", "transcribing"]:
            self.state = "paused"
            self.pause_time = time.time()
            self._pause_event.set()

    def resume_session(self):
        """Resume paused audio capture."""
        if self.state == "paused":
            self.state = "recording"
            if self.pause_time > 0:
                self.accumulated_pause_sec += (time.time() - self.pause_time)
            self._pause_event.clear()

    def stop_session(self):
        """Stop audio capture and finalize remaining buffer."""
        if self.state in ["recording", "transcribing", "paused"]:
            self.state = "stopped"
            self._stop_event.set()

            if self._stream is not None:
                try:
                    self._stream.stop()
                    self._stream.close()
                except Exception:
                    pass
                self._stream = None

            # Finalize any remaining speech in buffer
            with self._buffer_lock:
                remaining = self._audio_buffer.copy()
                self._audio_buffer.clear()

            if len(remaining) > 8000:  # > 0.5 sec
                arr = np.array(remaining, dtype=np.float32)
                rms = float(np.sqrt(np.mean(arr**2)))
                if rms >= 0.002:
                    try:
                        model = self.get_whisper_model(self._current_model_name or "tiny.en")
                        lang = "en" if (self._current_model_name or "tiny.en").endswith(".en") else None
                        segments, _ = model.transcribe(arr, beam_size=1, language=lang, vad_filter=True)
                        txt = " ".join(s.text.strip() for s in segments if s.text.strip())
                        if txt:
                            elapsed = max(0, int(time.time() - self.start_time - self.accumulated_pause_sec))
                            ts = f"{elapsed // 60:02d}:{elapsed % 60:02d}"
                            if not self.finalized_segments or self.finalized_segments[-1].text != txt:
                                self.finalized_segments.append(
                                    TranscriptSegment(
                                        id=str(uuid.uuid4())[:8],
                                        timestamp=ts,
                                        text=txt,
                                        is_final=True,
                                        confidence=0.92,
                                    )
                                )
                    except Exception:
                        pass

            self.partial_segment = None

    def clear_transcript(self):
        """Wipes the ephemeral transcript from memory."""
        self.finalized_segments.clear()
        self.partial_segment = None

    def get_status(self) -> AudioSessionStatusResponse:
        """Returns live session status, audio level, and segments."""
        duration = 0
        if self.state in ["recording", "transcribing", "paused"]:
            duration = max(0, int(time.time() - self.start_time - self.accumulated_pause_sec))

        return AudioSessionStatusResponse(
            state=self.state,
            device_id=self.device_id,
            device_name=self.device_name,
            model_name=self._current_model_name or "tiny.en",
            chunk_duration_sec=self.chunk_duration_sec,
            current_volume_rms=round(self.current_volume_rms, 4),
            is_silent=self.is_silent,
            finalized_segments=self.finalized_segments,
            partial_segment=self.partial_segment,
            duration_seconds=duration,
            error_message=self.error_message,
        )

audio_service = AudioService()
