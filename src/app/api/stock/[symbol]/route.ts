import { NextResponse } from 'next/server';
import { fetchStockIndicators } from '@/lib/tradingview';

export const dynamic = 'force-dynamic';

const COLUMNS = [
  'name', 'close', 'change', 'change_abs', 'high', 'low',
  'volume', 'open', 'description',
  'market_cap_basic', 'price_earnings_ttm',
  'Recommend.All', 'RSI', 'MACD.macd', 'ADX',
];

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const d = await fetchStockIndicators(params.symbol, COLUMNS);
    if (!d) return NextResponse.json({ error: 'Hisse bulunamadi' }, { status: 404 });

    // Columns: name(0), close(1), change(2), change_abs(3), high(4), low(5),
    //          volume(6), open(7), description(8),
    //          market_cap(9), pe(10), rec(11), rsi(12), macd(13), adx(14)
    const oncekiKapanis = (d[1] || 0) - (d[3] || 0);
    return NextResponse.json({
      data: {
        kod: d[0],
        fiyat: d[1],
        degisimYuzde: d[2],
        degisim: d[3],
        yuksek: d[4],
        dusuk: d[5],
        hacim: d[6],
        acilis: d[7],
        ad: d[8],
        oncekiKapanis,
        alis: 0,
        satis: 0,
        piyasaDegeri: d[9],
        fk: d[10],
        oneri: d[11],
        rsi: d[12],
        macd: d[13],
        adx: d[14],
      },
      source: 'TradingView',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Hisse detay hata:', error);
    return NextResponse.json({ error: 'Veri alinamadi' }, { status: 500 });
  }
}
