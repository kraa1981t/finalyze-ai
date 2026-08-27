import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface TradingViewWidgetProps {
  symbol: string;
  entryPrice?: number | null;
  sl?: number | null;
  tp?: number | null;
  side?: 'buy' | 'sell' | null;
  category?: string;
  qty?: number;
  openedAt?: number;
  onCloseTrade?: () => void;
  onSlChange?: (price: number) => void;
  onTpChange?: (price: number) => void;
}

const TIMEFRAMES = [
  { label: '1m', value: '1m' }, { label: '5m', value: '5m' }, { label: '15m', value: '15m' },
  { label: '1H', value: '1h' }, { label: '4H', value: '4h' },
  { label: '1D', value: '1d' }, { label: '1W', value: '1w' }, { label: '1M', value: '1mo' },
];

interface Candle { time: number; open: number; high: number; low: number; close: number; }

function fmt(price: number): string {
  return price.toFixed(price < 10 ? 5 : 2);
}

export default function TradingViewWidget({ symbol }: TradingViewWidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const candlesRef = useRef<Candle[]>([]);

  const [interval, setInterval] = useState('1h');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Init chart
  useEffect(() => {
    let chart: any = null;
    let series: any = null;
    let ro: ResizeObserver | null = null;
    let disposed = false;

    async function init() {
      const lc = await import('lightweight-charts');
      if (disposed || !canvasRef.current) return;

      chart = lc.createChart(canvasRef.current, {
        width: canvasRef.current.clientWidth || 600,
        height: canvasRef.current.clientHeight || 400,
        layout: { background: { color: '#0a0f1a' }, textColor: '#94a3b8', fontSize: 11 },
        grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.06)' } },
        crosshair: { mode: 0 },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true },
      });
      chartRef.current = chart;

      series = chart.addSeries(lc.CandlestickSeries, {
        upColor: '#26a69a', downColor: '#ef5350',
        borderUpColor: '#26a69a', borderDownColor: '#ef5350',
        wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        priceLineVisible: false,
      });
      seriesRef.current = series;

      ro = new ResizeObserver(() => {
        if (canvasRef.current && chart) {
          chart.applyOptions({ width: canvasRef.current.clientWidth, height: canvasRef.current.clientHeight });
        }
      });
      ro.observe(canvasRef.current);
    }

    init();

    return () => {
      disposed = true;
      ro?.disconnect();
      chart?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Load candles + subscribe price
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (unsubRef.current) unsubRef.current();
    candlesRef.current = [];
    series.setData([]);

    (async () => {
      try {
        const r = await fetch(`/api/market-data?symbol=${encodeURIComponent(symbol)}&timeframe=${interval}`);
        if (r.ok) {
          const d = await r.json();
          const result = d?.chart?.result?.[0];
          const ts: number[] = result?.timestamp || [];
          const q = result?.indicators?.quote?.[0];
          if (q && ts.length > 0) {
            const candles: Candle[] = [];
            for (let i = 0; i < ts.length; i++) {
              const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
              if (o != null && h != null && l != null && c != null && !isNaN(c) && c > 0) {
                candles.push({ time: ts[i], open: o, high: h, low: l, close: c });
              }
            }
            if (candles.length > 0) {
              candlesRef.current = candles;
              series.setData(candles);
              chartRef.current?.timeScale().fitContent();
            }
          }
        }
      } catch {}

      const { subscribePrices } = await import('../services/paperTradingService');
      unsubRef.current = subscribePrices([symbol], (sym: string, price: number) => {
        if (sym !== symbol || !price) return;
        const periodMs: Record<string, number> = { '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000, '1w': 604800000, '1mo': 2592000000 };
        const ms = periodMs[interval] || 3600000;
        const nowPeriod = Math.floor(Date.now() / ms) * (ms / 1000);
        const last = candlesRef.current[candlesRef.current.length - 1];
        if (last && last.time === nowPeriod) {
          last.high = Math.max(last.high, price);
          last.low = Math.min(last.low, price);
          last.close = price;
          series.update(last);
        } else {
          const candle: Candle = { time: nowPeriod, open: price, high: price, low: price, close: price };
          candlesRef.current.push(candle);
          series.update(candle);
        }
      });
    })();

    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [symbol, interval]);

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) { wrapperRef.current.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  }, []);

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  return (
    <div ref={wrapperRef} className={`relative h-full w-full flex flex-col ${isFullscreen ? 'bg-black' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#0a0f1a] border-b border-white/5 flex-shrink-0 z-30">
        <div className="flex items-center gap-0.5">
          {TIMEFRAMES.map(tf => (
            <button key={tf.value} onClick={() => setInterval(tf.value)}
              className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${interval === tf.value ? 'bg-amber-500 text-black' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
              {tf.label}
            </button>
          ))}
        </div>
        <button onClick={toggleFullscreen} className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Chart */}
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    </div>
  );
}
