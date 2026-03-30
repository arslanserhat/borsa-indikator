import { NewsItem } from '@/types/news';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};

// ============ KAP BİLDİRİMLERİ (Birincil Kaynak) ============

export async function fetchKAPDisclosures(symbol?: string): Promise<NewsItem[]> {
  try {
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - 7); // Son 7 gün

    const formatDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

    const res = await fetch('https://www.kap.org.tr/tr/api/disclosure/list/main', {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/json',
        'Referer': 'https://www.kap.org.tr/tr',
      },
      body: JSON.stringify({
        fromDate: formatDate(fromDate),
        toDate: formatDate(today),
        disclosureTypes: [],
        memberTypes: [],
        mkkMemberOid: '',
      }),
      next: { revalidate: 0 },
    });

    if (!res.ok) return [];
    const data = await res.json();

    if (!Array.isArray(data)) return [];

    let items: NewsItem[] = data
      .filter((item: any) => item?.disclosureBasic)
      .map((item: any) => {
        const d = item.disclosureBasic;
        const stockCodes = d.stockCode
          ? d.stockCode.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];

        return {
          id: `kap-${d.disclosureIndex}`,
          title: d.title || '',
          summary: d.summary || d.companyTitle || '',
          url: `https://www.kap.org.tr/tr/Bildirim/${d.disclosureIndex}`,
          source: 'kap' as const,
          category: 'bildirim' as const,
          publishedAt: parseKAPDate(d.publishDate),
          relatedSymbols: stockCodes,
          companyTitle: d.companyTitle || '',
        };
      });

    // Sembol filtresi
    if (symbol) {
      const sym = symbol.toUpperCase();
      items = items.filter(
        (item) =>
          item.relatedSymbols.some((s) => s.toUpperCase() === sym) ||
          item.summary.toUpperCase().includes(sym)
      );
    }

    return items;
  } catch (error) {
    console.error('KAP hata:', error);
    return [];
  }
}

function parseKAPDate(dateStr: string): string {
  try {
    // Format: "28.03.2026 20:34:54"
    const parts = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s(\d{2}):(\d{2}):(\d{2})/);
    if (parts) {
      return new Date(
        parseInt(parts[3]),
        parseInt(parts[2]) - 1,
        parseInt(parts[1]),
        parseInt(parts[4]),
        parseInt(parts[5]),
        parseInt(parts[6])
      ).toISOString();
    }
  } catch {}
  return new Date().toISOString();
}

// ============ BLOOMBERG HT RSS (İkincil Kaynak) ============

export async function fetchBloombergNews(): Promise<NewsItem[]> {
  try {
    const res = await fetch('https://www.bloomberght.com/rss', {
      headers: {
        ...HEADERS,
        'Accept': '*/*',
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseBloombergRSS(xml);
  } catch (error) {
    console.error('Bloomberg HT RSS hata:', error);
    return [];
  }
}

function parseBloombergRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1];
    const title = extractCDATA(content, 'title');
    const description = extractCDATA(content, 'description');
    const pubDate = extractCDATA(content, 'pubDate');
    const link = extractCDATA(content, 'link');
    const image = extractCDATA(content, 'image');
    const guid = extractCDATA(content, 'guid');

    if (title) {
      const symbols = extractSymbolsFromText(title + ' ' + description);
      // URL'den basit ID oluştur (son path segment + numara)
      const urlId = (link || guid || '').replace(/.*\//, '').replace(/[^a-zA-Z0-9-]/g, '') || String(items.length);

      items.push({
        id: `bht-${urlId}`,
        title: title.trim(),
        summary: description ? description.trim().slice(0, 250) : '',
        url: link || '',
        source: 'bloomberg',
        category: detectCategory(title, description),
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        relatedSymbols: symbols,
        imageUrl: image || undefined,
      });
    }
  }

  return items;
}

function extractCDATA(content: string, tag: string): string {
  const regex = new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tag}>`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

// ============ YARDIMCI FONKSİYONLAR ============

const COMPANY_MAP: Record<string, string> = {
  'Garanti': 'GARAN', 'Akbank': 'AKBNK', 'İş Bankası': 'ISCTR',
  'Yapı Kredi': 'YKBNK', 'Halkbank': 'HALKB', 'Vakıfbank': 'VAKBN',
  'THY': 'THYAO', 'Türk Hava Yolları': 'THYAO', 'Turkcell': 'TCELL',
  'Tüpraş': 'TUPRS', 'Ereğli': 'EREGL', 'Ford Otosan': 'FROTO',
  'Tofaş': 'TOASO', 'Koç Holding': 'KCHOL', 'Sabancı': 'SAHOL',
  'BİM': 'BIMAS', 'Aselsan': 'ASELS', 'Şişecam': 'SISE',
  'Pegasus': 'PGSUS', 'Migros': 'MGROS', 'Arçelik': 'ARCLK',
  'Vestel': 'VESTL', 'Petkim': 'PETKM', 'TAV': 'TAVHL',
  'Enerjisa': 'ENJSA', 'Kordsa': 'KORDS', 'Enka': 'ENKAI',
};

function extractSymbolsFromText(text: string): string[] {
  const symbols: string[] = [];
  for (const [name, sym] of Object.entries(COMPANY_MAP)) {
    if (text.includes(name) && !symbols.includes(sym)) {
      symbols.push(sym);
    }
  }
  // Direkt sembol eşleştirme (büyük harfli 3-5 karakter)
  const symbolPattern = /\b([A-Z]{3,5})\b/g;
  let m;
  while ((m = symbolPattern.exec(text)) !== null) {
    const s = m[1];
    if (KNOWN_SYMBOLS.has(s) && !symbols.includes(s)) {
      symbols.push(s);
    }
  }
  return symbols;
}

const KNOWN_SYMBOLS = new Set([
  'THYAO', 'GARAN', 'AKBNK', 'SISE', 'EREGL', 'BIMAS', 'ASELS', 'KCHOL',
  'SAHOL', 'TUPRS', 'TOASO', 'FROTO', 'HEKTS', 'SASA', 'PETKM', 'TCELL',
  'YKBNK', 'ISCTR', 'VAKBN', 'HALKB', 'KOZAL', 'KOZAA', 'VESTL', 'ARCLK',
  'TAVHL', 'DOHOL', 'PGSUS', 'EKGYO', 'ENKAI', 'TTKOM', 'MGROS', 'SOKM',
  'AEFES', 'GUBRF', 'OYAKC', 'TSKB', 'TKFEN', 'ULKER', 'CIMSA', 'ISGYO',
  'ENJSA', 'KORDS', 'LOGO', 'ALBRK', 'GOKNR', 'KLKIM', 'MARBL',
]);

function detectCategory(title: string, description: string): 'haber' | 'bildirim' | 'analiz' {
  const text = (title + ' ' + description).toLowerCase();
  if (text.includes('analiz') || text.includes('beklenti') || text.includes('tahmin') || text.includes('hedef fiyat')) {
    return 'analiz';
  }
  if (text.includes('bildirim') || text.includes('kap') || text.includes('açıklama')) {
    return 'bildirim';
  }
  return 'haber';
}

// ============ ANA FONKSİYON - TÜM KAYNAKLARI BİRLEŞTİR ============

export async function aggregateNews(symbol?: string): Promise<NewsItem[]> {
  const [kap, bloomberg] = await Promise.all([
    fetchKAPDisclosures(symbol),
    fetchBloombergNews(),
  ]);

  let allNews: NewsItem[];

  if (symbol) {
    // Sembol filtreli Bloomberg
    const sym = symbol.toUpperCase();
    const filteredBloomberg = bloomberg.filter(
      (item) =>
        item.relatedSymbols.includes(sym) ||
        item.title.toUpperCase().includes(sym) ||
        item.summary.toUpperCase().includes(sym)
    );
    allNews = [...kap, ...filteredBloomberg];
  } else {
    allNews = [...kap, ...bloomberg];
  }

  // Tarihe göre sırala (en yeni önce)
  allNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // Başlık bazlı dedup
  const seen = new Set<string>();
  return allNews.filter((item) => {
    const key = item.title.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============ KAP KURUMSAL EYLEMLER (Corporate Actions) ============

export async function fetchKAPCorporateActions(): Promise<any[]> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const res = await fetch(`https://www.kap.org.tr/tr/api/ca/allCa/${year}/${month}`, {
      headers: {
        ...HEADERS,
        'Referer': 'https://www.kap.org.tr/tr',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error('KAP CA hata:', error);
    return [];
  }
}
