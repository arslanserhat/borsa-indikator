/**
 * SEKTÖR ANALİZİ
 *
 * BIST sektör endekslerini takip et.
 * Güçlü sektördeki hisselere bonus puan.
 * Sektör rotasyonu tespiti.
 */

// BIST sektör endeksleri
export const SECTOR_INDICES: Record<string, { index: string; name: string }> = {
  Banka: { index: 'XBANK', name: 'Banka' },
  Sanayi: { index: 'XUSIN', name: 'Sanayi' },
  Hizmet: { index: 'XUHIZ', name: 'Hizmet' },
  Teknoloji: { index: 'XUTEK', name: 'Teknoloji' },
  'Demir/Celik': { index: 'XMANA', name: 'Metal Ana' },
  Otomotiv: { index: 'XMESY', name: 'Metal Esya' },
  Enerji: { index: 'XKMYA', name: 'Kimya' },
  Perakende: { index: 'XTCRT', name: 'Ticaret' },
  GYO: { index: 'XGMYO', name: 'GYO' },
  Holding: { index: 'XHOLD', name: 'Holding' },
};

// Hisse -> sektör eşlemesi
export const STOCK_SECTORS: Record<string, string> = {
  // Bankalar
  GARAN: 'Banka', AKBNK: 'Banka', ISCTR: 'Banka', YKBNK: 'Banka',
  VAKBN: 'Banka', HALKB: 'Banka', TSKB: 'Banka', ALBRK: 'Banka',
  // Sanayi
  EREGL: 'Demir/Celik', KRDMD: 'Demir/Celik',
  ASELS: 'Savunma', TOASO: 'Otomotiv', FROTO: 'Otomotiv',
  ARCLK: 'Beyaz Esya', VESTL: 'Beyaz Esya',
  // Enerji/Kimya
  TUPRS: 'Enerji', PETKM: 'Enerji', AKSEN: 'Enerji', SASA: 'Kimya', GUBRF: 'Kimya',
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
  // Diğer
  SISE: 'Cam', TKFEN: 'Insaat', ENKAI: 'Insaat', KOZAL: 'Madencilik',
};

export function getStockSector(symbol: string): string {
  return STOCK_SECTORS[symbol] || 'Diger';
}
