"""Pydantic request/response schemas for the /analyze/* endpoints."""
from typing import Optional

from pydantic import BaseModel, Field


class TextAnalysisRequest(BaseModel):
    """Shared request shape for the single-task analyze endpoints."""
    text: str = Field(..., min_length=1, description="The message text to analyze")


class SentimentResult(BaseModel):
    label: str
    confidence: float


class EmotionResult(BaseModel):
    label: str
    confidence: float


class ToxicityResult(BaseModel):
    label: str
    confidence: float
    # Most likely specific toxicity category (e.g. "insult", "threat"),
    # only set when the message is flagged as toxic.
    category: Optional[str] = None


class ProcessingInfo(BaseModel):
    latencyMs: float
    model: str


class AnalyzeSentimentResponse(BaseModel):
    sentiment: SentimentResult
    processing: ProcessingInfo


class AnalyzeEmotionResponse(BaseModel):
    emotion: EmotionResult
    processing: ProcessingInfo


class AnalyzeToxicityResponse(BaseModel):
    toxicity: ToxicityResult
    processing: ProcessingInfo


class AnalyzeMessageRequest(BaseModel):
    """Request for the combined /analyze/message endpoint used by the chat pipeline."""
    text: str = Field(..., min_length=1, description="The message text to analyze")
    # Preceding conversation messages, oldest first, current message excluded.
    # Adaptive Context Activation decides how much (if any) of this is
    # actually used - see app/context/.
    history: list[str] = Field(default_factory=list)


class SignalBreakdown(BaseModel):
    """One ACA signal's raw value, its weight, and its contribution to the
    final context score (value * weight) - the building blocks the
    Algorithm Showcase renders as boxes/arrows."""
    name: str
    value: float
    weight: float
    contribution: float


class CandidateHistoryItem(BaseModel):
    """One prior conversation message considered as context, with its
    similarity/recency ranking and whether ACA ultimately selected it."""
    text: str
    similarity: float
    recency: float
    combinedScore: float
    selected: bool


class AnalysisTrace(BaseModel):
    """
    Full, real (never mocked) explainability trace of one message's trip
    through Adaptive Context Activation and the model-tier cascade -
    every number here is exactly what the pipeline actually computed for
    this message, not a canned example. Powers both the per-message
    inline UI and the Algorithm Showcase's step-by-step visualization.
    """
    signals: list[SignalBreakdown]
    thresholds: dict[str, float]
    contextScore: float
    contextLevel: str
    candidateHistory: list[CandidateHistoryItem]
    effectiveText: str
    analyzedText: str = ""
    modelTier: str
    tierReason: str
    modelsUsed: dict[str, str]


class AnalyzeMessageResponse(BaseModel):
    """Runs every currently available NLP module on one message in a single call."""
    sentiment: SentimentResult
    emotion: EmotionResult
    toxicity: ToxicityResult
    processing: dict[str, ProcessingInfo]
    totalLatencyMs: float
    # Adaptive Context Activation outcome for this message.
    contextLevel: str
    contextScore: float
    selectedContextMessages: int
    # "lightweight" (TF-IDF+LogReg baseline) or "heavyweight" (Transformers)
    # - which tier of the model cascade actually analyzed this message.
    modelTier: str
    trace: AnalysisTrace
