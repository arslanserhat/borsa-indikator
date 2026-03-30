/**
 * KELLY CRITERION + RİSK YÖNETİMİ
 *
 * Simons yaklaşımı: Her işlemde ne kadar riske atmalı?
 * Kelly formülü: f = (p * b - q) / b
 * p = kazanma olasılığı, q = kaybetme olasılığı, b = ortalama kazanç/kayıp
 */

export interface PositionSizing {
  kellyPercent: number;      // Kelly önerisi (%0-25)
  safePercent: number;       // Güvenli pozisyon (%kelly/2)
  maxRiskTL: number;         // TL bazlı max risk
  stopLossPrice: number;     // Önerilen stop-loss
  takeProfitPrice: number;   // Önerilen take-profit
  riskRewardRatio: number;   // Risk/ödül oranı
  reasoning: string;
}

export function calculatePositionSize(
  portfolioValue: number,
  currentPrice: number,
  compositeScore: number,
  confidence: number,
  atr: number,
  winRate?: number,   // Backtest'ten
  avgWin?: number,    // Backtest'ten
  avgLoss?: number,   // Backtest'ten
): PositionSizing {
  // Kelly Criterion
  const p = (winRate || 55) / 100; // Backtest yoksa %55 varsay
  const q = 1 - p;
  const b = Math.abs((avgWin || 5) / (avgLoss || -3)); // Kar/zarar oranı

  let kellyPercent = ((p * b - q) / b) * 100;
  kellyPercent = Math.max(0, Math.min(25, kellyPercent)); // Max %25

  // Güvenli pozisyon (Kelly/2 - over-betting riskini azalt)
  const safePercent = Math.round(kellyPercent / 2 * 10) / 10;

  // Güven ve skor bazlı ayarlama
  const scoreMultiplier = compositeScore >= 70 ? 1.2 : compositeScore >= 58 ? 1.0 : compositeScore >= 42 ? 0.5 : 0.2;
  const confMultiplier = confidence >= 70 ? 1.1 : confidence >= 50 ? 1.0 : 0.7;
  const adjustedPercent = Math.round(safePercent * scoreMultiplier * confMultiplier * 10) / 10;

  // Max risk per trade: portföyün %2'si
  const maxRiskPercent = 2;
  const maxRiskTL = Math.round(portfolioValue * maxRiskPercent / 100);

  // Stop-loss: ATR bazlı (2x ATR altı)
  const stopLossPrice = Math.round((currentPrice - 2 * atr) * 100) / 100;

  // Take-profit: ATR bazlı (3x ATR üstü - 1.5:1 risk/ödül)
  const takeProfitPrice = Math.round((currentPrice + 3 * atr) * 100) / 100;

  const riskPerShare = currentPrice - stopLossPrice;
  const rewardPerShare = takeProfitPrice - currentPrice;
  const riskRewardRatio = riskPerShare > 0 ? Math.round((rewardPerShare / riskPerShare) * 100) / 100 : 0;

  let reasoning = '';
  if (compositeScore >= 58) {
    reasoning = `AL sinyali. Portfoyun %${adjustedPercent}'ini bu hisseye ayirabilirsiniz. Stop-loss: ${stopLossPrice} TL, hedef: ${takeProfitPrice} TL. Risk/odul: 1:${riskRewardRatio}.`;
  } else if (compositeScore <= 42) {
    reasoning = `SAT sinyali. Yeni pozisyon acmayin. Mevcut pozisyon varsa %50-70 satin.`;
  } else {
    reasoning = `NOTR sinyal. Kucuk pozisyonla (%${Math.max(1, adjustedPercent / 2)}) giris yapabilirsiniz. Stop-loss mutlaka koyun: ${stopLossPrice} TL.`;
  }

  return {
    kellyPercent: Math.round(kellyPercent * 10) / 10,
    safePercent: adjustedPercent,
    maxRiskTL,
    stopLossPrice,
    takeProfitPrice,
    riskRewardRatio,
    reasoning,
  };
}

// Portföy korelasyon kontrolü
export function checkPortfolioCorrelation(symbols: string[]): {
  warning: boolean;
  message: string;
  sectorCounts: Record<string, string[]>;
} {
  // BIST sektör haritası
  const SECTORS: Record<string, string> = {
    // Bankalar
    GARAN: 'Banka', AKBNK: 'Banka', ISCTR: 'Banka', YKBNK: 'Banka', VAKBN: 'Banka', HALKB: 'Banka', TSKB: 'Banka',
    // Sanayi
    EREGL: 'Demir/Celik', KRDMD: 'Demir/Celik', ASELS: 'Savunma', TOASO: 'Otomotiv', FROTO: 'Otomotiv',
    ARCLK: 'Beyaz Esya', VESTL: 'Beyaz Esya',
    // Enerji
    TUPRS: 'Enerji', PETKM: 'Enerji', AKSEN: 'Enerji',
    // Holding
    SAHOL: 'Holding', KCHOL: 'Holding', DOHOL: 'Holding',
    // Perakende
    BIMAS: 'Perakende', MGROS: 'Perakende', SOKM: 'Perakende',
    // Havacılık
    THYAO: 'Havacilik', PGSUS: 'Havacilik', TAVHL: 'Havacilik',
    // Telekom
    TCELL: 'Telekom', TTKOM: 'Telekom',
    // GYO
    EKGYO: 'GYO',
    // Kimya
    SASA: 'Kimya', GUBRF: 'Kimya',
  };

  const sectorCounts: Record<string, string[]> = {};
  for (const sym of symbols) {
    const sector = SECTORS[sym] || 'Diger';
    if (!sectorCounts[sector]) sectorCounts[sector] = [];
    sectorCounts[sector].push(sym);
  }

  const overloaded = Object.entries(sectorCounts).filter(([, syms]) => syms.length >= 3);
  const warning = overloaded.length > 0;
  const message = warning
    ? `DIKKAT: ${overloaded.map(([sec, syms]) => `${sec} sektorunde ${syms.length} hisse (${syms.join(', ')})`).join('. ')}. Ayni sektorden cok hisse taşımak riski arttirir.`
    : 'Portfolyo diversifikasyonu uygun.';

  return { warning, message, sectorCounts };
}
