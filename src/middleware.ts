import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

// In-memory rate limiter (sunucu basina)
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;        // 60 istek
const RATE_WINDOW = 60_000;   // 1 dakika
const SCAN_LIMIT = 3;         // Scan icin 3 istek/dakika
const SCAN_WINDOW = 60_000;

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function checkRateLimit(key: string, limit: number, window: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + window });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// Eski kayitlari temizle (memory leak onleme)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateMap) {
    if (now > entry.resetAt) rateMap.delete(key);
  }
}, 60_000);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
  const publicPaths = ['/login', '/register', '/api/auth'];
  if (publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Health check - rate limit yok
  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  // API rate limiting
  if (pathname.startsWith('/api/')) {
    const ip = getClientIP(request);

    // Scan endpoint ozel rate limit
    if (pathname.includes('/analysis/scan')) {
      if (!checkRateLimit(`scan:${ip}`, SCAN_LIMIT, SCAN_WINDOW)) {
        return NextResponse.json(
          { error: 'Tarama icin cok fazla istek. 1 dakika bekleyin.' },
          { status: 429 }
        );
      }
    }

    // Genel API rate limit
    if (!checkRateLimit(`api:${ip}`, RATE_LIMIT, RATE_WINDOW)) {
      return NextResponse.json(
        { error: 'Cok fazla istek. Lutfen bekleyin.' },
        { status: 429 }
      );
    }

    // API routes - scan ve analysis herkese acik
    if (!pathname.startsWith('/api/user/')) {
      return NextResponse.next();
    }
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
