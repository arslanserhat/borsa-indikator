/**
 * STOP-LOSS & ACIL UYARI SİSTEMİ
 *
 * Portföydeki hisseler için otomatik stop-loss takibi.
 * Fiyat belirlenen seviyenin altına düşerse ACIL SAT bildirimi.
 */

export interface StopLossAlert {
  symbol: string;
  currentPrice: number;
  entryPrice: number;
  stopLossPrice: number;
  dropPercent: number;
  severity: 'warning' | 'critical' | 'emergency';
  message: string;
}

export function checkStopLoss(
  portfolioItems: { symbol: string; avgCost: number; currentPrice: number }[],
  atrMap: Record<string, number>,
): StopLossAlert[] {
  const alerts: StopLossAlert[] = [];

  for (const item of portfolioItems) {
    if (item.currentPrice <= 0) continue;

    const dropPercent = ((item.currentPrice - item.avgCost) / item.avgCost) * 100;
    const atr = atrMap[item.symbol] || item.currentPrice * 0.03;

    // ATR bazlı stop-loss (2x ATR)
    const atrStopLoss = Math.round((item.avgCost - 2 * atr) * 100) / 100;
    // Yüzde bazlı stop-loss (%7)
    const pctStopLoss = Math.round(item.avgCost * 0.93 * 100) / 100;
    // Daha sıkı olanı kullan
    const stopLossPrice = Math.max(atrStopLoss, pctStopLoss);

    if (dropPercent <= -10) {
      alerts.push({
        symbol: item.symbol,
        currentPrice: item.currentPrice,
        entryPrice: item.avgCost,
        stopLossPrice,
        dropPercent: Math.round(dropPercent * 100) / 100,
        severity: 'emergency',
        message: `ACIL: ${item.symbol} %${Math.abs(dropPercent).toFixed(1)} dususte! Hemen satin.`,
      });
    } else if (item.currentPrice <= stopLossPrice || dropPercent <= -7) {
      alerts.push({
        symbol: item.symbol,
        currentPrice: item.currentPrice,
        entryPrice: item.avgCost,
        stopLossPrice,
        dropPercent: Math.round(dropPercent * 100) / 100,
        severity: 'critical',
        message: `${item.symbol} stop-loss seviyesine ulasti (${stopLossPrice} TL). Satis dusunun.`,
      });
    } else if (dropPercent <= -5) {
      alerts.push({
        symbol: item.symbol,
        currentPrice: item.currentPrice,
        entryPrice: item.avgCost,
        stopLossPrice,
        dropPercent: Math.round(dropPercent * 100) / 100,
        severity: 'warning',
        message: `${item.symbol} %${Math.abs(dropPercent).toFixed(1)} dususte. Stop-loss: ${stopLossPrice} TL.`,
      });
    }
  }

  return alerts.sort((a, b) => a.dropPercent - b.dropPercent);
}
