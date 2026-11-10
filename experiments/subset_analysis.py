"""
Subset analysis for Experiment C. Reads the per-turn predictions saved by
extended_analysis.py and reports accuracy of each strategy separately on
the turns ACA scored as needing context ("medium"/"high") versus the turns
it scored as standalone ("low"). No models are run here.

    python subset_analysis.py
"""
import json
from pathlib import Path

import numpy as np
from scipy.stats import binomtest

from common.metrics import save_json

RESULTS = Path(__file__).resolve().parent / "results" / "extended_analysis.json"
CONDS = ["none", "full", "aca_heavy", "aca_cascade", "lightweight_only"]


def mcnemar_p(correct_a, correct_b):
    only_a = int(np.sum(correct_a & ~correct_b))
    only_b = int(np.sum(~correct_a & correct_b))
    n = only_a + only_b
    return only_a, only_b, (binomtest(min(only_a, only_b), n, 0.5).pvalue if n else 1.0)


def main():
    data = json.loads(RESULTS.read_text(encoding="utf-8"))
    pt = data["per_turn"]
    y = np.array(pt["y_true"])
    level = np.array(pt["level"])
    out = {}
    for name, mask in [("low_context_turns", level == "low"),
                       ("context_needed_turns_medium_high", level != "low"),
                       ("all_turns", np.ones(len(y), bool))]:
        sub = {"n": int(mask.sum()), "neutral_share": float(np.mean(y[mask] == "neutral")), "accuracy": {}}
        for c in CONDS:
            pred = np.array(pt[c])
            sub["accuracy"][c] = float(np.mean(pred[mask] == y[mask]))
        corr = {c: (np.array(pt[c])[mask] == y[mask]) for c in CONDS}
        sub["mcnemar_aca_heavy_vs_full"] = dict(zip(["aca_only", "full_only", "p"], mcnemar_p(corr["aca_heavy"], corr["full"])))
        sub["mcnemar_aca_heavy_vs_none"] = dict(zip(["aca_only", "none_only", "p"], mcnemar_p(corr["aca_heavy"], corr["none"])))
        sub["mcnemar_full_vs_none"] = dict(zip(["full_only", "none_only", "p"], mcnemar_p(corr["full"], corr["none"])))
        out[name] = sub
        print(name, json.dumps(sub))
    save_json("extended_subset_analysis", out)


if __name__ == "__main__":
    main()
