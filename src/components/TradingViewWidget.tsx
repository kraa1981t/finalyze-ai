import React, { useEffect, useRef } from 'react';

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

declare global {
  interface Window {
    TradingView?: any;
  }
}

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, onSlChange, onTpChange }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const lastSyncRef = useRef(0);
  const lastEmitRef = useRef<{ kind: 'sl' | 'tp'; price: number } | null>(null);

  // Always read the latest prop values via refs (closure-safe), so drawing
  // after the chart becomes ready uses the current trade data.
  const entryRef = useRef<number | null | undefined>(entryPrice);
  const slRef = useRef<number | null | undefined>(sl);
  const tpRef = useRef<number | null | undefined>(tp);
  entryRef.current = entryPrice;
  slRef.current = sl;
  tpRef.current = tp;

  const refreshLines = () => {
    const chart = chartRef.current;
    if (!chart) return;
    try {
      chart.removeAllShapes();
    } catch {}
    const entry = entryRef.current;
    const slv = slRef.current;
    const tpv = tpRef.current;
    // Anchor each line to the current bar's open time so it isn't cut off.
    const anchor = Math.floor(Date.now() / 1000 / 86400) * 86400;
    const lines = [
      entry != null ? { text: 'Entry', price: entry, color: '#e2e8f0' } : null,
      slv != null ? { text: 'Stop Loss', price: slv, color: '#ef4444' } : null,
      tpv != null ? { text: 'Take Profit', price: tpv, color: '#10b981' } : null,
    ];
    for (const l of lines) {
      if (!l) continue;
      try {
        chart.createMultipointShape(
          [{ time: anchor, price: l.price }],
          {
            shape: 'horizontal_line',
            lock: false,
            disableSave: true,
            disableUndo: true,
            disableSelection: false,
            text: l.text,
            zOrder: 'top',
            overrides: {
              linestyle: 2,
              linewidth: 2,
              linecolor: l.color,
              showPriceRange: true,
              extendLeft: true,
              extendRight: true,
            },
          }
        );
      } catch {}
    }
  };

  // Retry drawing until the chart is ready (cover race with onchartready).
  const tryDraw = (attempt = 0) => {
    if (chartRef.current) {
      refreshLines();
      return;
    }
    if (attempt < 20) {
      setTimeout(() => tryDraw(attempt + 1), 250);
    }
  };

  // Handle a drawing (line) being moved on the chart and sync it to the trade.
  const handleDrawing = (sourceOrEvent: any, maybeEvent?: any) => {
    const source = sourceOrEvent?.source ?? sourceOrEvent;
    if (!source || typeof source.getPoints !== 'function') return;
    let points: any;
    try {
      points = source.getPoints();
    } catch {
      return;
    }
    const price = Array.isArray(points) && points.length ? points[0]?.price : undefined;
    if (price == null) return;
    let text = '';
    try {
      text = typeof source.getText === 'function' ? source.getText() : '';
    } catch {}

    const now = Date.now();
    if (now - lastSyncRef.current < 250) return;
    lastSyncRef.current = now;

    const changed = lastEmitRef.current;
    if (text === 'Stop Loss' && onSlChange && (!changed || changed.kind !== 'sl' || Math.abs(changed.price - price) > 0.000001)) {
      lastEmitRef.current = { kind: 'sl', price };
      onSlChange(price);
    } else if (text === 'Take Profit' && onTpChange && (!changed || changed.kind !== 'tp' || Math.abs(changed.price - price) > 0.000001)) {
      lastEmitRef.current = { kind: 'tp', price };
      onTpChange(price);
    }
  };

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = '';
    const el = container.current;
    if (!el.id) el.id = 'tv-' + Math.random().toString(36).slice(2, 9);

    let widget: any;

    const init = () => {
      if (!window.TradingView) return;
      widget = new window.TradingView.widget({
        container_id: el.id,
        symbol,
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#131722',
        enable_publishing: false,
        allow_symbol_change: true,
        autosize: true,
      });
      // Use the documented onChartReady method so chart() is available.
      widget.onChartReady(() => {
        if (!widget.chart) return;
        try {
          chartRef.current = widget.chart();
        } catch {
          return;
        }
        try {
          chartRef.current.onDrawingLineEvent(handleDrawing);
        } catch {}
        refreshLines();
      });
    };

    if (window.TradingView) {
      init();
    } else {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = init;
      document.head.appendChild(script);
    }

    // Cover the case where the trade is opened before the chart finished loading.
    const retry = setTimeout(() => tryDraw(0), 800);

    return () => {
      clearTimeout(retry);
      try {
        widget?.remove();
      } catch {}
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // Redraw when SL/TP values change externally, but skip briefly after a drag.
  useEffect(() => {
    if (!chartRef.current) return;
    if (Date.now() - lastSyncRef.current < 600) return;
    refreshLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sl, tp, entryPrice]);

  return (
    <div className="tradingview-widget-container h-full w-full" ref={container}>
      <div className="tradingview-widget-container__widget h-full w-full"></div>
    </div>
  );
}
