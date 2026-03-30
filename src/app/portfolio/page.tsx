'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStockData } from '@/hooks/useStockData';
import { PortfolioEntry } from '@/lib/storage';
import { useIsMobile } from '@/hooks/useIsMobile';

const SIG_COLORS: Record<string, string> = {
  GUCLU_AL: 'var(--green)', AL: '#86efac', NOTR: 'var(--accent)', SAT: '#fca5a5', GUCLU_SAT: 'var(--red)',
};

export default function PortfolioPage() {
  const { stocks } = useStockData();
  const [portfolio, setPortfolio] = useState<PortfolioEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newCost, setNewCost] = useState('');
  const [signals, setSignals] = useState<Record<string, any>>({});
  const [sigLoading, setSigLoading] = useState(true);
  const [editSymbol, setEditSymbol] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editMode, setEditMode] = useState<'buy' | 'sell'>('buy');
  const [symbolSearch, setSymbolSearch] = useState<any[]>([]);
  const [selectedStock, setSelectedStock] = useState<any>(null);
  const isMobile = useIsMobile();

  // DB'den portföy çek
  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch('/api/user/portfolio');
      if (res.ok) {
        const data = await res.json();
        setPortfolio((data.portfolio || []).map((p: any) => ({
          symbol: p.symbol,
          quantity: p.quantity,
          avgCost: p.avg_cost,
          addedAt: p.added_at,
        })));
      }
    } catch {}
  }, []);

  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);

  // Portföydeki hisseler için sinyal çek
  const fetchSignals = useCallback(async () => {
    if (portfolio.length === 0) { setSigLoading(false); return; }
    try {
      const res = await fetch('/api/analysis/scan');
      const json = await res.json();
      const map: Record<string, any> = {};
      for (const item of (json.data || [])) {
        map[item.symbol] = item;
      }
      setSignals(map);
    } catch {} finally { setSigLoading(false); }
  }, [portfolio]);

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 120_000);
    return () => clearInterval(interval);
  }, [fetchSignals]);

  const portfolioWithPrices = useMemo(() => {
    return portfolio.map(p => {
      const stock = stocks.find(s => s.kod === p.symbol);
      const currentPrice = stock?.fiyat || 0;
      const totalCost = p.avgCost * p.quantity;
      const currentValue = currentPrice > 0 ? currentPrice * p.quantity : 0;
      const pnl = currentPrice > 0 ? currentValue - totalCost : 0;
      const pnlPercent = (currentPrice > 0 && totalCost > 0) ? ((currentValue - totalCost) / totalCost) * 100 : 0;
      const sig = signals[p.symbol];
      const stopLoss = Math.round(p.avgCost * 0.93 * 100) / 100; // %7 stop-loss
      const stopHit = currentPrice > 0 && currentPrice <= stopLoss;
      return { ...p, currentPrice, totalCost, currentValue, pnl, pnlPercent, stock, sig, stopLoss, stopHit };
    });
  }, [portfolio, stocks, signals]);

  const totalValue = portfolioWithPrices.reduce((sum, p) => sum + p.currentValue, 0);
  const totalCost = portfolioWithPrices.reduce((sum, p) => sum + p.totalCost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

  // Portföy risk skoru
  const avgScore = portfolioWithPrices.filter(p => p.sig).length > 0
    ? Math.round(portfolioWithPrices.filter(p => p.sig).reduce((sum, p) => sum + (p.sig?.score || 50), 0) / portfolioWithPrices.filter(p => p.sig).length)
    : 0;
  const satCount = portfolioWithPrices.filter(p => p.sig?.signal === 'SAT' || p.sig?.signal === 'GUCLU_SAT').length;

  const handleAdd = async () => {
    if (!newSymbol || !newQty || !newCost) return;
    try {
      const res = await fetch('/api/user/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: newSymbol.toUpperCase(), quantity: parseFloat(newQty), avgCost: parseFloat(newCost) }),
      });
      if (res.ok) {
        await fetchPortfolio();
        setNewSymbol(''); setNewQty(''); setNewCost(''); setShowAdd(false);
      }
    } catch {}
  };

  const handleRemove = async (symbol: string) => {
    if (confirm(`${symbol} portfoyden kaldirilsin mi?`)) {
      try {
        await fetch('/api/user/portfolio', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol }),
        });
        await fetchPortfolio();
      } catch {}
    }
  };

  const openEdit = (symbol: string, mode: 'buy' | 'sell') => {
    setEditSymbol(symbol);
    setEditMode(mode);
    setEditQty('');
    setEditCost('');
  };

  const handleEdit = async () => {
    if (!editSymbol || !editQty) return;
    const qty = parseFloat(editQty);
    const cost = parseFloat(editCost) || 0;
    try {
      await fetch('/api/user/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: editSymbol,
          quantity: qty,
          avgCost: editMode === 'buy' ? cost : 0,
          action: editMode === 'sell' ? 'sell' : 'buy',
        }),
      });
      await fetchPortfolio();
      setEditSymbol(null);
    } catch {}
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.3px' }}>Portfoy</h2>
          {satCount > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--red)', marginTop: '2px', display: 'block' }}>
              {satCount} hisse SAT sinyali veriyor - dikkat!
            </span>
          )}
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{
          backgroundColor: 'var(--accent)', border: 'none', color: '#000',
          padding: '8px 18px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          fontSize: '11px', fontWeight: '700', letterSpacing: '0.3px',
        }}>
          + Hisse Ekle
        </button>
      </div>

      {/* Özet kartları */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <MetricCard label="Toplam Maliyet" value={`${totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`} suffix="TL" />
        <MetricCard label="Guncel Deger" value={`${totalValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`} suffix="TL" />
        <MetricCard label="Kar/Zarar" value={`${totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`} suffix="TL" color={totalPnl >= 0 ? 'var(--green)' : 'var(--red)'} />
        <MetricCard label="Kar/Zarar %" value={`${totalPnlPercent >= 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%`} color={totalPnlPercent >= 0 ? 'var(--green)' : 'var(--red)'} />
        <MetricCard label="Portfoy Skoru" value={avgScore > 0 ? `${avgScore}` : '-'} suffix="/100"
          color={avgScore >= 58 ? 'var(--green)' : avgScore >= 42 ? 'var(--accent)' : avgScore > 0 ? 'var(--red)' : 'var(--text-muted)'} />
      </div>

      {/* Hisse Ekle */}
      {showAdd && (
        <div style={{
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '16px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap' }}>
            {/* Sembol - arama ile */}
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', letterSpacing: '0.3px' }}>Sembol</label>
              <input value={newSymbol} placeholder="Ara... THYAO, GARAN" type="text"
                onChange={e => {
                  const val = e.target.value.toUpperCase();
                  setNewSymbol(val);
                  setSelectedStock(null);
                  if (val.length >= 2) {
                    setSymbolSearch(stocks.filter(s => s.kod.includes(val) || s.ad.toLowerCase().includes(val.toLowerCase())).slice(0, 6));
                  } else {
                    setSymbolSearch([]);
                  }
                }}
                style={{
                  backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-primary)',
                  fontSize: '12px', width: '200px', outline: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => { setTimeout(() => setSymbolSearch([]), 200); e.target.style.borderColor = 'var(--border)'; }}
              />
              {/* Arama sonuclari dropdown */}
              {symbolSearch.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginTop: '4px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  {symbolSearch.map(s => (
                    <div key={s.kod} onClick={() => {
                      setNewSymbol(s.kod);
                      setSelectedStock(s);
                      setNewCost(s.fiyat.toFixed(2));
                      setSymbolSearch([]);
                    }} style={{
                      padding: '8px 12px', cursor: 'pointer', fontSize: '11px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: '1px solid var(--border)',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div>
                        <span style={{ fontWeight: '700', color: 'var(--blue)' }}>{s.kod}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '10px' }}>{s.ad}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{s.fiyat.toFixed(2)}</span>
                        <span style={{ marginLeft: '6px', fontSize: '10px', color: s.degisimYuzde >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {s.degisimYuzde >= 0 ? '+' : ''}{s.degisimYuzde.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Adet */}
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', letterSpacing: '0.3px' }}>Adet</label>
              <input value={newQty} onChange={e => setNewQty(e.target.value)} placeholder="100" type="number" style={{
                backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-primary)',
                fontSize: '12px', width: '100px', outline: 'none',
              }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* Maliyet (otomatik doldurulur) */}
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', letterSpacing: '0.3px' }}>
                Ort. Maliyet {selectedStock && <span style={{ color: 'var(--green)' }}>(Guncel: {selectedStock.fiyat.toFixed(2)} TL)</span>}
              </label>
              <input value={newCost} onChange={e => setNewCost(e.target.value)} placeholder="250.50" type="number" step="0.01" style={{
                backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-primary)',
                fontSize: '12px', width: '140px', outline: 'none',
              }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <button onClick={handleAdd} style={{
              backgroundColor: 'var(--green)', border: 'none', color: '#000',
              padding: '8px 20px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              fontSize: '11px', fontWeight: '700', height: '36px', alignSelf: 'end',
            }}>
              Ekle
            </button>
          </div>

          {/* Secilen hisse bilgisi */}
          {selectedStock && (
            <div style={{
              marginTop: '10px', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border)',
              display: 'flex', gap: '16px', alignItems: 'center', fontSize: '11px',
            }}>
              <span style={{ fontWeight: '700', color: 'var(--blue)' }}>{selectedStock.kod}</span>
              <span style={{ color: 'var(--text-muted)' }}>{selectedStock.ad}</span>
              <span style={{ fontWeight: '700' }}>{selectedStock.fiyat.toFixed(2)} TL</span>
              <span style={{ color: selectedStock.degisimYuzde >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: '600' }}>
                {selectedStock.degisimYuzde >= 0 ? '+' : ''}{selectedStock.degisimYuzde.toFixed(2)}%
              </span>
              <span style={{ color: 'var(--text-muted)' }}>Hacim: {(selectedStock.hacim / 1e6).toFixed(1)}M</span>
              {newQty && <span style={{ color: 'var(--accent)', fontWeight: '600' }}>
                Toplam: {(parseFloat(newQty) * parseFloat(newCost || '0')).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
              </span>}
            </div>
          )}
        </div>
      )}

      {/* Portföy Tablosu */}
      {portfolio.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '48px', textAlign: 'center',
          color: 'var(--text-muted)', fontSize: '13px',
        }}>
          Portfoyunuz bos. Hisse ekleyerek baslayın.
        </div>
      ) : (
        <div style={{
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', overflow: 'hidden', overflowX: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Sinyal</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Hisse</th>
                <th style={thStyle}>Adet</th>
                <th style={thStyle}>Maliyet</th>
                <th style={thStyle}>Fiyat</th>
                <th style={thStyle}>Stop-Loss</th>
                <th style={thStyle}>Deger</th>
                <th style={thStyle}>K/Z</th>
                <th style={thStyle}>K/Z %</th>
                <th style={thStyle}>Skor</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {portfolioWithPrices.map((p) => {
                const sigColor = p.sig ? (SIG_COLORS[p.sig.signal] || 'var(--text-muted)') : 'var(--text-muted)';
                const isSellSignal = p.sig?.signal === 'SAT' || p.sig?.signal === 'GUCLU_SAT';
                const isProfit = p.pnlPercent >= 5;
                const isDanger = p.stopHit || p.pnlPercent <= -7;
                const rowBg = isDanger ? 'rgba(255,77,106,0.06)' : isSellSignal ? 'rgba(255,77,106,0.03)' : isProfit ? 'rgba(0,216,151,0.03)' : 'transparent';
                return (
                  <tr key={p.symbol}
                    style={{
                      borderBottom: '1px solid var(--border)', transition: 'background 0.15s',
                      backgroundColor: rowBg,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = rowBg)}
                  >
                    {/* Sinyal */}
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {p.sig ? (
                        <span style={{
                          fontSize: '8px', fontWeight: '700', letterSpacing: '0.3px',
                          color: p.sig.signal.includes('AL') ? '#000' : '#fff',
                          backgroundColor: sigColor, padding: '3px 7px', borderRadius: '3px',
                          display: 'inline-block', minWidth: '44px',
                        }}>
                          {p.sig.signalText}
                        </span>
                      ) : (
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>...</span>
                      )}
                    </td>

                    {/* Hisse */}
                    <td style={{ padding: '8px 10px' }}>
                      <a href={`/chart/${p.symbol}`} style={{
                        color: 'var(--accent)', textDecoration: 'none', fontWeight: '600', fontSize: '12px',
                      }}>{p.symbol}</a>
                    </td>

                    {/* Adet */}
                    <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>{p.quantity}</td>

                    {/* Maliyet */}
                    <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                      {p.avgCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Fiyat */}
                    <td style={{ ...tdStyle, fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                      {p.currentPrice > 0 ? p.currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '-'}
                    </td>

                    {/* Stop-Loss */}
                    <td style={{
                      ...tdStyle, fontVariantNumeric: 'tabular-nums', fontSize: '10px',
                      color: p.stopHit ? 'var(--red)' : 'var(--text-muted)',
                      fontWeight: p.stopHit ? '700' : '400',
                    }}>
                      {p.stopLoss.toFixed(2)}
                      {p.stopHit && <span style={{ color: 'var(--red)', marginLeft: '4px', fontSize: '9px' }}>TETIKLENDI</span>}
                    </td>

                    {/* Değer */}
                    <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                      {p.currentValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>

                    {/* K/Z */}
                    <td style={{
                      ...tdStyle, color: p.pnl >= 0 ? 'var(--green)' : 'var(--red)',
                      fontWeight: '600', fontVariantNumeric: 'tabular-nums',
                    }}>
                      {p.pnl >= 0 ? '+' : ''}{p.pnl.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>

                    {/* K/Z % */}
                    <td style={{
                      ...tdStyle, fontWeight: '600', fontVariantNumeric: 'tabular-nums',
                    }}>
                      <span style={{
                        color: p.pnlPercent >= 0 ? 'var(--green)' : 'var(--red)',
                        backgroundColor: p.pnlPercent >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
                        padding: '2px 6px', borderRadius: '3px', fontSize: '11px',
                      }}>
                        {p.pnlPercent >= 0 ? '+' : ''}{p.pnlPercent.toFixed(2)}%
                      </span>
                    </td>

                    {/* Skor */}
                    <td style={{ ...tdStyle }}>
                      {p.sig ? (
                        <a href={`/analiz/${p.symbol}`} style={{
                          fontSize: '13px', fontWeight: '700', color: sigColor,
                          textDecoration: 'none', fontVariantNumeric: 'tabular-nums',
                        }}>
                          {p.sig.score}
                        </a>
                      ) : (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>

                    {/* İşlemler */}
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button onClick={() => openEdit(p.symbol, 'buy')} style={{
                          backgroundColor: 'var(--green-bg)', border: '1px solid rgba(0,216,151,0.2)',
                          color: 'var(--green)', padding: '3px 7px', borderRadius: '3px',
                          cursor: 'pointer', fontSize: '9px', fontWeight: '600',
                        }}>
                          Ekle
                        </button>
                        <button onClick={() => openEdit(p.symbol, 'sell')} style={{
                          backgroundColor: 'var(--red-bg)', border: '1px solid rgba(255,77,106,0.2)',
                          color: 'var(--red)', padding: '3px 7px', borderRadius: '3px',
                          cursor: 'pointer', fontSize: '9px', fontWeight: '600',
                        }}>
                          Sat
                        </button>
                        <button onClick={() => handleRemove(p.symbol)} style={{
                          backgroundColor: 'transparent', border: '1px solid var(--border)',
                          color: 'var(--text-muted)', padding: '3px 6px', borderRadius: '3px',
                          cursor: 'pointer', fontSize: '9px',
                        }}>
                          X
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Edit Modal */}
          {editSymbol && (
            <div style={{
              padding: '14px 16px', borderTop: '1px solid var(--border)',
              backgroundColor: editMode === 'buy' ? 'rgba(0,216,151,0.03)' : 'rgba(255,77,106,0.03)',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <span style={{
                fontSize: '11px', fontWeight: '700',
                color: editMode === 'buy' ? 'var(--green)' : 'var(--red)',
                minWidth: '80px',
              }}>
                {editSymbol} {editMode === 'buy' ? 'EKLE' : 'SAT'}
              </span>
              <div>
                <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>Adet</label>
                <input value={editQty} onChange={e => setEditQty(e.target.value)} type="number" placeholder="100" style={{
                  backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border)',
                  borderRadius: '4px', padding: '6px 10px', color: 'var(--text-primary)',
                  fontSize: '12px', width: '100px', outline: 'none',
                }} />
              </div>
              {editMode === 'buy' && (
                <div>
                  <label style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>Alis Fiyati</label>
                  <input value={editCost} onChange={e => setEditCost(e.target.value)} type="number" step="0.01" placeholder="1.50" style={{
                    backgroundColor: 'var(--bg-hover)', border: '1px solid var(--border)',
                    borderRadius: '4px', padding: '6px 10px', color: 'var(--text-primary)',
                    fontSize: '12px', width: '100px', outline: 'none',
                  }} />
                </div>
              )}
              {editMode === 'buy' && editQty && editCost && (() => {
                const existing = portfolio.find(p => p.symbol === editSymbol);
                if (!existing) return null;
                const newQty = existing.quantity + parseFloat(editQty);
                const newAvg = ((existing.avgCost * existing.quantity) + (parseFloat(editCost) * parseFloat(editQty))) / newQty;
                return (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    <div>Yeni adet: <b style={{ color: 'var(--text-primary)' }}>{newQty}</b></div>
                    <div>Yeni ort: <b style={{ color: 'var(--accent)' }}>{newAvg.toFixed(2)} TL</b></div>
                  </div>
                );
              })()}
              {editMode === 'sell' && editQty && (() => {
                const existing = portfolio.find(p => p.symbol === editSymbol);
                if (!existing) return null;
                const remaining = existing.quantity - parseFloat(editQty);
                return (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Kalan: <b style={{ color: remaining > 0 ? 'var(--text-primary)' : 'var(--red)' }}>{remaining > 0 ? remaining : 'Tamami satilacak'}</b>
                  </div>
                );
              })()}
              <button onClick={handleEdit} style={{
                backgroundColor: editMode === 'buy' ? 'var(--green)' : 'var(--red)',
                border: 'none', color: '#000', padding: '6px 16px', borderRadius: '4px',
                cursor: 'pointer', fontSize: '11px', fontWeight: '700',
              }}>
                {editMode === 'buy' ? 'Ekle' : 'Sat'}
              </button>
              <button onClick={() => setEditSymbol(null)} style={{
                backgroundColor: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-muted)', padding: '6px 12px', borderRadius: '4px',
                cursor: 'pointer', fontSize: '11px',
              }}>
                Iptal
              </button>
            </div>
          )}

          {/* Alt: Uyarılar */}
          {satCount > 0 && (
            <div style={{
              padding: '12px 16px', borderTop: '1px solid var(--border)',
              backgroundColor: 'var(--red-bg)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--red)' }} />
              <span style={{ fontSize: '11px', color: 'var(--red)', fontWeight: '600' }}>
                DIKKAT: Portfoyunuzdeki {satCount} hisse SAT sinyali veriyor. Detayli analiz icin hisse ismine tiklayin.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, suffix, color }: { label: string; value: string; suffix?: string; color?: string }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '14px 16px',
    }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.3px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '18px', fontWeight: '700', color: color || 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        {suffix && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{suffix}</span>}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'right', fontWeight: '500',
  color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '0.5px',
  textTransform: 'uppercase', borderBottom: '1px solid var(--border)',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'right', fontSize: '12px',
};
