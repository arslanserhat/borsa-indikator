/**
 * GERCEK ZAMANLI VERI - Server-Side Fast Polling + SSE
 *
 * TradingView WebSocket (@mathieuc/tradingview) Next.js'de stabil calismiyor.
 * Cozum: Server-side 2sn polling + SSE ile browser'a aktarim.
 * Tek bir polling loop tum subscriber'lara hizmet eder.
 */

import { fetchStockIndicators } from './tradingview';

export interface RealtimeUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  timestamp: number;
}

// === GLOBAL STATE ===
const priceStore = new Map<string, RealtimeUpdate>();
const subscribers = new Map<string, Set<(data: RealtimeUpdate) => void>>();
let pollingActive = false;
const activeSymbols = new Set<string>();

// === SERVER-SIDE POLLING ===

async function pollSymbol(symbol: string): Promise<void> {
  try {
    const d = await fetchStockIndicators(symbol, [
      'name', 'close', 'change', 'change_abs', 'volume', 'high', 'low',
    ]);
    if (!d || !d[1]) return;

    const update: RealtimeUpdate = {
      symbol,
      price: d[1],
      change: d[3] || 0,
      changePercent: d[2] || 0,
      volume: d[4] || 0,
      high: d[5] || d[1],
      low: d[6] || d[1],
      timestamp: Date.now(),
    };

    const prev = priceStore.get(symbol);
    // Sadece fiyat degistiyse bildir (gereksiz traffic onleme)
    const changed = !prev || prev.price !== update.price || prev.volume !== update.volume;

    priceStore.set(symbol, update);

    if (changed) {
      const subs = subscribers.get(symbol);
      if (subs) {
        for (const cb of subs) {
          try { cb(update); } catch {}
        }
      }
    }
  } catch {}
}

// Tum aktif sembolleri poll et
async function pollAll(): Promise<void> {
  const symbols = [...activeSymbols];
  if (symbols.length === 0) return;

  // 3'erli batch - rate limit onleme
  const BATCH = 3;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    await Promise.all(batch.map(pollSymbol));
  }
}

// Polling loop baslat
function startPollingLoop(): void {
  if (pollingActive) return;
  pollingActive = true;

  const loop = async () => {
    while (pollingActive && activeSymbols.size > 0) {
      await pollAll();
      // 2sn bekle - TradingView rate limit'e takilmamak icin
      await new Promise(r => setTimeout(r, 2000));
    }
    pollingActive = false;
  };

  loop().catch(() => { pollingActive = false; });
}

// === PUBLIC API ===

export function addSubscriber(symbol: string, callback: (data: RealtimeUpdate) => void): () => void {
  if (!subscribers.has(symbol)) {
    subscribers.set(symbol, new Set());
  }
  subscribers.get(symbol)!.add(callback);
  activeSymbols.add(symbol);

  // Polling loop baslat (yoksa)
  startPollingLoop();

  // Son bilinen fiyati hemen gonder
  const cached = priceStore.get(symbol);
  if (cached) {
    try { callback(cached); } catch {}
  }

  // Unsubscribe fonksiyonu
  return () => {
    const subs = subscribers.get(symbol);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        subscribers.delete(symbol);
        // 30sn sonra hala dinleyen yoksa sembolü kaldır
        setTimeout(() => {
          if (!subscribers.has(symbol) || subscribers.get(symbol)!.size === 0) {
            activeSymbols.delete(symbol);
          }
        }, 30000);
      }
    }
  };
}

export function getCachedPrice(symbol: string): RealtimeUpdate | null {
  return priceStore.get(symbol) || null;
}

// Fallback: tek seferlik fiyat cek
export async function fetchRealtimePrices(symbols: string[]): Promise<RealtimeUpdate[]> {
  const updates: RealtimeUpdate[] = [];
  const BATCH = 5;

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const promises = batch.map(async (sym) => {
      const cached = priceStore.get(sym);
      if (cached && Date.now() - cached.timestamp < 5000) return cached;

      try {
        const d = await fetchStockIndicators(sym, ['name', 'close', 'change', 'change_abs', 'volume', 'high', 'low']);
        if (d) {
          const update: RealtimeUpdate = {
            symbol: sym, price: d[1] || 0, change: d[3] || 0,
            changePercent: d[2] || 0, volume: d[4] || 0,
            high: d[5] || 0, low: d[6] || 0, timestamp: Date.now(),
          };
          priceStore.set(sym, update);
          return update;
        }
      } catch {}
      return null;
    });
    updates.push(...(await Promise.all(promises)).filter(Boolean) as RealtimeUpdate[]);
  }
  return updates;
}

export function getWSStatus() {
  return {
    connected: pollingActive,
    activeSymbols: [...activeSymbols],
    subscriberCount: [...subscribers.values()].reduce((sum, s) => sum + s.size, 0),
  };
}
