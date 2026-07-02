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
  confidence: number;
  summary: string;
  detailedReasons?: { check: string; value: string; status: string; impact: string; source?: string; primary?: boolean }[];
  newsSources?: string[];
  technicalScore: number;
  sentimentScore: number;
  historicalMatch?: string;
  trendMaturity?: 'infancy' | 'youth' | 'mature' | 'aging' | 'unknown';
  trendAge?: number;
  microTF?: string;
  microSignal?: 'pullback' | 'aligned' | 'unknown';
  microTrend?: string;
  timestamp: string;
  userId: string;
  stopLoss?: number;
  takeProfit?: number;
  primaryMetCount?: number;
  direction?: string;
  entryPrice?: number;
}

export interface UserPreference {
  userId: string;
  watchlist: string[];
  theme: 'light' | 'dark';
}

export interface StrategySettings {
  momentumThreshold: number;
  supplyDemandStrength: number;
  useHigherTimeframe: boolean;
  useVolumeAnalysis: boolean;
  useNewsGuard: boolean;
  useIndicators: boolean;
  minConfidence: number;
  minStrongConfidence: number;
  minTrendAge: number;
  minInfantAge: number;
  minMatureAge: number;
  maxMatureAge: number;
  primaryBBWeight: number;
  primarySDWeight: number;
  primaryAgeWeight: number;
  primaryNewsWeight: number;
  supportRSIWeight: number;
  supportEMAWeight: number;
  supportDirWeight: number;
  supportVolWeight: number;
  supportMicroBBWeight: number;
  supportMicroAlignWeight: number;
  baseConfidence: number;
  strongThreshold: number;
  buyThreshold: number;
  minStrongSupport: number;
}

export interface AutoAnalysisSettings {
  isEnabled: boolean;
  interval: number; // in minutes
  timeframe: string;
  category: string;
  tradingStyle: TradingStyle;
  volume: number; // 0 to 1
  showAllSignals: boolean;
  lastFinishedAt?: number;
  successSound?: string;
  failSound?: string;
  completionSound?: string;
  forceRestart?: boolean;
}

