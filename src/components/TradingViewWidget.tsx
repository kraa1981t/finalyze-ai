import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
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

const DRAW_TOOLS = [
  { id: 'cursor', label: 'مؤشر', icon: '↖' },
  { id: 'hline', label: 'أفقي', icon: '─' },
  { id: 'vline', label: 'عمودي', icon: '│' },
  { id: 'trend', label: 'اتجاه', icon: '╱' },
  { id: 'arrow', label: 'سهم', icon: '➤' },
  { id: 'rect', label: 'مستطيل', icon: '▭' },
  { id: 'fib', label: 'فيبو', icon: '≋' },
];

const INDICATORS = [
  { id: 'sma20', label: 'SMA 20' },
  { id: 'sma50', label: 'SMA 50' },
  { id: 'ema20', label: 'EMA 20' },
  { id: 'rsi', label: 'RSI' },
  { id: 'bb', label: 'Bollinger' },
  { id: 'vol', label: 'Volume' },
];

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, onSlChange, onTpChange, openedAt }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const dataRef = useRef<any[]>([]);
  const priceLinesRef = useRef<Partial<Record<LineKey, any>>>({});
  const draggingRef = useRef<LineKey | null>(null);
  const [tf, setTf] = useState('1h');
  const [positions, setPositions] = useState<{ sl?: number; tp?: number }>({});
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty'>('loading');

  // new UI states
  const [activeTool, setActiveTool] = useState('cursor');
  const [drawLines, setDrawLines] = useState<any[]>([]);
  const drawLinesRef = useRef<any[]>([]);
  drawLinesRef.current = drawLines;
  const [activeIndicators, setActiveIndicators] = useState<Record<string, boolean>>({});
  const [starPos, setStarPos] = useState<{ x: number; y: number } | null>(null);
  const indicatorSeriesRef = useRef<Record<string, any>>({});

  const allPropsRef = useRef({ entryPrice, sl, tp, onSlChange, onTpChange, openedAt });
  allPropsRef.current = { entryPrice, sl, tp, onSlChange, onTpChange, openedAt };

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

  const syncPositions = () => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    requestAnimationFrame(() => {
      const next: { sl?: number; tp?: number } = {};
      for (const k of ['sl', 'tp'] as const) {
        const price = k === 'sl' ? allPropsRef.current.sl : allPropsRef.current.tp;
        if (price == null) continue;
        try {
          const y = series.priceToCoordinate(price);
          if (typeof y === 'number' && isFinite(y)) next[k] = y;
        } catch {}
      }
      setPositions((prev) => {
        if (Object.keys(next).length === 0) return prev;
        return { ...prev, ...next };
      });
      // star position
      const ep = allPropsRef.current.entryPrice;
      const at = allPropsRef.current.openedAt;
      if (ep != null && at != null && series) {
        try {
          const y = series.priceToCoordinate(ep);
          const t = Math.floor(at / 1000) as any;
          const x = chart.timeScale().timeToCoordinate(t);
          if (typeof y === 'number' && typeof x === 'number' && isFinite(y) && isFinite(x) && x > 0) {
            setStarPos({ x, y });
          } else if (typeof y === 'number' && isFinite(y)) {
            // fallback: if time out of range, place near left side at entry price level
            setStarPos({ x: 80, y });
          } else setStarPos(null);
        } catch { setStarPos(null); }
      } else setStarPos(null);
    });
  };

  // indicator helpers
  const calcSMA = (data: any[], len: number) => {
    const out: any[] = [];
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i].close;
      if (i >= len) sum -= data[i - len].close;
      if (i >= len - 1) out.push({ time: data[i].time, value: sum / len });
    }
    return out;
  };
  const applyIndicators = () => {
    const chart = chartRef.current;
    const data = dataRef.current;
    if (!chart || !data.length) return;
    // remove old
    Object.values(indicatorSeriesRef.current).forEach((s: any) => { try { chart.removeSeries(s); } catch {} });
    indicatorSeriesRef.current = {};
    if (activeIndicators['sma20']) {
      const s = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      s.setData(calcSMA(data, 20)); indicatorSeriesRef.current['sma20'] = s;
    }
    if (activeIndicators['sma50']) {
      const s = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      s.setData(calcSMA(data, 50)); indicatorSeriesRef.current['sma50'] = s;
    }
    if (activeIndicators['ema20']) {
      const out: any[] = []; let ema = data[0]?.close || 0; const k = 2 / (20 + 1);
      for (let i = 0; i < data.length; i++) { ema = i === 0 ? data[i].close : data[i].close * k + ema * (1 - k); out.push({ time: data[i].time, value: ema }); }
      const s = chart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
      s.setData(out); indicatorSeriesRef.current['ema20'] = s;
    }
  };
  useEffect(() => { applyIndicators(); }, [activeIndicators]);

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
      syncPositions();
      try {
        chart.timeScale().subscribeVisibleTimeRangeChange(syncPositions);
        chart.priceScale('right').subscribeSizeInvalidated(syncPositions);
      } catch {}
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
        syncPositions();
        applyIndicators();
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
    syncPositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryPrice, sl, tp, openedAt]);

  // drag SL/TP lines with mouse (window-based)
  useEffect(() => {
    const el = containerRef.current;
    const getSeries = () => seriesRef.current;
    if (!el) return;
    const posY = (e: MouseEvent | PointerEvent) => e.clientY - el.getBoundingClientRect().top;
    const lineYFor = (def: { key: LineKey; price?: number | null }): number | null => {
      if (def.price == null) return null;
      try {
        const y = getSeries()?.priceToCoordinate(def.price);
        if (typeof y === 'number' && isFinite(y)) return y;
      } catch {}
      return null;
    };
    const hitTest = (y: number) => {
      let best: LineKey | null = null;
      let bestDist = 24;
      for (const def of lineDefs()) {
        if (!def.editable) continue;
        const lineY = lineYFor(def);
        if (lineY != null) {
          const d = Math.abs(lineY - y);
          if (d < bestDist) { bestDist = d; best = def.key; }
        }
      }
      return best;
    };
    const nearestForCursor = (y: number) => {
      for (const def of lineDefs()) {
        if (!def.editable) continue;
        const lineY = lineYFor(def);
        if (lineY != null && Math.abs(lineY - y) <= 12) return true;
      }
      return false;
    };
    const onDown = (e: PointerEvent) => {
      if (activeTool !== 'cursor') return;
      if (e.button !== 0) return;
      const y = posY(e);
      const key = hitTest(y);
      if (key) {
        draggingRef.current = key;
        el.style.cursor = 'ns-resize';
        try { e.preventDefault(); } catch {}
      }
    };
    const onMove = (e: PointerEvent | MouseEvent) => {
      const k = draggingRef.current;
      if (k) {
        const y = posY(e);
        let price: number | null = null;
        try { price = getSeries()?.coordinateToPrice(y) as number | null; } catch {}
        if (price == null || !isFinite(price)) return;
        try { priceLinesRef.current[k]?.applyOptions({ price }); } catch {}
        setPositions((prev) => ({ ...prev, [k]: y }));
        const p = allPropsRef.current;
        if (k === 'sl' && p.onSlChange) p.onSlChange(price);
        else if (k === 'tp' && p.onTpChange) p.onTpChange(price);
      } else {
        try { el.style.cursor = nearestForCursor(posY(e)) ? 'ns-resize' : 'crosshair'; } catch {}
      }
    };
    const onUp = () => {
      draggingRef.current = null;
      el.style.cursor = 'crosshair';
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  // overlay handle drag
  const handleDrag = useRef<LineKey | null>(null);
  const onHandleDown = (key: LineKey) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    handleDrag.current = key;
    draggingRef.current = key;
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch {}
  };
  const onHandleUp = (key: LineKey) => (e: React.PointerEvent) => {
    if (handleDrag.current === key) handleDrag.current = null;
    draggingRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.((e as any).pointerId); } catch {}
  };
  useEffect(() => {
    const onWinMove = (e: PointerEvent) => {
      const k = handleDrag.current || draggingRef.current;
      if (!k) return;
      const s = seriesRef.current;
      const ov = overlayRef.current;
      const el = containerRef.current;
      const target = ov || el;
      if (!s || !target) return;
      const y = e.clientY - target.getBoundingClientRect().top;
      let price: number | null = null;
      try { price = s.coordinateToPrice(y) as number | null; } catch {}
      if (price == null || !isFinite(price)) return;
      try { priceLinesRef.current[k]?.applyOptions({ price }); } catch {}
      setPositions((prev) => ({ ...prev, [k]: y }));
      const p = allPropsRef.current;
      if (k === 'sl' && p.onSlChange) p.onSlChange(price);
      else if (k === 'tp' && p.onTpChange) p.onTpChange(price);
    };
    const onWinUp = () => {
      handleDrag.current = null;
      draggingRef.current = null;
    };
    window.addEventListener('pointermove', onWinMove, true);
    window.addEventListener('pointerup', onWinUp, true);
    window.addEventListener('pointercancel', onWinUp, true);
    return () => {
      window.removeEventListener('pointermove', onWinMove, true);
      window.removeEventListener('pointerup', onWinUp, true);
      window.removeEventListener('pointercancel', onWinUp, true);
    };
  }, []);

  // drawing tools click on chart
  const onChartClick = (e: React.MouseEvent) => {
    if (activeTool === 'cursor') return;
    const s = seriesRef.current;
    const el = containerRef.current;
    if (!s || !el) return;
    const y = e.clientY - el.getBoundingClientRect().top;
    const x = e.clientX - el.getBoundingClientRect().left;
    let price: number | null = null;
    try { price = s.coordinateToPrice(y) as number | null; } catch {}
    if (activeTool === 'hline' && price != null) {
      const id = Date.now().toString();
      try {
        const pl = s.createPriceLine({ price, color: '#60a5fa', lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: 'H' });
        setDrawLines((prev) => [...prev, { id, type: 'hline', price, line: pl }]);
      } catch {}
    } else if (activeTool === 'vline') {
      // vertical line simulated as price line with time marker - use overlay rect
      setDrawLines((prev) => [...prev, { id: Date.now().toString(), type: 'vline', x }]);
    } else if (activeTool === 'arrow') {
      setDrawLines((prev) => [...prev, { id: Date.now().toString(), type: 'arrow', x, y }]);
    }
  };

  const clearDrawings = () => {
    const s = seriesRef.current;
    drawLines.forEach((d) => { if (d.line) try { s.removePriceLine(d.line); } catch {} });
    setDrawLines([]);
  };

  const scrollBy = (dir: number) => {
    try { const ts = chartRef.current?.timeScale(); const range = ts.getVisibleRange(); if (!range) return; const size = range.to - range.from; ts.setVisibleRange({ from: range.from + dir * size * 0.2, to: range.to + dir * size * 0.2 }); } catch {}
  };
  const resetView = () => { try { chartRef.current?.timeScale()?.fitContent(); chartRef.current?.timeScale()?.scrollToRealTime(); syncPositions(); } catch {} };

  return (
    <div className="relative h-full w-full flex flex-col">
      {/* top toolbar: timeframe x2 + drawing tools */}
      <div className="flex items-center justify-between gap-2 px-1 py-1 bg-[#0b0e14] border-b border-white/5">
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`px-4 py-1.5 rounded text-sm font-black uppercase tracking-wide transition-colors ${
                tf === t ? 'bg-[#F59E0B] text-black' : 'bg-white/5 text-brand-text/60 hover:bg-white/15 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {DRAW_TOOLS.map((tl) => (
            <button
              key={tl.id}
              onClick={() => setActiveTool(tl.id)}
              title={tl.label}
              className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold border ${activeTool === tl.id ? 'bg-[#F59E0B] text-black border-[#F59E0B]' : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'}`}
            >
              {tl.icon}
            </button>
          ))}
          <button onClick={clearDrawings} title="مسح الرسم" className="w-8 h-8 rounded flex items-center justify-center text-xs bg-white/5 border border-white/10 text-white/60 hover:bg-white/10">✕</button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* left indicators tab */}
        <div className="w-10 bg-[#0b0e14] border-r border-white/5 flex flex-col items-center py-2 gap-1">
          <div className="text-[8px] font-black text-white/40 tracking-widest mb-1">المؤشرات</div>
          {INDICATORS.map((ind) => (
            <button
              key={ind.id}
              onClick={() => setActiveIndicators((p) => ({ ...p, [ind.id]: !p[ind.id] }))}
              title={ind.label}
              className={`w-8 h-8 rounded text-[8px] font-black leading-tight flex items-center justify-center border ${activeIndicators[ind.id] ? 'bg-[#F59E0B] text-black border-[#F59E0B]' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}`}
            >
              {ind.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-0">
          {status === 'empty' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <span className="text-sm font-bold text-brand-text/40 bg-black/60 px-4 py-2 rounded-lg">
                {symbol} — لا توجد بيانات / no data
              </span>
            </div>
          )}
          <div ref={containerRef} className="h-full w-full" style={{ touchAction: 'none', userSelect: 'none' }} onClick={onChartClick} />
          {/* overlay handles */}
          <div ref={overlayRef} className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 15 }}>
            {typeof positions.sl === 'number' && sl != null && (
              <div onPointerDown={onHandleDown('sl')} onPointerUp={onHandleUp('sl')} onPointerCancel={onHandleUp('sl')} title="اسحب SL" style={{ position: 'absolute', left: 0, right: 36, top: positions.sl - 20, height: 40, pointerEvents: 'auto', cursor: 'ns-resize', background: 'transparent' }} />
            )}
            {typeof positions.tp === 'number' && tp != null && (
              <div onPointerDown={onHandleDown('tp')} onPointerUp={onHandleUp('tp')} onPointerCancel={onHandleUp('tp')} title="اسحب TP" style={{ position: 'absolute', left: 0, right: 36, top: positions.tp - 20, height: 40, pointerEvents: 'auto', cursor: 'ns-resize', background: 'transparent' }} />
            )}
            {/* vertical line drawings */}
            {drawLines.filter((d) => d.type === 'vline').map((d) => (
              <div key={d.id} style={{ position: 'absolute', left: d.x, top: 0, bottom: 0, width: 1, background: '#60a5fa', opacity: 0.8, pointerEvents: 'none' }} />
            ))}
            {drawLines.filter((d) => d.type === 'arrow').map((d) => (
              <div key={d.id} style={{ position: 'absolute', left: d.x - 10, top: d.y - 10, pointerEvents: 'none', color: '#f59e0b', fontSize: 20 }}>➤</div>
            ))}
            {/* yellow flashing star at entry */}
            {starPos && entryPrice != null && (
              <div style={{ position: 'absolute', left: starPos.x - 14, top: starPos.y - 14, pointerEvents: 'none', zIndex: 25 }}>
                <div className="relative w-7 h-7 flex items-center justify-center">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75 animate-ping" />
                  <span className="relative text-yellow-400 text-xl leading-none drop-shadow-[0_0_6px_rgba(250,204,21,0.9)]">★</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* bottom nav: scroll back/forward/reset */}
      <div className="flex items-center justify-center gap-3 py-1.5 bg-[#0b0e14] border-t border-white/5">
        <button onClick={() => scrollBy(-1)} title="للخلف" className="w-10 h-8 rounded bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center text-lg">←</button>
        <button onClick={() => scrollBy(1)} title="للأمام" className="w-10 h-8 rounded bg-white/5 border border-white/10 text-white hover:bg-white/10 flex items-center justify-center text-lg">→</button>
        <button onClick={resetView} title="إعادة الضبط" className="w-10 h-8 rounded bg-[#F59E0B] text-black font-black flex items-center justify-center text-lg">↻</button>
      </div>
    </div>
  );
}
