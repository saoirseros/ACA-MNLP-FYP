import React, { useContext, useState } from 'react'
import { ChatContext } from '../../context/ChatContext'

// The two canonical example workflows, taken directly from the ACA test
// suite (nlp-service/tests/test_context.py) so they are guaranteed real,
// previously-validated behavior - not invented for the demo.
const EXAMPLES = [
    {
        key: 'no-context',
        label: 'Example 1 · No context needed → message analyzed on its own',
        text: 'Thanks!',
        history: ['The weather is nice today.', 'Yes, it is sunny.'],
        blurb: 'A reply that stands on its own. ACA should score this "low", so no history is added and the Transformers analyze the message by itself.',
    },
    {
        key: 'context-needed',
        label: 'Example 2 · Context needed → message analyzed with history',
        text: 'No, I meant the other results.',
        history: ['I finally got the results.', "That's great!"],
        blurb: 'A correction that only makes sense given the prior turns. ACA should score this "medium/high", select the relevant history, and send it along with the message to the Transformers.',
    },
]

const StageArrow = () => (
    <div className='flex justify-center text-violet-300 text-lg leading-none my-1'>↓</div>
)

const Box = ({ title, children, tone = 'default', className = '' }) => {
    const tones = {
        default: 'border-white/20 bg-white/5',
        selected: 'border-emerald-400/60 bg-emerald-500/10',
        skipped: 'border-white/10 bg-white/[0.02] opacity-50',
        lightweight: 'border-emerald-400/60 bg-emerald-500/10',
        heavyweight: 'border-indigo-400/60 bg-indigo-500/10',
        highlight: 'border-violet-400/60 bg-violet-500/10',
    }
    return (
        <div className={`rounded-lg border px-3 py-2 text-xs ${tones[tone]} ${className}`}>
            {title && <p className='font-medium mb-1'>{title}</p>}
            {children}
        </div>
    )
}

const SIGNAL_LABELS = {
    reference: 'Reference (pronouns/back-references)',
    brevity: 'Brevity (message length)',
    similarity: 'Similarity (to recent history)',
    uncertainty: 'Uncertainty (sentiment model confidence)',
}

const PipelineVisualization = ({ input, result }) => {
    const trace = result.trace
    return (
        <div className='mt-4 flex flex-col gap-0'>
            {/* Stage 1: input */}
            <Box title='1 · Input' tone='highlight'>
                <p className='opacity-90'>"{input.text}"</p>
                {input.history.length > 0 && (
                    <div className='mt-2 flex flex-col gap-1'>
                        <p className='text-gray-400'>Conversation history offered:</p>
                        {input.history.map((h, i) => <p key={i} className='opacity-70'>· {h}</p>)}
                    </div>
                )}
            </Box>
            <StageArrow />

            {/* Stage 2: signals */}
            <Box title='2 · Adaptive Context Activation - signal breakdown'>
                <div className='flex flex-col gap-1.5'>
                    {trace.signals.map((s) => (
                        <div key={s.name} className='flex items-center justify-between gap-2'>
                            <span className='text-gray-400 flex-1'>{SIGNAL_LABELS[s.name] || s.name}</span>
                            <span className='opacity-90'>{s.value.toFixed(2)} × {s.weight.toFixed(2)} = <b>{s.contribution.toFixed(3)}</b></span>
                        </div>
                    ))}
                    <hr className='border-white/10 my-1' />
                    <div className='flex items-center justify-between'>
                        <span className='text-gray-400'>Weighted sum → context score</span>
                        <b>{trace.contextScore.toFixed(3)}</b>
                    </div>
                    <div className='flex items-center justify-between'>
                        <span className='text-gray-400'>Thresholds</span>
                        <span className='opacity-90'>low &lt; {trace.thresholds.low} ≤ medium &lt; {trace.thresholds.high} ≤ high</span>
                    </div>
                </div>
            </Box>
            <StageArrow />

            {/* Stage 3: level */}
            <Box title='3 · Context level decision' tone='highlight'>
                <p>Level = <b className='uppercase'>{trace.contextLevel}</b> (score {trace.contextScore.toFixed(3)})</p>
            </Box>
            <StageArrow />

            {/* Stage 4: context selection */}
            {trace.candidateHistory.length > 0 && (
                <>
                    <Box title='4 · Context selection (similarity × 0.7 + recency × 0.3)'>
                        <div className='flex flex-col gap-1.5'>
                            {trace.candidateHistory.map((c, i) => (
                                <div key={i} className={`rounded px-2 py-1 border ${c.selected ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-white/10 opacity-50'}`}>
                                    <p className='opacity-90'>{c.selected ? '✓ selected' : '✗ skipped'} - "{c.text}"</p>
                                    <p className='text-gray-400'>similarity {c.similarity.toFixed(2)} · recency {c.recency.toFixed(2)} · combined {c.combinedScore.toFixed(2)}</p>
                                </div>
                            ))}
                        </div>
                    </Box>
                    <StageArrow />
                </>
            )}

            <Box title='5 · Effective text sent to the model'>
                <p className='opacity-90 whitespace-pre-line'>{trace.effectiveText}</p>
            </Box>
            <StageArrow />

            {/* Stage 6: model tier branch */}
            <Box title='6 · Model-tier routing'>
                <div className='flex gap-2'>
                    <Box title='Baseline (not used)' tone={trace.modelTier === 'lightweight' ? 'lightweight' : 'skipped'} className='flex-1'>
                        <p className='opacity-80'>TF-IDF + Logistic Regression</p>
                        {trace.modelTier === 'lightweight' && <p className='mt-1 font-medium'>← used</p>}
                    </Box>
                    <Box title='Transformers' tone={trace.modelTier === 'heavyweight' ? 'heavyweight' : 'skipped'} className='flex-1'>
                        <p className='opacity-80'>Transformers (DistilBERT / DistilRoBERTa / BERT)</p>
                        {trace.modelTier === 'heavyweight' && <p className='mt-1 font-medium'>← used</p>}
                    </Box>
                </div>
                <p className='text-gray-400 mt-2'>{trace.tierReason}</p>
            </Box>
            <StageArrow />

            {/* Stage 7: output */}
            <Box title='7 · Output' tone='highlight'>
                <div className='grid grid-cols-2 gap-y-1 gap-x-2'>
                    <span className='text-gray-400'>Sentiment</span>
                    <span className='capitalize'>{result.sentiment.label} ({Math.round(result.sentiment.confidence * 100)}%)</span>
                    <span className='text-gray-400'>Emotion</span>
                    <span className='capitalize'>{result.emotion.label} ({Math.round(result.emotion.confidence * 100)}%)</span>
                    <span className='text-gray-400'>Toxicity</span>
                    <span className='capitalize'>{result.toxicity.label} ({Math.round(result.toxicity.confidence * 100)}%)</span>
                    <span className='text-gray-400'>Total latency</span>
                    <span>{result.totalLatencyMs.toFixed(1)}ms</span>
                </div>
            </Box>
        </div>
    )
}

/**
 * Left-sidebar "Algorithm Showcase": runs real messages through the real
 * /analyze/message pipeline (via ChatContext.simulateMessage, which never
 * mocks or hardcodes anything) and visualizes the full Adaptive Context
 * Activation + model-tier cascade decision as a box/arrow flow.
 */
const AlgorithmShowcase = ({ onClose }) => {
    const { simulateMessage, nlpAvailable } = useContext(ChatContext)
    const [customText, setCustomText] = useState('')
    const [customHistory, setCustomHistory] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [input, setInput] = useState(null)
    const [result, setResult] = useState(null)

    const run = async (text, history) => {
        setLoading(true)
        setError(null)
        setResult(null)
        const res = await simulateMessage(text, history)
        setLoading(false)
        if (!res) {
            setError('The NLP service is unavailable right now - please try again shortly.')
            return
        }
        setInput({ text, history })
        setResult(res)
    }

    const runExample = (example) => run(example.text, example.history)

    const runCustom = (e) => {
        e.preventDefault()
        if (!customText.trim()) return
        const history = customHistory.split('\n').map((l) => l.trim()).filter(Boolean)
        run(customText.trim(), history)
    }

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'>
            <div className='bg-[#1a1530] border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto text-white p-5'>
                <div className='flex items-center justify-between mb-3'>
                    <h2 className='text-lg font-medium'>🧭 Algorithm Showcase - Adaptive Context Activation</h2>
                    <button onClick={onClose} className='text-gray-400 hover:text-white text-xl leading-none'>×</button>
                </div>
                <p className='text-xs text-gray-400 mb-4'>
                    Runs a message through the real ACA + model-tier cascade pipeline (the same code path used for
                    every live chat message) and shows exactly how the decision was made - no canned numbers.
                </p>

                {nlpAvailable === false && (
                    <div className='mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200'>
                        NLP analysis is currently unavailable, so the showcase can't run right now.
                    </div>
                )}

                <div className='flex flex-col gap-2 mb-4'>
                    {EXAMPLES.map((example) => (
                        <button
                            key={example.key}
                            onClick={() => runExample(example)}
                            disabled={loading}
                            className='text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs disabled:opacity-50'
                        >
                            <p className='font-medium'>{example.label}</p>
                            <p className='text-gray-400 mt-0.5'>{example.blurb}</p>
                        </button>
                    ))}
                </div>

                <form onSubmit={runCustom} className='flex flex-col gap-2 mb-2'>
                    <p className='text-xs font-medium'>Or try your own message</p>
                    <input
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        placeholder='Message to analyze'
                        className='bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none'
                    />
                    <textarea
                        value={customHistory}
                        onChange={(e) => setCustomHistory(e.target.value)}
                        placeholder={'Optional prior conversation, one message per line, oldest first'}
                        rows={3}
                        className='bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none resize-none'
                    />
                    <button
                        type='submit'
                        disabled={loading || !customText.trim()}
                        className='self-start bg-violet-500/40 hover:bg-violet-500/60 rounded-full px-4 py-1.5 text-xs disabled:opacity-50'
                    >
                        Run through ACA →
                    </button>
                </form>

                {loading && <p className='text-xs text-gray-400 mt-3'>Running the real pipeline...</p>}
                {error && <p className='text-xs text-red-300 mt-3'>{error}</p>}
                {result && input && <PipelineVisualization input={input} result={result} />}
            </div>
        </div>
    )
}

export default AlgorithmShowcase
