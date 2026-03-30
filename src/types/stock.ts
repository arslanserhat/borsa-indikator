export interface Stock {
  kod: string;
  ad: string;
  fiyat: number;
  degisim: number;
  degisimYuzde: number;
  hacim: number;
  dusuk: number;
  yuksek: number;
  oncekiKapanis: number;
  alis: number;
  satis: number;
  zaman?: string;
}

export interface MarketSummaryItem {
  name: string;
  value: string;
  change: string;
  changePercent: string;
  isUp: boolean;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  addedAt: string;
}

export interface PortfolioItem {
  id: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  addedAt: string;
}

export interface Alert {
  id: string;
  symbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
  active: boolean;
  createdAt: string;
  triggeredAt?: string;
}
