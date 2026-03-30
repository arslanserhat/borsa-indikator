import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, string> = { status: 'ok', timestamp: new Date().toISOString() };

  // DB kontrolu
  try {
    const pool = (await import('@/lib/db')).default;
    await pool.query('SELECT 1');
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
    checks.status = 'degraded';
  }

  // Redis kontrolu
  try {
    const redis = (await import('@/lib/redis')).default;
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
    checks.status = 'degraded';
  }

  const httpStatus = checks.status === 'ok' ? 200 : 503;
  return NextResponse.json(checks, { status: httpStatus });
}
