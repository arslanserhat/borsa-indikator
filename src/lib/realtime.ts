/**
 * GERCEK ZAMANLI VERI - TradingView WebSocket + SSE
 *
 * Mimari:
 * 1. TradingView WebSocket'e baglan (@mathieuc/tradingview)
 * 2. Fiyat degisikliklerini hafizada tut
 * 3. SSE ile browser'a aktar (aninda, polling degil)
 *
 * Tek bir WebSocket baglantisi tum client'lara hizmet eder.
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
let wsClient: any = null;
let wsConnecting = false;
const activeCharts = new Map<string, any>();

// === WEBSOCKET BAGLANTISI ===

async function ensureWSConnection(): Promise<any> {
  if (wsClient) return wsClient;
  if (wsConnecting) {
    // Baglanti kuruluyor, bekle
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (wsClient) { clearInterval(check); resolve(wsClient); }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(null); }, 10000);
    });
  }

  wsConnecting = true;
  try {
    const TV = require('@mathieuc/tradingview');
    const client = new TV.Client();
    wsClient = client;
    wsConnecting = false;
    console.log('[WS] TradingView WebSocket baglandi');
    return client;
  } catch (err) {
    wsConnecting = false;
    console.error('[WS] Baglanti hatasi:', err);
    return null;
  }
}

// Sembol icin WebSocket stream baslat
async function subscribeSymbol(symbol: string): Promise<void> {
  if (activeCharts.has(symbol)) return; // Zaten dinleniyor

  const client = await ensureWSConnection();
  if (!client) return;

  try {
    const chart = new client.Session.Chart();
    chart.setMarket(`BIST:${symbol}`, { timeframe: '1', range: 1 });

    chart.onUpdate(() => {
      try {
        const periods = chart.periods || [];
        if (periods.length === 0) return;

        const latest = periods[0]; // En son mum
        const price = latest.close || 0;
        if (price <= 0) return;

        const prev = priceStore.get(symbol);
        const update: RealtimeUpdate = {
          symbol,
          price,
          change: latest.close - (latest.open || latest.close),
          changePercent: prev ? ((price - (prev.price || price)) / (prev.price || price)) * 100 : 0,
          volume: latest.volume || 0,
          high: latest.max || price,
          low: latest.min || price,
          timestamp: Date.now(),
        };

        priceStore.set(symbol, update);

        // Tum subscriber'lara bildir
        const subs = subscribers.get(symbol);
        if (subs) {
          for (const cb of subs) {
            try { cb(update); } catch {}
          }
        }
      } catch {}
    });

    chart.onError((err: any) => {
      console.error(`[WS] ${symbol} chart error:`, err);
      activeCharts.delete(symbol);
    });

    activeCharts.set(symbol, chart);
    console.log(`[WS] ${symbol} stream basladi`);
  } catch (err) {
    console.error(`[WS] ${symbol} subscribe hatasi:`, err);
  }
}

// Sembol dinlemeyi birak
function unsubscribeSymbol(symbol: string): void {
  const chart = activeCharts.get(symbol);
  if (chart) {
    try { chart.delete(); } catch {}
    activeCharts.delete(symbol);
    console.log(`[WS] ${symbol} stream durduruldu`);
  }
}

// === PUBLIC API ===

// SSE subscriber ekle
export function addSubscriber(symbol: string, callback: (data: RealtimeUpdate) => void): () => void {
  if (!subscribers.has(symbol)) {
    subscribers.set(symbol, new Set());
  }
  subscribers.get(symbol)!.add(callback);

  // WebSocket stream baslat (yoksa)
  subscribeSymbol(symbol);

  // Son bilinen fiyati hemen gonder
  const cached = priceStore.get(symbol);
  if (cached) {
    try { callback(cached); } catch {}
  }

  // Unsubscribe fonksiyonu don
  return () => {
    const subs = subscribers.get(symbol);
    if (subs) {
      subs.delete(callback);
      // Dinleyen kalmadiysa WebSocket'i kapat
      if (subs.size === 0) {
        subscribers.delete(symbol);
        // 30sn sonra hala dinleyen yoksa kapat (reconnect onleme)
        setTimeout(() => {
          if (!subscribers.has(symbol) || subscribers.get(symbol)!.size === 0) {
            unsubscribeSymbol(symbol);
          }
        }, 30000);
      }
    }
  };
}

// Mevcut fiyati al (cache)
export function getCachedPrice(symbol: string): RealtimeUpdate | null {
  return priceStore.get(symbol) || null;
}

// Fallback: HTTP polling ile fiyat cek (WebSocket basarisiz olursa)
export async function fetchRealtimePrices(symbols: string[]): Promise<RealtimeUpdate[]> {
  const updates: RealtimeUpdate[] = [];
  const BATCH = 5;

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const promises = batch.map(async (sym) => {
      // Once cache kontrol
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

// Aktif baglanti durumu
export function getWSStatus(): { connected: boolean; activeSymbols: string[]; subscriberCount: number } {
  return {
    connected: wsClient !== null,
    activeSymbols: [...activeCharts.keys()],
    subscriberCount: [...subscribers.values()].reduce((sum, s) => sum + s.size, 0),
  };
}
