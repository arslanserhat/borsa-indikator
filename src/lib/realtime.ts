/**
 * GERCEK ZAMANLI VERI - TradingView Raw WebSocket + SSE
 *
 * TradingView'in WebSocket API'sine dogrudan baglanir.
 * wss://data.tradingview.com/socket.io/websocket
 * Milisaniye seviyesinde canli fiyat akisi.
 */

import WebSocket from 'ws';

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
let ws: WebSocket | null = null;
let wsConnecting = false;
let sessionId = '';
const subscribedSymbols = new Set<string>();
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

function generateSession(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'qs_';
  for (let i = 0; i < 12; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

// TradingView WebSocket protokolu: mesajlar ~m~LENGTH~m~PAYLOAD formatinda
function tvEncode(msg: string): string {
  return `~m~${msg.length}~m~${msg}`;
}

function tvSend(data: any): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const msg = JSON.stringify(data);
  ws.send(tvEncode(msg));
}

// === WEBSOCKET BAGLANTISI ===

function connect(): void {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  if (wsConnecting) return;
  wsConnecting = true;

  try {
    ws = new WebSocket('wss://data.tradingview.com/socket.io/websocket', {
      origin: 'https://data.tradingview.com',
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    ws.on('open', () => {
      wsConnecting = false;
      sessionId = generateSession();
      console.log(`[WS] Baglandi, session: ${sessionId}`);

      // Quote session olustur
      tvSend({ m: 'quote_create_session', p: [sessionId] });
      tvSend({ m: 'quote_set_fields', p: [sessionId, 'lp', 'ch', 'chp', 'volume', 'high_price', 'low_price', 'open_price', 'prev_close_price'] });

      // Onceden subscribe edilmis sembolleri tekrar ekle
      for (const sym of subscribedSymbols) {
        tvSend({ m: 'quote_add_symbols', p: [sessionId, `BIST:${sym}`] });
      }

      // Heartbeat
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(tvEncode('~h~1'));
        }
      }, 20000);
    });

    ws.on('message', (raw: Buffer) => {
      const data = raw.toString();
      // TradingView mesajlarini parse et
      const messages = data.split(/~m~\d+~m~/).filter(Boolean);

      for (const msg of messages) {
        // Heartbeat cevabi
        if (msg.startsWith('~h~')) {
          ws?.send(tvEncode(msg));
          continue;
        }

        try {
          const parsed = JSON.parse(msg);

          // Quote update
          if (parsed.m === 'qsd' && parsed.p?.[1]) {
            const quoteData = parsed.p[1];
            const fullSymbol = quoteData.n || ''; // "BIST:THYAO"
            const symbol = fullSymbol.replace('BIST:', '');
            const v = quoteData.v || {};

            if (!symbol || !v.lp) continue;

            const update: RealtimeUpdate = {
              symbol,
              price: v.lp || 0,           // last price
              change: v.ch || 0,           // change
              changePercent: v.chp || 0,   // change percent
              volume: v.volume || 0,
              high: v.high_price || v.lp,
              low: v.low_price || v.lp,
              timestamp: Date.now(),
            };

            priceStore.set(symbol, update);

            // Subscriber'lara bildir
            const subs = subscribers.get(symbol);
            if (subs) {
              for (const cb of subs) {
                try { cb(update); } catch {}
              }
            }
          }
        } catch {}
      }
    });

    ws.on('close', () => {
      wsConnecting = false;
      console.log('[WS] Baglanti kapandi, 3sn sonra yeniden baglaniliyor...');
      if (heartbeatInterval) clearInterval(heartbeatInterval);

      // Reconnect
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        if (subscribedSymbols.size > 0) connect();
      }, 3000);
    });

    ws.on('error', (err) => {
      wsConnecting = false;
      console.error('[WS] Hata:', err.message);
    });

  } catch (err) {
    wsConnecting = false;
    console.error('[WS] Baglanti kurulamadi:', err);
  }
}

// === PUBLIC API ===

export function addSubscriber(symbol: string, callback: (data: RealtimeUpdate) => void): () => void {
  if (!subscribers.has(symbol)) {
    subscribers.set(symbol, new Set());
  }
  subscribers.get(symbol)!.add(callback);

  // WebSocket'e sembol ekle
  if (!subscribedSymbols.has(symbol)) {
    subscribedSymbols.add(symbol);
    if (ws && ws.readyState === WebSocket.OPEN) {
      tvSend({ m: 'quote_add_symbols', p: [sessionId, `BIST:${symbol}`] });
    }
  }

  // Baglanti kur (yoksa)
  connect();

  // Cache'den hemen gonder
  const cached = priceStore.get(symbol);
  if (cached) {
    try { callback(cached); } catch {}
  }

  // Unsubscribe
  return () => {
    const subs = subscribers.get(symbol);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        subscribers.delete(symbol);
        setTimeout(() => {
          if (!subscribers.has(symbol) || subscribers.get(symbol)!.size === 0) {
            subscribedSymbols.delete(symbol);
            if (ws && ws.readyState === WebSocket.OPEN) {
              tvSend({ m: 'quote_remove_symbols', p: [sessionId, `BIST:${symbol}`] });
            }
            // Hic subscriber kalmadiysa WS kapat
            if (subscribedSymbols.size === 0) {
              ws?.close();
              ws = null;
              if (heartbeatInterval) clearInterval(heartbeatInterval);
            }
          }
        }, 30000);
      }
    }
  };
}

export function getCachedPrice(symbol: string): RealtimeUpdate | null {
  return priceStore.get(symbol) || null;
}

// Fallback: HTTP polling
export async function fetchRealtimePrices(symbols: string[]): Promise<RealtimeUpdate[]> {
  const { fetchStockIndicators } = await import('./tradingview');
  const updates: RealtimeUpdate[] = [];
  const BATCH = 5;

  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const promises = batch.map(async (sym) => {
      const cached = priceStore.get(sym);
      if (cached && Date.now() - cached.timestamp < 3000) return cached;
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
    connected: ws !== null && ws.readyState === WebSocket.OPEN,
    activeSymbols: [...subscribedSymbols],
    subscriberCount: [...subscribers.values()].reduce((sum, s) => sum + s.size, 0),
  };
}
