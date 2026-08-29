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

function stepFor(price: number): number {
  if (!isFinite(price) || price <= 0) return 0.01;
  const a = Math.abs(price);
  if (a < 10) return 0.0001;
  if (a < 100) return 0.01;
  if (a < 1000) return 0.1;
  return 1;
}

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, onSlChange, onTpChange }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const priceLinesRef = useRef<Partial<Record<LineKey, any>>>({});
  const draggingRef = useRef<LineKey | null>(null);
  const hoveredRef = useRef<LineKey | null>(null);
  const lastSyncRef = useRef(0);
  const [tf, setTf] = useState('1h');
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty'>('loading');

  const allPropsRef = useRef({ entryPrice, sl, tp, onSlChange, onTpChange });
  allPropsRef.current = { entryPrice, sl, tp, onSlChange, onTpChange };

  const lineDefs = (p = allPropsRef.current) => {
    return [
      { key: 'entry' as LineKey, price: p.entryPrice, color: '#eab308', title: 'Entry', editable: false },
      { key: 'sl' as LineKey, price: p.sl, color: '#f23645', title: 'SL', editable: true },
      { key: 'tp' as LineKey, price: p.tp, color: '#089981', title: 'TP', editable: true },
    ];
  };

  const updateLines = () => {
    const series = seriesRef.current;
    if (!series) return;
    for (const def of lineDefs()) {
      const key = def.key;
      const existing = priceLinesRef.current[key];
      if (def.price == null) {
        if (existing) {
          try { series.removePriceLine(existing); } catch {}
          priceLinesRef.current[key] = undefined;
        }
        continue;
      }
      try {
        if (!existing) {
          priceLinesRef.current[key] = series.createPriceLine({
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
    }
  };

  const fitToLevels = () => {
    const chart = chartRef.current;
    if (!chart) return;
    try {
      const pts = lineDefs().map((d) => d.price).filter((p): p is number => p != null && isFinite(p));
      if (!pts.length) return;
      const data = dataRef.current;
      if (data.length) {
        const hi = data.reduce((m, c) => Math.max(m, c.high), -Infinity);
        const lo = data.reduce((m, c) => Math.min(m, c.low), Infinity);
        pts.push(hi, lo);
      }
      const min = Math.min(...pts);
      const max = Math.max(...pts);
      let pad = (max - min) * 0.12;
      if (!isFinite(pad) || pad <= 0) pad = max * 0.005;
      chart.timeScale()?.fitContent?.();
      chart.priceScale('right')?.applyOptions?.({ autoScale: false });
      // expand right scale to include levels
      if (chart.priceScale('right')?.setVisibleRange) {
        chart.priceScale('right').setVisibleRange({ from: min - pad, to: max + pad });
      }
    } catch {}
  };

  // create the chart once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let chart: any;
    let raf = 0;
    const placeDot = () => {
      const dot = dotRef.current;
      const chartEl = chartRef.current;
      if (!dot || !chartEl) return;
      const p = allPropsRef.current;
      if (p.entryPrice == null) { dot.style.display = 'none'; return; }
      const y = chartEl.priceToCoordinate(p.entryPrice);
      const box = el.getBoundingClientRect();
      if (y == null || !box.width) { raf = requestAnimationFrame(placeDot); return; }
      const x = box.width - 46;
      dot.style.display = 'block';
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      raf = requestAnimationFrame(placeDot);
    };
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
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)', autoScale: true },
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
      raf = requestAnimationFrame(placeDot);
    } catch {
      return;
    }
    return () => {
      cancelAnimationFrame(raf);
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
        if (!candles.length) { setStatus('empty'); return; }
        dataRef.current = candles;
        try {
          seriesRef.current?.setData(candles);
          chartRef.current?.timeScale()?.fitContent?.();
        } catch {}
        updateLines();
        setTimeout(fitToLevels, 60);
        setStatus('ok');
      })
      .catch(() => { if (!cancelled) setStatus('empty'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, tf]);

  // redraw lines + refit when entry/sl/tp change
  useEffect(() => {
    updateLines();
    setTimeout(fitToLevels, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryPrice, sl, tp]);

  // adjust helper via stepper buttons (calls parent adjust)
  const stepSl = (dir: number) => {
    const p = allPropsRef.current;
    if (p.sl == null || !p.onSlChange) return;
    p.onSlChange(p.sl + stepFor(p.sl) * dir);
  };
  const stepTp = (dir: number) => {
    const p = allPropsRef.current;
    if (p.tp == null || !p.onTpChange) return;
    p.onTpChange(p.tp + stepFor(p.tp) * dir);
  };

  // drag SL/TP lines + hover cursor
  useEffect(() => {
    const el = containerRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return;
    const posY = (e: MouseEvent | PointerEvent) => e.clientY - el.getBoundingClientRect().top;
    const hitTest = (y: number) => {
      for (const def of lineDefs()) {
        if (!def.editable || def.price == null) continue;
        const lineY = chart.priceToCoordinate(def.price);
        if (lineY != null && Math.abs(lineY - y) <= 14) return def.key as LineKey;
      }
      return null;
    };
    const onMove = (e: PointerEvent | MouseEvent) => {
      const y = posY(e);
      const key = draggingRef.current || hitTest(y);
      if (key && key !== hoveredRef.current) { hoveredRef.current = key; el.style.cursor = 'ns-resize'; }
      else if (!key && hoveredRef.current) { hoveredRef.current = null; el.style.cursor = 'crosshair'; }
      if (!draggingRef.current) return;
      const price = chart.coordinateToPrice(y);
      if (price == null) return;
      const k = draggingRef.current;
      const p = allPropsRef.current;
      try { priceLinesRef.current[k]?.applyOptions({ price }); } catch {}
      const now = performance.now();
      if (now - lastSyncRef.current >= 120) {
        lastSyncRef.current = now;
        if (k === 'sl' && p.onSlChange) p.onSlChange(price);
        else if (k === 'tp' && p.onTpChange) p.onTpChange(price);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const key = hitTest(posY(e));
      if (key) {
        draggingRef.current = key;
        hoveredRef.current = key;
        el.style.cursor = 'ns-resize';
        try { el.setPointerCapture?.(e.pointerId); } catch {}
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onUp = () => { draggingRef.current = null; el.style.cursor = 'crosshair'; };
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

  const hasLevels = (sl != null || tp != null) && entryPrice != null;
  const fmt = (n: number | null | undefined) => (n == null ? '—' : Number(n).toPrecision(6));

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

      {/* On-chart level control panel */}
      {hasLevels && (
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 bg-black/60 backdrop-blur rounded-lg border border-white/10 p-1.5 text-[11px]">
          <div className="flex items-center gap-2 text-white">
            <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
            <span className="text-white/60 font-bold">Entry</span>
            <span className="font-black tabular-nums">{fmt(entryPrice)}</span>
          </div>
          <div className="flex items-center gap-2 text-red-400">
            <span className="w-2 h-0.5 bg-red-500 inline-block" />
            <span className="text-white/60 font-bold">SL</span>
            <span className="font-black tabular-nums">{fmt(sl)}</span>
            {sl != null && (
              <div className="flex items-center gap-0.5">
                <button onClick={() => stepSl(-1)} className="w-5 h-5 rounded bg-white/10 hover:bg-white/25 text-white font-black leading-none" title="−">−</button>
                <button onClick={() => stepSl(1)} className="w-5 h-5 rounded bg-white/10 hover:bg-white/25 text-white font-black leading-none" title="+">+</button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="w-2 h-0.5 bg-emerald-500 inline-block" />
            <span className="text-white/60 font-bold">TP</span>
            <span className="font-black tabular-nums">{fmt(tp)}</span>
            {tp != null && (
              <div className="flex items-center gap-0.5">
                <button onClick={() => stepTp(-1)} className="w-5 h-5 rounded bg-white/10 hover:bg-white/25 text-white font-black leading-none" title="−">−</button>
                <button onClick={() => stepTp(1)} className="w-5 h-5 rounded bg-white/10 hover:bg-white/25 text-white font-black leading-none" title="+">+</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={containerRef} className="absolute inset-0" />
      <div
        ref={dotRef}
        style={{ display: 'none', position: 'absolute', width: 12, height: 12, marginLeft: -6, marginTop: -6, pointerEvents: 'none', zIndex: 5 }}
      >
        <span className="absolute inline-flex h-3.5 w-3.5 rounded-full bg-yellow-400 opacity-75 animate-ping" />
        <span className="absolute inline-flex h-2 w-2 rounded-full bg-yellow-400" />
      </div>
    </div>
  );
}
