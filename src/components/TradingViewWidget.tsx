import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, CandlestickSeries, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { subscribePrices, calcPnl } from '../services/paperTradingService';
import { Maximize2, Minimize2, AlertTriangle } from 'lucide-react';

interface TradingViewWidgetProps {
  symbol: string;
  entryPrice?: number | null;
  sl?: number | null;
  tp?: number | null;
  side?: 'buy' | 'sell' | null;
  category?: string;
  qty?: number;
  onCloseTrade?: () => void;
  onSlChange?: (price: number) => void;
  onTpChange?: (price: number) => void;
}

const TIMEFRAMES = [
  { label: '1', value: '1m' }, { label: '5', value: '5m' }, { label: '15', value: '15m' },
  { label: '30', value: '15m' }, { label: '1H', value: '1h' }, { label: '4H', value: '4h' },
  { label: '1D', value: '1d' }, { label: '1W', value: '1w' },
];

interface Candle { time: Time; open: number; high: number; low: number; close: number; }

function toApiSymbol(sym: string): string {
  return sym.toUpperCase().trim();
}

function fmt(price: number): string {
  return price.toFixed(price < 10 ? 5 : 2);
}

function fmtPnl(v: number): string {
  return `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`;
}

async function fetchCandles(symbol: string, timeframe: string): Promise<Candle[]> {
  try {
    const r = await fetch(`/api/market-data?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`);
    if (!r.ok) return [];
    const d = await r.json();
    const result = d?.chart?.result?.[0];
    if (!result) return [];
    const ts: number[] = result.timestamp || [];
    const q = result.indicators?.quote?.[0];
    if (!q || ts.length === 0) return [];
    const candles: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
      if (o != null && h != null && l != null && c != null && !isNaN(c) && c > 0) {
        candles.push({ time: ts[i] as Time, open: o, high: h, low: l, close: c });
      }
    }
    return candles;
  } catch {
    return [];
  }
}

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, side, category, qty, onCloseTrade, onSlChange, onTpChange }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const entryLineRef = useRef<any>(null);
  const slLineRef = useRef<any>(null);
  const tpLineRef = useRef<any>(null);
  const candlesRef = useRef<Candle[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);

  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [interval, setInterval] = useState('1h');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartReady, setChartReady] = useState(false);

  const hasTradeData = entryPrice != null || sl != null || tp != null;
  const isBuy = side === 'buy';

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: { background: { color: '#0a0f1a' }, textColor: '#94a3b8', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.06)' } },
      crosshair: { mode: 0, vertLine: { color: 'rgba(255,255,255,0.3)', width: 1, style: 2, labelBackgroundColor: '#F59E0B' }, horzLine: { color: 'rgba(255,255,255,0.3)', width: 1, style: 2, labelBackgroundColor: '#F59E0B' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)', scaleMargins: { top: 0.15, bottom: 0.15 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true, rightOffset: 5 },
    });
    chartRef.current = chart;
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350', borderUpColor: '#26a69a', borderDownColor: '#ef5350', wickUpColor: '#26a69a', wickDownColor: '#ef5350', priceLineVisible: false,
    });
    seriesRef.current = series;
    setChartReady(true);

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null; };
  }, []);

  // Load data when symbol or interval changes
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    if (unsubRef.current) unsubRef.current();
    candlesRef.current = [];
    series.setData([]);

    (async () => {
      const candles = await fetchCandles(symbol, interval);
      if (candles.length > 0) {
        candlesRef.current = candles;
        series.setData(candles);
        chart.timeScale().fitContent();
      }

      unsubRef.current = subscribePrices([symbol], (sym, price) => {
        if (sym !== symbol || !price) return;
        setCurrentPrice(price);
        const tf = interval;
        let periodMs = 60000;
        if (tf === '5m') periodMs = 300000;
        else if (tf === '15m') periodMs = 900000;
        else if (tf === '1h') periodMs = 3600000;
        else if (tf === '4h') periodMs = 14400000;
        else if (tf === '1d') periodMs = 86400000;
        const nowPeriod = Math.floor(Date.now() / periodMs) * (periodMs / 1000) as Time;
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

  // Price lines — real lines on the chart
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    try { if (entryLineRef.current) series.removePriceLine(entryLineRef.current); } catch {}
    try { if (slLineRef.current) series.removePriceLine(slLineRef.current); } catch {}
    try { if (tpLineRef.current) series.removePriceLine(tpLineRef.current); } catch {}
    entryLineRef.current = null;
    slLineRef.current = null;
    tpLineRef.current = null;

    if (!hasTradeData) return;

    if (entryPrice != null) {
      entryLineRef.current = series.createPriceLine({
        price: entryPrice,
        color: isBuy ? '#2563EB' : '#F97316',
        title: ` ● ENTRY ${fmt(entryPrice)} `,
        lineWidth: 3,
        lineStyle: 0,
        axisLabelVisible: true,
        axisLabelColor: isBuy ? '#2563EB' : '#F97316',
      });
    }
    if (sl != null) {
      slLineRef.current = series.createPriceLine({
        price: sl,
        color: '#EF4444',
        title: ` ● SL ${fmt(sl)} ▼ `,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        axisLabelColor: '#EF4444',
      });
    }
    if (tp != null) {
      tpLineRef.current = series.createPriceLine({
        price: tp,
        color: '#10B981',
        title: ` ● TP ${fmt(tp)} ▲ `,
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        axisLabelColor: '#10B981',
      });
    }
  }, [entryPrice, sl, tp, hasTradeData, isBuy]);

  useEffect(() => {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = subscribePrices([symbol], (sym, price) => {
      if (sym === symbol && price) setCurrentPrice(price);
    });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [symbol]);

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const pnl = (currentPrice && entryPrice && side && category && qty)
    ? calcPnl({ category, symbol, side, qty, entryPrice }, currentPrice) : 0;
  const tpPnl = (tp && entryPrice && side && category && qty)
    ? calcPnl({ category, symbol, side, qty, entryPrice }, tp) : 0;
  const slPnl = (sl && entryPrice && side && category && qty)
    ? calcPnl({ category, symbol, side, qty, entryPrice }, sl) : 0;

  const step = entryPrice ? (entryPrice < 10 ? 0.0001 : entryPrice < 1000 ? 0.01 : 0.1) : 0.0001;

  return (
    <div ref={wrapperRef} className={`relative h-full w-full flex flex-col ${isFullscreen ? 'bg-black' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#0a0f1a] border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-0.5">
          {TIMEFRAMES.map(tf => (
            <button key={tf.value} onClick={() => setInterval(tf.value)}
              className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${interval === tf.value ? 'bg-amber-500 text-black' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
              {tf.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {hasTradeData && (
            <div className="flex items-center gap-1 text-[9px] text-white/40">
              <AlertTriangle size={10} className="text-amber-400" />
              <span>AUTO-CLOSE {isBuy ? 'BUY' : 'SELL'}</span>
            </div>
          )}
          {/* TP/SL inputs */}
          {hasTradeData && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-emerald-400">TP</span>
              <input type="text" value={tp != null ? fmt(tp) : '--'} readOnly
                className="w-16 text-[10px] text-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded px-1 py-0.5 font-mono" />
              <span className="text-[9px] text-red-400">SL</span>
              <input type="text" value={sl != null ? fmt(sl) : '--'} readOnly
                className="w-16 text-[10px] text-center bg-red-500/20 text-red-400 border border-red-500/30 rounded px-1 py-0.5 font-mono" />
            </div>
          )}
          <button onClick={toggleFullscreen} className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="h-full w-full" />

        {hasTradeData && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-2 pointer-events-auto">
            {side && (
              <div className={`px-2.5 py-1 rounded text-[11px] font-black shadow-lg ${isBuy ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'}`}>
                {isBuy ? '▲ BUY' : '▼ SELL'} {qty} @ {fmt(entryPrice || 0)}
              </div>
            )}
            {currentPrice && (
              <div className={`px-2 py-1 rounded text-[11px] font-bold shadow-lg ${pnl >= 0 ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                {fmtPnl(pnl)}
              </div>
            )}
          </div>
        )}

        {/* TP/SL adjust buttons — floating on chart */}
        {hasTradeData && currentPrice && (
          <div className="absolute right-2 z-20 flex flex-col gap-2 pointer-events-auto" style={{ top: '10%' }}>
            {tp != null && onTpChange && (
              <div className="flex flex-col items-center gap-0.5">
                <button onClick={() => onTpChange(tp + step)} className="w-6 h-5 rounded bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-400 text-[10px] font-black">▲</button>
                <div className="px-2 py-0.5 rounded bg-emerald-500 text-white text-[10px] font-black shadow-lg whitespace-nowrap">
                  TP {fmt(tp)} <span className="text-emerald-200">{fmtPnl(tpPnl)}</span>
                  {onCloseTrade && <button onClick={() => onTpChange(0)} className="ml-1 text-[8px]">✕</button>}
                </div>
                <button onClick={() => onTpChange(tp - step)} className="w-6 h-5 rounded bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-400 text-[10px] font-black">▼</button>
              </div>
            )}
            {sl != null && onSlChange && (
              <div className="flex flex-col items-center gap-0.5 mt-8">
                <button onClick={() => onSlChange(sl + step)} className="w-6 h-5 rounded bg-red-500/30 hover:bg-red-500/50 text-red-400 text-[10px] font-black">▲</button>
                <div className="px-2 py-0.5 rounded bg-red-500 text-white text-[10px] font-black shadow-lg whitespace-nowrap">
                  SL {fmt(sl)} <span className="text-red-200">{fmtPnl(slPnl)}</span>
                  {onCloseTrade && <button onClick={() => onSlChange(0)} className="ml-1 text-[8px]">✕</button>}
                </div>
                <button onClick={() => onSlChange(sl - step)} className="w-6 h-5 rounded bg-red-500/30 hover:bg-red-500/50 text-red-400 text-[10px] font-black">▼</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
