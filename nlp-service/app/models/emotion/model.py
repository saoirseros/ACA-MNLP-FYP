"""
Lazy-loaded wrapper around a pretrained emotion classifier.

Uses SamLowe/roberta-base-go_emotions: a RoBERTa-base checkpoint
fine-tuned on GoEmotions (58k Reddit comments, 27 emotions + neutral).
Its fine-grained labels (gratitude, remorse, disapproval, ...) are summed
into the 7 labels the rest of the app uses (anger, disgust, fear, joy,
neutral, sadness, surprise). This handles everyday chat much better than
a 7-class model, e.g. "I'm sorry you had such a bad experience" is
sadness (not disgust) and "Not bad at all" is neutral (not disgust).
"""
import time
from functools import lru_cache
from typing import Optional

from app.utils.logging import get_logger

logger = get_logger(__name__)

MODEL_CHECKPOINT = "SamLowe/roberta-base-go_emotions"

# GoEmotions label -> app emotion label. Scores of labels mapping to the
# same emotion are summed, so e.g. a message that is gratitude + admiration
# + excitement is clearly "joy" even though no single label is dominant.
EMOTION_GROUPS = {
    "joy": ["admiration", "amusement", "caring", "excitement", "gratitude", "joy", "love", "optimism", "pride", "relief", "desire"],
    "sadness": ["disappointment", "embarrassment", "grief", "remorse", "sadness"],
    "anger": ["anger", "annoyance", "disapproval"],
    "fear": ["fear", "nervousness"],
    "surprise": ["surprise", "realization", "confusion", "curiosity"],
    "disgust": ["disgust"],
    "neutral": ["neutral", "approval"],
}
_LABEL_TO_EMOTION = {label: emotion for emotion, labels in EMOTION_GROUPS.items() for label in labels}


@lru_cache
def _get_pipeline():
    # Imported lazily so importing this module never pulls in torch/transformers
    # until an emotion request actually arrives.
    from transformers import pipeline

    logger.info("Loading emotion model (first use): %s", MODEL_CHECKPOINT)
    return pipeline("text-classification", model=MODEL_CHECKPOINT, top_k=None)


def group_emotion_scores(scores: list[dict]) -> dict[str, float]:
    """Sum fine-grained GoEmotions scores into the app's 7 emotion labels."""
    grouped = {emotion: 0.0 for emotion in EMOTION_GROUPS}
    for item in scores:
        emotion = _LABEL_TO_EMOTION.get(item["label"].lower())
        if emotion:
            grouped[emotion] += float(item["score"])
    return grouped


def analyze_emotion(text: str, context: Optional[list[str]] = None) -> dict:
    """
    Run emotion classification on `text`.

    `context` is accepted for interface stability but is not used: the
    classifier scores the message itself.
    """
    classifier = _get_pipeline()

    start = time.perf_counter()
    scores = classifier(text, truncation=True)[0]  # list of {label, score} across all labels
    latency_ms = (time.perf_counter() - start) * 1000

    grouped = group_emotion_scores(scores)
    top_label = max(grouped, key=grouped.get)

    return {
        "emotion": {"label": top_label, "confidence": round(min(1.0, grouped[top_label]), 4)},
        "processing": {"latencyMs": round(latency_ms, 2), "model": MODEL_CHECKPOINT},
    }
