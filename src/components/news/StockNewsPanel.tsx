'use client';

import { useStockNews } from '@/hooks/useNews';
import { NewsItem } from '@/types/news';

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Az once';
  if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
  return `${Math.floor(diff / 86400)}g`;
}

export default function StockNewsPanel({ symbol }: { symbol: string }) {
  const { news, loading } = useStockNews(symbol);

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
    }}>
      {/* Başlık */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '3px', height: '14px', borderRadius: '2px',
            backgroundColor: 'var(--accent)', display: 'inline-block',
          }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Haberler
          </span>
          {!loading && news.length > 0 && (
            <span style={{
              fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px',
            }}>
              {news.length}
            </span>
          )}
        </div>
        <a
          href={`/haberler?symbol=${symbol}`}
          style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.15s' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          Tumunu Gor
        </a>
      </div>

      {/* İçerik */}
      {loading ? (
        <div style={{ padding: '0' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ height: '12px', width: '70%', backgroundColor: 'var(--bg-hover)', borderRadius: '4px', animation: 'sh 1.5s ease-in-out infinite' }} />
            </div>
          ))}
          <style>{`@keyframes sh { 0%,100%{opacity:.2} 50%{opacity:.5} }`}</style>
        </div>
      ) : news.length === 0 ? (
        <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          Bu hisse icin haber bulunamadi
        </div>
      ) : (
        news.slice(0, 6).map((item) => (
          <a
            key={item.id}
            href={`/haberler/${item.id}`}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '10px 18px', borderBottom: '1px solid var(--border)',
              textDecoration: 'none', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span style={{
              width: '4px', height: '4px', borderRadius: '50%', marginTop: '6px', flexShrink: 0,
              backgroundColor: item.source === 'kap' ? 'var(--accent)' : 'var(--blue)',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500', lineHeight: '1.4',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {item.title}
              </div>
              {item.summary && item.summary !== item.title && (
                <div style={{
                  fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.summary}
                </div>
              )}
            </div>
            <span style={{
              fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap',
              marginTop: '2px', flexShrink: 0, fontVariantNumeric: 'tabular-nums',
            }}>
              {timeAgo(item.publishedAt)}
            </span>
          </a>
        ))
      )}
    </div>
  );
}
