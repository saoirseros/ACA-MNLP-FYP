"""
EXTENDED ANALYSIS (Experiment C): strengthens the Experiment B comparison
(full-context vs. Adaptive Context Activation on DailyDialog) with the
evidence a reviewer will ask for. It reuses the exact production code
paths and the exact same dialogue sample (seed 42, 40 dialogues, 251
evaluable turns) as run_all.py, and adds:

  1. A no-context control (current utterance only).
  2. The production model-tier cascade (low context -> lightweight
     TF-IDF+LR baseline, medium/high -> heavyweight Transformer with
     ACA-selected context), which Experiment B did not exercise.
  3. A trivial majority-class ("always neutral") reference.
  4. Paired significance tests (exact McNemar) and bootstrap 95% CIs for
     accuracy / macro-F1 differences.
  5. Per-class recall split into neutral vs. emotional turns.

Per-turn predictions are stored in the output JSON so every statistic can
be recomputed. Run from the experiments/ directory:

    python extended_analysis.py
"""
import json
import time
from collections import Counter
from typing import Dict, List

import numpy as np
from scipy.stats import binomtest

from common.pathutil import ensure_nlp_service_on_path

ensure_nlp_service_on_path()

from app.context.composer import build_effective_text  # noqa: E402
from app.context.scoring import MAX_HISTORY_CONSIDERED, score_context_requirement  # noqa: E402
from app.context.selector import select_context_messages  # noqa: E402
from app.models.baseline.emotion_baseline import analyze_emotion_baseline  # noqa: E402
from app.models.emotion.model import analyze_emotion  # noqa: E402
from common.metrics import compute_classification_metrics, latency_stats, save_json  # noqa: E402
from datasets_loader import load_dialogue_sample  # noqa: E402

LABELS = ["anger", "disgust", "fear", "joy", "neutral", "sadness", "surprise"]
N_DIALOGUES = 40
BOOTSTRAP_ITERATIONS = 10000
RNG_SEED = 42
CONDITIONS = ["none", "full", "aca_heavy", "aca_cascade", "lightweight_only"]


def macro_f1_fast(y_true: np.ndarray, y_pred: np.ndarray, n_labels: int) -> float:
    tp = np.bincount(y_true[y_true == y_pred], minlength=n_labels).astype(float)
    pred_count = np.bincount(y_pred, minlength=n_labels).astype(float)
    true_count = np.bincount(y_true, minlength=n_labels).astype(float)
    denom = pred_count + true_count
    f1 = np.divide(2 * tp, denom, out=np.zeros(n_labels), where=denom > 0)
    return float(f1.mean())


def wilson_interval(successes: int, n: int, z: float = 1.96):
    p = successes / n
    denom = 1 + z**2 / n
    centre = (p + z**2 / (2 * n)) / denom
    half = z * np.sqrt(p * (1 - p) / n + z**2 / (4 * n**2)) / denom
    return float(centre - half), float(centre + half)


def run_turns(dialogues) -> Dict[str, dict]:
    out = {c: {"y_pred": [], "latency_ms": []} for c in CONDITIONS}
    out["meta"] = {"y_true": [], "level": [], "tier": [], "selected": [], "context_words": {"full": [], "aca": []}}

    for dialogue in dialogues:
        history: List[str] = []
        for utterance, true_label in dialogue:
            if history:
                out["meta"]["y_true"].append(true_label)

                t = time.perf_counter()
                res = analyze_emotion(utterance)
                out["none"]["latency_ms"].append((time.perf_counter() - t) * 1000)
                out["none"]["y_pred"].append(res["emotion"]["label"])

                full_ctx = history[-MAX_HISTORY_CONSIDERED:]
                t = time.perf_counter()
                res = analyze_emotion(build_effective_text(full_ctx, utterance))
                out["full"]["latency_ms"].append((time.perf_counter() - t) * 1000)
                out["full"]["y_pred"].append(res["emotion"]["label"])
                out["meta"]["context_words"]["full"].append(sum(len(m.split()) for m in full_ctx))

                t = time.perf_counter()
                ctx = score_context_requirement(utterance, history)
                selected = select_context_messages(ctx.considered_history, ctx.similarities, ctx.level)
                res = analyze_emotion(build_effective_text(selected, utterance))
                out["aca_heavy"]["latency_ms"].append((time.perf_counter() - t) * 1000)
                out["aca_heavy"]["y_pred"].append(res["emotion"]["label"])
                out["meta"]["context_words"]["aca"].append(sum(len(m.split()) for m in selected))
                out["meta"]["selected"].append(len(selected))

                t = time.perf_counter()
                ctx = score_context_requirement(utterance, history)
                selected = select_context_messages(ctx.considered_history, ctx.similarities, ctx.level)
                effective = build_effective_text(selected, utterance)
                if ctx.level == "low":
                    res = analyze_emotion_baseline(utterance)
                    tier = "lightweight"
                else:
                    res = analyze_emotion(effective)
                    tier = "heavyweight"
                out["aca_cascade"]["latency_ms"].append((time.perf_counter() - t) * 1000)
                out["aca_cascade"]["y_pred"].append(res["emotion"]["label"])
                out["meta"]["level"].append(ctx.level)
                out["meta"]["tier"].append(tier)

                t = time.perf_counter()
                res = analyze_emotion_baseline(utterance)
                out["lightweight_only"]["latency_ms"].append((time.perf_counter() - t) * 1000)
                out["lightweight_only"]["y_pred"].append(res["emotion"]["label"])
            history.append(utterance)
    return out


def paired_tests(y_true, preds_a, preds_b, rng):
    idx = {l: i for i, l in enumerate(LABELS)}
    yt = np.array([idx[x] for x in y_true])
    pa = np.array([idx[x] for x in preds_a])
    pb = np.array([idx[x] for x in preds_b])
    ca, cb = pa == yt, pb == yt
    only_a, only_b = int(np.sum(ca & ~cb)), int(np.sum(~ca & cb))
    discordant = only_a + only_b
    p_value = binomtest(min(only_a, only_b), discordant, 0.5).pvalue if discordant else 1.0

    n = len(yt)
    acc_d, f1_d = [], []
    for _ in range(BOOTSTRAP_ITERATIONS):
        s = rng.integers(0, n, n)
        acc_d.append(float(np.mean(ca[s]) - np.mean(cb[s])))
        f1_d.append(macro_f1_fast(yt[s], pa[s], len(LABELS)) - macro_f1_fast(yt[s], pb[s], len(LABELS)))
    return {
        "a_only_correct": only_a,
        "b_only_correct": only_b,
        "mcnemar_exact_p": float(p_value),
        "accuracy_diff": float(np.mean(ca) - np.mean(cb)),
        "accuracy_diff_ci95": [float(np.percentile(acc_d, 2.5)), float(np.percentile(acc_d, 97.5))],
        "macro_f1_diff": macro_f1_fast(yt, pa, len(LABELS)) - macro_f1_fast(yt, pb, len(LABELS)),
        "macro_f1_diff_ci95": [float(np.percentile(f1_d, 2.5)), float(np.percentile(f1_d, 97.5))],
    }


def recall_split(y_true, y_pred):
    neutral = [i for i, t in enumerate(y_true) if t == "neutral"]
    emotional = [i for i, t in enumerate(y_true) if t != "neutral"]
    return {
        "neutral_recall": sum(y_pred[i] == "neutral" for i in neutral) / len(neutral),
        "emotional_turns": len(emotional),
        "emotional_exact_recall": sum(y_pred[i] == y_true[i] for i in emotional) / len(emotional),
        "emotional_detected_as_non_neutral": sum(y_pred[i] != "neutral" for i in emotional) / len(emotional),
        "predicted_non_neutral_overall": sum(p != "neutral" for p in y_pred) / len(y_pred),
    }


def main():
    dialogues = load_dialogue_sample(N_DIALOGUES)
    # warm up every model once so first-call load time never enters latency
    analyze_emotion("warm up")
    analyze_emotion_baseline("warm up")
    score_context_requirement("warm up", ["warm up history"])

    out = run_turns(dialogues)
    y_true = out["meta"]["y_true"]
    n = len(y_true)
    print("evaluated turns:", n)

    summary = {"n_turns": n, "labels": LABELS, "conditions": {}}
    for cond in CONDITIONS:
        m = compute_classification_metrics(y_true, out[cond]["y_pred"], LABELS)
        correct = sum(p == t for p, t in zip(out[cond]["y_pred"], y_true))
        summary["conditions"][cond] = {
            "accuracy": m["accuracy"],
            "accuracy_wilson_ci95": wilson_interval(correct, n),
            "precision_macro": m["precision_macro"],
            "recall_macro": m["recall_macro"],
            "f1_macro": m["f1_macro"],
            "f1_weighted": m["f1_weighted"],
            "latency_ms": latency_stats(out[cond]["latency_ms"]),
            "recall_split": recall_split(y_true, out[cond]["y_pred"]),
            "confusion_matrix": m["confusion_matrix"],
        }

    majority = ["neutral"] * n
    mm = compute_classification_metrics(y_true, majority, LABELS)
    summary["majority_class_always_neutral"] = {
        "accuracy": mm["accuracy"],
        "f1_macro": mm["f1_macro"],
        "f1_weighted": mm["f1_weighted"],
        "class_counts": dict(Counter(y_true)),
    }

    rng = np.random.default_rng(RNG_SEED)
    summary["paired_tests"] = {
        "aca_heavy_vs_full": paired_tests(y_true, out["aca_heavy"]["y_pred"], out["full"]["y_pred"], rng),
        "aca_heavy_vs_none": paired_tests(y_true, out["aca_heavy"]["y_pred"], out["none"]["y_pred"], rng),
        "full_vs_none": paired_tests(y_true, out["full"]["y_pred"], out["none"]["y_pred"], rng),
        "aca_cascade_vs_aca_heavy": paired_tests(y_true, out["aca_cascade"]["y_pred"], out["aca_heavy"]["y_pred"], rng),
        "aca_cascade_vs_full": paired_tests(y_true, out["aca_cascade"]["y_pred"], out["full"]["y_pred"], rng),
    }

    tiers = Counter(out["meta"]["tier"])
    levels = Counter(out["meta"]["level"])
    summary["routing"] = {
        "tier_counts": dict(tiers),
        "tier_share_lightweight": tiers.get("lightweight", 0) / n,
        "level_counts": dict(levels),
        "mean_context_words_full": float(np.mean(out["meta"]["context_words"]["full"])),
        "mean_context_words_aca": float(np.mean(out["meta"]["context_words"]["aca"])),
    }
    lat = {"lightweight": [], "heavyweight": []}
    for tier, ms in zip(out["meta"]["tier"], out["aca_cascade"]["latency_ms"]):
        lat[tier].append(ms)
    summary["routing"]["cascade_latency_by_tier_ms"] = {k: (float(np.mean(v)) if v else None) for k, v in lat.items()}

    summary["per_turn"] = {
        "y_true": y_true,
        **{c: out[c]["y_pred"] for c in CONDITIONS},
        "tier": out["meta"]["tier"],
        "level": out["meta"]["level"],
    }
    path = save_json("extended_analysis", summary)
    print("saved", path)

    for cond in CONDITIONS:
        s = summary["conditions"][cond]
        print(f"{cond:17s} acc={s['accuracy']:.3f} macroF1={s['f1_macro']:.3f} wF1={s['f1_weighted']:.3f} "
              f"lat={s['latency_ms']['mean']:.1f}ms emoRecall={s['recall_split']['emotional_exact_recall']:.3f} "
              f"neutRecall={s['recall_split']['neutral_recall']:.3f}")
    print("majority:", json.dumps(summary["majority_class_always_neutral"]))
    print("routing:", json.dumps(summary["routing"]))
    for k, v in summary["paired_tests"].items():
        print(k, json.dumps(v))


if __name__ == "__main__":
    main()
