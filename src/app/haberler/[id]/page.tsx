'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NewsItem } from '@/types/news';

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Az once';
  if (diff < 3600) return `${Math.floor(diff / 60)} dakika once`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} saat once`;
  return `${Math.floor(diff / 86400)} gun once`;
}

export default function NewsDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState<NewsItem | null>(null);
  const [relatedNews, setRelatedNews] = useState<NewsItem[]>([]);
  const [fullContent, setFullContent] = useState<string>('');
  const [contentLoading, setContentLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNews() {
      try {
        const res = await fetch('/api/news?limit=200&source=all');
        const data = await res.json();
        const allNews: NewsItem[] = data.data || [];
        let found = allNews.find((n: NewsItem) => n.id === id);

        if (!found && typeof id === 'string') {
          if (id.startsWith('kap-')) {
            const disclosureIndex = id.replace('kap-', '');
            found = {
              id: id as string, title: 'KAP Bildirimi', summary: '',
              url: `https://www.kap.org.tr/tr/Bildirim/${disclosureIndex}`,
              source: 'kap', category: 'bildirim',
              publishedAt: new Date().toISOString(), relatedSymbols: [],
            };
            try {
              const kapRes = await fetch('/api/news?limit=200&source=kap');
              const kapData = await kapRes.json();
              const kapFound = (kapData.data || []).find((n: NewsItem) => n.id === id);
              if (kapFound) found = kapFound;
            } catch {}
          }
        }

        setItem(found || null);

        if (found && found.url) {
          setContentLoading(true);
          try {
            const detailRes = await fetch(`/api/news/detail?url=${encodeURIComponent(found.url)}&source=${found.source}`);
            const detailData = await detailRes.json();
            if (detailData.content) setFullContent(detailData.content);
          } catch {} finally { setContentLoading(false); }
        }

        if (found) {
          const related = allNews.filter((n: NewsItem) =>
            n.id !== found!.id && (
              n.relatedSymbols.some((s) => found!.relatedSymbols.includes(s)) ||
              (found!.source === n.source)
            )
          ).slice(0, 5);
          setRelatedNews(related);
        }
      } catch { setItem(null); }
      finally { setLoading(false); }
    }
    fetchNews();
  }, [id]);

  // Loading state
  if (loading) {
    return (
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ height: '16px', width: '40%', backgroundColor: 'var(--bg-card)', borderRadius: '6px', marginBottom: '12px' }} />
            {[100, 90, 60].map((w, i) => (
              <div key={i} style={{
                height: i === 0 ? '24px' : '14px', width: `${w}%`,
                backgroundColor: 'var(--bg-card)', borderRadius: '6px',
                marginBottom: i === 0 ? '20px' : '10px',
                animation: 'ld 1.5s ease-in-out infinite',
              }} />
            ))}
            <div style={{
              height: '300px', backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius)', marginTop: '20px',
              animation: 'ld 1.5s ease-in-out infinite',
            }} />
          </div>
          <div style={{ width: '280px' }}>
            <div style={{
              height: '300px', backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              animation: 'ld 1.5s ease-in-out infinite',
            }} />
          </div>
        </div>
        <style>{`@keyframes ld { 0%,100%{opacity:.15} 50%{opacity:.3} }`}</style>
      </div>
    );
  }

  // Not found
  if (!item) {
    return (
      <div style={{ maxWidth: '500px', margin: '80px auto', textAlign: 'center' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          backgroundColor: 'var(--bg-card)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: '24px', color: 'var(--text-muted)',
        }}>?</div>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Haber Bulunamadi</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Bu icerik artik mevcut degil veya kaldirilmis olabilir.
        </p>
        <button
          onClick={() => router.push('/haberler')}
          style={{
            padding: '10px 28px', fontSize: '12px', fontWeight: '600',
            backgroundColor: 'var(--accent)', color: '#000', border: 'none',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer', letterSpacing: '0.3px',
          }}
        >
          Haberlere Don
        </button>
      </div>
    );
  }

  const isKAP = item.source === 'kap';

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Geri */}
      <button
        onClick={() => router.back()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '12px', color: 'var(--text-muted)', backgroundColor: 'transparent',
          border: 'none', cursor: 'pointer', padding: '0', marginBottom: '20px',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        &#8592; Geri
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth < 768 ? '1fr' : '1fr 280px', gap: '16px' }}>
        {/* Sol kolon */}
        <div>
          {/* Üst bilgi çubuğu */}
          <div style={{
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Kaynak */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                backgroundColor: isKAP ? 'var(--accent-bg)' : 'var(--blue-bg)',
                border: `1px solid ${isKAP ? 'rgba(247,147,26,0.2)' : 'rgba(74,124,255,0.2)'}`,
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  backgroundColor: isKAP ? 'var(--accent)' : 'var(--blue)',
                }} />
                <span style={{
                  fontSize: '11px', fontWeight: '700',
                  color: isKAP ? 'var(--accent)' : 'var(--blue)',
                  letterSpacing: '0.5px',
                }}>
                  {isKAP ? 'KAP BILDIRIMI' : 'BLOOMBERG HT'}
                </span>
              </div>

              {/* Kategori */}
              <span style={{
                fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-hover)', padding: '4px 8px',
                borderRadius: '4px', letterSpacing: '0.5px', textTransform: 'uppercase',
              }}>
                {item.category === 'bildirim' ? 'Bildirim' : item.category === 'analiz' ? 'Analiz' : 'Haber'}
              </span>
            </div>

            {/* Tarih */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>
                {timeAgo(item.publishedAt)}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {formatFullDate(item.publishedAt)}
              </div>
            </div>
          </div>

          {/* Başlık */}
          <h1 style={{
            fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)',
            lineHeight: '1.4', marginBottom: '16px', letterSpacing: '-0.3px',
          }}>
            {item.title}
          </h1>

          {/* Meta bilgiler - semboller ve şirket */}
          {(item.relatedSymbols.length > 0 || (item as any).companyTitle) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              marginBottom: '20px', flexWrap: 'wrap',
            }}>
              {item.relatedSymbols.map((sym) => (
                <a
                  key={sym}
                  href={`/chart/${sym}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontSize: '12px', fontWeight: '600', color: 'var(--accent)',
                    backgroundColor: 'var(--accent-bg)', padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)', textDecoration: 'none',
                    border: '1px solid rgba(247,147,26,0.15)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(247,147,26,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--accent-bg)';
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  {sym}
                </a>
              ))}
            </div>
          )}

          {/* Gorsel */}
          {item.source === 'bloomberg' && item.imageUrl && (
            <div style={{
              borderRadius: 'var(--radius)', overflow: 'hidden',
              border: '1px solid var(--border)', marginBottom: '16px',
            }}>
              <img src={item.imageUrl} alt={item.title}
                style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
          )}

          {/* Ana icerik */}
          <div style={{
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', overflow: 'hidden',
          }}>
            {/* İçerik başlığı */}
            <div style={{
              padding: '12px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{
                width: '3px', height: '12px', borderRadius: '2px',
                backgroundColor: isKAP ? 'var(--accent)' : 'var(--blue)',
              }} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.3px' }}>
                {isKAP ? 'Bildirim Detayi' : 'Haber Icerigi'}
              </span>
            </div>

            {/* İçerik body */}
            <div style={{ padding: '20px' }}>
              {contentLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[100, 95, 80, 90, 70, 85, 60, 92, 75].map((w, i) => (
                    <div key={i} style={{
                      height: '13px', width: `${w}%`, backgroundColor: 'var(--bg-hover)',
                      borderRadius: '4px', animation: 'ld 1.5s ease-in-out infinite',
                    }} />
                  ))}
                  <style>{`@keyframes ld { 0%,100%{opacity:.15} 50%{opacity:.35} }`}</style>
                </div>
              ) : fullContent ? (
                <div style={{
                  fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: '2',
                  letterSpacing: '0.1px',
                }}>
                  {fullContent.split('\n').map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return <div key={i} style={{ height: '12px' }} />;

                    // Büyük harfli satırlar başlık olabilir
                    const isHeading = trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 80;

                    if (isHeading) {
                      return (
                        <div key={i} style={{
                          fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)',
                          marginTop: '20px', marginBottom: '8px',
                          paddingBottom: '6px', borderBottom: '1px solid var(--border)',
                        }}>
                          {trimmed}
                        </div>
                      );
                    }

                    // Madde işaretli satırlar
                    if (trimmed.startsWith('—') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
                      return (
                        <div key={i} style={{
                          display: 'flex', gap: '8px', marginBottom: '6px',
                          paddingLeft: '8px',
                        }}>
                          <span style={{ color: 'var(--accent)', fontWeight: '700', flexShrink: 0 }}>&#8250;</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{trimmed.replace(/^[-—*]\s*/, '')}</span>
                        </div>
                      );
                    }

                    return (
                      <p key={i} style={{ margin: '0 0 8px 0', color: 'var(--text-secondary)' }}>
                        {trimmed}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.8', margin: 0 }}>
                  {item.summary || item.title}
                </p>
              )}
            </div>
          </div>

          {/* Alt aksiyonlar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px',
          }}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)',
                padding: '8px 16px', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', textDecoration: 'none',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-light)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Orijinal Kaynakta Gor
            </a>

            {item.relatedSymbols[0] && (
              <a
                href={`/chart/${item.relatedSymbols[0]}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '11px', fontWeight: '600', color: 'var(--accent)',
                  padding: '8px 16px', border: '1px solid rgba(247,147,26,0.2)',
                  borderRadius: 'var(--radius-sm)', textDecoration: 'none',
                  backgroundColor: 'var(--accent-bg)', transition: 'all 0.15s',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                {item.relatedSymbols[0]} Grafigi
              </a>
            )}
          </div>
        </div>

        {/* Sag kolon */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Bildirim detay kartı (KAP için) */}
          {isKAP && (
            <div style={{
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 14px', borderBottom: '1px solid var(--border)',
                fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)',
                letterSpacing: '0.3px',
              }}>
                Bildirim Bilgileri
              </div>
              <div style={{ padding: '14px' }}>
                {[
                  { label: 'Kaynak', value: 'KAP', color: 'var(--accent)' },
                  { label: 'Tur', value: item.category === 'bildirim' ? 'Ozel Durum' : 'Genel', color: 'var(--text-primary)' },
                  { label: 'Tarih', value: formatFullDate(item.publishedAt).split(',')[0], color: 'var(--text-primary)' },
                  { label: 'Saat', value: formatFullDate(item.publishedAt).split(',')[1]?.trim() || '', color: 'var(--text-primary)' },
                  ...(item.relatedSymbols.length > 0 ? [{ label: 'Hisse', value: item.relatedSymbols.join(', '), color: 'var(--accent)' }] : []),
                ].map((row, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 0',
                    borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* İlgili haberler */}
          <div style={{
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 14px', borderBottom: '1px solid var(--border)',
              fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)',
              letterSpacing: '0.3px',
            }}>
              Ilgili Haberler
            </div>

            {relatedNews.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                Ilgili haber bulunamadi
              </div>
            ) : (
              relatedNews.map((n) => (
                <a
                  key={n.id}
                  href={`/haberler/${n.id}`}
                  style={{
                    display: 'block', padding: '10px 14px',
                    borderBottom: '1px solid var(--border)',
                    textDecoration: 'none', transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{
                      width: '4px', height: '4px', borderRadius: '50%',
                      backgroundColor: n.source === 'kap' ? 'var(--accent)' : 'var(--blue)',
                    }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {timeAgo(n.publishedAt)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '12px', color: 'var(--text-primary)', fontWeight: '500',
                    lineHeight: '1.4', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {n.title}
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
