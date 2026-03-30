// TradingView WebSocket chart verisi - child_process ile çalıştır
import { execSync } from 'child_process';
import path from 'path';

const chartCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 60000; // 1 dakika

export function getChartData(symbol: string, timeframe: string, bars: number): any[] {
  const cacheKey = `${symbol}_${timeframe}_${bars}`;
  const cached = chartCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Node.js script olarak çalıştır (Next.js require sorununu bypass)
    const script = `
      const TV = require('@mathieuc/tradingview');
      const client = new TV.Client();
      const chart = new client.Session.Chart();
      chart.setMarket('BIST:${symbol}', { timeframe: '${timeframe}', range: ${bars} });
      let done = false;
      chart.onUpdate(() => {
        if (done) return;
        done = true;
        const candles = (chart.periods || []).map(p => ({
          time: p.time, open: p.open || 0, high: p.max || 0,
          low: p.min || 0, close: p.close || 0, volume: p.volume || 0
        })).filter(c => c.open > 0);
        candles.sort((a, b) => a.time - b.time);
        process.stdout.write(JSON.stringify(candles));
        client.end();
        process.exit(0);
      });
      chart.onError(() => { client.end(); process.exit(1); });
      setTimeout(() => { client.end(); process.exit(1); }, 6000);
    `;

    const result = execSync(`node -e "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      timeout: 8000, // 8sn timeout - veri gelmezse boş dön
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    const candles = JSON.parse(result);
    chartCache.set(cacheKey, { data: candles, timestamp: Date.now() });
    return candles;
  } catch (error) {
    console.error('TradingView chart hata:', error);
    // Eski cache varsa dön
    if (cached) return cached.data;
    return [];
  }
}
