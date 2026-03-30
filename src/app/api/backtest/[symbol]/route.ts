import { NextResponse } from 'next/server';
import { runBacktest } from '@/lib/backtest';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { data: any; time: number }>();
const CACHE_TTL = 3600_000; // 1 saat (backtest değişmez)

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol.toUpperCase();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '750');

    const cacheKey = `${symbol}-${days}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return NextResponse.json({ data: cached.data, cached: true });
    }

    const result = await runBacktest(symbol, days);

    if (cache.size > 30) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].time - b[1].time)[0];
      if (oldest) cache.delete(oldest[0]);
    }
    cache.set(cacheKey, { data: result, time: Date.now() });

    return NextResponse.json({ data: result, cached: false });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
