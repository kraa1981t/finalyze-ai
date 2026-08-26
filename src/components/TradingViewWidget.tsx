import React, { useEffect, useRef, useState } from 'react';
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

    const embedUrl = `https://www.tradingview.com/widgetembed/?frameElementId=tv_${Date.now()}&symbol=${encodeURIComponent(tvSymbol)}&interval=60&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=f0f3fa&studies=[]&theme=dark&style=1&timezone=exchange&locale=en`;

    const iframe = document.createElement('iframe');
    iframe.id = `tv_${Date.now()}`;
    iframe.src = embedUrl;
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
        <div className="absolute top-2 right-2 z-20 flex flex-col gap-1.5 pointer-events-auto">
          {tp != null && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/90 text-white text-[10px] font-black shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              <span>TP {fmt(tp)}</span>
              <span className="text-emerald-200">+${tpPnl.toFixed(2)}</span>
              {onCloseTrade && (
                <button onClick={() => onTpChange?.(0)} className="ml-1 w-3.5 h-3.5 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-[7px] font-bold">×</button>
              )}
            </div>
          )}
          {entryPrice != null && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/80 text-white text-[10px] font-black shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />
              <span>ENTRY {fmt(entryPrice)}</span>
            </div>
          )}
          {sl != null && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/90 text-white text-[10px] font-black shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-red-300" />
              <span>SL {fmt(sl)}</span>
              <span className="text-red-200">${slPnl.toFixed(2)}</span>
              {onCloseTrade && (
                <button onClick={() => onSlChange?.(0)} className="ml-1 w-3.5 h-3.5 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-[7px] font-bold">×</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
