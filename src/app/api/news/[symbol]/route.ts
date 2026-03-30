import { NextResponse } from 'next/server';
import { aggregateNews } from '@/lib/news';
import { NewsItem } from '@/types/news';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { data: NewsItem[]; time: number }>();
const CACHE_TTL = 30_000; // 30 saniye
const MAX_CACHE = 100;

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol.toUpperCase();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const now = Date.now();
    const cached = cache.get(symbol);

    let news: NewsItem[];

    if (cached && now - cached.time < CACHE_TTL) {
      news = cached.data;
    } else {
      news = await aggregateNews(symbol);
      // Cache yönetimi
      if (cache.size >= MAX_CACHE) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].time - b[1].time)[0];
        if (oldest) cache.delete(oldest[0]);
      }
      cache.set(symbol, { data: news, time: now });
    }

    return NextResponse.json({
      data: news.slice(0, limit),
      total: news.length,
      symbol,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stock news hata:', error);
    return NextResponse.json(
      { data: [], total: 0, error: 'Haber yüklenemedi' },
      { status: 500 }
    );
  }
}
