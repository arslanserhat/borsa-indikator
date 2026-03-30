import { NextResponse } from 'next/server';
import { analyzeStock } from '@/lib/analysis';
import { getCachedScan, cacheScan } from '@/lib/redis';
import { getStockSector } from '@/lib/sector';

export const dynamic = 'force-dynamic';

// BIST Endeks Üyelikleri
const BIST30 = new Set([
  'AKBNK','AKSEN','ARCLK','ASELS','BIMAS','EKGYO','ENKAI','EREGL',
  'FROTO','GARAN','GUBRF','HEKTS','ISCTR','KCHOL','KOZAA','KOZAL',
  'KRDMD','MGROS','PETKM','PGSUS','SAHOL','SASA','SISE','TAVHL',
  'TCELL','THYAO','TKFEN','TOASO','TUPRS','YKBNK',
]);
const BIST50_EXTRA = new Set([
  'AEFES','AGESA','AKSA','ALFAS','ALARK','BERA','BRYAT','CIMSA',
  'DOHOL','EGEEN','ENJSA','GESAN','HALKB','ISGYO','KONTR','ODAS',
  'OYAKC','SOKM','TTKOM','VAKBN',
]);
const BIST100_EXTRA = new Set([
  'ADEL','AGHOL','AHGAZ','AKCNS','ALBRK','ALKIM','ANSGR','ASTOR',
  'AYDEM','BASGZ','BIOEN','BRISA','BUCIM','CEMTS','CANTE','CWENE',
  'DOAS','DYOBY','ECILC','ENERY','EUREN','GEDZA','GLYHO','GOODY',
  'GWIND','INDES','IPEKE','ISMEN','KARSN','KAYSE','KLRHO','KORDS',
  'LOGO','MAVI','MIATK','NETAS','NUHCM','OTKAR','PAPIL','PRKAB',
  'QUAGR','SMRTG','TABGD','TMSN','TRGYO','TRILC','TSKB','TURSG',
  'ULKER','VESBE','VESTL','YEOTK','ZOREN',
]);

let scanPromise: Promise<any[]> | null = null;
let lastScanTime = 0;
const CACHE_TTL = 600_000;

// TÜM hisselerin sembol listesini çek
async function getAllSymbols(): Promise<string[]> {
  const https = require('https');
  const body = JSON.stringify({
    filter: [
      { left: 'exchange', operation: 'equal', right: 'BIST' },
      { left: 'is_primary', operation: 'equal', right: true },
      { left: 'type', operation: 'equal', right: 'stock' },
    ],
    columns: ['name'],
    sort: { sortBy: 'volume', sortOrder: 'desc' },
    range: [0, 300],
  });

  const data: any = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'scanner.tradingview.com',
      path: '/turkey/scan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0',
      },
    }, (res: any) => {
      let raw = '';
      res.on('data', (chunk: string) => (raw += chunk));
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  if (!data?.data) return [];
  return data.data.map((item: any) => (item.d?.[0] || '').replace('BIST:', '')).filter(Boolean);
}

export async function GET() {
  try {
    // 1. Önce Redis cache kontrol (en hızlı)
    const redisCached = await getCachedScan();
    if (redisCached && redisCached.length > 0) {
      return NextResponse.json({ data: redisCached, cached: true, source: 'redis', timestamp: new Date().toISOString() });
    }

    // 2. Devam eden tarama varsa ayni promise'i bekle (race condition onleme)
    if (scanPromise) {
      const results = await scanPromise;
      return NextResponse.json({ data: results, cached: false, source: 'awaited', timestamp: new Date().toISOString() });
    }

    // 3. Yeni tarama baslat
    scanPromise = runScan();
    try {
      const results = await scanPromise;
      return NextResponse.json({ data: results, cached: false, source: 'fresh', count: results.length, timestamp: new Date().toISOString() });
    } finally {
      scanPromise = null;
    }
  } catch (error) {
    console.error('Scan error:', error);
    const fallback = await getCachedScan();
    if (fallback) {
      return NextResponse.json({ data: fallback, cached: true, source: 'fallback', timestamp: new Date().toISOString() });
    }
    return NextResponse.json({ data: [], error: 'Tarama hatasi' }, { status: 500 });
  }
}

async function runScan(): Promise<any[]> {
  const symbols = await getAllSymbols();
  if (symbols.length === 0) return [];

  const results: any[] = [];
  const errors: string[] = [];
  const BATCH = 10;
  const MAX_TOTAL_TIMEOUT = 120_000; // 2 dakika max
  const startTime = Date.now();

  for (let i = 0; i < symbols.length; i += BATCH) {
    // Toplam timeout kontrolu
    if (Date.now() - startTime > MAX_TOTAL_TIMEOUT) {
      console.warn(`[Scan] Timeout: ${results.length}/${symbols.length} tamamlandi`);
      break;
    }

    const batch = symbols.slice(i, i + BATCH);
    const promises = batch.map(async (sym: string) => {
      try {
        const analysis = await analyzeStock(sym);
        const endeks = BIST30.has(sym) ? 'BIST30' : BIST50_EXTRA.has(sym) ? 'BIST50' : BIST100_EXTRA.has(sym) ? 'BIST100' : '';
        return {
          symbol: sym, name: analysis.name, price: analysis.price,
          changePct: analysis.changePercent, score: analysis.compositeScore,
          signal: analysis.signal, signalText: analysis.signalText,
          rsi: Math.round(analysis.indicators.rsi * 10) / 10,
          macdHist: Math.round(analysis.indicators.macdHist * 1000) / 1000,
          adx: Math.round(analysis.indicators.adx * 10) / 10,
          relVol: Math.round(analysis.indicators.relativeVolume * 100) / 100,
          trendUp: analysis.indicators.ema10 > analysis.indicators.ema20 && analysis.indicators.ema20 > analysis.indicators.ema50,
          above200: analysis.price > analysis.indicators.ema200,
          confidence: analysis.confidence, riskLevel: analysis.riskLevel,
          endeks, sector: getStockSector(sym),
        };
      } catch (err: any) {
        errors.push(`${sym}: ${err?.message || 'bilinmeyen hata'}`);
        return null;
      }
    });
    const batchResults = await Promise.all(promises);
    results.push(...batchResults.filter(Boolean));
  }

  if (errors.length > 0) {
    console.warn(`[Scan] ${errors.length} hata: ${errors.slice(0, 5).join(', ')}${errors.length > 5 ? '...' : ''}`);
  }

  results.sort((a, b) => b.score - a.score);
  await cacheScan(results);
  lastScanTime = Date.now();
  return results;
}
