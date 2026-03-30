// TradingView WebSocket chart verisi - guvenli child_process
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

const chartCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 60000;
const MAX_CACHE = 100;

function sanitize(input: string, pattern: RegExp): string {
  if (!pattern.test(input)) throw new Error(`Gecersiz parametre: ${input}`);
  return input;
}

export async function getChartData(symbol: string, timeframe: string, bars: number): Promise<any[]> {
  const safeSymbol = sanitize(symbol, /^[A-Za-z0-9.]+$/);
  const safeTimeframe = sanitize(timeframe, /^[0-9]+$|^[DWMY]$/);
  const safeBars = Math.max(1, Math.min(bars, 500));

  const cacheKey = `${safeSymbol}_${safeTimeframe}_${safeBars}`;
  const cached = chartCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  try {
    const scriptPath = path.join(process.cwd(), '.tmp-chart-fetch.js');
    const script = `
const TV = require('@mathieuc/tradingview');
const args = JSON.parse(process.argv[2]);
const client = new TV.Client();
const chart = new client.Session.Chart();
chart.setMarket('BIST:' + args.symbol, { timeframe: args.timeframe, range: args.bars });
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
    fs.writeFileSync(scriptPath, script, 'utf-8');

    const { stdout } = await execFileAsync('node', [
      scriptPath,
      JSON.stringify({ symbol: safeSymbol, timeframe: safeTimeframe, bars: safeBars }),
    ], { timeout: 8000, encoding: 'utf-8', cwd: process.cwd() });

    try { fs.unlinkSync(scriptPath); } catch {}

    const candles = JSON.parse(stdout);

    // LRU cache eviction
    if (chartCache.size >= MAX_CACHE) {
      const oldest = [...chartCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) chartCache.delete(oldest[0]);
    }
    chartCache.set(cacheKey, { data: candles, timestamp: Date.now() });
    return candles;
  } catch (error) {
    console.error('TradingView chart hata:', error);
    try { fs.unlinkSync(path.join(process.cwd(), '.tmp-chart-fetch.js')); } catch {}
    if (cached) return cached.data;
    return [];
  }
}
