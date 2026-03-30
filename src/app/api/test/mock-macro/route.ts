import { NextResponse } from 'next/server';
import { setMacroOverride, getMemoryStats } from '@/lib/redis';
import { analyzeStock } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

const TEST_SECRET = process.env.TEST_SECRET || 'borsa-test-2026';

/**
 * FLASH CRASH SİMÜLASYONU
 *
 * POST /api/test/mock-macro
 * Body: { "secret": "borsa-test-2026", "overrideBistChange": -5.2, "testSymbol": "CANTE" }
 *
 * 1. Makro filtreyi override eder (PANIC modu)
 * 2. Test hissesini analiz eder
 * 3. Skor düşüşünü loglar
 * 4. 60 saniye sonra otomatik normale döner
 */
export async function POST(request: Request) {
  try {
    const { secret, overrideBistChange, testSymbol, ttl } = await request.json();

    // Güvenlik - sadece secret ile çalışır
    if (secret !== TEST_SECRET) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
    }

    const bistChange = overrideBistChange || -5.0;
    const symbol = (testSymbol || 'THYAO').toUpperCase();
    const overrideTtl = ttl || 60;

    // 1. Önce normal analiz yap
    console.log(`[MOCK-MACRO] Normal analiz baslatiliyor: ${symbol}`);
    const normalAnalysis = await analyzeStock(symbol);
    const normalScore = normalAnalysis.compositeScore;
    const normalSignal = normalAnalysis.signalText;
    console.log(`[MOCK-MACRO] Normal skor: ${normalScore} ${normalSignal}`);

    // 2. Makro override yaz (Redis)
    let marketMode = 'normal';
    let scoreAdj = 0;
    if (bistChange <= -3) { marketMode = 'crash'; scoreAdj = -15; }
    else if (bistChange <= -2) { marketMode = 'panic'; scoreAdj = -10; }
    else if (bistChange <= -1) { marketMode = 'caution'; scoreAdj = -5; }

    await setMacroOverride({
      bist100Change: bistChange,
      bist100Price: 12000,
      usdTryChange: Math.abs(bistChange) > 3 ? 2.5 : 0,
      marketMode,
      scoreAdjustment: scoreAdj,
      message: `SIMULASYON: BIST100 %${bistChange.toFixed(1)} dusus! Mod: ${marketMode.toUpperCase()}`,
      timestamp: Date.now(),
    }, overrideTtl);

    console.log(`[MOCK-MACRO] Override yazildi: ${marketMode}, adj=${scoreAdj}, TTL=${overrideTtl}s`);

    // 3. Override ile tekrar analiz yap
    const crashAnalysis = await analyzeStock(symbol);
    const crashScore = crashAnalysis.compositeScore;
    const crashSignal = crashAnalysis.signalText;
    const scoreDrop = normalScore - crashScore;
    console.log(`[MOCK-MACRO] Crash skor: ${crashScore} ${crashSignal} (${scoreDrop} puan dusus)`);

    // 4. Memory stats
    const memStats = await getMemoryStats();

    const result = {
      test: 'FLASH_CRASH_SIMULATION',
      symbol,
      bistChangeSimulated: bistChange,
      marketMode,

      before: { score: normalScore, signal: normalSignal, confidence: normalAnalysis.confidence },
      after: { score: crashScore, signal: crashSignal, confidence: crashAnalysis.confidence },
      scoreDrop,

      riskControllerStatus: {
        newBuyOrdersBlocked: marketMode === 'crash' || marketMode === 'panic',
        stopLossTriggered: crashScore <= 30,
        message: crashScore <= 30 ? 'ACIL SAT tetiklendi' : crashScore <= 42 ? 'SAT sinyali aktif' : 'NOTR - bekle',
      },

      memoryStats: memStats,
      overrideExpires: `${overrideTtl} saniye sonra normale donecek`,
      timestamp: new Date().toISOString(),
    };

    console.log(`[MOCK-MACRO] Test tamamlandi:`, JSON.stringify(result, null, 2));
    return NextResponse.json(result);
  } catch (error) {
    console.error('[MOCK-MACRO] Hata:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// Override'ı temizle
export async function DELETE(request: Request) {
  try {
    const { secret } = await request.json();
    if (secret !== TEST_SECRET) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

    await setMacroOverride(null, 1); // 1 saniye sonra expire
    return NextResponse.json({ message: 'Override temizlendi, normal moda donuluyor' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
