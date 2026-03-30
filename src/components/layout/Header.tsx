'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import NewsTickerBar from '@/components/news/NewsTickerBar';

export default function Header() {
  const [time, setTime] = useState('');
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (pathname === '/login' || pathname === '/register') return null;

  return (
    <header style={{
      height: '48px',
      backgroundColor: 'var(--bg-header)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      marginLeft: isMobile ? '0' : '72px',
      paddingLeft: isMobile ? '52px' : '0',
      position: 'fixed',
      top: 0, right: 0, left: 0, zIndex: 40,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '0 12px', height: '100%', borderRight: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--green)', boxShadow: '0 0 6px rgba(0,216,151,0.5)', animation: 'pulse-glow 2s ease-in-out infinite' }} />
        <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--green)', letterSpacing: '0.8px' }}>BIST</span>
      </div>

      {!isMobile && <NewsTickerBar />}

      <div style={{
        display: 'flex', alignItems: 'center', padding: '0 12px',
        height: '100%', borderLeft: '1px solid var(--border)', flexShrink: 0, marginLeft: isMobile ? 'auto' : '0',
      }}>
        <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums', fontFamily: '"Inter", monospace' }}>{time}</span>
      </div>

      <style>{`@keyframes pulse-glow { 0%,100%{opacity:1;box-shadow:0 0 6px rgba(0,216,151,0.5)} 50%{opacity:0.5;box-shadow:0 0 2px rgba(0,216,151,0.2)} }`}</style>
    </header>
  );
}
