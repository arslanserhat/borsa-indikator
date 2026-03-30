/**
 * BROKER API + RETRY-BACKOFF + ORPHANED ORDER KONTROLÜ
 *
 * Faz 2 Güvenlik Katmanları:
 * 1. Exponential Backoff: API 429/500 verdiğinde 1s→2s→4s→8s bekle
 * 2. Orphaned Order Reconciliation: Asılı kalan emirleri sorgula
 * 3. Risk Controller: Max pozisyon, günlük limit, skor kontrolü
 */

import pool from './db';

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'LIMIT' | 'MARKET';
  stopLoss?: number;
  takeProfit?: number;
  signalScore: number;
  confidence: number;
}

export interface OrderResponse {
  success: boolean;
  orderId?: string;
  message: string;
  executedPrice?: number;
  timestamp: number;
  retryCount?: number;
}

export interface RiskCheck {
  approved: boolean;
  reason: string;
  maxQuantity: number;
  maxRiskTL: number;
}

// ============ RISK CONTROLLER ============

export function checkOrderRisk(
  order: OrderRequest,
  portfolioValue: number,
  dailyTradeCount: number,
  openPositionCount: number,
): RiskCheck {
  const orderValue = order.quantity * order.price;

  if (orderValue > portfolioValue * 0.10) {
    return { approved: false, reason: `Emir degeri portfolyonun %10'unu asiyor`, maxQuantity: Math.floor((portfolioValue * 0.10) / order.price), maxRiskTL: portfolioValue * 0.02 };
  }
  if (dailyTradeCount >= 20) {
    return { approved: false, reason: 'Gunluk islem limiti (20) doldu', maxQuantity: 0, maxRiskTL: 0 };
  }
  if (order.side === 'BUY' && openPositionCount >= 10) {
    return { approved: false, reason: 'Max acik pozisyon limiti (10) doldu', maxQuantity: 0, maxRiskTL: 0 };
  }
  if (order.side === 'BUY' && order.signalScore < 58) {
    return { approved: false, reason: `Sinyal skoru (${order.signalScore}) AL esigi (58) altinda`, maxQuantity: 0, maxRiskTL: 0 };
  }
  if (order.side === 'SELL' && order.signalScore > 42) {
    return { approved: false, reason: `Sinyal skoru (${order.signalScore}) SAT esigi (42) ustunde`, maxQuantity: 0, maxRiskTL: 0 };
  }

  const riskPerTrade = order.stopLoss
    ? order.quantity * (order.price - order.stopLoss)
    : orderValue * 0.05;

  if (riskPerTrade > portfolioValue * 0.02) {
    const maxQty = Math.floor((portfolioValue * 0.02) / (order.price - (order.stopLoss || order.price * 0.95)));
    return { approved: false, reason: `Risk portfolyonun %2'sini asiyor. Max ${maxQty} adet`, maxQuantity: maxQty, maxRiskTL: portfolioValue * 0.02 };
  }

  return { approved: true, reason: 'Emir onaylandi', maxQuantity: order.quantity, maxRiskTL: portfolioValue * 0.02 };
}

// ============ EXPONENTIAL BACKOFF RETRY ============

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  totalTimeoutMs: number;
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 4,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  totalTimeoutMs: 15000,  // 15sn toplam timeout
};

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY,
): Promise<{ result: T | null; retryCount: number; error?: string }> {
  let lastError = '';
  const startTime = Date.now();

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    // Toplam timeout kontrolu
    if (Date.now() - startTime > config.totalTimeoutMs) {
      lastError = `Toplam timeout asildi (${config.totalTimeoutMs}ms)`;
      break;
    }

    try {
      const result = await fn();
      return { result, retryCount: attempt };
    } catch (err: any) {
      lastError = err?.message || String(err);
      const statusCode = err?.statusCode || err?.status || 0;

      if (statusCode === 429 || (statusCode >= 500 && statusCode < 600) || !statusCode) {
        if (attempt < config.maxRetries) {
          const delay = Math.min(
            config.baseDelayMs * Math.pow(2, attempt),
            config.maxDelayMs
          );
          // Kalan sureye gore delay kisalt
          const remaining = config.totalTimeoutMs - (Date.now() - startTime);
          if (delay > remaining) break;
          console.log(`[BROKER] Retry ${attempt + 1}/${config.maxRetries} - ${delay}ms bekle`);
          await sleep(delay);
          continue;
        }
      }
      break;
    }
  }

  return { result: null, retryCount: config.maxRetries, error: lastError };
}

// ============ ORPHANED ORDER RECONCILIATION ============

export interface OrphanedOrder {
  orderId: string;
  symbol: string;
  side: string;
  status: 'pending' | 'partial' | 'unknown';
  createdAt: string;
  lastCheck: string;
}

// Asılı kalan emirleri kontrol et
export async function checkOrphanedOrders(userId: number): Promise<OrphanedOrder[]> {
  try {
    // Son 24 saatteki 'pending' durumundaki emirleri bul
    const result = await pool.query(`
      SELECT id, symbol, action, quantity, price, created_at, notes
      FROM trades
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '24 hours'
        AND (notes LIKE '%PENDING%' OR notes LIKE '%SIMULASYON%')
      ORDER BY created_at DESC
    `, [userId]);

    return result.rows.map((row: any) => ({
      orderId: `TRD-${row.id}`,
      symbol: row.symbol,
      side: row.action,
      status: 'pending' as const,
      createdAt: row.created_at,
      lastCheck: new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

// Asılı emri iptal et
export async function cancelOrphanedOrder(userId: number, orderId: string): Promise<boolean> {
  try {
    const id = orderId.replace('TRD-', '');
    await pool.query(
      "UPDATE trades SET notes = notes || ' [CANCELLED]' WHERE id = $1 AND user_id = $2",
      [id, userId]
    );
    console.log(`[BROKER] Orphaned order iptal edildi: ${orderId}`);
    return true;
  } catch { return false; }
}

// ============ EMİR GÖNDERİMİ (RETRY İLE) ============

export async function submitOrder(order: OrderRequest): Promise<OrderResponse> {
  // Retry-Backoff ile emir gönder
  const { result, retryCount, error } = await withRetry(async () => {
    // TODO: Gerçek broker API entegrasyonu burada olacak
    // Şimdilik simülasyon
    console.log(`[BROKER SIM] Emir: ${order.symbol} ${order.side} ${order.quantity} @ ${order.price}`);

    // Simülasyon: %5 ihtimalle hata üret (test için)
    if (Math.random() < 0.05) {
      const err: any = new Error('Broker API timeout');
      err.statusCode = 500;
      throw err;
    }

    return {
      success: true,
      orderId: `SIM-${Date.now()}`,
      message: 'SIMULASYON: Emir kaydedildi. Gercek broker API icin ayar gerekli.',
      executedPrice: order.price,
      timestamp: Date.now(),
    };
  });

  if (result) {
    return { ...result, retryCount };
  }

  return {
    success: false,
    message: `Emir gonderilemedi (${retryCount} retry sonrasi): ${error}`,
    timestamp: Date.now(),
    retryCount,
  };
}
