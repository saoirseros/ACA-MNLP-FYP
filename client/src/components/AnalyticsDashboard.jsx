import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
    ResponsiveContainer,
    LineChart, Line,
    PieChart, Pie, Cell,
    BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { ChatContext } from '../../context/ChatContext'

// Distinct colors per label, reused across charts so e.g. "positive" is
// always the same color in every widget.
const EMOTION_COLORS = {
    joy: '#facc15', sadness: '#60a5fa', anger: '#f87171',
    fear: '#a78bfa', surprise: '#fb923c', disgust: '#4ade80', neutral: '#9ca3af',
}
const TIER_COLORS = { lightweight: '#34d399', heavyweight: '#818cf8' }

const AXIS_STYLE = { fontSize: 10, fill: '#c8c8c8' }

// A small labeled card wrapper so every widget below shares the same look.
const Card = ({ title, subtitle, children }) => (
    <div className='mb-4'>
        <p className='font-medium mb-0.5'>{title}</p>
        {subtitle && <p className='text-gray-400 text-[10px] mb-1'>{subtitle}</p>}
        {children}
    </div>
)

/**
 * Real Analytics Dashboard: every chart here is driven by
 * conversationAnalytics (server-aggregated from stored MessageAnalysis
 * documents) and the live messages/messageAnalyses already in
 * ChatContext - nothing here is mocked or hardcoded. Mounted with
 * `key={selectedUser._id}` by the parent so its local summary-timeline
 * state resets cleanly when the conversation changes.
 */
const AnalyticsDashboard = () => {
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

    const modelTierData = useMemo(() => {
        const counts = conversationAnalytics?.modelRouting?.tierCounts
        if (!counts) return []
        return [
            { name: 'lightweight', value: counts.lightweight || 0 },
            { name: 'heavyweight', value: counts.heavyweight || 0 },
        ]
    }, [conversationAnalytics])

    const latencyByTier = conversationAnalytics?.modelRouting?.averageLatencyMsByTier
    const keywords = conversationAnalytics?.topic?.keywords || []

    if (!conversationAnalytics || conversationAnalytics.messagesAnalyzed === 0) {
        return (
            <div className='px-5 text-xs pb-24 opacity-70'>
                <p>No analyzed messages yet - send a few messages to populate the dashboard.</p>
            </div>
        )
    }

    return (
        <div className='px-5 text-xs pb-24'>
            <Card title='Sentiment trend' subtitle='Signed confidence per message (+positive / -negative)'>
                <ResponsiveContainer width='100%' height={110}>
                    <LineChart data={sentimentTrendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray='3 3' stroke='#ffffff20' />
                        <XAxis dataKey='index' tick={AXIS_STYLE} />
                        <YAxis domain={[-1, 1]} tick={AXIS_STYLE} />
                        <Tooltip
                            contentStyle={{ background: '#282142', border: 'none', fontSize: 11 }}
                            formatter={(value, _name, props) => [`${props.payload.label} (${value.toFixed(2)})`, 'sentiment']}
                        />
                        <Line type='monotone' dataKey='score' stroke='#a78bfa' strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                </ResponsiveContainer>
            </Card>

            <Card title='Emotion distribution' subtitle={`Dominant: ${conversationAnalytics.emotion.dominant || '-'}`}>
                <ResponsiveContainer width='100%' height={130}>
                    <PieChart>
                        <Pie data={emotionDistributionData} dataKey='value' nameKey='name' cx='50%' cy='50%' outerRadius={45} label={{ fontSize: 9, fill: '#e5e7eb' }}>
                            {emotionDistributionData.map((entry) => (
                                <Cell key={entry.name} fill={EMOTION_COLORS[entry.name] || '#9ca3af'} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#282142', border: 'none', fontSize: 11 }} />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                    </PieChart>
                </ResponsiveContainer>
            </Card>

            {toxicityTimelineData.length > 0 && (
                <Card title='Toxicity incidents' subtitle={`${conversationAnalytics.toxicity.toxicMessageCount} flagged of ${conversationAnalytics.messagesAnalyzed}`}>
                    <ResponsiveContainer width='100%' height={90}>
                        <BarChart data={toxicityTimelineData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray='3 3' stroke='#ffffff20' />
                            <XAxis dataKey='index' tick={AXIS_STYLE} />
                            <YAxis domain={[0, 1]} ticks={[0, 1]} tick={AXIS_STYLE} />
                            <Tooltip contentStyle={{ background: '#282142', border: 'none', fontSize: 11 }} />
                            <Bar dataKey='toxic' fill='#f87171' radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            )}

            <Card title='Topic keywords' subtitle={conversationAnalytics.topic?.label ? `Top topic: ${conversationAnalytics.topic.label}` : undefined}>
                <div className='flex flex-wrap gap-1'>
                    {keywords.length > 0 ? keywords.map((kw) => (
                        <span key={kw} className='text-[10px] px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-100'>{kw}</span>
                    )) : <span className='opacity-60'>No clear topic yet - keep chatting.</span>}
                </div>
            </Card>

            {modelTierData.some((d) => d.value > 0) && (
                <Card title='Model routing (ACA cascade)' subtitle='Lightweight (no context) vs heavyweight (context-dependent)'>
                    <ResponsiveContainer width='100%' height={110}>
                        <BarChart data={modelTierData} layout='vertical' margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray='3 3' stroke='#ffffff20' />
                            <XAxis type='number' tick={AXIS_STYLE} allowDecimals={false} />
                            <YAxis type='category' dataKey='name' tick={AXIS_STYLE} width={70} />
                            <Tooltip contentStyle={{ background: '#282142', border: 'none', fontSize: 11 }} />
                            <Bar dataKey='value' radius={[0, 3, 3, 0]}>
                                {modelTierData.map((entry) => (
                                    <Cell key={entry.name} fill={TIER_COLORS[entry.name]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    {latencyByTier && (latencyByTier.lightweight != null || latencyByTier.heavyweight != null) && (
                        <p className='opacity-80 mt-1'>
                            Avg. latency - lightweight: {latencyByTier.lightweight != null ? `${Math.round(latencyByTier.lightweight)}ms` : 'n/a'}
                            {' · '}heavyweight: {latencyByTier.heavyweight != null ? `${Math.round(latencyByTier.heavyweight)}ms` : 'n/a'}
                        </p>
                    )}
                </Card>
            )}

            {summaryTimeline.length > 0 && (
                <Card title='Summary timeline' subtitle='Rolling recap as the conversation evolves (this session)'>
                    <div className='flex flex-col gap-2'>
                        {summaryTimeline.map((entry, i) => (
                            <div key={i} className='border-l-2 border-violet-400/50 pl-2'>
                                <p className='text-gray-400 text-[10px]'>{entry.at}</p>
                                <p className='opacity-90'>{entry.text}</p>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Card title='Insight'>
                <p className='opacity-90'>{conversationAnalytics.insight}</p>
            </Card>

            <Card title='Context processing'>
                <p className='opacity-90'>
                    Low: {conversationAnalytics.context.levelCounts.low} · Medium: {conversationAnalytics.context.levelCounts.medium} · High: {conversationAnalytics.context.levelCounts.high}
                </p>
                {conversationAnalytics.processing.averageTotalLatencyMs != null && (
                    <p className='opacity-90'>
                        Avg. inference latency: {Math.round(conversationAnalytics.processing.averageTotalLatencyMs)}ms
                    </p>
                )}
            </Card>
        </div>
    )
}

export default AnalyticsDashboard
