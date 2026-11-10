import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ChatContext } from '../../context/ChatContext'

/**
 * Prepares every dataset the analytics dashboards draw, straight from
 * conversationAnalytics (server-aggregated from stored MessageAnalysis
 * documents) and the live messages/messageAnalyses in ChatContext -
 * nothing here is mocked. Shared by the sidebar dashboard and the
 * expanded full-screen dashboard.
 */
export const useDashboardData = () => {
    const { conversationAnalytics, messages, messageAnalyses } = useContext(ChatContext)

    // Client-side rolling history of distinct summaries seen this session
    // for this conversation - the NLP service only ever returns the
    // *current* summary, so this builds an honest "then vs now" timeline
    // out of successive real summaries rather than inventing history.
    const [summaryTimeline, setSummaryTimeline] = useState([])
    const lastSummaryRef = useRef(null)

    useEffect(() => {
        const text = conversationAnalytics?.summary?.text
        if (text && text !== lastSummaryRef.current) {
            lastSummaryRef.current = text
            setSummaryTimeline((prev) => [...prev, { text, at: new Date().toLocaleTimeString() }].slice(-5))
        }
    }, [conversationAnalytics?.summary?.text])

    const sentimentTrendData = useMemo(() => {
        const progression = conversationAnalytics?.sentiment?.progression || []
        return progression.map((point, index) => ({
            index: index + 1,
            score: point.label === 'positive' ? point.confidence : -(point.confidence ?? 0),
            label: point.label,
        }))
    }, [conversationAnalytics])

    const sentimentSplitData = useMemo(() => {
        const progression = conversationAnalytics?.sentiment?.progression || []
        const positive = progression.filter((p) => p.label === 'positive').length
        return [
            { name: 'positive', value: positive },
            { name: 'negative', value: progression.length - positive },
        ]
    }, [conversationAnalytics])

    const emotionDistributionData = useMemo(() => {
        const distribution = conversationAnalytics?.emotion?.distribution || {}
        return Object.entries(distribution).map(([name, value]) => ({ name, value }))
    }, [conversationAnalytics])

    // Toxicity-over-time is derived straight from the live per-message
    // analyses already held in ChatContext (keyed by messageId), matched
    // back to message order - no separate backend endpoint needed.
    const toxicityTimelineData = useMemo(() => {
        return messages
            .map((msg, index) => ({ msg, index, analysis: messageAnalyses[msg._id] }))
            .filter((item) => item.analysis?.toxicity)
            .map((item, i) => ({
                index: i + 1,
                toxic: item.analysis.toxicity.label === 'toxic' ? 1 : 0,
                confidence: item.analysis.toxicity.confidence,
            }))
    }, [messages, messageAnalyses])

    const contextRoutingData = useMemo(() => {
        const counts = conversationAnalytics?.contextRouting?.counts
        if (!counts) return []
        return [
            { name: 'standalone', value: counts.standalone || 0 },
            { name: 'with history', value: counts.withHistory || 0 },
        ]
    }, [conversationAnalytics])

    const contextLevelData = useMemo(() => {
        const counts = conversationAnalytics?.context?.levelCounts
        if (!counts) return []
        return ['low', 'medium', 'high'].map((name) => ({ name, value: counts[name] || 0 }))
    }, [conversationAnalytics])

    return {
        conversationAnalytics,
        hasData: Boolean(conversationAnalytics) && conversationAnalytics.messagesAnalyzed > 0,
        summaryTimeline,
        sentimentTrendData,
        sentimentSplitData,
        emotionDistributionData,
        toxicityTimelineData,
        contextRoutingData,
        contextLevelData,
        contextLatency: conversationAnalytics?.contextRouting?.averageLatencyMs,
        keywords: conversationAnalytics?.topic?.keywords || [],
    }
}
