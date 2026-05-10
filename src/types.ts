export enum MarketType {
  FOREX = "forex",
  CRYPTO = "crypto",
  STOCKS = "stocks",
  METALS = "metals",
}

export enum TradingStyle {
  SCALPING = "scalping",
  DAY_TRADING = "day_trading",
  SWING_TRADING = "swing_trading",
}

export enum SignalType {
  STRONG_BUY = "strong_buy",
  BUY = "buy",
  NEUTRAL = "neutral",
  SELL = "sell",
  STRONG_SELL = "strong_sell",
  NO_ENTRY = "no_entry",
}

export interface AnalysisResult {
  id?: string;
  symbol: string;
  type: MarketType;
  timeframe: string;
  signal: SignalType;
  confidence: number; // New field for percentage
  summary: string;
  technicalScore: number;
  sentimentScore: number;
  historicalMatch?: string;
  trendMaturity?: 'infancy' | 'youth' | 'aging' | 'unknown';
  trendAge?: number; // Number of candles
  timestamp: string;
  userId: string;
}

export interface UserPreference {
  userId: string;
  watchlist: string[];
  theme: 'light' | 'dark';
}

export interface StrategySettings {
  minCandleSizePx: number;
  consecutiveCandles: number;
  momentumThreshold: number;
  supplyDemandStrength: number;
  useHigherTimeframe: boolean;
  useVolumeAnalysis: boolean;
  useNewsGuard: boolean;
  useIndicators: boolean;
  minConfidence: number;
}
