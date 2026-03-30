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

// Portföyü getir
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Giris yapiniz' }, { status: 401 });

  const result = await pool.query(
    'SELECT symbol, quantity::float, avg_cost::float, added_at FROM portfolios WHERE user_id = $1 ORDER BY added_at',
    [userId]
  );

  return NextResponse.json({ portfolio: result.rows });
}

// Hisse ekle veya güncelle (alttan alma / satış)
export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Giris yapiniz' }, { status: 401 });

  const { symbol, quantity, avgCost, action } = await request.json();

  if (!symbol || !quantity || quantity <= 0) {
    return NextResponse.json({ error: 'Symbol ve gecerli quantity zorunlu' }, { status: 400 });
  }

  const sym = symbol.toUpperCase();

  if (action === 'sell') {
    // Kısmi satış
    const existing = await pool.query(
      'SELECT quantity::float as qty FROM portfolios WHERE user_id = $1 AND symbol = $2',
      [userId, sym]
    );

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Portfoyde bu hisse yok' }, { status: 400 });
    }

    // Sahip olduğundan fazla satamaz
    if (quantity > existing.rows[0].qty) {
      return NextResponse.json({
        error: `Satilacak miktar (${quantity}) portfoydeki miktardan (${existing.rows[0].qty}) fazla`,
      }, { status: 400 });
    }

    const remaining = existing.rows[0].qty - quantity;
    if (remaining <= 0) {
      await pool.query('DELETE FROM portfolios WHERE user_id = $1 AND symbol = $2', [userId, sym]);
    } else {
      await pool.query('UPDATE portfolios SET quantity = $3 WHERE user_id = $1 AND symbol = $2', [userId, sym, remaining]);
    }
  } else {
    // Ekleme - avgCost zorunlu
    if (!avgCost || avgCost <= 0) {
      return NextResponse.json({ error: 'Gecerli maliyet fiyati zorunlu' }, { status: 400 });
    }

    const existing = await pool.query(
      'SELECT quantity::float as qty, avg_cost::float as cost FROM portfolios WHERE user_id = $1 AND symbol = $2',
      [userId, sym]
    );

    if (existing.rows.length > 0) {
      const oldQty = existing.rows[0].qty;
      const oldCost = existing.rows[0].cost;
      const newQty = oldQty + quantity;
      const newAvg = ((oldCost * oldQty) + (avgCost * quantity)) / newQty;
      await pool.query(
        'UPDATE portfolios SET quantity = $3, avg_cost = $4 WHERE user_id = $1 AND symbol = $2',
        [userId, sym, newQty, newAvg]
      );
    } else {
      await pool.query(
        'INSERT INTO portfolios (user_id, symbol, quantity, avg_cost) VALUES ($1, $2, $3, $4)',
        [userId, sym, quantity, avgCost]
      );
    }
  }

  // Güncel portföyü döndür
  const result = await pool.query(
    'SELECT symbol, quantity::float, avg_cost::float, added_at FROM portfolios WHERE user_id = $1 ORDER BY added_at',
    [userId]
  );
  return NextResponse.json({ portfolio: result.rows });
}

// Hisse sil
export async function DELETE(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Giris yapiniz' }, { status: 401 });

  try {
    const { symbol } = await request.json();
    if (!symbol) return NextResponse.json({ error: 'Symbol zorunlu' }, { status: 400 });

    await pool.query('DELETE FROM portfolios WHERE user_id = $1 AND symbol = $2', [userId, symbol.toUpperCase()]);

    const result = await pool.query(
      'SELECT symbol, quantity::float, avg_cost::float, added_at FROM portfolios WHERE user_id = $1 ORDER BY added_at',
      [userId]
    );
    return NextResponse.json({ portfolio: result.rows });
  } catch {
    return NextResponse.json({ error: 'Silme hatasi' }, { status: 500 });
  }
}
