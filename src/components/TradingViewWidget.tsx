import React, { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  entryPrice?: number | null;
  sl?: number | null;
  tp?: number | null;
  side?: 'buy' | 'sell' | null;
}

const DASHED_BG = (color: string) =>
  `repeating-linear-gradient(to right, ${color} 0, ${color} 12px, transparent 12px, transparent 18px)`;

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, side }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);

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
      symbol,
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

  const getLinePositions = () => {
    const prices = [entryPrice, sl, tp].filter((p): p is number => p != null);
    if (prices.length === 0) return { entryY: 50, slY: 55, tpY: 45 };
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;
    const map = (price: number) => 15 + ((maxP - price) / range) * 70;
    return {
      entryY: entryPrice != null ? map(entryPrice) : 50,
      slY: sl != null ? map(sl) : 55,
      tpY: tp != null ? map(tp) : 45,
    };
  };

  const pos = getLinePositions();

  const isBuy = side === 'buy';

  // Colors based on side
  const entryColor = isBuy ? '#00E676' : '#FF5252';
  const tpColor = '#00E676';
  const tpDark = '#00C853';
  const slColor = '#FF5252';
  const slDark = '#D32F2F';

  const entryBg = isBuy ? DASHED_BG(entryColor) : DASHED_BG(entryColor);
  const tpBg = DASHED_BG(isBuy ? tpDark : tpColor);
  const slBg = DASHED_BG(isBuy ? slColor : slDark);

  const entryLabelBg = isBuy ? 'bg-emerald-500' : 'bg-red-500';
  const entryLabelText = isBuy ? 'text-black' : 'text-white';

  return (
    <div className="relative h-full w-full" ref={container}>
      <div className="tv-embed-chart h-full w-full" />

      {hasLines && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999 }}>
          {/* Entry line - green for buy, red for sell */}
          {entryPrice != null && (
            <div
              className="absolute left-0 right-0 h-[3px] pointer-events-auto cursor-ew-resize"
              style={{ top: `${pos.entryY}%`, backgroundImage: entryBg }}
            >
              <div className={`absolute right-2 -top-3 px-2 py-0.5 rounded text-[10px] font-black shadow-lg whitespace-nowrap ${entryLabelBg} ${entryLabelText}`}>
                ENTRY {entryPrice.toFixed(entryPrice < 10 ? 5 : 2)}
              </div>
            </div>
          )}

          {/* SL line - always red, different shade */}
          {sl != null && (
            <div
              className="absolute left-0 right-0 h-[3px] pointer-events-auto cursor-ew-resize"
              style={{ top: `${pos.slY}%`, backgroundImage: slBg }}
            >
              <div className={`absolute right-2 -top-3 px-2 py-0.5 rounded text-[10px] font-black shadow-lg whitespace-nowrap ${isBuy ? 'bg-red-500 text-white' : 'bg-[#D32F2F] text-white'}`}>
                SL {sl.toFixed(sl < 10 ? 5 : 2)}
              </div>
            </div>
          )}

          {/* TP line - always green, different shade */}
          {tp != null && (
            <div
              className="absolute left-0 right-0 h-[3px] pointer-events-auto cursor-ew-resize"
              style={{ top: `${pos.tpY}%`, backgroundImage: tpBg }}
            >
              <div className={`absolute right-2 -top-3 px-2 py-0.5 rounded text-[10px] font-black shadow-lg whitespace-nowrap ${isBuy ? 'bg-[#00C853] text-white' : 'bg-emerald-500 text-black'}`}>
                TP {tp.toFixed(tp < 10 ? 5 : 2)}
              </div>
            </div>
          )}

          {/* Side badge */}
          {side && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-auto">
              <div className={`px-3 py-1 rounded-full text-xs font-black shadow-lg ${
                isBuy ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'
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
