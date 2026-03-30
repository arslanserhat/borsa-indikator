'use client';

import { useParams } from 'next/navigation';
import { useAnalysis } from '@/hooks/useAnalysis';
import { AnalysisResult, ScoreBreakdown, CandlestickPattern, NewsSentiment } from '@/types/analysis';
import { useIsMobile } from '@/hooks/useIsMobile';

const SIGNAL_COLORS: Record<string, string> = {
  GUCLU_AL: 'var(--green)', AL: '#86efac', NOTR: 'var(--accent)', SAT: '#fca5a5', GUCLU_SAT: 'var(--red)',
};

export default function AnalysisPage() {
  const { symbol } = useParams();
  const sym = (symbol as string || '').toUpperCase();
  const { analysis, loading, error } = useAnalysis(sym);
  const isMobile = useIsMobile();

  if (loading) return <LoadingSkeleton />;
  if (error || !analysis) return (
    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '20px', marginBottom: '12px' }}>Analiz yapilamadi</div>
      <div style={{ fontSize: '13px' }}>{error || 'Veri bulunamadi'}</div>
    </div>
  );

  const sigColor = SIGNAL_COLORS[analysis.signal] || 'var(--text-muted)';

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px' }}>{sym}</h1>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{analysis.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontSize: '28px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
              {analysis.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
            </span>
            <span style={{
              fontSize: '14px', fontWeight: '600',
              color: analysis.changePercent >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {analysis.changePercent >= 0 ? '+' : ''}{analysis.changePercent.toFixed(2)}%
            </span>
          </div>
        </div>
        <a href={`/chart/${sym}`} style={{
          fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none',
          padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        }}>
          Grafige Git
        </a>
      </div>

      {/* Sinyal Banner */}
      <div style={{
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '24px', marginBottom: '16px',
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto 1fr', gap: isMobile ? '16px' : '24px', alignItems: 'center', justifyItems: 'center',
      }}>
        {/* Sol: Skor */}
        <div style={{ textAlign: 'center' }}>
          <ScoreGauge score={analysis.compositeScore} color={sigColor} />
        </div>

        {/* Orta: Sinyal */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '32px', fontWeight: '800', color: sigColor,
            letterSpacing: '2px', marginBottom: '8px',
          }}>
            {analysis.signalText}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Guven Orani
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 14px', borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-hover)',
          }}>
            <span style={{ fontSize: '16px', fontWeight: '700', color: sigColor }}>
              %{analysis.confidence}
            </span>
          </div>
        </div>

        {/* Sağ: Risk */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Risk Seviyesi</div>
          <div style={{
            fontSize: '14px', fontWeight: '600',
            color: analysis.riskLevel === 'dusuk' ? 'var(--green)' : analysis.riskLevel === 'orta' ? 'var(--accent)' : 'var(--red)',
          }}>
            {analysis.riskLevel === 'dusuk' ? 'DUSUK' : analysis.riskLevel === 'orta' ? 'ORTA' : 'YUKSEK'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Volatilite: %{analysis.volatility}
          </div>
        </div>
      </div>

      {/* Analiz Raporu */}
      <div style={{
        backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '20px', marginBottom: '16px',
      }}>
        {/* Özet */}
        <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.7', marginBottom: '16px' }}>
          {analysis.report.summary}
        </p>

        {/* Aksiyon Planı */}
        <div style={{
          padding: '14px 18px', borderRadius: 'var(--radius-sm)',
          backgroundColor: analysis.signal === 'GUCLU_AL' || analysis.signal === 'AL'
            ? 'var(--green-bg)' : analysis.signal === 'SAT' || analysis.signal === 'GUCLU_SAT'
            ? 'var(--red-bg)' : 'var(--accent-bg)',
          border: `1px solid ${analysis.signal === 'GUCLU_AL' || analysis.signal === 'AL'
            ? 'rgba(0,216,151,0.2)' : analysis.signal === 'SAT' || analysis.signal === 'GUCLU_SAT'
            ? 'rgba(255,77,106,0.2)' : 'rgba(247,147,26,0.2)'}`,
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: sigColor, letterSpacing: '0.5px', marginBottom: '6px' }}>
            AKSIYON PLANI
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', margin: 0 }}>
            {analysis.report.actionPlan}
          </p>
        </div>

        {/* Destek / Direnç */}
        {(analysis.report.supports.length > 0 || analysis.report.resistances.length > 0) && (
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            {analysis.report.supports.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--green)', letterSpacing: '0.5px', marginBottom: '6px' }}>DESTEK SEVIYELERI</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {analysis.report.supports.map((s, i) => (
                    <span key={i} style={{
                      fontSize: '12px', fontWeight: '600', fontVariantNumeric: 'tabular-nums',
                      padding: '4px 10px', borderRadius: '4px',
                      backgroundColor: 'var(--green-bg)', color: 'var(--green)',
                      border: '1px solid rgba(0,216,151,0.15)',
                    }}>{s.toFixed(2)}</span>
                  ))}
                </div>
              </div>
            )}
            {analysis.report.resistances.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--red)', letterSpacing: '0.5px', marginBottom: '6px' }}>DIRENC SEVIYELERI</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {analysis.report.resistances.map((r, i) => (
                    <span key={i} style={{
                      fontSize: '12px', fontWeight: '600', fontVariantNumeric: 'tabular-nums',
                      padding: '4px 10px', borderRadius: '4px',
                      backgroundColor: 'var(--red-bg)', color: 'var(--red)',
                      border: '1px solid rgba(255,77,106,0.15)',
                    }}>{r.toFixed(2)}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Risk Faktörleri */}
        {analysis.report.risks.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--accent)', letterSpacing: '0.5px', marginBottom: '6px' }}>RISK FAKTORLERI</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {analysis.report.risks.map((risk, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--accent)', fontSize: '8px' }}>&#9679;</span>
                  {risk}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Skor Breakdown */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px',
      }}>
        {([
          { key: 'technical', label: 'Teknik', weight: '40%' },
          { key: 'trend', label: 'Trend', weight: '20%' },
          { key: 'volume', label: 'Hacim', weight: '10%' },
          { key: 'sentiment', label: 'Duygu', weight: '15%' },
          { key: 'candlestick', label: 'Formasyon', weight: '15%' },
        ] as const).map((item) => (
          <ScoreCard key={item.key} label={item.label} weight={item.weight}
            score={analysis.scores[item.key]} />
        ))}
      </div>

      {/* Detaylı Yorumlar */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '16px',
      }}>
        {([
          { title: 'Teknik Analiz', text: analysis.report.technicalView, color: 'var(--blue)' },
          { title: 'Trend Analizi', text: analysis.report.trendView, color: 'var(--green)' },
          { title: 'Hacim Analizi', text: analysis.report.volumeView, color: 'var(--accent)' },
          { title: 'Duygu Analizi', text: analysis.report.sentimentView, color: 'var(--purple)' },
        ]).map((item) => (
          <div key={item.title} style={{
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <span style={{ width: '3px', height: '12px', borderRadius: '2px', backgroundColor: item.color }} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>{item.title}</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>{item.text}</p>
          </div>
        ))}
      </div>

      {/* Alt grid: İndikatörler + Formasyonlar + Sentiment */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
        {/* Teknik İndikatörler */}
        <IndicatorsPanel indicators={analysis.indicators} />

        {/* Sağ kolon */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* MA Hizalanma */}
          <MAAlignmentPanel indicators={analysis.indicators} />

          {/* Mum Formasyonları */}
          <PatternsPanel patterns={analysis.patterns} />

          {/* Duygu Analizi */}
          <SentimentPanel items={analysis.sentimentItems} avg={analysis.sentimentAvg} />
        </div>
      </div>
    </div>
  );
}

// ============ COMPONENTS ============

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const cx = 110, cy = 100, r = 80;
  const startAngle = -180; // Sol
  const endAngle = 0;      // Sağ
  const needleAngle = startAngle + (score / 100) * (endAngle - startAngle);
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleLen = r * 0.72;
  const needleX = cx + needleLen * Math.cos(needleRad);
  const needleY = cy + needleLen * Math.sin(needleRad);

  // Yay segmentleri oluştur (kırmızı -> turuncu -> sarı -> yeşil)
  function arcPath(startDeg: number, endDeg: number): string {
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  // İç tick işaretleri
  const ticks = [0, 25, 50, 75, 100];
  const tickLabels = ['0', '25', '50', '75', '100'];

  return (
    <svg width="220" height="140" viewBox="0 0 220 140">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="glow" />
          <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff4d6a" />
          <stop offset="30%" stopColor="#ff8c42" />
          <stop offset="50%" stopColor="#f7931a" />
          <stop offset="70%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#00d897" />
        </linearGradient>
      </defs>

      {/* Arka plan yay */}
      <path d={arcPath(-180, 0)} fill="none" stroke="var(--border)" strokeWidth="14" strokeLinecap="round" opacity="0.3" />

      {/* Renkli segmentler */}
      <path d={arcPath(-180, -144)} fill="none" stroke="#ff4d6a" strokeWidth="14" strokeLinecap="round" opacity="0.6" />
      <path d={arcPath(-142, -108)} fill="none" stroke="#ff8c42" strokeWidth="14" strokeLinecap="round" opacity="0.6" />
      <path d={arcPath(-106, -72)} fill="none" stroke="#f7931a" strokeWidth="14" strokeLinecap="round" opacity="0.6" />
      <path d={arcPath(-70, -36)} fill="none" stroke="#86efac" strokeWidth="14" strokeLinecap="round" opacity="0.6" />
      <path d={arcPath(-34, 0)} fill="none" stroke="#00d897" strokeWidth="14" strokeLinecap="round" opacity="0.6" />

      {/* Aktif yay (skor kadar) */}
      <path d={arcPath(-180, needleAngle)} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" filter="url(#glow)" opacity="0.9" />

      {/* Tick işaretleri ve sayılar */}
      {ticks.map((t, i) => {
        const a = (-180 + (t / 100) * 180) * Math.PI / 180;
        const innerR = r - 12;
        const outerR = r + 4;
        const labelR = r + 18;
        return (
          <g key={t}>
            <line
              x1={cx + innerR * Math.cos(a)} y1={cy + innerR * Math.sin(a)}
              x2={cx + outerR * Math.cos(a)} y2={cy + outerR * Math.sin(a)}
              stroke="var(--text-muted)" strokeWidth="1.5" opacity="0.5"
            />
            <text
              x={cx + labelR * Math.cos(a)} y={cy + labelR * Math.sin(a) + 3}
              textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontWeight="500"
            >
              {tickLabels[i]}
            </text>
          </g>
        );
      })}

      {/* İbre gövdesi */}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY}
        stroke={color} strokeWidth="3" strokeLinecap="round" filter="url(#glow)" />

      {/* İbre merkez noktası */}
      <circle cx={cx} cy={cy} r="6" fill="var(--bg-card)" stroke={color} strokeWidth="2.5" />
      <circle cx={cx} cy={cy} r="2.5" fill={color} />

      {/* Skor yazısı */}
      <text x={cx} y={cy + 28} textAnchor="middle" fill={color} fontSize="28" fontWeight="800"
        style={{ fontFamily: 'Inter, sans-serif' }}>
        {score}
      </text>
      <text x={cx} y={cy + 40} textAnchor="middle" fill="var(--text-muted)" fontSize="9" fontWeight="500">
        / 100
      </text>

      {/* Sol ve sağ etiketler */}
      <text x={20} y={cy + 14} textAnchor="middle" fill="#ff4d6a" fontSize="7" fontWeight="600">SAT</text>
      <text x={200} y={cy + 14} textAnchor="middle" fill="#00d897" fontSize="7" fontWeight="600">AL</text>
    </svg>
  );
}

function ScoreCard({ label, weight, score }: { label: string; weight: string; score: number }) {
  const color = score >= 60 ? 'var(--green)' : score >= 40 ? 'var(--accent)' : 'var(--red)';
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '14px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{weight}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: '700', color, marginBottom: '8px' }}>{score}</div>
      <div style={{ height: '3px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, backgroundColor: color, borderRadius: '2px', transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

function IndicatorsPanel({ indicators: ind }: { indicators: AnalysisResult['indicators'] }) {
  const groups = [
    { title: 'Momentum', items: [
      { label: 'RSI (14)', value: ind.rsi?.toFixed(1), status: ind.rsi < 30 ? 'buy' : ind.rsi > 70 ? 'sell' : 'neutral' },
      { label: 'Stoch %K', value: ind.stochK?.toFixed(1), status: ind.stochK < 20 ? 'buy' : ind.stochK > 80 ? 'sell' : 'neutral' },
      { label: 'Stoch %D', value: ind.stochD?.toFixed(1), status: ind.stochD < 20 ? 'buy' : ind.stochD > 80 ? 'sell' : 'neutral' },
      { label: 'CCI (20)', value: ind.cci20?.toFixed(1), status: ind.cci20 < -100 ? 'buy' : ind.cci20 > 100 ? 'sell' : 'neutral' },
      { label: 'Williams %R', value: ind.williamsR?.toFixed(2), status: ind.williamsR < -80 ? 'buy' : ind.williamsR > -20 ? 'sell' : 'neutral' },
    ]},
    { title: 'Trend', items: [
      { label: 'MACD', value: ind.macdValue?.toFixed(4), status: ind.macdHist > 0 ? 'buy' : 'sell' },
      { label: 'MACD Signal', value: ind.macdSignal?.toFixed(4), status: ind.macdValue > ind.macdSignal ? 'buy' : 'sell' },
      { label: 'MACD Hist', value: ind.macdHist?.toFixed(4), status: ind.macdHist > 0 ? 'buy' : 'sell' },
      { label: 'ADX', value: ind.adx?.toFixed(1), status: ind.adx > 25 ? 'buy' : 'neutral' },
      { label: 'P.SAR', value: ind.psar?.toFixed(2), status: ind.close > ind.psar ? 'buy' : 'sell' },
    ]},
    { title: 'Volatilite', items: [
      { label: 'BB Ust', value: ind.bbUpper?.toFixed(2), status: 'neutral' },
      { label: 'BB Alt', value: ind.bbLower?.toFixed(2), status: 'neutral' },
      { label: 'ATR', value: ind.atr?.toFixed(2), status: 'neutral' },
    ]},
    { title: 'Oneri', items: [
      { label: 'Genel', value: ind.recommendAll?.toFixed(4), status: ind.recommendAll > 0.1 ? 'buy' : ind.recommendAll < -0.1 ? 'sell' : 'neutral' },
      { label: 'Indikatör', value: ind.recommendOther?.toFixed(4), status: ind.recommendOther > 0.1 ? 'buy' : ind.recommendOther < -0.1 ? 'sell' : 'neutral' },
      { label: 'Hareketli Ort.', value: ind.recommendMA?.toFixed(4), status: ind.recommendMA > 0.1 ? 'buy' : ind.recommendMA < -0.1 ? 'sell' : 'neutral' },
    ]},
  ];

  const statusDot = (s: string) => ({
    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 as const,
    backgroundColor: s === 'buy' ? 'var(--green)' : s === 'sell' ? 'var(--red)' : 'var(--text-muted)',
  });

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '3px', height: '14px', borderRadius: '2px', backgroundColor: 'var(--accent)' }} />
        <span style={{ fontSize: '13px', fontWeight: '600' }}>Teknik Indikatorler</span>
      </div>
      {groups.map((group) => (
        <div key={group.title}>
          <div style={{ padding: '8px 18px', fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', backgroundColor: 'rgba(0,0,0,0.15)' }}>
            {group.title}
          </div>
          {group.items.map((item) => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 18px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={statusDot(item.status)} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.label}</span>
              </div>
              <span style={{ fontSize: '12px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                {item.value || '-'}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MAAlignmentPanel({ indicators: ind }: { indicators: AnalysisResult['indicators'] }) {
  const mas = [
    { label: 'EMA 10', value: ind.ema10 },
    { label: 'EMA 20', value: ind.ema20 },
    { label: 'SMA 20', value: ind.sma20 },
    { label: 'EMA 50', value: ind.ema50 },
    { label: 'SMA 50', value: ind.sma50 },
    { label: 'EMA 200', value: ind.ema200 },
    { label: 'SMA 200', value: ind.sma200 },
  ].filter(m => m.value > 0);

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '3px', height: '14px', borderRadius: '2px', backgroundColor: 'var(--blue)' }} />
        <span style={{ fontSize: '13px', fontWeight: '600' }}>Hareketli Ortalamalar</span>
      </div>
      {mas.map((ma) => {
        const abovePrice = ind.close >= ma.value;
        return (
          <div key={ma.label} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 18px', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{ma.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                {ma.value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
              <span style={{
                fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '3px',
                color: abovePrice ? 'var(--green)' : 'var(--red)',
                backgroundColor: abovePrice ? 'var(--green-bg)' : 'var(--red-bg)',
              }}>
                {abovePrice ? 'UZERINDE' : 'ALTINDA'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PatternsPanel({ patterns }: { patterns: CandlestickPattern[] }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '3px', height: '14px', borderRadius: '2px', backgroundColor: 'var(--purple)' }} />
        <span style={{ fontSize: '13px', fontWeight: '600' }}>Mum Formasyonlari</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '3px' }}>
          {patterns.length}
        </span>
      </div>
      {patterns.length === 0 ? (
        <div style={{ padding: '20px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          Son donemde formasyon tespit edilmedi
        </div>
      ) : (
        patterns.map((p, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 18px', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{
              fontSize: '14px', width: '20px', textAlign: 'center',
              color: p.type === 'bullish' ? 'var(--green)' : p.type === 'bearish' ? 'var(--red)' : 'var(--text-muted)',
            }}>
              {p.type === 'bullish' ? '▲' : p.type === 'bearish' ? '▼' : '◆'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{p.name}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.description}</div>
            </div>
            <div style={{ display: 'flex', gap: '2px' }}>
              {[1, 2, 3].map((s) => (
                <span key={s} style={{
                  width: '4px', height: '12px', borderRadius: '1px',
                  backgroundColor: s <= p.strength ? (p.type === 'bullish' ? 'var(--green)' : p.type === 'bearish' ? 'var(--red)' : 'var(--accent)') : 'var(--border)',
                }} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SentimentPanel({ items, avg }: { items: NewsSentiment[]; avg: number }) {
  const barWidth = ((avg + 1) / 2) * 100;

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '3px', height: '14px', borderRadius: '2px', backgroundColor: 'var(--green)' }} />
        <span style={{ fontSize: '13px', fontWeight: '600' }}>Haber Duygu Analizi</span>
      </div>

      {/* Sentiment bar */}
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--red)' }}>Negatif</span>
          <span style={{ fontSize: '12px', fontWeight: '700', color: avg > 0.1 ? 'var(--green)' : avg < -0.1 ? 'var(--red)' : 'var(--text-muted)' }}>
            {avg > 0 ? '+' : ''}{avg.toFixed(2)}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--green)' }}>Pozitif</span>
        </div>
        <div style={{ height: '6px', backgroundColor: 'var(--bg-hover)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${barWidth}%`, borderRadius: '3px',
            background: `linear-gradient(to right, var(--red), var(--accent), var(--green))`,
          }} />
        </div>
      </div>

      {/* Haber listesi */}
      {items.slice(0, 5).map((item) => (
        <div key={item.newsId} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '7px 18px', borderTop: '1px solid var(--border)',
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
            backgroundColor: item.score > 0.1 ? 'var(--green)' : item.score < -0.1 ? 'var(--red)' : 'var(--text-muted)',
          }} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title}
          </span>
          <span style={{
            fontSize: '10px', fontWeight: '600', fontVariantNumeric: 'tabular-nums',
            color: item.score > 0.1 ? 'var(--green)' : item.score < -0.1 ? 'var(--red)' : 'var(--text-muted)',
          }}>
            {item.score > 0 ? '+' : ''}{item.score.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ height: '32px', width: '200px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', animation: 'ld 1.5s ease-in-out infinite' }} />
        <div style={{ height: '180px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius)', animation: 'ld 1.5s ease-in-out infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px' }}>
          {[1,2,3,4,5].map(i => <div key={i} style={{ height: '100px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius)', animation: 'ld 1.5s ease-in-out infinite' }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          <div style={{ height: '400px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius)', animation: 'ld 1.5s ease-in-out infinite' }} />
          <div style={{ height: '400px', backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius)', animation: 'ld 1.5s ease-in-out infinite' }} />
        </div>
      </div>
      <style>{`@keyframes ld { 0%,100%{opacity:.15} 50%{opacity:.3} }`}</style>
    </div>
  );
}
