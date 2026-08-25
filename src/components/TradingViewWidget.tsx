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

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, side, onSlChange, onTpChange }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);

  // Initialize TradingView embed widget
  useEffect(() => {
    if (!container.current) return;

    const inner = container.current.querySelector('.tv-embed-chart') as HTMLDivElement;
    if (!inner) return;

    inner.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
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
    });

    inner.appendChild(script);

    return () => { inner.innerHTML = ''; };
  }, [symbol]);

  const hasLines = entryPrice || sl || tp;

  // Calculate relative Y positions for overlay lines
  const getLinePositions = () => {
    const prices = [entryPrice, sl, tp].filter((p): p is number => p != null);
    if (prices.length === 0) return { entryY: 50, slY: 55, tpY: 45 };

    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;

    const map = (price: number) => {
      return 15 + ((maxP - price) / range) * 70;
    };

    return {
      entryY: entryPrice != null ? map(entryPrice) : 50,
      slY: sl != null ? map(sl) : 55,
      tpY: tp != null ? map(tp) : 45,
    };
  };

  const pos = getLinePositions();

  return (
    <div className="relative h-full w-full" ref={container}>
      {/* TradingView embed chart */}
      <div className="tv-embed-chart h-full w-full" />

      {/* Price line overlays */}
      {hasLines && (
        <div className="absolute inset-0 pointer-events-none z-10" style={{ top: 0, right: 0 }}>
          {/* Entry line */}
          {entryPrice != null && (
            <div
              className="absolute left-0 right-0 h-[2px] pointer-events-auto cursor-ew-resize"
              style={{ top: `${pos.entryY}%`, backgroundColor: 'rgba(255,255,255,0.7)' }}
            >
              <div className="absolute right-2 -top-3 px-2 py-0.5 rounded text-[10px] font-black bg-white text-black shadow-lg whitespace-nowrap">
                ENTRY {entryPrice.toFixed(entryPrice < 10 ? 5 : 2)}
              </div>
            </div>
          )}

          {/* Stop Loss line */}
          {sl != null && (
            <div
              className="absolute left-0 right-0 h-[2px] pointer-events-auto cursor-ew-resize"
              style={{ top: `${pos.slY}%`, backgroundColor: 'rgba(255,68,68,0.8)' }}
            >
              <div className="absolute right-2 -top-3 px-2 py-0.5 rounded text-[10px] font-black bg-red-500 text-white shadow-lg whitespace-nowrap">
                SL {sl.toFixed(sl < 10 ? 5 : 2)}
              </div>
            </div>
          )}

          {/* Take Profit line */}
          {tp != null && (
            <div
              className="absolute left-0 right-0 h-[2px] pointer-events-auto cursor-ew-resize"
              style={{ top: `${pos.tpY}%`, backgroundColor: 'rgba(0,255,136,0.8)' }}
            >
              <div className="absolute right-2 -top-3 px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-black shadow-lg whitespace-nowrap">
                TP {tp.toFixed(tp < 10 ? 5 : 2)}
              </div>
            </div>
          )}

          {/* Side indicator */}
          {side && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-auto">
              <div className={`px-3 py-1 rounded-full text-xs font-black shadow-lg ${
                side === 'buy' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'
              }`}>
                {side.toUpperCase()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
