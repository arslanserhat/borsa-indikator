'use client';

import { useStockData } from '@/hooks/useStockData';
import MarketSummary from '@/components/market/MarketSummary';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePortfolioAlerts } from '@/hooks/usePortfolioAlerts';

const SIG_COLORS: Record<string, string> = {
  GUCLU_AL: '#00d897', AL: '#86efac', NOTR: '#f7931a', SAT: '#fca5a5', GUCLU_SAT: '#ff4d6a',
};

export default function Dashboard() {
  const { stocks, loading, lastUpdate } = useStockData();
  const [scanData, setScanData] = useState<any[]>([]);
  const [scanLoading, setScanLoading] = useState(true);
  const [endeksFilter, setEndeksFilter] = useState('');
  const [signalFilter, setSignalFilter] = useState('');

  const isMobile = useIsMobile();
  const { alerts, permissionGranted, soundEnabled, setSoundEnabled, requestPermission, checkPriceAlerts } = usePortfolioAlerts();
  const [paperStats, setPaperStats] = useState<any>(null);

  useEffect(() => {
    fetch('/api/paper-trades').then(r => r.json()).then(d => {
      if (d.stats) setPaperStats(d.stats);
    }).catch(() => {});
  }, []);

  // ANLIK portfolio kontrolu - her stock guncellenmesinde (5sn)
  useEffect(() => {
    if (stocks.length > 0) {
      checkPriceAlerts(stocks);
    }
  }, [stocks, checkPriceAlerts]);

  const fetchScan = useCallback(async () => {
    try {
      const res = await fetch('/api/analysis/scan');
      if (!res.ok) { setScanLoading(false); return; }
      const json = await res.json();
      const data = json.data || [];
      if (data.length > 0) {
        setScanData(data);
        setScanLoading(false);
      } else if (json.scanning) {
        // Tarama devam ediyor, 10sn sonra tekrar dene
        setTimeout(fetchScan, 10000);
      } else {
        setScanLoading(false);
      }
    } catch { setScanLoading(false); }
  }, []);

  useEffect(() => {
    fetchScan();
    const interval = setInterval(fetchScan, 300_000);
    return () => clearInterval(interval);
  }, [fetchScan]);

  const topGainers = useMemo(() => [...stocks].sort((a, b) => b.degisimYuzde - a.degisimYuzde).slice(0, 5), [stocks]);
  const topLosers = useMemo(() => [...stocks].sort((a, b) => a.degisimYuzde - b.degisimYuzde).slice(0, 5), [stocks]);
  const topVolume = useMemo(() => [...stocks].sort((a, b) => b.hacim - a.hacim).slice(0, 5), [stocks]);

  const filtered = scanData.filter(d => {
    if (endeksFilter && d.endeks !== endeksFilter) return false;
    if (signalFilter === 'AL' && d.signal !== 'AL' && d.signal !== 'GUCLU_AL') return false;
    if (signalFilter === 'SAT' && d.signal !== 'SAT' && d.signal !== 'GUCLU_SAT') return false;
    return true;
  });

  const buyCount = scanData.filter(d => d.signal === 'GUCLU_AL' || d.signal === 'AL').length;
  const sellCount = scanData.filter(d => d.signal === 'GUCLU_SAT' || d.signal === 'SAT').length;
  const neutralCount = scanData.filter(d => d.signal === 'NOTR').length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.3px' }}>Piyasa Ozeti</h2>
          {lastUpdate && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Son: {new Date(lastUpdate).toLocaleTimeString('tr-TR')}</span>}
        </div>
        {/* Piyasa durumu özeti */}
        {!scanLoading && scanData.length > 0 && (
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--green)' }}>{buyCount}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>AL</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent)' }}>{neutralCount}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>NOTR</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--red)' }}>{sellCount}</div>
              <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>SAT</div>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              {scanData.length} hisse tarandi
            </div>
            {paperStats && paperStats.checked1d > 0 && (
              <div style={{
                fontSize: '10px', padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                backgroundColor: (paperStats.winRate1d || 0) >= 60 ? 'var(--green-bg)' : 'var(--accent-bg)',
                border: `1px solid ${(paperStats.winRate1d || 0) >= 60 ? 'rgba(0,216,151,0.2)' : 'rgba(247,147,26,0.2)'}`,
                color: (paperStats.winRate1d || 0) >= 60 ? 'var(--green)' : 'var(--accent)',
                fontWeight: '600',
              }}>
                Basari: %{paperStats.winRate1d} ({paperStats.checked1d} islem)
              </div>
            )}
          </div>
        )}
      </div>

      <MarketSummary />

      {/* Bildirim izni + Ses kontrolu */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {!permissionGranted && (
          <div onClick={requestPermission} style={{
            flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--accent-bg)', border: '1px solid rgba(247,147,26,0.2)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '12px', color: 'var(--accent)',
          }}>
            <span style={{ fontSize: '16px' }}>&#128276;</span>
            Portfoyunuzdeki hisseler icin anlik bildirim almak icin tiklayin
          </div>
        )}
        <button onClick={() => setSoundEnabled(!soundEnabled)} style={{
          padding: '10px 16px', borderRadius: 'var(--radius-sm)',
          backgroundColor: soundEnabled ? 'var(--green-bg)' : 'var(--bg-card)',
          border: `1px solid ${soundEnabled ? 'rgba(0,216,151,0.3)' : 'var(--border)'}`,
          cursor: 'pointer', fontSize: '12px', fontWeight: '600',
          color: soundEnabled ? 'var(--green)' : 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          {soundEnabled ? '🔊' : '🔇'} Sesli Alarm {soundEnabled ? 'ACIK' : 'KAPALI'}
        </button>
      </div>

      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          {alerts.map((alert, i) => (
            <a key={i} href={`/analiz/${alert.symbol}`} style={{
              padding: '10px 16px', borderRadius: 'var(--radius-sm)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: alert.type === 'emergency' ? 'rgba(255,77,106,0.12)' : alert.type === 'critical' ? 'rgba(255,77,106,0.08)' : alert.type === 'warning' ? 'var(--accent-bg)' : 'var(--green-bg)',
              border: `1px solid ${alert.type === 'emergency' || alert.type === 'critical' ? 'rgba(255,77,106,0.25)' : alert.type === 'warning' ? 'rgba(247,147,26,0.2)' : 'rgba(0,216,151,0.2)'}`,
              animation: alert.type === 'emergency' ? 'alert-pulse 1s ease-in-out infinite' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: alert.type === 'emergency' || alert.type === 'critical' ? 'var(--red)' : alert.type === 'warning' ? 'var(--accent)' : 'var(--green)',
                  boxShadow: alert.type === 'emergency' ? '0 0 8px var(--red)' : 'none',
                }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: alert.type === 'emergency' || alert.type === 'critical' ? 'var(--red)' : alert.type === 'warning' ? 'var(--accent)' : 'var(--green)' }}>
                    {alert.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{alert.message}</div>
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '600', color: alert.changePercent >= 0 ? 'var(--green)' : 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>
                {alert.changePercent >= 0 ? '+' : ''}{alert.changePercent.toFixed(1)}%
              </span>
            </a>
          ))}
          <style>{`@keyframes alert-pulse { 0%,100%{opacity:1} 50%{opacity:0.7} }`}</style>
        </div>
      )}

      {/* İki kolon: Sol sinyal tablosu, Sağ yükselenler/düşenler */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 340px', gap: '12px' }}>
        {/* Sol: AL/SAT Sinyalleri */}
        <div style={{
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', overflow: 'hidden',
        }}>
          {/* Başlık + Filtreler */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '3px', height: '14px', borderRadius: '2px', backgroundColor: 'var(--accent)' }} />
              <span style={{ fontSize: '13px', fontWeight: '600' }}>AL / SAT Sinyalleri</span>
            </div>
            <div style={{ display: 'flex', gap: '3px' }}>
              {['', 'BIST30', 'BIST50', 'BIST100'].map(f => (
                <button key={f} onClick={() => setEndeksFilter(f === endeksFilter ? '' : f)} style={{
                  padding: '3px 7px', fontSize: '8px', fontWeight: '600', borderRadius: '3px',
                  border: '1px solid', cursor: 'pointer', letterSpacing: '0.3px',
                  borderColor: endeksFilter === f ? 'var(--accent)' : 'var(--border)',
                  backgroundColor: endeksFilter === f ? 'var(--accent-bg)' : 'transparent',
                  color: endeksFilter === f ? 'var(--accent)' : 'var(--text-muted)',
                }}>{f || 'TUMU'}</button>
              ))}
              <span style={{ width: '1px', height: '14px', backgroundColor: 'var(--border)', margin: '0 2px' }} />
              {[{ k: '', l: 'Hepsi', c: 'var(--accent)' }, { k: 'AL', l: 'AL', c: 'var(--green)' }, { k: 'SAT', l: 'SAT', c: 'var(--red)' }].map(({ k, l, c }) => (
                <button key={k} onClick={() => setSignalFilter(k === signalFilter ? '' : k)} style={{
                  padding: '3px 7px', fontSize: '8px', fontWeight: '600', borderRadius: '3px',
                  border: '1px solid', cursor: 'pointer',
                  borderColor: signalFilter === k ? c : 'var(--border)',
                  backgroundColor: signalFilter === k ? `${c}15` : 'transparent',
                  color: signalFilter === k ? c : 'var(--text-muted)',
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Tablo */}
          {scanLoading && scanData.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              <div style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}>Sinyal verileri yukleniyor...</div>
              <style>{`@keyframes shimmer { 0%,100%{opacity:.3} 50%{opacity:.8} }`}</style>
            </div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)', zIndex: 1 }}>
                  <tr>
                    <th style={thS}>Sinyal</th>
                    <th style={{ ...thS, textAlign: 'left' }}>Hisse</th>
                    <th style={thS}>Skor</th>
                    <th style={thS}>Fiyat</th>
                    <th style={thS}>Degisim</th>
                    <th style={thS}>RSI</th>
                    <th style={thS}>Trend</th>
                    <th style={thS}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const sigColor = SIG_COLORS[item.signal] || 'var(--text-muted)';
                    const isUp = item.changePct >= 0;
                    return (
                      <tr key={item.symbol}
                        style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '8px', fontWeight: '700',
                            color: item.signal.includes('AL') ? '#000' : '#fff',
                            backgroundColor: sigColor, padding: '2px 6px', borderRadius: '3px',
                            display: 'inline-block', minWidth: '40px',
                          }}>{item.signalText}</span>
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <a href={`/analiz/${item.symbol}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: '600', fontSize: '11px' }}>{item.symbol}</a>
                            {item.endeks && <span style={{ fontSize: '7px', color: '#60a5fa', border: '1px solid #60a5fa30', padding: '0px 3px', borderRadius: '2px' }}>{item.endeks.replace('BIST','')}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: sigColor, fontVariantNumeric: 'tabular-nums' }}>{item.score}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>{item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', fontWeight: '600', color: isUp ? 'var(--green)' : 'var(--red)', fontVariantNumeric: 'tabular-nums' }}>{isUp ? '+' : ''}{item.changePct.toFixed(2)}%</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '10px', color: item.rsi < 30 ? 'var(--green)' : item.rsi > 70 ? 'var(--red)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{item.rsi}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '8px', fontWeight: '600', padding: '1px 5px', borderRadius: '2px',
                            color: item.trendUp && item.above200 ? 'var(--green)' : !item.trendUp && !item.above200 ? 'var(--red)' : 'var(--accent)',
                            backgroundColor: item.trendUp && item.above200 ? 'var(--green-bg)' : !item.trendUp && !item.above200 ? 'var(--red-bg)' : 'var(--accent-bg)',
                          }}>{item.trendUp && item.above200 ? '▲' : !item.trendUp && !item.above200 ? '▼' : '~'}</span>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                          <a href={`/analiz/${item.symbol}`} style={{ fontSize: '9px', color: 'var(--text-muted)', textDecoration: 'none' }}>&#8250;</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sağ: Mini paneller */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Yükselenler */}
          <MiniPanel title="Yukselenler" items={topGainers} loading={loading} type="change" />
          {/* Düşenler */}
          <MiniPanel title="Dusenler" items={topLosers} loading={loading} type="change" />
          {/* Hacim */}
          <MiniPanel title="Hacim Liderleri" items={topVolume} loading={loading} type="volume" />
        </div>
      </div>
    </div>
  );
}

function MiniPanel({ title, items, loading, type }: { title: string; items: any[]; loading: boolean; type: 'change' | 'volume' }) {
  const accentColor = title.includes('Yuksel') ? 'var(--green)' : title.includes('Dus') ? 'var(--red)' : 'var(--accent)';
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '3px', height: '12px', borderRadius: '2px', backgroundColor: accentColor }} />
        <span style={{ fontSize: '11px', fontWeight: '600' }}>{title}</span>
      </div>
      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>...</div>
      ) : items.map((s) => {
        const isUp = s.degisimYuzde >= 0;
        return (
          <div key={s.kod} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 14px', borderBottom: '1px solid var(--border)',
          }}>
            <a href={`/chart/${s.kod}`} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--accent)', textDecoration: 'none' }}>{s.kod}</a>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>{s.fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
              <span style={{
                fontSize: '10px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', minWidth: '55px', textAlign: 'right',
                color: type === 'volume' ? 'var(--text-primary)' : (isUp ? 'var(--green)' : 'var(--red)'),
              }}>
                {type === 'volume' ? formatVol(s.hacim) : `${isUp ? '+' : ''}${s.degisimYuzde.toFixed(2)}%`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const thS: React.CSSProperties = {
  padding: '6px 8px', textAlign: 'right', fontWeight: '500',
  color: 'var(--text-muted)', fontSize: '8px', letterSpacing: '0.5px',
  textTransform: 'uppercase', borderBottom: '1px solid var(--border)',
};

function formatVol(v: number): string {
  if (!v) return '-';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(0) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return v.toString();
}
