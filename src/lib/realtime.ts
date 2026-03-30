/**
 * GERÇEK ZAMANLI VERİ
 *
 * Server-Sent Events (SSE) ile anlık fiyat güncellemesi.
 * Portföydeki hisseler için düşüş uyarısı.
 */

import { fetchStockIndicators } from './tradingview';

export interface RealtimeUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

export async function fetchRealtimePrices(symbols: string[]): Promise<RealtimeUpdate[]> {
  const updates: RealtimeUpdate[] = [];

  // Her sembolü paralel çek (5'erli batch)
  const BATCH = 5;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const promises = batch.map(async (sym) => {
      try {
        const d = await fetchStockIndicators(sym, ['name', 'close', 'change', 'change_abs', 'volume']);
        if (d) {
          return {
            symbol: sym,
            price: d[1] || 0,
            change: d[3] || 0,
            changePercent: d[2] || 0,
            volume: d[4] || 0,
            timestamp: Date.now(),
          };
        }
      } catch {}
      return null;
    });
    const results = await Promise.all(promises);
    updates.push(...results.filter(Boolean) as RealtimeUpdate[]);
  }

  return updates;
}
