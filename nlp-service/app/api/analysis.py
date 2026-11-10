"""
/analyze/* routes.

Individual per-task endpoints (/analyze/sentiment, /analyze/emotion,
/analyze/toxicity) are kept for experimentation/evaluation (Phase 9,
comparing baselines vs Transformers per task) and always analyze exactly
the text they're given. The combined /analyze/message endpoint is what
the Node backend calls per chat message: it first runs Adaptive Context
Activation (Phase 6/7) to decide how much prior conversation history (if
any) this message needs, then routes the message through one tier of a
lightweight/heavyweight model cascade accordingly (Phase 10), and returns
a full explainability trace alongside the result - all in one request,
to avoid multiple HTTP round trips per message.
"""
import time

from fastapi import APIRouter, HTTPException

from app.context.composer import build_effective_text
from app.context.scoring import score_context_requirement
from app.context.selector import select_context_messages
from app.context.trace import HEAVYWEIGHT_TIER, build_trace
from app.models.emotion.model import analyze_emotion
from app.models.sentiment.model import analyze_sentiment
from app.models.toxicity.model import analyze_toxicity
from app.schemas.analysis import (
    AnalyzeEmotionResponse,
    AnalyzeMessageRequest,
    AnalyzeMessageResponse,
    AnalyzeSentimentResponse,
    AnalyzeToxicityResponse,
    TextAnalysisRequest,
)
from app.utils.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/analyze", tags=["analysis"])


@router.post("/sentiment", response_model=AnalyzeSentimentResponse)
def analyze_sentiment_endpoint(payload: TextAnalysisRequest) -> AnalyzeSentimentResponse:
    try:
        return AnalyzeSentimentResponse(**analyze_sentiment(payload.text))
    except Exception as exc:  # noqa: BLE001 - surfaced to the caller as a 500
        logger.exception("Sentiment analysis failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/emotion", response_model=AnalyzeEmotionResponse)
def analyze_emotion_endpoint(payload: TextAnalysisRequest) -> AnalyzeEmotionResponse:
    try:
        return AnalyzeEmotionResponse(**analyze_emotion(payload.text))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Emotion analysis failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/toxicity", response_model=AnalyzeToxicityResponse)
def analyze_toxicity_endpoint(payload: TextAnalysisRequest) -> AnalyzeToxicityResponse:
    try:
        return AnalyzeToxicityResponse(**analyze_toxicity(payload.text))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Toxicity analysis failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/message", response_model=AnalyzeMessageResponse)
def analyze_message_endpoint(payload: AnalyzeMessageRequest) -> AnalyzeMessageResponse:
    """
    Run Adaptive Context Activation, then analyze the message with the
    heavyweight Transformers.

    The TF-IDF + Logistic Regression baselines (app/models/baseline/) are
    kept in the codebase for evaluation/comparison but are intentionally
    not used here: they were too inaccurate for live chat messages. The
    context level only decides how much prior history is added to the text
    the Transformers analyze (none for "low").
    """
    total_start = time.perf_counter()
    try:
        context_result = score_context_requirement(payload.text, payload.history)
        selected_context = select_context_messages(
            context_result.considered_history, context_result.similarities, context_result.level
        )
        effective_text = build_effective_text(selected_context, payload.text)

        model_tier = HEAVYWEIGHT_TIER
        # The uncertainty signal already ran the sentiment Transformer on the
        # raw message during ACA scoring (see app/context/scoring.py); reuse
        # it when no context was added so the model isn't called twice.
        if effective_text == payload.text and context_result.raw_sentiment:
            sentiment_result = context_result.raw_sentiment
        else:
            sentiment_result = analyze_sentiment(effective_text)
        emotion_result = analyze_emotion(effective_text)
        toxicity_result = analyze_toxicity(effective_text)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Combined message analysis failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    total_latency_ms = (time.perf_counter() - total_start) * 1000

    trace = build_trace(context_result, effective_text, model_tier)

    return AnalyzeMessageResponse(
        sentiment=sentiment_result["sentiment"],
        emotion=emotion_result["emotion"],
        toxicity=toxicity_result["toxicity"],
        processing={
            "sentiment": sentiment_result["processing"],
            "emotion": emotion_result["processing"],
            "toxicity": toxicity_result["processing"],
        },
        totalLatencyMs=round(total_latency_ms, 2),
        contextLevel=context_result.level,
        contextScore=context_result.score,
        selectedContextMessages=len(selected_context),
        modelTier=model_tier,
        trace=trace,
    )
