import React, { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  entryPrice?: number | null;
  sl?: number | null;
  tp?: number | null;
  side?: 'buy' | 'sell' | null;
  onSlChange?: (price: number) => void;
  onTpChange?: (price: number) => void;
}

declare global {
  interface Window {
    TradingView: any;
  }
}

let tvScriptLoaded = false;

function loadTradingViewScript(): Promise<void> {
  if (tvScriptLoaded && window.TradingView) return Promise.resolve();
  return new Promise((resolve) => {
    if (document.getElementById('tradingview-widget-script')) {
      const check = () => {
        if (window.TradingView) { tvScriptLoaded = true; resolve(); }
        else setTimeout(check, 100);
      };
      check();
      return;
    }
    const script = document.createElement('script');
    script.id = 'tradingview-widget-script';
    script.src = 'https://s3.tradingview.com/tv-widget.js';
    script.async = true;
    script.onload = () => {
      const check = () => {
        if (window.TradingView) { tvScriptLoaded = true; resolve(); }
        else setTimeout(check, 100);
      };
      check();
    };
    document.head.appendChild(script);
  });
}

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, side }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const chartReadyRef = useRef(false);
  const priceLinesRef = useRef<any[]>([]);

  // Initialize
  useEffect(() => {
    let disposed = false;

    (async () => {
      await loadTradingViewScript();
      if (disposed || !containerRef.current || !window.TradingView) return;

      const containerId = `tv_chart_${Math.random().toString(36).slice(2, 9)}`;
      containerRef.current.id = containerId;
      containerRef.current.innerHTML = '';

      const widget = new window.TradingView.widget({
        container_id: containerId,
        autosize: true,
        symbol: symbol,
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        enable_publishing: false,
        allow_symbol_change: true,
        calendar: false,
        support_host: 'https://www.tradingview.com',
        overrides: {
          'mainSeriesProperties.candleStyle.upColor': '#26a69a',
          'mainSeriesProperties.candleStyle.downColor': '#ef5350',
          'mainSeriesProperties.candleStyle.borderUpColor': '#26a69a',
          'mainSeriesProperties.candleStyle.borderDownColor': '#ef5350',
        },
      });

      widgetRef.current = widget;

      widget.onChartReady(() => {
        if (disposed) return;
        chartReadyRef.current = true;
        updatePriceLines(entryPrice, sl, tp, side);
      });
    })();

    return () => {
      disposed = true;
      chartReadyRef.current = false;
      widgetRef.current = null;
      priceLinesRef.current = [];
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [symbol]);

  // Update price lines when props change
  function updatePriceLines(
    entry: number | null | undefined,
    stopLoss: number | null | undefined,
    takeProfit: number | null | undefined,
    tradeSide: 'buy' | 'sell' | null | undefined,
  ) {
    const widget = widgetRef.current;
    if (!widget || !chartReadyRef.current) return;

    try {
      const chart = widget.activeChart();
      if (!chart) return;

      // Remove old lines
      for (const line of priceLinesRef.current) {
        try { chart.removePriceLine(line); } catch {}
      }
      priceLinesRef.current = [];

      const isBuy = tradeSide === 'buy';

      // Entry price line
      if (entry != null) {
        const entryLine = chart.createPriceLine({
          price: entry,
          color: isBuy ? '#00E676' : '#FF5252',
          title: isAr(entry) ? ` ENTRY ${fmt(entry)} ` : ` ENTRY ${fmt(entry)} `,
          lineWidth: 2,
          lineStyle: window.TradingView.LineStyle.Dashed,
          axisLabelVisible: true,
          axisLabelColor: isBuy ? '#00E676' : '#FF5252',
        });
        priceLinesRef.current.push(entryLine);
      }

      // Stop Loss
      if (stopLoss != null) {
        const slLine = chart.createPriceLine({
          price: stopLoss,
          color: '#FF1744',
          title: ` SL ${fmt(stopLoss)} `,
          lineWidth: 2,
          lineStyle: window.TradingView.LineStyle.Dashed,
          axisLabelVisible: true,
          axisLabelColor: '#FF1744',
        });
        priceLinesRef.current.push(slLine);
      }

      // Take Profit
      if (takeProfit != null) {
        const tpLine = chart.createPriceLine({
          price: takeProfit,
          color: '#00E676',
          title: ` TP ${fmt(takeProfit)} `,
          lineWidth: 2,
          lineStyle: window.TradingView.LineStyle.Dashed,
          axisLabelVisible: true,
          axisLabelColor: '#00E676',
        });
        priceLinesRef.current.push(tpLine);
      }
    } catch (e) {
      console.warn('Price line error:', e);
    }
  }

  // React to prop changes
  useEffect(() => {
    if (chartReadyRef.current) {
      updatePriceLines(entryPrice, sl, tp, side);
    }
  }, [entryPrice, sl, tp, side]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

function isAr(price: number): boolean {
  return price < 10;
}

function fmt(price: number): string {
  return price.toFixed(price < 10 ? 5 : 2);
}
