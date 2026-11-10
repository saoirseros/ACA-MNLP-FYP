// Colours and chart styling shared by the sidebar dashboard and the
// expanded full-screen dashboard so both always look consistent.

// Distinct colors per label, reused across charts so e.g. "positive" is
// always the same color in every widget.
export const EMOTION_COLORS = {
    joy: '#facc15', sadness: '#60a5fa', anger: '#ef4444',
    fear: '#c084fc', surprise: '#fb923c', disgust: '#4ade80', neutral: '#9ca3af',
}
export const TIER_COLORS = { lightweight: '#34d399', heavyweight: '#ff3b4e' }
export const ROUTING_COLORS = { standalone: '#34d399', 'with history': '#ff3b4e' }
export const SENTIMENT_COLORS = { positive: '#4ade80', negative: '#ef4444' }
export const CONTEXT_COLORS = { low: '#9ca3af', medium: '#fb923c', high: '#ff3b4e' }

export const AXIS_STYLE = { fontSize: 10, fill: '#c8c8c8' }
export const AXIS_STYLE_LARGE = { fontSize: 12, fill: '#d4d4d8' }
export const TOOLTIP_STYLE = { background: '#170a0c', border: '1px solid #3a1218', fontSize: 11 }
export const TOOLTIP_STYLE_LARGE = { background: '#170a0c', border: '1px solid #3a1218', fontSize: 13, borderRadius: 8 }
