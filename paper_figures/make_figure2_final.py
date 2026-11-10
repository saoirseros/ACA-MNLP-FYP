"""
Figure 2 (final): Adaptive Context Activation decision pipeline.

Every value shown is taken from the implemented system (nlp-service/app/
context/): weights 0.35/0.15/0.30/0.20, thresholds 0.35/0.65, selection
score 0.7*similarity + 0.3*recency, up to 0/2/5 selected messages,
MiniLM-L6-v2 embeddings, uncertainty from the lightweight sentiment
classifier. The worked example is the real Algorithm Showcase trace for
"No, I meant the other results." (contributions 0.350 + 0.000 + 0.155 +
0.000 = 0.505 -> medium -> heavyweight tier).
"""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

W, H = 3.21, 4.50
FONT = "DejaVu Sans"
plt.rcParams["font.family"] = FONT


def box(ax, x, y, w, h, fc, ec, lw=0.7, r=0.04):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={r}",
                                facecolor=fc, edgecolor=ec, linewidth=lw, zorder=2))


def txt(ax, x, y, s, size=5.6, weight="normal", color="#1f2937", ha="left", va="center", style="normal"):
    ax.text(x, y, s, fontsize=size, fontweight=weight, color=color, ha=ha, va=va, fontstyle=style, zorder=4)


def arrow(ax, x, y0, y1):
    ax.annotate("", xy=(x, y1), xytext=(x, y0),
                arrowprops=dict(arrowstyle="-|>", color="#374151", lw=0.7, mutation_scale=5), zorder=3)


def main():
    fig = plt.figure(figsize=(W, H))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.axis("off")

    m = 0.06
    full_w = W - 2 * m
    y = H - 0.06

    # banner
    h = 0.26
    y -= h
    box(ax, m, y, full_w, h, "#ede9fe", "#7c3aed", lw=0.9)
    txt(ax, W / 2, y + h * 0.66, "ADAPTIVE CONTEXT ACTIVATION (ACA) ENGINE", 6.4, "bold", "#4c1d95", "center")
    txt(ax, W / 2, y + h * 0.27, "decide how much history each message needs", 5.4, "normal", "#4c1d95", "center")
    gap = 0.11
    y -= gap
    arrow(ax, W / 2, y + gap, y)

    # 1 input
    h = 0.50
    y -= h
    box(ax, m, y, full_w, h, "#e0f2fe", "#0284c7")
    txt(ax, m + 0.07, y + h - 0.10, "1  Input", 6.2, "bold", "#075985")
    txt(ax, m + 0.07, y + h - 0.23, "Current: \u201cNo, I meant the other results.\u201d", 5.5)
    txt(ax, m + 0.07, y + h - 0.35, "History (up to 8 prior turns): \u201cI finally got the results.\u201d,", 5.3, color="#374151")
    txt(ax, m + 0.07, y + h - 0.45, "\u201cThat\u2019s great!\u201d", 5.3, color="#374151")
    y -= gap
    arrow(ax, W / 2, y + gap, y)

    # 2 signals
    h = 0.74
    y -= h
    box(ax, m, y, full_w, h, "#fef3c7", "#d97706")
    txt(ax, m + 0.07, y + h - 0.09, "2  Signal extraction (each normalised to [0, 1])", 6.2, "bold", "#92400e")
    sig = [
        ("Reference", "pronouns / back-\nreferences (regex)", "R = 1.00", "#dcfce7", "#16a34a"),
        ("Brevity", "short message \u2192\nhigher score", "B = 0.00", "#fef9c3", "#ca8a04"),
        ("Similarity", "max cosine to last\n8 turns (MiniLM-L6)", "S = 0.52", "#fce7f3", "#db2777"),
        ("Uncertainty", "1 \u2212 |p \u2212 0.5|/0.1\n(light. sentiment p)", "U = 0.00", "#dbeafe", "#2563eb"),
    ]
    bw = (full_w - 0.14 - 3 * 0.05) / 4
    for i, (t, d, v, fc, ec) in enumerate(sig):
        bx = m + 0.07 + i * (bw + 0.05)
        box(ax, bx, y + 0.06, bw, h - 0.26, fc, ec, lw=0.6, r=0.03)
        txt(ax, bx + bw / 2, y + h - 0.27, t, 5.7, "bold", "#111827", "center")
        txt(ax, bx + bw / 2, y + h - 0.43, d, 4.7, "normal", "#374151", "center")
        txt(ax, bx + bw / 2, y + 0.115, v, 5.7, "bold", ec, "center")
    y -= gap
    arrow(ax, W / 2, y + gap, y)

    # 3 scoring
    h = 0.40
    y -= h
    box(ax, m, y, full_w, h, "#ede9fe", "#7c3aed")
    txt(ax, m + 0.07, y + h - 0.09, "3  Context-requirement score", 6.2, "bold", "#4c1d95")
    txt(ax, W / 2, y + 0.205, "C = 0.35 R + 0.15 B + 0.30 S + 0.20 U", 6.6, "bold", "#111827", "center")
    txt(ax, W / 2, y + 0.075, "= 0.350 + 0.000 + 0.155 + 0.000 = 0.505", 5.8, "normal", "#374151", "center")
    y -= gap
    arrow(ax, W / 2, y + gap, y)

    # 4 level decision
    h = 0.46
    y -= h
    box(ax, m, y, full_w, h, "#ecfeff", "#0891b2")
    txt(ax, m + 0.07, y + h - 0.09, "4  Context level (thresholds 0.35 / 0.65)", 6.2, "bold", "#155e75")
    lv = [("LOW", "C < 0.35", "0 messages", "#dcfce7", "#16a34a", False),
          ("MEDIUM", "0.35 \u2264 C < 0.65", "up to 2 messages", "#fef08a", "#ca8a04", True),
          ("HIGH", "C \u2265 0.65", "up to 5 messages", "#fee2e2", "#dc2626", False)]
    bw = (full_w - 0.14 - 2 * 0.05) / 3
    for i, (t, c, k, fc, ec, sel) in enumerate(lv):
        bx = m + 0.07 + i * (bw + 0.05)
        box(ax, bx, y + 0.05, bw, h - 0.22, fc, ec, lw=1.3 if sel else 0.6, r=0.03)
        txt(ax, bx + bw / 2, y + h - 0.285, t, 5.7, "bold", "#111827", "center")
        txt(ax, bx + bw / 2, y + h - 0.235 - 0.17 + 0.03, c, 4.7, "normal", "#374151", "center")
    y -= gap
    arrow(ax, W / 2, y + gap, y)

    # 5 selection
    h = 0.50
    y -= h
    box(ax, m, y, full_w, h, "#dcfce7", "#16a34a")
    txt(ax, m + 0.07, y + h - 0.09, "5  Context selection and composition", 6.2, "bold", "#166534")
    steps = ["Rank history by\n0.7\u00b7similarity +\n0.3\u00b7recency", "Keep top-k for the\nlevel; restore\nchronological order",
             "Effective text =\nselected context\n+ current message"]
    bw = (full_w - 0.14 - 2 * 0.05) / 3
    for i, s in enumerate(steps):
        bx = m + 0.07 + i * (bw + 0.05)
        box(ax, bx, y + 0.05, bw, h - 0.21, "#f0fdf4", "#4ade80", lw=0.6, r=0.03)
        txt(ax, bx + bw / 2, y + 0.05 + (h - 0.21) / 2, s, 4.7, "normal", "#14532d", "center")
    y -= gap
    arrow(ax, W / 2, y + gap, y)

    # 6 routing
    h = y - 0.06
    y = 0.06
    box(ax, m, y, full_w, h, "#f3e8ff", "#9333ea")
    txt(ax, m + 0.07, y + h - 0.09, "6  Model-tier routing and output", 6.2, "bold", "#6b21a8")
    bw = (full_w - 0.14 - 0.06) / 2
    by, bh = y + 0.25, h - 0.43
    box(ax, m + 0.07, by, bw, bh, "#f3f4f6", "#9ca3af", lw=0.6, r=0.03)
    txt(ax, m + 0.07 + bw / 2, by + bh - 0.09, "LOW \u2192 lightweight", 5.3, "bold", "#4b5563", "center")
    txt(ax, m + 0.07 + bw / 2, by + 0.14, "TF-IDF +\nLogistic Regression", 4.8, "normal", "#6b7280", "center")
    bx = m + 0.07 + bw + 0.06
    box(ax, bx, by, bw, bh, "#ede9fe", "#7c3aed", lw=1.3, r=0.03)
    txt(ax, bx + bw / 2, by + bh - 0.09, "MEDIUM/HIGH \u2192 heavy", 5.0, "bold", "#4c1d95", "center")
    txt(ax, bx + bw / 2, by + 0.14, "DistilBERT \u00b7 DistilRoBERTa \u00b7\ntoxic-BERT  (\u2190 used here)", 4.8, "normal", "#4c1d95", "center")
    txt(ax, W / 2, y + 0.12, "Output: sentiment \u00b7 emotion \u00b7 toxicity \u00b7 context level \u00b7 tier \u00b7 latency", 5.0, "normal", "#374151", "center")

    fig.savefig("figure2_aca_pipeline_final.png", dpi=450, facecolor="white")
    print("saved figure2_aca_pipeline_final.png")


if __name__ == "__main__":
    main()



