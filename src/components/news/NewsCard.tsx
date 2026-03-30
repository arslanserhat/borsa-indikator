'use client';

import { NewsItem } from '@/types/news';

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Az once';
  if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
  return `${Math.floor(diff / 86400)}g`;
}

export default function NewsCard({ item }: { item: NewsItem }) {
  const isKAP = item.source === 'kap';

  return (
    <a
      href={`/haberler/${item.id}`}
      style={{
        display: 'block',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '16px 18px',
        textDecoration: 'none',
        transition: 'border-color 0.2s, transform 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-light)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Üst: kaynak + zaman */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '4px', height: '4px', borderRadius: '50%',
            backgroundColor: isKAP ? 'var(--accent)' : 'var(--blue)',
          }} />
          <span style={{
            fontSize: '10px', fontWeight: '600', color: isKAP ? 'var(--accent)' : 'var(--blue)',
            letterSpacing: '0.5px',
          }}>
            {isKAP ? 'KAP' : 'BLOOMBERG HT'}
          </span>
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {timeAgo(item.publishedAt)}
        </span>
      </div>

      {/* Başlık */}
      <h4 style={{
        fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)',
        marginBottom: '6px', lineHeight: '1.5', letterSpacing: '-0.1px',
      }}>
        {item.title}
      </h4>

      {/* Özet */}
      {item.summary && item.summary !== item.title && (
        <p style={{
          fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5',
          marginBottom: '10px',
        }}>
          {item.summary.slice(0, 150)}{item.summary.length > 150 ? '...' : ''}
        </p>
      )}

      {/* Semboller */}
      {item.relatedSymbols.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {item.relatedSymbols.slice(0, 5).map((sym) => (
            <span
              key={sym}
              style={{
                fontSize: '10px', fontWeight: '600', color: 'var(--accent)',
                backgroundColor: 'var(--accent-bg)', padding: '2px 7px',
                borderRadius: '4px',
              }}
            >
              {sym}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}
