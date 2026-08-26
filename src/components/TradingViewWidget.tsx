import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createChart, CandlestickSeries, IChartApi, ISeriesApi, Time, LineSeries } from 'lightweight-charts';
import { subscribePrices, calcPnl, formatPnl } from '../services/paperTradingService';

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

interface Candle { time: Time; open: number; high: number; low: number; close: number; }

function toYahooSymbol(sym: string): string {
  const s = sym.toUpperCase().trim();
  const map: Record<string, string> = {
    EURUSD: 'EURUSD=X', GBPUSD: 'GBPUSD=X', USDJPY: 'USDJPY=X',
    USDCHF: 'USDCHF=X', AUDUSD: 'AUDUSD=X', NZDUSD: 'NZDUSD=X',
    USDCAD: 'USDCAD=X', EURGBP: 'EURGBP=X', EURJPY: 'EURJPY=X',
    EURCHF: 'EURCHF=X', EURAUD: 'EURAUD=X', EURNZD: 'EURNZD=X',
    EURCAD: 'EURCAD=X', GBPJPY: 'GBPJPY=X', GBPAUD: 'GBPAUD=X',
    GBPNZD: 'GBPNZD=X', GBPCAD: 'GBPCAD=X', GBPCHF: 'GBPCHF=X',
    AUDJPY: 'AUDJPY=X', AUDCAD: 'AUDCAD=X', AUDCHF: 'AUDCHF=X',
    AUDNZD: 'AUDNZD=X', NZDJPY: 'NZDJPY=X', NZDCAD: 'NZDCAD=X',
    NZDCHF: 'NZDCHF=X', CADJPY: 'CADJPY=X', CADCHF: 'CADCHF=X',
    CHFJPY: 'CHFJPY=X', USDTRY: 'USDTRY=X', USDMXN: 'USDMXN=X',
    XAUUSD: 'GC=F', XAGUSD: 'SI=F', GOLD: 'GC=F', SILVER: 'SI=F',
    BTCUSD: 'BTC-USD', ETHUSD: 'ETH-USD',
    US500: '^GSPC', US30: '^DJI', US100: '^IXIC',
    SPY: 'SPY', QQQ: 'QQQ', DXY: 'DX-Y.NYB',
    GLD: 'GLD', SLV: 'SLV', USO: 'USO',
    TSLA: 'TSLA', AAPL: 'AAPL', NVDA: 'NVDA', AMD: 'AMD',
    META: 'META', GOOGL: 'GOOGL', MSFT: 'MSFT', AMZN: 'AMZN',
    NFLX: 'NFLX', DIS: 'DIS', JPM: 'JPM', BA: 'BA',
    JNJ: 'JNJ', WMT: 'WMT', PG: 'PG', KO: 'KO',
    V: 'V', MA: 'MA', UNH: 'UNH', HD: 'HD',
    CRM: 'CRM', ORCL: 'ORCL', ABBV: 'ABBV', LLY: 'LLY',
    MRK: 'MRK', PEP: 'PEP', COST: 'COST', ASML: 'NYSE:ASML',
    TSM: 'TSM', ARM: 'ARM', SMCI: 'SMCI', PLTR: 'NYSE:PLTR',
    COIN: 'COIN', NIO: 'NYSE:NIO', BABA: 'NYSE:BABA',
    INTC: 'INTC', MU: 'MU', QCOM: 'QCOM', CSCO: 'CSCO',
  };
  if (map[s]) return map[s];
  if (s.length === 6) return `${s}=X`;
  return s;
}

async function fetchCandles(yahooSym: string): Promise<Candle[]> {
  const proxies = ['https://corsproxy.io/?', 'https://api.allorigins.win/raw?url='];
  const configs = [
    { range: '3mo', interval: '1d' },
    { range: '1mo', interval: '1h' },
    { range: '5d', interval: '5m' },
  ];
  for (const cfg of configs) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=${cfg.range}&interval=${cfg.interval}`;
    for (const proxy of proxies) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${proxy}${encodeURIComponent(url)}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) continue;
        const json = await res.json();
        const result = json?.chart?.result?.[0];
        if (!result) continue;
        const ts: number[] = result.timestamp || [];
        const q = result.indicators?.quote?.[0];
        if (!q || ts.length === 0) continue;
        const candles: Candle[] = [];
        for (let i = 0; i < ts.length; i++) {
          const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
          if (o != null && h != null && l != null && c != null && !isNaN(c)) {
            candles.push({ time: ts[i] as Time, open: o, high: h, low: l, close: c });
          }
        }
        if (candles.length > 10) return candles;
      } catch {}
    }
  }
  return [];
}

function fmt(price: number): string {
  return price.toFixed(price < 10 ? 5 : 2);
}

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, side, category, qty, onCloseTrade, onSlChange, onTpChange }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const entryLineRef = useRef<any>(null);
  const slLineRef = useRef<any>(null);
  const tpLineRef = useRef<any>(null);
  const candlesRef = useRef<Candle[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  const hasTradeData = entryPrice != null || sl != null || tp != null;

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: { background: { color: '#0a0f1a' }, textColor: '#94a3b8', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.06)' } },
      crosshair: { mode: 0, vertLine: { color: 'rgba(255,255,255,0.3)', width: 1, style: 2, labelBackgroundColor: '#F59E0B' }, horzLine: { color: 'rgba(255,255,255,0.3)', width: 1, style: 2, labelBackgroundColor: '#F59E0B' } },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)', scaleMargins: { top: 0.15, bottom: 0.15 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true, rightOffset: 5 },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350', borderUpColor: '#26a69a', borderDownColor: '#ef5350', wickUpColor: '#26a69a', wickDownColor: '#ef5350', priceLineVisible: false,
    });
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null; };
  }, []);

  // Load data & subscribe per symbol
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    if (unsubRef.current) unsubRef.current();
    candlesRef.current = [];
    series.setData([]);

    const yahooSym = toYahooSymbol(symbol);

    (async () => {
      const candles = await fetchCandles(yahooSym);
      if (candles.length > 0) {
        candlesRef.current = candles;
        series.setData(candles);
        chart.timeScale().fitContent();
      }

      unsubRef.current = subscribePrices([symbol], (sym, price) => {
        if (sym !== symbol || !price) return;
        setCurrentPrice(price);
        const now5m = Math.floor(Date.now() / 300000) * 300 as Time;
        const last = candlesRef.current[candlesRef.current.length - 1];
        if (last && last.time === now5m) {
          last.high = Math.max(last.high, price);
          last.low = Math.min(last.low, price);
          last.close = price;
          series.update(last);
        } else {
          const candle: Candle = { time: now5m, open: price, high: price, low: price, close: price };
          candlesRef.current.push(candle);
          series.update(candle);
        }
      });
    })();

    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [symbol]);

  // Price lines
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Remove old
    try { if (entryLineRef.current) series.removePriceLine(entryLineRef.current); } catch {}
    try { if (slLineRef.current) series.removePriceLine(slLineRef.current); } catch {}
    try { if (tpLineRef.current) series.removePriceLine(tpLineRef.current); } catch {}
    entryLineRef.current = null;
    slLineRef.current = null;
    tpLineRef.current = null;

    if (!hasTradeData) return;

    const isBuy = side === 'buy';

    if (entryPrice != null) {
      entryLineRef.current = series.createPriceLine({
        price: entryPrice,
        color: isBuy ? '#2196F3' : '#FF9800',
        title: ` ● ENTRY ${fmt(entryPrice)} `,
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        axisLabelColor: isBuy ? '#2196F3' : '#FF9800',
      });
    }

    if (sl != null) {
      slLineRef.current = series.createPriceLine({
        price: sl,
        color: '#FF5722',
        title: ` ● SL ${fmt(sl)} `,
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        axisLabelColor: '#FF5722',
      });
    }

    if (tp != null) {
      tpLineRef.current = series.createPriceLine({
        price: tp,
        color: '#4CAF50',
        title: ` ● TP ${fmt(tp)} `,
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        axisLabelColor: '#4CAF50',
      });
    }
  }, [entryPrice, sl, tp, side, hasTradeData]);

  // Compute P&L
  const pnl = (currentPrice && entryPrice && side && category && qty)
    ? calcPnl({ category, symbol, side, qty, entryPrice }, currentPrice)
    : 0;

  const tpPnl = (tp && entryPrice && side && category && qty)
    ? calcPnl({ category, symbol, side, qty, entryPrice }, tp)
    : 0;

  const slPnl = (sl && entryPrice && side && category && qty)
    ? calcPnl({ category, symbol, side, qty, entryPrice }, sl)
    : 0;

  const isBuy = side === 'buy';

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Trade info overlay — TradingView style */}
      {hasTradeData && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-2 pointer-events-auto">
          {side && (
            <div className={`px-2 py-1 rounded text-[10px] font-black ${isBuy ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'}`}>
              {side === 'buy' ? 'شراء' : 'بيع'} {qty}
            </div>
          )}
          {currentPrice && (
            <div className="px-2 py-1 rounded bg-black/60 text-[10px] font-bold text-white/70">
              ${pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
            </div>
          )}
        </div>
      )}

      {/* TP/SL floating labels — TradingView style */}
      {hasTradeData && currentPrice && (
        <div className="absolute right-0 z-20 pointer-events-none" style={{ top: 0, bottom: 0, width: 'auto' }}>
          {/* TP badge */}
          {tp != null && (
            <div className="absolute right-2 pointer-events-auto" style={{ top: '15%' }}>
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/90 text-white text-[10px] font-black shadow-lg">
                <span>+${tpPnl.toFixed(2)}</span>
                {onCloseTrade && (
                  <button onClick={onCloseTrade} className="ml-1 w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-[8px] font-bold">×</button>
                )}
              </div>
            </div>
          )}
          {/* SL badge */}
          {sl != null && (
            <div className="absolute right-2 pointer-events-auto" style={{ bottom: '15%' }}>
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/90 text-white text-[10px] font-black shadow-lg">
                <span>${slPnl.toFixed(2)}</span>
                {onCloseTrade && (
                  <button onClick={onCloseTrade} className="ml-1 w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-[8px] font-bold">×</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
