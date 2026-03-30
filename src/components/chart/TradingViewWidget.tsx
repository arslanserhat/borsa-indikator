'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';

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
  { label: '1G', range: '1d' },
  { label: '1A', range: '1mo' },
  { label: '3A', range: '3mo' },
  { label: '6A', range: '6mo' },
  { label: '1Y', range: '1y' },
  { label: '5Y', range: '5y' },
  { label: 'Tümü', range: 'max' },
];

export default function StockChart({ symbol, height = 500 }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [activeRange, setActiveRange] = useState('6mo');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1a1a2e' },
        textColor: '#9ca3af',
        fontFamily: 'monospace',
      },
      grid: {
        vertLines: { color: 'rgba(42, 42, 62, 0.5)' },
        horzLines: { color: 'rgba(42, 42, 62, 0.5)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: height - 50,
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#2a2a3e',
      },
      timeScale: {
        borderColor: '#2a2a3e',
        timeVisible: isIntraday(activeRange),
        secondsVisible: false,
      },
    });

    // Mum grafik serisi
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

    // Hacim serisi
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // SMA serisi
    const smaSeries = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Veri çek
    const intraday = isIntraday(activeRange);
    fetchChartData(symbol, activeRange).then((candles) => {
      if (candles.length === 0) {
        setLoading(false);
        return;
      }

      const candleData = candles.map((c: Candle) => ({
        time: intraday ? c.time as any : formatTime(c.time) as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      const volumeData = candles.map((c: Candle) => ({
        time: intraday ? c.time as any : formatTime(c.time) as any,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
      }));

      const smaData = calculateSMA(candles, intraday ? 9 : 20, intraday);

      candleSeries.setData(candleData as any);
      volumeSeries.setData(volumeData as any);
      smaSeries.setData(smaData as any);

      chart.timeScale().fitContent();
      setLoading(false);
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol, activeRange, height]);

  return (
    <div>
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '8px 12px',
        backgroundColor: '#12121a',
        borderBottom: '1px solid #2a2a3e',
      }}>
        {TIME_RANGES.map((range) => (
          <button
            key={range.range}
            onClick={() => { setActiveRange(range.range); setLoading(true); }}
            style={{
              padding: '4px 12px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: activeRange === range.range ? '#3b82f6' : 'transparent',
              color: activeRange === range.range ? 'white' : '#9ca3af',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeRange === range.range ? 'bold' : 'normal',
            }}
          >
            {range.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#9ca3af', alignSelf: 'center' }}>
          SMA({isIntraday(activeRange) ? '9' : '20'}) <span style={{ color: '#3b82f6' }}>━</span>
        </span>
      </div>

      <div style={{ position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#9ca3af',
            zIndex: 10,
          }}>
            Grafik yükleniyor...
          </div>
        )}
        <div ref={chartContainerRef} />
      </div>
    </div>
  );
}

function isIntraday(range: string): boolean {
  return range.includes('_') || range === '1d';
}

async function fetchChartData(symbol: string, range: string): Promise<Candle[]> {
  try {
    const res = await fetch(`/api/chart/${symbol}?range=${range}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.candles || [];
  } catch {
    return [];
  }
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateSMA(candles: Candle[], period: number, intraday: boolean = false) {
  const result: { time: any; value: number }[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close;
    }
    result.push({
      time: intraday ? candles[i].time : formatTime(candles[i].time),
      value: sum / period,
    });
  }
  return result;
}
