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
  const overlayRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const dataRef = useRef<any[]>([]);
  const priceLinesRef = useRef<Partial<Record<LineKey, any>>>({});
  const [tf, setTf] = useState('1h');
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty'>('loading');

  const allPropsRef = useRef({ entryPrice, sl, tp, onSlChange, onTpChange });
  allPropsRef.current = { entryPrice, sl, tp, onSlChange, onTpChange };

  // live pixel positions of each price line, kept in sync on every render/data change
  const [positions, setPositions] = useState<{ entry?: number; sl?: number; tp?: number }>({});

  const lineDefs = (p = allPropsRef.current) => {
    return [
      { key: 'entry' as LineKey, price: p.entryPrice, color: '#eab308', title: 'Entry', editable: false },
      { key: 'sl' as LineKey, price: p.sl, color: '#f23645', title: 'SL', editable: true },
      { key: 'tp' as LineKey, price: p.tp, color: '#089981', title: 'TP', editable: true },
    ];
  };

  // Draw (or update) price lines on the series + compute their pixel Y positions into overlay
  const syncLines = () => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const pos: { entry?: number; sl?: number; tp?: number } = {};
    const pl = priceLinesRef.current;
    for (const def of lineDefs()) {
      if (def.price != null) {
        try {
          if (!pl[def.key]) {
            pl[def.key] = series.createPriceLine({
              price: def.price,
              color: def.color,
              lineWidth: 2,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: def.title,
            });
          } else {
            pl[def.key].applyOptions({ price: def.price });
          }
        } catch {}
      } else if (pl[def.key]) {
        try { series.removePriceLine(pl[def.key]); } catch {}
        pl[def.key] = undefined;
      }
    }

    // Recompute pixel positions on the next frame AFTER chart auto-size settles
    requestAnimationFrame(() => {
      for (const def of lineDefs()) {
        if (def.price == null) continue;
        try {
          const y = series.priceToCoordinate(def.price);
          if (typeof y === 'number' && isFinite(y) && y >= 0) {
            pos[def.key] = y;
          }
        } catch {}
      }
      setPositions(pos);
    });
  };

  // update lines whenever sl/tp/entry change or chart data changes
  useEffect(() => {
    syncLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryPrice, sl, tp]);

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
      syncLines();
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
        syncLines();
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

  // ---- Draggable overlay strips (SL/TP) ----
  // Each strip is a real DOM div; dragging it converts pointer Y -> price and calls back.
  const stripDrag = useRef<LineKey | null>(null);
  const stripPointerId = useRef<number>(-1);

  const onStripDown = (key: LineKey) => (e: React.PointerEvent<HTMLDivElement>) => {
    console.log('[STRIP] down', key, 'y=', Math.round(e.clientY));
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    stripDrag.current = key;
    stripPointerId.current = e.pointerId;
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch {}
  };

  const onStripMove = (key: LineKey) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (stripDrag.current !== key) return;
    const series = seriesRef.current;
    const el = overlayRef.current;
    if (!series || !el) return;
    const rect = el.getBoundingClientRect();
    const y = e.clientY - rect.top;
    let price: number | null = null;
    try { price = series.coordinateToPrice(y) as number | null; } catch {}
    if (price == null || !isFinite(price)) return;
    const p = allPropsRef.current;
    if (key === 'sl' && p.onSlChange) p.onSlChange(price);
    else if (key === 'tp' && p.onTpChange) p.onTpChange(price);
  };

  const onStripUp = (key: LineKey) => (e: React.PointerEvent<HTMLDivElement>) => {
    console.log('[STRIP] up', key);
    if (stripDrag.current === key) {
      stripDrag.current = null;
      try { (e.currentTarget as HTMLElement).releasePointerCapture?.(stripPointerId.current); } catch {}
    }
  };

  const stripCommon = (key: LineKey): React.CSSProperties => ({
    position: 'absolute',
    left: 0,
    right: 0,
    touchAction: 'none',
    cursor: 'ns-resize',
    zIndex: 15,
  });

  const pos = positions;

  return (
    <div className="relative h-full w-full" style={{ touchAction: 'none' }}>
      {status === 'empty' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <span className="text-sm font-bold text-brand-text/40 bg-black/60 px-4 py-2 rounded-lg">
            {symbol} — لا توجد بيانات / no data
          </span>
        </div>
      )}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1">
        {TIMEFRAMES.map((t) => (
          <button
            key={t}
            onClick={() => setTf(t)}
            className={`relative z-40 px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wide transition-colors ${
              tf === t
                ? 'bg-[#F59E0B] text-black'
                : 'bg-white/5 text-brand-text/60 hover:bg-white/15 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="h-full w-full" style={{ touchAction: 'none', userSelect: 'none' }} />

      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" style={{ touchAction: 'none' }}>
        {typeof pos.sl === 'number' && sl != null && (
          <div
            onPointerDown={onStripDown('sl')}
            onPointerMove={onStripMove('sl')}
            onPointerUp={onStripUp('sl')}
            onPointerCancel={onStripUp('sl')}
            className="pointer-events-auto"
            style={{ ...stripCommon('sl'), top: pos.sl - 12, height: 24, background: 'transparent' }}
          >
            <div
              style={{
                position: 'absolute', left: 0, right: 0, top: 11,
                height: 2, background: '#f23645', opacity: 0.9,
              }}
            />
          </div>
        )}
        {typeof pos.tp === 'number' && tp != null && (
          <div
            onPointerDown={onStripDown('tp')}
            onPointerMove={onStripMove('tp')}
            onPointerUp={onStripUp('tp')}
            onPointerCancel={onStripUp('tp')}
            className="pointer-events-auto"
            style={{ ...stripCommon('tp'), top: pos.tp - 12, height: 24, background: 'transparent' }}
          >
            <div
              style={{
                position: 'absolute', left: 0, right: 0, top: 11,
                height: 2, background: '#089981', opacity: 0.9,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
