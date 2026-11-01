import re
import uuid
import difflib
from typing import List, Optional, Tuple
from pydantic import BaseModel, Field

from app.schemas import (
    TranscriptSegment,
    QuestionCategory,
    DetectedQuestion,
    QuestionDetectionConfig,
    QuestionDetectionResponse,
)

INTERVIEW_TRIGGER_PATTERNS = [
    # Technical & System Design triggers
    (r'\b(how (would|do|can) you (design|architect|scale|optimize|implement|build))\b', 'technical', 0.90),
    (r'\b(what is the difference between|compare|contrast)\b', 'technical', 0.85),
    (r'\b(explain (how|what|why)|walk (me|us) through|describe the architecture of)\b', 'technical', 0.85),
    (r'\b(how does (the|a|an)?\s*[a-zA-Z0-9_-]+\s*work)\b', 'technical', 0.85),
    (r'\b(cap theorem|acid|concurrency|multithread|threading|deadlock|mutex|semaphore|race condition|rate limit|cache eviction)\b', 'technical', 0.80),
    (r'\b(microservices|event loop|garbage collect|indexing|sharding|replication|global interpreter lock|gil)\b', 'technical', 0.80),

    # Coding & Algorithmic triggers
    (r'\b(how would you (solve|find|compute|traverse|reverse|sort|search))\b', 'coding', 0.90),
    (r'\b(what is the (time|space) complexity|big o of)\b', 'coding', 0.90),
    (r'\b(write a function|implement (a|an)?\s*(binary search|lru|linked list|stack|queue|tree|heap|graph))\b', 'coding', 0.90),
    (r'\b(dynamic programming|two pointers|sliding window|recursion|memoization)\b', 'coding', 0.80),

    # Behavioral & Leadership triggers
    (r'\b(tell me about a time|give me an example of|describe a situation where)\b', 'behavioral', 0.95),
    (r'\b(have you ever (had to|disagreed|faced|failed|managed))\b', 'behavioral', 0.90),
    (r'\b(how do you handle (conflict|tight deadlines|pressure|feedback|disagreements))\b', 'behavioral', 0.90),
    (r'\b(what was your biggest (failure|achievement|challenge))\b', 'behavioral', 0.85),

    # HR & Culture Fit triggers
    (r'\b(why (do you want to work|are you leaving|this company))\b', 'hr', 0.90),
    (r'\b(where do you see yourself in|career goals|what are your strengths|weaknesses)\b', 'hr', 0.85),
    (r'\b(what are your (salary|compensation) expectations)\b', 'hr', 0.90),

    # General interrogatives
    (r'\b(can you (explain|tell|elaborate|clarify|describe|give))\b', 'general', 0.75),
    (r'\b(why did you choose|what was the reason for)\b', 'general', 0.75),
    (r'\b(what would happen if|how do you ensure)\b', 'general', 0.75),
]

# Audio artifacts and casual non-question conversation fillers to ignore
NOISE_ARTIFACTS = {
    'yeah', 'yes', 'no', 'okay', 'ok', 'alright', 'uh', 'um', 'hm', 'hmm', 'huh',
    'can you hear me', 'am i audible', 'testing testing', 'one two three',
    'hang on a second', 'let me see', 'give me a moment', 'just a sec',
    'thanks', 'thank you', 'sounds good', 'great', 'awesome', 'cool',
    'hello', 'hi', 'good morning', 'good afternoon', 'can you see my screen'
}

class QuestionDetectorService:
    def __init__(self):
        self._detected_history: List[DetectedQuestion] = []
        self._last_processed_time: float = 0.0

    def clean_text(self, text: str) -> str:
        """Strip filler punctuation and normalize whitespace."""
        # Normalize ellipses and repeated periods to spaces
        cleaned = re.sub(r'\.{2,}|…', ' ', text)
        return re.sub(r'\s+', ' ', cleaned).strip()

    def is_noise_or_incomplete(self, text: str, min_length: int = 15) -> bool:
        """Check if text is casual filler, incomplete phrase, or background noise."""
        clean = self.clean_text(text).lower()

        # 1. Too short
        if len(clean) < min_length:
            return True

        # 2. Exact match in noise set
        clean_no_punct = re.sub(r'[^a-zA-Z0-9\s]', '', clean).strip()
        if clean_no_punct in NOISE_ARTIFACTS:
            return True

        # 3. Known conversational boilerplate without substance
        if any(clean_no_punct.startswith(prefix) for prefix in [
            'can you hear me', 'am i audible', 'can you see my', 'testing one two',
            'give me one second', 'hang on let me', 'sorry my mic'
        ]):
            return True

        # 4. Words count too low (less than 3 words)
        words = clean_no_punct.split()
        if len(words) < 3:
            return True

        return False

    def calculate_similarity(self, text1: str, text2: str) -> float:
        """Compute sequence matcher similarity ratio between two questions."""
        s1 = re.sub(r'[^a-zA-Z0-9\s]', '', text1.lower()).strip()
        s2 = re.sub(r'[^a-zA-Z0-9\s]', '', text2.lower()).strip()
        return difflib.SequenceMatcher(None, s1, s2).ratio()

    def is_duplicate(self, candidate_text: str, existing_questions: List[DetectedQuestion], threshold: float = 0.85) -> bool:
        """Check if question has already been detected or submitted."""
        for existing in existing_questions:
            similarity = self.calculate_similarity(candidate_text, existing.text)
            if similarity >= threshold:
                return True
        return False

    def evaluate_question(self, text: str) -> Tuple[bool, QuestionCategory, float]:
        """
        Evaluate text against pattern library, grammar markers, and question structure.
        Returns: (is_question, category, confidence)
        """
        clean = self.clean_text(text)
        lower = clean.lower()

        best_category: QuestionCategory = "general"
        highest_pattern_conf = 0.0

        # Check regex trigger patterns
        for pattern, cat, conf in INTERVIEW_TRIGGER_PATTERNS:
            if re.search(pattern, lower, re.IGNORECASE):
                if conf > highest_pattern_conf:
                    highest_pattern_conf = conf
                    best_category = cat

        # Syntactic checks
        has_question_mark = clean.endswith('?')
        starts_with_wh = any(lower.startswith(wh) for wh in [
            'what', 'how', 'why', 'when', 'where', 'which', 'who', 'whose', 'whom', 'can', 'could', 'would', 'do', 'does', 'did', 'is', 'are'
        ])

        # Compute aggregate confidence
        confidence = highest_pattern_conf

        if confidence > 0:
            if has_question_mark:
                confidence = min(1.0, confidence + 0.10)
            if starts_with_wh:
                confidence = min(1.0, confidence + 0.05)
        elif has_question_mark and starts_with_wh:
            confidence = 0.75
            best_category = "general"
        elif has_question_mark:
            confidence = 0.55
            best_category = "general"

        is_question = confidence >= 0.60
        return is_question, best_category, round(confidence, 2)

    def process_transcript_chunks(
        self,
        chunks: List[TranscriptSegment],
        config: Optional[QuestionDetectionConfig] = None,
        existing_detected: Optional[List[DetectedQuestion]] = None,
    ) -> QuestionDetectionResponse:
        """
        Processes a sequence of speech transcript segments, combines multi-chunk questions,
        filters noise & duplicates, and yields candidate interview questions.
        """
        cfg = config or QuestionDetectionConfig()
        history = list(existing_detected or [])
        detected_list: List[DetectedQuestion] = []
        ignored_count = 0
        duplicates_count = 0

        # Filter to non-empty, finalized segments only (ignore in-flight partial segments)
        sorted_chunks = [c for c in chunks if c.text and c.text.strip() and getattr(c, 'is_final', True)]
        if not sorted_chunks:
            return QuestionDetectionResponse(
                detected_questions=[],
                raw_processed_text="",
                ignored_phrases_count=0,
                duplicates_filtered_count=0,
            )

        # 1. Combine adjacent chunks into candidate sentence blocks
        candidate_blocks: List[Tuple[str, List[str], str]] = []
        current_text = ""
        current_chunk_ids: List[str] = []
        current_timestamp = sorted_chunks[0].timestamp

        for c in sorted_chunks:
            text = c.text.strip()
            if not current_text:
                current_timestamp = c.timestamp
                current_text = text
                current_chunk_ids = [c.id]
            else:
                current_text += " " + text
                current_chunk_ids.append(c.id)

            # Check if text ends with genuine terminal punctuation (not trailing ellipsis or pause markers)
            is_ellipsis = text.endswith('...') or text.endswith('..') or text.endswith('…')
            has_question_terminal = text.endswith('?')
            has_period_terminal = text.endswith('.') and not is_ellipsis

            # Finalize candidate sentence if a terminal symbol is hit or length exceeds safety buffer
            if (has_question_terminal or has_period_terminal) or len(current_text) > 250:
                candidate_blocks.append((current_text, current_chunk_ids, current_timestamp))
                current_text = ""
                current_chunk_ids = []

        if current_text:
            candidate_blocks.append((current_text, current_chunk_ids, current_timestamp))

        # Also evaluate individual chunks for direct self-contained questions if not already captured
        for c in sorted_chunks:
            chunk_trimmed = c.text.strip()
            if chunk_trimmed.endswith('?') and len(chunk_trimmed) >= cfg.min_length_chars:
                if not any(chunk_trimmed in b[0] for b in candidate_blocks):
                    candidate_blocks.append((chunk_trimmed, [c.id], c.timestamp))

        raw_joined = " ".join(c.text.strip() for c in sorted_chunks)

        # 2. Evaluate each candidate block
        for block_text, chunk_ids, ts in candidate_blocks:
            clean = self.clean_text(block_text)

            # Check noise and length
            if self.is_noise_or_incomplete(clean, min_length=cfg.min_length_chars):
                ignored_count += 1
                continue

            # Evaluate question patterns and confidence
            is_q, category, conf = self.evaluate_question(clean)

            if not is_q or conf < cfg.min_confidence:
                ignored_count += 1
                continue

            # Ensure text ends with question mark if question
            formatted_text = clean if clean.endswith('?') else f"{clean}?"

            # Deduplication against existing history and current batch
            all_known = history + detected_list
            if self.is_duplicate(formatted_text, all_known, threshold=cfg.deduplication_threshold):
                duplicates_count += 1
                continue

            status = "auto_submitted" if cfg.auto_answer_enabled else "pending_review"

            detected_q = DetectedQuestion(
                id=f"dq-{uuid.uuid4().hex[:8]}",
                text=formatted_text,
                category=category,
                confidence=conf,
                timestamp=ts,
                source_chunks=chunk_ids,
                status=status,
            )
            detected_list.append(detected_q)

        return QuestionDetectionResponse(
            detected_questions=detected_list,
            raw_processed_text=raw_joined,
            ignored_phrases_count=ignored_count,
            duplicates_filtered_count=duplicates_count,
        )

question_detector = QuestionDetectorService()
