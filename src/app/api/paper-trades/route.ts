import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { fetchStockIndicators } from '@/lib/tradingview';

export const dynamic = 'force-dynamic';

// GET: Sanal islem istatistikleri
export async function GET() {
  try {
    // Genel istatistikler
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE result_1d = 'BASARILI') as win_1d,
        COUNT(*) FILTER (WHERE result_1d = 'BASARISIZ') as loss_1d,
        COUNT(*) FILTER (WHERE result_3d = 'BASARILI') as win_3d,
        COUNT(*) FILTER (WHERE result_3d = 'BASARISIZ') as loss_3d,
        COUNT(*) FILTER (WHERE checked_1d = true) as checked_1d_total,
        COUNT(*) FILTER (WHERE checked_3d = true) as checked_3d_total,
        COALESCE(AVG(pnl_1d_pct) FILTER (WHERE checked_1d = true), 0) as avg_pnl_1d,
        COALESCE(AVG(pnl_3d_pct) FILTER (WHERE checked_3d = true), 0) as avg_pnl_3d
      FROM paper_trades
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);

    const s = stats.rows[0];
    const winRate1d = s.checked_1d_total > 0 ? Math.round((s.win_1d / s.checked_1d_total) * 100) : null;
    const winRate3d = s.checked_3d_total > 0 ? Math.round((s.win_3d / s.checked_3d_total) * 100) : null;

    // Son 10 sanal islem
    const recent = await pool.query(`
      SELECT symbol, signal, signal_score, confidence, entry_price, entry_time,
             price_1d, price_3d, result_1d, result_3d, pnl_1d_pct, pnl_3d_pct,
             checked_1d, checked_3d
      FROM paper_trades
      ORDER BY created_at DESC
      LIMIT 10
    `);

    return NextResponse.json({
      stats: {
        total: parseInt(s.total),
        winRate1d,
        winRate3d,
        avgPnl1d: parseFloat(parseFloat(s.avg_pnl_1d).toFixed(2)),
        avgPnl3d: parseFloat(parseFloat(s.avg_pnl_3d).toFixed(2)),
        checked1d: parseInt(s.checked_1d_total),
        checked3d: parseInt(s.checked_3d_total),
        wins1d: parseInt(s.win_1d),
        losses1d: parseInt(s.loss_1d),
        wins3d: parseInt(s.win_3d),
        losses3d: parseInt(s.loss_3d),
      },
      recentTrades: recent.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Paper trades stats error:', error);
    return NextResponse.json({ error: 'Istatistikler alinamadi' }, { status: 500 });
  }
}

// POST: Yeni sanal islem kaydet (scan sonrasi otomatik)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { trades } = body; // [{ symbol, signal, score, confidence, price }]

    if (!trades || !Array.isArray(trades)) {
      return NextResponse.json({ error: 'trades array gerekli' }, { status: 400 });
    }

    let saved = 0;
    for (const t of trades) {
      if (!t.symbol || !t.signal || !t.price) continue;

      // Ayni gun ayni sembol icin tekrar kaydetme
      const exists = await pool.query(
        `SELECT id FROM paper_trades WHERE symbol = $1 AND created_at > CURRENT_DATE`,
        [t.symbol]
      );
      if (exists.rows.length > 0) continue;

      // Stop-loss: ATR bazli veya %5
      const stopLoss = t.price * 0.95;
      const targetPrice = t.price * 1.08;

      await pool.query(
        `INSERT INTO paper_trades (symbol, signal, signal_score, confidence, entry_price, stop_loss, target_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [t.symbol, t.signal, t.score || 0, t.confidence || 0, t.price, stopLoss, targetPrice]
      );
      saved++;
    }

    return NextResponse.json({ saved, total: trades.length });
  } catch (error) {
    console.error('Paper trade save error:', error);
    return NextResponse.json({ error: 'Kayit hatasi' }, { status: 500 });
  }
}
