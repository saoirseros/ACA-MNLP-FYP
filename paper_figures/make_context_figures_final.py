"""
Final versions of Figs. 8-10 (context experiment), generated directly from
experiments/results/extended_analysis.json so every plotted number comes
from the saved per-turn predictions of the shipped ACA implementation.
No embedded titles: the paper's captions provide them.
"""
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

plt.rcParams["font.family"] = "serif"
plt.rcParams["font.serif"] = ["Times New Roman", "DejaVu Serif"]

RESULTS = Path(__file__).resolve().parents[1] / "experiments" / "results" / "extended_analysis.json"
OUT = Path(__file__).resolve().parent
C_NONE, C_FULL, C_ACA, C_CASC = "#2ca02c", "#1f77b4", "#ff7f0e", "#9467bd"


def label_bars(ax, bars, fmt, size=5.6):
    for b in bars:
        ax.annotate(fmt.format(b.get_height()), (b.get_x() + b.get_width() / 2, b.get_height()),
                    ha="center", va="bottom", fontsize=size, fontweight="bold", xytext=(0, 1.2), textcoords="offset points")


def fig8(d):
    conds = [("none", "No context", C_NONE), ("full", "Full context", C_FULL), ("aca_heavy", "ACA", C_ACA)]
    metrics = [("accuracy", "Accuracy"), ("f1_macro", "F1 (macro)"), ("f1_weighted", "F1 (weighted)")]
    fig, ax = plt.subplots(figsize=(3.37, 2.05))
    w = 0.26
    x = np.arange(len(metrics))
    for i, (key, name, col) in enumerate(conds):
        vals = [d["conditions"][key][m] for m, _ in metrics]
        bars = ax.bar(x + (i - 1) * w, vals, w, label=name, color=col, edgecolor="#333333", linewidth=0.3)
        label_bars(ax, bars, "{:.3f}")
    ax.set_xticks(x)
    ax.set_xticklabels([n for _, n in metrics], fontsize=6.8)
    ax.set_ylabel("Score", fontsize=7)
    ax.tick_params(axis="y", labelsize=6.2)
    ax.set_ylim(0, 0.9)
    ax.grid(axis="y", linestyle="--", linewidth=0.3, alpha=0.5)
    ax.set_axisbelow(True)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, 1.2), ncol=3, frameon=True, fontsize=6.2, handlelength=1.2, columnspacing=1.0)
    fig.tight_layout(pad=0.3)
    fig.savefig(OUT / "figure8_context_quality_final.png", dpi=450, facecolor="white")
    plt.close(fig)


def fig9(d):
    r = d["routing"]
    fig, axes = plt.subplots(1, 2, figsize=(3.37, 2.0), gridspec_kw={"width_ratios": [0.8, 1.35]})
    ax = axes[0]
    names = ["Full\ncontext", "ACA"]
    vals = [r["mean_context_words_full"], r["mean_context_words_aca"]]
    bars = ax.bar(names, vals, color=[C_FULL, C_ACA], edgecolor="#333333", linewidth=0.3, width=0.62)
    label_bars(ax, bars, "{:.1f}")
    ax.set_ylabel("Avg. context size (words)", fontsize=6.6)
    ax.set_title("Context sent to classifier", fontsize=6.8)
    ax.set_ylim(0, 62)
    ax.tick_params(labelsize=6)
    ax = axes[1]
    c = d["conditions"]
    names = ["No\ncontext", "Full\ncontext", "ACA", "ACA\ncascade"]
    vals = [c[k]["latency_ms"]["mean"] for k in ["none", "full", "aca_heavy", "aca_cascade"]]
    bars = ax.bar(names, vals, color=[C_NONE, C_FULL, C_ACA, C_CASC], edgecolor="#333333", linewidth=0.3, width=0.66)
    label_bars(ax, bars, "{:.1f}")
    ax.set_ylabel("Mean latency (ms)", fontsize=6.6)
    ax.set_title("End-to-end latency (CPU)", fontsize=6.8)
    ax.set_ylim(0, 720)
    ax.tick_params(labelsize=6)
    for a in axes:
        a.grid(axis="y", linestyle="--", linewidth=0.3, alpha=0.5)
        a.set_axisbelow(True)
    fig.tight_layout(pad=0.3)
    fig.savefig(OUT / "figure9_context_efficiency_final.png", dpi=450, facecolor="white")
    plt.close(fig)


def fig10(d):
    labels = d["labels"]
    fig, axes = plt.subplots(2, 1, figsize=(3.37, 3.3))
    for ax, key, title in zip(axes, ["full", "aca_heavy"], ["Full-context strategy", "Adaptive Context Activation (ACA)"]):
        cm = np.array(d["conditions"][key]["confusion_matrix"])
        im = ax.imshow(cm, cmap="Blues", aspect="auto")
        ax.set_xticks(range(len(labels)))
        ax.set_yticks(range(len(labels)))
        ax.set_xticklabels(labels, rotation=30, ha="right", fontsize=5.6)
        ax.set_yticklabels(labels, fontsize=5.6)
        ax.set_ylabel("True", fontsize=6)
        ax.set_title(title, fontsize=6.6, pad=2)
        mx = cm.max() if cm.max() > 0 else 1
        for i in range(cm.shape[0]):
            for j in range(cm.shape[1]):
                ax.text(j, i, str(cm[i, j]), ha="center", va="center", fontsize=5.2,
                        color="white" if cm[i, j] > mx / 2 else "black")
        cb = fig.colorbar(im, ax=ax, fraction=0.035, pad=0.02)
        cb.ax.tick_params(labelsize=5)
    axes[1].set_xlabel("Predicted", fontsize=6)
    fig.tight_layout(pad=0.3, h_pad=0.6)
    fig.savefig(OUT / "figure10_context_confusion_final.png", dpi=450, facecolor="white")
    plt.close(fig)


def main():
    d = json.loads(RESULTS.read_text(encoding="utf-8"))
    fig8(d)
    fig9(d)
    fig10(d)
    print("saved figure8/9/10 *_final.png")


if __name__ == "__main__":
    main()

