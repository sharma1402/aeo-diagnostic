import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';

// ─── Types ────────────────────────────────────────────────────────────────────
interface EngineResult {
  engine: string;
  engineLabel: string;
  rawResponse: string;
  brandMentioned: boolean;
  brandRank: number | null;
  competitorsMentioned: string[];
  sentiment: string;
  keyPhrases: string[];
  grade: string;
  score: number;
  insights: string[];
  recommendations: string[];
}

interface CompetitorRow {
  name: string;
  claude: boolean;
  gpt4: boolean;
  gemini: boolean;
  totalMentions: number;
  avgRank: number | null;
}

interface AEOReport {
  query: string;
  brand: string;
  competitors: string[];
  timestamp: string;
  results: EngineResult[];
  overallGrade: string;
  overallScore: number;
  summary: string;
  topRecommendations: string[];
  competitorMatrix: CompetitorRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ENGINE_COLORS: Record<string, string> = {
  claude: '#7c3aed',
  gpt4: '#10b981',
  gemini: '#06b6d4',
};

const GRADE_COLORS: Record<string, string> = {
  A: '#10b981',
  B: '#06b6d4',
  C: '#f59e0b',
  D: '#f97316',
  F: '#ef4444',
};

const EXAMPLE_QUERIES = [
  { query: 'best magnesium supplement for sleep', brand: 'Natural Vitality', competitors: 'Nature Made,Doctor Best,Thorne' },
  { query: 'best protein powder for muscle gain', brand: 'Optimum Nutrition', competitors: 'Dymatize,BSN,MuscleTech' },
  { query: 'best collagen supplement for skin', brand: 'Vital Proteins', competitors: 'NeoCell,Sports Research,Further Food' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScanLine() {
  return (
    <div className="scan-container">
      <div className="scan-line" />
      <style jsx>{`
        .scan-container {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 50;
          opacity: 0.03;
        }
        .scan-line {
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #7c3aed, transparent);
          animation: scan 4s linear infinite;
        }
        @keyframes scan {
          0% { top: -2px; }
          100% { top: 100vh; }
        }
      `}</style>
    </div>
  );
}

function GradeCircle({ grade, score, size = 80 }: { grade: string; score: number; size?: number }) {
  const color = GRADE_COLORS[grade] || '#888';
  const radius = (size - 12) / 2;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={6} />
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size * 0.3, fontWeight: 800, color, fontFamily: 'Syne, sans-serif', lineHeight: 1 }}>{grade}</span>
        <span style={{ fontSize: size * 0.15, color: 'rgba(255,255,255,0.4)', fontFamily: 'Space Mono, monospace' }}>{score}</span>
      </div>
    </div>
  );
}

function EngineCard({ result, brand }: { result: EngineResult; brand: string }) {
  const [expanded, setExpanded] = useState(false);
  const color = ENGINE_COLORS[result.engine] || '#888';

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${color}33`,
      borderRadius: 16,
      overflow: 'hidden',
      transition: 'border-color 0.3s, transform 0.2s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}88`; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}33`; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
    >
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${color}22`, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 12px ${color}` }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#f0f0ff' }}>{result.engineLabel}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            {result.brandMentioned ? `Rank #${result.brandRank ?? '?'} · ${result.sentiment}` : 'Not mentioned'}
          </div>
        </div>
        <GradeCircle grade={result.grade} score={result.score} size={60} />
      </div>

      {/* Body */}
      <div style={{ padding: '16px 24px' }}>
        {/* Mention status */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
          borderRadius: 20, fontSize: 11, fontWeight: 700,
          background: result.brandMentioned ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          color: result.brandMentioned ? '#10b981' : '#ef4444',
          marginBottom: 12,
        }}>
          {result.brandMentioned ? '✓ MENTIONED' : '✗ NOT FOUND'}
        </div>

        {/* Insights */}
        {result.insights.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {result.insights.map((insight, i) => (
              <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${color}55` }}>
                {insight}
              </div>
            ))}
          </div>
        )}

        {/* Key phrases */}
        {result.keyPhrases.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>AI Said</div>
            {result.keyPhrases.slice(0, 1).map((phrase, i) => (
              <div key={i} style={{
                fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.04)',
                borderRadius: 6, padding: '6px 10px', fontStyle: 'italic',
              }}>
                &ldquo;{phrase.length > 120 ? phrase.slice(0, 120) + '…' : phrase}&rdquo;
              </div>
            ))}
          </div>
        )}

        {/* Competitors mentioned */}
        {result.competitorsMentioned.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Competitors Mentioned</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {result.competitorsMentioned.map((c, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                  background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)',
                }}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* View raw toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            fontSize: 11, color: color, background: 'none', border: `1px solid ${color}44`,
            borderRadius: 6, padding: '4px 10px', cursor: 'pointer', marginTop: 4,
          }}
        >
          {expanded ? '▲ Hide' : '▼ View'} Raw Response
        </button>

        {expanded && (
          <div style={{
            marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.3)',
            borderRadius: 8, padding: 12, maxHeight: 200, overflowY: 'auto',
            fontFamily: 'Space Mono, monospace', lineHeight: 1.6, whiteSpace: 'pre-wrap',
          }}>
            {result.rawResponse}
          </div>
        )}
      </div>
    </div>
  );
}

function CompetitorMatrix({ matrix, brand }: { matrix: CompetitorRow[]; brand: string }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 12px', color: 'rgba(255,255,255,0.3)', fontWeight: 400, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>Brand</th>
            {(['Claude', 'GPT-4o', 'Gemini'] as const).map((e, i) => {
              const colors = ['#7c3aed', '#10b981', '#06b6d4'];
              return (
                <th key={e} style={{ padding: '8px 12px', color: colors[i], fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>{e}</th>
              );
            })}
            <th style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.3)', fontWeight: 400, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>Coverage</th>
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => {
            const isBrand = row.name === brand;
            return (
              <tr key={i} style={{
                background: isBrand ? 'rgba(124,58,237,0.08)' : i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <td style={{ padding: '10px 12px', color: isBrand ? '#c4b5fd' : 'rgba(255,255,255,0.7)', fontWeight: isBrand ? 700 : 400 }}>
                  {row.name} {isBrand && <span style={{ fontSize: 9, color: '#7c3aed', marginLeft: 4 }}>YOU</span>}
                </td>
                {[row.claude, row.gpt4, row.gemini].map((mentioned, j) => (
                  <td key={j} style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ fontSize: 14 }}>{mentioned ? '✓' : '—'}</span>
                  </td>
                ))}
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    {[0, 1, 2].map(idx => {
                      const vals = [row.claude, row.gpt4, row.gemini];
                      const colors = ['#7c3aed', '#10b981', '#06b6d4'];
                      return <div key={idx} style={{ width: 8, height: 8, borderRadius: '50%', background: vals[idx] ? colors[idx] : 'rgba(255,255,255,0.1)' }} />;
                    })}
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>{row.totalMentions}/3</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LoadingState() {
  const steps = [
    { engine: 'Claude', color: '#7c3aed', label: 'Querying Claude (Anthropic)...' },
    { engine: 'GPT-4o', color: '#10b981', label: 'Querying GPT-4o (OpenAI)...' },
    { engine: 'Gemini', color: '#06b6d4', label: 'Querying Gemini Pro (Google)...' },
    { engine: 'Analysis', color: '#f59e0b', label: 'Analyzing & scoring...' },
  ];

  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timings = [0, 1200, 2400, 3600];
    const timers = timings.map((t, i) => setTimeout(() => setActiveStep(i), t));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 8, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Running AEO Diagnostic</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Querying 3 AI engines simultaneously</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, margin: '0 auto' }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
            borderRadius: 10, border: `1px solid ${i <= activeStep ? step.color + '44' : 'rgba(255,255,255,0.07)'}`,
            background: i <= activeStep ? `${step.color}11` : 'transparent',
            transition: 'all 0.4s ease',
          }}>
            <div style={{ position: 'relative', width: 20, height: 20 }}>
              {i < activeStep ? (
                <span style={{ color: step.color, fontSize: 16 }}>✓</span>
              ) : i === activeStep ? (
                <div style={{
                  width: 16, height: 16, border: `2px solid ${step.color}`, borderTopColor: 'transparent',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }} />
              ) : (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', margin: '4px' }} />
              )}
            </div>
            <span style={{ fontSize: 12, color: i <= activeStep ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)' }}>{step.label}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AEOReport | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'engines' | 'matrix' | 'actions'>('overview');
  const resultsRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async () => {
    if (!query.trim() || !brand.trim()) {
      setError('Query and brand are required');
      return;
    }
    setError('');
    setLoading(true);
    setReport(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, brand, competitors }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      setReport(data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const loadExample = (ex: typeof EXAMPLE_QUERIES[0]) => {
    setQuery(ex.query);
    setBrand(ex.brand);
    setCompetitors(ex.competitors);
  };

  return (
    <>
      <Head>
        <title>AEO Diagnostic — AI Visibility Report Card</title>
        <meta name="description" content="See how your brand ranks across Claude, GPT-4, and Gemini" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📊</text></svg>" />
      </Head>

      <ScanLine />

      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        {/* Hero */}
        <div style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(180deg, rgba(124,58,237,0.08) 0%, transparent 100%)',
          padding: '60px 24px 48px',
          textAlign: 'center',
        }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px',
            borderRadius: 20, border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.1)',
            fontSize: 11, color: '#c4b5fd', letterSpacing: '0.15em', textTransform: 'uppercase',
            marginBottom: 24,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 8px #7c3aed', display: 'inline-block' }} />
            Answer Engine Optimization
          </div>

          <h1 style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 800,
            fontSize: 'clamp(32px, 6vw, 64px)',
            lineHeight: 1.05, marginBottom: 16,
            background: 'linear-gradient(135deg, #f0f0ff 0%, #c4b5fd 50%, #67e8f9 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            AEO Diagnostic
          </h1>

          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.7 }}>
            Does your brand show up when customers ask AI assistants what to buy?<br />
            Find out — across Claude, GPT-4, and Gemini — in 30 seconds.
          </p>

          {/* Engine badges */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Claude', color: '#7c3aed' },
              { label: 'GPT-4o', color: '#10b981' },
              { label: 'Gemini Pro', color: '#06b6d4' },
            ].map(e => (
              <div key={e.label} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                borderRadius: 20, border: `1px solid ${e.color}44`, background: `${e.color}11`,
                fontSize: 11, color: e.color, fontWeight: 700,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: e.color, boxShadow: `0 0 6px ${e.color}` }} />
                {e.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
          {/* Input form */}
          <div style={{
            margin: '40px 0',
            background: 'var(--surface)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20,
            overflow: 'hidden',
          }}>
            {/* Form header */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>New Diagnostic</span>
            </div>

            <div style={{ padding: 28 }}>
              {/* Example queries */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Quick examples</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {EXAMPLE_QUERIES.map((ex, i) => (
                    <button key={i} onClick={() => loadExample(ex)} style={{
                      fontSize: 11, padding: '6px 12px', borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                      color: 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { (e.currentTarget).style.borderColor = 'rgba(124,58,237,0.4)'; (e.currentTarget).style.color = '#c4b5fd'; }}
                    onMouseLeave={e => { (e.currentTarget).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget).style.color = 'rgba(255,255,255,0.5)'; }}
                    >
                      {ex.query}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                {/* Query */}
                <div>
                  <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
                    Customer Query *
                  </label>
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder='e.g. "best magnesium supplement for seniors"'
                    style={{
                      width: '100%', padding: '14px 16px', borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                      color: '#f0f0ff', fontSize: 14, outline: 'none',
                      fontFamily: 'Space Mono, monospace',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Brand */}
                  <div>
                    <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
                      Your Brand *
                    </label>
                    <input
                      type="text"
                      value={brand}
                      onChange={e => setBrand(e.target.value)}
                      placeholder='e.g. "Natural Vitality"'
                      style={{
                        width: '100%', padding: '14px 16px', borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                        color: '#f0f0ff', fontSize: 13, outline: 'none',
                        fontFamily: 'Space Mono, monospace',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.5)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>

                  {/* Competitors */}
                  <div>
                    <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 8 }}>
                      Competitors (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={competitors}
                      onChange={e => setCompetitors(e.target.value)}
                      placeholder='e.g. "Nature Made, Doctor Best"'
                      style={{
                        width: '100%', padding: '14px 16px', borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
                        color: '#f0f0ff', fontSize: 13, outline: 'none',
                        fontFamily: 'Space Mono, monospace',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.5)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 12 }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  marginTop: 20, width: '100%', padding: '16px',
                  borderRadius: 12, border: 'none', cursor: loading ? 'wait' : 'pointer',
                  background: loading ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  fontFamily: 'Syne, sans-serif', letterSpacing: '0.05em',
                  boxShadow: loading ? 'none' : '0 0 40px rgba(124,58,237,0.4)',
                  transition: 'all 0.3s',
                }}
              >
                {loading ? 'Running Diagnostic...' : 'Run AEO Diagnostic →'}
              </button>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div style={{
              background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20, marginBottom: 40,
            }}>
              <LoadingState />
            </div>
          )}

          {/* Results */}
          {report && (
            <div ref={resultsRef} style={{ paddingBottom: 80 }}>
              {/* Overall score banner */}
              <div style={{
                background: 'var(--surface)',
                border: `1px solid ${GRADE_COLORS[report.overallGrade]}33`,
                borderRadius: 20, padding: '28px 32px',
                marginBottom: 24,
                display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap',
              }}>
                <GradeCircle grade={report.overallGrade} score={report.overallScore} size={96} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Overall AEO Score</div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: '#f0f0ff', marginBottom: 8 }}>{report.brand}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{report.summary}</div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {report.results.map(r => (
                    <div key={r.engine} style={{
                      textAlign: 'center', padding: '12px 16px',
                      background: `${ENGINE_COLORS[r.engine]}11`,
                      border: `1px solid ${ENGINE_COLORS[r.engine]}33`,
                      borderRadius: 12,
                    }}>
                      <div style={{ fontSize: 20, fontFamily: 'Syne, sans-serif', fontWeight: 800, color: GRADE_COLORS[r.grade] }}>{r.grade}</div>
                      <div style={{ fontSize: 10, color: ENGINE_COLORS[r.engine], marginTop: 2 }}>{r.engine === 'gpt4' ? 'GPT-4o' : r.engine.charAt(0).toUpperCase() + r.engine.slice(1)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tab nav */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 24, overflowX: 'auto' }}>
                {(['overview', 'engines', 'matrix', 'actions'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    padding: '9px 18px', borderRadius: 8, fontSize: 12,
                    border: `1px solid ${activeTab === tab ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    background: activeTab === tab ? 'rgba(124,58,237,0.15)' : 'transparent',
                    color: activeTab === tab ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', fontFamily: 'Space Mono, monospace', textTransform: 'capitalize',
                    transition: 'all 0.2s', whiteSpace: 'nowrap',
                  }}>
                    {tab === 'overview' ? '📊 Overview' : tab === 'engines' ? '🤖 Per Engine' : tab === 'matrix' ? '🎯 Competitor Matrix' : '⚡ Actions'}
                  </button>
                ))}
              </div>

              {/* Overview tab */}
              {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                  {/* Visibility bar */}
                  <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24, gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Engine-by-Engine Visibility</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {report.results.map(r => (
                        <div key={r.engine} style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: ENGINE_COLORS[r.engine], fontWeight: 700 }}>{r.engineLabel.split(' ')[0]}</span>
                            <span style={{ fontSize: 12, color: GRADE_COLORS[r.grade] }}>{r.score}/100</span>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 4,
                              background: `linear-gradient(90deg, ${ENGINE_COLORS[r.engine]}, ${GRADE_COLORS[r.grade]})`,
                              width: `${r.score}%`, transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                            }} />
                          </div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                            {r.brandMentioned ? `Rank #${r.brandRank ?? '?'} · ${r.sentiment}` : 'Not mentioned'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick stats */}
                  {[
                    { label: 'Engines Visible', value: `${report.results.filter(r => r.brandMentioned).length}/3`, color: '#7c3aed' },
                    { label: 'Best Rank', value: (() => { const ranks = report.results.map(r => r.brandRank).filter((r): r is number => r !== null); return ranks.length ? `#${Math.min(...ranks)}` : 'N/A'; })(), color: '#10b981' },
                    { label: 'Top Competitor', value: (() => { const all = report.results.flatMap(r => r.competitorsMentioned); const freq = all.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {} as Record<string, number>); const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]; return top ? top[0] : 'None'; })(), color: '#ef4444' },
                  ].map((stat, i) => (
                    <div key={i} style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>{stat.label}</div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: stat.color }}>{stat.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Per-engine tab */}
              {activeTab === 'engines' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {report.results.map(r => (
                    <EngineCard key={r.engine} result={r} brand={report.brand} />
                  ))}
                </div>
              )}

              {/* Competitor matrix tab */}
              {activeTab === 'matrix' && (
                <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Competitor Visibility Matrix</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>Which brands each AI recommends for this query</div>
                  </div>
                  <div style={{ padding: '8px 0 16px' }}>
                    <CompetitorMatrix matrix={report.competitorMatrix} brand={report.brand} />
                  </div>
                </div>
              )}

              {/* Actions tab */}
              {activeTab === 'actions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 24 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Top Recommendations</div>
                    {report.topRecommendations.map((rec, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 14, marginBottom: 16, padding: '14px 16px',
                        background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        <div style={{
                          minWidth: 28, height: 28, borderRadius: '50%',
                          background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: '#c4b5fd',
                        }}>
                          {i + 1}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{rec}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Per-engine recs */}
                  {report.results.map(r => (
                    <div key={r.engine} style={{
                      background: 'var(--surface)',
                      border: `1px solid ${ENGINE_COLORS[r.engine]}22`,
                      borderRadius: 16, padding: 20,
                    }}>
                      <div style={{ fontSize: 11, color: ENGINE_COLORS[r.engine], textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                        {r.engineLabel} — Specific Fixes
                      </div>
                      {r.recommendations.map((rec, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8, paddingLeft: 12, borderLeft: `2px solid ${ENGINE_COLORS[r.engine]}44` }}>
                          {rec}
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Export */}
                  <button
                    onClick={() => {
                      const json = JSON.stringify(report, null, 2);
                      const blob = new Blob([json], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `aeo-report-${report.brand.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
                      a.click();
                    }}
                    style={{
                      padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
                      background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                      fontSize: 12, fontFamily: 'Space Mono, monospace',
                    }}
                  >
                    ↓ Export Full Report (JSON)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px', textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
          AEO Diagnostic · Built with Claude, GPT-4o & Gemini Pro · {new Date().getFullYear()}
        </div>
      </div>
    </>
  );
}
