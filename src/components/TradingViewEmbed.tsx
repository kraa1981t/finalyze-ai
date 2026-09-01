import React, { useEffect, useRef } from 'react';

interface Props {
  symbol: string; // TradingView format e.g. "BINANCE:BTCUSDT" or "FX:EURUSD"
  interval?: string;
}

const SYMBOL_MAP: Record<string, string> = {
  // Japanese stocks (Yahoo-style .T → Tokyo Stock Exchange)
  '7203.T': 'TSE:7203', '6758.T': 'TSE:6758', '8306.T': 'TSE:8306',
  '9984.T': 'TSE:9984', '7974.T': 'TSE:7974', '7267.T': 'TSE:7267',
  '9432.T': 'TSE:9432', '6861.T': 'TSE:6861', '6501.T': 'TSE:6501', '8035.T': 'TSE:8035',
  '7751.T': 'TSE:7751', '6954.T': 'TSE:6954', '6301.T': 'TSE:6301', '5020.T': 'TSE:5020', '9020.T': 'TSE:9020',
  // European stocks
  'ASML.AS': 'AMS:ASML', 'MC.PA': 'EPA:MC', 'NESN.SW': 'SWX:NESN', 'SAP.DE': 'ETR:SAP',
  'SHEL.L': 'LON:SHEL', 'ULVR.L': 'LON:ULVR', 'ALV.DE': 'ETR:ALV', 'OR.PA': 'EPA:OR',
  'AZN.L': 'LON:AZN', 'ROG.SW': 'SWX:ROG', 'MBG.DE': 'ETR:MBG',
  'BARC.L': 'LON:BARC', 'BNP.PA': 'EPA:BNP', 'TTE.PA': 'EPA:TTE', 'BP.L': 'LON:BP',
  'DBK.DE': 'ETR:DBK', 'IFX.DE': 'ETR:IFX', 'ADS.DE': 'ETR:ADS', 'NOVO-B.CO': 'CPH:NOVO-B',
  '6942.T': 'TSE:6942', '6902.T': 'TSE:6902', '7201.T': 'TSE:7201',
};

function toTradingViewSymbol(sym: string): string {
  if (SYMBOL_MAP[sym]) return SYMBOL_MAP[sym];
  if (sym.includes(':')) return sym; // already has exchange prefix
  // Any other Yahoo-style .T Japanese ticker we didn't map explicitly
  if (/^\d{4}\.T$/.test(sym)) return `TSE:${sym.replace('.T', '')}`;
  return sym;
}

export default function TradingViewEmbed({ symbol, interval = '60' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tvSymbol = toTradingViewSymbol(symbol);

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
      symbol: tvSymbol,
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
  }, [tvSymbol, interval]);

  return (
    <div className="w-full h-[380px] rounded-xl overflow-hidden border border-white/10 bg-[#0b0e14]">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
