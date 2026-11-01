import {
  TranscriptSegment,
  DetectedQuestion,
  QuestionDetectionConfig,
  QuestionDetectionResponse,
  SyntheticScenariosResponse,
} from '../types';
import { BACKEND_URL } from './aiService';

export class DetectionService {
  private baseUrl = BACKEND_URL;

  async detectQuestions(
    chunks: TranscriptSegment[],
    config?: QuestionDetectionConfig,
    existing?: DetectedQuestion[]
  ): Promise<QuestionDetectionResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/detection/detect-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunks,
          config,
          existing_detected_questions: existing || [],
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        return (await res.json()) as QuestionDetectionResponse;
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    } catch (err) {
      console.warn('Backend question detection endpoint unavailable, utilizing local regex evaluator:', err);
      // Fallback local lightweight evaluator
      return this.localEvaluateFallback(chunks, config, existing);
    }
  }

  async getSyntheticScenarios(): Promise<SyntheticScenariosResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/detection/synthetic-scenarios`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        return (await res.json()) as SyntheticScenariosResponse;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch {
      // Local fallback synthetic test bank
      return {
        scenarios: [
          {
            id: 'scenario-multi-chunk',
            title: 'Multi-Chunk System Design Question',
            description: 'Demonstrates combining 3 fragmented speech chunks into a single complete technical question without early truncation.',
            chunks: [
              { id: 'mc-1', timestamp: '00:02', text: 'Can you walk me through...', is_final: true },
              { id: 'mc-2', timestamp: '00:05', text: 'how you would design a distributed caching layer...', is_final: true },
              { id: 'mc-3', timestamp: '00:08', text: 'with LRU eviction and replication?', is_final: true },
            ],
            expected_category: 'technical',
          },
          {
            id: 'scenario-noise-filtering',
            title: 'Casual Speech & Noise Filter',
            description: 'Filters out "Can you hear me?", "Yeah ok", and filler words, extracting only the actual coding question.',
            chunks: [
              { id: 'nf-1', timestamp: '00:01', text: 'Hey can you hear me alright?', is_final: true },
              { id: 'nf-2', timestamp: '00:03', text: 'Yeah okay great, thanks.', is_final: true },
              { id: 'nf-3', timestamp: '00:06', text: 'So basically um...', is_final: true },
              { id: 'nf-4', timestamp: '00:09', text: 'What is the time complexity of QuickSort in the worst case?', is_final: true },
            ],
            expected_category: 'coding',
          },
          {
            id: 'scenario-deduplication',
            title: 'Repetition & Deduplication',
            description: 'Filters repeated interviewer restatements so the LLM is not prompted twice for the same question.',
            chunks: [
              { id: 'dd-1', timestamp: '00:02', text: 'Tell me about a time you handled a critical production outage?', is_final: true },
              { id: 'dd-2', timestamp: '00:07', text: 'I mean, tell me about a time you handled a critical production outage?', is_final: true },
            ],
            expected_category: 'behavioral',
          },
          {
            id: 'scenario-hr-behavioral',
            title: 'Behavioral & HR Questions',
            description: 'Identifies behavioral leadership conflict questions and culture fit inquiry.',
            chunks: [
              { id: 'hr-1', timestamp: '00:03', text: 'Describe a situation where you had a disagreement with your engineering manager.', is_final: true },
              { id: 'hr-2', timestamp: '00:09', text: 'Why do you want to work for our team specifically?', is_final: true },
            ],
            expected_category: 'behavioral / hr',
          },
        ],
      };
    }
  }

  private localEvaluateFallback(
    chunks: TranscriptSegment[],
    _config?: QuestionDetectionConfig,
    _existing?: DetectedQuestion[]
  ): QuestionDetectionResponse {
    const raw = chunks.map((c) => c.text).join(' ');
    const detected: DetectedQuestion[] = [];

    // Simple heuristic fallback when python backend is booting
    const questions = raw.split(/(?<=[?.])/).filter((s) => s.trim().length > 15);
    for (const q of questions) {
      const clean = q.trim();
      const lower = clean.toLowerCase();
      if (
        lower.includes('how') ||
        lower.includes('what') ||
        lower.includes('tell me') ||
        lower.includes('describe') ||
        clean.endsWith('?')
      ) {
        let cat: 'technical' | 'coding' | 'behavioral' | 'hr' | 'general' = 'general';
        if (lower.includes('design') || lower.includes('architecture') || lower.includes('cache')) {
          cat = 'technical';
        } else if (lower.includes('complexity') || lower.includes('quicksort') || lower.includes('function')) {
          cat = 'coding';
        } else if (lower.includes('tell me about a time') || lower.includes('disagreement')) {
          cat = 'behavioral';
        } else if (lower.includes('why do you want to work')) {
          cat = 'hr';
        }

        detected.push({
          id: `dq-fallback-${Date.now()}`,
          text: clean.endsWith('?') ? clean : `${clean}?`,
          category: cat,
          confidence: 0.82,
          timestamp: chunks[0]?.timestamp || '00:00',
          source_chunks: chunks.map((c) => c.id),
          status: 'pending_review',
        });
      }
    }

    return {
      detected_questions: detected,
      raw_processed_text: raw,
      ignored_phrases_count: Math.max(0, chunks.length - detected.length),
      duplicates_filtered_count: 0,
    };
  }
}

export const detectionService = new DetectionService();
