'use client';

import { NewsItem } from '@/types/news';
import NewsCard from './NewsCard';

interface Props {
  news: NewsItem[];
  loading: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export default function NewsList({ news, loading, hasMore, onLoadMore }: Props) {
  if (loading && news.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '18px',
              height: '90px',
              animation: 'shimmer 1.5s ease-in-out infinite',
            }}
          />
        ))}
        <style>{`@keyframes shimmer { 0%,100%{opacity:.2} 50%{opacity:.5} }`}</style>
      </div>
    );
  }

  if (!loading && news.length === 0) {
    return (
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '48px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '13px',
      }}>
        Haber bulunamadi
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {news.map((item) => (
        <NewsCard key={item.id} item={item} />
      ))}

      {hasMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          style={{
            padding: '10px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
            cursor: loading ? 'wait' : 'pointer',
            fontSize: '11px',
            fontWeight: '600',
            textAlign: 'center',
            transition: 'all 0.15s',
            letterSpacing: '0.3px',
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        >
          {loading ? 'Yukleniyor...' : 'Daha Fazla'}
        </button>
      )}
    </div>
  );
}
