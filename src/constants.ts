import { StrategySettings, MarketType, TradingStyle } from "./types";

export const DEFAULT_STRATEGY_SETTINGS: StrategySettings = {
  momentumThreshold: 70,
  supplyDemandStrength: 80,
  useHigherTimeframe: true,
  useVolumeAnalysis: true,
  useNewsGuard: true,
  useIndicators: true,
  minConfidence: 55,
  minStrongConfidence: 80,
  minTrendAge: 2,
  minInfantAge: 10,
  minMatureAge: 25,
  maxMatureAge: 50,
};

export const DEFAULT_AUTO_SETTINGS = {
  isEnabled: false,
  interval: 15,
  timeframe: '1h',
  category: 'all',
  tradingStyle: TradingStyle.DAY_TRADING,
  volume: 0.8,
  showAllSignals: false,
};

export const SYMBOL_CATEGORIES = {
  forex: [
    'EURUSD', 'EURGBP', 'EURJPY', 'EURAUD', 'EURNZD', 'EURCAD', 'EURCHF',
    'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF', 'USDJPY', 'USDMXN',
    'GBPJPY', 'GBPAUD', 'GBPNZD', 'GBPCAD', 'GBPCHF',
    'AUDJPY', 'AUDNZD', 'AUDCAD', 'AUDCHF', 'NZDJPY', 'NZDCAD', 'NZDCHF',
    'CADJPY', 'CADCHF', 'CHFJPY'
  ],
  crypto: [
    'BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD', 'ADAUSD', 'AVAXUSD',
    'DOGEUSD', 'SHIBUSD', 'PEPEUSD', 'WIFUSD', 'BONKUSD',
    'DOTUSD', 'LINKUSD', 'MATICUSD', 'UNIUSD', 'LTCUSD', 'BCHUSD'
  ],
  stocks: [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
    'XOM', 'CVX', 'SHEL', 'TTE', 'BP',
    'JPM', 'BAC', 'WFC', 'C', 'GS'
  ],
  metals: [
    'XAUUSD', 'XAGUSD', 'XPTUSD', 'XCUUSD', 'XPDUSD'
  ]
};

export const MARKET_CATEGORIES = [
  { id: MarketType.FOREX, icon: 'DollarSign' },
  { id: MarketType.CRYPTO, icon: 'Bitcoin' },
  { id: MarketType.STOCKS, icon: 'TrendingUp' },
  { id: MarketType.METALS, icon: 'Gem' }
];

export const DEFAULT_SUCCESS_SOUNDS = [
  { id: 'sharp_bell', url: 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3', label: 'Sharp Bell' },
  { id: 'digital_ring', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', label: 'Digital Ring' },
  { id: 'digital_notice', url: 'https://assets.mixkit.co/active_storage/sfx/938/938-preview.mp3', label: 'Digital Notice' }
];

export const DEFAULT_FAIL_SOUNDS = [
  { id: 'clear_notice', url: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3', label: 'Clear Notice' },
  { id: 'soft_notice', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', label: 'Soft Notice' },
  { id: 'alert', url: 'https://assets.mixkit.co/active_storage/sfx/431/431-preview.mp3', label: 'Alert' }
];

export const FREE_SYMBOLS: Record<string, string[]> = {
  forex: ['EURUSD', 'GBPUSD', 'USDJPY', 'EURJPY', 'GBPJPY'],
  crypto: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD'],
  stocks: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'],
  metals: ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XCUUSD', 'XPDUSD'],
};

export const TIMEFRAMES = [
  { id: '1m', label: '1m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '1h', label: '1h' },
  { id: '4h', label: '4h' },
  { id: '1d', label: '1d' },
  { id: '1w', label: '1w' },
  { id: '1M', label: '1M' },
  { id: '1Y', label: '1Y' },
];

export const TRADING_STYLES = [
  { id: 'scalping', label: 'scalping', icon: 'Zap' },
  { id: 'day_trading', label: 'day_trading', icon: 'Play' },
  { id: 'swing_trading', label: 'swing_trading', icon: 'Clock' },
];

export const SYMBOL_GROUPS: Record<string, { label: string, symbols: string[] }[]> = {
  forex: [
    { label: 'eurPairs', symbols: ['EURUSD', 'EURGBP', 'EURJPY', 'EURAUD', 'EURNZD', 'EURCAD', 'EURCHF'] },
    { label: 'usdPairs', symbols: ['GBPUSD', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF', 'USDJPY', 'USDMXN'] },
    { label: 'gbpPairs', symbols: ['GBPJPY', 'GBPAUD', 'GBPNZD', 'GBPCAD', 'GBPCHF'] },
    { label: 'audNzdPairs', symbols: ['AUDJPY', 'AUDNZD', 'AUDCAD', 'AUDCHF', 'NZDJPY', 'NZDCAD', 'NZDCHF'] },
    { label: 'chfCadPairs', symbols: ['CADJPY', 'CADCHF', 'CHFJPY'] },
  ],
  crypto: [
    { label: 'topCrypto', symbols: ['BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD', 'ADAUSD', 'AVAXUSD'] },
    { label: 'momentumCrypto', symbols: ['DOGEUSD', 'SHIBUSD', 'PEPEUSD', 'WIFUSD', 'BONKUSD'] },
    { label: 'altCrypto', symbols: ['DOTUSD', 'LINKUSD', 'MATICUSD', 'UNIUSD', 'LTCUSD', 'BCHUSD'] },
  ],
  stocks: [
    { label: 'techStocks', symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'] },
    { label: 'energyStocks', symbols: ['XOM', 'CVX', 'SHEL', 'TTE', 'BP'] },
    { label: 'bankStocks', symbols: ['JPM', 'BAC', 'WFC', 'C', 'GS'] },
  ],
  metals: [
    { label: 'preciousMetals', symbols: ['XAUUSD', 'XAGUSD', 'XPTUSD'] },
    { label: 'industrialMetals', symbols: ['XCUUSD', 'XPDUSD'] },
  ]
};

export const ALL_SYMBOLS_DB: Record<string, string[]> = {
  forex: [
    // Major Pairs
    'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD',
    // EUR Crosses
    'EURGBP', 'EURJPY', 'EURAUD', 'EURNZD', 'EURCAD', 'EURCHF',
    // GBP Crosses
    'GBPJPY', 'GBPAUD', 'GBPNZD', 'GBPCAD', 'GBPCHF',
    // AUD/NZD Crosses
    'AUDJPY', 'AUDNZD', 'AUDCAD', 'AUDCHF',
    'NZDJPY', 'NZDCAD', 'NZDCHF',
    // CAD/CHF Crosses
    'CADJPY', 'CADCHF', 'CHFJPY',
    // Exotics
    'USDMXN', 'USDZAR', 'USDTRY', 'USDSEK', 'USDNOK', 'USDDKK',
    'USDSGD', 'USDHKD', 'USDCNH', 'USDRUB', 'USDTHB', 'USDINR',
    'USDPLN', 'USDCZK', 'USDHUF', 'USDILS', 'USDKRW', 'USDTWD',
    'EURTRY', 'EURZAR', 'EURPLN', 'EURHUF', 'EURCZK', 'EURSEK', 'EURNOK', 'EURDKK',
    'GBPTRY', 'GBPZAR', 'GBPSEK', 'GBPNOK',
    'AUDSGD', 'NZDSGD', 'SGDJPY',
  ].sort(),
  crypto: [
    // Top 10 by Market Cap
    'BTCUSD', 'ETHUSD', 'BNBUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD', 'DOGEUSD', 'TRXUSD', 'AVAXUSD', 'DOTUSD',
    // DeFi
    'LINKUSD', 'UNIUSD', 'AAVEUSD', 'MKRUSD', 'SNXUSD', 'LDOUSD', 'COMPUSD', 'CRVUSD', 'SUSHIUSD', '1INCHUSD',
    // Layer 2
    'MATICUSD', 'OPUSD', 'ARBUSD', 'IMXUSD', 'MANTUSD', 'STRKUSD', 'ZKUSD',
    // Layer 1
    'NEARUSD', 'ICPUSD', 'APTUSD', 'SUIUSD', 'INJUSD', 'SEIUMD', 'ATOMUSD', 'ALGOUSD', 'FTMUSD', 'HBARUSD', 'EOSUSD',
    // Meme
    'SHIBUSD', 'PEPEUSD', 'WIFUSD', 'BONKUSD', 'FLOKIUSD', 'MEMEUSD',
    // Infrastructure & AI
    'RNDRUSD', 'FILUSD', 'THETAUSD', 'ARUSD', 'FETUSD', 'TAOUSD', 'OCEANUSD',
    // Others
    'LTCUSD', 'BCHUSD', 'ETCUSD', 'XLMUSD', 'VETUSD', 'XMRUSD', 'ZECUSD', 'DASHUSD',
    'SANDUSD', 'MANAUSD', 'AXSUSD', 'GALAUSD', 'ENJUSD', 'CHZUSD',
  ].sort(),
  stocks: [
    // US Tech Giants (FAANG+)
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'NFLX',
    // US Semiconductors
    'AMD', 'INTC', 'QCOM', 'AVGO', 'MU', 'MRVL', 'LRCX', 'KLAC', 'AMAT', 'TSM', 'ASML',
    // US Software & Cloud
    'CRM', 'ADBE', 'ORCL', 'NOW', 'SNOW', 'PLTR', 'UBER', 'SQ', 'SHOP', 'COIN', 'DDOG', 'NET', 'ZS',
    // US Finance
    'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'BLK', 'SCHW', 'AXP', 'V', 'MA', 'PYPL',
    // US Healthcare
    'JNJ', 'UNH', 'PFE', 'ABBV', 'MRK', 'LLY', 'TMO', 'ABT', 'DHR', 'BMY', 'AMGN', 'GILD', 'MRNA', 'ISRG',
    // US Consumer & Retail
    'WMT', 'COST', 'HD', 'LOW', 'TGT', 'SBUX', 'MCD', 'NKE', 'DIS', 'PG', 'KO', 'PEP',
    // US Energy
    'XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OXY', 'DVN',
    // US Industrial & Defense
    'BA', 'CAT', 'HON', 'GE', 'LMT', 'RTX', 'NOC', 'MMM', 'DE', 'UPS', 'FDX',
    // US Telecom
    'T', 'VZ', 'TMUS', 'CSCO',
    // Chinese Tech
    'BABA', 'JD', 'PDD', 'BIDU', 'NIO', 'LI', 'XPEV',
    // European
    'SAP', 'NVO', 'SHEL', 'TTE', 'BP', 'AZN', 'LVMUY', 'SIEGY',
    // Japanese
    'TM', 'SONY', 'NTDOY',
    // ETFs
    'SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'ARKK', 'XLF', 'XLK', 'XLE', 'XLV', 'GLD', 'SLV', 'USO',
    // Indices (CFD)
    'US500', 'US30', 'US100', 'UK100', 'DE40', 'JP225', 'HK50', 'AU200',
  ].sort(),
  metals: [
    'XAUUSD', 'XAGUSD', 'XPTUSD', 'XPDUSD', 'XCUUSD',
    'XALUSD', 'XNIUSD', 'XZNUSD', 'XPBUSD', 'XSNUSD',
  ].sort()
};
