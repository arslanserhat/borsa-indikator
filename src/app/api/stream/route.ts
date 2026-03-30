import { addSubscriber, fetchRealtimePrices, RealtimeUpdate } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols') || '';
  const symbols = symbolsParam.split(',').filter(Boolean).map(s => s.toUpperCase());
  const mode = searchParams.get('mode') || 'sse'; // sse veya poll

  if (symbols.length === 0) {
    return new Response(JSON.stringify({ error: 'symbols parametresi gerekli' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Polling modu (fallback)
  if (mode === 'poll') {
    try {
      const updates = await fetchRealtimePrices(symbols);
      return new Response(JSON.stringify({ updates, timestamp: Date.now() }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Veri alinamadi' }), { status: 500 });
    }
  }

  // SSE modu - gercek zamanli stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const unsubscribers: (() => void)[] = [];

      // Her sembol icin WebSocket subscriber ekle
      for (const symbol of symbols) {
        const unsub = addSubscriber(symbol, (data: RealtimeUpdate) => {
          try {
            const sseData = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          } catch {
            // Stream kapanmis olabilir
          }
        });
        unsubscribers.push(unsub);
      }

      // Heartbeat - baglanti canli tutmak icin (30sn'de bir)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Client baglanti koptiginda temizle
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        for (const unsub of unsubscribers) unsub();
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx proxy icin
    },
  });
}
