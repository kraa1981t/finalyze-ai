import React, { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  entryPrice?: number | null;
  sl?: number | null;
  tp?: number | null;
  side?: 'buy' | 'sell' | null;
}

function fmt(price: number): string {
  return price.toFixed(price < 10 ? 5 : 2);
}

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, side }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const linesContainerRef = useRef<HTMLDivElement>(null);
  const hasTradeData = entryPrice != null || sl != null || tp != null;

  // Initialize TradingView embed
  useEffect(() => {
    if (!containerRef.current) return;
    const inner = containerRef.current;
    inner.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'tradingview-widget-container';
    wrapper.style.height = '100%';
    wrapper.style.width = '100%';

    const chartDiv = document.createElement('div');
    chartDiv.className = 'tradingview-widget-container__widget';
    chartDiv.style.height = '100%';
    chartDiv.style.width = '100%';
    wrapper.appendChild(chartDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    });
    wrapper.appendChild(script);
    inner.appendChild(wrapper);

    return () => { inner.innerHTML = ''; };
  }, [symbol]);

  // Only draw lines when trade data exists — no price subscription on main page
  useEffect(() => {
    if (!hasTradeData || !linesContainerRef.current) return;
    const container = linesContainerRef.current;

    const lines: { price: number; color: string; label: string; labelBg: string; labelFg: string }[] = [];
    const isBuy = side === 'buy';

    if (entryPrice != null) {
      lines.push({
        price: entryPrice, color: isBuy ? '#00E676' : '#FF5252',
        label: `ENTRY ${fmt(entryPrice)}`, labelBg: isBuy ? '#00E676' : '#FF5252', labelFg: isBuy ? '#000' : '#fff',
      });
    }
    if (sl != null) {
      lines.push({
        price: sl, color: '#FF1744',
        label: `SL ${fmt(sl)}`, labelBg: '#FF1744', labelFg: '#fff',
      });
    }
    if (tp != null) {
      lines.push({
        price: tp, color: '#00E676',
        label: `TP ${fmt(tp)}`, labelBg: '#00C853', labelFg: '#fff',
      });
    }

    // Simple centered layout for lines
    const prices = lines.map(l => l.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;

    container.innerHTML = '';
    for (const line of lines) {
      const yPct = 15 + ((maxP - line.price) / range) * 70;
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;left:0;right:0;top:${yPct}%;height:2px;pointer-events:none;z-index:10;`;
      el.style.backgroundImage = `repeating-linear-gradient(to right, ${line.color} 0, ${line.color} 12px, transparent 12px, transparent 18px)`;
      const label = document.createElement('div');
      label.style.cssText = `position:absolute;right:8px;top:-12px;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:900;white-space:nowrap;background:${line.labelBg};color:${line.labelFg};`;
      label.textContent = line.label;
      el.appendChild(label);
      container.appendChild(el);
    }
  }, [entryPrice, sl, tp, side, hasTradeData]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {hasTradeData && <div ref={linesContainerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999 }} />}
    </div>
  );
}
