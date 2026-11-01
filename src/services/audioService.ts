import {
  AudioDevicesResponse,
  AudioTestResponse,
  AudioSessionStatusResponse,
} from '../types';
import { BACKEND_URL } from './aiService';

export class AudioService {
  private baseUrl = BACKEND_URL;

  private async _fetch(path: string, options: RequestInit = {}, timeoutMs: number = 5000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Merge external signal if passed
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timer);
        return res;
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        // Fallback to relative path via Vite proxy (useful if direct 127.0.0.1 is blocked by browser policies)
        const altRes = await fetch(path, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timer);
        return altRes;
      }
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }

  async fetchDevices(): Promise<AudioDevicesResponse> {
    try {
      const res = await this._fetch('/api/v1/audio/devices', {}, 4000);
      if (res.ok) {
        return (await res.json()) as AudioDevicesResponse;
      }
      throw new Error(`Backend returned HTTP ${res.status}`);
    } catch (err: any) {
      throw new Error(`Failed to load audio devices: ${err.message || 'FastAPI backend unreachable'}`);
    }
  }

  async testDevice(deviceId?: number, durationSec: number = 1.0): Promise<AudioTestResponse> {
    try {
      const res = await this._fetch(
        '/api/v1/audio/test-device',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_id: deviceId, duration_sec: durationSec }),
        },
        5000
      );

      if (res.ok) {
        return (await res.json()) as AudioTestResponse;
      }

      let errorDetail = `Backend returned HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        errorDetail = errJson.detail || errorDetail;
      } catch {}
      throw new Error(errorDetail);
    } catch (err: any) {
      throw new Error(`Audio test failed: ${err.message || 'Backend is offline on port 8000'}`);
    }
  }

  async startSession(options: {
    deviceId?: number;
    modelName?: string;
    chunkDurationSec?: number;
    isLoopback?: boolean;
  }): Promise<{ status: string; device_name?: string }> {
    try {
      const res = await this._fetch(
        '/api/v1/audio/session/start',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: options.deviceId,
            model_name: options.modelName || 'tiny.en',
            chunk_duration_sec: options.chunkDurationSec || 3.0,
            is_loopback: options.isLoopback || false,
          }),
        },
        6000
      );

      if (res.ok) {
        return await res.json();
      }

      let errorDetail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        errorDetail = errJson.detail || errorDetail;
      } catch {}
      throw new Error(errorDetail);
    } catch (err: any) {
      throw new Error(`Could not start audio session: ${err.message || 'Backend is offline'}`);
    }
  }

  async pauseSession(): Promise<void> {
    await this._fetch(
      '/api/v1/audio/session/pause',
      { method: 'POST' },
      3000
    );
  }

  async resumeSession(): Promise<void> {
    await this._fetch(
      '/api/v1/audio/session/resume',
      { method: 'POST' },
      3000
    );
  }

  async stopSession(): Promise<void> {
    await this._fetch(
      '/api/v1/audio/session/stop',
      { method: 'POST' },
      4000
    );
  }

  async clearTranscript(): Promise<void> {
    await this._fetch(
      '/api/v1/audio/session/clear',
      { method: 'POST' },
      3000
    );
  }

  async getSessionStatus(): Promise<AudioSessionStatusResponse> {
    try {
      const res = await this._fetch('/api/v1/audio/session/status', {}, 3000);
      if (res.ok) {
        return (await res.json()) as AudioSessionStatusResponse;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err: any) {
      return {
        state: 'error',
        device_id: null,
        device_name: 'Microphone',
        model_name: 'tiny.en',
        chunk_duration_sec: 3.0,
        current_volume_rms: 0.0,
        is_silent: true,
        finalized_segments: [],
        partial_segment: null,
        duration_seconds: 0,
        error_message: `Audio Service Offline: ${err.message || 'Backend unreachable on port 8000'}`,
      };
    }
  }
}

export const audioService = new AudioService();
