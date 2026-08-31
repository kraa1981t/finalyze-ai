import React, { useEffect, useRef } from 'react';

interface Props {
  symbol: string; // TradingView format e.g. "BINANCE:BTCUSDT" or "FX:EURUSD"
  interval?: string;
}

export default function TradingViewEmbed({ symbol, interval = '60' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      allow_symbol_change: false,
      calendar: false,
      details: false,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      hide_legend: false,
      hide_volume: false,
      hotlist: false,
      interval,
      locale: 'en',
      save_image: false,
      style: '1',
      symbol,
      theme: 'dark',
      timezone: 'Etc/UTC',
      backgroundColor: '#0b0e14',
      gridColor: 'rgba(255,255,255,0.04)',
      watchlist: [],
      withdateranges: false,
      compareSymbols: [],
      studies: [],
      autosize: true,
    });
    container.appendChild(script);
    return () => { container.innerHTML = ''; };
  }, [symbol, interval]);

  return (
    <div className="w-full h-[380px] rounded-xl overflow-hidden border border-white/10 bg-[#0b0e14]">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
