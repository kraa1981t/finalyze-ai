import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  LineStyle,
  CrosshairMode,
} from 'lightweight-charts';

interface TradingViewWidgetProps {
  symbol: string;
  entryPrice?: number | null;
  sl?: number | null;
  tp?: number | null;
  side?: 'buy' | 'sell' | null;
  category?: string | null;
  qty?: number | null;
  openedAt?: number | null;
  onSlChange?: (price: number) => void;
  onTpChange?: (price: number) => void;
  [key: string]: any;
}

type LineKey = 'entry' | 'sl' | 'tp';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, onSlChange, onTpChange }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const dataRef = useRef<any[]>([]);
  const priceLinesRef = useRef<Partial<Record<LineKey, any>>>({});
  const draggingRef = useRef<LineKey | null>(null);
  const lastSyncRef = useRef(0);
  const [tf, setTf] = useState('5m');
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty'>('loading');

  const allPropsRef = useRef({ entryPrice, sl, tp, onSlChange, onTpChange });
  allPropsRef.current = { entryPrice, sl, tp, onSlChange, onTpChange };

  const lineDefs = (p = allPropsRef.current) => {
    return [
      { key: 'entry' as LineKey, price: p.entryPrice, color: '#e2e8f0', title: 'Entry', editable: false },
      { key: 'sl' as LineKey, price: p.sl, color: '#f23645', title: 'Stop Loss', editable: true },
      { key: 'tp' as LineKey, price: p.tp, color: '#089981', title: 'Take Profit', editable: true },
    ];
  };

  const updateLines = () => {
    const series = seriesRef.current;
    if (!series) return;
    const pl = priceLinesRef.current;
    for (const def of lineDefs()) {
      const existing = pl[def.key];
      if (def.price != null) {
        try {
          if (!existing) {
            pl[def.key] = series.createPriceLine({
              price: def.price,
              color: def.color,
              lineWidth: 2,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: def.title,
            });
          } else {
            existing.applyOptions({ price: def.price });
          }
        } catch {}
      } else if (existing) {
        try { series.removePriceLine(existing); } catch {}
        pl[def.key] = undefined;
      }
    }
  };

  // create the chart once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let chart: any;
    try {
      chart = createChart(el, {
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: '#0b0e14' },
          textColor: '#8b93a7',
          fontFamily: 'inherit',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.04)' },
          horzLines: { color: 'rgba(255,255,255,0.04)' },
        },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true, secondsVisible: false },
        crosshair: { mode: CrosshairMode.Normal },
      });
      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
      chartRef.current = chart;
      seriesRef.current = series;
      updateLines();
    } catch {
      return;
    }
    return () => {
      try { chart?.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fetch OHLC data when symbol or timeframe changes
  useEffect(() => {
    let cancelled = false;
    const raw = symbol.includes(':') ? symbol.split(':')[1] : symbol;
    fetch(`/api/market-data?symbol=${encodeURIComponent(raw)}&timeframe=${tf}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const result = d?.chart?.result?.[0];
        const ts: number[] | undefined = result?.timestamp;
        const q = result?.indicators?.quote?.[0];
        if (!ts || !q || !q.close) {
          setStatus('empty');
          return;
        }
        const candles: any[] = [];
        for (let i = 0; i < ts.length; i++) {
          const o = q.open?.[i];
          const h = q.high?.[i];
          const l = q.low?.[i];
          const c = q.close?.[i];
          if (o == null || h == null || l == null || c == null) continue;
          candles.push({ time: Math.floor(ts[i]), open: o, high: h, low: l, close: c });
        }
        if (!candles.length) {
          setStatus('empty');
          return;
        }
        dataRef.current = candles;
        try {
          seriesRef.current?.setData(candles);
          chartRef.current?.timeScale()?.fitContent?.();
        } catch {}
        updateLines();
        setStatus('ok');
      })
      .catch(() => {
        if (!cancelled) setStatus('empty');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, tf]);

  // redraw lines when entry/sl/tp change
  useEffect(() => {
    updateLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryPrice, sl, tp]);

  // drag SL/TP lines
  useEffect(() => {
    const el = containerRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return;
    const posY = (e: MouseEvent | PointerEvent) => e.clientY - el.getBoundingClientRect().top;
    const hitTest = (y: number) => {
      for (const def of lineDefs()) {
        if (!def.editable || def.price == null) continue;
        const lineY = chart.priceToCoordinate(def.price);
        if (lineY != null && Math.abs(lineY - y) <= 9) return def.key as LineKey;
      }
      return null;
    };
    const onDown = (e: PointerEvent) => {
      const key = hitTest(posY(e));
      if (key) {
        draggingRef.current = key;
        try { el.setPointerCapture?.(e.pointerId); } catch {}
      }
    };
    const onMove = (e: PointerEvent) => {
      const key = draggingRef.current;
      if (!key) return;
      const price = chart.coordinateToPrice(posY(e));
      if (price == null) return;
      const now = Date.now();
      if (now - lastSyncRef.current < 90) return;
      lastSyncRef.current = now;
      const p = allPropsRef.current;
      if (key === 'sl' && p.onSlChange) p.onSlChange(price);
      else if (key === 'tp' && p.onTpChange) p.onTpChange(price);
    };
    const onUp = () => { draggingRef.current = null; };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full">
      {status === 'empty' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-bold text-brand-text/40 bg-black/60 px-4 py-2 rounded-lg">
            {symbol} — لا توجد بيانات / no data
          </span>
        </div>
      )}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1">
        {TIMEFRAMES.map((t) => (
          <button
            key={t}
            onClick={() => setTf(t)}
            className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wide transition-colors ${
              tf === t
                ? 'bg-[#F59E0B] text-black'
                : 'bg-white/5 text-brand-text/60 hover:bg-white/15 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
