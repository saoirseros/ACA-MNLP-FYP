"""
Keyphrase/topic extraction for a conversation.

Plain TF-IDF over a handful of short chat messages can't tell content
words from filler (every term appears about once), so it surfaced words
like "hey", "lol" or "think". This module instead works in three steps:

1. Candidate phrases: each message is split into chunks at stop words,
   chat filler and punctuation, so candidates (1-3 words) are made only
   of meaningful words - never "the", "a", "ok", "lol", etc.
2. Ranking: each candidate is scored by semantic similarity to the whole
   conversation (using the already-loaded MiniLM sentence embedder, as in
   KeyBERT) blended with how often it appears. If embeddings are
   unavailable, ranking falls back to frequency and phrase length.
3. Selection: top candidates are picked greedily, skipping any phrase
   that overlaps one already chosen (e.g. "battery" vs "battery dead").
"""
import re
import time
from collections import Counter
from typing import Optional

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

from app.utils.logging import get_logger

logger = get_logger(__name__)

TOP_N_KEYWORDS = 5
MAX_PHRASE_WORDS = 3
MIN_WORD_LENGTH = 3
SIMILARITY_WEIGHT = 0.75  # remainder of the score comes from frequency
# A longer phrase replaces a part of it if it scores at least this
# fraction as well (so "machine learning" wins over "machine").
LONGER_PHRASE_TOLERANCE = 0.8

_WORD_PATTERN = re.compile(r"[a-zA-Z][a-zA-Z'’]*")

# Words that carry no topic information in chat: greetings, fillers,
# acknowledgements, generic verbs/adjectives, slang and contraction
# fragments (e.g. "don" from "don't"). Added on top of scikit-learn's
# English stop word list.
_CHAT_FILLER = {
    "hey", "hi", "hello", "yo", "hiya", "bye", "goodbye", "cya", "lol", "lmao", "haha", "hahaha", "hehe",
    "omg", "btw", "idk", "imo", "tbh", "ok", "okay", "kk", "yeah", "yep", "yup", "yes", "nope", "nah",
    "sure", "thanks", "thank", "thx", "please", "pls", "plz", "sorry", "welcome", "cool", "nice", "good",
    "great", "fine", "awesome", "bad", "well", "right", "alright", "wow", "oh", "ah", "hmm", "hmmm", "um",
    "uh", "huh", "gonna", "wanna", "gotta", "lemme", "gimme", "kinda", "sorta", "dunno", "ya", "ye", "ur",
    "pretty", "really", "actually", "basically", "literally", "maybe", "probably", "just", "still",
    "also", "even", "much", "many", "lot", "lots", "like", "know", "think", "thought", "guess", "feel",
    "felt", "mean", "means", "meant", "say", "said", "says", "tell", "told", "talk", "talking", "see",
    "saw", "look", "looks", "looking", "seem", "seems", "want", "wanted", "need", "needed", "let", "lets",
    "got", "get", "gets", "getting", "go", "goes", "going", "went", "gone", "come", "comes", "coming",
    "wants", "needs", "likes", "thinks", "knows", "feels", "loves", "hates", "takes", "makes", "wanting",
    "believe", "remember", "forget", "wait", "ask", "asked", "help", "check", "hear", "heard", "show",
    "keep", "start", "finish", "finished", "call", "meet", "does", "did", "done", "near", "nearby", "place", "places",
    "came", "make", "makes", "making", "made", "take", "takes", "took", "taking", "give", "gave", "put",
    "try", "tried", "trying", "use", "used", "using", "thing", "things", "stuff", "something", "anything",
    "everything", "nothing", "someone", "anyone", "everyone", "one", "ones", "way", "ways", "time",
    "times", "today", "tomorrow", "yesterday", "tonight", "later", "soon", "now", "then", "again",
    "already", "ever", "never", "always", "sometimes", "anyway", "anyways", "hope", "wish", "love",
    "hate", "happy", "glad", "first", "last", "next", "new", "old", "big", "little", "small", "long",
    "short", "different", "same", "able", "sec", "min", "minute", "minutes", "hour", "hours", "day",
    "days", "morning", "night", "evening", "afternoon", "week", "weekend",
    "don", "doesn", "didn", "isn", "aren", "wasn", "weren", "won", "wouldn", "couldn", "shouldn",
    "haven", "hasn", "hadn", "ain", "ll", "ve", "im", "ive", "youre", "thats", "whats", "dont",
    "doesnt", "didnt", "cant", "wont", "isnt", "arent", "wasnt", "couldnt", "wouldnt", "shouldnt",
}
_STOP_WORDS = frozenset(ENGLISH_STOP_WORDS) | _CHAT_FILLER


def _clean_word(raw: str) -> Optional[str]:
    """
    Normalize one raw token. Returns None if it is a stop word/filler (so
    it acts as a phrase boundary). Contractions are reduced to their base
    word ("john's" -> "john", "don't" -> "don" -> filler).
    """
    word = raw.lower().replace("’", "'")
    if word in _STOP_WORDS:
        return None
    # Lowercase "-ed" words are almost always past-tense verbs ("looked",
    # "scored"); capitalized ones are kept since they may be names ("Ahmed").
    if raw.islower() and len(word) > 4 and word.endswith("ed"):
        return None
    word = word.split("'")[0]
    if len(word) < MIN_WORD_LENGTH or word in _STOP_WORDS:
        return None
    return word


def _candidate_phrases(messages: list[str]) -> Counter:
    """
    Count candidate phrases (1-3 words) across messages. Chunks are runs
    of consecutive meaningful words; every sub-phrase of a chunk becomes
    a candidate, so a bare "dashboard" and "analytics dashboard" can both
    be considered and ranked against each other.
    """
    counts: Counter = Counter()
    for message in messages:
        chunks: list[list[str]] = []
        # Sentence punctuation also ends a chunk, so words from different
        # clauses aren't glued into a phrase that nobody wrote.
        for sentence in re.split(r"[.!?,;:\n()\[\]\"]+", message):
            chunk = []
            for raw in _WORD_PATTERN.findall(sentence):
                word = _clean_word(raw)
                if word is None:
                    if chunk:
                        chunks.append(chunk)
                    chunk = []
                else:
                    chunk.append(word)
            if chunk:
                chunks.append(chunk)

        seen_in_message: set[str] = set()
        for words in chunks:
            for size in range(1, min(MAX_PHRASE_WORDS, len(words)) + 1):
                for i in range(len(words) - size + 1):
                    phrase = " ".join(words[i : i + size])
                    if phrase not in seen_in_message:
                        seen_in_message.add(phrase)
                        counts[phrase] += 1
    return counts


def _rank_by_embeddings(phrases: list[str], messages: list[str], counts: Counter) -> list[tuple[str, float]]:
    from app.context.embeddings import embed

    document = " ".join(messages)
    vectors = embed([document, *phrases])
    similarities = vectors[1:] @ vectors[0]
    max_count = max(counts[p] for p in phrases)
    scores = [
        SIMILARITY_WEIGHT * float(sim) + (1 - SIMILARITY_WEIGHT) * counts[p] / max_count
        for p, sim in zip(phrases, similarities)
    ]
    return sorted(zip(phrases, scores), key=lambda pair: pair[1], reverse=True)


def _rank_by_frequency(phrases: list[str], counts: Counter) -> list[tuple[str, float]]:
    scored = [(p, counts[p] + 0.1 * len(p.split())) for p in phrases]
    return sorted(scored, key=lambda pair: pair[1], reverse=True)


def _overlaps(phrase: str, chosen: list[str]) -> bool:
    words = set(phrase.split())
    return any(words & set(other.split()) for other in chosen)


def _contains_phrase(longer: str, shorter: str) -> bool:
    return longer != shorter and f" {shorter} " in f" {longer} "


def _prefer_longer_phrase(phrase: str, scores: dict[str, float]) -> str:
    """
    If a longer phrase containing `phrase` scores nearly as well, use it
    instead (e.g. "machine learning" over "machine").
    """
    best = phrase
    for other, score in scores.items():
        if (
            _contains_phrase(other, phrase)
            and score >= scores[phrase] * LONGER_PHRASE_TOLERANCE
            and (len(other.split()) > len(best.split()) or (len(other.split()) == len(best.split()) and score > scores[best]))
        ):
            best = other
    return best


def extract_topics(messages: list[str], context: Optional[dict] = None) -> dict:
    """
    Extract a small set of representative keyphrases from a conversation's
    messages (see module docstring for the approach). Returns no keywords
    if the conversation contains only filler/stop words.
    """
    start = time.perf_counter()

    non_empty_messages = [m for m in messages if m and m.strip()]
    counts = _candidate_phrases(non_empty_messages)
    phrases = list(counts)

    model_name = "keyphrase-minilm"
    ranked: list[tuple[str, float]] = []
    if phrases:
        try:
            ranked = _rank_by_embeddings(phrases, non_empty_messages, counts)
        except Exception:  # noqa: BLE001 - never fail topic extraction because embeddings are unavailable
            logger.exception("Embedding-based keyphrase ranking failed; falling back to frequency ranking")
            model_name = "keyphrase-frequency"
            ranked = _rank_by_frequency(phrases, counts)

    keywords: list[str] = []
    scores = dict(ranked)
    for phrase, _score in ranked:
        if len(keywords) >= TOP_N_KEYWORDS:
            break
        phrase = _prefer_longer_phrase(phrase, scores)
        if not _overlaps(phrase, keywords):
            keywords.append(phrase)

    latency_ms = (time.perf_counter() - start) * 1000

    return {
        "topic": {"label": keywords[0] if keywords else None, "keywords": keywords},
        "processing": {"latencyMs": round(latency_ms, 2), "model": model_name},
    }
