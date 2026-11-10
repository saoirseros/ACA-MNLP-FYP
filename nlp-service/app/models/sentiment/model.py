"""
Lazy-loaded wrapper around a pretrained sentiment classifier.

Uses cardiffnlp/twitter-roberta-base-sentiment-latest: a RoBERTa-base
checkpoint fine-tuned on ~124M tweets (informal, chat-like text) that
predicts negative / neutral / positive with a confidence score. Unlike a
binary classifier it can say "neutral" for factual or filler messages
("ok see you at 5") instead of forcing them to positive or negative.

The model is only loaded into memory the first time analyze_sentiment()
is called (lazy loading), and then reused for all subsequent requests
(cached via lru_cache) rather than reloading it per request.
"""
import time
from functools import lru_cache
from typing import Optional

from app.utils.logging import get_logger

logger = get_logger(__name__)

MODEL_CHECKPOINT = "cardiffnlp/twitter-roberta-base-sentiment-latest"


@lru_cache
def _get_pipeline():
    # Imported lazily so importing this module never pulls in torch/transformers
    # until a sentiment request actually arrives.
    from transformers import pipeline

    logger.info("Loading sentiment model (first use): %s", MODEL_CHECKPOINT)
    return pipeline("text-classification", model=MODEL_CHECKPOINT)


def analyze_sentiment(text: str, context: Optional[list[str]] = None) -> dict:
    """
    Run sentiment analysis on `text`.

    `context` is accepted for interface stability but is not used: the
    classifier scores the message itself.
    """
    classifier = _get_pipeline()

    start = time.perf_counter()
    result = classifier(text, truncation=True)[0]
    latency_ms = (time.perf_counter() - start) * 1000

    label = result["label"].lower()
    if label not in ("positive", "neutral", "negative"):
        label = "neutral"

    return {
        "sentiment": {"label": label, "confidence": round(float(result["score"]), 4)},
        "processing": {"latencyMs": round(latency_ms, 2), "model": MODEL_CHECKPOINT},
    }
