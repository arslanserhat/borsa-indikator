import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getUserId(): Promise<number | null> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return null;
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
    return result.rows[0]?.id || null;
  } catch { return null; }
}

// İşlem geçmişini getir
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Giris yapiniz' }, { status: 401 });

  const trades = await pool.query(
    'SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
    [userId]
  );

  const performance = await pool.query(
    'SELECT * FROM performance WHERE user_id = $1 ORDER BY date DESC LIMIT 30',
    [userId]
  );

  // İstatistikler
  const stats = await pool.query(`
    SELECT
      COUNT(*) as total_trades,
      COUNT(*) FILTER (WHERE action = 'BUY') as buy_count,
      COUNT(*) FILTER (WHERE action = 'SELL') as sell_count,
      AVG(signal_score) FILTER (WHERE action = 'BUY') as avg_buy_score
    FROM trades WHERE user_id = $1
  `, [userId]);

  return NextResponse.json({
    trades: trades.rows,
    performance: performance.rows,
    stats: stats.rows[0],
  });
}

// Yeni işlem kaydet
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Giris yapiniz' }, { status: 401 });

  const { symbol, action, quantity, price, signalScore, signalText, notes } = await request.json();

  if (!symbol || !action || !quantity || !price) {
    return NextResponse.json({ error: 'Eksik bilgi' }, { status: 400 });
  }
  if (!['BUY', 'SELL'].includes(action)) {
    return NextResponse.json({ error: 'action BUY veya SELL olmali' }, { status: 400 });
  }
  if (quantity <= 0 || price <= 0) {
    return NextResponse.json({ error: 'Quantity ve price pozitif olmali' }, { status: 400 });
  }

  await pool.query(
    'INSERT INTO trades (user_id, symbol, action, quantity, price, signal_score, signal_text, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [userId, symbol.toUpperCase(), action, quantity, price, signalScore || null, signalText || null, notes || null]
  );

  return NextResponse.json({ success: true, message: 'Islem kaydedildi' });
}
