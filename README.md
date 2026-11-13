<div align="center">

# Adaptive Context-Activated Multi-Module NLP System for Real-Time Conversational Intelligence

### Real-time conversational intelligence powered by modular NLP analysis

<img src="https://readme-typing-svg.demolab.com?font=Poppins&weight=600&size=22&pause=1000&color=4F8EF7&center=true&vCenter=true&width=800&lines=Adaptive+Context-Aware+NLP;Real-Time+Conversational+Intelligence;Sentiment+%7C+Emotion+%7C+Toxicity+Analysis;Adaptive+Context+Activation;AI-Powered+Conversation+Insights" alt="Animated project highlights" />

<br />

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![Hugging Face](https://img.shields.io/badge/Hugging%20Face-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)

</div>

A modular chat application that combines real-time messaging with
machine-learning analysis of conversational text. The project explores how
sentiment, emotion, toxicity, summaries, topics, and selected conversation
context can be processed alongside a live conversation.

## Overview

Most chat applications focus on delivering and storing messages. This project
adds a conversational intelligence layer that analyzes messages as they move
through the chat pipeline.

The main research idea is **Adaptive Context Activation (ACA)**. Instead of
always sending the same number of previous messages to an NLP model, ACA
estimates how much context the current message needs. It uses interpretable
signals such as:

- References to earlier messages
- Message brevity
- Semantic similarity to recent conversation history
- Classifier uncertainty

Relevant history is then selected using semantic relevance and recency. A
standalone message can be analyzed without unnecessary context, while a
follow-up such as "I meant the other results" can include the messages needed
to interpret it.

## Problem and Motivation

Online conversations contain more information than the message text alone.
Short replies, pronouns, corrections, and references such as "that one" or
"the earlier result" depend on previous turns. A system that analyzes every
message in isolation can miss this dependency, while a system that always
sends a large fixed context window spends computation on irrelevant text.

This project investigates a middle ground: keep the chat experience
lightweight and real-time, but selectively provide context when the message
appears to require it. The application is both a usable chat prototype and an
experimental platform for measuring the trade-off between predictive quality,
context size, and inference latency.

## Project Goals

- Build a complete real-time chat application instead of an isolated model
  demo.
- Keep analysis modular so individual NLP tasks can be improved independently.
- Analyze messages asynchronously so NLP processing does not block delivery.
- Make context selection observable and explainable through scores, levels, and
  selected messages.
- Compare classical machine-learning baselines with pretrained Transformer
  models on public datasets.
- Evaluate whether selective context can improve conversational predictions
  while reducing the amount of history sent to downstream models.

## Features

- Real-time one-to-one chat with Socket.io
- User authentication and persisted conversations
- Per-message sentiment, emotion, and toxicity analysis
- Conversation summaries and topic extraction
- Adaptive Context Activation for context-aware analysis
- Conversation analytics, including sentiment, emotion, toxicity, and context
  usage statistics
- Reproducible experiments comparing classical baselines, Transformer models,
  and context-selection strategies

## NLP Modules

The Python service exposes focused modules as well as a combined
`/analyze/message` pipeline:

| Module | Purpose | Current approach |
| --- | --- | --- |
| Sentiment | Identifies positive, neutral or negative message sentiment | RoBERTa (`cardiffnlp/twitter-roberta-base-sentiment-latest`) |
| Emotion | Detects emotions such as joy, sadness, anger, fear, disgust, surprise, and neutral | RoBERTa GoEmotions classifier, grouped into 7 emotions |
| Toxicity | Flags toxic or offensive language for moderation and conversation insights | Toxic-BERT multi-label classifier |
| Summarization | Produces a concise view of a longer conversation | BART model fine-tuned for dialogue summarization |
| Topic extraction | Finds representative terms and themes | TF-IDF keyword extraction |
| Context selection | Chooses relevant prior turns for context-dependent messages | ACA scoring plus MiniLM embeddings |

The live message endpoint combines ACA with sentiment, emotion, and toxicity
analysis. Conversation-level endpoints use the stored message history to
generate summaries and topics for analytics views.

## Message Analysis Flow

1. A user sends a message through the React client.
2. The Node.js server persists the message in MongoDB and delivers it through
   Socket.io.
3. The server asynchronously sends the message and recent text history to the
   FastAPI NLP service.
4. ACA scores the message and selects zero or more relevant prior messages.
5. The selected context and current message are passed to the analysis models.
6. The resulting sentiment, emotion, toxicity, context metadata, and latency
   are stored with the message analysis record.
7. The analysis update is emitted back to both conversation participants, so
   the interface can update without a page refresh.

NLP analysis is intentionally non-blocking. If the NLP service is unavailable,
normal chat delivery continues and only the analysis update is skipped. This
keeps the core messaging experience independent from model availability.

## How Adaptive Context Activation Works

ACA currently considers up to the most recent eight history messages while
calculating a context requirement score. Four normalized signals contribute to
the score:

| Signal | Weight | Interpretation |
| --- | ---: | --- |
| Reference | 0.35 | Detects pronouns and phrases that commonly refer to earlier turns |
| Brevity | 0.15 | Treats very short messages as more likely to need context |
| Similarity | 0.30 | Measures semantic relatedness to recent history with MiniLM embeddings |
| Uncertainty | 0.20 | Uses standalone sentiment confidence as an ambiguity signal |

The weighted score is grouped into three levels:

- **Low:** no previous messages are selected
- **Medium:** up to two relevant messages are selected
- **High:** up to five relevant messages are selected

Selection is based on a blend of semantic similarity and recency, then the
chosen messages are restored to chronological order before being composed with
the current message. The weights and thresholds are intentionally simple,
interpretable starting points rather than claims of an optimally tuned model.

## Architecture

```text
React + Vite client
          |
          v
Node.js + Express + Socket.io server ---- MongoDB
          |
          v
Python + FastAPI NLP service
  ├── sentiment analysis
  ├── emotion detection
  ├── toxicity detection
  ├── summarization
  ├── topic extraction
  └── Adaptive Context Activation
```

The NLP service is separated from the chat backend so that the analysis
modules can be developed, evaluated, and replaced independently.

## Design Principles

- **Modularity:** chat, persistence, transport, and inference are separated
  into services with clear responsibilities.
- **Asynchronous processing:** analysis runs after message delivery and does
  not hold up normal chat operations.
- **Explainability:** ACA records its context level, score, selected messages,
  and processing metadata instead of returning an opaque context decision.
- **Reproducibility:** experiments use declared sample sizes, fixed seeds, and
  generated result files rather than hard-coded metrics.
- **Graceful degradation:** the application remains usable when optional NLP
  analysis or external media services are not configured.

## Technology Stack

- **Frontend:** React, Vite, Tailwind CSS, Socket.io Client
- **Backend:** Node.js, Express, Socket.io, JWT, Mongoose
- **Database:** MongoDB
- **NLP service:** Python, FastAPI, PyTorch, Hugging Face Transformers,
  sentence-transformers, scikit-learn
- **Evaluation:** Public datasets, accuracy/precision/recall/F1, confusion
  matrices, and inference latency

## Evaluation Snapshot

The included experiment suite compares the live pretrained models with
TF-IDF plus Logistic Regression baselines, and compares ACA with a full recent
context strategy. The following results come from the checked-in experiment
configuration and should be read as a development snapshot, not a universal
benchmark:

### Classification tasks

| Task | Baseline accuracy | Transformer accuracy | Transformer macro F1 |
| --- | ---: | ---: | ---: |
| Sentiment | 70.3% | **91.3%** | **0.913** |
| Emotion | 67.3% | **93.0%** | **0.631** |
| Toxicity | 80.7% | **88.3%** | **0.829** |

The Transformer models improved predictive quality on the evaluated samples,
but they were substantially slower on the CPU-only, single-example setup. For
example, measured mean latency was approximately 217 ms for sentiment,
260 ms for emotion, and 493 ms for toxicity.

### Context selection

On 251 evaluable turns from 40 DailyDialog conversations, ACA improved
accuracy from 54.6% to 62.5% and macro F1 from 0.151 to 0.191 compared with
the full-context strategy. Average context decreased from 52.5 words to
11.7 words, a 77.8% reduction.

This reduction did not automatically produce lower wall-clock latency in the
current CPU implementation: ACA averaged 665.3 ms compared with 453.3 ms for
full context because embedding and scoring add decision overhead. This is an
important measured trade-off and an area for future optimization.

## Repository Structure

```text
client/          React chat application
server/          Express API, authentication, messaging, and NLP integration
nlp-service/     FastAPI analysis service and ACA implementation
experiments/     Reproducible model and context-selection evaluations
training/        Fine-tuning pipeline scaffold for selected tasks
paper_figures/   Scripts and figures used for project documentation
RUNNING.md       Detailed setup, troubleshooting, and testing guide
```

## Getting Started

### Prerequisites

- Node.js 18 or newer
- Python 3.10-3.12
- MongoDB Community Server or MongoDB Atlas
- Git

### 1. Start MongoDB

Run MongoDB locally, or prepare a MongoDB Atlas connection string.

### 2. Start the backend

```powershell
cd server
npm install
copy .env.example .env
npm run server
```

Set `MONGODB_URI` and `JWT_SECRET` in `server/.env`. To enable live NLP
analysis, set `NLP_SERVICE_URL=http://localhost:8000`.

### 3. Start the NLP service

Open a second terminal:

```powershell
cd nlp-service
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

The first startup downloads the pretrained models used by the service and may
take a few minutes. The NLP service can be omitted if you only need the basic
chat application.

### 4. Start the client

Open a third terminal:

```powershell
cd client
npm install
copy .env.example .env
npm run dev
```

Open the local URL shown by Vite, usually `http://localhost:5173`.

For environment-variable details, health checks, testing, and Windows
troubleshooting, see [RUNNING.md](RUNNING.md).

## NLP API

The FastAPI service exposes endpoints for:

- `GET /health`
- `POST /analyze/message`
- `POST /analyze/sentiment`
- `POST /analyze/emotion`
- `POST /analyze/toxicity`
- `POST /analyze/summarize`
- `POST /analyze/topics`
- `POST /context/select`

See [nlp-service/README.md](nlp-service/README.md) for request formats,
model details, and ACA implementation notes.

## Running Tests and Experiments

The project includes targeted tests for the NLP context logic and backend
controllers:

```powershell
cd nlp-service
pytest

cd ..\server
npm test
```

To run the client checks:

```powershell
cd client
npm run lint
npm run build
```

To reproduce the evaluation outputs, install the NLP service requirements and
run the experiment orchestrator:

```powershell
cd experiments
<path-to-nlp-service-venv>\Scripts\python.exe run_all.py
```

The generated JSON metrics, confusion matrices, and comparison charts are
written to `experiments/results/`. The full methodology and dataset notes are
documented in [experiments/README.md](experiments/README.md).

## Research and Evaluation

The `experiments/` module evaluates:

1. TF-IDF and Logistic Regression baselines against the pretrained models used
   by the live service.
2. Full/recent conversation context against Adaptive Context Activation.

The evaluation uses public datasets including SST-2, dair-ai/emotion,
tweet_eval, and DailyDialog. To reproduce the experiments, follow
[experiments/README.md](experiments/README.md). Results and their
interpretation are available in [experiments/FINDINGS.md](experiments/FINDINGS.md).

## Limitations and Future Work

The current implementation is deliberately a practical first research
prototype. Important limitations include:

- ACA weights and thresholds are heuristic and have not been optimized against
  a dedicated context-requirement dataset.
- The reference signal uses lightweight pattern matching, so it cannot fully
  resolve coreference or distinguish every self-contained pronoun.
- Transformer inference is CPU-intensive and currently processes messages one
  at a time.
- The toxicity experiment uses the openly accessible TweetEval offensive
  subset as a proxy for the live model's original training domain.
- Public dialogue datasets contain label imbalance, so accuracy should be
  considered alongside macro F1 and weighted F1.
- Model downloads and inference require additional disk space and startup
  time, especially on the first NLP service launch.

Potential extensions include GPU-optimized inference, batched requests,
learned context thresholds, richer coreference resolution, multilingual
models, custom fine-tuning, and broader conversation-level analytics.

## Project Status

This repository contains a working prototype and research implementation.
The real-time chat flow, modular NLP service, ACA context selection, and
conversation analytics are implemented. The training directory provides a
fine-tuning scaffold for future experiments.

## License

No license has been specified for this repository yet.
