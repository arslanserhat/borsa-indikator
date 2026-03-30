'use client';

import { useState, useMemo } from 'react';
import { Stock } from '@/types/stock';
import Link from 'next/link';

interface Props {
  stocks: Stock[];
  loading: boolean;
  lastUpdate: Date | null;
  showActions?: boolean;
  onAddWatchlist?: (symbol: string) => void;
}

type SortField = 'kod' | 'fiyat' | 'degisimYuzde' | 'hacim';
type SortDir = 'asc' | 'desc';

export default function StockTable({ stocks, loading, lastUpdate, showActions, onAddWatchlist }: Props) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('hacim');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    let result = stocks.filter(s =>
      s.kod.toLowerCase().includes(search.toLowerCase()) ||
      s.ad.toLowerCase().includes(search.toLowerCase())
    );

    result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [stocks, search, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span style={{ opacity: 0.2, marginLeft: '4px' }}>&#8597;</span>;
    return <span style={{ marginLeft: '4px', color: 'var(--accent)' }}>{sortDir === 'asc' ? '&#8593;' : '&#8595;'}</span>;
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', padding: '40px',
        textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px',
      }}>
        <div style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}>Veriler yükleniyor...</div>
        <style>{`@keyframes shimmer { 0%,100%{opacity:.3} 50%{opacity:.8} }`}</style>
      </div>
    );
  }

  return (
    <div>
      {/* Arama ve info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Hisse ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '9px 14px 9px 36px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              width: '280px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {filtered.length} hisse
          {lastUpdate && ` \u00B7 ${lastUpdate.toLocaleTimeString('tr-TR')}`}
        </span>
      </div>

      {/* Tablo */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th onClick={() => handleSort('kod')} style={thStyle}>
                Sembol <SortIcon field="kod" />
              </th>
              <th style={{ ...thStyle, textAlign: 'left', cursor: 'default' }}>Sirket</th>
              <th onClick={() => handleSort('fiyat')} style={thStyle}>
                Fiyat <SortIcon field="fiyat" />
              </th>
              <th onClick={() => handleSort('degisimYuzde')} style={thStyle}>
                Degisim <SortIcon field="degisimYuzde" />
              </th>
              <th style={{ ...thStyle, cursor: 'default' }}>Dusuk</th>
              <th style={{ ...thStyle, cursor: 'default' }}>Yuksek</th>
              <th onClick={() => handleSort('hacim')} style={thStyle}>
                Hacim <SortIcon field="hacim" />
              </th>
              {showActions && <th style={{ ...thStyle, cursor: 'default' }}></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((stock) => {
              const isUp = stock.degisimYuzde >= 0;
              return (
                <tr
                  key={stock.kod}
                  style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={tdStyle}>
                    <Link href={`/chart/${stock.kod}`} style={{
                      color: 'var(--accent)', textDecoration: 'none', fontWeight: '600',
                      fontSize: '12px', letterSpacing: '0.3px',
                    }}>
                      {stock.kod}
                    </Link>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'left', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '11px' }}>
                    {stock.ad}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                    {stock.fiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{
                    ...tdStyle,
                    color: isUp ? 'var(--green)' : 'var(--red)',
                    fontWeight: '600',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {isUp ? '+' : ''}{stock.degisimYuzde.toFixed(2)}%
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {stock.dusuk > 0 ? stock.dusuk.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '-'}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {stock.yuksek > 0 ? stock.yuksek.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '-'}
                  </td>
                  <td style={{ ...tdStyle, fontVariantNumeric: 'tabular-nums' }}>
                    {formatVolume(stock.hacim)}
                  </td>
                  {showActions && (
                    <td style={tdStyle}>
                      <button
                        onClick={() => onAddWatchlist?.(stock.kod)}
                        style={{
                          backgroundColor: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--accent)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: '600',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--accent-bg)';
                          e.currentTarget.style.borderColor = 'var(--accent)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.borderColor = 'var(--border)';
                        }}
                      >
                        Takip Et
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'right',
  fontWeight: '500',
  color: 'var(--text-muted)',
  fontSize: '10px',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border)',
};

const tdStyle: React.CSSProperties = {
  padding: '9px 16px',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  fontSize: '12px',
};

function formatVolume(vol: number): string {
  if (!vol || vol === 0) return '-';
  if (vol >= 1_000_000_000) return (vol / 1_000_000_000).toFixed(1) + 'B';
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
  if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'K';
  return vol.toLocaleString('tr-TR');
}
