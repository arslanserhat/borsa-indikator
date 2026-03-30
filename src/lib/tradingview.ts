import { Stock } from '@/types/stock';

const SCANNER_URL_HOST = 'scanner.tradingview.com';
const TURKEY_PATH = '/turkey/scan';
const FOREX_PATH = '/forex/scan';

// Circuit Breaker: TradingView API cokerse tum app cokmesin
const circuitBreaker = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
  threshold: 5,         // 5 ardisik hata
  resetTimeout: 30_000, // 30sn sonra tekrar dene
};

function checkCircuitBreaker(): boolean {
  if (!circuitBreaker.isOpen) return true;
  if (Date.now() - circuitBreaker.lastFailure > circuitBreaker.resetTimeout) {
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
    console.log('[TradingView] Circuit breaker reset - tekrar deneniyor');
    return true;
  }
  return false;
}

function recordSuccess() {
  circuitBreaker.failures = 0;
  circuitBreaker.isOpen = false;
}

function recordFailure() {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();
  if (circuitBreaker.failures >= circuitBreaker.threshold) {
    circuitBreaker.isOpen = true;
    console.error(`[TradingView] Circuit breaker ACIK - ${circuitBreaker.threshold} ardisik hata. ${circuitBreaker.resetTimeout / 1000}sn beklenecek.`);
  }
}

// Belirli bir sembol için belirli kolonları çek (analiz modülü tarafından kullanılır)
export async function fetchStockIndicators(symbol: string, columns: string[]): Promise<any> {
  const body = {
    symbols: { tickers: [`BIST:${symbol}`] },
    columns,
  };
  const result = await postScanner(TURKEY_PATH, body);
  if (result?.data?.[0]?.d) {
    return result.data[0].d;
  }
  return null;
}

// Node.js https modülü ile POST (Next.js fetch User-Agent sorunu nedeniyle)
function postScanner(path: string, body: object): Promise<any> {
  if (!checkCircuitBreaker()) {
    return Promise.reject(new Error('TradingView API gecici olarak devre disi (circuit breaker)'));
  }

  const https = require('https');

  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);

    const req = https.request({
      hostname: SCANNER_URL_HOST,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent': 'Mozilla/5.0',
      },
    }, (res: any) => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => {
        try {
          console.log('[TradingView] Response status:', res.statusCode, 'Data length:', data.length);
          if (data.length < 100) console.log('[TradingView] Response body:', data);
          recordSuccess();
          resolve(JSON.parse(data));
        } catch {
          recordFailure();
          console.error('[TradingView] JSON parse error, raw:', data.substring(0, 200));
          reject(new Error('JSON parse hatasi'));
        }
      });
    });

    req.on('error', (err: Error) => { recordFailure(); reject(err); });
    req.setTimeout(10000, () => {
      req.destroy();
      recordFailure();
      reject(new Error('Timeout'));
    });
    req.write(bodyStr);
    req.end();
  });
}

// TradingView Scanner API ile tüm BIST hisselerini çek
export async function fetchAllStocksFromTV(): Promise<Stock[]> {
  try {
    const data = await postScanner(TURKEY_PATH, {
      filter: [
        { left: 'exchange', operation: 'equal', right: 'BIST' },
      ],
      columns: [
        'name', 'close', 'change', 'change_abs', 'high', 'low',
        'volume', 'open', 'description',
      ],
      sort: { sortBy: 'volume', sortOrder: 'desc' },
      range: [0, 700],
    });

    const stocks: Stock[] = [];
    if (data?.data) {
      for (const item of data.data) {
        const d = item.d;
        if (!d || !d[0]) continue;
        stocks.push({
          kod: d[0], ad: d[8] || '', fiyat: d[1] || 0,
          degisim: d[3] || 0, degisimYuzde: d[2] || 0,
          hacim: d[6] || 0, dusuk: d[5] || 0, yuksek: d[4] || 0,
          oncekiKapanis: (d[1] || 0) - (d[3] || 0), alis: 0, satis: 0,
        });
      }
    }
    return stocks;
  } catch (error) {
    console.error('TradingView Scanner hata:', error);
    return [];
  }
}

// Piyasa endekslerini çek
export async function fetchMarketIndicesFromTV() {
  try {
    const data = await postScanner(TURKEY_PATH, {
      symbols: { tickers: ['BIST:XU100', 'BIST:XU030', 'BIST:XU050', 'BIST:XBANK', 'BIST:XUSIN'] },
      columns: ['name', 'close', 'change', 'change_abs', 'high', 'low', 'description', 'open'],
    });
    return (data?.data || []).map((item: any) => ({
      kod: item.d[0], fiyat: item.d[1], degisimYuzde: item.d[2],
      degisim: item.d[3], yuksek: item.d[4], dusuk: item.d[5],
      ad: item.d[6], acilis: item.d[7],
    }));
  } catch (error) {
    console.error('TradingView endeks hata:', error);
    return [];
  }
}

// Döviz verilerini çek
export async function fetchCurrencyFromTV() {
  try {
    const data = await postScanner(FOREX_PATH, {
      symbols: { tickers: ['FX_IDC:USDTRY', 'FX_IDC:EURTRY', 'FX_IDC:GBPTRY', 'TVC:GOLD'] },
      columns: ['name', 'close', 'change', 'change_abs', 'high', 'low', 'description', 'open'],
    });
    return (data?.data || []).map((item: any) => ({
      kod: item.d[0], fiyat: item.d[1], degisimYuzde: item.d[2],
      degisim: item.d[3], yuksek: item.d[4], dusuk: item.d[5],
      ad: item.d[6], acilis: item.d[7], oncekiKapanis: (item.d[1] || 0) - (item.d[3] || 0),
    }));
  } catch (error) {
    console.error('TradingView döviz hata:', error);
    return [];
  }
}
