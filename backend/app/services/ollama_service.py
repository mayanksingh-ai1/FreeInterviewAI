import time
import httpx
from typing import List, Dict, Any, Tuple
from fastapi import HTTPException
from app.config import settings
from app.schemas import (
    ChatMessage,
    ChatRequest,
    RecommendedModelInfo,
    ExplanationStyle,
    AnswerStyle,
    QuestionProcessRequest,
    StructuredAnswer
)
import re

RECOMMENDED_8GB_MODELS: List[RecommendedModelInfo] = [
    RecommendedModelInfo(
        name="Meta Llama 3.2 3B (Recommended)",
        tag="llama3.2:3b",
        parameters="3.2 Billion (Q4_K_M)",
        disk_size_gb=2.0,
        ram_required_gb=2.0,
        recommended_for_8gb_ram=True,
        description="Best overall balance of reasoning, memory footprint, and CPU speed for 8 GB RAM laptops.",
        download_command="ollama run llama3.2:3b"
    ),
    RecommendedModelInfo(
        name="Meta Llama 3.2 1B (Ultra-Lightweight)",
        tag="llama3.2:1b",
        parameters="1.2 Billion (Q4_K_M)",
        disk_size_gb=1.3,
        ram_required_gb=1.1,
        recommended_for_8gb_ram=True,
        description="Fastest CPU token generation. Ideal if multiple desktop IDEs are open concurrently.",
        download_command="ollama run llama3.2:1b"
    ),
    RecommendedModelInfo(
        name="Qwen 2.5 Coder 3B",
        tag="qwen2.5-coder:3b",
        parameters="3.1 Billion (Q4_K_M)",
        disk_size_gb=2.1,
        ram_required_gb=2.2,
        recommended_for_8gb_ram=True,
        description="Highly capable coding and algorithm explanation model with strict syntax awareness.",
        download_command="ollama run qwen2.5-coder:3b"
    ),
    RecommendedModelInfo(
        name="Microsoft Phi-3.5 Mini",
        tag="phi3.5:mini",
        parameters="3.8 Billion (Q4_K_M)",
        disk_size_gb=2.2,
        ram_required_gb=2.4,
        recommended_for_8gb_ram=True,
        description="Strong analytical and system design reasoning capabilities within a compact size.",
        download_command="ollama run phi3.5:mini"
    ),
]

class OllamaService:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.timeout = float(settings.REQUEST_TIMEOUT_SECONDS)

    async def check_health(self) -> Tuple[bool, str]:
        """Check if Ollama local daemon is reachable."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    return True, "Ollama running and reachable"
                return False, f"Ollama returned HTTP status {res.status_code}"
        except httpx.ConnectError:
            return False, "Ollama not running or connection refused (http://127.0.0.1:11434)"
        except httpx.TimeoutException:
            return False, "Ollama connection timed out"
        except Exception as e:
            return False, f"Ollama error: {str(e)}"

    async def list_downloaded_models(self) -> Tuple[bool, List[str], str]:
        """Query local Ollama instance for installed models."""
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name") for m in data.get("models", []) if m.get("name")]
                    return True, models, ""
                return False, [], f"Ollama returned HTTP {res.status_code}"
        except httpx.ConnectError:
            return False, [], "Ollama daemon not reachable at http://127.0.0.1:11434"
        except Exception as e:
            return False, [], str(e)

    def _get_system_prompt_for_style(self, style: ExplanationStyle) -> str:
        if style == "short":
            return (
                "You are FreeInterviewAI, an expert technical interview coach. "
                "Provide a concise, direct interview answer using clear bullet points. "
                "Keep response strictly under 150 words. Focus exclusively on key tradeoffs and core facts."
            )
        elif style == "beginner-friendly":
            return (
                "You are FreeInterviewAI, a supportive and encouraging technical mentor. "
                "Explain this concept using simple everyday analogies, step-by-step reasoning, "
                "and plain language without unexplained jargon. Keep the tone friendly and easy to follow."
            )
        else:  # detailed (default)
            return (
                "You are FreeInterviewAI, a staff-level technical interview coach. "
                "Provide a thorough, structured explanation. Detail architectural patterns, time and space "
                "complexities, tradeoffs, failure edge cases, and code snippets where relevant."
            )

    async def generate_chat(self, req: ChatRequest) -> Dict[str, Any]:
        """Execute chat completion via Ollama or safe fallback."""
        start_time = time.time()
        model_name = req.model or settings.DEFAULT_MODEL
        system_instruction = self._get_system_prompt_for_style(req.explanation_style)

        # 1. Check if Ollama is running
        ollama_ok, err_msg = await self.check_health()
        if not ollama_ok:
            if req.allow_mock_fallback and settings.ALLOW_MOCK_FALLBACK:
                return self._generate_simulated_response(req, start_time, warning="Ollama is not running. Showing simulated response.")
            raise HTTPException(
                status_code=503,
                detail=f"Ollama local engine is not running at {self.base_url}. Error: {err_msg}. "
                       f"Please install or start Ollama, or enable simulated fallback."
            )

        # 2. Check if model is downloaded in Ollama
        _, downloaded_models, _ = await self.list_downloaded_models()
        model_installed = any(
            m == model_name or m.startswith(f"{model_name}:") or model_name.startswith(f"{m}:")
            for m in downloaded_models
        )
        if not model_installed:
            if req.allow_mock_fallback and settings.ALLOW_MOCK_FALLBACK:
                return self._generate_simulated_response(
                    req,
                    start_time,
                    warning=f"Model '{model_name}' is not yet downloaded in Ollama. Run 'ollama run {model_name}' in PowerShell to install."
                )
            raise HTTPException(
                status_code=404,
                detail=f"Model '{model_name}' is not installed in Ollama. "
                       f"Downloaded models: {downloaded_models}. Run 'ollama run {model_name}' to download."
            )

        # 3. Format message history for Ollama API
        formatted_messages = [{"role": "system", "content": system_instruction}]
        for m in req.messages:
            formatted_messages.append({"role": m.role, "content": m.content})

        # 4. Invoke Ollama /api/chat with timeout and token bounds
        payload = {
            "model": model_name,
            "messages": formatted_messages,
            "stream": False,
            "options": {
                "temperature": req.temperature,
                "num_predict": settings.MAX_TOKENS_LIMIT,
                "num_thread": settings.NUM_THREAD_LIMIT,
            }
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(f"{self.base_url}/api/chat", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    assistant_msg = data.get("message", {}).get("content", "")
                    latency_ms = int((time.time() - start_time) * 1000)
                    return {
                        "content": assistant_msg,
                        "model_used": model_name,
                        "explanation_style": req.explanation_style,
                        "latency_ms": latency_ms,
                        "is_mock_fallback": False,
                        "warning": None,
                    }
                elif res.status_code == 500 and "out of memory" in res.text.lower():
                    raise HTTPException(
                        status_code=507,
                        detail="Local model ran out of memory (OOM). On an 8 GB RAM laptop, switch to 'llama3.2:1b' or 'llama3.2:3b' and reduce context length."
                    )
                else:
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=f"Ollama returned error: {res.text}"
                    )
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail=f"Generation timed out after {self.timeout}s on CPU. Consider using a smaller model ('llama3.2:1b') or shortening the prompt."
            )
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail=f"Connection lost to Ollama daemon at {self.base_url}"
            )

    def _generate_simulated_response(self, req: ChatRequest, start_time: float, warning: str) -> Dict[str, Any]:
        """Provides realistic mock responses when Ollama daemon is offline."""
        last_user_message = next((m.content for m in reversed(req.messages) if m.role == "user"), "General Interview Question")
        model_name = req.model or settings.DEFAULT_MODEL
        style = req.explanation_style

        if style == "short":
            content = (
                f"**Key Points ({model_name} - Simulated Short Answer):**\n\n"
                f"• **Core Strategy:** Address '{last_user_message[:60]}...' by stating functional bounds and constraints first.\n"
                f"• **Trade-off:** Balance memory footprint (O(n)) vs lookup latency (O(1)).\n"
                f"• **Staff Tip:** Mention failure domain isolation and idempotency keys to demonstrate production maturity."
            )
        elif style == "beginner-friendly":
            content = (
                f"**Think of it like this ({model_name} - Beginner-Friendly):**\n\n"
                f"Imagine you are running a busy coffee shop. When answering '{last_user_message[:60]}...', you wouldn't make customers wait in a chaotic crowd without order tickets.\n\n"
                f"1. **The Order Slip (Queue):** Requests enter a line one by one so nothing gets lost.\n"
                f"2. **The Barista (Worker Pool):** Only a few drinks are made at once so the counter doesn't overflow.\n"
                f"3. **The Backup Milk (Redundancy):** If one machine breaks, you switch to the spare machine without panicking.\n\n"
                f"In software, that's what we call queues, thread pooling, and high availability!"
            )
        else:  # detailed
            content = (
                f"### Technical Interview Analysis ({model_name} - Detailed)\n\n"
                f"Regarding: *\"{last_user_message}\"*\n\n"
                f"#### 1. Architectural Foundation & Requirements\n"
                f"- **Primary Goal:** High throughput with bounded P99 latency (<15ms).\n"
                f"- **Concurrency Control:** Implement optimistic locking or distributed locks with Redis/Redlock to prevent race conditions.\n\n"
                f"#### 2. Key Trade-offs\n"
                f"- **Consistency vs Availability (CAP):** In network partitioning, prioritize availability (AP) with eventual consistency unless handling financial ledgers (CP).\n"
                f"- **Memory vs Storage:** Keep hot indices in RAM (e.g. B-Trees / Hash Maps) and append logs sequentially to disk (LSM Tree pattern).\n\n"
                f"#### 3. Recommended Code / Structure Pattern\n"
                f"```typescript\n"
                f"// Idempotency token guard pattern\n"
                f"async function processRequest(req: Request, idempotencyKey: string) {{\n"
                f"  const cached = await cache.get(idempotencyKey);\n"
                f"  if (cached) return cached;\n"
                f"  const result = await executeBusinessLogic(req);\n"
                f"  await cache.set(idempotencyKey, result, {{ ttl: 3600 }});\n"
                f"  return result;\n"
                f"}}\n"
                f"```\n\n"
                f"#### 4. Common Edge Cases to Mention\n"
                f"- Cascading failures / Thundering Herd when cache expires.\n"
                f"- Dead-letter queues for unprocessable messages."
            )

        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "content": content,
            "model_used": f"{model_name} (Simulated)",
            "explanation_style": style,
            "latency_ms": max(latency_ms, 350),
            "is_mock_fallback": True,
            "warning": warning,
        }

    def _get_question_prompt_for_style(self, style: AnswerStyle) -> str:
        base_instruction = (
            "You are FreeInterviewAI, an expert technical interview coach. "
            "You must respond with EXACTLY four clearly labeled markdown sections:\n"
            "### 1. Direct Answer\n"
            "(Your direct answer here)\n\n"
            "### 2. Simple Explanation\n"
            "(Your conceptual breakdown here)\n\n"
            "### 3. Example\n"
            "(Your code or real-world practical example here)\n\n"
            "### 4. Important Keywords\n"
            "(Comma-separated list of 4 to 8 critical technical keywords here)\n\n"
        )

        if style == "concise":
            return base_instruction + (
                "Style Guideline [CONCISE]: High information density. Keep the Direct Answer under 2 sentences. "
                "Use bullet points for the explanation and omit all conversational filler."
            )
        elif style == "beginner-friendly":
            return base_instruction + (
                "Style Guideline [BEGINNER-FRIENDLY]: Explain using simple everyday real-world analogies (e.g. library, traffic, postal mail). "
                "Avoid unexplained acronyms or jargon. Keep the tone encouraging and welcoming."
            )
        elif style == "interview-ready-english":
            return base_instruction + (
                "Style Guideline [INTERVIEW-READY ENGLISH]: Phrase the Direct Answer and Explanation in fluent, professional executive English. "
                "Use strong action verbs, articulate STAR structure, and polish the phrasing so the candidate can deliver it verbally with high confidence."
            )
        else:  # detailed (default)
            return base_instruction + (
                "Style Guideline [DETAILED]: Provide thorough engineering depth, time/space complexities, architectural tradeoffs, "
                "and production edge cases (e.g. concurrency, failure recovery)."
            )

    def _parse_structured_sections(self, raw_text: str) -> StructuredAnswer:
        """Robustly parses the four sections from markdown response."""
        direct = ""
        explanation = ""
        example = ""
        keywords: List[str] = []

        # Regex patterns to isolate sections
        p_direct = re.search(r'###\s*1\.?\s*Direct Answer\s*([\s\S]*?)(?=###\s*2\.|\Z)', raw_text, re.IGNORECASE)
        p_expl = re.search(r'###\s*2\.?\s*Simple Explanation\s*([\s\S]*?)(?=###\s*3\.|\Z)', raw_text, re.IGNORECASE)
        p_exam = re.search(r'###\s*3\.?\s*Example\s*([\s\S]*?)(?=###\s*4\.|\Z)', raw_text, re.IGNORECASE)
        p_keys = re.search(r'###\s*4\.?\s*Important Keywords\s*([\s\S]*?)(?=\Z)', raw_text, re.IGNORECASE)

        if p_direct:
            direct = p_direct.group(1).strip()
        if p_expl:
            explanation = p_expl.group(1).strip()
        if p_exam:
            example = p_exam.group(1).strip()
        if p_keys:
            raw_k = p_keys.group(1).strip()
            # Clean bullet points, commas, dashes
            cleaned = re.split(r'[,;\n•\-\*]+', raw_k)
            keywords = [k.strip() for k in cleaned if k.strip() and len(k.strip()) < 40][:8]

        # Fallback if sections were not cleanly formatted by local model
        if not direct and raw_text:
            direct = raw_text[:250].strip()
        if not explanation:
            explanation = "Conceptual understanding of the trade-offs, constraints, and architecture."
        if not example:
            example = "// Code example or architectural application pattern"
        if not keywords:
            keywords = ["Time Complexity", "Space Complexity", "Scalability", "Trade-offs"]

        return StructuredAnswer(
            direct_answer=direct,
            simple_explanation=explanation,
            example=example,
            important_keywords=keywords
        )

    async def process_question(self, req: QuestionProcessRequest) -> Dict[str, Any]:
        """Processes an interview question and returns structured direct answer, explanation, example & keywords."""
        start_time = time.time()
        model_name = req.model or settings.DEFAULT_MODEL
        system_prompt = self._get_question_prompt_for_style(req.style)

        # 1. Check Ollama daemon health
        ollama_ok, err_msg = await self.check_health()
        if not ollama_ok:
            if req.allow_mock_fallback and settings.ALLOW_MOCK_FALLBACK:
                return self._generate_structured_mock_answer(req, start_time, warning="Ollama is not running. Showing simulated structured answer.")
            raise HTTPException(
                status_code=503,
                detail=f"Ollama local engine is not running. Error: {err_msg}. Please start Ollama or enable mock fallback."
            )

        # 2. Check if model is downloaded in Ollama
        _, downloaded_models, _ = await self.list_downloaded_models()
        model_installed = any(
            m == model_name or m.startswith(f"{model_name}:") or model_name.startswith(f"{m}:")
            for m in downloaded_models
        )
        if not model_installed:
            if req.allow_mock_fallback and settings.ALLOW_MOCK_FALLBACK:
                return self._generate_structured_mock_answer(
                    req,
                    start_time,
                    warning=f"Model '{model_name}' not installed in Ollama. Showing simulated response."
                )
            raise HTTPException(
                status_code=404,
                detail=f"Model '{model_name}' is not installed in Ollama. Run 'ollama run {model_name}' to download."
            )

        # 3. Call Ollama
        user_prompt = f"Please provide an interview-grade answer for this question:\n\n\"{req.question}\""
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False,
            "options": {
                "temperature": 0.5,
                "num_predict": settings.MAX_TOKENS_LIMIT,
                "num_thread": settings.NUM_THREAD_LIMIT,
            }
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(f"{self.base_url}/api/chat", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    raw_content = data.get("message", {}).get("content", "")
                    structured = self._parse_structured_sections(raw_content)
                    latency_ms = int((time.time() - start_time) * 1000)
                    return {
                        "question": req.question,
                        "style": req.style,
                        "model_used": model_name,
                        "structured_answer": structured,
                        "raw_markdown": raw_content,
                        "latency_ms": latency_ms,
                        "is_mock_fallback": False,
                        "warning": None,
                    }
                else:
                    raise HTTPException(
                        status_code=res.status_code,
                        detail=f"Ollama returned error: {res.text}"
                    )
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail=f"Generation timed out after {self.timeout}s on CPU. Consider using a smaller model ('llama3.2:1b')."
            )

    def _generate_structured_mock_answer(self, req: QuestionProcessRequest, start_time: float, warning: str) -> Dict[str, Any]:
        """Provides simulated structured answers for interview question processing."""
        q = req.question.strip()
        model_name = req.model or settings.DEFAULT_MODEL
        style = req.style

        if style == "concise":
            direct = f"In short, {q.rstrip('?')} is solved by identifying the core bottleneck, choosing the right data structure (O(1) lookups via Hash Tables or Doubly-Linked Lists), and isolating failure domains."
            expl = "• **Core Mechanism:** Decouple ingress traffic from state mutation using in-memory queues.\n• **Trade-off:** Minimal memory overhead in exchange for sub-millisecond lookup latency.\n• **Key Rule:** Never perform synchronous remote calls inside an un-indexed hot path."
            example = "```typescript\n// Concise implementation pattern\nconst cache = new Map<string, CacheEntry>();\nfunction getFast(key: string): CacheEntry | null {\n  return cache.get(key) ?? null;\n}\n```"
            keywords = ["O(1) Lookup", "Decoupling", "Hash Map", "In-Memory State", "Latency Bounding"]

        elif style == "beginner-friendly":
            direct = f"Imagine you are running a busy pizza restaurant kitchen. When handling '{q.rstrip('?')}', you need an organized system so orders don't get lost or burned."
            expl = "1. **The Order Ticket:** Every incoming request gets an order number right away so the customer knows it is in line.\n2. **The Prep Table (Buffer):** Ingredients are pre-chopped in advance so the chef doesn't have to run to the pantry on every order.\n3. **The Backup Oven:** If one oven stops heating, you instantly slide pizzas to the second oven without stopping service."
            example = "// Plain English real-world analogy:\n// Client -> Cashier (API Gateway) -> Kitchen Queue (Kafka/RabbitMQ) -> Ovens (Worker Nodes)"
            keywords = ["Queue Buffer", "Redundancy", "Workload Distribution", "Graceful Degradation"]

        elif style == "interview-ready-english":
            direct = f"\"When approaching {q.rstrip('?')}, I prioritize three operational criteria: predictability under peak load, clear fault-isolation boundaries, and observable latency budgets.\""
            expl = "\"In my past engineering leadership experience, the most resilient strategy is implementing an asynchronous pipeline with strict idempotency keys. This guarantees that duplicate requests caused by network retries never corrupt state, while preserving a P99 latency SLA under 25 milliseconds.\""
            example = "```typescript\n// Interview-Ready STAR Production Snippet\nasync function handleInterviewOperation(request: ServicePayload) {\n  const guard = await distributedLock.acquire(request.idempotencyToken);\n  try {\n    return await transactionalDatabase.atomicCommit(request.data);\n  } finally {\n    await guard.release();\n  }\n}\n```"
            keywords = ["Idempotency Guard", "SLA / SLO", "Distributed Lock", "P99 Latency", "Fault Domain Isolation"]

        else:  # detailed (default)
            direct = f"To address \"{q.rstrip('?')}\", the optimal system design combines an in-memory caching tier with consistent hashing, partition rebalancing, and write-ahead logging (WAL) for durability."
            expl = "#### Architectural Foundations\n1. **Data Ingress & Sharding:** Employ consistent hashing with virtual nodes (e.g. MurmurHash3) to distribute load evenly and minimize key relocation during node addition.\n2. **Concurrency & Consistency:** Use Multi-Version Concurrency Control (MVCC) or optimistic locking to prevent lost updates without coarse table locks.\n3. **Resilience & Backpressure:** Implement token-bucket rate limiting and circuit breakers to prevent cascading outages."
            example = "```typescript\n// High-throughput pattern with circuit breaker\nclass ResilientService {\n  private circuitBreaker = new CircuitBreaker({\n    failureThreshold: 5,\n    resetTimeoutMs: 3000\n  });\n\n  async execute(param: string): Promise<Result> {\n    return this.circuitBreaker.fire(() => this.primaryWorker(param));\n  }\n}\n```"
            keywords = ["Consistent Hashing", "Virtual Nodes", "MVCC", "Circuit Breaker", "Write-Ahead Log", "Backpressure"]

        structured = StructuredAnswer(
            direct_answer=direct,
            simple_explanation=expl,
            example=example,
            important_keywords=keywords
        )

        raw_md = (
            f"### 1. Direct Answer\n{direct}\n\n"
            f"### 2. Simple Explanation\n{expl}\n\n"
            f"### 3. Example\n{example}\n\n"
            f"### 4. Important Keywords\n{', '.join(keywords)}"
        )

        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "question": q,
            "style": style,
            "model_used": f"{model_name} (Simulated)",
            "structured_answer": structured,
            "raw_markdown": raw_md,
            "latency_ms": max(latency_ms, 380),
            "is_mock_fallback": True,
            "warning": warning,
        }

ollama_service = OllamaService()
