/**
 * REDIS CACHE KATMANI (DB 10 - İZOLE)
 *
 * Optimizasyonlar:
 * - maxmemory 1GB + allkeys-lru eviction
 * - Tick verileri LTRIM ile son 1000 ile sınırlı
 * - Bağlantı havuzu (connection pool)
 */

import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'e-sonuc-redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: 10,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableOfflineQueue: true,
});

let initialized = false;

// Redis bağlantısı ve konfigürasyonu
async function ensureConnection() {
  if (!initialized) {
    try {
      await redis.connect();
      await initRedisConfig();
      initialized = true;
      console.log('[Redis] DB10 baglandi ve konfigure edildi');
    } catch (err) {
      console.error('[Redis] Baglanti hatasi:', err);
      // Redis olmadan da çalışabilmeli
      initialized = true; // Retry'ı engelle
    }
  }
}

// Redis sunucu konfigürasyonu - memory leak koruması
async function initRedisConfig(): Promise<void> {
  try {
    // 1GB max memory - sunucu kapasitesine göre
    await redis.config('SET', 'maxmemory', '1gb');
    // RAM dolunca en eski veriyi otomatik sil
    await redis.config('SET', 'maxmemory-policy', 'allkeys-lru');
    console.log('[Redis] Config: maxmemory=1gb, policy=allkeys-lru');
  } catch (err) {
    // CONFIG yetkisi yoksa devam et (read-only slave olabilir)
    console.warn('[Redis] Config ayarlanamadi (yetki?):', err);
  }
}

// === FIYAT VERİSİ (TTL: 30sn) ===
export async function cachePrice(symbol: string, data: any): Promise<void> {
  try {
    await ensureConnection();
    await redis.setex(`price:${symbol}`, 30, JSON.stringify(data));
  } catch {}
}

export async function getCachedPrice(symbol: string): Promise<any | null> {
  try {
    await ensureConnection();
    const data = await redis.get(`price:${symbol}`);
    return data ? safeJsonParse(data) : null;
  } catch { return null; }
}

// === TICK VERİSİ (Son 1000 mum - LTRIM ile sınırlı) ===
export async function pushTick(symbol: string, tick: any): Promise<void> {
  try {
    await ensureConnection();
    const key = `ticks:${symbol}`;
    await redis.lpush(key, JSON.stringify(tick));
    // Son 1000 tick tut, gerisini sil - MEMORY LEAK KORUMASI
    await redis.ltrim(key, 0, 999);
    // 1 saat TTL - işlem saatleri dışında otomatik temizlenir
    await redis.expire(key, 3600);
  } catch {}
}

function safeJsonParse(str: string, fallback: any = null): any {
  try { return JSON.parse(str); } catch { return fallback; }
}

export async function getRecentTicks(symbol: string, count: number = 100): Promise<any[]> {
  try {
    await ensureConnection();
    const data = await redis.lrange(`ticks:${symbol}`, 0, count - 1);
    return data.map(d => safeJsonParse(d)).filter(Boolean);
  } catch { return []; }
}

// === ANALİZ SONUCU (TTL: 60sn) ===
export async function cacheAnalysis(symbol: string, data: any): Promise<void> {
  try {
    await ensureConnection();
    await redis.setex(`analysis:${symbol}`, 60, JSON.stringify(data));
  } catch {}
}

export async function getCachedAnalysis(symbol: string): Promise<any | null> {
  try {
    await ensureConnection();
    const data = await redis.get(`analysis:${symbol}`);
    return data ? safeJsonParse(data) : null;
  } catch { return null; }
}

// === SCAN SONUCU (TTL: 5dk) ===
export async function cacheScan(data: any): Promise<void> {
  try {
    await ensureConnection();
    await redis.setex('scan:result', 300, JSON.stringify(data));
  } catch {}
}

export async function getCachedScan(): Promise<any | null> {
  try {
    await ensureConnection();
    const data = await redis.get('scan:result');
    return data ? safeJsonParse(data) : null;
  } catch { return null; }
}

// === MAKRO PİYASA DURUMU (TTL: 60sn) ===
export async function cacheMarketState(state: any): Promise<void> {
  try {
    await ensureConnection();
    await redis.setex('market:state', 60, JSON.stringify(state));
  } catch {}
}

export async function getMarketState(): Promise<any | null> {
  try {
    await ensureConnection();
    const data = await redis.get('market:state');
    return data ? safeJsonParse(data) : null;
  } catch { return null; }
}

// === MAKRO OVERRIDE (Test için) ===
export async function setMacroOverride(data: any, ttl: number = 60): Promise<void> {
  try {
    await ensureConnection();
    await redis.setex('market:override', ttl, JSON.stringify(data));
  } catch {}
}

export async function getMacroOverride(): Promise<any | null> {
  try {
    await ensureConnection();
    const data = await redis.get('market:override');
    return data ? safeJsonParse(data) : null;
  } catch { return null; }
}

// === MEMORY İSTATİSTİKLERİ ===
export async function getMemoryStats(): Promise<any> {
  try {
    await ensureConnection();
    const info = await redis.info('memory');
    const dbSize = await redis.dbsize();
    const lines = info.split('\n');
    const used = lines.find(l => l.startsWith('used_memory_human'))?.split(':')[1]?.trim() || '?';
    const peak = lines.find(l => l.startsWith('used_memory_peak_human'))?.split(':')[1]?.trim() || '?';
    return { usedMemory: used, peakMemory: peak, keyCount: dbSize };
  } catch { return { usedMemory: '?', peakMemory: '?', keyCount: 0 }; }
}

export default redis;
