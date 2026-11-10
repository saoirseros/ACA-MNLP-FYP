"""
Lightweight emotion baseline: TF-IDF + Logistic Regression, trained on
the same dair-ai/emotion sample used in experiments/run_all.py (3000
training examples, seed 42).

Note the same label-space caveat already documented in
experiments/datasets_loader.py: dair-ai/emotion only covers
sadness/joy/anger/fear/surprise (no "love", no "neutral"/"disgust"),
whereas the heavyweight transformer (j-hartmann/emotion-english-
distilroberta-base) covers all 7 labels including neutral/disgust. This
is an existing, already-published discrepancy in the paper's evaluation,
not a new problem introduced here - it is simply now also visible on the
"lightweight" tier of the live cascade, and is called out in the trace
returned to the client so it's never silently hidden.

At serving time (not in the published offline evaluation), a margin
guard (see NEUTRAL_MARGIN_THRESHOLD below) reports "neutral" whenever
the top two candidate emotions are near-tied, instead of forcing plain,
unemotional chat text ("hey whats up") into one of the 5 trained labels
just because the classifier must pick something.
"""
import time
from functools import lru_cache
from typing import Tuple, List

from app.models.baseline._train import SEED, get_or_train_pipeline
from app.utils.logging import get_logger

logger = get_logger(__name__)

MODEL_NAME = "tfidf-logreg-emotion"
N_TRAIN = 3000  # matches experiments/run_all.py SAMPLE_SIZES["emotion_train"]

# dair-ai/emotion's native label set used for training (see
# experiments/datasets_loader.py EMOTION_LABELS for why "love" is excluded).
LABEL_SPACE = ["sadness", "joy", "anger", "fear", "surprise"]

# dair-ai/emotion has no "neutral" class, so on its own this classifier is
# forced to pick one of the 5 emotions above for every message - including
# plain, unemotional chat text ("hey whats up", "did you do the assignment?")
# that has no real emotional content at all. Empirically, those forced
# picks come from a near-tied probability distribution: the winning
# label's own probability sits barely above its runner-up, e.g.
# "hey whats up" -> sadness 0.35 vs joy 0.28 (a 0.07 margin - essentially
# a coin flip between the two). Rather than surface that as a confidently
# labeled emotion, we report "neutral" whenever the top two classes are
# this close together - this is a serving-time calibration guard, not a
# retrained model, so it does not change the published 5-class offline
# accuracy (experiments/baselines.py evaluates on dair-ai/emotion's own
# labels, which never include neutral instances and are therefore
# unaffected). The 0.08 margin was chosen empirically: it catches clearly
# neutral chat text (greetings, logistics questions) while still letting
# through genuinely emotional text the classifier is reasonably (if not
# highly) sure about, e.g. "i am terrified, please help me" -> fear with
# a 0.09 margin stays "fear" rather than being flattened to "neutral".
NEUTRAL_MARGIN_THRESHOLD = 0.08


def _load_training_data() -> Tuple[List[str], List[str]]:
    """
    Identical loading logic to experiments/datasets_loader.py's
    load_emotion_split("train", N_TRAIN) - duplicated (not imported), see
    sentiment_baseline.py's _load_training_data for why.
    """
    from datasets import load_dataset

    ds = load_dataset("dair-ai/emotion", split="train")
    label_names = ds.features["label"].names  # ['sadness','joy','love','anger','fear','surprise']
    ds = ds.filter(lambda example: label_names[example["label"]] != "love")
    ds = ds.shuffle(seed=SEED).select(range(min(N_TRAIN, len(ds))))
    texts = list(ds["text"])
    labels = [label_names[label] for label in ds["label"]]
    return texts, labels


@lru_cache
def _get_pipeline():
    return get_or_train_pipeline(MODEL_NAME, _load_training_data)


def analyze_emotion_baseline(text: str) -> dict:
    """Run the lightweight emotion baseline on a single message."""
    pipeline = _get_pipeline()

    start = time.perf_counter()
    proba = pipeline.predict_proba([text])[0]
    classes = pipeline.classes_
    ranked_indices = proba.argsort()[::-1]
    top_index, runner_up_index = ranked_indices[0], ranked_indices[1]
    top_label, top_confidence = str(classes[top_index]), float(proba[top_index])
    margin = top_confidence - float(proba[runner_up_index])

    if margin < NEUTRAL_MARGIN_THRESHOLD:
        # The top two candidate emotions are too close together to trust
        # either one - report neutral instead of an arbitrary coin-flip
        # winner. Confidence reflects how unsure the classifier itself
        # was (1 - its own top probability), not the tightness of the
        # margin, so it doesn't overstate certainty in the neutral call.
        label, confidence = "neutral", round(1.0 - top_confidence, 4)
    else:
        label, confidence = top_label, round(top_confidence, 4)
    latency_ms = (time.perf_counter() - start) * 1000

    return {
        "emotion": {"label": label, "confidence": confidence},
        "processing": {"latencyMs": round(latency_ms, 2), "model": MODEL_NAME},
    }
