import { NextResponse } from 'next/server';
import { getChartData } from '@/lib/tv-chart';

export const dynamic = 'force-dynamic';

function getParams(range: string): { timeframe: string; bars: number } {
  switch (range) {
    // Gün içi zaman dilimleri
    case '1d_5m': return { timeframe: '5', bars: 78 };       // 5 dakikalık, 1 gün
    case '1d_15m': return { timeframe: '15', bars: 26 };     // 15 dakikalık, 1 gün
    case '5d_1h': return { timeframe: '60', bars: 40 };      // 1 saatlik, 5 gün
    case '1mo_4h': return { timeframe: '240', bars: 44 };    // 4 saatlik, 1 ay
    // Günlük ve üzeri
    case '1d': return { timeframe: 'D', bars: 1 };           // 1 günlük
    case '1mo': return { timeframe: 'D', bars: 22 };
    case '3mo': return { timeframe: 'D', bars: 66 };
    case '6mo': return { timeframe: 'D', bars: 130 };
    case '1y': return { timeframe: 'D', bars: 252 };
    case '5y': return { timeframe: 'W', bars: 260 };
    case 'max': return { timeframe: 'M', bars: 300 };
    default: return { timeframe: 'D', bars: 130 };
  }
}

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '6mo';

  try {
    const { timeframe, bars } = getParams(range);
    const candles = await getChartData(params.symbol, timeframe, bars);

    if (candles.length === 0) {
      return NextResponse.json({ error: 'Grafik verisi alınamadı' }, { status: 500 });
    }

    return NextResponse.json({
      symbol: params.symbol,
      candles,
      source: 'TradingView',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Chart API hata:', error?.message);
    return NextResponse.json({ error: 'Grafik verisi alınamadı' }, { status: 500 });
  }
}
