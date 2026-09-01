// Convert a broker/exchange symbol (as stored and analyzed by the app) into a
// TradingView symbol that will actually render candles. This centralizes the
// mapping that previously lived independently (and incompletely) across
// TradingViewEmbed.tsx, AnalysisDetailPage.tsx and TradeNowPage.tsx — a gap
// that left US/European stock charts empty when a symbol was not in the small
// hard-coded maps.

// Explicit one-off mappings (kept for symbols that do not follow a suffix rule).
const EXPLICIT: Record<string, string> = {
  // Japanese stocks (Yahoo .T → Tokyo Stock Exchange)
  '7203.T': 'TSE:7203', '6758.T': 'TSE:6758', '8306.T': 'TSE:8306',
  '9984.T': 'TSE:9984', '7974.T': 'TSE:7974', '7267.T': 'TSE:7267',
  '9432.T': 'TSE:9432', '6861.T': 'TSE:6861', '6501.T': 'TSE:6501', '8035.T': 'TSE:8035',
  '7751.T': 'TSE:7751', '6954.T': 'TSE:6954', '6301.T': 'TSE:6301', '5020.T': 'TSE:5020', '9020.T': 'TSE:9020',
  '6942.T': 'TSE:6942', '6902.T': 'TSE:6902', '7201.T': 'TSE:7201',
  // US stocks explicitly noted as NYSE-listed
  'NVO': 'NYSE:NVO', 'BABA': 'NYSE:BABA',
};

// Map a Yahoo-style exchange suffix to the TradingView exchange prefix.
const SUFFIX_EXCHANGE: Record<string, string> = {
  PA: 'EPA',   // Paris
  DE: 'ETR',   // Frankfurt / Xetra
  AS: 'AMS',   // Amsterdam
  L: 'LON',    // London
  SW: 'SWX',   // Zurich
  CO: 'CPH',   // Copenhagen
  ST: 'STO',   // Stockholm
  MI: 'MIL',   // Milan
  BR: 'EBR',   // Brussels
  LS: 'LSE',   // London (alternate)
  MC: 'EPA',   // Paris (Euronext Monaco tag used in some feeds)
  AX: 'ASX',   // Australia
  HK: 'HKEX',  // Hong Kong
};
const SUFFIX_PATTERN = /^(.+)\.([A-Z]{1,3})$/i;

// Well-known large-cap US tickers with their exchange, used as a fallback so a
// chart always renders instead of returning the bare ticker (which TV shows a
// search box for). Everything else defaults to NASDAQ (most growth/tech).
const US_EXCHANGE: Record<string, string> = {
  T: 'NYSE', VZ: 'NYSE', JPM: 'NYSE', BAC: 'NYSE', WMT: 'NYSE', XOM: 'NYSE',
  CVX: 'NYSE', KO: 'NYSE', DIS: 'NYSE', BA: 'NYSE', CAT: 'NYSE', CRM: 'NYSE',
  ORCL: 'NYSE', TSM: 'NYSE', SHOP: 'NYSE', SQ: 'NYSE', JNJ: 'NYSE', PG: 'NYSE',
  UNH: 'NYSE', HD: 'NYSE', V: 'NYSE', MA: 'NYSE', ABBV: 'NYSE', LLY: 'NYSE',
  MRK: 'NYSE', NIO: 'NYSE', PLTR: 'NYSE', NOW: 'NYSE', JPM2: 'NYSE',
};

// US-listed mega caps that trade on NASDAQ.
const US_NASDAQ: Record<string, string> = {
  TSLA: '1', AAPL: '1', NVDA: '1', AMD: '1', INTC: '1', META: '1', GOOGL: '1',
  MSFT: '1', AMZN: '1', NFLX: '1', COIN: '1', QQQ: '1', SOXX: '1', PEP: '1',
  MU: '1', QCOM: '1', CSCO: '1', COST: '1', ARM: '1', SMCI: '1', PDD: '1',
  JD: '1', ROKU: '1',
};

// Yahoo tickers where the numeric prefix is irrelevant (index-style) handled
// elsewhere; here we guard obvious non-stock inputs so they pass through.
function looksLikeNonStock(sym: string): boolean {
  const s = sym.toUpperCase();
  // Forex has 6 letters from two currency codes (e.g. EURUSD).
  if (/^[A-Z]{6}$/.test(s) || /^[A-Z]{3}[A-Z]{3}$/.test(s)) return true;
  if (/^\^/.test(s) || /^[A-Z0-9]+=/i.test(sym)) return true; // ^GSPC, GC=F
  return false;
}

export function toTvSymbol(symbol: string): string {
  const sym = (symbol || '').trim();
  if (!sym) return sym;

  // Already has an exchange prefix (e.g. "TSE:7203", "BINANCE:BTCUSDT").
  if (sym.includes(':')) return sym;

  const upper = sym.toUpperCase();

  // Explicit one-off mapping wins.
  if (EXPLICIT[sym]) return EXPLICIT[sym];

  // Japanese numeric tickers not in the explicit map → Tokyo.
  if (/^\d{4}\.T$/.test(sym)) return `TSE:${sym.replace('.T', '')}`;

  // European / Asia-Pacific stocks with an exchange suffix.
  const m = sym.match(SUFFIX_PATTERN);
  if (m) {
    const base = m[1];
    const suffix = m[2].toUpperCase();
    const ex = SUFFIX_EXCHANGE[suffix];
    if (ex) return `${ex}:${base}`;
    // Unknown suffix → pass through (no way to guess exchange).
    return sym;
  }

  // Plain US ticker (no suffix) — choose a reasonable exchange.
  if (!looksLikeNonStock(sym)) {
    if (US_EXCHANGE[upper]) return `${US_EXCHANGE[upper]}:${upper}`;
    if (US_NASDAQ[upper]) return `NASDAQ:${upper}`;
    return `NASDAQ:${upper}`;
  }

  // Non-stock (forex/indices/metals/crypto handled by caller context) — pass through.
  return sym;
}
