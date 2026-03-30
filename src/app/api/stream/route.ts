import { fetchRealtimePrices } from '@/lib/realtime';
import { checkStopLoss } from '@/lib/alerts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get('symbols') || '').split(',').filter(Boolean);

  if (symbols.length === 0) {
    return new Response(JSON.stringify({ error: 'symbols parametresi gerekli' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Tek seferlik fiyat güncellemesi (SSE yerine polling - daha stabil)
  try {
    const updates = await fetchRealtimePrices(symbols);
    return new Response(JSON.stringify({ updates, timestamp: Date.now() }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Veri alinamadi' }), { status: 500 });
  }
}
