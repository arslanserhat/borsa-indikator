export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: 'kap' | 'bloomberg' | 'bigpara';
  category: 'haber' | 'bildirim' | 'analiz';
  publishedAt: string;
  relatedSymbols: string[];
  imageUrl?: string;
}

export interface NewsResponse {
  data: NewsItem[];
  total: number;
  timestamp: string;
  cached: boolean;
}

export interface TickerItem {
  title: string;
  symbol?: string;
  url: string;
  isKAP: boolean;
}
