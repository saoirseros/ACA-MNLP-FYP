import { useContext, useEffect } from 'react'
import {
    ResponsiveContainer,
    AreaChart, Area,
    PieChart, Pie, Cell,
    BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, LabelList,
} from 'recharts'
import { ChatContext } from '../../context/ChatContext'
import assets from '../assets/assets'
import {
    EMOTION_COLORS, TIER_COLORS, SENTIMENT_COLORS, CONTEXT_COLORS,
    AXIS_STYLE_LARGE, TOOLTIP_STYLE_LARGE,
} from '../lib/dashboardTheme'

const GRID_STROKE = '#ffffff1f'

const Panel = ({ title, subtitle, children, className = '' }) => (
    <section className={`rounded-xl border border-aca-border bg-aca-surface/85 p-5 ${className}`}>
        <h3 className='text-base font-medium'>{title}</h3>
        {subtitle && <p className='text-xs text-gray-400 mt-0.5'>{subtitle}</p>}
        <div className='mt-3'>{children}</div>
    </section>
)

const StatCard = ({ label, value, hint }) => (
    <div className='rounded-xl border border-aca-border bg-aca-surface-2/80 px-5 py-4'>
        <p className='text-xs uppercase tracking-wider text-gray-400'>{label}</p>
        <p className='text-2xl font-semibold mt-1 capitalize'>{value}</p>
        {hint && <p className='text-xs text-gray-400 mt-0.5'>{hint}</p>}
    </div>
)

// Sentiment trend point: green for positive messages, red for negative.
const SentimentDot = ({ cx, cy, payload }) => {
    if (cx == null || cy == null) return null
    return <circle cx={cx} cy={cy} r={5} fill={SENTIMENT_COLORS[payload.label] || '#9ca3af'} stroke='#050505' strokeWidth={1.5} />
}

const percent = (value) => (typeof value === 'number' ? `${Math.round(value * 100)}%` : 'n/a')
const ms = (value) => (typeof value === 'number' ? `${Math.round(value)}ms` : 'n/a')

/**
 * Full-screen, enlarged version of the sidebar analytics dashboard. It
 * draws exactly the same live data (passed in from useDashboardData) with
 * bigger charts, a stat summary row and extra views (sentiment split,
 * emotion bars, context-level bars).
 */
const ExpandedDashboard = ({ data, onClose }) => {
    const { selectedUser } = useContext(ChatContext)
    const {
        conversationAnalytics: analytics,
        summaryTimeline, sentimentTrendData, sentimentSplitData, emotionDistributionData,
        toxicityTimelineData, modelTierData, contextLevelData, latencyByTier, keywords,
    } = data

    useEffect(() => {
        const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', onKeyDown)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            document.body.style.overflow = previousOverflow
        }
    }, [onClose])

    const emotionBarData = [...emotionDistributionData].sort((a, b) => b.value - a.value)
    const hasTierData = modelTierData.some((d) => d.value > 0)

    return (
        <div
            role='dialog'
            aria-modal='true'
            aria-label='ACA Chat analytics dashboard'
            className='fixed inset-0 z-50 bg-aca-bg text-white overflow-y-auto'
        >
            <div
                aria-hidden='true'
                className='fixed inset-0 bg-cover bg-center opacity-60 pointer-events-none'
                style={{ backgroundImage: `url("${assets.bgStreaks}")` }}
            />

            <div className='relative max-w-[1600px] mx-auto px-6 py-6'>
                {/* ------- header ------- */}
                <div className='flex items-center justify-between gap-4 mb-6'>
                    <div>
                        <h2 className='text-2xl font-semibold tracking-wide'>
                            ACA <span className='text-aca-red-bright'>Chat</span> · Analytics
                        </h2>
                        <p className='text-sm text-gray-400 mt-0.5'>
                            Conversation with {selectedUser?.fullName || 'this user'} · {analytics.messagesAnalyzed} analyzed messages
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label='Close expanded dashboard'
                        title='Close (Esc)'
                        className='flex items-center gap-2 rounded-full border border-aca-border bg-aca-surface-2 hover:border-aca-red hover:bg-aca-red/15 px-4 py-2 text-sm transition'
                    >
                        <span className='text-lg leading-none'>×</span> Close
                    </button>
                </div>

                {/* ------- stat row ------- */}
                <div className='grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6'>
                    <StatCard label='Messages analyzed' value={analytics.messagesAnalyzed} />
                    <StatCard
                        label='Overall sentiment'
                        value={analytics.sentiment.overall || '-'}
                        hint={`Avg. confidence ${percent(analytics.sentiment.averageConfidence)}`}
                    />
                    <StatCard
                        label='Dominant emotion'
                        value={analytics.emotion.dominant || '-'}
                        hint={`Avg. confidence ${percent(analytics.emotion.averageConfidence)}`}
                    />
                    <StatCard
                        label='Toxic messages'
                        value={analytics.toxicity.toxicMessageCount}
                        hint={`${percent(analytics.toxicity.frequency)} of messages`}
                    />
                    <StatCard
                        label='Avg. context score'
                        value={typeof analytics.context.averageScore === 'number' ? analytics.context.averageScore.toFixed(2) : 'n/a'}
                        hint={`${(analytics.context.averageSelectedMessages ?? 0).toFixed(1)} history msgs used on avg.`}
                    />
                    <StatCard
                        label='Avg. latency'
                        value={ms(analytics.processing.averageTotalLatencyMs)}
                        hint='Per message, end to end'
                    />
                </div>

                <div className='grid grid-cols-1 xl:grid-cols-12 gap-4'>
                    {/* ------- sentiment trend ------- */}
                    <Panel
                        title='Sentiment trend'
                        subtitle='Signed confidence per message (+positive / -negative)'
                        className='xl:col-span-8'
                    >
                        <ResponsiveContainer width='100%' height={340}>
                            <AreaChart data={sentimentTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
                                <defs>
                                    <linearGradient id='trendFill' x1='0' y1='0' x2='0' y2='1'>
                                        <stop offset='0%' stopColor='#ff3b4e' stopOpacity={0.45} />
                                        <stop offset='100%' stopColor='#ff3b4e' stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray='3 3' stroke={GRID_STROKE} />
                                <XAxis dataKey='index' tick={AXIS_STYLE_LARGE} label={{ value: 'Message #', position: 'insideBottom', offset: -2, fill: '#9ca3af', fontSize: 11 }} />
                                <YAxis domain={[-1, 1]} tick={AXIS_STYLE_LARGE} />
                                <ReferenceLine y={0} stroke='#ffffff55' />
                                <Tooltip
                                    contentStyle={TOOLTIP_STYLE_LARGE}
                                    formatter={(value, _name, props) => [`${props.payload.label} (${value.toFixed(2)})`, 'sentiment']}
                                    labelFormatter={(label) => `Message ${label}`}
                                />
                                <Area
                                    type='monotone' dataKey='score' baseValue={0}
                                    stroke='#ff3b4e' strokeWidth={3} fill='url(#trendFill)'
                                    dot={<SentimentDot />} activeDot={{ r: 7 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Panel>

                    {/* ------- sentiment split ------- */}
                    <Panel title='Sentiment split' subtitle='Share of positive vs negative messages' className='xl:col-span-4'>
                        <ResponsiveContainer width='100%' height={340}>
                            <PieChart>
                                <Pie
                                    data={sentimentSplitData} dataKey='value' nameKey='name'
                                    cx='50%' cy='50%' innerRadius={70} outerRadius={110} paddingAngle={3}
                                    label={{ fontSize: 13, fill: '#f4f4f5' }}
                                >
                                    {sentimentSplitData.map((entry) => (
                                        <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name]} stroke='#050505' />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={TOOLTIP_STYLE_LARGE} />
                                <Legend wrapperStyle={{ fontSize: 13 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </Panel>

                    {/* ------- emotion pie ------- */}
                    <Panel
                        title='Emotion distribution'
                        subtitle={`Dominant: ${analytics.emotion.dominant || '-'}`}
                        className='xl:col-span-6'
                    >
                        <ResponsiveContainer width='100%' height={340}>
                            <PieChart>
                                <Pie
                                    data={emotionDistributionData} dataKey='value' nameKey='name'
                                    cx='50%' cy='50%' outerRadius={115} paddingAngle={2}
                                    label={{ fontSize: 13, fill: '#f4f4f5' }}
                                >
                                    {emotionDistributionData.map((entry) => (
                                        <Cell key={entry.name} fill={EMOTION_COLORS[entry.name] || '#9ca3af'} stroke='#050505' />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={TOOLTIP_STYLE_LARGE} />
                                <Legend wrapperStyle={{ fontSize: 13 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </Panel>

                    {/* ------- emotion bars ------- */}
                    <Panel title='Emotion breakdown' subtitle='Messages per detected emotion' className='xl:col-span-6'>
                        <ResponsiveContainer width='100%' height={340}>
                            <BarChart data={emotionBarData} layout='vertical' margin={{ top: 4, right: 30, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray='3 3' stroke={GRID_STROKE} />
                                <XAxis type='number' tick={AXIS_STYLE_LARGE} allowDecimals={false} />
                                <YAxis type='category' dataKey='name' tick={AXIS_STYLE_LARGE} width={80} />
                                <Tooltip contentStyle={TOOLTIP_STYLE_LARGE} cursor={{ fill: '#ffffff10' }} />
                                <Bar dataKey='value' radius={[0, 6, 6, 0]}>
                                    {emotionBarData.map((entry) => (
                                        <Cell key={entry.name} fill={EMOTION_COLORS[entry.name] || '#9ca3af'} />
                                    ))}
                                    <LabelList dataKey='value' position='right' fill='#f4f4f5' fontSize={12} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </Panel>

                    {/* ------- toxicity ------- */}
                    {toxicityTimelineData.length > 0 && (
                        <Panel
                            title='Toxicity incidents'
                            subtitle={`${analytics.toxicity.toxicMessageCount} flagged of ${analytics.messagesAnalyzed}`}
                            className='xl:col-span-6'
                        >
                            <ResponsiveContainer width='100%' height={280}>
                                <BarChart data={toxicityTimelineData} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray='3 3' stroke={GRID_STROKE} />
                                    <XAxis dataKey='index' tick={AXIS_STYLE_LARGE} />
                                    <YAxis domain={[0, 1]} ticks={[0, 1]} tick={AXIS_STYLE_LARGE} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE_LARGE} cursor={{ fill: '#ffffff10' }} />
                                    <Bar dataKey='toxic' fill='#ef4444' radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Panel>
                    )}

                    {/* ------- context levels ------- */}
                    <Panel
                        title='Context processing'
                        subtitle='How much conversation history each message needed (ACA)'
                        className={toxicityTimelineData.length > 0 ? 'xl:col-span-6' : 'xl:col-span-12'}
                    >
                        <ResponsiveContainer width='100%' height={280}>
                            <BarChart data={contextLevelData} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray='3 3' stroke={GRID_STROKE} />
                                <XAxis dataKey='name' tick={AXIS_STYLE_LARGE} />
                                <YAxis tick={AXIS_STYLE_LARGE} allowDecimals={false} />
                                <Tooltip contentStyle={TOOLTIP_STYLE_LARGE} cursor={{ fill: '#ffffff10' }} />
                                <Bar dataKey='value' radius={[6, 6, 0, 0]}>
                                    {contextLevelData.map((entry) => (
                                        <Cell key={entry.name} fill={CONTEXT_COLORS[entry.name]} />
                                    ))}
                                    <LabelList dataKey='value' position='top' fill='#f4f4f5' fontSize={12} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </Panel>

                    {/* ------- model routing ------- */}
                    {hasTierData && (
                        <Panel
                            title='Model routing'
                            subtitle={`Avg. latency - lightweight: ${ms(latencyByTier?.lightweight)} · heavyweight: ${ms(latencyByTier?.heavyweight)}`}
                            className='xl:col-span-6'
                        >
                            <ResponsiveContainer width='100%' height={220}>
                                <BarChart data={modelTierData} layout='vertical' margin={{ top: 4, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray='3 3' stroke={GRID_STROKE} />
                                    <XAxis type='number' tick={AXIS_STYLE_LARGE} allowDecimals={false} />
                                    <YAxis type='category' dataKey='name' tick={AXIS_STYLE_LARGE} width={95} />
                                    <Tooltip contentStyle={TOOLTIP_STYLE_LARGE} cursor={{ fill: '#ffffff10' }} />
                                    <Bar dataKey='value' radius={[0, 6, 6, 0]}>
                                        {modelTierData.map((entry) => (
                                            <Cell key={entry.name} fill={TIER_COLORS[entry.name]} />
                                        ))}
                                        <LabelList dataKey='value' position='right' fill='#f4f4f5' fontSize={12} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </Panel>
                    )}

                    {/* ------- topic keywords ------- */}
                    <Panel
                        title='Topic keywords'
                        subtitle={analytics.topic?.label ? `Top topic: ${analytics.topic.label}` : undefined}
                        className={hasTierData ? 'xl:col-span-6' : 'xl:col-span-12'}
                    >
                        <div className='flex flex-wrap gap-2'>
                            {keywords.length > 0 ? keywords.map((kw, i) => (
                                <span
                                    key={kw}
                                    className={`rounded-full border px-4 py-1.5 ${i === 0 ? 'text-base bg-aca-red/40 border-aca-red text-white' : 'text-sm bg-aca-red/15 border-aca-red/40 text-red-100'}`}
                                >
                                    {kw}
                                </span>
                            )) : <span className='text-sm opacity-60'>No clear topic yet - keep chatting.</span>}
                        </div>
                    </Panel>

                    {/* ------- summary + insight ------- */}
                    <Panel title='Summary timeline' subtitle='Rolling recap as the conversation evolves (this session)' className='xl:col-span-8'>
                        {summaryTimeline.length > 0 ? (
                            <div className='flex flex-col gap-3'>
                                {summaryTimeline.map((entry, i) => (
                                    <div key={i} className='border-l-2 border-aca-red/60 pl-3'>
                                        <p className='text-xs text-gray-400'>{entry.at}</p>
                                        <p className='text-sm opacity-90'>{entry.text}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className='text-sm opacity-60'>No summary available yet.</p>
                        )}
                    </Panel>

                    <Panel title='Insight' className='xl:col-span-4'>
                        <p className='text-sm opacity-90 leading-relaxed'>{analytics.insight}</p>
                    </Panel>
                </div>
            </div>
        </div>
    )
}

export default ExpandedDashboard
