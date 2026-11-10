import { useEffect, useRef, useState } from 'react'
import {
    ResponsiveContainer,
    LineChart, Line,
    PieChart, Pie, Cell,
    BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { useDashboardData } from '../lib/useDashboardData'
import { EMOTION_COLORS, ROUTING_COLORS, AXIS_STYLE, TOOLTIP_STYLE } from '../lib/dashboardTheme'
import ExpandedDashboard from './ExpandedDashboard'

// A small labeled card wrapper so every widget below shares the same look.
const Card = ({ title, subtitle, children }) => (
    <div className='mb-4'>
        <p className='font-medium mb-0.5'>{title}</p>
        {subtitle && <p className='text-gray-400 text-[10px] mb-1'>{subtitle}</p>}
        {children}
    </div>
)

// Dashboard title row. The three-dot button opens a small menu whose
// "Expand" action shows the full-screen dashboard (only offered when
// there is data to expand).
const DashboardHeader = ({ onExpand }) => {
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef(null)

    useEffect(() => {
        if (!menuOpen) return
        const closeOnOutsideClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
        }
        const closeOnEscape = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
        document.addEventListener('mousedown', closeOnOutsideClick)
        document.addEventListener('keydown', closeOnEscape)
        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick)
            document.removeEventListener('keydown', closeOnEscape)
        }
    }, [menuOpen])

    return (
        <div className='flex items-center justify-between mb-3'>
            <p className='font-semibold text-sm tracking-wide'>ACA <span className='text-aca-red-bright'>Chat</span> · Analytics</p>
            {onExpand && (
                <div ref={menuRef} className='relative'>
                    <button
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-label='Dashboard options'
                        aria-haspopup='menu'
                        aria-expanded={menuOpen}
                        className='flex flex-col items-center justify-center gap-[3px] w-7 h-7 rounded-full hover:bg-white/10 transition'
                    >
                        <span className='w-[3px] h-[3px] rounded-full bg-white'></span>
                        <span className='w-[3px] h-[3px] rounded-full bg-white'></span>
                        <span className='w-[3px] h-[3px] rounded-full bg-white'></span>
                    </button>
                    {menuOpen && (
                        <div role='menu' className='absolute right-0 top-full mt-1 z-20 w-32 rounded-md border border-aca-border bg-aca-surface-2 shadow-lg py-1'>
                            <button
                                role='menuitem'
                                onClick={() => { setMenuOpen(false); onExpand() }}
                                className='w-full text-left px-3 py-2 text-xs hover:bg-aca-red/20 hover:text-aca-red-bright transition'
                            >
                                ⤢ Expand
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

/**
 * Real Analytics Dashboard: every chart here is driven by
 * conversationAnalytics (server-aggregated from stored MessageAnalysis
 * documents) and the live messages/messageAnalyses already in
 * ChatContext (see useDashboardData) - nothing here is mocked or
 * hardcoded. Mounted with `key={selectedUser._id}` by the parent so its
 * local state (summary timeline, expanded view) resets cleanly when the
 * conversation changes.
 */
const AnalyticsDashboard = () => {
    const data = useDashboardData()
    const [expanded, setExpanded] = useState(false)
    const {
        conversationAnalytics, hasData, summaryTimeline, sentimentTrendData, emotionDistributionData,
        toxicityTimelineData, contextRoutingData, contextLatency, keywords,
    } = data

    if (!hasData) {
        return (
            <div className='px-5 text-xs pb-24'>
                <DashboardHeader />
                <p className='opacity-70'>No analyzed messages yet - send a few messages to populate the dashboard.</p>
            </div>
        )
    }

    return (
        <div className='px-5 text-xs pb-24'>
            <DashboardHeader onExpand={() => setExpanded(true)} />

            <Card title='Sentiment trend' subtitle='Signed confidence per message (+positive / -negative)'>
                <ResponsiveContainer width='100%' height={110}>
                    <LineChart data={sentimentTrendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray='3 3' stroke='#ffffff20' />
                        <XAxis dataKey='index' tick={AXIS_STYLE} />
                        <YAxis domain={[-1, 1]} tick={AXIS_STYLE} />
                        <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            formatter={(value, _name, props) => [`${props.payload.label} (${value.toFixed(2)})`, 'sentiment']}
                        />
                        <Line type='monotone' dataKey='score' stroke='#ff3b4e' strokeWidth={2} dot={{ r: 2, fill: '#ff3b4e' }} />
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
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
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
                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                            <Bar dataKey='toxic' fill='#ef4444' radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            )}

            <Card title='Topic keywords' subtitle={conversationAnalytics.topic?.label ? `Top topic: ${conversationAnalytics.topic.label}` : undefined}>
                <div className='flex flex-wrap gap-1'>
                    {keywords.length > 0 ? keywords.map((kw) => (
                        <span key={kw} className='text-[10px] px-2 py-0.5 rounded-full bg-aca-red/25 text-red-100 border border-aca-red/40'>{kw}</span>
                    )) : <span className='opacity-60'>No clear topic yet - keep chatting.</span>}
                </div>
            </Card>

            {contextRoutingData.some((d) => d.value > 0) && (
                <Card title='Context routing (ACA)' subtitle='All messages use the Transformer models; ACA decides whether history is added'>
                    <ResponsiveContainer width='100%' height={110}>
                        <BarChart data={contextRoutingData} layout='vertical' margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray='3 3' stroke='#ffffff20' />
                            <XAxis type='number' tick={AXIS_STYLE} allowDecimals={false} />
                            <YAxis type='category' dataKey='name' tick={AXIS_STYLE} width={70} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                            <Bar dataKey='value' radius={[0, 3, 3, 0]}>
                                {contextRoutingData.map((entry) => (
                                    <Cell key={entry.name} fill={ROUTING_COLORS[entry.name]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    {contextLatency && (contextLatency.standalone != null || contextLatency.withHistory != null) && (
                        <p className='opacity-80 mt-1'>
                            Avg. latency - standalone: {contextLatency.standalone != null ? `${Math.round(contextLatency.standalone)}ms` : 'n/a'}
                            {' · '}with history: {contextLatency.withHistory != null ? `${Math.round(contextLatency.withHistory)}ms` : 'n/a'}
                        </p>
                    )}
                </Card>
            )}

            {summaryTimeline.length > 0 && (
                <Card title='Summary timeline' subtitle='Rolling recap as the conversation evolves (this session)'>
                    <div className='flex flex-col gap-2'>
                        {summaryTimeline.map((entry, i) => (
                            <div key={i} className='border-l-2 border-aca-red/60 pl-2'>
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

            {expanded && <ExpandedDashboard data={data} onClose={() => setExpanded(false)} />}
        </div>
    )
}

export default AnalyticsDashboard
