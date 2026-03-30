export interface TradingViewIndicators {
  symbol: string;
  name: string;
  close: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  open: number;
  prevClose: number;
  bid: number;
  ask: number;
  marketCap: number;
  pe: number;
  // Recommendations
  recommendAll: number;
  recommendOther: number;
  recommendMA: number;
  // Momentum
  rsi: number;
  macdValue: number;
  macdSignal: number;
  macdHist: number;
  stochK: number;
  stochD: number;
  cci20: number;
  williamsR: number;
  // Trend
  adx: number;
  psar: number;
  ema10: number;
  ema20: number;
  ema50: number;
  ema200: number;
  sma10: number;
  sma20: number;
  sma50: number;
  sma200: number;
  // Volatility
  bbUpper: number;
  bbLower: number;
  atr: number;
  // Volume
  relativeVolume: number;
  // Pivots
  pivotS3: number;
  pivotS2: number;
  pivotS1: number;
  pivotMiddle: number;
  pivotR1: number;
  pivotR2: number;
  pivotR3: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlestickPattern {
  name: string;
  nameEN: string;
  type: 'bullish' | 'bearish' | 'neutral';
  strength: 1 | 2 | 3;
  barIndex: number;
  description: string;
}

export interface NewsSentiment {
  newsId: string;
  title: string;
  score: number; // -1 to +1
  source: 'kap' | 'bloomberg';
  publishedAt: string;
  keywords: string[];
}

export interface ScoreBreakdown {
  technical: number; // 0-100
  trend: number;
  volume: number;
  sentiment: number;
  candlestick: number;
}

export type Signal = 'GUCLU_AL' | 'AL' | 'NOTR' | 'SAT' | 'GUCLU_SAT';

export interface AnalysisResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;

  compositeScore: number;
  signal: Signal;
  signalText: string;
  confidence: number;

  scores: ScoreBreakdown;
  indicators: TradingViewIndicators;
  patterns: CandlestickPattern[];
  sentimentItems: NewsSentiment[];
  sentimentAvg: number;

  volatility: number;
  riskLevel: 'dusuk' | 'orta' | 'yuksek';

  // Detaylı analiz raporu
  report: AnalysisReport;
}

export interface AnalysisReport {
  summary: string;           // 2-3 cümlelik özet
  technicalView: string;     // Teknik analiz yorumu
  trendView: string;         // Trend analizi
  volumeView: string;        // Hacim analizi
  sentimentView: string;     // Haber duygu yorumu
  patternView: string;       // Mum formasyonu yorumu
  actionPlan: string;        // Ne yapmalı (AL/SAT detayı)
  risks: string[];           // Risk faktörleri
  supports: number[];        // Destek seviyeleri
  resistances: number[];     // Direnç seviyeleri
}
