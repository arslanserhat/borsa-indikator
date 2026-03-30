'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import StockChart from '@/components/chart/TradingViewWidget';
import { addToWatchlist, getWatchlist, removeFromWatchlist } from '@/lib/storage';
import StockNewsPanel from '@/components/news/StockNewsPanel';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useIsMobile } from '@/hooks/useIsMobile';

const SIG_COLORS: Record<string, string> = {
  GUCLU_AL: 'var(--green)', AL: '#86efac', NOTR: 'var(--accent)', SAT: '#fca5a5', GUCLU_SAT: 'var(--red)',
};

interface StockDetail {
  kod: string; ad: string; fiyat: number; degisim: number; degisimYuzde: number;
  hacim: number; dusuk: number; yuksek: number; oncekiKapanis: number;
  acilis: number; alis: number; satis: number; piyasaDegeri: number;
  fk: number; oneri: number; rsi: number; macd: number; adx: number;
}

export default function ChartPage() {
  const params = useParams();
  const symbol = (params.symbol as string).toUpperCase();
  const [stock, setStock] = useState<StockDetail | null>(null);
  const [inWatchlist, setInWatchlist] = useState(false);
  const { analysis } = useAnalysis(symbol);
  const isMobile = useIsMobile();

  useEffect(() => {
    setInWatchlist(getWatchlist().includes(symbol));
    const fetchStock = async () => {
      try {
        const res = await fetch(`/api/stock/${symbol}`);
        const json = await res.json();
        if (json.data) setStock(json.data);
      } catch {}
    };
    fetchStock();
    const interval = setInterval(fetchStock, 15000);
    return () => clearInterval(interval);
  }, [symbol]);

  const toggleWatchlist = () => {
    if (inWatchlist) { removeFromWatchlist(symbol); setInWatchlist(false); }
    else { addToWatchlist(symbol); setInWatchlist(true); }
  };

  const sigColor = analysis ? (SIG_COLORS[analysis.signal] || 'var(--accent)') : 'var(--text-muted)';

  return (
    <div>
      {/* Header: Fiyat + Sinyal */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '12px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' }}>{symbol}</h1>
            <button onClick={toggleWatchlist} style={{
              backgroundColor: 'transparent', border: '1px solid var(--border)',
              color: inWatchlist ? 'var(--accent)' : 'var(--text-muted)',
              padding: '3px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '11px', fontWeight: '600',
            }}>
              {inWatchlist ? 'Takipte' : 'Takip Et'}
            </button>

            {/* Sinyal badge */}
            {analysis && (
              <>
                <span style={{
                  fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px',
                  color: analysis.signal.includes('AL') ? '#000' : '#fff',
                  backgroundColor: sigColor, padding: '3px 10px', borderRadius: '4px',
                }}>
                  {analysis.signalText}
                </span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: sigColor }}>{analysis.compositeScore}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/100</span>
              </>
            )}
          </div>

          {stock && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ fontSize: '28px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
                {stock.fiyat?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </span>
              <span style={{
                fontSize: '14px', fontWeight: '600',
                color: stock.degisimYuzde >= 0 ? 'var(--green)' : 'var(--red)',
              }}>
                {stock.degisimYuzde >= 0 ? '+' : ''}{stock.degisimYuzde?.toFixed(2)}%
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stock.ad}</span>
            </div>
          )}
        </div>

        {/* Sağ: Detaylı Analiz linki */}
        {analysis && (
          <a href={`/analiz/${symbol}`} style={{
            fontSize: '11px', color: 'var(--accent)', textDecoration: 'none',
            padding: '8px 16px', border: '1px solid rgba(247,147,26,0.2)', borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--accent-bg)', fontWeight: '600', transition: 'all 0.15s',
          }}>
            Detayli Analiz
          </a>
        )}
      </div>

      {/* Ana layout: Grafik + Sağ panel */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: '12px', marginBottom: '12px' }}>
        {/* Sol: Grafik */}
        <div style={{
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', overflow: 'hidden',
        }}>
          <StockChart symbol={symbol} height={480} />
        </div>

        {/* Sağ: Analiz paneli */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Sinyal kartı */}
          {analysis && (
            <div style={{
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '9px', fontWeight: '600', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '6px' }}>
                SIMONS SINYALI
              </div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: sigColor, marginBottom: '4px' }}>
                {analysis.signalText}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Skor: {analysis.compositeScore}/100 | Guven: %{analysis.confidence}
              </div>

              {/* Mini skor barları */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                {([
                  { label: 'Teknik', val: analysis.scores.technical },
                  { label: 'Trend', val: analysis.scores.trend },
                  { label: 'Hacim', val: analysis.scores.volume },
                  { label: 'Duygu', val: analysis.scores.sentiment },
                  { label: 'Formasyon', val: analysis.scores.candlestick },
                ]).map(({ label, val }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '55px' }}>{label}</span>
                    <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${val}%`, borderRadius: '2px',
                        backgroundColor: val >= 60 ? 'var(--green)' : val >= 40 ? 'var(--accent)' : 'var(--red)',
                      }} />
                    </div>
                    <span style={{
                      fontSize: '10px', fontWeight: '600', width: '22px', textAlign: 'right',
                      color: val >= 60 ? 'var(--green)' : val >= 40 ? 'var(--accent)' : 'var(--red)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* İndikatörler */}
          {analysis && (
            <div style={{
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Indikatorler
              </div>
              {([
                { label: 'RSI', val: analysis.indicators.rsi, status: analysis.indicators.rsi < 30 ? 'buy' : analysis.indicators.rsi > 70 ? 'sell' : 'neutral' },
                { label: 'MACD H.', val: analysis.indicators.macdHist, status: analysis.indicators.macdHist > 0 ? 'buy' : 'sell' },
                { label: 'Stoch %K', val: analysis.indicators.stochK, status: analysis.indicators.stochK < 20 ? 'buy' : analysis.indicators.stochK > 80 ? 'sell' : 'neutral' },
                { label: 'ADX', val: analysis.indicators.adx, status: analysis.indicators.adx > 25 ? 'buy' : 'neutral' },
                { label: 'CCI', val: analysis.indicators.cci20, status: analysis.indicators.cci20 < -100 ? 'buy' : analysis.indicators.cci20 > 100 ? 'sell' : 'neutral' },
                { label: 'ATR', val: analysis.indicators.atr, status: 'neutral' },
              ]).map(({ label, val, status }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 14px', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      width: '5px', height: '5px', borderRadius: '50%',
                      backgroundColor: status === 'buy' ? 'var(--green)' : status === 'sell' ? 'var(--red)' : 'var(--text-muted)',
                    }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                    {val?.toFixed(val > 100 || val < -100 ? 0 : 2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Fiyat bilgileri */}
          {stock && (
            <div style={{
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Fiyat Bilgileri
              </div>
              {([
                { label: 'Acilis', val: stock.acilis },
                { label: 'Yuksek', val: stock.yuksek },
                { label: 'Dusuk', val: stock.dusuk },
                { label: 'Onceki Kap.', val: stock.oncekiKapanis },
                { label: 'Hacim', val: stock.hacim, fmt: 'vol' },
                { label: 'Piy. Degeri', val: stock.piyasaDegeri, fmt: 'cap' },
              ]).map(({ label, val, fmt }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '6px 14px', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt === 'vol' ? formatVol(val) : fmt === 'cap' ? formatCap(val) : val > 0 ? val.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '-'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Destek/Direnç */}
          {analysis && (analysis.report.supports.length > 0 || analysis.report.resistances.length > 0) && (
            <div style={{
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '12px 14px',
            }}>
              {analysis.report.supports.length > 0 && (
                <div style={{ marginBottom: analysis.report.resistances.length > 0 ? '8px' : '0' }}>
                  <div style={{ fontSize: '9px', fontWeight: '600', color: 'var(--green)', letterSpacing: '0.5px', marginBottom: '4px' }}>DESTEK</div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {analysis.report.supports.map((s: number, i: number) => (
                      <span key={i} style={{
                        fontSize: '10px', fontWeight: '600', color: 'var(--green)',
                        backgroundColor: 'var(--green-bg)', padding: '2px 8px', borderRadius: '3px',
                        fontVariantNumeric: 'tabular-nums',
                      }}>{s.toFixed(2)}</span>
                    ))}
                  </div>
                </div>
              )}
              {analysis.report.resistances.length > 0 && (
                <div>
                  <div style={{ fontSize: '9px', fontWeight: '600', color: 'var(--red)', letterSpacing: '0.5px', marginBottom: '4px' }}>DIRENC</div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {analysis.report.resistances.map((r: number, i: number) => (
                      <span key={i} style={{
                        fontSize: '10px', fontWeight: '600', color: 'var(--red)',
                        backgroundColor: 'var(--red-bg)', padding: '2px 8px', borderRadius: '3px',
                        fontVariantNumeric: 'tabular-nums',
                      }}>{r.toFixed(2)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Aksiyon planı */}
      {analysis && (
        <div style={{
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: '12px',
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 10px 0' }}>
            {analysis.report.summary}
          </p>
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-sm)',
            backgroundColor: analysis.signal.includes('AL') ? 'var(--green-bg)' : analysis.signal.includes('SAT') ? 'var(--red-bg)' : 'var(--accent-bg)',
            border: `1px solid ${analysis.signal.includes('AL') ? 'rgba(0,216,151,0.15)' : analysis.signal.includes('SAT') ? 'rgba(255,77,106,0.15)' : 'rgba(247,147,26,0.15)'}`,
          }}>
            <span style={{ fontSize: '9px', fontWeight: '700', color: sigColor, letterSpacing: '0.5px' }}>AKSIYON</span>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', margin: '4px 0 0 0' }}>
              {analysis.report.actionPlan}
            </p>
          </div>
          {analysis.report.risks.length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {analysis.report.risks.map((r: string, i: number) => (
                <span key={i} style={{
                  fontSize: '9px', color: 'var(--accent)', backgroundColor: 'var(--accent-bg)',
                  padding: '3px 8px', borderRadius: '3px', border: '1px solid rgba(247,147,26,0.1)',
                }}>
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Haberler */}
      <StockNewsPanel symbol={symbol} />
    </div>
  );
}

function formatVol(v: number): string {
  if (!v) return '-';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toLocaleString('tr-TR');
}

function formatCap(v: number): string {
  if (!v) return '-';
  if (v >= 1e12) return (v / 1e12).toFixed(1) + 'T';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(0) + 'M';
  return v.toLocaleString('tr-TR');
}
