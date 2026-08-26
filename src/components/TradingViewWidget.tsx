import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
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
    USDPLN: 'USDPLN=X', USDSEK: 'USDSEK=X', USDNOK: 'USDNOK=X',
    USDDKK: 'USDDKK=X', USDHUF: 'USDHUF=X', USDCZK: 'USDCZK=X',
    USDZAR: 'USDZAR=X', USDSGD: 'USDSGD=X', USDHKD: 'USDHKD=X',
    USDTWD: 'USDTWD=X', USDCNH: 'USDCNH=X', USDTHB: 'USDTHB=X',
    USDINR: 'USDINR=X', USDBRL: 'USDBRL=X', USDIDR: 'USDIDR=X',
    USDPHP: 'USDPHP=X', USDMYR: 'USDMYR=X',
    XAUUSD: 'GC=F', XAGUSD: 'SI=F',
    BTCUSD: 'BTC-USD', ETHUSD: 'ETH-USD',
    US500: '^GSPC', US30: '^DJI', US100: '^IXIC',
    SPY: 'SPY', QQQ: 'QQQ',
    DXY: 'DX-Y.NYB',
    GOLD: 'GC=F', SILVER: 'SI=F',
  };
  if (map[s]) return map[s];
  if (s.endsWith('USD') && s.length === 6) return s;
  if (s.length === 6) return `${s}=X`;
  return s;
}

async function fetchYahooCandles(yahooSym: string, range: string, interval: string): Promise<Candle[]> {
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=${interval}&range=${range}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=${interval}&range=${range}`,
  ];

  for (const url of urls) {
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(proxy, { signal: controller.signal });
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
        if (o != null && h != null && l != null && c != null && !isNaN(o) && !isNaN(c)) {
          candles.push({ time: ts[i] as Time, open: o, high: h, low: l, close: c });
        }
      }
      if (candles.length > 0) return candles;
    } catch {}
  }
  return [];
}

function generateFallbackCandles(basePrice: number): Candle[] {
  const candles: Candle[] = [];
  const now = Math.floor(Date.now() / 86400000) * 86400;
  for (let i = 60; i >= 0; i--) {
    const time = (now - i * 86400) as Time;
    const variation = basePrice * 0.005;
    const o = basePrice + (Math.random() - 0.5) * variation;
    const c = basePrice + (Math.random() - 0.5) * variation;
    const h = Math.max(o, c) + Math.random() * variation * 0.5;
    const l = Math.min(o, c) - Math.random() * variation * 0.5;
    candles.push({ time, open: o, high: h, low: l, close: c });
  }
  return candles;
}

export default function TradingViewWidget({ symbol, entryPrice, sl, tp, side }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const linesRef = useRef<any[]>([]);
  const candlesRef = useRef<Candle[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);

  // Initialize chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { color: '#0a0f1a' },
        textColor: '#94a3b8',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(255,255,255,0.3)', width: 1, style: 2, labelBackgroundColor: '#F59E0B' },
        horzLine: { color: 'rgba(255,255,255,0.3)', width: 1, style: 2, labelBackgroundColor: '#F59E0B' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
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
      priceLineVisible: false,
    });

    seriesRef.current = series;

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
    };
  }, []);

  // Load data & subscribe per symbol
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    candlesRef.current = [];
    series.setData([]);

    for (const line of linesRef.current) {
      try { series.removePriceLine(line); } catch {}
    }
    linesRef.current = [];

    const yahooSym = toYahooSymbol(symbol);

    (async () => {
      let candles = await fetchYahooCandles(yahooSym, '3mo', '1d');
      if (candles.length === 0) candles = await fetchYahooCandles(yahooSym, '1mo', '1h');
      if (candles.length === 0) candles = await fetchYahooCandles(yahooSym, '1mo', '5m');

      if (candles.length > 0) {
        candlesRef.current = candles;
        series.setData(candles);
        chart.timeScale().fitContent();
      }

      unsubRef.current = subscribePrices([symbol], (sym, price) => {
        if (sym !== symbol || !price) return;
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

    return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; } };
  }, [symbol]);

  // Price lines
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    for (const line of linesRef.current) {
      try { series.removePriceLine(line); } catch {}
    }
    linesRef.current = [];

    if (entryPrice != null) {
      linesRef.current.push(series.createPriceLine({
        price: entryPrice,
        color: side === 'buy' ? '#00E676' : '#FF5252',
        title: ` ENTRY ${fmt(entryPrice)} `,
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        axisLabelColor: side === 'buy' ? '#00E676' : '#FF5252',
      }));
    }
    if (sl != null) {
      linesRef.current.push(series.createPriceLine({
        price: sl,
        color: '#FF1744',
        title: ` SL ${fmt(sl)} `,
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        axisLabelColor: '#FF1744',
      }));
    }
    if (tp != null) {
      linesRef.current.push(series.createPriceLine({
        price: tp,
        color: '#00E676',
        title: ` TP ${fmt(tp)} `,
        lineWidth: 2,
        lineStyle: 1,
        axisLabelVisible: true,
        axisLabelColor: '#00E676',
      }));
    }
  }, [entryPrice, sl, tp, side]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
