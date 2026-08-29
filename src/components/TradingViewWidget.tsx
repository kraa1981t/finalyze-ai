import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';

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

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, onSlChange, onTpChange }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const priceLinesRef = useRef<Partial<Record<LineKey, any>>>({});
  const draggingRef = useRef<LineKey | null>(null);
  const lastSyncRef = useRef(0);

  const allPropsRef = useRef({ entryPrice, sl, tp, onSlChange, onTpChange });
  allPropsRef.current = { entryPrice, sl, tp, onSlChange, onTpChange };

  const lineDefs = (p = allPropsRef.current) => {
    const defs: { key: LineKey; price: number | null | undefined; color: string; title: string; editable: boolean }[] = [
      { key: 'entry', price: p.entryPrice, color: '#e2e8f0', title: 'Entry', editable: false },
      { key: 'sl', price: p.sl, color: '#ef4444', title: 'Stop Loss', editable: true },
      { key: 'tp', price: p.tp, color: '#22c55e', title: 'Take Profit', editable: true },
    ];
    return defs;
  };

  const updateLines = () => {
    const series = seriesRef.current;
    if (!series) return;
    const pl = priceLinesRef.current;
    for (const def of lineDefs()) {
      const existing = pl[def.key];
      if (def.price != null) {
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
          try { existing.applyOptions({ price: def.price }); } catch {}
        }
      } else if (existing) {
        try { series.removePriceLine(existing); } catch {}
        pl[def.key] = undefined;
      }
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#8b93a7',
        fontFamily: 'inherit',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
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
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch OHLC data whenever the symbol changes.
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;
    let cancelled = false;
    const raw = symbol.includes(':') ? symbol.split(':')[1] : symbol;
    fetch(`/api/market-data?symbol=${encodeURIComponent(raw)}&timeframe=1m`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const result = d?.chart?.result?.[0];
        const ts: number[] | undefined = result?.timestamp;
        const q = result?.indicators?.quote?.[0];
        if (!ts || !q || !q.close) return;
        const candles: any[] = [];
        for (let i = 0; i < ts.length; i++) {
          const o = q.open?.[i];
          const h = q.high?.[i];
          const l = q.low?.[i];
          const c = q.close?.[i];
          if (o == null || h == null || l == null || c == null) continue;
          candles.push({ time: Math.floor(ts[i]), open: o, high: h, low: l, close: c });
        }
        if (!candles.length) return;
        series.setData(candles);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Redraw price lines when entry/sl/tp change.
  useEffect(() => {
    updateLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryPrice, sl, tp]);

  // Drag handling for SL/TP lines.
  useEffect(() => {
    const el = containerRef.current;
    const chart = chartRef.current;
    if (!el || !chart) return;

    const posY = (e: MouseEvent | PointerEvent) => {
      const rect = el.getBoundingClientRect();
      return e.clientY - rect.top;
    };

    const hitTest = (y: number) => {
      const p = allPropsRef.current;
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
        el.setPointerCapture?.(e.pointerId);
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
    const onUp = () => {
      draggingRef.current = null;
    };

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

  return <div ref={containerRef} className="h-full w-full" />;
}
