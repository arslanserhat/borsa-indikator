/**
 * GERCEK ZAMANLI VERI - TradingView Raw WebSocket + SSE
 *
 * TradingView'in WebSocket API'sine dogrudan baglanir.
 * wss://data.tradingview.com/socket.io/websocket
 * Milisaniye seviyesinde canli fiyat akisi.
 */

// Node.js native https ile WebSocket (Next.js ws bundling sorunu onleme)
function createRawWebSocket(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const crypto = require('crypto');
    const { URL } = require('url');

    const parsed = new URL(url);
    const key = crypto.randomBytes(16).toString('base64');

    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + (parsed.search || ''),
      method: 'GET',
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
        'Origin': 'https://data.tradingview.com',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    req.on('upgrade', (res: any, socket: any, head: any) => {
      const listeners: Record<string, Function[]> = {};
      let buffer = '';

      const ws = {
        readyState: 1,
        send: (data: string) => {
          try {
            // WebSocket frame olustur (text frame, masked)
            const payload = Buffer.from(data, 'utf-8');
            const mask = crypto.randomBytes(4);
            let header: Buffer;

            if (payload.length < 126) {
              header = Buffer.alloc(6);
              header[0] = 0x81; // FIN + TEXT
              header[1] = 0x80 | payload.length; // MASK + length
              mask.copy(header, 2);
            } else if (payload.length < 65536) {
              header = Buffer.alloc(8);
              header[0] = 0x81;
              header[1] = 0x80 | 126;
              header.writeUInt16BE(payload.length, 2);
              mask.copy(header, 4);
            } else {
              header = Buffer.alloc(14);
              header[0] = 0x81;
              header[1] = 0x80 | 127;
              header.writeBigUInt64BE(BigInt(payload.length), 2);
              mask.copy(header, 10);
            }

            // Mask payload
            const masked = Buffer.alloc(payload.length);
            for (let i = 0; i < payload.length; i++) {
              masked[i] = payload[i] ^ mask[i % 4];
            }

            socket.write(Buffer.concat([header, masked]));
          } catch {}
        },
        close: () => {
          try { socket.end(); ws.readyState = 3; } catch {}
        },
        on: (event: string, fn: Function) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(fn);
        },
        emit: (event: string, ...args: any[]) => {
          for (const fn of (listeners[event] || [])) fn(...args);
        },
      };

      // Veri oku
      socket.on('data', (chunk: Buffer) => {
        try {
          let offset = 0;
          while (offset < chunk.length) {
            const byte1 = chunk[offset];
            const byte2 = chunk[offset + 1];
            const opcode = byte1 & 0x0f;
            const payloadLen = byte2 & 0x7f;

            let dataStart = offset + 2;
            let actualLen = payloadLen;

            if (payloadLen === 126) {
              actualLen = chunk.readUInt16BE(offset + 2);
              dataStart = offset + 4;
            } else if (payloadLen === 127) {
              actualLen = Number(chunk.readBigUInt64BE(offset + 2));
              dataStart = offset + 10;
            }

            if (dataStart + actualLen > chunk.length) break;

            const payload = chunk.slice(dataStart, dataStart + actualLen);

            if (opcode === 1) { // Text frame
              ws.emit('message', payload);
            } else if (opcode === 8) { // Close
              ws.readyState = 3;
              ws.emit('close');
              socket.end();
              return;
            } else if (opcode === 9) { // Ping
              // Pong gonder
              const pong = Buffer.alloc(2);
              pong[0] = 0x8A; pong[1] = 0;
              socket.write(pong);
            }

            offset = dataStart + actualLen;
          }
        } catch {}
      });

      socket.on('close', () => { ws.readyState = 3; ws.emit('close'); });
      socket.on('error', (err: any) => { ws.readyState = 3; ws.emit('error', err); });

      resolve(ws);
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

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
let ws: any = null;
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
  if (!ws || ws.readyState !== 1) return; // 1 = OPEN
  const msg = JSON.stringify(data);
  ws.send(tvEncode(msg));
}

// === WEBSOCKET BAGLANTISI ===

async function connect(): Promise<void> {
  if (ws && ws.readyState === 1) return; // OPEN
  if (wsConnecting) return;
  wsConnecting = true;

  try {
    ws = await createRawWebSocket('wss://data.tradingview.com/socket.io/websocket');

    // Baglanti acik, session olustur
    wsConnecting = false;
    sessionId = generateSession();
    console.log(`[WS] Baglandi, session: ${sessionId}`);

    tvSend({ m: 'quote_create_session', p: [sessionId] });
    tvSend({ m: 'quote_set_fields', p: [sessionId, 'lp', 'ch', 'chp', 'volume', 'high_price', 'low_price', 'open_price', 'prev_close_price'] });

    for (const sym of subscribedSymbols) {
      tvSend({ m: 'quote_add_symbols', p: [sessionId, `BIST:${sym}`] });
    }

    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (ws && ws.readyState === 1) ws.send(tvEncode('~h~1'));
    }, 20000);

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

    ws.on('error', (err: any) => {
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
    if (ws && ws.readyState === 1) {
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
            if (ws && ws.readyState === 1) {
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
    connected: ws !== null && ws.readyState === 1,
    activeSymbols: [...subscribedSymbols],
    subscriberCount: [...subscribers.values()].reduce((sum, s) => sum + s.size, 0),
  };
}
