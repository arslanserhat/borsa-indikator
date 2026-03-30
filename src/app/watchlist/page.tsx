'use client';

import { useState, useEffect, useMemo } from 'react';
import { useStockData } from '@/hooks/useStockData';
import { getWatchlist, removeFromWatchlist } from '@/lib/storage';
import Link from 'next/link';

export default function WatchlistPage() {
  const { stocks, loading, lastUpdate } = useStockData();
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    setWatchlist(getWatchlist());
  }, []);

  const watchlistStocks = useMemo(() =>
    stocks.filter(s => watchlist.includes(s.kod)),
    [stocks, watchlist]
  );

  const handleRemove = (symbol: string) => {
    const updated = removeFromWatchlist(symbol);
    setWatchlist(updated);
  };

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>
        ⭐ Takip Listesi
      </h2>

      {watchlist.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '40px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}>
          <p style={{ fontSize: '16px', marginBottom: '8px' }}>Takip listeniz boş</p>
          <p style={{ fontSize: '13px' }}>
            <Link href="/market" style={{ color: 'var(--blue)', textDecoration: 'none' }}>
              Piyasa sayfasından
            </Link> hisse ekleyebilirsiniz.
          </p>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
                <th style={thStyle}>Sembol</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>Şirket</th>
                <th style={thStyle}>Fiyat</th>
                <th style={thStyle}>Değişim %</th>
                <th style={thStyle}>Hacim</th>
                <th style={thStyle}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Yükleniyor...</td></tr>
              ) : watchlistStocks.map((s) => {
                const isUp = s.degisimYuzde >= 0;
                return (
                  <tr key={s.kod} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={tdStyle}>
                      <Link href={`/chart/${s.kod}`} style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 'bold' }}>
                        {s.kod}
                      </Link>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>{s.ad}</td>
                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>
                      {s.fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ ...tdStyle, color: isUp ? 'var(--green)' : 'var(--red)', fontWeight: 'bold' }}>
                      {isUp ? '▲' : '▼'} %{Math.abs(s.degisimYuzde).toFixed(2)}
                    </td>
                    <td style={tdStyle}>{formatVol(s.hacim)}</td>
                    <td style={tdStyle}>
                      <button onClick={() => handleRemove(s.kod)} style={{
                        backgroundColor: 'transparent',
                        border: '1px solid var(--red)',
                        color: 'var(--red)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px',
                      }}>
                        Kaldır
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lastUpdate && (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '12px' }}>
          Son güncelleme: {lastUpdate.toLocaleTimeString('tr-TR')} • 15 saniyede bir yenilenir
        </p>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: 'var(--text-secondary)', fontSize: '12px' };
const tdStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'right' };

function formatVol(v: number): string {
  if (!v) return '-';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toString();
}
