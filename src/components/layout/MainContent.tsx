'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (pathname === '/login' || pathname === '/register') return <>{children}</>;

  return (
    <main style={{
      marginLeft: isMobile ? '0' : '72px',
      marginTop: '48px',
      padding: isMobile ? '12px' : '20px 24px',
      minHeight: 'calc(100vh - 48px)',
    }}>
      {children}
    </main>
  );
}
