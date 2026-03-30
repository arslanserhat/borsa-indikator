/**
 * BACKTESTING MOTORU
 *
 * Simons yaklaşımı: Stratejiyi geçmiş verilerde test et.
 * "Para yatırmadan önce stratejinin çalıştığını kanıtla."
 *
 * Metrikler:
 * - Sharpe Ratio: Risk-ayarlı getiri (>2.0 = mükemmel)
 * - Max Drawdown: En büyük düşüş (<%20 = kabul edilebilir)
 * - Win Rate: Kazanan işlem oranı (>%55 = istatistiksel kenar)
 * - Profit Factor: Toplam kar / toplam zarar (>1.5 = iyi)
 * - CAGR: Yıllık bileşik getiri
 */

import { fetchStockIndicators } from './tradingview';

export interface BacktestResult {
  symbol: string;
  period: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  trades: BacktestTrade[];
  equityCurve: { date: string; equity: number }[];
}

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  signal: 'AL' | 'SAT';
  pnlPercent: number;
  holdDays: number;
}

// TradingView'dan geçmiş veri çek ve sinyal hesapla
export async function runBacktest(symbol: string, days: number = 750): Promise<BacktestResult> {
  // Geçmiş mum verileri çek
  let candles: any[] = [];
  try {
    const { getChartData } = require('./tv-chart');
    candles = await getChartData(symbol, 'D', days);
  } catch (err) {
    throw new Error('Gecmis veri alinamadi: ' + err);
  }

  if (candles.length < 60) {
    throw new Error(`Yetersiz veri: ${candles.length} gun (en az 60 gun gerekli)`);
  }

  // Her gün için basitleştirilmiş sinyal hesapla
  // (Gerçek zamanlı TradingView indikatörleri geçmiş için mevcut değil,
  //  bu yüzden mum verilerinden hesaplıyoruz)
  const signals: { date: string; score: number; price: number }[] = [];

  for (let i = 50; i < candles.length; i++) {
    const slice = candles.slice(0, i + 1);
    const c = slice[slice.length - 1];

    // RSI hesapla (14 periyot)
    const rsi = calculateRSI(slice, 14);

    // SMA hesapla
    const sma20 = calculateSMA(slice, 20);
    const sma50 = calculateSMA(slice, 50);

    // EMA hesapla
    const ema10 = calculateEMA(slice, 10);
    const ema20 = calculateEMA(slice, 20);

    // Bollinger Band
    const { upper: bbUp, lower: bbLow } = calculateBB(slice, 20);

    // MACD
    const macd = calculateMACD(slice);

    // Sinyaller (analysis.ts ile aynı mantık, basitleştirilmiş)
    let score = 50; // nötr başla

    // RSI mean reversion
    if (rsi < 30) score += 15;
    else if (rsi < 40) score += 8;
    else if (rsi > 70) score -= 12;
    else if (rsi > 60) score -= 5;

    // MACD momentum
    if (macd.hist > 0 && macd.macd > macd.signal) score += 10;
    else if (macd.hist > 0) score += 5;
    else if (macd.hist < 0 && macd.macd < macd.signal) score -= 10;
    else score -= 3;

    // Trend (EMA hizalanma)
    if (ema10 > ema20 && c.close > sma50) score += 12;
    else if (ema10 > ema20) score += 6;
    else if (ema10 < ema20 && c.close < sma50) score -= 10;
    else score -= 3;

    // Bollinger mean reversion
    if (bbLow > 0 && bbUp > bbLow) {
      const bbPos = (c.close - bbLow) / (bbUp - bbLow);
      if (bbPos < 0.15) score += 10;
      else if (bbPos < 0.3) score += 5;
      else if (bbPos > 0.85) score -= 8;
      else if (bbPos > 0.7) score -= 4;
    }

    // Hacim analizi
    const avgVol = slice.slice(-20).reduce((s: number, x: any) => s + x.volume, 0) / 20;
    const relVol = c.volume / (avgVol || 1);
    const dailyChange = (c.close - c.open) / (c.open || 1) * 100;
    if (relVol > 1.5 && dailyChange > 0) score += 5;
    else if (relVol > 1.5 && dailyChange < 0) score -= 5;

    const dateStr = new Date(c.time * 1000).toISOString().split('T')[0];
    signals.push({ date: dateStr, score, price: c.close });
  }

  // Trading simülasyonu
  const trades: BacktestTrade[] = [];
  let inPosition = false;
  let entryPrice = 0;
  let entryDate = '';
  let entryIdx = 0;

  for (let i = 0; i < signals.length; i++) {
    const { score, price, date } = signals[i];

    if (!inPosition && score >= 60) {
      // AL sinyali
      inPosition = true;
      entryPrice = price;
      entryDate = date;
      entryIdx = i;
    } else if (inPosition) {
      // Çıkış koşulları
      const holdDays = i - entryIdx;
      const pnl = ((price - entryPrice) / entryPrice) * 100;
      const shouldExit =
        score <= 42 ||                    // SAT sinyali
        pnl <= -5 ||                      // Stop-loss (%5)
        pnl >= 10 ||                      // Take-profit (%10)
        holdDays >= 20;                   // Max holding (20 gün)

      if (shouldExit) {
        trades.push({
          entryDate,
          exitDate: date,
          entryPrice,
          exitPrice: price,
          signal: 'AL',
          pnlPercent: pnl,
          holdDays,
        });
        inPosition = false;
      }
    }
  }

  // Son açık pozisyonu kapat
  if (inPosition && signals.length > 0) {
    const last = signals[signals.length - 1];
    trades.push({
      entryDate,
      exitDate: last.date,
      entryPrice,
      exitPrice: last.price,
      signal: 'AL',
      pnlPercent: ((last.price - entryPrice) / entryPrice) * 100,
      holdDays: signals.length - 1 - entryIdx,
    });
  }

  // Sonuçları hesapla
  const winTrades = trades.filter(t => t.pnlPercent > 0);
  const lossTrades = trades.filter(t => t.pnlPercent <= 0);

  const totalReturn = trades.reduce((sum, t) => sum * (1 + t.pnlPercent / 100), 1) - 1;
  const years = candles.length / 252; // yaklaşık trading günü
  const cagr = (Math.pow(1 + totalReturn, 1 / years) - 1) * 100;

  const avgWin = winTrades.length > 0 ? winTrades.reduce((s, t) => s + t.pnlPercent, 0) / winTrades.length : 0;
  const avgLoss = lossTrades.length > 0 ? lossTrades.reduce((s, t) => s + t.pnlPercent, 0) / lossTrades.length : 0;
  const totalWins = winTrades.reduce((s, t) => s + t.pnlPercent, 0);
  const totalLosses = Math.abs(lossTrades.reduce((s, t) => s + t.pnlPercent, 0));

  // Equity curve
  const equityCurve: { date: string; equity: number }[] = [];
  let equity = 100;
  let maxEquity = 100;
  let maxDD = 0;
  const returns: number[] = [];

  for (const trade of trades) {
    equity *= (1 + trade.pnlPercent / 100);
    equityCurve.push({ date: trade.exitDate, equity: Math.round(equity * 100) / 100 });
    returns.push(trade.pnlPercent);

    if (equity > maxEquity) maxEquity = equity;
    const dd = ((maxEquity - equity) / maxEquity) * 100;
    if (dd > maxDD) maxDD = dd;
  }

  // Sharpe Ratio
  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = returns.length > 1 ? Math.sqrt(returns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (returns.length - 1)) : 1;
  const sharpe = stdReturn > 0 ? (meanReturn / stdReturn) * Math.sqrt(252 / (candles.length / trades.length || 1)) : 0;

  return {
    symbol,
    period: `${candles.length} gun (~${years.toFixed(1)} yil)`,
    totalTrades: trades.length,
    winningTrades: winTrades.length,
    losingTrades: lossTrades.length,
    winRate: trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0,
    totalReturn: totalReturn * 100,
    cagr,
    maxDrawdown: maxDD,
    sharpeRatio: Math.round(sharpe * 100) / 100,
    profitFactor: totalLosses > 0 ? Math.round((totalWins / totalLosses) * 100) / 100 : totalWins > 0 ? 999 : 0,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    largestWin: winTrades.length > 0 ? Math.round(Math.max(...winTrades.map(t => t.pnlPercent)) * 100) / 100 : 0,
    largestLoss: lossTrades.length > 0 ? Math.round(Math.min(...lossTrades.map(t => t.pnlPercent)) * 100) / 100 : 0,
    trades,
    equityCurve,
  };
}

// ============ TEKNİK HESAPLAMALAR (Pure Math) ============

function calculateRSI(candles: any[], period: number): number {
  if (candles.length < period + 1) return 50;

  let gains = 0, losses = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateSMA(candles: any[], period: number): number {
  if (candles.length < period) return 0;
  const slice = candles.slice(-period);
  return slice.reduce((s: number, c: any) => s + c.close, 0) / period;
}

function calculateEMA(candles: any[], period: number): number {
  if (candles.length < period) return 0;
  const k = 2 / (period + 1);
  let ema = candles[0].close;
  for (let i = 1; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
  }
  return ema;
}

function calculateBB(candles: any[], period: number): { upper: number; middle: number; lower: number } {
  const sma = calculateSMA(candles, period);
  if (candles.length < period) return { upper: 0, middle: 0, lower: 0 };

  const slice = candles.slice(-period);
  const variance = slice.reduce((s: number, c: any) => s + (c.close - sma) ** 2, 0) / period;
  const std = Math.sqrt(variance);

  return { upper: sma + 2 * std, middle: sma, lower: sma - 2 * std };
}

function calculateMACD(candles: any[]): { macd: number; signal: number; hist: number } {
  const ema12 = calculateEMA(candles, 12);
  const ema26 = calculateEMA(candles, 26);
  const macdLine = ema12 - ema26;

  // Signal line (9-period EMA of MACD) - simplified
  const macdValues: number[] = [];
  for (let i = 26; i < candles.length; i++) {
    const e12 = calculateEMA(candles.slice(0, i + 1), 12);
    const e26 = calculateEMA(candles.slice(0, i + 1), 26);
    macdValues.push(e12 - e26);
  }

  let signal = macdValues[0] || 0;
  const k = 2 / 10;
  for (const mv of macdValues) {
    signal = mv * k + signal * (1 - k);
  }

  return { macd: macdLine, signal, hist: macdLine - signal };
}
