/**
 * BORSA ANALİZ MOTORU v2.0
 *
 * James Simons / Renaissance Technologies yaklaşımından ilham alınmıştır:
 * - Mean reversion (ortalamaya dönüş) + Momentum birleşimi
 * - Çoklu bağımsız sinyal kaynağı (26+ indikatör)
 * - İstatistiksel kenar: Her sinyal bağımsız ağırlıklandırılır
 * - Duygu yok, sadece veri
 * - Risk yönetimi her kararın parçası
 *
 * VERİ KAYNAKLARI:
 * 1. TradingView Scanner API - 36 gerçek zamanlı indikatör
 *    (RSI, MACD, Stoch, BB, EMA/SMA x8, ADX, CCI, W%R, P.SAR, ATR)
 * 2. TradingView Recommendations - 26 indikatörün birleşik analizi
 *    (Recommend.All, Recommend.Other, Recommend.MA)
 * 3. OHLCV mum verileri - Son 66 günlük daily data
 * 4. KAP + Bloomberg HT haberleri - Türkçe duygu analizi
 */

import {
  TradingViewIndicators, CandleData, CandlestickPattern,
  NewsSentiment, ScoreBreakdown, AnalysisResult, AnalysisReport, Signal,
} from '@/types/analysis';
import { fetchStockIndicators } from './tradingview';
import { aggregateNews } from './news';
import { getMarketFilter } from './macro';
import { NewsItem } from '@/types/news';

// ============ A) VERİ ÇEKME ============

const ANALYSIS_COLUMNS = [
  'name', 'close', 'change', 'change_abs', 'high', 'low',         // 0-5
  'volume', 'open', 'description',                                  // 6-8
  'Recommend.All', 'Recommend.Other', 'Recommend.MA',               // 9-11
  'RSI', 'MACD.macd', 'MACD.signal', 'MACD.hist', 'ADX',          // 12-16
  'EMA10', 'EMA20', 'EMA50', 'EMA200',                             // 17-20
  'SMA10', 'SMA20', 'SMA50', 'SMA200',                             // 21-24
  'Stoch.K', 'Stoch.D',                                             // 25-26
  'BB.upper', 'BB.lower',                                           // 27-28
  'ATR', 'CCI20', 'W.R', 'P.SAR',                                  // 29-32
  'relative_volume_10d_calc',                                        // 33
  'market_cap_basic', 'price_earnings_ttm',                          // 34-35
];

async function fetchIndicators(symbol: string): Promise<TradingViewIndicators> {
  const d = await fetchStockIndicators(symbol, ANALYSIS_COLUMNS);
  if (!d) throw new Error('TradingView verisi alinamadi');

  return {
    symbol: d[0] || symbol, name: d[8] || '',
    close: d[1] || 0, change: d[3] || 0, changePercent: d[2] || 0,
    high: d[4] || 0, low: d[5] || 0, volume: d[6] || 0, open: d[7] || 0,
    prevClose: 0, bid: 0, ask: 0,
    marketCap: d[34] || 0, pe: d[35] || 0,
    recommendAll: d[9] || 0, recommendOther: d[10] || 0, recommendMA: d[11] || 0,
    rsi: d[12] ?? 50, macdValue: d[13] || 0, macdSignal: d[14] || 0, macdHist: d[15] || 0,
    adx: d[16] || 0,
    ema10: d[17] || 0, ema20: d[18] || 0, ema50: d[19] || 0, ema200: d[20] || 0,
    sma10: d[21] || 0, sma20: d[22] || 0, sma50: d[23] || 0, sma200: d[24] || 0,
    stochK: d[25] ?? 50, stochD: d[26] ?? 50,
    bbUpper: d[27] || 0, bbLower: d[28] || 0,
    atr: d[29] || 0, cci20: d[30] || 0, williamsR: d[31] ?? -50, psar: d[32] || 0,
    relativeVolume: d[33] ?? 1,
    pivotS3: 0, pivotS2: 0, pivotS1: 0, pivotMiddle: 0, pivotR1: 0, pivotR2: 0, pivotR3: 0,
  };
}

// ============ B) MUM FORMASYONU TESPİTİ ============

function bodySize(c: CandleData): number { return Math.abs(c.close - c.open); }
function upperShadow(c: CandleData): number { return c.high - Math.max(c.open, c.close); }
function lowerShadow(c: CandleData): number { return Math.min(c.open, c.close) - c.low; }
function candleRange(c: CandleData): number { return c.high - c.low || 0.001; }
function isBullish(c: CandleData): boolean { return c.close > c.open; }
function isBearish(c: CandleData): boolean { return c.close < c.open; }

export function detectCandlestickPatterns(candles: CandleData[]): CandlestickPattern[] {
  const patterns: CandlestickPattern[] = [];
  if (candles.length < 3) return patterns;

  const len = candles.length;
  const startIdx = Math.max(0, len - 10);

  for (let i = startIdx; i < len; i++) {
    const c = candles[i];
    const range = candleRange(c);
    const body = bodySize(c);
    const barIdx = len - 1 - i;

    if (body <= range * 0.1) {
      patterns.push({ name: 'Doji', nameEN: 'Doji', type: 'neutral', strength: 1, barIndex: barIdx, description: 'Kararsizlik - piyasa yon ariyor' });
    }
    if (body > 0 && lowerShadow(c) >= body * 2 && upperShadow(c) <= body * 0.3 && body <= range * 0.35) {
      patterns.push({ name: 'Cekic', nameEN: 'Hammer', type: 'bullish', strength: 2, barIndex: barIdx, description: 'Dip donusu sinyali - alicilar hakim' });
    }
    if (body > 0 && upperShadow(c) >= body * 2 && lowerShadow(c) <= body * 0.3 && body <= range * 0.35) {
      patterns.push({ name: 'Kayan Yildiz', nameEN: 'Shooting Star', type: 'bearish', strength: 2, barIndex: barIdx, description: 'Tepe donusu sinyali - saticilar hakim' });
    }
    if (i > 0) {
      const prev = candles[i - 1];
      if (isBearish(prev) && isBullish(c) && c.open <= prev.close && c.close >= prev.open) {
        patterns.push({ name: 'Yukselis Yutma', nameEN: 'Bullish Engulfing', type: 'bullish', strength: 2, barIndex: barIdx, description: 'Guclu yukselis donusu' });
      }
      if (isBullish(prev) && isBearish(c) && c.open >= prev.close && c.close <= prev.open) {
        patterns.push({ name: 'Dusus Yutma', nameEN: 'Bearish Engulfing', type: 'bearish', strength: 2, barIndex: barIdx, description: 'Guclu dusus donusu' });
      }
    }
    if (i >= 2) {
      const c1 = candles[i - 2], c2 = candles[i - 1], c3 = c;
      if (isBearish(c1) && bodySize(c1) > candleRange(c1) * 0.5 && bodySize(c2) < candleRange(c2) * 0.3 && isBullish(c3) && c3.close > (c1.open + c1.close) / 2) {
        patterns.push({ name: 'Sabah Yildizi', nameEN: 'Morning Star', type: 'bullish', strength: 3, barIndex: barIdx, description: 'Cok guclu dip donusu formasyonu' });
      }
      if (isBullish(c1) && bodySize(c1) > candleRange(c1) * 0.5 && bodySize(c2) < candleRange(c2) * 0.3 && isBearish(c3) && c3.close < (c1.open + c1.close) / 2) {
        patterns.push({ name: 'Aksam Yildizi', nameEN: 'Evening Star', type: 'bearish', strength: 3, barIndex: barIdx, description: 'Cok guclu tepe donusu formasyonu' });
      }
      if (isBullish(c1) && isBullish(c2) && isBullish(c3) && c2.close > c1.close && c3.close > c2.close && bodySize(c1) > candleRange(c1) * 0.4 && bodySize(c2) > candleRange(c2) * 0.4) {
        patterns.push({ name: 'Uc Beyaz Asker', nameEN: 'Three White Soldiers', type: 'bullish', strength: 3, barIndex: barIdx, description: 'Yukselis trendi guclu devam edecek' });
      }
      if (isBearish(c1) && isBearish(c2) && isBearish(c3) && c2.close < c1.close && c3.close < c2.close && bodySize(c1) > candleRange(c1) * 0.4 && bodySize(c2) > candleRange(c2) * 0.4) {
        patterns.push({ name: 'Uc Kara Karga', nameEN: 'Three Black Crows', type: 'bearish', strength: 3, barIndex: barIdx, description: 'Dusus trendi guclu devam edecek' });
      }
    }
  }
  // DECAY KURALI: Son 3 mum = aktif, eski formasyonlar atılır
  const recent = patterns.filter(p => p.barIndex <= 3);

  // ÇAKIŞMA KONTROLÜ: Aynı anda bullish+bearish varsa
  const hasBullish = recent.some(p => p.type === 'bullish');
  const hasBearish = recent.some(p => p.type === 'bearish');

  if (hasBullish && hasBearish) {
    // Çakışma - en yeni (barIndex en düşük) formasyonun yönünü tut
    // Ters yöndeki ESKİ formasyonları at
    const newest = recent.reduce((a, b) => a.barIndex < b.barIndex ? a : b);
    return recent.filter(p =>
      p.type === newest.type ||  // Aynı yön
      p.type === 'neutral' ||    // Doji kal
      p.barIndex <= 1            // En son mum her zaman kal
    );
  }

  return recent;
}

// ============ C) HABER DUYGU ANALİZİ ============

const POSITIVE_WORDS: Record<string, number> = {
  'kar': 0.5, 'kâr': 0.5, 'artis': 0.4, 'artış': 0.4, 'yukselis': 0.5, 'yükseliş': 0.5,
  'buyume': 0.4, 'büyüme': 0.4, 'rekor': 0.6, 'temettu': 0.7, 'temettü': 0.7,
  'ortaklik': 0.3, 'ortaklık': 0.3, 'ihracat': 0.3, 'yatirim': 0.3, 'yatırım': 0.3,
  'olumlu': 0.4, 'basarili': 0.4, 'başarılı': 0.4, 'anlaşma': 0.4,
  'güçlü': 0.3, 'pozitif': 0.4, 'talep': 0.3, 'toparlanma': 0.4,
  'destek': 0.3, 'hedef fiyat': 0.5, 'al tavsiyesi': 0.6,
};

const NEGATIVE_WORDS: Record<string, number> = {
  'zarar': -0.6, 'dusus': -0.5, 'düşüş': -0.5, 'azalis': -0.4, 'azalış': -0.4,
  'sorun': -0.3, 'ceza': -0.5, 'iflas': -0.8, 'kayip': -0.5, 'kayıp': -0.5,
  'borc': -0.4, 'borç': -0.4, 'dava': -0.3, 'olumsuz': -0.4, 'risk': -0.3,
  'negatif': -0.4, 'gerileme': -0.4, 'endise': -0.4, 'endişe': -0.4,
  'savaş': -0.5, 'kriz': -0.6, 'yasak': -0.3, 'sat tavsiyesi': -0.6, 'enflasyon': -0.3,
};

// Bigram düzeltmeleri - bağlam bazlı sentiment
// "kar düştü" gibi ifadelerde "kar" pozitif sayılmamalı
const NEGATIVE_BIGRAMS: Record<string, number> = {
  'kar düştü': -0.7, 'kar azaldı': -0.6, 'kar geriledi': -0.5,
  'kâr düştü': -0.7, 'kâr azaldı': -0.6,
  'satışlar düştü': -0.5, 'satışlar azaldı': -0.5,
  'büyüme yavaşladı': -0.4, 'büyüme durdu': -0.5,
  'zarara döndü': -0.7, 'zarar açıkladı': -0.6,
  'hisse düştü': -0.4, 'değer kaybetti': -0.5,
  'beklentilerin altında': -0.5, 'beklenti altında': -0.4,
};

const POSITIVE_BIGRAMS: Record<string, number> = {
  'kâra geçti': 0.7, 'kara geçti': 0.7, 'kâra döndü': 0.7,
  'kar arttı': 0.6, 'kâr arttı': 0.6, 'kar rekor': 0.7,
  'satışlar arttı': 0.5, 'satış rekor': 0.6,
  'beklentilerin üzerinde': 0.6, 'beklenti üzerinde': 0.5,
  'hedef fiyat yükseltti': 0.5, 'not yükseltti': 0.5,
  'temettü dağıtacak': 0.6, 'bedelsiz sermaye': 0.5,
};

export function analyzeSentiment(newsItems: NewsItem[]): NewsSentiment[] {
  return newsItems.map((item) => {
    const text = (item.title + ' ' + (item.summary || '')).toLowerCase();
    let score = 0;
    const keywords: string[] = [];

    // 1. Önce bigram'ları kontrol et (bağlam bazlı - daha doğru)
    for (const [bigram, val] of Object.entries(NEGATIVE_BIGRAMS)) {
      if (text.includes(bigram)) { score += val; keywords.push(bigram); }
    }
    for (const [bigram, val] of Object.entries(POSITIVE_BIGRAMS)) {
      if (text.includes(bigram)) { score += val; keywords.push('+' + bigram); }
    }

    // 2. Sonra tekil kelimeleri kontrol et (bigram'da yakalanamayanlar)
    // Bigram'da zaten yakalanan kelimeleri tekrar saymamak için kontrol
    const bigramText = [...Object.keys(NEGATIVE_BIGRAMS), ...Object.keys(POSITIVE_BIGRAMS)]
      .filter(b => text.includes(b)).join(' ');

    for (const [word, val] of Object.entries(POSITIVE_WORDS)) {
      if (text.includes(word) && !bigramText.includes(word)) { score += val; keywords.push('+' + word); }
    }
    for (const [word, val] of Object.entries(NEGATIVE_WORDS)) {
      if (text.includes(word) && !bigramText.includes(word)) { score += val; keywords.push(word); }
    }

    if (item.source === 'kap' && score === 0) score = 0.05;
    return { newsId: item.id, title: item.title, score: Math.max(-1, Math.min(1, score)), source: item.source as 'kap' | 'bloomberg', publishedAt: item.publishedAt, keywords };
  });
}

function aggregateSentimentScore(sentiments: NewsSentiment[]): number {
  if (sentiments.length === 0) return 0;
  const now = Date.now();
  let weightedSum = 0, totalWeight = 0;
  for (const s of sentiments) {
    const age = (now - new Date(s.publishedAt).getTime()) / (1000 * 60 * 60);
    const weight = age > 72 ? 0.3 : age > 48 ? 0.5 : age > 24 ? 0.7 : 1.0;
    weightedSum += s.score * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? Math.max(-1, Math.min(1, weightedSum / totalWeight)) : 0;
}

// ============ D) SIMONS YAKLAŞIMI: BAGIMSIZ SİNYAL SKORLAMA ============
// Her indikatör bağımsız bir sinyal kaynağı (-1 ile +1 arası)
// Sonra ağırlıklı ortalama ile birleştirilir
// Bu James Simons'ın "çoklu bağımsız küçük sinyaller" yaklaşımıdır

interface IndividualSignal {
  name: string;
  value: number;      // Ham değer
  signal: number;     // -1 (güçlü sat) ile +1 (güçlü al) arası
  weight: number;     // 0-1 arası ağırlık
  reasoning: string;  // Neden bu sinyal
}

function generateSignals(ind: TradingViewIndicators): IndividualSignal[] {
  const signals: IndividualSignal[] = [];
  const price = ind.close;

  // === SİNYAL 1: TradingView 26-İndikatör Birleşik Analizi (EN GÜVENİLİR) ===
  // Bu tek başına 26 farklı indikatörün birleşik analizi
  signals.push({
    name: 'TV Genel Oneri',
    value: ind.recommendAll,
    signal: ind.recommendAll, // Zaten -1 ile +1 arası
    weight: 0.18,  // Collinearity düzeltmesi: TV zaten RSI+MACD+Stoch içeriyor
    reasoning: ind.recommendAll > 0.3 ? 'TradingView 26 indikator analizi GUCLU AL diyor'
      : ind.recommendAll > 0.1 ? 'TradingView indikatorleri AL yonunde'
      : ind.recommendAll < -0.3 ? 'TradingView 26 indikator analizi GUCLU SAT diyor'
      : ind.recommendAll < -0.1 ? 'TradingView indikatorleri SAT yonunde'
      : 'TradingView indikatorleri karisik/notr sinyal veriyor',
  });

  // === SİNYAL 2: RSI Mean Reversion (Simons'ın temel stratejisi) ===
  let rsiSignal = 0;
  let rsiReason = '';
  if (ind.rsi < 25) { rsiSignal = 0.9; rsiReason = `RSI ${ind.rsi.toFixed(1)} ASIRI SATIM - guclu dip alis firsati (mean reversion)`; }
  else if (ind.rsi < 30) { rsiSignal = 0.7; rsiReason = `RSI ${ind.rsi.toFixed(1)} satim bolgesinde - alis firsati`; }
  else if (ind.rsi < 40) { rsiSignal = 0.3; rsiReason = `RSI ${ind.rsi.toFixed(1)} zayif bolge - potansiyel alis`; }
  else if (ind.rsi < 60) { rsiSignal = 0; rsiReason = `RSI ${ind.rsi.toFixed(1)} notr bolgede`; }
  else if (ind.rsi < 70) { rsiSignal = -0.3; rsiReason = `RSI ${ind.rsi.toFixed(1)} guclu bolge ama asiri alima yaklasıyor`; }
  else if (ind.rsi < 80) { rsiSignal = -0.6; rsiReason = `RSI ${ind.rsi.toFixed(1)} ASIRI ALIM - satis/kar al sinyali`; }
  else { rsiSignal = -0.9; rsiReason = `RSI ${ind.rsi.toFixed(1)} EKSTREM ASIRI ALIM - acil satis`; }
  signals.push({ name: 'RSI Mean Reversion', value: ind.rsi, signal: rsiSignal, weight: 0.08, reasoning: rsiReason });

  // === SİNYAL 3: MACD Momentum ===
  let macdSignal = 0;
  let macdReason = '';
  if (ind.macdHist > 0 && ind.macdValue > ind.macdSignal) {
    macdSignal = Math.min(0.8, ind.macdHist * 10);
    macdReason = `MACD histogram pozitif (${ind.macdHist.toFixed(3)}), sinyal cizgisi uzerinde - yukselis momentumu`;
  } else if (ind.macdHist > 0) {
    macdSignal = 0.3;
    macdReason = `MACD histogram pozitife dondu (${ind.macdHist.toFixed(3)}) - momentum toparlanıyor`;
  } else if (ind.macdHist < 0 && ind.macdValue < ind.macdSignal) {
    macdSignal = Math.max(-0.8, ind.macdHist * 10);
    macdReason = `MACD histogram negatif (${ind.macdHist.toFixed(3)}), sinyal cizgisi altinda - dusus momentumu`;
  } else {
    macdSignal = -0.2;
    macdReason = `MACD negatif bolgede (${ind.macdHist.toFixed(3)}) - zayif momentum`;
  }
  signals.push({ name: 'MACD Momentum', value: ind.macdHist, signal: macdSignal, weight: 0.06, reasoning: macdReason });

  // === SİNYAL 4: Stochastic Oversold/Overbought ===
  let stochSignal = 0;
  let stochReason = '';
  const stochCrossUp = ind.stochK > ind.stochD;
  if (ind.stochK < 20 && stochCrossUp) { stochSignal = 0.9; stochReason = `Stoch %K=${ind.stochK.toFixed(0)} oversold + yukari kesisim - GUCLU ALIS`; }
  else if (ind.stochK < 20) { stochSignal = 0.6; stochReason = `Stoch %K=${ind.stochK.toFixed(0)} oversold - dip bolgesi`; }
  else if (ind.stochK > 80 && !stochCrossUp) { stochSignal = -0.8; stochReason = `Stoch %K=${ind.stochK.toFixed(0)} overbought + asagi kesisim - SATIS`; }
  else if (ind.stochK > 80) { stochSignal = -0.4; stochReason = `Stoch %K=${ind.stochK.toFixed(0)} overbought bolgesinde`; }
  else { stochSignal = (50 - ind.stochK) / 100; stochReason = `Stoch %K=${ind.stochK.toFixed(0)} notr bolgede`; }
  signals.push({ name: 'Stochastic', value: ind.stochK, signal: stochSignal, weight: 0.05, reasoning: stochReason });

  // === SİNYAL 5: Trend Yönü (EMA Hizalanma) ===
  let trendSignal = 0;
  let trendReason = '';
  const emaUp = ind.ema10 > ind.ema20 && ind.ema20 > ind.ema50;
  const emaDown = ind.ema10 < ind.ema20 && ind.ema20 < ind.ema50;
  const above200 = price > ind.ema200;

  if (emaUp && above200) { trendSignal = 0.8; trendReason = 'Mukemmel yukselis trendi: EMA10>20>50, fiyat EMA200 uzerinde'; }
  else if (emaUp) { trendSignal = 0.5; trendReason = 'Kisa vadeli yukselis trendi: EMA10>20>50'; }
  else if (emaDown && !above200) { trendSignal = -0.8; trendReason = 'Guclu dusus trendi: EMA10<20<50, fiyat EMA200 altinda'; }
  else if (emaDown) { trendSignal = -0.4; trendReason = 'Kisa vadeli dusus trendi: EMA10<20<50'; }
  else if (above200) { trendSignal = 0.2; trendReason = 'Uzun vadeli trend yukari ama kisa vade karisik'; }
  else { trendSignal = -0.2; trendReason = 'Uzun vadeli trend asagi, kisa vade karisik'; }
  signals.push({ name: 'EMA Trend', value: 0, signal: trendSignal, weight: 0.08, reasoning: trendReason });

  // === SİNYAL 6: TradingView MA Önerisi ===
  signals.push({
    name: 'TV MA Trend',
    value: ind.recommendMA,
    signal: ind.recommendMA,
    weight: 0.05, // EMA Trend ile collinearity var, azaltildi
    reasoning: ind.recommendMA > 0.3 ? '13 hareketli ortalamanin cogu AL diyor'
      : ind.recommendMA < -0.3 ? '13 hareketli ortalamanin cogu SAT diyor'
      : 'Hareketli ortalamalar karisik sinyal veriyor',
  });

  // === SİNYAL 7: Bollinger Band Pozisyonu (Mean Reversion) ===
  let bbSignal = 0;
  let bbReason = '';
  if (ind.bbUpper > 0 && ind.bbLower > 0 && ind.bbUpper > ind.bbLower) {
    const bbRange = ind.bbUpper - ind.bbLower;
    const bbPos = (price - ind.bbLower) / bbRange; // 0-1 arası

    if (bbPos < 0.1) { bbSignal = 0.8; bbReason = `Fiyat Bollinger alt bandinin altinda (${(bbPos*100).toFixed(0)}%) - GUCLU mean reversion alis`; }
    else if (bbPos < 0.25) { bbSignal = 0.5; bbReason = `Fiyat Bollinger alt bandina yakin (${(bbPos*100).toFixed(0)}%) - ortalamaya donus beklenir`; }
    else if (bbPos > 0.9) { bbSignal = -0.7; bbReason = `Fiyat Bollinger ust bandini asti (${(bbPos*100).toFixed(0)}%) - geri cekilme beklenir`; }
    else if (bbPos > 0.75) { bbSignal = -0.4; bbReason = `Fiyat Bollinger ust bandina yakin (${(bbPos*100).toFixed(0)}%)`; }
    else { bbSignal = 0; bbReason = `Fiyat Bollinger bant ortasinda (${(bbPos*100).toFixed(0)}%)`; }
  } else { bbReason = 'Bollinger band verisi yok'; }
  signals.push({ name: 'Bollinger Mean Rev.', value: 0, signal: bbSignal, weight: 0.08, reasoning: bbReason });

  // === SİNYAL 8: ADX Trend Gücü ===
  let adxSignal = 0;
  let adxReason = '';
  if (ind.adx > 40) { adxSignal = 0.3; adxReason = `ADX ${ind.adx.toFixed(1)} - cok guclu trend, mevcut yone devam`; }
  else if (ind.adx > 25) { adxSignal = 0.1; adxReason = `ADX ${ind.adx.toFixed(1)} - orta gucte trend`; }
  else { adxSignal = -0.1; adxReason = `ADX ${ind.adx.toFixed(1)} - zayif trend, yatay piyasa (range-bound)`; }
  // ADX yönü değil gücü gösterir, trend yönüyle birleştirilmeli
  if (ind.adx > 25 && trendSignal < 0) adxSignal = -adxSignal;
  signals.push({ name: 'ADX Trend Gucu', value: ind.adx, signal: adxSignal, weight: 0.04, reasoning: adxReason });

  // === SİNYAL 9: CCI Divergence ===
  let cciSignal = 0;
  if (ind.cci20 < -150) cciSignal = 0.7;
  else if (ind.cci20 < -100) cciSignal = 0.5;
  else if (ind.cci20 > 150) cciSignal = -0.6;
  else if (ind.cci20 > 100) cciSignal = -0.4;
  else cciSignal = -ind.cci20 / 300;
  signals.push({ name: 'CCI', value: ind.cci20, signal: cciSignal, weight: 0.03, reasoning: `CCI ${ind.cci20.toFixed(0)}: ${ind.cci20<-100?'oversold':ind.cci20>100?'overbought':'notr'}` }); // RSI ile collinearity, azaltildi

  // === SİNYAL 10: Volume Konfirmasyonu ===
  const rv = ind.relativeVolume;
  let volSignal = 0;
  let volReason = '';
  if (rv > 1.5 && ind.changePercent > 0.5) { volSignal = 0.6; volReason = `Yuksek hacim (${rv.toFixed(1)}x) + yukselis = toplama (accumulation)`; }
  else if (rv > 1.5 && ind.changePercent < -0.5) { volSignal = -0.6; volReason = `Yuksek hacim (${rv.toFixed(1)}x) + dusus = dagitim (distribution)`; }
  else if (rv < 0.5) { volSignal = 0; volReason = `Dusuk hacim (${rv.toFixed(1)}x) - sinyal guvenilir degil`; }
  else { volSignal = 0; volReason = `Normal hacim (${rv.toFixed(1)}x)`; }
  signals.push({ name: 'Hacim', value: rv, signal: volSignal, weight: 0.07, reasoning: volReason }); // Bagimsiz sinyal, agirlik artirildi

  // === SİNYAL 11: Parabolic SAR ===
  const psarValid = ind.psar > 0;
  const psarBullish = psarValid && price > ind.psar;
  signals.push({
    name: 'Parabolic SAR',
    value: ind.psar,
    signal: psarValid ? (psarBullish ? 0.5 : -0.5) : 0,
    weight: 0.04, // EMA ile collinearity, azaltildi
    reasoning: !psarValid ? 'PSAR verisi yok' : psarBullish ? `Fiyat (${price.toFixed(2)}) PSAR (${ind.psar.toFixed(2)}) uzerinde - yukselis trendi` : `Fiyat (${price.toFixed(2)}) PSAR (${ind.psar.toFixed(2)}) altinda - dusus trendi`,
  });

  return signals;
}

// ============ DIVERGENCE TESPİTİ ============
// Fiyat yükselir + RSI düşer = bearish divergence (çok tehlikeli)
// Fiyat düşer + RSI yükselir = bullish divergence (fırsat)

function detectDivergence(candles: CandleData[], currentRSI: number): {
  signal: number; reasoning: string;
} {
  if (candles.length < 20) return { signal: 0, reasoning: 'Yetersiz veri' };

  const len = candles.length;
  const recent = candles.slice(-5);
  const prev = candles.slice(-15, -5);

  const recentHigh = Math.max(...recent.map(c => c.high));
  const prevHigh = Math.max(...prev.map(c => c.high));
  const recentLow = Math.min(...recent.map(c => c.low));
  const prevLow = Math.min(...prev.map(c => c.low));

  // Basit RSI hesapla (son 5 ve önceki 10 periyot için)
  const calcSimpleRSI = (slice: CandleData[]): number => {
    let gains = 0, losses = 0;
    for (let i = 1; i < slice.length; i++) {
      const change = slice[i].close - slice[i - 1].close;
      if (change > 0) gains += change; else losses -= change;
    }
    const avgGain = gains / (slice.length - 1);
    const avgLoss = losses / (slice.length - 1);
    if (avgLoss === 0) return 100;
    return 100 - (100 / (1 + avgGain / avgLoss));
  };

  const prevRSI = calcSimpleRSI(candles.slice(-20, -5));

  // Bearish Divergence: Fiyat yeni yüksek yapıyor ama RSI düşüyor
  if (recentHigh > prevHigh * 1.01 && currentRSI < prevRSI - 3) {
    const strength = Math.min(0.8, (prevRSI - currentRSI) / 20);
    return {
      signal: -strength,
      reasoning: `BEARISH DIVERGENCE: Fiyat yeni yuksek (${recentHigh.toFixed(2)}) ama RSI dusmus (${currentRSI.toFixed(0)} < ${prevRSI.toFixed(0)}). Donus riski yuksek!`,
    };
  }

  // Bullish Divergence: Fiyat yeni düşük yapıyor ama RSI yükseliyor
  if (recentLow < prevLow * 0.99 && currentRSI > prevRSI + 3) {
    const strength = Math.min(0.8, (currentRSI - prevRSI) / 20);
    return {
      signal: strength,
      reasoning: `BULLISH DIVERGENCE: Fiyat yeni dusuk (${recentLow.toFixed(2)}) ama RSI yukseldi (${currentRSI.toFixed(0)} > ${prevRSI.toFixed(0)}). Dip alis firsati!`,
    };
  }

  return { signal: 0, reasoning: 'Divergence tespit edilmedi' };
}

// ============ E) SİMONS KOMPOZİT SKORLAMA ============

function calculateCompositeFromSignals(signals: IndividualSignal[]): {
  composite: number;
  scores: ScoreBreakdown;
} {
  // Ağırlıklı sinyal ortalaması hesapla (-1 ile +1 arası)
  let totalWeightedSignal = 0;
  let totalWeight = 0;
  for (const s of signals) {
    totalWeightedSignal += s.signal * s.weight;
    totalWeight += s.weight;
  }
  const avgSignal = totalWeight > 0 ? totalWeightedSignal / totalWeight : 0;

  // -1..+1 -> 0..100 dönüşümü
  const composite = Math.round(((avgSignal + 1) / 2) * 100);

  // Alt skorları da hesapla (gruplama)
  const technicalSignals = signals.filter(s => ['TV Genel Oneri', 'RSI Mean Reversion', 'MACD Momentum', 'Stochastic', 'CCI'].includes(s.name));
  const trendSignals = signals.filter(s => ['EMA Trend', 'TV MA Trend', 'ADX Trend Gucu', 'Parabolic SAR'].includes(s.name));
  const volumeSignals = signals.filter(s => s.name === 'Hacim');
  const bbSignals = signals.filter(s => s.name === 'Bollinger Mean Rev.');

  function groupScore(sigs: IndividualSignal[]): number {
    if (sigs.length === 0) return 50;
    let ws = 0, wt = 0;
    for (const s of sigs) { ws += s.signal * s.weight; wt += s.weight; }
    return Math.round(((ws / wt + 1) / 2) * 100);
  }

  return {
    composite,
    scores: {
      technical: groupScore(technicalSignals),
      trend: groupScore(trendSignals),
      volume: groupScore(volumeSignals),
      sentiment: 50, // Dışarıdan set edilecek
      candlestick: 50,
    },
  };
}

function determineSignal(score: number): { signal: Signal; signalText: string } {
  if (score >= 70) return { signal: 'GUCLU_AL', signalText: 'GUCLU AL' };
  if (score >= 58) return { signal: 'AL', signalText: 'AL' };
  if (score >= 42) return { signal: 'NOTR', signalText: 'NOTR' };
  if (score >= 30) return { signal: 'SAT', signalText: 'SAT' };
  return { signal: 'GUCLU_SAT', signalText: 'GUCLU SAT' };
}

function calculateConfidence(signals: IndividualSignal[], composite: number): number {
  const isBuy = composite >= 50;
  const aligned = signals.filter(s => isBuy ? s.signal > 0.1 : s.signal < -0.1).length;
  const total = signals.length;
  const alignmentRatio = aligned / total;

  // Güçlü sinyallerin sayısı
  const strongSignals = signals.filter(s => Math.abs(s.signal) > 0.5).length;

  const base = Math.round(alignmentRatio * 70);
  const bonus = Math.min(25, strongSignals * 5);

  return Math.min(95, Math.max(20, base + bonus));
}

function calculateSentimentScore(avg: number): number {
  return Math.round(((avg + 1) / 2) * 100);
}

function calculateCandlestickScore(patterns: CandlestickPattern[]): number {
  let score = 50;
  for (const p of patterns) {
    if (p.barIndex > 5) continue;
    const impact = p.strength === 3 ? 18 : p.strength === 2 ? 12 : 6;
    if (p.type === 'bullish') score += impact;
    else if (p.type === 'bearish') score -= impact;
  }
  return Math.min(100, Math.max(0, score));
}

function assessRisk(atr: number, price: number): { volatility: number; riskLevel: 'dusuk' | 'orta' | 'yuksek' } {
  const volatility = price > 0 ? (atr / price) * 100 : 0;
  // BIST için kalibre edilmiş eşikler (Türk piyasası ABD'den daha volatil)
  // BIST ortalama günlük volatilite ~%3-4
  return { volatility: Math.round(volatility * 100) / 100, riskLevel: volatility < 3 ? 'dusuk' : volatility < 5.5 ? 'orta' : 'yuksek' };
}

// ============ F) RAPOR ÜRETME ============

function generateReport(
  ind: TradingViewIndicators, signals: IndividualSignal[],
  scores: ScoreBreakdown, patterns: CandlestickPattern[],
  sentimentItems: NewsSentiment[], sentimentAvg: number,
  composite: number, signal: Signal, confidence: number,
  volatility: number, riskLevel: string,
): AnalysisReport {
  const price = ind.close;

  // Destek / Direnç
  const supports: number[] = [];
  const resistances: number[] = [];
  if (ind.bbLower > 0) supports.push(Math.round(ind.bbLower * 100) / 100);
  if (ind.ema50 < price) supports.push(Math.round(ind.ema50 * 100) / 100);
  if (ind.ema200 < price) supports.push(Math.round(ind.ema200 * 100) / 100);
  if (ind.psar > 0 && ind.psar < price) supports.push(Math.round(ind.psar * 100) / 100);
  if (ind.bbUpper > 0) resistances.push(Math.round(ind.bbUpper * 100) / 100);
  if (ind.ema50 > price) resistances.push(Math.round(ind.ema50 * 100) / 100);
  if (ind.ema200 > price) resistances.push(Math.round(ind.ema200 * 100) / 100);

  // Teknik yorum
  const bullSignals = signals.filter(s => s.signal > 0.2);
  const bearSignals = signals.filter(s => s.signal < -0.2);
  const technicalView = signals.filter(s => ['RSI Mean Reversion', 'MACD Momentum', 'Stochastic', 'CCI'].includes(s.name)).map(s => s.reasoning).join('. ') + '.';
  const trendView = signals.filter(s => ['EMA Trend', 'TV MA Trend', 'ADX Trend Gucu', 'Parabolic SAR'].includes(s.name)).map(s => s.reasoning).join('. ') + '.';
  const volumeView = signals.find(s => s.name === 'Hacim')?.reasoning || 'Hacim verisi yok.';
  const sentimentView = sentimentItems.length === 0
    ? 'Bu hisse ile ilgili guncel haber bulunamadi.'
    : `${sentimentItems.length} haber incelendi. Duygu skoru: ${sentimentAvg > 0.1 ? 'POZITIF' : sentimentAvg < -0.1 ? 'NEGATIF' : 'NOTR'} (${sentimentAvg.toFixed(2)}).`;
  const patternView = patterns.length === 0
    ? 'Son donemde belirgin mum formasyonu tespit edilmedi.'
    : patterns.map(p => `${p.name} (${p.type === 'bullish' ? 'yukselis' : p.type === 'bearish' ? 'dusus' : 'notr'})`).join(', ') + '.';

  // Özet ve aksiyon
  let summary = '';
  let actionPlan = '';

  // Formasyon uyarısı
  const bearPatterns = patterns.filter(p => p.type === 'bearish' && p.strength >= 2 && p.barIndex <= 2);
  const formasyonUyari = bearPatterns.length > 0
    ? ` DIKKAT: ${bearPatterns.map(p => p.name).join(', ')} formasyonu tespit edildi - geri cekilme riski var! Stop-loss mutlaka koyun.`
    : '';

  if (signal === 'GUCLU_AL') {
    summary = `${ind.symbol} GUCLU ALIS sinyali. ${bullSignals.length}/${signals.length} indikator yukselise isaret ediyor. Kompozit skor ${composite}/100, guven %${confidence}.`;
    actionPlan = `ALIS ONERISI: ${price.toFixed(2)} TL seviyesinden alis yapilabilir. Stop-loss: ${(supports[0] || price * 0.95).toFixed(2)} TL (-%${((1 - (supports[0] || price * 0.95) / price) * 100).toFixed(1)} risk). Hedef: ${(resistances[0] || price * 1.10).toFixed(2)} TL. Pozisyon: Portfoyun %5-8'i.${formasyonUyari}`;
  } else if (signal === 'AL') {
    summary = `${ind.symbol} alis sinyali veriyor. ${bullSignals.length} indikator yukselise, ${bearSignals.length} indikator dususe isaret ediyor. Skor: ${composite}/100.`;
    actionPlan = `KADEMELI ALIS: ${price.toFixed(2)} TL'den kademeli giris yapilabilir. Stop-loss: ${(supports[0] || price * 0.97).toFixed(2)} TL. Pozisyon: Portfoyun %3-5'i ile sinirli. ${ind.adx > 25 ? 'Trend gucu iyi, hareket devam edebilir.' : 'Trend zayif, kucuk pozisyonlarla baslayin.'}${formasyonUyari}`;
  } else if (signal === 'NOTR') {
    const leaning = composite > 50 ? 'yukselis' : composite < 50 ? 'dusus' : 'notr';
    summary = `${ind.symbol} notr bolgede, hafif ${leaning} egilimli. ${bullSignals.length} al vs ${bearSignals.length} sat sinyali. Skor: ${composite}/100.`;
    const bbSignal = signals.find(s => s.name === 'Bollinger Mean Rev.');
    const meanRevOpp = bbSignal && bbSignal.signal > 0.3;
    actionPlan = meanRevOpp
      ? `DIP ALIS FIRSATI: Fiyat Bollinger alt bandina yakin - ortalamaya donus (mean reversion) bekleniyor. Kucuk pozisyonla giris yapilabilir. Stop-loss: ${(ind.bbLower * 0.98).toFixed(2)} TL.`
      : `BEKLE: Belirgin bir sinyal yok. Mevcut pozisyon varsa tutun. Yeni giris icin RSI 30 altina dusus veya EMA kirilisini bekleyin. ${leaning === 'yukselis' ? 'Genel egilim olumlu.' : leaning === 'dusus' ? 'Dikkatli olun, egilim olumsuz.' : ''}`;
  } else if (signal === 'SAT') {
    summary = `${ind.symbol} satis sinyali. ${bearSignals.length}/${signals.length} indikator dususe isaret ediyor. Skor: ${composite}/100.`;
    actionPlan = `POZISYON AZALT: Mevcut pozisyonlarin %50-70'ini kademeli satin. ${price.toFixed(2)} TL alti kapanislar daha fazla dususe isaret eder. Destek: ${(supports[0] || price * 0.95).toFixed(2)} TL. Kalan pozisyon icin stop-loss koyun.`;
  } else {
    summary = `${ind.symbol} GUCLU SATIS sinyali! ${bearSignals.length}/${signals.length} indikator dususe isaret ediyor. Skor: ${composite}/100 - ACIL DIKKAT.`;
    actionPlan = `ACIL SATIS: Tum pozisyonlari kapatmaniz onerilir. Guclu dusus baskisi mevcut. ${ind.rsi < 30 ? 'RSI asiri satim bolgesinde ancak trend cok guclu asagi - dead cat bounce riski.' : 'Tum teknik gostergeler satisa isaret.'} Yeniden giris icin dip olusumunu bekleyin.`;
  }

  // Risk faktörleri
  const risks: string[] = [];
  if (volatility > 6) risks.push(`Cok yuksek volatilite (%${volatility}) - buyuk fiyat dalgalanmalari`);
  else if (volatility > 5) risks.push(`Yuksek volatilite (%${volatility})`);
  if (ind.adx < 20) risks.push('Zayif trend gucu - yatay piyasa, whipsaw riski');
  if (ind.relativeVolume < 0.5) risks.push('Cok dusuk hacim - likidite riski');
  if (ind.rsi > 75) risks.push('RSI asiri alim - duzeltme riski yuksek');
  if (ind.rsi < 25) risks.push('RSI asiri satim - dipten donus olabilir ama catch falling knife riski');
  if (price < ind.ema200) risks.push('Fiyat 200-gun EMA altinda - uzun vadeli dusus trendi');
  if (bearSignals.length > 7) risks.push('Cogunluk indikator satisa isaret ediyor');
  const bearishPatterns = patterns.filter(p => p.type === 'bearish');
  if (bearishPatterns.length > 0) risks.push(`Dusus formasyonu: ${bearishPatterns.map(p=>p.name).join(', ')}`);

  return {
    summary, technicalView, trendView, volumeView, sentimentView, patternView, actionPlan, risks,
    supports: [...new Set(supports)].sort((a, b) => b - a).slice(0, 3),
    resistances: [...new Set(resistances)].sort((a, b) => a - b).slice(0, 3),
  };
}

// ============ G) ANA FONKSİYON ============

export async function analyzeStock(symbol: string, options?: { skipNews?: boolean; skipCandles?: boolean }): Promise<AnalysisResult> {
  const indicators = await fetchIndicators(symbol);

  let candles: CandleData[] = [];
  if (!options?.skipCandles) {
    try { const { getChartData } = require('./tv-chart'); candles = await getChartData(symbol, 'D', 66); } catch {}
  }

  let newsItems: NewsItem[] = [];
  if (!options?.skipNews) {
    try { newsItems = await aggregateNews(symbol); } catch {}
  }

  const patterns = detectCandlestickPatterns(candles);
  const sentimentItems = analyzeSentiment(newsItems);
  const sentimentAvg = aggregateSentimentScore(sentimentItems);

  // Simons yaklaşımı: Bağımsız sinyaller üret
  const signals = generateSignals(indicators);

  // 12. Sinyal: Divergence tespiti (mum verisi gerekli)
  if (candles.length >= 20) {
    const div = detectDivergence(candles, indicators.rsi);
    if (div.signal !== 0) {
      signals.push({
        name: 'Divergence',
        value: 0,
        signal: div.signal,
        weight: 0.12, // BAGIMSIZ ve GUCLU sinyal - uzman onerisiyle agirlik artirildi
        reasoning: div.reasoning,
      });
    }
  }

  // 13. Sinyal: Multi-Timeframe (haftalık mum verisi ile)
  if (candles.length >= 30) {
    // Haftalık EMA yaklaşımı: son 20 günlük ortalama vs son 5 günlük ortalama
    const weekly5 = candles.slice(-5).reduce((s: number, c: CandleData) => s + c.close, 0) / 5;
    const weekly20 = candles.slice(-20).reduce((s: number, c: CandleData) => s + c.close, 0) / 20;
    const monthly = candles.slice(-30).reduce((s: number, c: CandleData) => s + c.close, 0) / Math.min(30, candles.length);

    let mtfSignal = 0;
    let mtfReason = '';

    if (weekly5 > weekly20 && weekly20 > monthly) {
      mtfSignal = 0.6;
      mtfReason = 'Multi-TF uyumlu yukselis: kisa > orta > uzun vade';
    } else if (weekly5 < weekly20 && weekly20 < monthly) {
      mtfSignal = -0.6;
      mtfReason = 'Multi-TF uyumlu dusus: kisa < orta < uzun vade';
    } else if (weekly5 > weekly20) {
      mtfSignal = 0.2;
      mtfReason = 'Kisa vade toparlanma ama uzun vade karisik';
    } else if (weekly5 < weekly20) {
      mtfSignal = -0.2;
      mtfReason = 'Kisa vade zayif ama uzun vade karisik';
    }

    signals.push({
      name: 'Multi-Timeframe',
      value: 0,
      signal: mtfSignal,
      weight: 0.12, // BAGIMSIZ - uzman onerisiyle agirlik artirildi
      reasoning: mtfReason || 'Timeframe analizi notr',
    });
  }

  // Kompozit skor hesapla
  const { composite: rawComposite, scores: rawScores } = calculateCompositeFromSignals(signals);

  // Sentiment ve formasyon skorlarını ekle
  const sentimentScore = calculateSentimentScore(sentimentAvg);
  const candlestickScore = candles.length > 0 ? calculateCandlestickScore(patterns) : 50;

  // Final kompozit: %75 teknik + %10 sentiment + %15 formasyon
  let compositeScore = Math.round(rawComposite * 0.75 + sentimentScore * 0.10 + candlestickScore * 0.15);

  // GÜVENLIK KONTROLÜ: Güçlü bearish formasyon + aşırı yükseliş = tehlike
  // Kayan Yıldız, Evening Star, Bearish Engulfing gibi formasyonlar
  // %5+ yükseliş sonrası gelirse skor düşürülmeli (tavan fişeği riski)
  const strongBearishPatterns = patterns.filter(p =>
    p.type === 'bearish' && p.strength >= 2 && p.barIndex <= 2
  );
  const strongBullishPatterns = patterns.filter(p =>
    p.type === 'bullish' && p.strength >= 2 && p.barIndex <= 2
  );

  if (strongBearishPatterns.length > 0 && indicators.changePercent > 5) {
    // Tavan sonrası bearish formasyon = ciddi uyarı, skoru agresif düşür
    compositeScore = Math.min(compositeScore, 55); // En fazla NÖTR
  } else if (strongBearishPatterns.length > 0 && indicators.changePercent > 2) {
    // Yükseliş sonrası bearish formasyon = hafif düşür
    compositeScore = Math.min(compositeScore, compositeScore - 5);
  }

  // Tersi: Güçlü bullish formasyon + düşüş = dip fırsatı
  if (strongBullishPatterns.length > 0 && indicators.changePercent < -5) {
    compositeScore = Math.max(compositeScore, 55); // En az NÖTR
  }

  // MAKRO FİLTRE: Endeks düşerken AL sinyali vermeyi durdur
  let macroState;
  try {
    macroState = await getMarketFilter();
    compositeScore += macroState.scoreAdjustment;
  } catch { macroState = null; }

  // Final clamp - skor asla 0'dan küçük veya 100'den büyük olamaz
  compositeScore = Math.max(0, Math.min(100, compositeScore));

  const scores: ScoreBreakdown = {
    ...rawScores,
    sentiment: sentimentScore,
    candlestick: candlestickScore,
  };

  const { signal, signalText } = determineSignal(compositeScore);
  let confidence = calculateConfidence(signals, compositeScore);

  // Makro filtre güveni de etkiler
  if (macroState) {
    if (macroState.marketMode === 'crash') confidence = Math.max(20, confidence - 20);
    else if (macroState.marketMode === 'panic') confidence = Math.max(20, confidence - 10);
    else if (macroState.marketMode === 'caution') confidence = Math.max(20, confidence - 5);
  }

  // Düşük hacim güveni düşürür
  if (indicators.relativeVolume < 0.5) confidence = Math.max(20, confidence - 15);
  else if (indicators.relativeVolume < 0.8) confidence = Math.max(20, confidence - 5);

  // Zayıf trend güveni düşürür
  if (indicators.adx < 15) confidence = Math.max(20, confidence - 10);

  const { volatility, riskLevel } = assessRisk(indicators.atr, indicators.close);
  const report = generateReport(indicators, signals, scores, patterns, sentimentItems, sentimentAvg, compositeScore, signal, confidence, volatility, riskLevel);

  return {
    symbol, name: indicators.name,
    price: indicators.close, change: indicators.change, changePercent: indicators.changePercent,
    timestamp: Date.now(),
    compositeScore, signal, signalText, confidence,
    scores, indicators, patterns, sentimentItems, sentimentAvg, volatility, riskLevel, report,
  };
}
