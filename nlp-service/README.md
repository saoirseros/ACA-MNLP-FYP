# NLP Service

Python/FastAPI service responsible for the multi-module NLP analysis layer
described in the project spec (sentiment, emotion, toxicity, summarization,
topic extraction) plus the Adaptive Context Activation (ACA) mechanism.

Current status: **Phase 11 complete**. All five analysis modules (Phase 5)
are implemented, Adaptive Context Activation (ACA, Phase 6) is wired into
the live per-message chat pipeline (Phase 7), and conversation-level
intelligence (Phase 8) aggregates all of this into a dashboard: Node's
`GET /api/messages/analytics/:id` calls `/analyze/summarize` and
`/analyze/topics` on the recent conversation and combines that with
aggregated per-message sentiment/emotion/toxicity/context stats already
stored from Phase 7.

## Endpoints

| Endpoint | Input | Used by live chat? |
| --- | --- | --- |
| `GET /health` | - | Yes - Node polls this |
| `POST /analyze/sentiment` | `{ "text": "..." }` | Standalone/experiments |
| `POST /analyze/emotion` | `{ "text": "..." }` | Standalone/experiments |
| `POST /analyze/toxicity` | `{ "text": "..." }` | Standalone/experiments |
| `POST /analyze/message` | `{ "text": "...", "history": ["...", "..."] }` | **Yes** - runs ACA, then combined sentiment+emotion+toxicity, in one call, per message |
| `POST /analyze/summarize` | `{ "messages": ["...", "..."] }` | **Yes** - called by Node's conversation analytics endpoint |
| `POST /analyze/topics` | `{ "messages": ["...", "..."] }` | **Yes** - called by Node's conversation analytics endpoint |
| `POST /context/select` | `{ "text": "...", "history": ["...", "..."] }` | Used internally by `/analyze/message`; also callable standalone for debugging/experiments |

The per-task endpoints (`/analyze/sentiment`, `/analyze/emotion`,
`/analyze/toxicity`) are kept even though the chat pipeline uses the
combined `/analyze/message` endpoint - they're useful later for the
Phase 9 experiment framework (measuring one model/task in isolation).

## Adaptive Context Activation (ACA) (Phase 6)

`app/context/` implements the project's core research idea: instead of
always sending a fixed amount of history to every model, estimate how
much context a message actually needs.

**Signals** (`app/context/signals.py`, `app/context/scoring.py`), each
normalized to `[0, 1]`:

| Signal | Weight | What it captures |
| --- | --- | --- |
| `reference` | 0.35 | Regex-detected pronouns/back-references ("that", "it", "they", "again", "I meant", "the other", ...) - conversational dependency |
| `brevity` | 0.15 | Very short messages carry less standalone meaning - ambiguity |
| `similarity` | 0.30 | Cosine similarity (via `all-MiniLM-L6-v2` sentence embeddings) between the current message and recent history - semantic relevance / topic continuity |
| `uncertainty` | 0.20 | `1 - 2*|sentiment_confidence - 0.5|` - how uncertain the (already-warm) sentiment model is about the message alone - model uncertainty |

These combine into a single `score = Σ weight × signal`, bucketed as
`low` (`< 0.35`), `medium` (`0.35-0.65`), or `high` (`>= 0.65`).

**Selection** (`app/context/selector.py`): once a level is chosen, the
most relevant previous messages are picked by a 70/30 blend of semantic
similarity and recency (not simply "the last N messages"), then restored
to chronological order - `low` selects 0 messages, `medium` up to 2,
`high` up to 5.

**Model routing / effective input** (`app/context/composer.py`, Phase 7):
once messages are selected, they're joined with the current message
(chronological order, newline-separated) into a single "effective text",
which is what actually gets passed to the sentiment/emotion/toxicity
models. `low` context level means the effective text is just the current
message - this is the "Adaptive Model Routing" the spec describes: the
same models are used throughout (no separate lightweight/heavy model
swap, which would be over-engineering here), but how much text they see
adapts to the estimated context need.

**Verified against the spec's own examples:**
- `"That's disappointing."` after `[..., "The recruiter replied.", "They rejected it."]` → **medium**, selects those exact last two messages (not the older, unrelated "we discussed the internship yesterday").
- `"Thanks!"` after an unrelated exchange → **low**, empty context.
- `"No, I meant the other results."` after `["I finally got the results.", "That's great!"]` → **medium**, reference correctly detected via "I meant"/"the other".
- All three verified live through the real chat flow too (real users, real MongoDB history, real Socket.io delivery), not just the standalone endpoint.

**Known, honest limitations** (this is a first, interpretable
implementation per the spec - not a tuned model):
- The weights/thresholds above are heuristic starting points. Tuning them
  against real labeled data is exactly what the Phase 9 experiment
  framework is for - no claims are made here about this being optimal.
- Short pronoun-only follow-ups (e.g. "that again?") often have *low*
  embedding similarity to their own antecedent, precisely because they
  deliberately don't repeat the topic's words. This is why `reference` is
  weighted independently of `similarity` rather than relying on
  similarity alone - but it means `similarity` alone is not a reliable
  signal for this specific case.
- Reaching the `high` band currently requires several signals to align
  at once (strong reference + high similarity + real model uncertainty);
  in informal testing it was reachable but less common than `low`/`medium`.
  Whether that's the right balance is an empirical question for Phase 9,
  not something asserted here.
- The regex `reference` signal can't distinguish a pronoun referring back
  to prior conversation from one that's self-contained within the same
  sentence - e.g. "I finally got the internship, **this** is amazing
  news!" triggers `reference=1.0` even though "this" resolves within the
  sentence itself, not from history. Real coreference resolution would
  fix this but is a substantially heavier NLP problem on its own, out of
  scope for this "keep it simple" first implementation.

## Models currently used

| Task | Checkpoint | Notes |
| --- | --- | --- |
| Sentiment | `cardiffnlp/twitter-roberta-base-sentiment-latest` | ~500MB, 3-class negative/neutral/positive, trained on chat-like text |
| Emotion | `SamLowe/roberta-base-go_emotions` | ~500MB, 28 GoEmotions labels summed into 7 (anger, disgust, fear, joy, neutral, sadness, surprise) |
| Toxicity | `unitary/toxic-bert` | ~420MB, multi-label (Jigsaw categories); we threshold the general "toxic" label at 0.5 |
| Summarization | `lidiya/bart-base-samsum` | ~560MB, BART-base fine-tuned on SAMSum (dialogue summarization, not news) |
| Topic | TF-IDF (scikit-learn) | No Transformer - a lightweight keyword-extraction baseline over the conversation's messages |
| Context similarity | `sentence-transformers/all-MiniLM-L6-v2` | ~90MB, used only for embedding similarity in Adaptive Context Activation, not a classifier |

## Structure

```
nlp-service/
    app/
        main.py            # FastAPI app factory + entrypoint + startup model warm-up
        config.py           # Environment-driven settings
        api/                 # HTTP route definitions
            routes.py         # Aggregates all routers
            health.py         # GET /health
            analysis.py       # /analyze/sentiment, /emotion, /toxicity, /message
            conversation.py   # /analyze/summarize, /analyze/topics
            context.py        # /context/select (Adaptive Context Activation)
        preprocessing/       # Text cleaning/tokenization helpers (used as needed per module)
        context/             # Adaptive Context Activation module (Phase 6/7)
            embeddings.py      # Lazy-loaded MiniLM sentence embeddings + cosine similarity
            signals.py         # Individual interpretable signals (reference, brevity)
            scoring.py         # Combines signals into a context-requirement score/level
            selector.py        # Picks which history messages to include (similarity + recency)
            composer.py        # Builds the effective model input from selected context (Phase 7)
        models/
            sentiment/        # Sentiment classifier wrapper
            emotion/          # Emotion classifier wrapper
            toxicity/         # Toxicity classifier wrapper
            summarization/    # Conversation summarization wrapper
            topic/            # TF-IDF topic/keyword extraction
        inference/           # Shared inference utilities (warmup.py preloads per-message models)
        evaluation/          # Metrics computation used by experiments/ (Phase 9)
        schemas/             # Pydantic request/response models (analysis.py, conversation.py, context.py)
        utils/               # Logging and other cross-cutting helpers
    requirements.txt
    .env.example
```

Each `models/<task>/` package is intended to be independently replaceable:
swapping the sentiment model for a different checkpoint should not require
touching emotion, toxicity, summarization, or topic code.

## Running locally

```powershell
cd nlp-service
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Then check:

```
GET http://localhost:8000/health
```

### Running the context tests

The lightweight unittest suite exercises the three canonical Adaptive Context
Activation examples documented above. It uses the same short-path environment
as the service:

```powershell
cd nlp-service
$env:PYTHONPATH = "."
C:\nlp-venvs\ptp-nlp-service\Scripts\python.exe -m unittest discover -s tests -v
```

The first test run may load the cached sentence-embedding and sentiment models.

> **Windows note:** if your repository lives under a deeply nested path (this
> project's OneDrive path is one example), installing `torch` into a `.venv`
> inside the project can fail with `WinError 206: filename or extension is
> too long`, because some of torch's bundled license/docs files have very
> long relative paths and Windows' default 260-character path limit isn't
> raised. If you hit this, create the virtual environment at a short path
> outside the repo instead, e.g.:
> ```powershell
> python -m venv C:\nlp-venvs\ptp-nlp-service
> C:\nlp-venvs\ptp-nlp-service\Scripts\python.exe -m pip install -r requirements.txt
> cd nlp-service
> C:\nlp-venvs\ptp-nlp-service\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
> ```
> (Alternatively, enable long paths system-wide via
> `HKLM\SYSTEM\CurrentControlSet\Control\FileSystem\LongPathsEnabled=1`,
> which requires admin rights.)

## Design notes

- **Lazy loading**: model wrappers load their weights on first use and
  cache the loaded model (`@lru_cache`), not at import time, so the
  service starts instantly and only pays the memory/CPU cost for modules
  actually exercised.
- **Startup warm-up for per-message models**: since every chat message
  triggers sentiment + emotion + toxicity together, `app/inference/warmup.py`
  preloads those three in a background thread right after the service
  starts (not blocking `/health`). This avoids the first real chat message
  paying the one-time model-loading cost (which can take longer than a
  typical request timeout). Summarization and topic extraction are *not*
  warmed up, since they aren't part of the always-invoked per-message path.
- **Fail gracefully**: if a model fails to load or infer, the endpoint
  returns a clear error rather than crashing the whole service - the Node
  backend depends on this service being unavailable-safe.
- **No fake metrics**: the `evaluation/` package only reports numbers
  computed from real runs; nothing here is allowed to hardcode
  accuracy/F1/latency values.
- **TF-IDF topic extraction is a deliberate baseline, not a placeholder**:
  per the project spec's "lightweight topic modeling approach... where
  practical" guidance, topic extraction uses classic TF-IDF instead of a
  large Transformer. This is honest about its limitations (e.g. a rare but
  specific word can outrank a more central topic term) - that trade-off
  is exactly what the Phase 9 experiments are meant to measure, not hide.
