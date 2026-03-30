import { NextResponse } from 'next/server';
import { fetchStockIndicators } from '@/lib/tradingview';

export const dynamic = 'force-dynamic';

const COLUMNS = [
  'name', 'close', 'change', 'change_abs', 'high', 'low',
  'volume', 'open', 'description',
  'bid', 'ask', 'market_cap_basic', 'price_earnings_ttm',
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
    //          volume(6), open(7), description(8), bid(9), ask(10),
    //          market_cap(11), pe(12), rec(13), rsi(14), macd(15), adx(16)
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
        alis: d[9],
        satis: d[10],
        piyasaDegeri: d[11],
        fk: d[12],
        oneri: d[13],
        rsi: d[14],
        macd: d[15],
        adx: d[16],
      },
      source: 'TradingView',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Hisse detay hata:', error);
    return NextResponse.json({ error: 'Veri alinamadi' }, { status: 500 });
  }
}
