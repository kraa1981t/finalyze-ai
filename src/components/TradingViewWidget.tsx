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
  [key: string]: any;
}

declare global {
  interface Window {
    TradingView?: any;
  }
}

export default function TradingViewWidget({ symbol, entryPrice, sl, tp }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const chartRef = useRef<any>(null);

  const drawLines = (chart: any) => {
    try {
      chart.removeAllShapes();
    } catch {}
    const anchor = Math.floor(Date.now() / 1000);
    const lines = [
      entryPrice != null ? { text: 'Entry', price: entryPrice, color: '#e2e8f0' } : null,
      sl != null ? { text: 'Stop Loss', price: sl, color: '#ef4444' } : null,
      tp != null ? { text: 'Take Profit', price: tp, color: '#10b981' } : null,
    ];
    for (const l of lines) {
      if (!l) continue;
      try {
        chart.createMultipointShape(
          [{ time: anchor, price: l.price }],
          {
            shape: 'horizontal_line',
            lock: true,
            disableSave: true,
            disableUndo: true,
            disableSelection: true,
            text: l.text,
            overrides: {
              linestyle: 2,
              linewidth: 1,
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
        onchartready: () => {
          chartRef.current = widget.chart();
          drawLines(chartRef.current);
        },
      });
      widgetRef.current = widget;
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

    return () => {
      try {
        widget?.remove();
      } catch {}
      chartRef.current = null;
      widgetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useEffect(() => {
    if (chartRef.current) drawLines(chartRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sl, tp, entryPrice]);

  return (
    <div className="tradingview-widget-container h-full w-full" ref={container}>
      <div className="tradingview-widget-container__widget h-full w-full"></div>
    </div>
  );
}
