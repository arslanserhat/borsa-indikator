import { NextResponse } from 'next/server';
import { aggregateNews } from '@/lib/news';
import { TickerItem } from '@/types/news';

export const dynamic = 'force-dynamic';

let cachedTicker: TickerItem[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 15_000; // 15 saniye - daha güncel haberler

export async function GET() {
  try {
    const now = Date.now();

    if (now - lastFetchTime > CACHE_TTL || cachedTicker.length === 0) {
      const news = await aggregateNews();

      // Son 24 saatteki haberleri filtrele, en güncel önce
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const recentNews = news.filter(
        (item) => new Date(item.publishedAt).getTime() > oneDayAgo
      );

      // Güncel haberler varsa onları, yoksa tüm haberleri göster
      const source = recentNews.length >= 5 ? recentNews : news;

      cachedTicker = source.slice(0, 20).map((item) => ({
        title: item.title.length > 100 ? item.title.slice(0, 97) + '...' : item.title,
        symbol: item.relatedSymbols[0] || undefined,
        url: item.url,
        isKAP: item.source === 'kap',
        source: item.source,
      }));
      lastFetchTime = now;
    }

    return NextResponse.json({
      items: cachedTicker,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ items: [], error: 'Ticker yüklenemedi' }, { status: 500 });
  }
}
