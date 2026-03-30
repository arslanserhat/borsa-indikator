import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { fetchStockIndicators } from '@/lib/tradingview';

export const dynamic = 'force-dynamic';

// GET: Bekleyen sanal islemleri kontrol et (1g ve 3g sonuc)
export async function GET() {
  try {
    const results = { checked1d: 0, checked3d: 0, errors: 0 };

    // 1 GUN KONTROLU: 24+ saat gecmis, henuz kontrol edilmemis
    const pending1d = await pool.query(`
      SELECT id, symbol, entry_price, stop_loss, target_price
      FROM paper_trades
      WHERE checked_1d = false
        AND entry_time < NOW() - INTERVAL '24 hours'
      ORDER BY entry_time ASC
      LIMIT 20
    `);

    for (const trade of pending1d.rows) {
      try {
        const d = await fetchStockIndicators(trade.symbol, ['close']);
        if (!d || !d[0]) continue;

        const currentPrice = d[0];
        const pnlPct = ((currentPrice - trade.entry_price) / trade.entry_price) * 100;
        const result = currentPrice > trade.entry_price ? 'BASARILI'
          : currentPrice <= trade.stop_loss ? 'BASARISIZ'
          : pnlPct <= -3 ? 'BASARISIZ'
          : 'BASARILI'; // Fiyat dusmus ama stop-loss'a degmemis = notr sayilir basarili

        await pool.query(
          `UPDATE paper_trades SET checked_1d = true, price_1d = $1, result_1d = $2, pnl_1d_pct = $3 WHERE id = $4`,
          [currentPrice, result, pnlPct, trade.id]
        );
        results.checked1d++;
      } catch {
        results.errors++;
      }
    }

    // 3 GUN KONTROLU: 72+ saat gecmis
    const pending3d = await pool.query(`
      SELECT id, symbol, entry_price, stop_loss, target_price
      FROM paper_trades
      WHERE checked_3d = false
        AND entry_time < NOW() - INTERVAL '72 hours'
      ORDER BY entry_time ASC
      LIMIT 20
    `);

    for (const trade of pending3d.rows) {
      try {
        const d = await fetchStockIndicators(trade.symbol, ['close']);
        if (!d || !d[0]) continue;

        const currentPrice = d[0];
        const pnlPct = ((currentPrice - trade.entry_price) / trade.entry_price) * 100;
        const result = currentPrice > trade.entry_price ? 'BASARILI'
          : currentPrice <= trade.stop_loss ? 'BASARISIZ'
          : pnlPct <= -5 ? 'BASARISIZ'
          : 'NOTR';

        await pool.query(
          `UPDATE paper_trades SET checked_3d = true, price_3d = $1, result_3d = $2, pnl_3d_pct = $3 WHERE id = $4`,
          [currentPrice, result, pnlPct, trade.id]
        );
        results.checked3d++;
      } catch {
        results.errors++;
      }
    }

    return NextResponse.json({
      ...results,
      pending1d: pending1d.rows.length,
      pending3d: pending3d.rows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Paper trade check error:', error);
    return NextResponse.json({ error: 'Kontrol hatasi' }, { status: 500 });
  }
}
