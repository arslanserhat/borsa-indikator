'use client';

import { useEffect, useRef, memo } from 'react';

interface Props {
  symbol: string;
  height?: number;
}

function TradingViewWidget({ symbol, height = 500 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Onceki widget'i temizle
    containerRef.current.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = `${height}px`;
    widgetDiv.style.width = '100%';
    containerRef.current.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `BIST:${symbol}`,
      interval: 'D',
      timezone: 'Europe/Istanbul',
      theme: 'dark',
      style: '1', // Candlestick
      locale: 'tr',
      backgroundColor: 'rgba(10, 10, 15, 1)',
      gridColor: 'rgba(42, 42, 62, 0.3)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      studies: [
        'STD;SMA',           // SMA
        'STD;RSI',           // RSI
        'STD;MACD',          // MACD
        'STD;Bollinger_Bands', // Bollinger Bands
      ],
      withdateranges: true,
      details: true,
      hotlist: false,
      show_popup_button: true,
      popup_width: '1000',
      popup_height: '650',
    });

    containerRef.current.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, height]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height: `${height}px`, width: '100%' }}
    />
  );
}

export default memo(TradingViewWidget);
