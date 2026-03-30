'use client';

import { useState, useEffect, useCallback } from 'react';

interface SummaryItem {
  kod: string;
  fiyat: number;
  degisimYuzde: number;
  degisim: number;
  ad: string;
}

export default function MarketSummary() {
  const [endeksler, setEndeksler] = useState<SummaryItem[]>([]);
  const [doviz, setDoviz] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/stocks?type=summary');
      if (res.ok) {
        const json = await res.json();
        setEndeksler(json.endeksler || []);
        setDoviz(json.doviz || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius)',
            padding: '14px',
            height: '80px',
            animation: 'shimmer 1.5s ease-in-out infinite',
          }} />
        ))}
        <style>{`@keyframes shimmer { 0%,100%{opacity:.3} 50%{opacity:.6} }`}</style>
      </div>
    );
  }

  const allCards = [
    ...endeksler.map(e => ({ ...e, type: 'index' as const })),
    ...doviz.map(d => ({ ...d, type: 'fx' as const })),
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
      {allCards.map((card, i) => {
        const isUp = card.degisimYuzde >= 0;
        return (
          <div key={i} style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '14px 16px',
            transition: 'border-color 0.2s, transform 0.15s',
            cursor: 'default',
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = isUp ? 'rgba(0,216,151,0.3)' : 'rgba(255,77,106,0.3)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>
                {card.kod}
              </span>
              <span style={{
                fontSize: '8px', fontWeight: '600', color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-hover)', padding: '2px 5px',
                borderRadius: '3px', letterSpacing: '0.5px',
              }}>
                {card.type === 'index' ? 'ENDEKS' : 'DÖVİZ'}
              </span>
            </div>
            <div style={{
              fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums', marginBottom: '6px',
            }}>
              {card.fiyat?.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: card.type === 'fx' ? 4 : 2 })}
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{
                fontSize: '11px', fontWeight: '600',
                color: isUp ? 'var(--green)' : 'var(--red)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {isUp ? '+' : ''}{card.degisimYuzde?.toFixed(2)}%
              </span>
              <span style={{
                fontSize: '10px', fontWeight: '500',
                color: isUp ? 'var(--green)' : 'var(--red)',
                opacity: 0.7,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {isUp ? '+' : ''}{card.degisim?.toFixed(2)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
