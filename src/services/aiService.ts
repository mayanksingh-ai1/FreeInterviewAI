import {
  BackendHealthResponse,
  ModelsApiResponse,
  ChatMessage,
  ExplanationStyle,
  AnswerStyle,
  QuestionProcessResponse,
  RecommendedModelInfo,
} from '../types';

export const CLOUD_BACKEND_URL = 'https://automobile-platforms-ultra-excluding.trycloudflare.com';
export const LOCAL_BACKEND_URL = 'http://127.0.0.1:8000';

// Use cloud backend when hosted on GitHub Pages or custom domain; fall back to local when running on localhost
export const BACKEND_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname.includes('github.io') || window.location.hostname.includes('trycloudflare.com'))
    ? CLOUD_BACKEND_URL
    : LOCAL_BACKEND_URL;

export interface ChatApiResult {
  content: string;
  modelUsed: string;
  explanationStyle: ExplanationStyle;
  latencyMs: number;
  isMock: boolean;
  warning?: string | null;
}

export const FALLBACK_RECOMMENDED_MODELS: RecommendedModelInfo[] = [
  {
    name: 'Meta Llama 3.2 3B (Recommended)',
    tag: 'llama3.2:3b',
    parameters: '3.2 Billion (Q4_K_M)',
    disk_size_gb: 2.0,
    ram_required_gb: 2.0,
    recommended_for_8gb_ram: true,
    description: 'Optimal balance of reasoning and CPU inference speed for 8 GB RAM laptops.',
    download_command: 'ollama run llama3.2:3b',
  },
  {
    name: 'Meta Llama 3.2 1B (Ultra-Lightweight)',
    tag: 'llama3.2:1b',
    parameters: '1.2 Billion (Q4_K_M)',
    disk_size_gb: 1.3,
    ram_required_gb: 1.1,
    recommended_for_8gb_ram: true,
    description: 'Ultra-fast CPU generation. Safe even with heavy applications open.',
    download_command: 'ollama run llama3.2:1b',
  },
  {
    name: 'Qwen 2.5 Coder 3B',
    tag: 'qwen2.5-coder:3b',
    parameters: '3.1 Billion (Q4_K_M)',
    disk_size_gb: 2.1,
    ram_required_gb: 2.2,
    recommended_for_8gb_ram: true,
    description: 'Alibaba specialized coding model for LeetCode algorithmic interviews.',
    download_command: 'ollama run qwen2.5-coder:3b',
  },
  {
    name: 'Microsoft Phi-3.5 Mini',
    tag: 'phi3.5:mini',
    parameters: '3.8 Billion (Q4_K_M)',
    disk_size_gb: 2.2,
    ram_required_gb: 2.4,
    recommended_for_8gb_ram: true,
    description: 'Strong architectural reasoning and logical step-by-step thinking.',
    download_command: 'ollama run phi3.5:mini',
  },
];

export class AIService {
  private baseUrl = BACKEND_URL;

  async checkHealth(): Promise<{ online: boolean; data?: BackendHealthResponse; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as BackendHealthResponse;
        return { online: true, data };
      }
      return { online: false, error: `Backend returned status ${res.status}` };
    } catch {
      // Fallback: try relative /health in case of Vite dev proxy or browser sandbox
      try {
        const altRes = await fetch('/health', { signal: AbortSignal.timeout(2000) });
        if (altRes.ok) {
          const data = (await altRes.json()) as BackendHealthResponse;
          return { online: true, data };
        }
      } catch {}

      return {
        online: false,
        error: 'FastAPI local backend is unreachable on port 8000',
      };
    }
  }

  async fetchModels(): Promise<ModelsApiResponse> {
    try {
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}/models`, {
          signal: AbortSignal.timeout(4000),
        });
      } catch {
        res = await fetch('/models', {
          signal: AbortSignal.timeout(4000),
        });
      }
      if (res.ok) {
        return (await res.json()) as ModelsApiResponse;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch {
      // Graceful fallback for UI when backend is starting or offline
      return {
        ollama_running: false,
        ollama_version: null,
        default_model: 'llama3.2:1b',
        downloaded_models: [],
        recommended_models: FALLBACK_RECOMMENDED_MODELS,
        hardware_note: 'Backend service offline. Showing cached 8GB-safe model specs.',
      };
    }
  }

  async sendChat(
    messages: ChatMessage[],
    options: {
      model?: string;
      temperature?: number;
      explanationStyle?: ExplanationStyle;
      allowMockFallback?: boolean;
      signal?: AbortSignal;
    }
  ): Promise<ChatApiResult> {
    const formattedMessages = messages
      .filter((m) => m.sender === 'user' || m.sender === 'assistant')
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

    const payload = {
      messages: formattedMessages,
      model: options.model || 'llama3.2:1b',
      temperature: options.temperature ?? 0.7,
      explanation_style: options.explanationStyle || 'detailed',
      allow_mock_fallback: options.allowMockFallback ?? true,
    };

    try {
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: options.signal,
        });
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        res = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: options.signal,
        });
      }

      if (!res.ok) {
        let errorDetail = `Backend returned status ${res.status}`;
        try {
          const errJson = await res.json();
          errorDetail = errJson.detail || errorDetail;
        } catch {}

        if (res.status === 503) {
          throw new Error(`[Ollama Offline] ${errorDetail}`);
        } else if (res.status === 404) {
          throw new Error(`[Model Missing] ${errorDetail}`);
        } else if (res.status === 504) {
          throw new Error(`[Timeout] Generation took too long on CPU. Try a smaller model.`);
        } else if (res.status === 507) {
          throw new Error(`[Out of Memory] ${errorDetail}`);
        }
        throw new Error(errorDetail);
      }

      const data = await res.json();
      return {
        content: data.message.content,
        modelUsed: data.model_used,
        explanationStyle: data.explanation_style,
        latencyMs: data.latency_ms,
        isMock: data.is_mock_fallback,
        warning: data.warning,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Generation cancelled by user.');
      }
      // If backend is completely offline and fallback was enabled, give clear helpful simulated message
      if (options.allowMockFallback !== false && (err.message.includes('Failed to fetch') || err.message.includes('unreachable'))) {
        return {
          content: `*(Backend Offline - Local Client Fallback)*\n\nThe Python FastAPI backend is currently not running on port 8000.\n\nTo start the local AI backend:\n\`\`\`powershell\ncd backend\n.\\venv\\Scripts\\python -m uvicorn app.main:app --port 8000\n\`\`\`\n\nOnce active, it will connect to your local Ollama instance running \`${options.model || 'llama3.2:1b'}\` with 0 cloud latency!`,
          modelUsed: `${options.model || 'llama3.2:1b'} (Offline Client Fallback)`,
          explanationStyle: options.explanationStyle || 'detailed',
          latencyMs: 120,
          isMock: true,
          warning: 'Backend service is offline. Please launch the Python backend.',
        };
      }
      throw err;
    }
  }

  async processQuestion(
    question: string,
    options: {
      style?: AnswerStyle;
      model?: string;
      allowMockFallback?: boolean;
      signal?: AbortSignal;
    } = {}
  ): Promise<QuestionProcessResponse> {
    const payload = {
      question: question.trim(),
      style: options.style || 'detailed',
      model: options.model || 'llama3.2:1b',
      allow_mock_fallback: options.allowMockFallback ?? true,
    };

    try {
      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}/api/v1/interview/process-question`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: options.signal,
        });
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        res = await fetch('/api/v1/interview/process-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: options.signal,
        });
      }

      if (!res.ok) {
        let errorDetail = `Backend returned status ${res.status}`;
        try {
          const errJson = await res.json();
          errorDetail = errJson.detail || errorDetail;
        } catch {}

        if (res.status === 503) {
          throw new Error(`[Ollama Offline] ${errorDetail}`);
        } else if (res.status === 404) {
          throw new Error(`[Model Missing] ${errorDetail}`);
        } else if (res.status === 504) {
          throw new Error(`[Timeout] Question generation timed out on CPU.`);
        }
        throw new Error(errorDetail);
      }

      const data = (await res.json()) as QuestionProcessResponse;
      return data;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Answer generation cancelled by user.');
      }
      // If backend is completely offline and fallback is enabled, produce offline client fallback
      if (options.allowMockFallback !== false && (err.message.includes('Failed to fetch') || err.message.includes('unreachable'))) {
        return {
          question: question,
          style: options.style || 'detailed',
          model_used: `${options.model || 'llama3.2:1b'} (Offline Client Fallback)`,
          structured_answer: {
            direct_answer: `To answer "${question.slice(0, 70)}...", define your boundary conditions, choose an optimal algorithm or data structure, and quantify performance trade-offs.`,
            simple_explanation: `1. Clarify functional requirements and scale constraints.\n2. State two alternative approaches and justify your choice (e.g. latency vs consistency).\n3. Detail failure modes, data partitioning, and concurrency controls.`,
            example: `// Example architecture pattern\nfunction executeInterviewStrategy() {\n  // In-memory cache tier -> transactional persistence\n  return { status: "success", latencySla: "<15ms" };\n}`,
            important_keywords: ["Time Complexity", "Scalability", "Idempotency", "Concurrency", "Trade-offs"],
          },
          raw_markdown: `Direct answer, explanation, and example for: ${question}`,
          latency_ms: 150,
          is_mock_fallback: true,
          warning: 'FastAPI local backend is offline. Showing offline client fallback.',
        };
      }
      throw err;
    }
  }
}

export const aiService = new AIService();
