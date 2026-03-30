'use client';

import { useEffect, useRef, useState, memo } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi } from 'lightweight-charts';

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

function StockChart({ symbol, height = 500 }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [activeRange, setActiveRange] = useState('6mo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);

  // Canli fiyat (5sn guncelleme)
  useEffect(() => {
    let active = true;
    const update = async () => {
      try {
        const res = await fetch(`/api/stock/${symbol}`);
        if (!res.ok || !active) return;
        const json = await res.json();
        if (json.data && active) {
          setLastPrice(json.data.fiyat);
          setPriceChange(json.data.degisimYuzde || 0);
        }
      } catch {}
    };
    update();
    const iv = setInterval(update, 5000);
    return () => { active = false; clearInterval(iv); };
  }, [symbol]);

  // Chart
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
    const volumeSeries = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    const smaSeries = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const intraday = isIntraday(activeRange);

    fetchChartData(symbol, activeRange, ctrl.signal).then((candles) => {
      if (ctrl.signal.aborted) return;
      if (candles.length === 0) { setLoading(false); setError(true); return; }
      setError(false);

      candleSeries.setData(candles.map(c => ({
        time: (intraday ? c.time : fmtTime(c.time)) as any,
        open: c.open, high: c.high, low: c.low, close: c.close,
      })));
      volumeSeries.setData(candles.map(c => ({
        time: (intraday ? c.time : fmtTime(c.time)) as any,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
      })));
      smaSeries.setData(calcSMA(candles, intraday ? 9 : 20, intraday));
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
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#e4e4e7' }}>
              {lastPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL
            </span>
            <span style={{
              fontSize: '11px', fontWeight: '600',
              color: priceChange >= 0 ? '#22c55e' : '#ef4444',
              backgroundColor: priceChange >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              padding: '2px 6px', borderRadius: '3px',
            }}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 4px #22c55e', animation: 'pulse 2s infinite' }} />
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
        {/* TradingView'de ac butonu */}
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
            <button onClick={() => { setLoading(true); setError(false); setActiveRange(prev => prev); }}
              style={{ backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
              Tekrar Dene
            </button>
          </div>
        )}
        <div ref={chartContainerRef} />
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
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
    const d = await res.json();
    return d.candles || [];
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
