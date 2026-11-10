"""
Builds the full explainability trace returned alongside every combined
/analyze/message response: the ACA signal breakdown, the candidate
history ranking, and which model tier handled the message and why. This
is assembled from real, already-computed pipeline state (never a canned
example) so it can drive both the live per-message chat UI and the
Algorithm Showcase's step-by-step visualization with the same numbers.
"""
from app.context.scoring import HIGH_THRESHOLD, LOW_THRESHOLD, WEIGHTS, ContextScore
from app.context.selector import describe_context_candidates

LIGHTWEIGHT_TIER = "lightweight"
HEAVYWEIGHT_TIER = "heavyweight"

TIER_REASONS = {
    # Kept for compatibility with previously stored analyses; the live
    # pipeline no longer routes to the baselines.
    LIGHTWEIGHT_TIER: (
        "Analyzed by the lightweight TF-IDF + Logistic Regression baseline "
        "(legacy; no longer used by the live pipeline)."
    ),
    HEAVYWEIGHT_TIER: (
        "Analyzed by the full Transformer models for the highest accuracy. "
        "Adaptive Context Activation decides whether prior conversation "
        "turns are added to the text first."
    ),
}

LIGHTWEIGHT_MODELS_USED = {
    "sentiment": "tfidf-logreg-sentiment",
    "emotion": "tfidf-logreg-emotion",
    "toxicity": "tfidf-logreg-toxicity",
}
HEAVYWEIGHT_MODELS_USED = {
    "sentiment": "distilbert-base-uncased-finetuned-sst-2-english",
    "emotion": "j-hartmann/emotion-english-distilroberta-base",
    "toxicity": "unitary/toxic-bert",
}


def build_trace(
    context_result: ContextScore,
    effective_text: str,
    model_tier: str,
) -> dict:
    signals = [
        {
            "name": name,
            "value": round(value, 4),
            "weight": WEIGHTS[name],
            "contribution": round(WEIGHTS[name] * value, 4),
        }
        for name, value in context_result.signals.items()
    ]

    candidate_history = describe_context_candidates(
        context_result.considered_history, context_result.similarities, context_result.level
    )
    for candidate in candidate_history:
        candidate["similarity"] = round(candidate["similarity"], 4)
        candidate["recency"] = round(candidate["recency"], 4)
        candidate["combinedScore"] = round(candidate["combinedScore"], 4)
        del candidate["index"]

    models_used = LIGHTWEIGHT_MODELS_USED if model_tier == LIGHTWEIGHT_TIER else HEAVYWEIGHT_MODELS_USED

    return {
        "signals": signals,
        "thresholds": {"low": LOW_THRESHOLD, "high": HIGH_THRESHOLD},
        "contextScore": context_result.score,
        "contextLevel": context_result.level,
        "candidateHistory": candidate_history,
        "effectiveText": effective_text,
        "modelTier": model_tier,
        "tierReason": TIER_REASONS[model_tier],
        "modelsUsed": models_used,
    }
