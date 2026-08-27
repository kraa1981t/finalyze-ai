import React, { useEffect, useRef, useState, useCallback } from 'react';
import { subscribePrices, calcPnl } from '../services/paperTradingService';
import { Maximize2, Minimize2 } from 'lucide-react';

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
  { label: '1m', value: '1m' }, { label: '5m', value: '5m' }, { label: '15m', value: '15m' },
  { label: '1H', value: '1h' }, { label: '4H', value: '4h' }, { label: '1D', value: '1d' },
  { label: '1W', value: '1w' },
];

interface Candle { time: number; open: number; high: number; low: number; close: number; }

function fmt(price: number): string {
  return price.toFixed(price < 10 ? 5 : 2);
}
function fmtPnl(v: number): string {
  return `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`;
}

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, side, category, qty, onCloseTrade, onSlChange, onTpChange }: TradingViewWidgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const dragRef = useRef<{ type: 'tp' | 'sl' | null; startY: number; startPrice: number }>({ type: null, startY: 0, startPrice: 0 });

  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [interval, setInterval] = useState('1h');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasTradeData = entryPrice != null || sl != null || tp != null;
  const isBuy = side === 'buy';

  // Import lightweight-charts dynamically
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

      unsubRef.current = subscribePrices([symbol], (sym, price) => {
        if (sym !== symbol || !price) return;
        setCurrentPrice(price);
        const periodMs: Record<string, number> = { '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000, '1w': 604800000 };
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

  // Price lines
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    try { series.removeAllLines?.(); } catch {}
    if (!hasTradeData) return;

    if (entryPrice != null) {
      series.createPriceLine({ price: entryPrice, color: isBuy ? '#2563EB' : '#F97316', title: ` ENTRY ${fmt(entryPrice)} `, lineWidth: 3, lineStyle: 0, axisLabelVisible: true });
    }
    if (tp != null) {
      series.createPriceLine({ price: tp, color: '#10B981', title: ` TP ${fmt(tp)} `, lineWidth: 2, lineStyle: 2, axisLabelVisible: true });
    }
    if (sl != null) {
      series.createPriceLine({ price: sl, color: '#EF4444', title: ` SL ${fmt(sl)} `, lineWidth: 2, lineStyle: 2, axisLabelVisible: true });
    }
  }, [entryPrice, sl, tp, hasTradeData, isBuy, currentPrice]);

  // Drag handlers for SL/TP
  const handlePointerDown = useCallback((type: 'tp' | 'sl', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const price = type === 'tp' ? tp : sl;
    if (price == null) return;
    dragRef.current = { type, startY: e.clientY, startPrice: price };
    const onMove = (ev: PointerEvent) => {
      const series = seriesRef.current;
      const chart = chartRef.current;
      if (!series || !chart || !dragRef.current.type) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const priceScale = chart.priceScale('right');
      const startYCoord = priceScale.priceToCoordinate(dragRef.current.startPrice)!;
      const currentYCoord = startYCoord + (ev.clientY - dragRef.current.startY);
      const newPrice = priceScale.coordinateToPrice(currentYCoord);
      if (newPrice != null && newPrice > 0) {
        if (dragRef.current.type === 'tp' && onTpChange) onTpChange(newPrice);
        if (dragRef.current.type === 'sl' && onSlChange) onSlChange(newPrice);
      }
    };
    const onUp = () => { dragRef.current.type = null; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [tp, sl, onTpChange, onSlChange]);

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

  const pnl = (currentPrice && entryPrice && side && category && qty) ? calcPnl({ category, symbol, side, qty, entryPrice }, currentPrice) : 0;
  const tpPnl = (tp && entryPrice && side && category && qty) ? calcPnl({ category, symbol, side, qty, entryPrice }, tp) : 0;
  const slPnl = (sl && entryPrice && side && category && qty) ? calcPnl({ category, symbol, side, qty, entryPrice }, sl) : 0;
  const step = entryPrice ? (entryPrice < 10 ? 0.0001 : entryPrice < 1000 ? 0.01 : 0.1) : 0.0001;

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
        <div className="flex items-center gap-2">
          {hasTradeData && (
            <div className="flex items-center gap-1.5 text-[9px]">
              <span className="text-amber-400/70">AUTO-CLOSE</span>
            </div>
          )}
          {hasTradeData && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-emerald-400">TP</span>
              <input type="text" value={tp != null ? fmt(tp) : '--'} readOnly
                className="w-16 text-[10px] text-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded px-1 py-0.5 font-mono cursor-pointer" />
              <span className="text-[9px] text-red-400">SL</span>
              <input type="text" value={sl != null ? fmt(sl) : '--'} readOnly
                className="w-16 text-[10px] text-center bg-red-500/20 text-red-400 border border-red-500/30 rounded px-1 py-0.5 font-mono cursor-pointer" />
            </div>
          )}
          <button onClick={toggleFullscreen} className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 relative">
        <canvas ref={canvasRef} className="h-full w-full" />

        {/* Trade badge */}
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

        {/* Draggable TP/SL controls */}
        {hasTradeData && (
          <div className="absolute right-12 z-20 flex flex-col gap-3 pointer-events-auto" style={{ top: '15%' }}>
            {tp != null && onTpChange && (
              <div className="flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => handlePointerDown('tp', e)}>
                <button onClick={(e) => { e.stopPropagation(); onTpChange(tp + step); }}
                  className="w-6 h-4 rounded bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-300 text-[10px] font-black leading-none">▲</button>
                <div className="px-2 py-1 rounded bg-emerald-500 text-white text-[10px] font-black shadow-lg whitespace-nowrap flex items-center gap-1">
                  <span>TP</span><span className="font-mono">{fmt(tp)}</span>
                  <span className="text-emerald-200 text-[9px]">{fmtPnl(tpPnl)}</span>
                  <button onClick={(e) => { e.stopPropagation(); onTpChange(0); }}
                    className="ml-0.5 text-[8px] hover:text-red-200">✕</button>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onTpChange(tp - step); }}
                  className="w-6 h-4 rounded bg-emerald-600/40 hover:bg-emerald-600/60 text-emerald-300 text-[10px] font-black leading-none">▼</button>
              </div>
            )}

            {entryPrice != null && (
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/80 text-white text-[10px] font-black shadow-lg whitespace-nowrap pointer-events-none">
                <span className="w-2 h-2 rounded-full bg-blue-300" />
                <span>ENTRY</span><span className="font-mono">{fmt(entryPrice)}</span>
              </div>
            )}

            {sl != null && onSlChange && (
              <div className="flex flex-col items-center gap-0.5 cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => handlePointerDown('sl', e)}>
                <button onClick={(e) => { e.stopPropagation(); onSlChange(sl + step); }}
                  className="w-6 h-4 rounded bg-red-600/40 hover:bg-red-600/60 text-red-300 text-[10px] font-black leading-none">▲</button>
                <div className="px-2 py-1 rounded bg-red-500 text-white text-[10px] font-black shadow-lg whitespace-nowrap flex items-center gap-1">
                  <span>SL</span><span className="font-mono">{fmt(sl)}</span>
                  <span className="text-red-200 text-[9px]">{fmtPnl(slPnl)}</span>
                  <button onClick={(e) => { e.stopPropagation(); onSlChange(0); }}
                    className="ml-0.5 text-[8px] hover:text-red-200">✕</button>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onSlChange(sl - step); }}
                  className="w-6 h-4 rounded bg-red-600/40 hover:bg-red-600/60 text-red-300 text-[10px] font-black leading-none">▼</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
