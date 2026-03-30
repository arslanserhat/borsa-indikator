import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SCANNER_URL = 'https://scanner.tradingview.com/turkey/scan';

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const body = JSON.stringify({
      symbols: { tickers: [`BIST:${params.symbol}`] },
      columns: [
        'name', 'close', 'change', 'change_abs', 'high', 'low',
        'volume', 'open', 'description', 'prev_close_price',
        'bid', 'ask', 'market_cap_basic', 'price_earnings_ttm',
        'Recommend.All', 'RSI', 'MACD.macd', 'ADX',
      ],
    });

    const res = await fetch(SCANNER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!res.ok) throw new Error(`TradingView error: ${res.status}`);

    const data = await res.json();
    const item = data?.data?.[0];
    if (!item) return NextResponse.json({ error: 'Hisse bulunamadı' }, { status: 404 });

    const d = item.d;
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
    return NextResponse.json({ error: 'Veri alınamadı' }, { status: 500 });
  }
}
