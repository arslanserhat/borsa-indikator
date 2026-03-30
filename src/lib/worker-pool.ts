/**
 * WORKER POOL - Eşzamanlı Skorlama
 *
 * 50 hisse aynı anda geldiğinde Event Loop kilitlenmesin diye
 * Promise.all + Queue + Rate Limiting ile paralel işleme.
 *
 * Next.js edge runtime'da worker_threads doğrudan çalışmadığı için
 * Promise-bazlı concurrency pool kullanıyoruz.
 * (worker_threads production'da piscina ile değiştirilebilir)
 */

export interface QueuedOrder {
  symbol: string;
  score: number;
  confidence: number;
  signal: string;
  price: number;
  timestamp: number;
}

/**
 * Eşzamanlı işlemleri sıraya sok ve Risk Controller'dan geçir
 * Max 10 pozisyon kuralını ihlal etmeden en yüksek skorlu emirleri al
 */
export function filterAndPrioritizeOrders(
  orders: QueuedOrder[],
  maxPositions: number = 10,
  existingPositionCount: number = 0,
): { approved: QueuedOrder[]; rejected: QueuedOrder[] } {
  const available = maxPositions - existingPositionCount;

  if (available <= 0) {
    return {
      approved: [],
      rejected: orders.map(o => ({ ...o })),
    };
  }

  // 1. Sadece AL sinyali olanları filtrele (skor >= 58)
  const buySignals = orders.filter(o => o.score >= 58 && (o.signal === 'AL' || o.signal === 'GUCLU_AL'));
  const nonBuy = orders.filter(o => o.score < 58 || (o.signal !== 'AL' && o.signal !== 'GUCLU_AL'));

  // 2. Skora göre sırala (en yüksek önce)
  buySignals.sort((a, b) => {
    // Önce skor, eşitse güven
    if (b.score !== a.score) return b.score - a.score;
    return b.confidence - a.confidence;
  });

  // 3. Mevcut slot kadar al, gerisini reddet
  const approved = buySignals.slice(0, available);
  const rejected = [
    ...buySignals.slice(available), // Sırayı geçemeyenler
    ...nonBuy, // AL sinyali olmayanlar
  ];

  return { approved, rejected };
}

/**
 * Promise-bazlı concurrent batch processor
 * Event Loop bloklamadan N adet işlemi paralel çalıştır
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5,
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        const result = await processor(item);
        results.push(result);
      } catch (err) {
        console.error('[WorkerPool] Islem hatasi:', err);
      }
    }
  });

  await Promise.all(workers);
  return results;
}
