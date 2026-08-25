import React, { useEffect, useRef, useCallback, useState } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  entryPrice?: number | null;
  sl?: number | null;
  tp?: number | null;
  side?: 'buy' | 'sell' | null;
  onSlChange?: (price: number) => void;
  onTpChange?: (price: number) => void;
}

const DASHED_BG = (color: string) =>
  `repeating-linear-gradient(to right, ${color} 0, ${color} 12px, transparent 12px, transparent 18px)`;

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, side, onSlChange, onTpChange }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'sl' | 'tp' | null>(null);
  const dragDataRef = useRef<{ startY: number; startPrice: number; startPct: number } | null>(null);

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
    if (prices.length === 0) return { entryY: 50, slY: 55, tpY: 45, minP: 0, maxP: 1, range: 1 };
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;
    const map = (price: number) => 15 + ((maxP - price) / range) * 70;
    return {
      entryY: entryPrice != null ? map(entryPrice) : 50,
      slY: sl != null ? map(sl) : 55,
      tpY: tp != null ? map(tp) : 45,
      minP, maxP, range,
    };
  };

  const pos = getLinePositions();

  const yPctToPrice = useCallback((yPct: number) => {
    return pos.maxP - ((yPct - 15) / 70) * pos.range;
  }, [pos.maxP, pos.range]);

  const handleDragStart = useCallback((type: 'sl' | 'tp', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startPrice = type === 'sl' ? (sl ?? 0) : (tp ?? 0);
    const startPct = type === 'sl' ? pos.slY : pos.tpY;
    dragDataRef.current = { startY, startPrice, startPct };
    setDragging(type);
  }, [sl, tp, pos.slY, pos.tpY]);

  useEffect(() => {
    if (!dragging || !dragDataRef.current || !overlayRef.current) return;
    const overlay = overlayRef.current;
    const startY = dragDataRef.current.startY;
    const startPct = dragDataRef.current.startPct;

    const onMove = (e: MouseEvent) => {
      const overlayHeight = overlay.getBoundingClientRect().height;
      const deltaY = e.clientY - startY;
      const deltaPct = (deltaY / overlayHeight) * 100;
      const newPct = startPct + deltaPct;
      const clamped = Math.max(5, Math.min(90, newPct));
      const newPrice = yPctToPrice(clamped);
      if (dragging === 'sl') onSlChange?.(newPrice);
      else onTpChange?.(newPrice);
    };

    const onUp = () => {
      setDragging(null);
      dragDataRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [dragging, yPctToPrice, onSlChange, onTpChange]);

  const isBuy = side === 'buy';

  const entryColor = isBuy ? '#00E676' : '#FF5252';
  const tpColor = '#00E676';
  const tpDark = '#00C853';
  const slColor = '#FF5252';
  const slDark = '#D32F2F';

  const tpBg = DASHED_BG(isBuy ? tpDark : tpColor);
  const slBg = DASHED_BG(isBuy ? slColor : slDark);

  const fmtP = (v: number) => v.toFixed(v < 10 ? 5 : 2);

  return (
    <div className="relative h-full w-full" ref={container}>
      <div className="tv-embed-chart h-full w-full" />

      {hasLines && (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 9999 }} ref={overlayRef}>
          {/* Entry line */}
          {entryPrice != null && (
            <div
              className="absolute left-0 right-0 h-[3px] pointer-events-auto"
              style={{ top: `${pos.entryY}%`, backgroundImage: DASHED_BG(entryColor) }}
            >
              {/* Entry circle */}
              <div
                className="absolute left-1/2 -translate-x-1/2 -translate-y-[1px] w-3 h-3 rounded-full border-2 pointer-events-auto"
                style={{ backgroundColor: entryColor, borderColor: entryColor, boxShadow: `0 0 8px ${entryColor}` }}
              />
              <div className={`absolute right-2 -top-3 px-2 py-0.5 rounded text-[10px] font-black shadow-lg whitespace-nowrap ${isBuy ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
                {isAr ? 'دخول' : 'ENTRY'} {fmtP(entryPrice)}
              </div>
            </div>
          )}

          {/* SL line - draggable */}
          {sl != null && (
            <div
              className="absolute left-0 right-0 h-[3px] pointer-events-auto"
              style={{
                top: `${pos.slY}%`,
                backgroundImage: slBg,
                opacity: dragging === 'sl' ? 1 : 0.85,
              }}
            >
              <div
                className="absolute left-4 -translate-y-1/2 top-1/2 cursor-ns-resize pointer-events-auto flex items-center gap-1"
                onMouseDown={(e) => handleDragStart('sl', e)}
              >
                <div className={`w-8 h-5 rounded flex items-center justify-center text-[9px] font-black ${isBuy ? 'bg-red-500 text-white' : 'bg-[#D32F2F] text-white'}`}>
                  SL
                </div>
                <div className="flex flex-col gap-[1px]">
                  <div className="w-2 h-[2px] bg-white/60 rounded" />
                  <div className="w-2 h-[2px] bg-white/60 rounded" />
                  <div className="w-2 h-[2px] bg-white/60 rounded" />
                </div>
              </div>
              <div className={`absolute right-2 -top-3 px-2 py-0.5 rounded text-[10px] font-black shadow-lg whitespace-nowrap ${isBuy ? 'bg-red-500 text-white' : 'bg-[#D32F2F] text-white'}`}>
                SL {fmtP(sl)}
              </div>
            </div>
          )}

          {/* TP line - draggable */}
          {tp != null && (
            <div
              className="absolute left-0 right-0 h-[3px] pointer-events-auto"
              style={{
                top: `${pos.tpY}%`,
                backgroundImage: tpBg,
                opacity: dragging === 'tp' ? 1 : 0.85,
              }}
            >
              <div
                className="absolute left-4 -translate-y-1/2 top-1/2 cursor-ns-resize pointer-events-auto flex items-center gap-1"
                onMouseDown={(e) => handleDragStart('tp', e)}
              >
                <div className={`w-8 h-5 rounded flex items-center justify-center text-[9px] font-black ${isBuy ? 'bg-[#00C853] text-white' : 'bg-emerald-500 text-black'}`}>
                  TP
                </div>
                <div className="flex flex-col gap-[1px]">
                  <div className="w-2 h-[2px] bg-white/60 rounded" />
                  <div className="w-2 h-[2px] bg-white/60 rounded" />
                  <div className="w-2 h-[2px] bg-white/60 rounded" />
                </div>
              </div>
              <div className={`absolute right-2 -top-3 px-2 py-0.5 rounded text-[10px] font-black shadow-lg whitespace-nowrap ${isBuy ? 'bg-[#00C853] text-white' : 'bg-emerald-500 text-black'}`}>
                TP {fmtP(tp)}
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
