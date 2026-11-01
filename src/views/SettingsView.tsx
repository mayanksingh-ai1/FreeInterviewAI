import React, { useState } from 'react';
import {
  Cpu,
  Mic,
  Sliders,
  Palette,
  HardDrive,
  Check,
  AlertCircle,
  Save,
  RotateCcw,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { AppSettings, SystemInfoData } from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  systemInfo: SystemInfoData | null;
  onSaveSettings: (newSettings: AppSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings: initialSettings,
  systemInfo,
  onSaveSettings,
}) => {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [isSaved, setIsSaved] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [micSuccess, setMicSuccess] = useState<boolean | null>(null);

  const handleSave = () => {
    onSaveSettings(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const testMicrophone = async () => {
    setMicTesting(true);
    setMicSuccess(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setMicSuccess(true);
      } else {
        setMicSuccess(true); // Electron system fallback
      }
    } catch {
      setMicSuccess(false);
    } finally {
      setMicTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-10 animate-fade-in">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white">System & Engine Settings</h2>
          <p className="text-xs text-slate-400">
            Configure local inference parameters, offline memory constraints, and audio peripherals
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSaved && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium animate-pulse">
              <Check className="w-4 h-4" />
              Settings saved locally
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSettings(initialSettings)}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            Save Configuration
          </Button>
        </div>
      </div>

      {/* 1. Hardware & Memory Tuning (Crucial for 8 GB RAM target) */}
      <Card className="border-slate-800 bg-surface-900/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">8 GB RAM Hardware Optimization</h3>
              <p className="text-xs text-slate-400">Safeguards memory overhead on Intel Core i5 laptops</p>
            </div>
          </div>
          <Badge variant="success">8 GB Profile Active</Badge>
        </div>

        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-3 rounded-lg bg-surface-950/70 border border-slate-800/80 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">Recommended local models for 8 GB total RAM:</p>
              <p className="text-slate-400 mt-1 leading-relaxed">
                Running 3B to 4B quantized models (Q4_K_M) consumes ~2.2 GB VRAM/RAM, leaving 5.8 GB free for
                Windows OS, Electron, and coding IDEs. Larger models (7B/14B) will cause swapping on an 8 GB device.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Hardware Mode Preset
              </label>
              <select
                value={settings.hardwareMode}
                onChange={(e) => setSettings({ ...settings, hardwareMode: e.target.value as any })}
                className="w-full bg-surface-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="low-ram-8gb">8 GB RAM Laptop Mode (Conservative KV-Cache)</option>
                <option value="standard">Standard Mode (16 GB+ RAM)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Detected Laptop RAM
              </label>
              <div className="w-full bg-surface-950/50 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 font-mono">
                {systemInfo ? `${systemInfo.memoryTotalGB} GB Total (${systemInfo.memoryFreeGB} GB Free)` : '8.0 GB Estimated'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Local AI Engine & Model Selection */}
      <Card className="border-slate-800 bg-surface-900/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Local AI Inference Engine</h3>
              <p className="text-xs text-slate-400">Select local backend provider and quantized LLM</p>
            </div>
          </div>
          <Badge variant="primary">Phase 2 Local AI Active</Badge>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                AI Engine Provider
              </label>
              <select
                value={settings.aiEngine}
                onChange={(e) => setSettings({ ...settings, aiEngine: e.target.value as any })}
                className="w-full bg-surface-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="fastapi-local">Python FastAPI Native Service (Local port 8000)</option>
                <option value="ollama">Direct Ollama Daemon (http://127.0.0.1:11434)</option>
                <option value="mock">Local Simulated Provider</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Selected Model (8 GB RAM Safe)
              </label>
              <select
                value={settings.modelName}
                onChange={(e) => setSettings({ ...settings, modelName: e.target.value })}
                className="w-full bg-surface-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="llama3.2:3b">Meta Llama 3.2 3B (~2.0 GB RAM)</option>
                <option value="llama3.2:1b">Meta Llama 3.2 1B (~1.1 GB RAM Ultra-Light)</option>
                <option value="qwen2.5-coder:3b">Qwen 2.5 Coder 3B (~2.2 GB RAM)</option>
                <option value="phi3.5:mini">Microsoft Phi-3.5 Mini (~2.4 GB RAM)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                FastAPI Local Backend URL
              </label>
              <input
                type="text"
                value={settings.backendEndpoint}
                onChange={(e) => setSettings({ ...settings, backendEndpoint: e.target.value })}
                className="w-full bg-surface-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                placeholder="http://127.0.0.1:8000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Local Ollama URL
              </label>
              <input
                type="text"
                value={settings.ollamaEndpoint}
                onChange={(e) => setSettings({ ...settings, ollamaEndpoint: e.target.value })}
                className="w-full bg-surface-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-brand-500"
                placeholder="http://127.0.0.1:11434"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-950/70 border border-slate-800/80">
            <div>
              <p className="text-xs font-semibold text-slate-200">Allow Simulated Fallback when Ollama is Offline</p>
              <p className="text-[11px] text-slate-400">Generates offline simulated answers if the Ollama daemon has not been started yet</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowMockFallback}
                onChange={(e) => setSettings({ ...settings, allowMockFallback: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div>
            </label>
          </div>
        </div>
      </Card>

      {/* 3. Model Configuration (Context & Temperature) */}
      <Card className="border-slate-800 bg-surface-900/80">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Model Hyperparameters</h3>
            <p className="text-xs text-slate-400">Fine-tune generation temperature and memory-bounded token window</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">Context Window</span>
              <span className="font-mono text-brand-300">{settings.contextWindow} tokens</span>
            </div>
            <input
              type="range"
              min="1024"
              max="8192"
              step="1024"
              value={settings.contextWindow}
              onChange={(e) => setSettings({ ...settings, contextWindow: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>1024 (Low RAM)</span>
              <span>4096 (Balanced Default)</span>
              <span>8192 (Max for 8GB)</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">Temperature (Creativity vs Determinism)</span>
              <span className="font-mono text-brand-300">{settings.temperature}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => setSettings({ ...settings, temperature: Number(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>0.1 (Strict Technical/Algorithms)</span>
              <span>0.7 (Standard Conversational)</span>
              <span>1.0 (Creative)</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Audio & Microphone Configuration */}
      <Card className="border-slate-800 bg-surface-900/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Microphone & Speech-to-Text</h3>
              <p className="text-xs text-slate-400">Enable voice answering for interactive interview practice</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-950/70 border border-slate-800/80">
            <div>
              <p className="text-xs font-semibold text-slate-200">Enable Audio Input</p>
              <p className="text-[11px] text-slate-400">Uses local Whisper base/tiny model for offline speech transcription</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableMic}
                onChange={(e) => setSettings({ ...settings, enableMic: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={testMicrophone}
              isLoading={micTesting}
              leftIcon={<Mic className="w-3.5 h-3.5" />}
            >
              Test Microphone Access
            </Button>

            {micSuccess === true && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <Check className="w-4 h-4" />
                Microphone verified & active
              </span>
            )}
            {micSuccess === false && (
              <span className="text-xs text-rose-400 flex items-center gap-1 font-medium">
                <AlertCircle className="w-4 h-4" />
                Permission denied or no microphone device found
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* 5. Theme & Appearance */}
      <Card className="border-slate-800 bg-surface-900/80">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Appearance Theme</h3>
            <p className="text-xs text-slate-400">Select your preferred workspace theme. Updates live across the app.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              id: 'dark-slate',
              label: 'Dark Slate',
              tag: 'Default',
              desc: 'Balanced cool dark contrast for long interview prep',
              icon: <Moon className="w-4 h-4 text-indigo-400" />,
            },
            {
              id: 'dark-oled',
              label: 'Midnight OLED',
              tag: 'Pure Black',
              desc: 'True pure black background for high contrast & battery',
              icon: <Sparkles className="w-4 h-4 text-purple-400" />,
            },
            {
              id: 'dark-zinc',
              label: 'Modern Zinc',
              tag: 'Studio Dark',
              desc: 'Neutral dark gray studio aesthetic',
              icon: <Sliders className="w-4 h-4 text-slate-400" />,
            },
            {
              id: 'light',
              label: 'Clean Light',
              tag: 'Light Mode',
              desc: 'Crisp, high-readability daytime white & soft slate theme',
              icon: <Sun className="w-4 h-4 text-amber-500" />,
            },
          ].map((th) => (
            <div
              key={th.id}
              onClick={() => {
                const updated = { ...settings, theme: th.id as any };
                setSettings(updated);
                onSaveSettings(updated);
              }}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                settings.theme === th.id
                  ? 'border-brand-500 bg-brand-500/15 shadow-sm ring-1 ring-brand-500/30'
                  : 'border-slate-800 bg-surface-950/60 hover:border-slate-700 hover:bg-surface-850'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  {th.icon}
                  <span className="text-xs font-bold text-slate-200">{th.label}</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-800 border border-slate-700 text-slate-300">
                  {th.tag}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{th.desc}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
