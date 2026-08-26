import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, LineSeries, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { subscribePrices } from '../services/paperTradingService';

interface TradingViewWidgetProps {
  symbol: string;
  entryPrice?: number | null;
  sl?: number | null;
  tp?: number | null;
  side?: 'buy' | 'sell' | null;
}

interface Candle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
}

function fmt(price: number): string {
  return price.toFixed(price < 10 ? 5 : 2);
}

function symbolToFmp(sym: string): string {
  const s = sym.toUpperCase();
  if (s.endsWith('USD') && s.length === 6 && !s.startsWith('XAU') && !s.startsWith('XAG')) return s;
  if (s === 'BTCUSD' || s === 'ETHUSD') return s;
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
    XAUUSD: 'GC=F', XAGUSD: 'SI=F',
  };
  if (map[s]) return map[s];
  if (s.length === 6 && !s.includes(':') && !s.includes('USD')) return `${s.slice(0,3)}USD=X`;
  return sym;
}

async function fetchCandles(tvSymbol: string, range: string, interval: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(tvSymbol)}?interval=${interval}&range=${range}`;
  const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(proxy);
    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const ts = result.timestamp;
    const ohlcv = result.indicators?.quote?.[0];
    if (!ts || !ohlcv) return [];
    const candles: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const o = ohlcv.open?.[i];
      const h = ohlcv.high?.[i];
      const l = ohlcv.low?.[i];
      const c = ohlcv.close?.[i];
      if (o != null && h != null && l != null && c != null) {
        candles.push({ time: ts[i] as Time, open: o, high: h, low: l, close: c });
      }
    }
    return candles;
  } catch {
    return [];
  }
}

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, side }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const linesRef = useRef<any[]>([]);
  const candlesRef = useRef<Candle[]>([]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: '#0a0f1a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(255,255,255,0.3)', width: 1, style: 2, labelBackgroundColor: '#F59E0B' },
        horzLine: { color: 'rgba(255,255,255,0.3)', width: 1, style: 2, labelBackgroundColor: '#F59E0B' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    seriesRef.current = series;

    // Resize handler
    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      candlesRef.current = [];
      linesRef.current = [];
    };
  }, []);

  // Load data & subscribe when symbol changes
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    candlesRef.current = [];
    series.setData([]);

    // Clear old price lines
    for (const line of linesRef.current) {
      try { series.removePriceLine(line); } catch {}
    }
    linesRef.current = [];

    const fmpSym = symbolToFmp(symbol);

    // Fetch candles
    (async () => {
      const candles = await fetchCandles(fmpSym, '3mo', '1d');
      if (candles.length > 0) {
        candlesRef.current = candles;
        series.setData(candles);
        chart.timeScale().fitContent();
      } else {
        // Fallback: build from live price
        const sub = subscribePrices([symbol], (sym, price) => {
          if (sym !== symbol) return;
          const now = Math.floor(Date.now() / 60000) * 60 as Time;
          const last = candlesRef.current[candlesRef.current.length - 1];
          if (last && last.time === now) {
            last.high = Math.max(last.high, price);
            last.low = Math.min(last.low, price);
            last.close = price;
            series.update(last);
          } else {
            const candle: Candle = { time: now, open: price, high: price, low: price, close: price };
            candlesRef.current.push(candle);
            series.update(candle);
          }
        });
        return () => sub();
      }
    })();

    // Subscribe to live updates
    let lastCandleTime: Time | null = null;
    const unsub = subscribePrices([symbol], (sym, price) => {
      if (sym !== symbol) return;
      // Update existing candle or create new one (5-min candles)
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

    return () => unsub();
  }, [symbol]);

  // Price lines for actual trades only
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Remove old lines
    for (const line of linesRef.current) {
      try { series.removePriceLine(line); } catch {}
    }
    linesRef.current = [];

    const isBuy = side === 'buy';

    // Entry line
    if (entryPrice != null) {
      const line = series.createPriceLine({
        price: entryPrice,
        color: isBuy ? '#00E676' : '#FF5252',
        title: ` ENTRY ${fmt(entryPrice)} `,
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        axisLabelColor: isBuy ? '#00E676' : '#FF5252',
      });
      linesRef.current.push(line);
    }

    // Stop Loss
    if (sl != null) {
      const line = series.createPriceLine({
        price: sl,
        color: '#FF1744',
        title: ` SL ${fmt(sl)} `,
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        axisLabelColor: '#FF1744',
      });
      linesRef.current.push(line);
    }

    // Take Profit
    if (tp != null) {
      const line = series.createPriceLine({
        price: tp,
        color: '#00E676',
        title: ` TP ${fmt(tp)} `,
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        axisLabelColor: '#00E676',
      });
      linesRef.current.push(line);
    }
  }, [entryPrice, sl, tp, side]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
