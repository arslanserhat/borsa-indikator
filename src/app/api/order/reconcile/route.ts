import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import pool from '@/lib/db';
import { checkOrphanedOrders, cancelOrphanedOrder } from '@/lib/broker';

export const dynamic = 'force-dynamic';

async function getUserId(): Promise<number | null> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) return null;
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [session.user.email]);
    return result.rows[0]?.id || null;
  } catch { return null; }
}

// Asılı emirleri listele
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Giris yapiniz' }, { status: 401 });

  const orphaned = await checkOrphanedOrders(userId);

  return NextResponse.json({
    orphanedOrders: orphaned,
    count: orphaned.length,
    message: orphaned.length > 0
      ? `${orphaned.length} asili emir bulundu. Iptal etmek icin DELETE istegi gonderin.`
      : 'Asili emir yok.',
    timestamp: new Date().toISOString(),
  });
}

// Asılı emri iptal et
export async function DELETE(request: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Giris yapiniz' }, { status: 401 });

  const { orderId } = await request.json();
  if (!orderId) return NextResponse.json({ error: 'orderId zorunlu' }, { status: 400 });

  const success = await cancelOrphanedOrder(userId, orderId);

  return NextResponse.json({
    success,
    message: success ? `Emir ${orderId} iptal edildi` : 'Iptal basarisiz',
  });
}
