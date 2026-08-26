import React, { useEffect, useRef, useState, useMemo } from 'react';
import { subscribePrices, calcPnl } from '../services/paperTradingService';

interface TradingViewWidgetProps {
  symbol: string;
  entryPrice?: number | null;
  sl?: number | null;
  tp?: number | null;
  side?: 'buy' | 'sell' | null;
  category?: string;
  qty?: number;
  onCloseTrade?: () => void;
  onSlChange?: (price: number) => void;
  onTpChange?: (price: number) => void;
}

function toTvSymbol(sym: string): string {
  const s = sym.trim().toUpperCase();
  const map: Record<string, string> = {
    EURUSD: 'FX:EURUSD', GBPUSD: 'FX:GBPUSD', USDJPY: 'FX:USDJPY',
    USDCHF: 'FX:USDCHF', AUDUSD: 'FX:AUDUSD', NZDUSD: 'FX:NZDUSD',
    USDCAD: 'FX:USDCAD', EURGBP: 'FX:EURGBP', EURJPY: 'FX:EURJPY',
    EURCHF: 'FX:EURCHF', EURAUD: 'FX:EURAUD', EURNZD: 'FX:EURNZD',
    EURCAD: 'FX:EURCAD', GBPJPY: 'FX:GBPJPY', GBPAUD: 'FX:GBPAUD',
    GBPNZD: 'FX:GBPNZD', GBPCAD: 'FX:GBPCAD', GBPCHF: 'FX:GBPCHF',
    AUDJPY: 'FX:AUDJPY', AUDCAD: 'FX:AUDCAD', AUDCHF: 'FX:AUDCHF',
    AUDNZD: 'FX:AUDNZD', NZDJPY: 'FX:NZDJPY', NZDCAD: 'FX:NZDCAD',
    NZDCHF: 'FX:NZDCHF', CADJPY: 'FX:CADJPY', CADCHF: 'FX:CADCHF',
    CHFJPY: 'FX:CHFJPY', USDTRY: 'FX:USDTRY', USDMXN: 'FX:USDMXN',
    XAUUSD: 'OANDA:XAUUSD', XAGUSD: 'OANDA:XAGUSD', GOLD: 'TVC:GOLD', SILVER: 'TVC:SILVER',
    BTCUSD: 'BINANCE:BTCUSDT', ETHUSD: 'BINANCE:ETHUSDT',
    US500: 'FOREXCOM:SPXUSD', US30: 'FOREXCOM:DJI', US100: 'FOREXCOM:NDXUSD',
    SPY: 'AMEX:SPY', QQQ: 'NASDAQ:QQQ', DXY: 'TVC:DXY',
    GLD: 'NYSEARCA:GLD', SLV: 'NYSEARCA:SLV',
    TSLA: 'NASDAQ:TSLA', AAPL: 'NASDAQ:AAPL', NVDA: 'NASDAQ:NVDA',
    AMD: 'NASDAQ:AMD', META: 'NASDAQ:META', GOOGL: 'NASDAQ:GOOGL',
    MSFT: 'NASDAQ:MSFT', AMZN: 'NASDAQ:AMZN', NFLX: 'NASDAQ:NFLX',
    PLTR: 'NYSE:PLTR', COIN: 'NASDAQ:COIN', NIO: 'NYSE:NIO',
    BABA: 'NYSE:BABA', ARM: 'NASDAQ:ARM', ASML: 'NYSE:ASML',
    TSM: 'NYSE:TSM', SMCI: 'NASDAQ:SMCI',
    JPM: 'NYSE:JPM', V: 'NYSE:V', MA: 'NYSE:MA', JNJ: 'NYSE:JNJ',
    WMT: 'NYSE:WMT', PG: 'NYSE:PG', UNH: 'NYSE:UNH', HD: 'NYSE:HD',
    DIS: 'NYSE:DIS', BA: 'NYSE:BA', CRM: 'NYSE:CRM', ORCL: 'NYSE:ORCL',
    ABBV: 'NYSE:ABBV', LLY: 'NYSE:LLY', MRK: 'NYSE:MRK',
    PEP: 'NASDAQ:PEP', COST: 'NASDAQ:COST', KO: 'NYSE:KO',
    MU: 'NASDAQ:MU', QCOM: 'NASDAQ:QCOM', CSCO: 'NASDAQ:CSCO',
    INTC: 'NASDAQ:INTC',
  };
  if (map[s]) return map[s];
  if (s.includes(':')) return s;
  if (s.length === 6) return `FX:${s}`;
  return s;
}

function fmt(price: number): string {
  return price.toFixed(price < 10 ? 5 : 2);
}

function PriceLine({ price, label, color, pnlValue, yPos, onRemove }: {
  price: number; label: string; color: string; pnlValue?: number; yPos: number; onRemove?: () => void;
}) {
  return (
    <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${yPos}%` }}>
      <div className="relative w-full h-0">
        <div className="absolute inset-0 border-t-2 border-dashed opacity-80" style={{ borderColor: color }} />
        <div className={`absolute right-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black pointer-events-auto ${color === '#4CAF50' ? 'bg-emerald-500 text-white' : color === '#2196F3' ? 'bg-blue-500 text-white' : color === '#FF9800' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'}`} style={{ transform: 'translateY(-50%)' }}>
          <span className="font-mono">{fmt(price)}</span>
          <span className="opacity-80">{label}</span>
          {pnlValue != null && (
            <span className={`ml-1 text-[9px] ${pnlValue >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
              {pnlValue >= 0 ? '+' : ''}${pnlValue.toFixed(2)}
            </span>
          )}
          {onRemove && (
            <button onClick={onRemove} className="ml-0.5 w-3.5 h-3.5 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-[8px] font-bold leading-none">×</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, side, category, qty, onCloseTrade, onSlChange, onTpChange }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  const hasTradeData = entryPrice != null || sl != null || tp != null;
  const isBuy = side === 'buy';
  const tvSymbol = toTvSymbol(symbol);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.id = `tv_${Date.now()}`;
    iframe.src = `https://www.tradingview.com/widgetembed/?frameElementId=${iframe.id}&symbol=${encodeURIComponent(tvSymbol)}&interval=60&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=f0f3fa&studies=[]&theme=dark&style=1&timezone=exchange&locale=en`;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.allowFullscreen = true;
    container.appendChild(iframe);
    return () => { container.innerHTML = ''; };
  }, [tvSymbol]);

  useEffect(() => {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = subscribePrices([symbol], (sym, price) => {
      if (sym === symbol && price) setCurrentPrice(price);
    });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [symbol]);

  const pnl = (currentPrice && entryPrice && side && category && qty)
    ? calcPnl({ category, symbol, side, qty, entryPrice }, currentPrice) : 0;
  const tpPnl = (tp && entryPrice && side && category && qty)
    ? calcPnl({ category, symbol, side, qty, entryPrice }, tp) : 0;
  const slPnl = (sl && entryPrice && side && category && qty)
    ? calcPnl({ category, symbol, side, qty, entryPrice }, sl) : 0;

  const linePositions = useMemo(() => {
    const prices: number[] = [];
    if (currentPrice != null) prices.push(currentPrice);
    if (entryPrice != null) prices.push(entryPrice);
    if (tp != null) prices.push(tp);
    if (sl != null) prices.push(sl);
    if (prices.length < 2) return { min: 0, max: 1, range: 1 };
    const sorted = [...prices].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const pad = Math.max((max - min) * 0.25, (max - min) * 0.05 + 0.0001);
    return { min: min - pad, max: max + pad, range: max - min + pad * 2 };
  }, [currentPrice, entryPrice, tp, sl]);

  const priceToY = (price: number): number => {
    return ((linePositions.max - price) / linePositions.range) * 100;
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {hasTradeData && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-2 pointer-events-auto">
          {side && (
            <div className={`px-2 py-1 rounded text-[10px] font-black ${isBuy ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'}`}>
              {isBuy ? 'BUY' : 'SELL'} {qty} ● {fmt(entryPrice || 0)}
            </div>
          )}
          {currentPrice && (
            <div className={`px-2 py-1 rounded text-[10px] font-bold ${pnl >= 0 ? 'bg-emerald-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
            </div>
          )}
        </div>
      )}

      {hasTradeData && currentPrice && (
        <div className="absolute inset-0 z-10 pointer-events-none" style={{ top: '8%', bottom: '8%' }}>
          {tp != null && (
            <PriceLine price={tp} label="TP" color="#4CAF50" pnlValue={tpPnl} yPos={priceToY(tp)} onRemove={onCloseTrade ? () => onTpChange?.(0) : undefined} />
          )}
          {entryPrice != null && (
            <PriceLine price={entryPrice} label="ENTRY" color={isBuy ? '#2196F3' : '#FF9800'} yPos={priceToY(entryPrice)} />
          )}
          {sl != null && (
            <PriceLine price={sl} label="SL" color="#FF5722" pnlValue={slPnl} yPos={priceToY(sl)} onRemove={onCloseTrade ? () => onSlChange?.(0) : undefined} />
          )}
        </div>
      )}
    </div>
  );
}
