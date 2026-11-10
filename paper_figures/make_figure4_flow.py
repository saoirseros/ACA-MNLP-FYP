"""
Figure 4 (final, flow-architecture style): the implemented Algorithm Showcase
as a step-by-step flow, in the same visual language as the earlier mock-up
(light panel, italic step labels, signal pills, score box, selected-context
chips, classifier boxes, result pills) but populated with a REAL trace of the
production /analyze/message pipeline:

  "No, I meant the other results." after ["I finally got the results.",
  "That's great!"] -> reference 1.00, brevity 0.00, similarity 0.52,
  uncertainty 0.00 -> C = 0.505 (medium) -> both turns selected
  (combined 0.51 / 0.41) -> heavyweight Transformers -> positive 100 %,
  joy 53 %, non-toxic 100 %, 781.0 ms.
"""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

W = 3.19
plt.rcParams["font.family"] = "DejaVu Sans"

INK = "#2b2b2b"
X0, X1 = 0.70, W - 0.12          # content column
CX = (X0 + X1) / 2
CW = X1 - X0


def rbox(ax, x, y, w, h, fc, ec=INK, lw=0.8, r=0.04):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={r}",
                                facecolor=fc, edgecolor=ec, linewidth=lw, zorder=2))


def txt(ax, x, y, s, size=4.6, weight="normal", color="#1a1a1a", ha="center", style="normal", ls=1.15):
    ax.text(x, y, s, fontsize=size, fontweight=weight, color=color, ha=ha, va="center",
            fontstyle=style, zorder=4, linespacing=ls)


def arrow(ax, x0, y0, x1, y1):
    ax.annotate("", xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle="-|>", color=INK, lw=0.8, mutation_scale=6, shrinkA=0, shrinkB=0), zorder=3)


def label(ax, y, s):
    txt(ax, 0.11, y, s, 3.9, "normal", "#555555", "left", "italic", 1.2)


def build(H):
    fig = plt.figure(figsize=(W, H))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.axis("off")
    frame_top = H - 0.05
    cur = frame_top

    # title
    cur -= 0.16
    txt(ax, W / 2, cur, "Left Sidebar \u2014 \u201cAlgorithm Showcase\u201d Panel (live trace)", 5.7, "bold")
    cur -= 0.17

    # 1 message
    h = 0.30
    y1 = cur - h
    rbox(ax, X0, y1, CW, h, "#dbe8fd")
    txt(ax, CX, y1 + h / 2, "\u201cNo, I meant the other results.\u201d", 5.3, "bold")
    label(ax, y1 + h / 2, "1. Live example\nmessage arrives")
    cur = y1
    arrow(ax, CX, cur, CX, cur - 0.15)
    cur -= 0.15
    cur -= 0.09
    txt(ax, CX, cur, "Adaptive Context Activation \u2014 signal scoring", 5.0, "bold")
    cur -= 0.12

    # 2 signal pills
    h = 0.27
    y2 = cur - h - 0.02
    gap = 0.05
    pw = (CW - 3 * gap) / 4
    sig = [("reference", "yes \u00b7 1.00"), ("brevity", "0.00"), ("similarity", "0.52"), ("uncertainty", "0.00")]
    for i, (a, b) in enumerate(sig):
        x = X0 + i * (pw + gap)
        rbox(ax, x, y2, pw, h, "#fde68a", "#fde68a", lw=0, r=0.09)
        txt(ax, x + pw / 2, y2 + h * 0.67, a, 4.4, "bold")
        txt(ax, x + pw / 2, y2 + h * 0.30, b, 4.4, "bold", "#7c4a03")
    label(ax, y2 + h / 2, "2. Four\ninterpretable\nsignals (Fig. 2)")
    cur = y2
    arrow(ax, CX, cur, CX, cur - 0.15)
    cur -= 0.15

    # 3 score
    h = 0.28
    y3 = cur - h
    rbox(ax, X0, y3, CW, h, "#e6d9f7")
    txt(ax, CX, y3 + h / 2, "score = 0.505  \u2192  MEDIUM context level", 5.2, "bold")
    label(ax, y3 + h / 2, "3. Weighted score\nis thresholded")
    cur = y3
    arrow(ax, CX, cur, CX, cur - 0.12)
    cur -= 0.12
    cur -= 0.09
    txt(ax, CX, cur, "Context Selector \u2014 ranks by similarity + recency", 5.0, "bold")
    cur -= 0.12

    # 4 selected chips
    h = 0.27
    y4 = cur - h - 0.02
    w1 = CW * 0.60
    w2 = CW - w1 - gap
    for x, w, a, b in [(X0, w1, "\u201cI finally got the results.\u201d", "selected \u00b7 score 0.51"),
                       (X0 + w1 + gap, w2, "\u201cThat\u2019s great!\u201d", "selected \u00b7 0.41")]:
        rbox(ax, x, y4, w, h, "#cfe8d8", "#2e7d4f", lw=0.8, r=0.04)
        txt(ax, x + w / 2, y4 + h * 0.66, a, 4.4)
        txt(ax, x + w / 2, y4 + h * 0.29, b, 4.1, "normal", "#1f5a38")
    label(ax, y4 + h / 2, "4. Selected\nhistory (green)\nis prepended to\nthe message")
    cur = y4
    arrow(ax, CX, cur, CX, cur - 0.12)
    cur -= 0.12
    cur -= 0.09
    txt(ax, CX, cur, "Effective text (history + message) \u2192 classifiers", 5.0, "bold")
    cur -= 0.12

    # 5 classifier boxes
    h = 0.31
    y5 = cur - h - 0.02
    bw = (CW - 2 * gap) / 3
    cls = [("Sentiment", "(DistilBERT)"), ("Emotion", "(DistilRoBERTa)"), ("Toxicity", "(toxic-BERT)")]
    for i, (a, b) in enumerate(cls):
        x = X0 + i * (bw + gap)
        rbox(ax, x, y5, bw, h, "#e6d9f7")
        txt(ax, x + bw / 2, y5 + h * 0.66, a, 4.8, "bold")
        txt(ax, x + bw / 2, y5 + h * 0.30, b, 4.3)
    label(ax, y5 + h / 2, "5. Medium/high\ncontext \u2192 the\nTransformer tier\n(low \u2192 TF-IDF+LR)")

    # dark effective-text box
    dh = 0.28
    y_dark = y5 - 0.26 - dh
    rbox(ax, X0, y_dark, CW, dh, "#2a2340", "#2a2340")
    txt(ax, CX, y_dark + dh / 2, "\u201cNo, I meant the other results.\u201d", 4.9, "normal", "#ffffff")
    for i, tx in enumerate([CX - 0.55, CX, CX + 0.55]):
        bx = X0 + i * (bw + gap) + bw / 2
        arrow(ax, bx, y5, tx, y_dark + dh)
    cur = y_dark

    # 6 result pills
    cur -= 0.11
    ph = 0.17
    y6 = cur - ph
    pills = [("positive (100%)", "#14532d"), ("joy (53%)", "#3730a3"), ("ctx: medium (2)", "#374151"), ("heavy \u00b7 781 ms", "#5b21b6")]
    widths = [0.030 * len(t) + 0.12 for t, _ in pills]
    total = sum(widths) + 3 * 0.05
    x = X0 + (CW - total) / 2
    for (t, col), w in zip(pills, widths):
        rbox(ax, x, y6, w, ph, col, col, lw=0, r=0.08)
        txt(ax, x + w / 2, y6 + ph / 2, t, 4.1, "bold", "#ffffff")
        x += w + 0.05
    label(ax, y6 + ph / 2, "6. Result pills\n(as in the chat\nwindow)")
    cur = y6 - 0.10

    # frame
    frame_bottom = cur
    rbox(ax, 0.04, frame_bottom, W - 0.08, frame_top - frame_bottom, "#f3f4f6", INK, lw=0.9, r=0.06)
    ax.patches[-1].set_zorder(0)
    return fig, frame_bottom


def main():
    _, bottom = build(6.0)
    plt.close("all")
    H = 6.0 - bottom + 0.05
    fig, bottom = build(H)
    fig.savefig("figure4_algorithm_showcase_final.png", dpi=450, facecolor="white")
    print("saved figure4_algorithm_showcase_final.png", round(H, 2))


if __name__ == "__main__":
    main()


