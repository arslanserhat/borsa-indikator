import { Stock } from '@/types/stock';

const BASE_URL = 'https://bigpara.hurriyet.com.tr/api/v1';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Referer': 'https://bigpara.hurriyet.com.tr/',
};

// Tüm hisse kodlarını çek
export async function fetchStockList(): Promise<{ kod: string; ad: string }[]> {
  try {
    const res = await fetch(`${BASE_URL}/hisse/list`, {
      next: { revalidate: 0 },
      headers: HEADERS,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    return (data?.data || []).map((item: any) => ({
      kod: item.kod || '',
      ad: item.ad || '',
    }));
  } catch (error) {
    console.error('Hisse listesi hata:', error);
    return [];
  }
}

// Tek hisse detayını çek (BigPara hisseyuzeysel endpoint)
export async function fetchStockDetail(symbol: string): Promise<Stock | null> {
  try {
    const res = await fetch(`${BASE_URL}/borsa/hisseyuzeysel/${symbol}`, {
      next: { revalidate: 0 },
      headers: HEADERS,
    });
    if (!res.ok) return null;

    const data = await res.json();
    const item = data?.data?.hisseYuzeysel;
    if (!item) return null;

    const kapanis = item.kapanis || 0;
    const onceki = item.oncekikapanis || item.dunkukapanis || 0;
    const degisim = onceki > 0 ? kapanis - onceki : 0;
    const degisimYuzde = item.yuzdedegisim || (onceki > 0 ? ((kapanis - onceki) / onceki) * 100 : 0);

    return {
      kod: item.sembol || symbol,
      ad: item.aciklama || '',
      fiyat: kapanis,
      degisim: degisim,
      degisimYuzde: degisimYuzde,
      hacim: item.hacimlot || 0,
      dusuk: item.dusuk || 0,
      yuksek: item.yuksek || 0,
      oncekiKapanis: onceki,
      alis: item.alis || 0,
      satis: item.satis || 0,
      zaman: item.tarih || '',
    };
  } catch (error) {
    return null;
  }
}

// Birden fazla hisseyi paralel çek (batch)
export async function fetchMultipleStocks(symbols: string[]): Promise<Stock[]> {
  const BATCH_SIZE = 20;
  const results: Stock[] = [];

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const promises = batch.map(s => fetchStockDetail(s));
    const batchResults = await Promise.all(promises);
    for (const stock of batchResults) {
      if (stock) results.push(stock);
    }
  }

  return results;
}

// TCMB döviz verilerini çek
export async function fetchCurrencyFromTCMB(): Promise<{ name: string; code: string; buying: number; selling: number }[]> {
  try {
    const res = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`TCMB error: ${res.status}`);

    const text = await res.text();
    const currencies: { name: string; code: string; buying: number; selling: number }[] = [];

    // Parse XML manually for key currencies
    const targets = ['USD', 'EUR', 'GBP', 'CHF', 'JPY'];
    for (const code of targets) {
      const regex = new RegExp(
        `<Currency[^>]*Kod="${code}"[^>]*>.*?<Isim>(.*?)</Isim>.*?<ForexBuying>(.*?)</ForexBuying>.*?<ForexSelling>(.*?)</ForexSelling>`,
        's'
      );
      const match = text.match(regex);
      if (match) {
        currencies.push({
          code,
          name: match[1].trim(),
          buying: parseFloat(match[2]),
          selling: parseFloat(match[3]),
        });
      }
    }

    return currencies;
  } catch (error) {
    console.error('TCMB hata:', error);
    return [];
  }
}
