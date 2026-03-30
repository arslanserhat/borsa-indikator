import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import SessionWrapper from '@/components/layout/SessionWrapper';
import MainContent from '@/components/layout/MainContent';

export const metadata: Metadata = {
  title: 'BIST Borsa Takip - Anlık Piyasa Verileri',
  description: 'Borsa İstanbul anlık hisse takip platformu',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SessionWrapper>
          <Sidebar />
          <Header />
          <MainContent>{children}</MainContent>
        </SessionWrapper>
      </body>
    </html>
  );
}
