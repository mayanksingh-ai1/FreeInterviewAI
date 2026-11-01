import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Square,
  RotateCcw,
  Bot,
  User,
  Sparkles,
  Info,
  Check,
  Copy,
  Terminal,
  Cpu,
  Zap,
  BookOpen,
  Smile,
  AlertCircle,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { ChatMessage, ExplanationStyle, RecommendedModelInfo, ModelsApiResponse } from '../types';
import { aiService } from '../services/aiService';

export const AIChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'system-init',
      sender: 'system',
      content: 'FreeInterviewAI Local Engine online. All inference runs strictly on your machine — zero cloud telemetry.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
    {
      id: 'welcome-assistant',
      sender: 'assistant',
      content: 'Welcome! I am your local AI interview copilot. Select an explanation style above, pick a model optimized for your 8 GB RAM laptop, and ask any system design, algorithmic, or behavioral interview question.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'llama3.2:1b',
      explanationStyle: 'detailed',
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<ExplanationStyle>('detailed');
  const [selectedModel, setSelectedModel] = useState<string>('llama3.2:1b');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
  const [modelsData, setModelsData] = useState<ModelsApiResponse | null>(null);
  const [isModelsModalOpen, setIsModelsModalOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Check backend & Ollama status periodically
  const checkStatus = async () => {
    const health = await aiService.checkHealth();
    setBackendOnline(health.online);
    if (health.online && health.data) {
      setOllamaRunning(health.data.ollama_connected);
    } else {
      setOllamaRunning(false);
    }
    const modelsRes = await aiService.fetchModels();
    setModelsData(modelsRes);
    if (modelsRes && modelsRes.downloaded_models && modelsRes.downloaded_models.length > 0) {
      if (!modelsRes.downloaded_models.includes(selectedModel)) {
        setSelectedModel(modelsRes.downloaded_models[0]);
      }
    }
  };

  useEffect(() => {
    checkStatus();
    const timer = setInterval(checkStatus, 3000);
    return () => clearInterval(timer);
  }, [selectedModel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    setErrorMessage(null);
    const userText = input.trim();
    setInput('');

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const result = await aiService.sendChat(updatedHistory, {
        model: selectedModel,
        explanationStyle: selectedStyle,
        allowMockFallback: true,
        signal: abortControllerRef.current.signal,
      });

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        content: result.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: result.modelUsed,
        explanationStyle: result.explanationStyle,
        latencyMs: result.latencyMs,
        isMock: result.isMock,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('cancelled')) {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            sender: 'system',
            content: 'Response generation was cancelled by user.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        setErrorMessage(err.message || 'Failed to generate response. Please check local services.');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleReset = () => {
    handleStop();
    setErrorMessage(null);
    setMessages([
      {
        id: `sys-${Date.now()}`,
        sender: 'system',
        content: 'Conversation history cleared. Ready for new interview practice questions.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const PROMPT_SUGGESTIONS = [
    'Explain CAP Theorem and trade-offs in distributed caches',
    'How does Two Sum work with O(n) space and time?',
    'STAR answer for handling cross-functional technical conflicts',
    'Virtual DOM reconciliation vs Svelte compile-time reactivity',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-3 animate-fade-in">
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-white">AI Interview Copilot</h2>
            {/* Backend Connection Status */}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                backendOnline
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              Backend: {backendOnline ? 'FastAPI Port 8000' : 'Offline'}
            </span>

            {/* Ollama Runtime Status */}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                ollamaRunning
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
              }`}
            >
              <Cpu className="w-3 h-3" />
              Ollama: {ollamaRunning ? 'Running' : 'Offline (Simulated Fallback)'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Local-first LLM inference. Tuned for Intel Core i5-1135G7 and 8 GB RAM laptop boundaries.
          </p>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Model Selector */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isLoading}
            className="bg-surface-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="llama3.2:3b">Meta Llama 3.2 3B (~2.0 GB RAM)</option>
            <option value="llama3.2:1b">Meta Llama 3.2 1B (~1.1 GB RAM Ultra-Light)</option>
            <option value="qwen2.5-coder:3b">Qwen 2.5 Coder 3B (~2.2 GB RAM)</option>
            <option value="phi3.5:mini">Microsoft Phi-3.5 Mini (~2.4 GB RAM)</option>
          </select>

          {/* Model Info Guide */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsModelsModalOpen(true)}
            leftIcon={<Info className="w-3.5 h-3.5 text-brand-400" />}
          >
            Model Specs
          </Button>

          {/* Reset Conversation */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isLoading && !abortControllerRef.current}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Explanation Style Selector Bar (Requirement 7) */}
      <div className="flex items-center justify-between bg-surface-900/70 p-2 rounded-xl border border-slate-800/80 gap-2 flex-wrap">
        <span className="text-xs text-slate-400 font-medium px-2">Explanation Depth:</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelectedStyle('short')}
            className={`text-xs px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
              selectedStyle === 'short'
                ? 'bg-brand-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Short (Quick Bullets)</span>
          </button>
          <button
            onClick={() => setSelectedStyle('detailed')}
            className={`text-xs px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
              selectedStyle === 'detailed'
                ? 'bg-brand-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-300" />
            <span>Detailed (Staff Architecture)</span>
          </button>
          <button
            onClick={() => setSelectedStyle('beginner-friendly')}
            className={`text-xs px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
              selectedStyle === 'beginner-friendly'
                ? 'bg-brand-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-800'
            }`}
          >
            <Smile className="w-3.5 h-3.5 text-emerald-300" />
            <span>Beginner-Friendly (Analogies)</span>
          </button>
        </div>
        <span className="text-[11px] text-slate-400 font-mono hidden md:inline px-2">
          Max {selectedStyle === 'short' ? '150 words' : '1024 tokens'}
        </span>
      </div>

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs text-rose-200 flex items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-300">Inference Notice:</p>
              <p className="text-rose-200/90 mt-0.5">{errorMessage}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setErrorMessage(null)} className="text-rose-300">
            Dismiss
          </Button>
        </div>
      )}

      {/* Message Stream */}
      <Card className="flex-1 overflow-y-auto p-4 space-y-4 border-slate-800 bg-surface-900/60 flex flex-col">
        <div className="flex-1 space-y-4">
          {messages.map((msg, idx) => {
            const isUser = msg.sender === 'user';
            const isSystem = msg.sender === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center py-1">
                  <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-surface-950 border border-slate-800 text-slate-400">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white ${
                    isUser ? 'bg-brand-600' : 'bg-surface-800 border border-slate-700 text-brand-300'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`rounded-xl p-4 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-950 border border-slate-800 text-slate-200'
                  }`}
                >
                  {/* Assistant Message Header with Badges */}
                  {!isUser && (
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-semibold text-brand-300">
                          {msg.modelUsed || selectedModel}
                        </span>
                        {msg.isMock && (
                          <Badge variant="mock" size="sm">Simulated Local AI</Badge>
                        )}
                        {msg.explanationStyle && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-800 text-slate-400 border border-slate-700 font-mono">
                            {msg.explanationStyle}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {msg.latencyMs && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {msg.latencyMs}ms
                          </span>
                        )}
                        <button
                          onClick={() => copyToClipboard(msg.content, idx)}
                          className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-surface-800 transition"
                          title="Copy Answer"
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                  <span
                    className={`block text-[10px] mt-2 font-mono ${
                      isUser ? 'text-brand-200 text-right' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-3 max-w-md animate-fade-in">
              <div className="w-8 h-8 rounded-lg bg-surface-800 border border-slate-700 flex items-center justify-center text-brand-300 shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="rounded-xl p-3.5 bg-surface-950 border border-slate-800 text-slate-300 text-xs flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-brand-300">Generating local response on CPU...</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce delay-200"></span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Bounded context window to safeguard Intel i5 laptop responsiveness.
                </p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestions */}
        <div className="pt-2 border-t border-slate-800/60">
          <div className="text-[11px] text-slate-400 mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Interview Question Prompts:
          </div>
          <div className="flex flex-wrap gap-2">
            {PROMPT_SUGGESTIONS.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setInput(item)}
                disabled={isLoading}
                className="text-xs px-2.5 py-1 rounded-md bg-surface-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Input & Control Box */}
      <div className="flex gap-2 items-end">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isLoading}
          placeholder="Ask an interview question or concept (Shift+Enter for new line)..."
          className="flex-1 bg-surface-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-none disabled:opacity-60"
        />

        {isLoading ? (
          <Button
            variant="danger"
            onClick={handleStop}
            className="px-5 shrink-0 self-stretch"
            leftIcon={<Square className="w-4 h-4 fill-current" />}
          >
            Stop
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-5 shrink-0 self-stretch"
            rightIcon={<Send className="w-4 h-4" />}
          >
            Send
          </Button>
        )}
      </div>

      {/* Models & Requirements Modal (Requirement 4) */}
      <Modal
        isOpen={isModelsModalOpen}
        onClose={() => setIsModelsModalOpen(false)}
        title="Recommended Local Models & Hardware Limits"
        maxWidth="xl"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setIsModelsModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 space-y-1">
            <p className="font-semibold flex items-center gap-1.5 text-amber-300">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Important: 8 GB Laptop RAM Bounds (Do Not Auto-Download Large Models)
            </p>
            <p className="text-[11px] leading-relaxed text-slate-300">
              Your Intel Core i5 laptop has 8 GB total RAM. Running models larger than 4B parameters (such as 7B or 14B)
              requires 5+ GB RAM, which triggers Windows disk paging and severely degrades system responsiveness.
              Stick to the tested quantized models below:
            </p>
          </div>

          <div className="space-y-3">
            {(modelsData?.recommended_models || []).map((model: RecommendedModelInfo) => (
              <div
                key={model.tag}
                className="p-3.5 rounded-xl bg-surface-950 border border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200 text-sm">{model.name}</span>
                    <Badge variant="success" size="sm">8 GB Safe</Badge>
                  </div>
                  <span className="text-[11px] font-mono text-brand-300">
                    RAM: ~{model.ram_required_gb} GB | Disk: ~{model.disk_size_gb} GB
                  </span>
                </div>
                <p className="text-slate-400 text-xs">{model.description}</p>
                <div className="flex items-center justify-between p-2 rounded bg-surface-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                  <span className="flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5 text-brand-400" />
                    {model.download_command}
                  </span>
                  <button
                    onClick={() => copyToClipboard(model.download_command, 999)}
                    className="text-slate-400 hover:text-white transition px-2 py-0.5 rounded hover:bg-surface-800"
                  >
                    {copiedIndex === 999 ? 'Copied!' : 'Copy Command'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
