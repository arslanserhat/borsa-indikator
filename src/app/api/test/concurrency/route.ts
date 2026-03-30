import { NextResponse } from 'next/server';
import { analyzeStock } from '@/lib/analysis';
import { filterAndPrioritizeOrders, processBatch, QueuedOrder } from '@/lib/worker-pool';

export const dynamic = 'force-dynamic';

const TEST_SECRET = process.env.TEST_SECRET || 'borsa-test-2026';

/**
 * CONCURRENCY TEST
 *
 * POST /api/test/concurrency
 * Body: { "secret": "borsa-test-2026", "symbolCount": 50, "existingPositions": 3 }
 *
 * 1. N hisseyi eşzamanlı analiz et
 * 2. Süreyi ölç
 * 3. Risk Controller ile filtrele (max 10 pozisyon)
 * 4. Sonuçları raporla
 */
export async function POST(request: Request) {
  try {
    const { secret, symbolCount, existingPositions } = await request.json();

    if (secret !== TEST_SECRET) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
    }

    const count = Math.min(symbolCount || 20, 50); // Max 50
    const existing = existingPositions || 0;

    // Test hisseleri
    const testSymbols = [
      'THYAO', 'GARAN', 'AKBNK', 'SASA', 'EREGL', 'BIMAS', 'ASELS', 'KCHOL',
      'SAHOL', 'TUPRS', 'TOASO', 'FROTO', 'TCELL', 'PGSUS', 'MGROS', 'ARCLK',
      'VESTL', 'PETKM', 'TAVHL', 'ENKAI', 'TTKOM', 'SOKM', 'KOZAL', 'EKGYO',
      'DOHOL', 'GUBRF', 'TSKB', 'TKFEN', 'ULKER', 'AEFES', 'SISE', 'YKBNK',
      'VAKBN', 'HALKB', 'AKSEN', 'KRDMD', 'ALBRK', 'ALKIM', 'ASTOR', 'BRISA',
      'DOAS', 'LOGO', 'MAVI', 'OTKAR', 'NETAS', 'GOODY', 'GEDZA', 'INDES',
      'SISE', 'KOZAL',
    ].slice(0, count);

    console.log(`[CONCURRENCY] ${count} hisse esanli analiz basliyor...`);
    const startTime = Date.now();

    // Eşzamanlı analiz (5 paralel worker)
    const analysisResults = await processBatch(
      testSymbols,
      async (sym) => {
        const t1 = Date.now();
        const analysis = await analyzeStock(sym);
        const t2 = Date.now();
        return {
          symbol: sym,
          score: analysis.compositeScore,
          confidence: analysis.confidence,
          signal: analysis.signalText,
          price: analysis.price,
          timestamp: t2 - t1,
        };
      },
      5, // 5 concurrent workers
    );

    const totalTime = Date.now() - startTime;

    // Risk Controller - filterAndPrioritize
    const orders: QueuedOrder[] = analysisResults.map(r => ({
      symbol: r.symbol,
      score: r.score,
      confidence: r.confidence,
      signal: r.signal,
      price: r.price,
      timestamp: Date.now(),
    }));

    const { approved, rejected } = filterAndPrioritizeOrders(orders, 10, existing);

    const result = {
      test: 'CONCURRENCY_TEST',
      config: { symbolCount: count, concurrentWorkers: 5, existingPositions: existing, maxPositions: 10 },

      performance: {
        totalTimeMs: totalTime,
        avgPerSymbolMs: Math.round(totalTime / count),
        fastestMs: Math.min(...analysisResults.map(r => r.timestamp)),
        slowestMs: Math.max(...analysisResults.map(r => r.timestamp)),
      },

      riskController: {
        totalSignals: orders.length,
        buySignals: orders.filter(o => o.score >= 58).length,
        approved: approved.length,
        rejected: rejected.length,
        availableSlots: 10 - existing,
        approvedSymbols: approved.map(o => `${o.symbol}(${o.score})`),
        rejectedReasons: rejected.slice(0, 5).map(o =>
          o.score < 58 ? `${o.symbol}: skor ${o.score} < 58 (AL esigi)` : `${o.symbol}: slot dolu (skor ${o.score})`
        ),
      },

      topScores: analysisResults.sort((a, b) => b.score - a.score).slice(0, 10).map(r => ({
        symbol: r.symbol, score: r.score, signal: r.signal, latencyMs: r.timestamp,
      })),

      timestamp: new Date().toISOString(),
    };

    console.log(`[CONCURRENCY] Test tamamlandi: ${totalTime}ms, ${approved.length} onaylandi, ${rejected.length} reddedildi`);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[CONCURRENCY] Hata:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
