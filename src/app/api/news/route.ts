import { NextResponse } from 'next/server';
import { aggregateNews } from '@/lib/news';
import { NewsItem } from '@/types/news';

export const dynamic = 'force-dynamic';

let cachedNews: NewsItem[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 60_000; // 60 saniye

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '30');
    const source = searchParams.get('source') || 'all'; // all, kap, bloomberg

    const now = Date.now();
    let cached = false;

    if (now - lastFetchTime > CACHE_TTL || cachedNews.length === 0) {
      cachedNews = await aggregateNews();
      lastFetchTime = now;
    } else {
      cached = true;
    }

    let filtered = cachedNews;
    if (source !== 'all') {
      filtered = cachedNews.filter((n) => n.source === source);
    }

    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    return NextResponse.json({
      data: paged,
      total: filtered.length,
      page,
      hasMore: start + limit < filtered.length,
      timestamp: new Date().toISOString(),
      cached,
    });
  } catch (error) {
    console.error('News API hata:', error);
    return NextResponse.json(
      { data: [], total: 0, error: 'Haberler yüklenemedi' },
      { status: 500 }
    );
  }
}
