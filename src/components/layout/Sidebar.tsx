'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';

const menuItems = [
  { href: '/', label: 'Dashboard', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )},
  { href: '/market', label: 'Piyasa', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )},
  { href: '/watchlist', label: 'Takip', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )},
  { href: '/portfolio', label: 'Portfoy', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  )},
  { href: '/analiz', label: 'Analiz', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 2v10l6.93 4" />
    </svg>
  )},
  { href: '/haberler', label: 'Haberler', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
    </svg>
  )},
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Hook'lar ÖNCE - React kuralı: hook'lar koşullu return'den önce olmalı
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Koşullu return SONRA
  if (pathname === '/login' || pathname === '/register') return null;

  return (
    <>
      {/* Mobil hamburger butonu */}
      {isMobile && (
        <button onClick={() => setMobileOpen(!mobileOpen)} style={{
          position: 'fixed', top: '10px', left: '10px', zIndex: 60,
          width: '36px', height: '36px', borderRadius: '8px',
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-primary)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileOpen ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
          </svg>
        </button>
      )}

      {/* Overlay */}
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 49,
        }} />
      )}

      {/* Sidebar */}
      <aside style={{
        width: isMobile ? '200px' : '72px',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMobile ? 'flex-start' : 'center',
        paddingTop: '16px',
        position: 'fixed',
        left: isMobile ? (mobileOpen ? '0' : '-220px') : '0',
        top: 0,
        zIndex: 50,
        transition: 'left 0.2s ease',
      }}>
        {/* Logo */}
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #f7931a, #ff6b35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '28px', fontWeight: '800', fontSize: '16px', color: '#fff',
          marginLeft: isMobile ? '16px' : '16px',
        }}>BT</div>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', padding: '0 10px' }}>
          {menuItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} title={item.label} style={{
                display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '0',
                justifyContent: isMobile ? 'flex-start' : 'center',
                width: isMobile ? 'auto' : '52px', height: '44px', borderRadius: '10px',
                color: isActive ? '#f7931a' : 'var(--text-muted)',
                backgroundColor: isActive ? 'var(--accent-bg)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.2s ease', position: 'relative',
                paddingLeft: isMobile ? '14px' : '0',
              }}>
                {item.icon}
                {isMobile && <span style={{ fontSize: '13px', fontWeight: '500' }}>{item.label}</span>}
                {isActive && !isMobile && (
                  <span style={{ position: 'absolute', left: '-10px', width: '3px', height: '20px', backgroundColor: '#f7931a', borderRadius: '0 3px 3px 0' }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ marginTop: 'auto', paddingBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--green)', boxShadow: '0 0 8px rgba(0,216,151,0.4)' }} />
          <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>ACIK</span>
          {session?.user && (
            <>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                backgroundColor: 'var(--accent-bg)', border: '1px solid rgba(247,147,26,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '700', color: 'var(--accent)', marginTop: '8px',
              }}>{(session.user.name || 'U')[0].toUpperCase()}</div>
              <button onClick={() => signOut({ callbackUrl: '/login' })} title="Cikis Yap" style={{
                backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                padding: '4px', color: 'var(--text-muted)', transition: 'color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
