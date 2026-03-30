import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import pool from '@/lib/db';
import { checkOrderRisk, submitOrder, OrderRequest } from '@/lib/broker';

export const dynamic = 'force-dynamic';

async function getUserId(): Promise<number | null> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return null;
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
    return result.rows[0]?.id || null;
  } catch { return null; }
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Giris yapiniz' }, { status: 401 });

  const body = await request.json();
  const { symbol, side, quantity, price, stopLoss, takeProfit, signalScore, confidence } = body;

  if (!symbol || !side || !quantity || !price) {
    return NextResponse.json({ error: 'Eksik bilgi' }, { status: 400 });
  }

  // Transaction ile atomik islem
  const client = await pool.connect();
  let portfolioValue = 100000;
  let dailyTradeCount = 0;
  let openPositionCount = 0;

  try {
    await client.query('BEGIN');

    const portfolio = await client.query(
      'SELECT SUM(quantity * avg_cost) as total FROM portfolios WHERE user_id = $1 FOR UPDATE',
      [userId]
    );
    portfolioValue = parseFloat(portfolio.rows[0]?.total) || 100000;

    const todayTrades = await client.query(
      "SELECT COUNT(*) as cnt FROM trades WHERE user_id = $1 AND created_at > CURRENT_DATE",
      [userId]
    );
    dailyTradeCount = parseInt(todayTrades.rows[0]?.cnt) || 0;

    const openPositions = await client.query(
      'SELECT COUNT(*) as cnt FROM portfolios WHERE user_id = $1',
      [userId]
    );
    openPositionCount = parseInt(openPositions.rows[0]?.cnt) || 0;

  const order: OrderRequest = {
    symbol: symbol.toUpperCase(),
    side,
    quantity,
    price,
    orderType: 'LIMIT',
    stopLoss,
    takeProfit,
    signalScore: signalScore || 50,
    confidence: confidence || 50,
  };

  // Risk kontrolü
  const riskCheck = checkOrderRisk(order, portfolioValue, dailyTradeCount, openPositionCount);

  if (!riskCheck.approved) {
    return NextResponse.json({
      error: 'Risk kontrolu reddetti',
      reason: riskCheck.reason,
      maxQuantity: riskCheck.maxQuantity,
    }, { status: 400 });
  }

  // Emir gönder (şimdilik simülasyon)
  const result = await submitOrder(order);

  // Islemi kaydet
  if (result.success) {
    await client.query(
      'INSERT INTO trades (user_id, symbol, action, quantity, price, signal_score, signal_text, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [userId, order.symbol, side, quantity, result.executedPrice, signalScore, side === 'BUY' ? 'AL' : 'SAT', result.message]
    );
  }

    await client.query('COMMIT');
    return NextResponse.json(result);
  } catch (txErr) {
    await client.query('ROLLBACK');
    console.error('Order transaction error:', txErr);
    return NextResponse.json({ error: 'Emir islenirken hata olustu' }, { status: 500 });
  } finally {
    client.release();
  }
}
