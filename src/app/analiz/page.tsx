'use client';

import { useState } from 'react';
import { useStockData } from '@/hooks/useStockData';

const POPULAR = ['THYAO', 'GARAN', 'AKBNK', 'EREGL', 'SISE', 'BIMAS', 'ASELS', 'KCHOL', 'SAHOL', 'TUPRS', 'FROTO', 'TOASO'];

export default function AnalysisLandingPage() {
  const { stocks, loading } = useStockData();
  const [search, setSearch] = useState('');

  const filtered = search.length >= 2
    ? stocks.filter(s =>
        s.kod.toLowerCase().includes(search.toLowerCase()) ||
        s.ad.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 20)
    : [];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          Hisse Analizi
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Teknik analiz, mum formasyonlari ve haber duygu analizi ile AL/SAT sinyali
        </p>
      </div>

      {/* Arama */}
      <div style={{ position: 'relative', marginBottom: '32px' }}>
        <input
          type="text"
          placeholder="Hisse kodu veya sirket adi yazin..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '14px 20px 14px 44px',
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text-primary)',
            fontSize: '14px', outline: 'none', transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"
          style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>

        {/* Arama sonuçları */}
        {filtered.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', marginTop: '4px', maxHeight: '300px', overflow: 'auto',
          }}>
            {filtered.map((s) => (
              <a key={s.kod} href={`/analiz/${s.kod}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 16px', textDecoration: 'none', borderBottom: '1px solid var(--border)',
                transition: 'background 0.15s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent)' }}>{s.kod}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>{s.ad}</span>
                </div>
                <span style={{
                  fontSize: '12px', fontWeight: '600',
                  color: s.degisimYuzde >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {s.degisimYuzde >= 0 ? '+' : ''}{s.degisimYuzde.toFixed(2)}%
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Popüler hisseler */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.3px' }}>
          Populer Hisseler
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
          {POPULAR.map((sym) => {
            const stock = stocks.find(s => s.kod === sym);
            return (
              <a key={sym} href={`/analiz/${sym}`} style={{
                backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '14px', textDecoration: 'none',
                transition: 'all 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent)', marginBottom: '4px' }}>{sym}</div>
                {stock && (
                  <>
                    <div style={{ fontSize: '13px', fontWeight: '600', fontVariantNumeric: 'tabular-nums', marginBottom: '2px' }}>
                      {stock.fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{
                      fontSize: '11px', fontWeight: '600',
                      color: stock.degisimYuzde >= 0 ? 'var(--green)' : 'var(--red)',
                    }}>
                      {stock.degisimYuzde >= 0 ? '+' : ''}{stock.degisimYuzde.toFixed(2)}%
                    </div>
                  </>
                )}
                {!stock && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Analiz Et</div>}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
