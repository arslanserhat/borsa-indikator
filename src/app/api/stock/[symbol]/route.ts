import { NextResponse } from 'next/server';
import { fetchStockIndicators } from '@/lib/tradingview';

export const dynamic = 'force-dynamic';

const COLUMNS = [
  'name', 'close', 'change', 'change_abs', 'high', 'low',
  'volume', 'open', 'description', 'prev_close_price',
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
        oncekiKapanis: d[9],
        alis: d[10],
        satis: d[11],
        piyasaDegeri: d[12],
        fk: d[13],
        oneri: d[14],
        rsi: d[15],
        macd: d[16],
        adx: d[17],
      },
      source: 'TradingView',
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Hisse detay hata:', error);
    return NextResponse.json({ error: 'Veri alinamadi' }, { status: 500 });
  }
}
