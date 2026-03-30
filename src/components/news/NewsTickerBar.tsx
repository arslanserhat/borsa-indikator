'use client';

import { useNewsTicker } from '@/hooks/useNews';

export default function NewsTickerBar() {
  const { items, loading } = useNewsTicker();

  if (loading || items.length === 0) return null;

  const content = items.map((item, i) => (
    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      {/* Kaynak dot */}
      <span style={{
        width: '4px',
        height: '4px',
        borderRadius: '50%',
        backgroundColor: item.isKAP ? '#f7931a' : '#4a7cff',
        marginRight: '6px',
        flexShrink: 0,
      }} />

      {/* Haber başlığı */}
      <a
        href={`/haberler/${item.isKAP ? 'kap' : 'bht'}-${encodeURIComponent(item.url)}`}
        style={{
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        onClick={(e) => {
          e.preventDefault();
          window.location.href = `/haberler`;
        }}
      >
        {item.title}
      </a>

      {/* Sembol */}
      {item.symbol && (
        <a
          href={`/chart/${item.symbol}`}
          style={{
            color: '#f7931a',
            textDecoration: 'none',
            marginLeft: '4px',
            fontWeight: '600',
            fontSize: '10px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {item.symbol}
        </a>
      )}

      {/* Separator */}
      {i < items.length - 1 && (
        <span style={{ margin: '0 24px', color: 'var(--border)', fontSize: '8px' }}>|</span>
      )}
    </span>
  ));

  return (
    <div style={{
      overflow: 'hidden',
      flex: 1,
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      maskImage: 'linear-gradient(to right, transparent 0%, black 2%, black 98%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 2%, black 98%, transparent 100%)',
    }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          animation: 'ticker-scroll 120s linear infinite',
          fontSize: '11px',
          fontWeight: '400',
          letterSpacing: '0.1px',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = 'paused')}
        onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = 'running')}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', paddingRight: '80px' }}>{content}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', paddingRight: '80px' }}>{content}</span>
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
