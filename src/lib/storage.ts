// Client-side localStorage based storage (no DB needed for MVP)

const WATCHLIST_KEY = 'borsa_watchlist';
const PORTFOLIO_KEY = 'borsa_portfolio';
const ALERTS_KEY = 'borsa_alerts';

// Watchlist
export function getWatchlist(): string[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(WATCHLIST_KEY);
  return data ? JSON.parse(data) : [];
}

export function addToWatchlist(symbol: string): string[] {
  const list = getWatchlist();
  if (!list.includes(symbol)) {
    list.push(symbol);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  }
  return list;
}

export function removeFromWatchlist(symbol: string): string[] {
  const list = getWatchlist().filter(s => s !== symbol);
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  return list;
}

// Portfolio
export interface PortfolioEntry {
  symbol: string;
  quantity: number;
  avgCost: number;
  addedAt: string;
}

export function getPortfolio(): PortfolioEntry[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(PORTFOLIO_KEY);
  return data ? JSON.parse(data) : [];
}

export function addToPortfolio(entry: Omit<PortfolioEntry, 'addedAt'>): PortfolioEntry[] {
  const list = getPortfolio();
  const existing = list.find(p => p.symbol === entry.symbol);
  if (existing) {
    const totalQty = existing.quantity + entry.quantity;
    existing.avgCost = ((existing.avgCost * existing.quantity) + (entry.avgCost * entry.quantity)) / totalQty;
    existing.quantity = totalQty;
  } else {
    list.push({ ...entry, addedAt: new Date().toISOString() });
  }
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(list));
  return list;
}

export function updatePortfolioQuantity(symbol: string, addQty: number, addCost: number): PortfolioEntry[] {
  const list = getPortfolio();
  const existing = list.find(p => p.symbol === symbol);
  if (existing) {
    const totalQty = existing.quantity + addQty;
    if (totalQty <= 0) {
      // Tamamı satıldı - portföyden kaldır
      const filtered = list.filter(p => p.symbol !== symbol);
      localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(filtered));
      return filtered;
    }
    if (addQty > 0) {
      // Ekleme - ortalama maliyet hesapla
      existing.avgCost = ((existing.avgCost * existing.quantity) + (addCost * addQty)) / totalQty;
    }
    // Satışta ortalama maliyet değişmez
    existing.quantity = totalQty;
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(list));
    return list;
  }
  return list;
}

export function removeFromPortfolio(symbol: string): PortfolioEntry[] {
  const list = getPortfolio().filter(p => p.symbol !== symbol);
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(list));
  return list;
}

// Alerts
export interface AlertEntry {
  id: string;
  symbol: string;
  targetPrice: number;
  direction: 'above' | 'below';
  active: boolean;
  createdAt: string;
  triggeredAt?: string;
}

export function getAlerts(): AlertEntry[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(ALERTS_KEY);
  return data ? JSON.parse(data) : [];
}

export function addAlert(alert: Omit<AlertEntry, 'id' | 'active' | 'createdAt'>): AlertEntry[] {
  const list = getAlerts();
  list.push({
    ...alert,
    id: Date.now().toString(36),
    active: true,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(ALERTS_KEY, JSON.stringify(list));
  return list;
}

export function removeAlert(id: string): AlertEntry[] {
  const list = getAlerts().filter(a => a.id !== id);
  localStorage.setItem(ALERTS_KEY, JSON.stringify(list));
  return list;
}

export function triggerAlert(id: string): AlertEntry[] {
  const list = getAlerts();
  const alert = list.find(a => a.id === id);
  if (alert) {
    alert.active = false;
    alert.triggeredAt = new Date().toISOString();
  }
  localStorage.setItem(ALERTS_KEY, JSON.stringify(list));
  return list;
}
