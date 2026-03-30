import { NextResponse } from 'next/server';
import { analyzeStock } from '@/lib/analysis';
import { AnalysisResult } from '@/types/analysis';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { data: AnalysisResult; time: number }>();
const CACHE_TTL = 60_000;
const MAX_CACHE = 50;

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol.toUpperCase();
    const now = Date.now();
    const cached = cache.get(symbol);

    if (cached && now - cached.time < CACHE_TTL) {
      return NextResponse.json({ data: cached.data, cached: true, timestamp: new Date().toISOString() });
    }

    const result = await analyzeStock(symbol);

    if (cache.size >= MAX_CACHE) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].time - b[1].time)[0];
      if (oldest) cache.delete(oldest[0]);
    }
    cache.set(symbol, { data: result, time: now });

    return NextResponse.json({ data: result, cached: false, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analiz yapilamadi', details: String(error) },
      { status: 500 }
    );
  }
}
