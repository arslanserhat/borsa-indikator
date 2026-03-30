'use client';

import { useEffect, useRef, memo } from 'react';

interface Props {
  symbol: string;
  height?: number;
}

function TradingViewWidget({ symbol, height = 500 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Tamamen temizle
    containerRef.current.innerHTML = '';

    // TradingView widget container
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    const widgetDiv = document.createElement('div');
    widgetDiv.id = `tradingview_${symbol}_${Date.now()}`;
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    widgetContainer.appendChild(widgetDiv);

    containerRef.current.appendChild(widgetContainer);

    // TradingView Widget Script
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (typeof (window as any).TradingView !== 'undefined') {
        new (window as any).TradingView.widget({
          container_id: widgetDiv.id,
          autosize: true,
          symbol: `BIST:${symbol}`,
          interval: 'D',
          timezone: 'Europe/Istanbul',
          theme: 'dark',
          style: '1',
          locale: 'tr',
          toolbar_bg: '#0a0a0f',
          enable_publishing: false,
          allow_symbol_change: true,
          save_image: true,
          hide_volume: false,
          studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies',
            'MACD@tv-basicstudies',
            'BB@tv-basicstudies',
          ],
          show_popup_button: true,
          popup_width: '1000',
          popup_height: '650',
          withdateranges: true,
          details: true,
          calendar: false,
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      // Script temizligi
      try { document.head.removeChild(script); } catch {}
    };
  }, [symbol, height]);

  return (
    <div
      ref={containerRef}
      style={{
        height: `${height}px`,
        width: '100%',
        backgroundColor: '#0a0a0f',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    />
  );
}

export default memo(TradingViewWidget);
