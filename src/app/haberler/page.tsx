'use client';

import { useState, Suspense } from 'react';
import { useNews } from '@/hooks/useNews';
import NewsList from '@/components/news/NewsList';
import { useSearchParams } from 'next/navigation';
import { useIsMobile } from '@/hooks/useIsMobile';

// Suspense wrapper gerekli (useSearchParams static generation'da lazım)
export default function HaberlerWrapper() {
  return <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Yukleniyor...</div>}><HaberlerPage /></Suspense>;
}

const TABS = [
  { key: 'all', label: 'Tumu' },
  { key: 'kap', label: 'KAP' },
  { key: 'bloomberg', label: 'Bloomberg HT' },
];

function HaberlerPage() {
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const symbolFilter = searchParams.get('symbol') || '';
  const [activeTab, setActiveTab] = useState('all');
  const { news, loading, hasMore, total, loadMore } = useNews(activeTab);

  const filteredNews = symbolFilter
    ? news.filter(
        (n) =>
          n.relatedSymbols.some((s) => s.toUpperCase() === symbolFilter.toUpperCase()) ||
          n.title.toUpperCase().includes(symbolFilter.toUpperCase()) ||
          n.summary.toUpperCase().includes(symbolFilter.toUpperCase())
      )
    : news;

  return (
    <div>
      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.3px' }}>
            Haberler
            {symbolFilter && (
              <span style={{ fontSize: '14px', color: 'var(--accent)', marginLeft: '8px', fontWeight: '500' }}>
                / {symbolFilter}
              </span>
            )}
          </h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
            {symbolFilter ? filteredNews.length : total} sonuc
          </span>
        </div>
      </div>

      {/* Filtre */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', alignItems: 'center' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '7px 14px',
              fontSize: '11px',
              fontWeight: '600',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid',
              borderColor: activeTab === tab.key ? 'var(--accent)' : 'var(--border)',
              backgroundColor: activeTab === tab.key ? 'var(--accent-bg)' : 'transparent',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              letterSpacing: '0.3px',
            }}
          >
            {tab.label}
          </button>
        ))}

        {symbolFilter && (
          <a
            href="/haberler"
            style={{
              padding: '7px 14px',
              fontSize: '11px',
              fontWeight: '600',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(255,77,106,0.3)',
              backgroundColor: 'var(--red-bg)',
              color: 'var(--red)',
              textDecoration: 'none',
              marginLeft: '4px',
            }}
          >
            Filtreyi Kaldir
          </a>
        )}
      </div>

      {/* İki kolon */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: '12px' }}>
        <NewsList
          news={filteredNews}
          loading={loading}
          hasMore={!symbolFilter && hasMore}
          onLoadMore={loadMore}
        />

        {/* Sağ panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px',
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '14px', color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>
              Kaynaklar
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>KAP</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Resmi bildirimler</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--blue)' }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>Bloomberg HT</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Piyasa haberleri</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px',
          }}>
            <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '14px', color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>
              Istatistik
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>KAP</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  {news.filter((n) => n.source === 'kap').length}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bloomberg HT</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>
                  {news.filter((n) => n.source === 'bloomberg').length}
                </span>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Toplam</span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {total}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
