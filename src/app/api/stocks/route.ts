import { NextResponse } from 'next/server';
import { fetchAllStocksFromTV, fetchMarketIndicesFromTV, fetchCurrencyFromTV } from '@/lib/tradingview';

export const dynamic = 'force-dynamic';

// In-memory cache
let cachedStocks: any[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 5000; // 5 saniye

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'stocks';

  try {
    if (type === 'summary') {
      const [endeksler, doviz] = await Promise.all([
        fetchMarketIndicesFromTV(),
        fetchCurrencyFromTV(),
      ]);
      return NextResponse.json({ endeksler, doviz, timestamp: Date.now() });
    }

    if (type === 'currency') {
      const doviz = await fetchCurrencyFromTV();
      return NextResponse.json({ data: doviz, timestamp: Date.now() });
    }

    if (type === 'indices') {
      const endeksler = await fetchMarketIndicesFromTV();
      return NextResponse.json({ data: endeksler, timestamp: Date.now() });
    }

    const now = Date.now();

    // Cache kontrolü
    if (cachedStocks.length > 0 && (now - lastFetchTime) < CACHE_TTL) {
      return NextResponse.json({
        data: cachedStocks,
        count: cachedStocks.length,
        timestamp: lastFetchTime,
        cached: true,
        source: 'TradingView',
      });
    }

    // TradingView Scanner'dan tüm BIST hisselerini çek
    const stocks = await fetchAllStocksFromTV();

    cachedStocks = stocks;
    lastFetchTime = Date.now();

    return NextResponse.json({
      data: stocks,
      count: stocks.length,
      timestamp: lastFetchTime,
      cached: false,
      source: 'TradingView',
    });
  } catch (error) {
    console.error('API hata:', error);

    if (cachedStocks.length > 0) {
      return NextResponse.json({
        data: cachedStocks,
        count: cachedStocks.length,
        timestamp: lastFetchTime,
        cached: true,
        source: 'TradingView (cache)',
      });
    }

    return NextResponse.json({ error: 'Veri alınamadı' }, { status: 500 });
  }
}
