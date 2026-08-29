import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
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
type IndicatorKey = 'sma20' | 'sma50' | 'volume' | 'rsi';

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

const INDICATORS: { key: IndicatorKey; label: string }[] = [
  { key: 'sma20', label: 'SMA 20' },
  { key: 'sma50', label: 'SMA 50' },
  { key: 'volume', label: 'Vol' },
  { key: 'rsi', label: 'RSI' },
];

function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function rsi(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  out[period] = 100 - (100 / (1 + (loss === 0 ? 0.0000001 : gain / loss)));
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d >= 0 ? d : 0;
    const l = d >= 0 ? 0 : -d;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out[i] = 100 - (100 / (1 + (loss === 0 ? 0.0000001 : gain / loss)));
  }
  return out;
}

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, onSlChange, onTpChange }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const dataRef = useRef<any[]>([]);
  const sma20Ref = useRef<any>(null);
  const sma50Ref = useRef<any>(null);
  const volRef = useRef<any>(null);
  const rsiRef = useRef<any>(null);
  const priceLinesRef = useRef<Partial<Record<LineKey, any>>>({});
  const draggingRef = useRef<LineKey | null>(null);
  const lastSyncRef = useRef(0);
  const [tf, setTf] = useState('5m');
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty'>('loading');
  const [indicators, setIndicators] = useState<Record<IndicatorKey, boolean>>({
    sma20: true, sma50: false, volume: true, rsi: false,
  });

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

  const applyIndicatorVisibility = () => {
    try {
      sma20Ref.current?.applyOptions({ visible: indicators.sma20 });
      sma50Ref.current?.applyOptions({ visible: indicators.sma50 });
      volRef.current?.applyOptions({ visible: indicators.volume });
      rsiRef.current?.applyOptions({ visible: indicators.rsi });
      chartRef.current?.priceScale('vol')?.applyOptions({ visible: indicators.volume });
      chartRef.current?.priceScale('rsi')?.applyOptions({ visible: indicators.rsi });
      chartRef.current?.timeScale()?.fitContent?.();
    } catch {}
  };

  const toggleIndicator = (key: IndicatorKey) => {
    setIndicators((prev) => {
      const v = !prev[key];
      const target = key === 'sma20' ? sma20Ref.current
        : key === 'sma50' ? sma50Ref.current
        : key === 'volume' ? volRef.current
        : rsiRef.current;
      try {
        target?.applyOptions({ visible: v });
        if (key === 'volume') chartRef.current?.priceScale('vol')?.applyOptions({ visible: v });
        if (key === 'rsi') chartRef.current?.priceScale('rsi')?.applyOptions({ visible: v });
      } catch {}
      return { ...prev, [key]: v };
    });
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
      const sma20 = chart.addSeries(LineSeries, {
        color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      const sma50 = chart.addSeries(LineSeries, {
        color: '#60a5fa', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      const vol = chart.addSeries(HistogramSeries, {
        priceScaleId: 'vol', priceFormat: { type: 'volume' },
      });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: true });
      const rsi = chart.addSeries(LineSeries, {
        priceScaleId: 'rsi', color: '#c084fc', lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
      });
      chart.priceScale('rsi').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: true });
      chartRef.current = chart;
      seriesRef.current = series;
      sma20Ref.current = sma20;
      sma50Ref.current = sma50;
      volRef.current = vol;
      rsiRef.current = rsi;
      updateLines();
    } catch {
      return;
    }
    return () => {
      try { chart?.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
      sma20Ref.current = null;
      sma50Ref.current = null;
      volRef.current = null;
      rsiRef.current = null;
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
        const closes = candles.map((c) => c.close);
        const sma20d = sma(closes, 20);
        const sma50d = sma(closes, 50);
        const rsiD = rsi(closes, 14);
        const volD = candles.map((c, i) => ({ time: c.time, value: q.volume?.[i] ?? 0 }));
        try {
          sma20Ref.current?.setData(candles.map((c, i) => ({ time: c.time, value: sma20d[i] })).filter((d) => d.value != null));
          sma50Ref.current?.setData(candles.map((c, i) => ({ time: c.time, value: sma50d[i] })).filter((d) => d.value != null));
          volRef.current?.setData(volD);
          rsiRef.current?.setData(candles.map((c, i) => ({ time: c.time, value: rsiD[i] })).filter((d) => d.value != null));
        } catch {}
        applyIndicatorVisibility();
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
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {INDICATORS.map((ind) => {
          const on = indicators[ind.key];
          return (
            <button
              key={ind.key}
              onClick={() => toggleIndicator(ind.key)}
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide transition-colors ${
                on
                  ? 'bg-[#F59E0B] text-black'
                  : 'bg-white/5 text-brand-text/60 hover:bg-white/15 hover:text-white'
              }`}
              title={ind.label}
            >
              {ind.label}
            </button>
          );
        })}
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
