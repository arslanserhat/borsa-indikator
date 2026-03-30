'use client';

import { memo } from 'react';

interface Props {
  symbol: string;
  height?: number;
}

function TradingViewWidget({ symbol, height = 500 }: Props) {
  const widgetUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=BIST%3A${encodeURIComponent(symbol)}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=0a0a0f&studies=MASimple%40tv-basicstudies%1FRSI%40tv-basicstudies%1FMACD%40tv-basicstudies%1FBB%40tv-basicstudies&theme=dark&style=1&timezone=Europe%2FIstanbul&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=tr&utm_source=localhost&utm_medium=widget_new&utm_campaign=chart`;

  return (
    <iframe
      id="tv_chart"
      src={widgetUrl}
      style={{
        width: '100%',
        height: `${height}px`,
        border: 'none',
        borderRadius: '8px',
        backgroundColor: '#0a0a0f',
      }}
      allowFullScreen
      allow="clipboard-write"
    />
  );
}

export default memo(TradingViewWidget);
