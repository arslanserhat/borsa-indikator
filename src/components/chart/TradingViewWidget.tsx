'use client';

import { useEffect, useRef, useState, memo } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi } from 'lightweight-charts';

interface Props {
  symbol: string;
  height?: number;
}

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TIME_RANGES = [
  { label: '5dk', range: '1d_5m' },
  { label: '15dk', range: '1d_15m' },
  { label: '1sa', range: '5d_1h' },
  { label: '4sa', range: '1mo_4h' },
  { label: '1A', range: '1mo' },
  { label: '3A', range: '3mo' },
  { label: '6A', range: '6mo' },
  { label: '1Y', range: '1y' },
  { label: '5Y', range: '5y' },
  { label: 'Tumu', range: 'max' },
];

const LIVE_INTERVAL = 1000; // 1 saniye - maksimum hiz

function StockChart({ symbol, height = 500 }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastCandleRef = useRef<any>(null);

  const [activeRange, setActiveRange] = useState('6mo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [tickCount, setTickCount] = useState(0);

  // CANLI FIYAT - 1sn polling + grafik guncelleme
  useEffect(() => {
    let active = true;

    const update = async () => {
      try {
        const res = await fetch(`/api/stock/${symbol}`);
        if (!res.ok || !active) return;
        const json = await res.json();
        if (!json.data || !active) return;

        const price = json.data.fiyat;
        const change = json.data.degisimYuzde || 0;
        const vol = json.data.hacim || 0;
        const high = json.data.yuksek || price;
        const low = json.data.dusuk || price;

        setLastPrice(price);
        setPriceChange(change);
        setTickCount(c => c + 1);

        // GRAFIK SON MUMU CANLI GUNCELLE
        if (candleSeriesRef.current && lastCandleRef.current) {
          const lastCandle = lastCandleRef.current;
          const updatedCandle = {
            ...lastCandle,
            close: price,
            high: Math.max(lastCandle.high, high),
            low: Math.min(lastCandle.low, low),
          };
          lastCandleRef.current = updatedCandle;
          candleSeriesRef.current.update(updatedCandle);

          // Hacim de guncelle
          if (volumeSeriesRef.current) {
            volumeSeriesRef.current.update({
              time: lastCandle.time,
              value: vol,
              color: price >= lastCandle.open ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
            } as any);
          }
        }
      } catch {}
    };

    update();
    const iv = setInterval(update, LIVE_INTERVAL);
    return () => { active = false; clearInterval(iv); };
  }, [symbol]);

  // GRAFIK OLUSTUR
  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0a0a0f' }, textColor: '#9ca3af', fontFamily: 'monospace' },
      grid: { vertLines: { color: 'rgba(42,42,62,0.3)' }, horzLines: { color: 'rgba(42,42,62,0.3)' } },
      width: chartContainerRef.current.clientWidth,
      height: height - 56,
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#2a2a3e' },
      timeScale: { borderColor: '#2a2a3e', timeVisible: isIntraday(activeRange), secondsVisible: false },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderDownColor: '#ef4444', borderUpColor: '#22c55e',
      wickDownColor: '#ef4444', wickUpColor: '#22c55e',
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    const smaSeries = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const intraday = isIntraday(activeRange);

    fetchChartData(symbol, activeRange, ctrl.signal).then((candles) => {
      if (ctrl.signal.aborted) return;
      if (candles.length === 0) { setLoading(false); setError(true); return; }
      setError(false);

      const candleData = candles.map(c => ({
        time: (intraday ? c.time : fmtTime(c.time)) as any,
        open: c.open, high: c.high, low: c.low, close: c.close,
      }));
      const volumeData = candles.map(c => ({
        time: (intraday ? c.time : fmtTime(c.time)) as any,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
      }));

      candleSeries.setData(candleData as any);
      volumeSeries.setData(volumeData as any);
      smaSeries.setData(calcSMA(candles, intraday ? 9 : 20, intraday));

      // Son mumu kaydet (canli guncelleme icin)
      if (candleData.length > 0) {
        lastCandleRef.current = candleData[candleData.length - 1];
      }

      chart.timeScale().fitContent();
      setLoading(false);
    });

    const onResize = () => { if (chartContainerRef.current) chart.applyOptions({ width: chartContainerRef.current.clientWidth }); };
    window.addEventListener('resize', onResize);
    return () => { if (abortRef.current) abortRef.current.abort(); window.removeEventListener('resize', onResize); chart.remove(); chartRef.current = null; };
  }, [symbol, activeRange, height]);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '8px 12px', backgroundColor: '#0a0a0f', borderBottom: '1px solid #1a1a2e' }}>
        {lastPrice !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#e4e4e7', fontVariantNumeric: 'tabular-nums' }}>
              {lastPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
            </span>
            <span style={{
              fontSize: '11px', fontWeight: '600', fontVariantNumeric: 'tabular-nums',
              color: priceChange >= 0 ? '#22c55e' : '#ef4444',
              backgroundColor: priceChange >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              padding: '2px 6px', borderRadius: '3px',
            }}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
            {/* Canli gosterge - her tick'te yanip soner */}
            <span key={tickCount} style={{
              width: '6px', height: '6px', borderRadius: '50%',
              backgroundColor: '#22c55e',
              boxShadow: '0 0 6px #22c55e',
              animation: 'tick-flash 0.3s ease-out',
            }} />
            <span style={{ fontSize: '8px', color: '#4b5563', letterSpacing: '0.5px' }}>CANLI</span>
          </div>
        )}

        {TIME_RANGES.map(r => (
          <button key={r.range} onClick={() => { setActiveRange(r.range); setLoading(true); setError(false); }}
            style={{ padding: '3px 8px', borderRadius: '3px', border: 'none', backgroundColor: activeRange === r.range ? '#3b82f6' : 'transparent', color: activeRange === r.range ? 'white' : '#6b7280', cursor: 'pointer', fontSize: '10px', fontWeight: '600' }}>
            {r.label}
          </button>
        ))}

        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#6b7280' }}>
          SMA({isIntraday(activeRange) ? '9' : '20'}) <span style={{ color: '#3b82f6' }}>━</span>
        </span>
        <a href={`https://tr.tradingview.com/chart/?symbol=BIST%3A${symbol}`} target="_blank" rel="noopener noreferrer"
          style={{ marginLeft: '8px', fontSize: '9px', color: '#3b82f6', textDecoration: 'none', border: '1px solid #3b82f6', padding: '2px 8px', borderRadius: '3px' }}>
          TradingView
        </a>
      </div>

      <div style={{ position: 'relative', backgroundColor: '#0a0a0f' }}>
        {loading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#6b7280', zIndex: 10, fontSize: '12px' }}>Grafik yukleniyor...</div>}
        {error && !loading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#ef4444', marginBottom: '8px' }}>Grafik verisi alinamadi</div>
            <button onClick={() => { setLoading(true); setError(false); setActiveRange(activeRange); }}
              style={{ backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
              Tekrar Dene
            </button>
          </div>
        )}
        <div ref={chartContainerRef} />
        <style>{`
          @keyframes tick-flash {
            0% { transform: scale(2); opacity: 1; box-shadow: 0 0 12px #22c55e; }
            100% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 4px #22c55e; }
          }
        `}</style>
      </div>
    </div>
  );
}

export default memo(StockChart);

function isIntraday(r: string) { return r.includes('_'); }

async function fetchChartData(sym: string, range: string, signal?: AbortSignal): Promise<Candle[]> {
  try {
    const res = await fetch(`/api/chart/${sym}?range=${range}`, { signal });
    if (!res.ok) return [];
    return (await res.json()).candles || [];
  } catch { return []; }
}

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function calcSMA(candles: Candle[], period: number, intraday: boolean) {
  const r: any[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += candles[j].close;
    r.push({ time: intraday ? candles[i].time : fmtTime(candles[i].time), value: s / period });
  }
  return r;
}
