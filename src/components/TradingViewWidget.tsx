import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { subscribePrices, calcPnl } from '../services/paperTradingService';
import { Maximize2, Minimize2, ChevronUp, ChevronDown } from 'lucide-react';

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

const TIMEFRAMES = [
  { label: '1', value: '1' },
  { label: '5', value: '5' },
  { label: '15', value: '15' },
  { label: '30', value: '30' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' },
  { label: '1M', value: 'M' },
];

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

function fmtPnl(v: number): string {
  return `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`;
}

function PriceLine({ price, label, color, pnlValue, yPos, onRemove, onAdjust, step }: {
  price: number; label: string; color: string; pnlValue?: number; yPos: number;
  onRemove?: () => void; onAdjust?: (p: number) => void; step?: number;
}) {
  const isTp = label === 'TP';
  const isSl = label === 'SL';
  const bg = isTp ? 'bg-emerald-500' : isSl ? 'bg-red-500/90' : color === '#2196F3' ? 'bg-blue-500' : 'bg-orange-500';
  const adj = step || 0.0001;

  return (
    <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${yPos}%` }}>
      <div className="relative w-full h-0">
        <div className="absolute inset-x-0 border-t-2 border-dashed opacity-80" style={{ borderColor: color }} />
        <div className={`absolute right-0 flex items-center gap-0.5 rounded text-[10px] font-black pointer-events-auto ${bg} text-white shadow-lg`} style={{ transform: 'translateY(-50%)' }}>
          {onAdjust && (
            <button onClick={() => onAdjust(price - adj)} className="px-1 py-0.5 hover:bg-white/20 rounded-l text-[9px]">▼</button>
          )}
          <span className="px-1.5 py-0.5 font-mono whitespace-nowrap">{fmt(price)}</span>
          <span className="opacity-80 px-0.5">{label}</span>
          {pnlValue != null && (
            <span className={`px-1 text-[9px] ${pnlValue >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
              {fmtPnl(pnlValue)}
            </span>
          )}
          {onAdjust && (
            <button onClick={() => onAdjust(price + adj)} className="px-1 py-0.5 hover:bg-white/20 text-[9px]">▲</button>
          )}
          {onRemove && (
            <button onClick={onRemove} className="px-1.5 py-0.5 hover:bg-white/20 rounded-r text-[10px] font-bold">×</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, side, category, qty, onCloseTrade, onSlChange, onTpChange }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [interval, setInterval] = useState('60');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasTradeData = entryPrice != null || sl != null || tp != null;
  const isBuy = side === 'buy';
  const tvSymbol = toTvSymbol(symbol);

  const buildUrl = useCallback((sym: string, intv: string) => {
    return `https://www.tradingview.com/widgetembed/?frameElementId=tv_${Date.now()}_f${intv}&symbol=${encodeURIComponent(sym)}&interval=${intv}&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=f0f3fa&studies=[]&theme=dark&style=1&timezone=exchange&locale=en`;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.id = `tv_${Date.now()}`;
    iframe.src = buildUrl(tvSymbol, interval);
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.allowFullscreen = true;
    container.appendChild(iframe);
    return () => { container.innerHTML = ''; };
  }, [tvSymbol, interval, buildUrl]);

  useEffect(() => {
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = subscribePrices([symbol], (sym, price) => {
      if (sym === symbol && price) setCurrentPrice(price);
    });
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [symbol]);

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

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

  const entryStep = entryPrice ? (entryPrice < 10 ? 0.0001 : entryPrice < 1000 ? 0.01 : 0.1) : 0.0001;

  return (
    <div ref={wrapperRef} className={`relative h-full w-full flex flex-col ${isFullscreen ? 'bg-black' : ''}`}>
      {/* Toolbar: Timeframes + Fullscreen */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#0a0f1a] border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-0.5">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.value}
              onClick={() => setInterval(tf.value)}
              className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${
                interval === tf.value
                  ? 'bg-amber-500 text-black'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {hasTradeData && entryPrice && (
            <div className="flex items-center gap-1 mr-2">
              <span className="text-[9px] text-white/40">TP</span>
              <input
                type="text"
                value={tp != null ? fmt(tp) : '--'}
                readOnly
                className="w-16 text-[10px] text-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded px-1 py-0.5 font-mono"
              />
              <span className="text-[9px] text-white/40">SL</span>
              <input
                type="text"
                value={sl != null ? fmt(sl) : '--'}
                readOnly
                className="w-16 text-[10px] text-center bg-red-500/20 text-red-400 border border-red-500/30 rounded px-1 py-0.5 font-mono"
              />
            </div>
          )}
          <button onClick={toggleFullscreen} className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Fullscreen">
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Chart + Price Lines */}
      <div className="flex-1 relative">
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
                {fmtPnl(pnl)}
              </div>
            )}
          </div>
        )}

        {hasTradeData && currentPrice && (
          <div className="absolute inset-0 z-10 pointer-events-none" style={{ top: '5%', bottom: '5%' }}>
            {tp != null && onTpChange && (
              <PriceLine price={tp} label="TP" color="#4CAF50" pnlValue={tpPnl} yPos={priceToY(tp)} step={entryStep} onAdjust={onTpChange} onRemove={onCloseTrade ? () => onTpChange(0) : undefined} />
            )}
            {entryPrice != null && (
              <PriceLine price={entryPrice} label="ENTRY" color={isBuy ? '#2196F3' : '#FF9800'} yPos={priceToY(entryPrice)} />
            )}
            {sl != null && onSlChange && (
              <PriceLine price={sl} label="SL" color="#FF5722" pnlValue={slPnl} yPos={priceToY(sl)} step={entryStep} onAdjust={onSlChange} onRemove={onCloseTrade ? () => onSlChange(0) : undefined} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
