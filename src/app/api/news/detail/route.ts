import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const cache = new Map<string, { content: string; time: number }>();
const CACHE_TTL = 300_000; // 5 dakika

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url') || '';
  const source = searchParams.get('source') || '';

  if (!url) {
    return NextResponse.json({ content: '', error: 'URL gerekli' }, { status: 400 });
  }

  // Cache kontrol
  const cached = cache.get(url);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return NextResponse.json({ content: cached.content, cached: true });
  }

  try {
    let content = '';

    if (source === 'kap') {
      content = await fetchKAPContent(url);
    } else if (source === 'bloomberg') {
      content = await fetchBloombergContent(url);
    }

    // HTML entity'leri temizle
    content = content
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&nbsp;/g, ' ');

    if (content) {
      // Cache yönetimi
      if (cache.size > 50) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].time - b[1].time)[0];
        if (oldest) cache.delete(oldest[0]);
      }
      cache.set(url, { content, time: Date.now() });
    }

    return NextResponse.json({ content, cached: false });
  } catch (error) {
    console.error('News detail fetch error:', error);
    return NextResponse.json({ content: '', error: 'Icerik yuklenemedi' });
  }
}

async function fetchKAPContent(url: string): Promise<string> {
  try {
    // KAP bildirim sayfasını HTML olarak çek
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) return '';
    const html = await res.text();

    // RSC data'dan bildirim içeriğini çıkar
    // KAP bildirimleri genelde tablo formatında
    // "disclosureBasic" objesinden veri çek
    const basicMatch = html.match(/"disclosureBasic":\{[^}]+\}/);
    const detailMatch = html.match(/"disclosureDetail":\{[^}]+\}/);

    let content = '';

    // Bildirim index'inden detay API'yi dene
    const indexMatch = url.match(/Bildirim\/(\d+)/);
    if (indexMatch) {
      // KAP notification API
      const notifRes = await fetch(`https://www.kap.org.tr/tr/api/notification/${indexMatch[1]}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json',
          'Referer': 'https://www.kap.org.tr/tr',
        },
      });

      if (notifRes.ok) {
        const notifText = await notifRes.text();
        if (notifText && notifText.startsWith('{')) {
          try {
            const data = JSON.parse(notifText);
            if (data.content || data.htmlContent || data.text) {
              return data.content || data.htmlContent || data.text;
            }
          } catch {}
        }
      }

      // Alternatif: disclosure detail endpoint
      const detailRes = await fetch(`https://www.kap.org.tr/tr/api/disclosure/detail/${indexMatch[1]}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json',
          'Referer': 'https://www.kap.org.tr/tr',
        },
      });

      if (detailRes.ok) {
        const detailText = await detailRes.text();
        if (detailText && !detailText.includes('<!DOCTYPE')) {
          try {
            const data = JSON.parse(detailText);
            return JSON.stringify(data, null, 2);
          } catch {
            return detailText;
          }
        }
      }

      // Son çare: HTML'den metin çıkar
      // Script ve style etiketlerini temizle
      let cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // RSC verilerinden bildirim detayını çıkar
      const rscContentMatch = html.match(/"summary":"([^"]*)"/);
      const rscTitleMatch = html.match(/"title":"([^"]*)"/);
      const rscCompanyMatch = html.match(/"companyTitle":"([^"]*)"/);
      const rscStockMatch = html.match(/"stockCode":"([^"]*)"/);
      const rscDateMatch = html.match(/"publishDate":"([^"]*)"/);

      if (rscTitleMatch || rscCompanyMatch) {
        const parts = [];
        if (rscCompanyMatch) parts.push(`Sirket: ${rscCompanyMatch[1]}`);
        if (rscStockMatch && rscStockMatch[1]) parts.push(`Hisse Kodu: ${rscStockMatch[1]}`);
        if (rscTitleMatch) parts.push(`Bildirim: ${rscTitleMatch[1]}`);
        if (rscDateMatch) parts.push(`Tarih: ${rscDateMatch[1]}`);
        if (rscContentMatch && rscContentMatch[1]) parts.push(`\n${rscContentMatch[1]}`);
        content = parts.join('\n');
      }
    }

    return content;
  } catch (error) {
    console.error('KAP content fetch error:', error);
    return '';
  }
}

async function fetchBloombergContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) return '';
    const html = await res.text();

    // Bloomberg HT makale içeriğini çıkar
    // article body genelde <div class="newsDetailText"> veya <article> içinde
    let content = '';

    // Method 1: newsDetailText div
    const detailMatch = html.match(/<div[^>]*class="[^"]*newsDetail[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (detailMatch) {
      content = detailMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    // Method 2: article tag
    if (!content) {
      const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      if (articleMatch) {
        content = articleMatch[1]
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }
    }

    // Method 3: ld+json structured data
    if (!content) {
      const ldMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
      if (ldMatch) {
        try {
          const ld = JSON.parse(ldMatch[1]);
          content = ld.articleBody || ld.description || '';
        } catch {}
      }
    }

    // Method 4: meta description
    if (!content) {
      const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
      if (descMatch) {
        content = descMatch[1];
      }
    }

    return content;
  } catch (error) {
    console.error('Bloomberg content fetch error:', error);
    return '';
  }
}
