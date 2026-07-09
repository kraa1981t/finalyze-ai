import { MarketType, AnalysisResult, TradingStyle, SignalType, StrategySettings } from "../types";
import { DEFAULT_STRATEGY_SETTINGS } from "../constants";
import { fetchMarketContext } from "./marketContextService";
import { onRateLimited, waitIfRateLimited } from "./rateLimitTracker";
import { fetchMarketDataDirect, callAIDirect } from './apiDirect';
import { getCorrelationGroup } from "./portfolioRiskService";

// Result cache: same symbol+timeframe+style returns same result for 5 minutes
const _resultCache = new Map<string, { result: AnalysisResult; ts: number }>();
const RESULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getApiKey(): string {
  try {
    // 1. Primary key (enabled check)
    const k1 = localStorage.getItem('finalyze_key1_value');
    const k1en = localStorage.getItem('finalyze_key1_enabled') !== 'false';
    if (k1 && k1en) return k1;
    // 2. Legacy key
    const oldKey = localStorage.getItem('finalyze_user_groq_api_key');
    if (oldKey) return oldKey;
    // 3. Secondary key (fallback)
    const k2 = localStorage.getItem('finalyze_key2_value');
    if (k2) return k2;
    // 4. SessionStorage mirror (survives cross-tab navigation)
    const ss = sessionStorage.getItem('finalyze_key_mirror');
    if (ss) {
      localStorage.setItem('finalyze_key1_value', ss);
      localStorage.setItem('finalyze_key1_enabled', 'true');
      return ss;
    }
    // 5. Cookie (most persistent ΓÇö survives redeploy, browser restart)
    const cookie = document.cookie.split('; ').find(r => r.startsWith('finalyze_api_key='));
    if (cookie) {
      const val = decodeURIComponent(cookie.split('=')[1]);
      if (val) {
        localStorage.setItem('finalyze_key1_value', val);
        localStorage.setItem('finalyze_key1_enabled', 'true');
        sessionStorage.setItem('finalyze_key_mirror', val);
        return val;
      }
    }
  } catch {}
  return '';
}

export function mirrorApiKey(key: string): void {
  try {
    sessionStorage.setItem('finalyze_key_mirror', key);
    // Cookie: 1 year expiry ΓÇö survives redeploy, browser restart
    document.cookie = `finalyze_api_key=${encodeURIComponent(key)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {}
}

function calculateSupplyDemandZones(highs: number[], lows: number[], volumes: number[], closes: number[]) {
  const zones: { type: 'supply' | 'demand'; top: number; bottom: number; strength: number; age: number; consumed: boolean }[] = [];
  const len = highs.length;
  if (len < 15) return zones;

  const currentPrice = closes[len - 1];

  for (let i = 5; i < len - 5; i++) {
    const isPivotHigh = highs[i] > highs[i - 1] && highs[i] > highs[i - 2] && highs[i] > highs[i + 1] && highs[i] > highs[i + 2];
    const isPivotLow = lows[i] < lows[i - 1] && lows[i] < lows[i - 2] && lows[i] < lows[i + 1] && lows[i] < lows[i + 2];
    if (!isPivotHigh && !isPivotLow) continue;

    const vol = volumes[i] || 0;
    const avgVol = volumes.slice(Math.max(0, i - 5), i + 5).filter(v => v).reduce((a, b) => a + b, 0) / Math.max(volumes.slice(Math.max(0, i - 5), i + 5).filter(v => v).length, 1);
    const volRatio = avgVol > 0 ? vol / avgVol : 1;

    if (isPivotHigh && volRatio > 1.2) {
      const zoneTop = highs[i] * 1.002;
      const zoneBottom = lows[i] * 0.998;
      // Zone is "consumed" if price has passed through it
      const consumed = currentPrice > zoneTop; // price broke above supply = consumed
      const age = len - i; // candles since zone formed
      zones.push({ type: 'supply', top: zoneTop, bottom: zoneBottom, strength: Math.min(100, volRatio * 50), age, consumed });
    }
    if (isPivotLow && volRatio > 1.2) {
      const zoneTop = highs[i] * 1.002;
      const zoneBottom = lows[i] * 0.998;
      // Zone is "consumed" if price has passed through it
      const consumed = currentPrice < zoneBottom; // price broke below demand = consumed
      const age = len - i; // candles since zone formed
      zones.push({ type: 'demand', top: zoneTop, bottom: zoneBottom, strength: Math.min(100, volRatio * 50), age, consumed });
    }
  }
  // Filter out consumed zones and zones older than 30 candles, then take top 6
  return zones.filter(z => !z.consumed && z.age < 30).slice(0, 6);
}

/**
 * ROBUST TECHNICAL ENGINE (VERSION 2.0)
 * Works with minimal data (10+ candles) and handles gaps gracefully.
 */
function calculateTechnicalMetrics(closes: number[], highs: number[], lows: number[], volumes?: number[], opens?: number[]) {
  if (!closes || closes.length < 10) return null;

  const len = closes.length;
  const safeOpens = opens && opens.length >= len ? opens : closes;
  const safeHighs = highs && highs.length >= len ? highs : closes;
  const safeLows = lows && lows.length >= len ? lows : closes;
  
  // 1. RSI (14)
  let sumGain = 0;
  let sumLoss = 0;
  for (let i = 1; i < Math.min(len, 15); i++) {
    const diff = closes[len - i] - closes[len - i - 1];
    if (diff >= 0) sumGain += diff; else sumLoss -= diff;
  }
  const rs = sumLoss === 0 ? 100 : sumGain / sumLoss;
  const rsi = 100 - (100 / (1 + rs));

  // 2. EMA Cross (9 vs 21) ΓÇö true Exponential Moving Average
  const calcEMA = (data: number[], period: number): number => {
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }
    return ema;
  };
  const ema9 = calcEMA(closes, 9);
  const ema21 = calcEMA(closes, 21);
  const emaCross = ema9 > ema21 ? 'bullish' : 'bearish';

  // 2b. ADX (14) — trend strength
  const adxPeriod = Math.min(14, len - 1);
  let adx = 0;
  if (len >= adxPeriod + 1) {
    let plusDM = 0, minusDM = 0, trSum = 0;
    for (let i = len - adxPeriod; i < len; i++) {
      const upMove = (highs?.[i] || closes[i]) - (highs?.[i - 1] || closes[i - 1]);
      const downMove = (lows?.[i - 1] || closes[i - 1]) - (lows?.[i] || closes[i]);
      const tr = Math.max(
        (highs?.[i] || closes[i]) - (lows?.[i] || closes[i]),
        Math.abs((highs?.[i] || closes[i]) - closes[i - 1]),
        Math.abs((lows?.[i] || closes[i]) - closes[i - 1])
      );
      plusDM += upMove > downMove && upMove > 0 ? upMove : 0;
      minusDM += downMove > upMove && downMove > 0 ? downMove : 0;
      trSum += tr;
    }
    const plusDI = trSum > 0 ? (plusDM / trSum) * 100 : 0;
    const minusDI = trSum > 0 ? (minusDM / trSum) * 100 : 0;
    const dx = (plusDI + minusDI) > 0 ? Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100 : 0;
    adx = Math.round(dx);
  }

  // 2c. Reversal candle detection
  const isHammer = (idx: number): boolean => {
    if (idx < 0 || idx >= len) return false;
    const body = Math.abs(closes[idx] - safeOpens[idx]);
    const lowerWick = Math.min(safeOpens[idx], closes[idx]) - (lows?.[idx] || closes[idx]);
    const upperWick = (highs?.[idx] || closes[idx]) - Math.max(safeOpens[idx], closes[idx]);
    const totalRange = (highs?.[idx] || closes[idx]) - (lows?.[idx] || closes[idx]);
    return totalRange > 0 && lowerWick > body * 2 && upperWick < body * 0.5;
  };
  const isPinbar = (idx: number): boolean => {
    if (idx < 0 || idx >= len) return false;
    const body = Math.abs(closes[idx] - safeOpens[idx]);
    const upperWick = (highs?.[idx] || closes[idx]) - Math.max(safeOpens[idx], closes[idx]);
    const lowerWick = Math.min(safeOpens[idx], closes[idx]) - (lows?.[idx] || closes[idx]);
    const totalRange = (highs?.[idx] || closes[idx]) - (lows?.[idx] || closes[idx]);
    // Pinbar: one wick > 2.5x body AND other wick < body
    return totalRange > 0 && ((upperWick > body * 2.5 && lowerWick < body) || (lowerWick > body * 2.5 && upperWick < body));
  };
  const isShootingStar = (idx: number): boolean => {
    if (idx < 0 || idx >= len) return false;
    const body = Math.abs(closes[idx] - safeOpens[idx]);
    const upperWick = (highs?.[idx] || closes[idx]) - Math.max(safeOpens[idx], closes[idx]);
    const lowerWick = Math.min(safeOpens[idx], closes[idx]) - (lows?.[idx] || closes[idx]);
    const totalRange = (highs?.[idx] || closes[idx]) - (lows?.[idx] || closes[idx]);
    return totalRange > 0 && upperWick > body * 2 && lowerWick < body * 0.5;
  };
  const isEngulfing = (idx: number): boolean => {
    if (idx < 1 || idx >= len) return false;
    const prevBody = closes[idx - 1] - safeOpens[idx - 1];
    const currBody = closes[idx] - safeOpens[idx];
    const prevBearish = prevBody < 0;
    const currBullish = currBody > 0;
    const prevBullish = prevBody > 0;
    const currBearish = currBody < 0;
    // Bullish engulfing: bearish then larger bullish
    if (prevBearish && currBullish && currBody > Math.abs(prevBody) * 1.2) return true;
    // Bearish engulfing: bullish then larger bearish
    if (prevBullish && currBearish && Math.abs(currBody) > prevBody * 1.2) return true;
    return false;
  };

  // 2d. Swing point validation — requires confirmation
  const validateSwingLow = (idx: number): boolean => {
    if (idx < 1 || idx >= len - 1) return false;
    const hasReversal = isHammer(idx) || isPinbar(idx) || isEngulfing(idx);
    const hasVolumeConfirm = volumes && volumes.length > idx + 1
      ? volumes[idx] > volumes.slice(Math.max(0, idx - 5), idx).reduce((a, b) => a + b, 0) / 5 * 1.3
      : true;
    const hasEmaConfirm = closes[idx + 1] > ema9 || closes[idx + 2] > ema9;
    return hasReversal && hasVolumeConfirm && hasEmaConfirm;
  };
  const validateSwingHigh = (idx: number): boolean => {
    if (idx < 1 || idx >= len - 1) return false;
    const hasReversal = isShootingStar(idx) || isPinbar(idx) || isEngulfing(idx);
    const hasVolumeConfirm = volumes && volumes.length > idx + 1
      ? volumes[idx] > volumes.slice(Math.max(0, idx - 5), idx).reduce((a, b) => a + b, 0) / 5 * 1.3
      : true;
    const hasEmaConfirm = closes[idx + 1] < ema9 || closes[idx + 2] < ema9;
    return hasReversal && hasVolumeConfirm && hasEmaConfirm;
  };

  // Structural swing detection — for trend age measurement only (relaxed validation)
  const isStructuralSwingLow = (idx: number): boolean => {
    if (idx < 1 || idx >= len - 1) return false;
    const hasEmaConfirm = closes[idx + 1] > ema9 || closes[idx + 2] > ema9;
    return hasEmaConfirm;
  };
  const isStructuralSwingHigh = (idx: number): boolean => {
    if (idx < 1 || idx >= len - 1) return false;
    const hasEmaConfirm = closes[idx + 1] < ema9 || closes[idx + 2] < ema9;
    return hasEmaConfirm;
  };

  // 3. Trend Direction (STRUCTURAL — reliable method)
  // Primary: Net price displacement (most reliable)
  const windowSize = Math.min(len - 1, 20);
  const netDisplacement = closes[len - 1] - closes[len - 1 - windowSize];
  const avgPrice = closes.slice(-windowSize).reduce((a, b) => a + b, 0) / windowSize;
  const displacementPct = Math.abs(netDisplacement) / avgPrice;

  // Secondary: Candle count (confirmation)
  let upScore = 0;
  let downScore = 0;
  for (let i = 0; i < windowSize; i++) {
    const curr = len - 1 - i;
    const prev = curr - 1;
    if (closes[curr] > closes[prev]) upScore++; else downScore++;
  }

  // EMA cross
  const emaSlopeUp = ema9 > ema21;

  let direction: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
  const candleUp = upScore > downScore + 2;
  const candleDown = downScore > upScore + 2;
  const priceUp = netDisplacement > 0 && displacementPct > 0.003;
  const priceDown = netDisplacement < 0 && displacementPct > 0.003;

  // Decision: displacement + at least ONE confirmation
  if (priceUp && (candleUp || emaSlopeUp)) {
    direction = 'uptrend';
  } else if (priceDown && (candleDown || !emaSlopeUp)) {
    direction = 'downtrend';
  }

  // 4. Age — Structural: find last validated swing point
  let age = 0;
  if (direction === 'uptrend') {
    const swingLookback = Math.min(len - 1, Math.max(10, Math.floor(len * 0.25)));
    for (let i = swingLookback + 2; i < len - 1; i++) {
      const idx = len - 1 - i;
      if (idx < 1 || idx >= len - 1) continue;
      const candleLow = safeLows[idx];
      let isSwingLow = true;
      for (let j = 1; j <= swingLookback; j++) {
        if (idx - j < 0 || idx + j >= len) { isSwingLow = false; break; }
        if (safeLows[idx - j] < candleLow || safeLows[idx + j] < candleLow) { isSwingLow = false; break; }
      }
      if (isSwingLow && validateSwingLow(idx)) { age = len - 1 - idx; break; }
    }
    if (age === 0) age = len - 1;
  } else if (direction === 'downtrend') {
    const swingLookback = Math.min(len - 1, Math.max(10, Math.floor(len * 0.25)));
    for (let i = swingLookback + 2; i < len - 1; i++) {
      const idx = len - 1 - i;
      if (idx < 1 || idx >= len - 1) continue;
      const candleHigh = safeHighs[idx];
      let isSwingHigh = true;
      for (let j = 1; j <= swingLookback; j++) {
        if (idx - j < 0 || idx + j >= len) { isSwingHigh = false; break; }
        if (safeHighs[idx - j] > candleHigh || safeHighs[idx + j] > candleHigh) { isSwingHigh = false; break; }
      }
      if (isSwingHigh && validateSwingHigh(idx)) { age = len - 1 - idx; break; }
    }
    if (age === 0) age = len - 1;
  }

  // 4b. Total Trend Age — find the furthest significant pullback (simple displacement method)
  let totalAge = 0;
  if (direction !== 'sideways') {
    // Simple approach: find the furthest point where price pulled back > 1.5% from the trend end
    const trendEnd = closes[len - 1];
    const pullbackThreshold = 0.015; // 1.5%
    let trendStartIdx = 0;
    if (direction === 'uptrend') {
      // Find the furthest low that is more than 1.5% below the current price
      for (let i = len - 2; i >= 0; i--) {
        const dropPct = (trendEnd - safeLows[i]) / trendEnd;
        if (dropPct > pullbackThreshold) {
          trendStartIdx = i + 1;
          break;
        }
      }
    } else if (direction === 'downtrend') {
      // Find the furthest high that is more than 1.5% above the current price
      for (let i = len - 2; i >= 0; i--) {
        const risePct = (safeHighs[i] - trendEnd) / trendEnd;
        if (risePct > pullbackThreshold) {
          trendStartIdx = i + 1;
          break;
        }
      }
    }
    totalAge = len - 1 - trendStartIdx;
    if (totalAge < 1) totalAge = len - 1;
  }

  // 4c. Pre-Pullback Age — candles in trend direction BEFORE the pullback
  // Uses totalAge (displacement method) to find trend start, then counts directional candles
  let prePullbackAge = 0;
  if (direction !== 'sideways' && totalAge > 0) {
    const trendStartIdx = len - 1 - totalAge;
    if (direction === 'uptrend') {
      for (let i = trendStartIdx; i < len - 1; i++) {
        if (closes[i + 1] > closes[i]) prePullbackAge++;
      }
    } else if (direction === 'downtrend') {
      for (let i = trendStartIdx; i < len - 1; i++) {
        if (closes[i + 1] < closes[i]) prePullbackAge++;
      }
    }
  }

  // 5. Volume Surge
  let volSurge = false;
  if (volumes && volumes.length > 5) {
    const lastVol = volumes[len - 1];
    const avgVol = volumes.slice(-6, -1).reduce((a, b) => a + b, 0) / 5;
    volSurge = lastVol > avgVol * 1.5;
  }

  // 6. ATR (14-period Average True Range) ΓÇö for dynamic SL/TP
  let atr = 0;
  if (len >= 15) {
    let sumTR = 0;
    for (let i = len - 14; i < len; i++) {
      const prevClose = closes[i - 1] || closes[i];
      const tr = Math.max(
        safeHighs[i] - safeLows[i],
        Math.abs(safeHighs[i] - prevClose),
        Math.abs(safeLows[i] - prevClose)
      );
      sumTR += tr;
    }
    atr = sumTR / 14;
  }

  // 7. Bollinger Bands (20-period SMA + 2 standard deviations)
  let bbUpper = 0, bbMiddle = 0, bbLower = 0, bbWidth = 0, bbPercentB = 0;
  if (len >= 20) {
    const period = 20;
    const slice = closes.slice(-period);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    bbMiddle = sma;
    bbUpper = sma + 2 * stdDev;
    bbLower = sma - 2 * stdDev;
    bbWidth = bbUpper > 0 ? (bbUpper - bbLower) / bbMiddle : 0;
    const currentPrice = closes[len - 1];
    bbPercentB = bbUpper > bbLower ? (currentPrice - bbLower) / (bbUpper - bbLower) : 0.5;
  }

  // 8. Bollinger Band Pullback Detection (3-6 candles opposite to trend BEFORE current candle)
  let bbPullbackCount = 0;
  let bbTouchLower = false;
  let bbTouchUpper = false;
  if (len >= 3 && bbLower > 0) {
    // Count pullback candles from len-2 (skip current candle which may be the reversal)
    for (let i = len - 2; i >= Math.max(0, len - 8); i--) {
      const isBearish = closes[i] < safeOpens[i];
      const isBullish = closes[i] > safeOpens[i];
      if (direction === 'uptrend' && isBearish) bbPullbackCount++;
      else if (direction === 'downtrend' && isBullish) bbPullbackCount++;
      else break;
    }
    const currentPrice = closes[len - 1];
    bbTouchLower = currentPrice <= bbLower * 1.015;
    bbTouchUpper = currentPrice >= bbUpper * 0.985;
  }

  // 9. Reversal Candle Patterns (last candle)
  let hasHammer = false;
  let hasPinbar = false;
  let hasEngulfing = false;
  let hasShootingStar = false;
  if (len >= 2) {
    const currO = safeOpens[len - 1], currC = closes[len - 1], currH = safeHighs[len - 1], currL = safeLows[len - 1];
    const prevO = safeOpens[len - 2], prevC = closes[len - 2];
    const body = Math.abs(currC - currO);
    const upperWick = currH - Math.max(currO, currC);
    const lowerWick = Math.min(currO, currC) - currL;
    const totalRange = currH - currL;

    if (totalRange > 0) {
      // Hammer: small body at top, long lower wick (>2x body)
      hasHammer = lowerWick > body * 2 && upperWick < body * 0.5 && body > 0;
      // Shooting Star: small body at bottom, long upper wick (>2x body)
      hasShootingStar = upperWick > body * 2 && lowerWick < body * 0.5 && body > 0;
      // Pinbar: one wick > 2x the other side
      hasPinbar = (lowerWick > upperWick * 2.5 && lowerWick > body) ||
                  (upperWick > lowerWick * 2.5 && upperWick > body);
    }
    // Bullish Engulfing: prev bearish, curr bullish, curr body engulfs prev
    const prevBearish = prevC < prevO;
    const currBullish = currC > currO;
    hasEngulfing = prevBearish && currBullish && currO <= prevC && currC >= prevO;
    // Bearish Engulfing: prev bullish, curr bearish, curr body engulfs prev
    const prevBullish2 = prevC > prevO;
    const currBearish2 = currC < currO;
    const hasBearishEngulfing = prevBullish2 && currBearish2 && currO >= prevC && currC <= prevO;
    if (hasBearishEngulfing) hasEngulfing = true;
  }

  // 10. Bullish/Bearish Candle (simple direction candle)
  let hasBullishCandle = false;
  let hasBearishCandle = false;
  if (len >= 1) {
    const lastO = safeOpens[len - 1];
    const lastC = closes[len - 1];
    hasBullishCandle = lastC > lastO;
    hasBearishCandle = lastC < lastO;
  }

  return {
    direction, age, totalAge, prePullbackAge, rsi, emaCross, adx, volSurge, atr,
    bbUpper, bbMiddle, bbLower, bbWidth, bbPercentB,
    bbPullbackCount, bbTouchLower, bbTouchUpper,
    hasHammer, hasPinbar, hasEngulfing, hasShootingStar,
    hasBullishCandle, hasBearishCandle,
    momentumScore: upScore / (upScore + downScore) * 100
  };
}

// Batch analysis: ONE AI call for ALL symbols ΓÇö eliminates rate limiting
async function fetchAndPrepareSymbolData(
  symbol: string, type: MarketType, timeframe: string, lang: string
): Promise<{
  metrics: any; microMetrics: any; supplyDemandZones: any[];
  contextNews: any[]; contextFearGreed: any; contextEcon: any[];
  microTF: string; zonesText: string; newsText: string; eventsText: string;
} | { error: string }> {
  try {
    const TF_PROGRESSION = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M', '1Y'];
    const currentIndex = TF_PROGRESSION.indexOf(timeframe);
    const microTF = currentIndex > 0 ? TF_PROGRESSION[currentIndex - 1] : TF_PROGRESSION[0];

    const rawData = await fetchMarketDataDirect(symbol, timeframe).catch(() => ({ chart: { result: [{ indicators: { quote: [{}] } }] } }));
    const quotes = rawData.chart?.result?.[0]?.indicators?.quote?.[0];
    if (!quotes || !quotes.close) return { error: 'Market data currently unavailable from the source.' };

    const closes = quotes.close.filter((c: any) => c != null);
    const highsRaw = quotes.high.filter((c: any) => c != null);
    const lowsRaw = quotes.low.filter((c: any) => c != null);
    const highs = highsRaw.length >= closes.length ? highsRaw : closes;
    const lows = lowsRaw.length >= closes.length ? lowsRaw : closes;
    const volumes = quotes.volume?.filter((v: any) => v != null);
    const rawOpens1 = quotes.open?.filter((c: any) => c != null) || closes;
    const opens = rawOpens1.length >= closes.length ? rawOpens1 : closes;
    if (closes.length < 10) return { error: `Insufficient data for ${symbol}.` };

    const metrics = calculateTechnicalMetrics(closes, highs, lows, volumes, opens);
    const supplyDemandZones = calculateSupplyDemandZones(highs, lows, volumes || [], closes);
    const zonesText = supplyDemandZones.length > 0
      ? supplyDemandZones.map(z => `${z.type === 'supply' ? 'Supply' : 'Demand'} zone: ${z.bottom.toFixed(2)}ΓÇô${z.top.toFixed(2)} (strength ${z.strength.toFixed(0)}%)`).join('. ')
      : 'No clear zones detected.';

    let microMetrics = null;
    let microCloses: number[] = [];
    let microHighs: number[] = [];
    let microLows: number[] = [];
    let microOpens: number[] = [];
    let microVolumes: number[] = [];
    try {
      const microData = await fetchMarketDataDirect(symbol, microTF).catch(() => ({ chart: { result: [{ indicators: { quote: [{}] } }] } }));
      const microQuotes = microData.chart?.result?.[0]?.indicators?.quote?.[0];
      if (microQuotes && microQuotes.close) {
        microCloses = microQuotes.close.filter((c: any) => c != null);
        microHighs = microQuotes.high?.filter((c: any) => c != null) || microCloses;
        microLows = microQuotes.low?.filter((c: any) => c != null) || microCloses;
        microOpens = microQuotes.open?.filter((c: any) => c != null) || microCloses;
        microVolumes = microQuotes.volume?.filter((c: any) => c != null) || [];
        if (microCloses.length >= 10) microMetrics = calculateTechnicalMetrics(microCloses, microHighs, microLows, microVolumes.length > 0 ? microVolumes : undefined, microOpens);
      }
    } catch {}
    let contextFearGreed = null, contextNews: any[] = [], contextEcon: any[] = [];
    try {
      const m = await import('./marketContextService');
      const ctx = await m.fetchMarketContext(symbol);
      contextFearGreed = ctx.fearGreed; contextNews = ctx.news; contextEcon = ctx.econEvents;
    } catch {}
    const newsText = contextNews.length > 0 ? contextNews.map((n: any) => `ΓÇó ${n.title} (${n.source})`).join('\n') : 'No recent news available.';
    const eventsText = contextEcon.length > 0 ? contextEcon.map((e: any) => `ΓÇó ${e.country} | ${e.title} | Impact: ${e.impact} | Forecast: ${e.forecast} | Previous: ${e.previous}`).join('\n') : 'No major economic events this week.';
    return { metrics, microMetrics, supplyDemandZones, contextNews, contextFearGreed, contextEcon, microTF, zonesText, newsText, eventsText };
  } catch (e: any) {
    return { error: e.message || 'Failed to fetch data' };
  }
}

function generateLocalAnalysis(
  metrics: any, zonesText: string, supplyDemandZones: any[], microMetrics: any, microTF: string,
  settings: StrategySettings, type: MarketType, lang: string, symbol: string, timeframe: string, infantLimit: number, matureLimit: number, oldLimit: number,
  contextFearGreed?: { value: number; classification: string } | null
): AnalysisResult {
  const minAge = settings?.minTrendAge ?? 2;
  const age = metrics?.age || 0;
  const totalAge = metrics?.totalAge || 0;
  let primaryScore = 0;
  let supportScore = 0;
  let supportAligned = 0;
  let supportTotal = 0;
  const reasons: any[] = [];
  const direction = metrics?.direction || 'sideways';
  const isUp = direction === 'uptrend';
  const isDown = direction === 'downtrend';

  let bbPullbackMet = false;
  let supplyDemandMet = false;
  let trendAgeMet = false;
  let newsMet = false;

  // ΓöÇΓöÇ PRIMARY 1: BB Pullback ΓöÇΓöÇ
  if (metrics?.bbLower > 0 && metrics?.bbUpper > 0) {
    const bbPct = Math.round(metrics.bbPercentB * 100);
    if (isUp && metrics.bbTouchLower && metrics.bbPullbackCount >= 3 && metrics.bbPullbackCount <= 6 && (metrics.hasHammer || metrics.hasPinbar || metrics.hasEngulfing || metrics.hasBullishCandle)) {
      primaryScore += 3; bbPullbackMet = true;
      reasons.push({ check: 'BB Pullback (BUY)', value: `Pullback ${metrics.bbPullbackCount}c ΓåÆ Lower + Reversal`, status: 'positive', impact: 'strong: trend up + pullback + reversal', primary: true });
    } else if (isDown && metrics.bbTouchUpper && metrics.bbPullbackCount >= 3 && metrics.bbPullbackCount <= 6 && (metrics.hasShootingStar || metrics.hasPinbar || metrics.hasEngulfing || metrics.hasBearishCandle)) {
      primaryScore -= 3; bbPullbackMet = true;
      reasons.push({ check: 'BB Pullback (SELL)', value: `Rally ${metrics.bbPullbackCount}c ΓåÆ Upper + Reversal`, status: 'negative', impact: 'strong: trend down + rally + reversal', primary: true });
    } else {
      reasons.push({ check: 'BB Pullback', value: `No pullback ΓÇö ${bbPct}%B`, status: 'neutral', impact: 'BB pullback not met', primary: true });
    }
  }

  // ΓöÇΓöÇ PRIMARY 2: Supply/Demand ΓöÇΓöÇ
  if (supplyDemandZones?.length > 0) {
    const z = supplyDemandZones[0];
    if ((z.type === 'demand' && isUp) || (z.type === 'supply' && isDown)) {
      primaryScore += z.type === 'demand' ? 2 : -2; supplyDemandMet = true;
      reasons.push({ check: 'Supply/Demand', value: `${z.type === 'supply' ? 'Supply' : 'Demand'} ${z.bottom.toFixed(2)}-${z.top.toFixed(2)}`, status: z.type === 'demand' ? 'positive' : 'negative', impact: `zone confirms direction`, primary: true });
    } else {
      reasons.push({ check: 'Supply/Demand', value: `${z.type} zone vs ${direction}`, status: 'neutral', impact: 'zone conflicts with trend', primary: true });
    }
  } else {
    supplyDemandMet = true;
    reasons.push({ check: 'Supply/Demand', value: 'No zones detected', status: 'neutral', impact: 'no zones ΓÇö signal allowed', primary: true });
  }

  // ΓöÇΓöÇ PRIMARY 3: Trend Age ΓöÇΓöÇ
  if (totalAge >= matureLimit && totalAge <= oldLimit) {
    trendAgeMet = true;
    reasons.push({ check: 'Trend Age', value: `${totalAge}c ΓÇö Mature`, status: 'positive', impact: 'trend mature ΓÇö full signal', primary: true });
  } else if (totalAge < infantLimit) {
    reasons.push({ check: 'Trend Age', value: `${totalAge}c ΓÇö Infant`, status: 'negative', impact: 'trend too young ΓÇö low confidence', primary: true });
  } else if (totalAge < matureLimit) {
    trendAgeMet = true;
    reasons.push({ check: 'Trend Age', value: `${totalAge}c ΓÇö Youth`, status: 'positive', impact: 'trend developing ΓÇö allowed', primary: true });
  } else {
    reasons.push({ check: 'Trend Age', value: `${totalAge}c ΓÇö Old`, status: 'negative', impact: 'trend exhausting', primary: true });
  }

  // ΓöÇΓöÇ PRIMARY 3b: Pre-Pullback Age ΓöÇΓöÇ
  const minPreAge = settings?.minPrePullbackAge ?? 15;
  const maxPreAge = settings?.maxPrePullbackAge ?? 50;
  const prePullbackAgeVal = metrics?.prePullbackAge ?? 0;
  let prePullbackAgeMet = false;
  if (prePullbackAgeVal < minPreAge) {
    // Short (صغير) — white — too short for signals
    reasons.push({ check: 'Pre-Pullback Age', value: `${prePullbackAgeVal}c ΓÇö صغير (أقل من ${minPreAge})`, status: 'neutral', impact: 'trend before pullback too short ΓÇö neutral only', primary: true });
  } else if (prePullbackAgeVal >= minPreAge && prePullbackAgeVal <= maxPreAge) {
    // Young (شاب) — green — STRONG signals allowed
    prePullbackAgeMet = true;
    reasons.push({ check: 'Pre-Pullback Age', value: `${prePullbackAgeVal}c ΓÇö شاب (${minPreAge}-${maxPreAge})`, status: 'positive', impact: 'trend healthy ΓÇö STRONG signals allowed', primary: true });
  } else {
    // Mature (كهل) — red — exhausted, no signals
    reasons.push({ check: 'Pre-Pullback Age', value: `${prePullbackAgeVal}c ΓÇö كهل (أكثر من ${maxPreAge})`, status: 'negative', impact: 'trend exhausted ΓÇö neutral only', primary: true });
  }

  // ΓöÇΓöÇ PRIMARY 4: News ΓöÇΓöÇ
  newsMet = true;
  reasons.push({ check: 'News Sentiment', value: 'No active events', status: 'neutral', impact: 'no blocking news', primary: true });

  // ΓöÇΓöÇ SUPPORTING: RSI ΓöÇΓöÇ
  if (metrics?.rsi !== undefined) {
    supportTotal++;
    if (metrics.rsi < 30) { 
      if (isUp && metrics.direction === 'uptrend') {
        supportScore += 1; supportAligned++; 
        reasons.push({ check: 'RSI', value: metrics.rsi.toFixed(1), status: 'positive', impact: 'oversold in uptrend — potential bounce' }); 
      } else if (isDown || metrics.direction === 'downtrend') {
        supportScore -= 0.5; // continuation signal in downtrend, NOT buy
        reasons.push({ check: 'RSI', value: metrics.rsi.toFixed(1), status: 'negative', impact: 'oversold in downtrend — momentum continuation, NOT buy' });
      } else {
        reasons.push({ check: 'RSI', value: metrics.rsi.toFixed(1), status: 'neutral', impact: 'oversold — waiting for direction confirmation' });
      }
    }
    else if (metrics.rsi > 70) { supportScore -= 1; if (isDown) supportAligned++; reasons.push({ check: 'RSI', value: metrics.rsi.toFixed(1), status: 'negative', impact: 'overbought ΓÇö supports sell' }); }
    else { reasons.push({ check: 'RSI', value: metrics.rsi.toFixed(1), status: 'neutral', impact: 'neutral zone' }); }
  }

  // ΓöÇΓöÇ SUPPORTING: EMA Cross ΓöÇΓöÇ
  if (metrics?.emaCross === 'bullish') { supportScore += 1; supportTotal++; if (isUp) supportAligned++; reasons.push({ check: 'EMA Cross', value: 'bullish', status: 'positive', impact: 'bullish cross supports up' }); }
  else if (metrics?.emaCross === 'bearish') { supportScore -= 1; supportTotal++; if (isDown) supportAligned++; reasons.push({ check: 'EMA Cross', value: 'bearish', status: 'negative', impact: 'bearish cross supports down' }); }

  // ΓöÇΓöÇ SUPPORTING: Trend Direction ΓöÇΓöÇ
  if (isUp) { supportScore += 0.5; supportTotal++; supportAligned++; reasons.push({ check: 'Trend Direction', value: 'uptrend', status: 'positive', impact: 'price making higher highs' }); }
  else if (isDown) { supportScore -= 0.5; supportTotal++; supportAligned++; reasons.push({ check: 'Trend Direction', value: 'downtrend', status: 'negative', impact: 'price making lower lows' }); }
  else { supportTotal++; reasons.push({ check: 'Trend Direction', value: 'sideways', status: 'neutral', impact: 'no clear direction' }); }

  // ΓöÇΓöÇ SUPPORTING: Volume ΓöÇΓöÇ
  if (metrics?.volSurge) { supportTotal++; supportScore += isUp ? 0.5 : isDown ? -0.5 : 0; reasons.push({ check: 'Volume Surge', value: 'true', status: isUp ? 'positive' : isDown ? 'negative' : 'neutral', impact: 'confirms momentum' }); }

  // ΓöÇΓöÇ SUPPORTING: Fear&Greed (Contrarian) ΓöÇΓöÇ
  if (contextFearGreed?.value !== undefined) {
    supportTotal++;
    const fg = contextFearGreed.value;
    if (fg <= 25) { 
      if (isUp || !isDown) {
        supportScore += 0.5; supportAligned++; // reduced from 1.5 to 0.5
        reasons.push({ check: 'Fear&Greed', value: `${fg}/100 ΓÇö ${contextFearGreed.classification}`, status: 'positive', impact: 'extreme fear ΓÇö contrarian buy signal (weak)' }); 
      } else {
        reasons.push({ check: 'Fear&Greed', value: `${fg}/100 ΓÇö ${contextFearGreed.classification}`, status: 'neutral', impact: 'extreme fear but downtrend ΓÇö caution' }); 
      }
    }
    else if (fg >= 75) { 
      if (isDown || !isUp) {
        supportScore -= 0.5; supportAligned++; // reduced from 1.5 to 0.5
        reasons.push({ check: 'Fear&Greed', value: `${fg}/100 ΓÇö ${contextFearGreed.classification}`, status: 'negative', impact: 'extreme greed ΓÇö contrarian sell signal (weak)' }); 
      } else {
        reasons.push({ check: 'Fear&Greed', value: `${fg}/100 ΓÇö ${contextFearGreed.classification}`, status: 'neutral', impact: 'extreme greed but uptrend ΓÇö caution' }); 
      }
    }
    else { reasons.push({ check: 'Fear&Greed', value: `${fg}/100 ΓÇö ${contextFearGreed.classification}`, status: 'neutral', impact: 'neutral sentiment' }); }
  }

  // ΓöÇΓöÇ SUPPORTING: Micro Alignment ΓöÇΓöÇ
  if (microMetrics) {
    supportTotal++;
    const microAligned = (microMetrics.emaCross === 'bullish' && isUp) || (microMetrics.emaCross === 'bearish' && isDown);
    if (microAligned) { supportAligned++; supportScore += isUp ? 0.5 : -0.5; }
    reasons.push({ check: 'Micro Alignment', value: microAligned ? 'aligned' : 'diverging', status: microAligned ? 'positive' : 'neutral', impact: microAligned ? 'micro confirms macro' : 'micro diverging' });
  }

  // ΓöÇΓöÇ Compute Score ΓöÇΓöÇ
  const totalScore = primaryScore + supportScore;
  const primaryMetCount = [bbPullbackMet, supplyDemandMet, trendAgeMet, newsMet].filter(Boolean).length;

  // ΓöÇΓöÇ Sideways penalty: need strong evidence to trade ΓöÇΓöÇ
  const hasStrongEvidence = Math.abs(primaryScore) >= 2 || Math.abs(supportScore) >= 2;

  const baseConf = settings?.baseConfidence ?? 30;
  const strongThresh = settings?.strongThreshold ?? 60;
  const buyThresh = settings?.buyThreshold ?? 40;
  const maxPrimary = (settings?.primaryBBWeight ?? 15) + (settings?.primarySDWeight ?? 15) + (settings?.primaryAgeWeight ?? 10) + (settings?.primaryNewsWeight ?? 10);
  const maxSupport = (settings?.supportRSIWeight ?? 5) + (settings?.supportEMAWeight ?? 5) + (settings?.supportDirWeight ?? 3) + (settings?.supportVolWeight ?? 2) + (settings?.supportMicroBBWeight ?? 3) + (settings?.supportMicroAlignWeight ?? 2);

  const supportRatio = supportTotal > 0 ? supportAligned / supportTotal : 0;
  const primaryConf = maxPrimary > 0 ? Math.round(Math.abs(primaryScore) / 5 * maxPrimary) : 0;
  const supportConf = supportTotal > 0 ? Math.round(supportRatio * maxSupport) : 0;
  let confidence = Math.min(100, primaryConf + supportConf + baseConf);

  // ΓöÇΓöÇ Signal classification ΓöÇΓöÇ
  let rawSignal: SignalType;

  // Sideways + no strong evidence = NEUTRAL
  const CONF_BUFFER = 5; // Confidence buffer to prevent borderline flips
  if (!isUp && !isDown && !hasStrongEvidence) {
    rawSignal = SignalType.NEUTRAL;
    confidence = Math.min(confidence, 35);
  } else if (totalScore > 0 && primaryMetCount >= 3) {
    if (confidence >= (strongThresh - CONF_BUFFER) && bbPullbackMet && prePullbackAgeMet) rawSignal = SignalType.STRONG_BUY;
    else if (confidence >= (buyThresh - CONF_BUFFER)) rawSignal = SignalType.BUY;
    else rawSignal = SignalType.NEUTRAL;
  } else if (totalScore < 0 && primaryMetCount >= 3) {
    if (confidence >= (strongThresh - CONF_BUFFER) && bbPullbackMet && prePullbackAgeMet) rawSignal = SignalType.STRONG_SELL;
    else if (confidence >= (buyThresh - CONF_BUFFER)) rawSignal = SignalType.SELL;
    else rawSignal = SignalType.NEUTRAL;
  } else {
    rawSignal = SignalType.NEUTRAL;
    confidence = Math.min(confidence, buyThresh - 1);
  }

  // Age zone caps
  if (totalAge < infantLimit) { confidence = Math.round(confidence * 0.7); rawSignal = rawSignal === SignalType.STRONG_BUY ? SignalType.BUY : rawSignal === SignalType.STRONG_SELL ? SignalType.SELL : rawSignal; }
  else if (totalAge < matureLimit) { /* Youth — ONLY zone allowing STRONG */ confidence = Math.round(confidence * 0.85); }
  else if (totalAge > oldLimit) { confidence = Math.round(confidence * 0.75); }
  if (age < minAge) confidence = Math.round(confidence * 0.8);

  // Pre-Pullback Age filter: if trend before pullback is too short (<min) or too long (>max), force NEUTRAL
  if (prePullbackAgeVal < minPreAge || prePullbackAgeVal > maxPreAge) {
    rawSignal = SignalType.NEUTRAL;
    confidence = Math.min(confidence, 30);
  }

  const minConf = settings?.minConfidence || 45;
  if (confidence < minConf) rawSignal = SignalType.NEUTRAL;

  const dir = metrics?.direction || 'sideways';
  const summary = lang === 'ar'
    ? `\u0645\u0644\u062e\u0635 \u0627\u0644\u062a\u062d\u0644\u064a\u0644: ${symbol} \u2014 ${dir === 'uptrend' ? '\u0627\u062a\u062c\u0627\u0647 \u0635\u0627\u0639\u062f' : dir === 'downtrend' ? '\u0627\u062a\u062c\u0627\u0647 \u0647\u0627\u0628\u0637' : '\u0627\u0633\u062a\u0642\u0628\u0627\u0644 \u0627\u0644\u0627\u062a\u062c\u0627\u0647'}. RSI ${metrics?.rsi?.toFixed(1) || 'N/A'}. \u0627\u0644\u062b\u0642\u0629: ${confidence}%.`
    : `Analysis: ${symbol} ΓÇö ${dir} trend. RSI ${metrics?.rsi?.toFixed(1) || 'N/A'}. Confidence: ${confidence}%.`;

  return {
    symbol, type, timeframe,
    signal: rawSignal, confidence, summary, detailedReasons: reasons,
    microSignal: 'unknown', microTrend: '', technicalScore: Math.round(totalScore * 16.7 + 50),
    sentimentScore: contextFearGreed?.value ?? 50, historicalMatch: '',
    timestamp: new Date().toISOString(),
    userId: '',
    primaryMetCount,
    direction: dir,
  };
}

export async function analyzeMarketBatch(
  paramsList: { symbol: string; type: MarketType; timeframe: string; tradingStyle: TradingStyle }[],
  settings: StrategySettings,
  lang: string,
  onProgress?: (current: string, total: number, index: number, failed?: number) => void
): Promise<{ results: AnalysisResult[]; errors: { symbol: string; error: string }[] }> {
  const results: AnalysisResult[] = [];
  const errors: { symbol: string; error: string }[] = [];
  const total = paramsList.length;
  const BATCH_SIZE = 3;

  async function analyzeOne(p: { symbol: string; type: MarketType; timeframe: string; tradingStyle: TradingStyle }, idx: number): Promise<void> {
    let lastError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 3000));
        await waitIfRateLimited();
        const result = await analyzeMarket({ symbol: p.symbol, type: p.type, timeframe: p.timeframe, tradingStyle: p.tradingStyle, settings, lang });
        console.log(`[Batch] ${p.symbol} ΓåÆ ${result.signal} (${result.confidence}%)`);
        results.push(result);
        lastError = null;
        break;
      } catch (e: any) {
        lastError = e;
        console.warn(`[Batch] Attempt ${attempt + 1} FAILED ${p.symbol}:`, e.message);
      }
    }
    if (lastError) errors.push({ symbol: p.symbol, error: lastError.message || 'Analysis failed' });
  }

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = paramsList.slice(i, i + BATCH_SIZE);
    if (onProgress) onProgress(batch[0].symbol, total, i, errors.length);
    await Promise.all(batch.map((p, j) => analyzeOne(p, i + j)));
    if (i + BATCH_SIZE < total) await new Promise(r => setTimeout(r, 800));
  }

  return { results, errors };
}

export async function analyzeMarket(params: {
  symbol: string;
  type: MarketType;
  timeframe: string;
  tradingStyle: TradingStyle;
  settings?: StrategySettings;
  lang?: string;
}): Promise<AnalysisResult> {
  const { symbol, type, timeframe, tradingStyle, settings = DEFAULT_STRATEGY_SETTINGS, lang = 'en' } = params;

  // Check result cache first
  const cacheKey = `${symbol}_${timeframe}_${tradingStyle}_${JSON.stringify(settings)}`;
  const cached = _resultCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < RESULT_CACHE_TTL) {
    return cached.result;
  }

  try {
    const TF_PROGRESSION = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M', '1Y'];
    const currentIndex = TF_PROGRESSION.indexOf(timeframe);
    const macro1 = TF_PROGRESSION[Math.min(currentIndex + 1, TF_PROGRESSION.length - 1)];
    
    const macro2 = TF_PROGRESSION[Math.min(currentIndex + 2, TF_PROGRESSION.length - 1)];
    const microTF = currentIndex > 0 ? TF_PROGRESSION[currentIndex - 1] : TF_PROGRESSION[0];

    // Fetch ALL data sources in PARALLEL ΓÇö saves ~10-15s per symbol
    const [rawData, microDataRaw, ctxResult, macroDataRaw] = await Promise.all([
      fetchMarketDataDirect(symbol, timeframe).catch(() => ({ chart: { result: [{ indicators: { quote: [{}] } }] } })),
      fetchMarketDataDirect(symbol, microTF).catch(() => ({ chart: { result: [{ indicators: { quote: [{}] } }] } })),
      fetchMarketContext(symbol).catch(() => ({ fearGreed: null, news: [], econEvents: [] })),
      fetchMarketDataDirect(symbol, macro1).catch(() => ({ chart: { result: [{ indicators: { quote: [{}] } }] } })),
    ]);

    let contextFearGreed = ctxResult.fearGreed;
    let contextNews: { title: string; source: string }[] = ctxResult.news || [];
    let contextEcon: any[] = ctxResult.econEvents || [];

    const quotes = rawData.chart?.result?.[0]?.indicators?.quote?.[0];
    
    if (!quotes || !quotes.close) {
      throw new Error("Market data currently unavailable from the source.");
    }

    const closes = quotes.close.filter((c: any) => c != null);
    const highsRaw2 = quotes.high.filter((c: any) => c != null);
    const lowsRaw2 = quotes.low.filter((c: any) => c != null);
    const highs = highsRaw2.length >= closes.length ? highsRaw2 : closes;
    const lows = lowsRaw2.length >= closes.length ? lowsRaw2 : closes;
    const volumes = quotes.volume?.filter((v: any) => v != null);
    const rawOpens2 = quotes.open?.filter((c: any) => c != null) || closes;
    const opens = rawOpens2.length >= closes.length ? rawOpens2 : closes;

    if (closes.length < 10) {
      throw new Error(`Insufficient data for ${symbol}.`);
    }

    const metrics = calculateTechnicalMetrics(closes, highs, lows, volumes, opens);
    const supplyDemandZones = calculateSupplyDemandZones(highs, lows, volumes || [], closes);
    const zonesText = supplyDemandZones.length > 0 
      ? supplyDemandZones.map(z => `${z.type === 'supply' ? 'Supply' : 'Demand'} zone: ${z.bottom.toFixed(2)}ΓÇô${z.top.toFixed(2)} (strength ${z.strength.toFixed(0)}%)`).join('. ')
      : 'No clear zones detected.';
    
    // Process micro data (already fetched in parallel above)
    let microCloses: number[] = [];
    let microMetrics = null;
    try {
      const microQuotes = microDataRaw.chart?.result?.[0]?.indicators?.quote?.[0];
      if (microQuotes && microQuotes.close) {
        microCloses = microQuotes.close.filter((c: any) => c != null);
        const microHighsRaw = microQuotes.high?.filter((c: any) => c != null) || microCloses;
        const microLowsRaw = microQuotes.low?.filter((c: any) => c != null) || microCloses;
        const microOpensRaw = microQuotes.open?.filter((c: any) => c != null) || microCloses;
        const microVolsRaw = microQuotes.volume?.filter((c: any) => c != null) || [];
        if (microCloses.length >= 10) {
          microMetrics = calculateTechnicalMetrics(microCloses, microHighsRaw, microLowsRaw, microVolsRaw.length > 0 ? microVolsRaw : undefined, microOpensRaw);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch micro timeframe data:", e);
    }

    // Compute MACRO direction (higher timeframe trend)
    let macroDirection: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
    try {
      const macroQuotes = macroDataRaw.chart?.result?.[0]?.indicators?.quote?.[0];
      if (macroQuotes && macroQuotes.close) {
        const macroCloses = macroQuotes.close.filter((c: any) => c != null);
        if (macroCloses.length >= 10) {
          const macroMetrics = calculateTechnicalMetrics(macroCloses, 
            (macroQuotes.high || []).filter((c: any) => c != null), 
            (macroQuotes.low || []).filter((c: any) => c != null), 
            (macroQuotes.volume || []).filter((c: any) => c != null), 
            (macroQuotes.open || []).filter((c: any) => c != null));
          macroDirection = macroMetrics?.direction || 'sideways';
        }
      }
    } catch (e) {
      console.warn("Failed to compute macro direction:", e);
    }
    const isMacroUp = macroDirection === 'uptrend';
    const isMacroDown = macroDirection === 'downtrend';
    
    const newsText = contextNews.length > 0
      ? contextNews.map(n => `ΓÇó ${n.title} (${n.source})`).join('\n')
      : 'No recent news available.';
    const eventsText = contextEcon.length > 0
      ? contextEcon.map(e => `ΓÇó ${e.country} | ${e.title} | Impact: ${e.impact} | Forecast: ${e.forecast} | Previous: ${e.previous}`).join('\n')
      : 'No major economic events this week.';

    const isAr = lang === 'ar';
    const technicalPrompt = `You are an Elite Institutional Trader (ICT/SMC). Analyze ${symbol} (${type}, ${timeframe}, ${tradingStyle}) and return a JSON trading decision.

MARKET DATA: RSI ${metrics?.rsi?.toFixed(1)}, Trend ${metrics?.direction}, EMA Cross ${metrics?.emaCross}, Vol Surge ${metrics?.volSurge}, Trend Length ${metrics?.totalAge}c, Momentum ${metrics?.age}c.

BOLLINGER BANDS: Upper ${metrics?.bbUpper?.toFixed(4) || 'N/A'}, Middle ${metrics?.bbMiddle?.toFixed(4) || 'N/A'}, Lower ${metrics?.bbLower?.toFixed(4) || 'N/A'}, %B ${metrics?.bbPercentB ? Math.round(metrics.bbPercentB * 100) : 'N/A'}%, Width ${metrics?.bbWidth ? metrics.bbWidth.toFixed(4) : 'N/A'}.
BB STRATEGY: Pullback ${metrics?.bbPullbackCount || 0} candles, TouchLower ${metrics?.bbTouchLower || false}, TouchUpper ${metrics?.bbTouchUpper || false}, Hammer ${metrics?.hasHammer || false}, Pinbar ${metrics?.hasPinbar || false}, Engulfing ${metrics?.hasEngulfing || false}, ShootingStar ${metrics?.hasShootingStar || false}.

MICRO (${microTF}): RSI ${microMetrics?.rsi ? microMetrics.rsi.toFixed(1) : 'N/A'}, Trend ${microMetrics?.direction || 'sideways'}, EMA ${microMetrics?.emaCross || 'unknown'}, BB Upper ${microMetrics?.bbUpper?.toFixed(4) || 'N/A'}, BB Lower ${microMetrics?.bbLower?.toFixed(4) || 'N/A'}, BB %B ${microMetrics?.bbPercentB ? Math.round(microMetrics.bbPercentB * 100) : 'N/A'}%, TouchLower ${microMetrics?.bbTouchLower || false}, TouchUpper ${microMetrics?.bbTouchUpper || false}, Pullback ${microMetrics?.bbPullbackCount || 0}c, Hammer ${microMetrics?.hasHammer || false}, Pinbar ${microMetrics?.hasPinbar || false}, Engulfing ${microMetrics?.hasEngulfing || false}.

CONTEXT: Fear&Greed ${contextFearGreed?.value ?? 'N/A'}/100 (${contextFearGreed?.classification ?? 'Unknown'}). News: ${newsText.substring(0, 300)}. Events: ${eventsText.substring(0, 200)}.

SETTINGS: NewsGuard ${settings.useNewsGuard ? 'ON' : 'OFF'}, Volume ${settings.useVolumeAnalysis ? 'ON' : 'OFF'}, HigherTF ${settings.useHigherTimeframe ? 'ON' : 'OFF'}, Indicators ${settings.useIndicators ? 'ON' : 'OFF'}.

SUPPLY & DEMAND ZONES: ${zonesText}

RULES:
- 4 PRIMARY CONDITIONS (must ALL be favorable for strong signal):
  1. BB Pullback: trend + 3-6 pullback candles + touch BB + reversal candle ΓåÆ STRONG BUY/SELL
  2. Supply/Demand: demand zone + uptrend = confirms buy; supply zone + downtrend = confirms sell
  3. Trend Age: <10 infant (reduce confidence), <25 youth, 25-50 mature (full strength), >50 old (reduced)
  4. News Sentiment: negative news blocks strong signal; no news = allowed
- ONLY "strong_buy"/"strong_sell" if ALL 4 primary conditions are favorable + micro (${microTF}) aligned.
- If any primary condition fails ΓåÆ "buy"/"sell" (not strong).
- Supporting conditions (RSI, EMA, Volume, Micro BB) add boost only.
- BOLLINGER BANDS STRATEGY: If trend is UP and price pulled back 3-6 candles to touch Lower BB (or within 1.5%) + reversal candle ΓåÆ STRONG BUY. If trend is DOWN and price rallied 3-6 candles to touch Upper BB (or within 1.5%) + reversal candle ΓåÆ STRONG SELL.
- MICRO BB STRATEGY: Same conditions on micro timeframe ΓåÆ adds +2 boost.

CRITICAL CONTRARIAN RULES:
- Fear&Greed Γëñ 25 (EXTREME FEAR): This is a CONTRARIAN BUY signal. Strongly prefer "buy" or "strong_buy". Do NOT give "sell" unless there is overwhelming bearish evidence (all 4 primary conditions met for sell).
- Fear&Greed ΓëÑ 75 (EXTREME GREED): This is a CONTRARIAN SELL signal. Strongly prefer "sell" or "strong_sell". Do NOT give "buy" unless there is overwhelming bullish evidence.
- Fear&Greed 26-40 (Fear): Mild contrarian buy bias. Prefer "buy" over "sell" when indicators are mixed.
- Fear&Greed 60-74 (Greed): Mild contrarian sell bias. Prefer "sell" over "buy" when indicators are mixed.
- Trend "sideways" with no clear direction: Default to "neutral" unless there is a very strong setup (BB pullback + volume + micro alignment).
- Trend Age < 10 (Infant): Significantly reduce confidence. The trend is unreliable. "buy"/"sell" only if indicators are strongly aligned.

LANGUAGE RULES (CRITICAL):
${isAr ? `- ALL text fields (summary, detailedReasons impact) MUST be written in formal Arabic (\u0639\u0631\u0628\u064a) using professional financial terminology.
- Use terms like: \u0627\u0644\u0632\u062e\u0645 \u0627\u0644\u0627\u062a\u062c\u0627\u0647 \u0627\u0644\u0645\u0631\u062a\u0641\u0639 \u0644\u062d\u0638\u0629 \u0627\u0644\u0639\u0631\u0636 \u0648\u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0646\u0638\u0627\u0645\u064a \u0627\u0644\u0645\u0647\u0646\u064a.
- DO NOT use English words mixed in Arabic text.
- DO NOT repeat the same phrase in different reasons. Each reason must be unique and specific.
- Keep each impact field under 12 words. Be precise and concise.` : `- Write summary in clear, professional English. Keep under 2-3 sentences.
- Each impact field max 15 words, precise and professional.`}

CRITICAL RULES FOR detailedReasons:
- Each "impact" must be SHORT and SPECIFIC to that exact indicator.
- Each "check" must name the indicator (RSI, EMA Cross, Trend Direction, etc.)
- Each "value" must show the actual value
- Each "status" must be exactly: "positive", "negative", or "neutral"
- Do NOT repeat similar phrases across different reasons.
- Do NOT write vague or garbled text.

Return ONLY valid JSON:
{
  "signal": "strong_buy"|"buy"|"neutral"|"sell"|"strong_sell"|"no_entry",
  "confidence": number (0-100),
  "summary": "string ΓÇö 2-3 sentence summary",
  "detailedReasons": [
    {"check": "RSI", "value": "62.5", "status": "neutral", "impact": "${isAr ? '\u0627\u0644\u0632\u062e\u0645 \u0645\u062a\u0648\u0627\u0632\u0646 \u0644\u0627 \u0642\u0631\u0627\u0626\u0637 \u0645\u0637\u0644\u0642\u0629' : 'Momentum balanced, no extreme reading'}"},
    {"check": "EMA Cross", "value": "bullish", "status": "positive", "impact": "${isAr ? '\u0627\u0644\u0645\u062a\u0646\u0627\u0633\u0642 9 \u0641\u0648\u0642 9 \u0627\u0644\u0645\u062a\u0646\u0627\u0633\u0642 21 \u064a\u062f\u0639\u0645 \u0627\u0644\u0627\u062a\u062c\u0627\u0647 \u0627\u0644\u0635\u0627\u0639\u062f' : '9 EMA above 21 EMA supports upward bias'}"},
    {"check": "Trend Direction", "value": "uptrend", "status": "positive", "impact": "${isAr ? '\u0627\u0644\u0633\u0639\u0631 \u064a\u0635\u0646\u0639 \u0642\u0645\u0648\u0627\u062a \u0623\u0639\u0644\u0649 \u0648\u0646\u0642\u0627\u0637 \u0623\u0639\u0644\u0649' : 'Price making higher highs and higher lows'}"},
    {"check": "Trend Age Zone", "value": "mature (32c)", "status": "positive", "impact": "${isAr ? '\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0646\u0636\u062c \u062a\u0633\u0645\u062d \u0628\u0627\u0644\u062b\u0642\u0629 \u0627\u0644\u0643\u0627\u0645\u0644\u0629' : 'Mature zone allows full confidence'}"},
    {"check": "Volume Surge", "value": "true", "status": "positive", "impact": "${isAr ? '\u0627\u0632\u062f\u062d\u0627\u0632 \u0627\u0644\u062d\u062c\u0645 \u064a\u062a\u0623\u0643\u062f \u0627\u0644\u0643\u0633\u0631 \u0627\u0644\u0645\u0647\u0646\u064a' : 'Volume spike confirms breakout momentum'}"},
    {"check": "Supply/Demand", "value": "demand 1.085", "status": "positive", "impact": "${isAr ? '\u0627\u0644\u0633\u0639\u0631 \u064a\u0633\u062a\u0648\u064a \u0639\u0644\u0649 \u0645\u0646\u0637\u0642\u0629 \u0637\u0644\u0628 \u0642\u0648\u064a\u0629' : 'Price resting on strong demand zone'}"},
    {"check": "Micro Alignment", "value": "aligned", "status": "positive", "impact": "${isAr ? '\u0627\u0644\u0625\u0637\u0627\u0631 \u0627\u0644\u0632\u0645\u0646\u064a \u0627\u0644\u0635\u063a\u064a\u0631 \u064a\u062a\u0623\u0643\u062f \u0627\u0644\u0627\u062a\u062c\u0627\u0647 \u0627\u0644\u0631\u0626\u064a\u0633\u064a' : 'Lower timeframe confirms macro direction'}"},
    {"check": "Fear&Greed", "value": "45/100", "status": "neutral", "impact": "${isAr ? '\u0645\u0648\u0627\u0644\u0641\u0629 \u0627\u0644\u0633\u0648\u0642 \u0645\u062a\u0648\u0627\u0632\u0646\u0629 \u0644\u0627 \u0642\u0631\u0627\u0626\u0637' : 'Market sentiment balanced, no extreme'}"},
    {"check": "News Sentiment", "value": "2 positive", "status": "positive", "impact": "${isAr ? '\u062a\u062f\u0641\u0639 \u0623\u062e\u0628\u0627\u0631 \u0645\u0639\u062f\u064a\u0629 \u064a\u062f\u0639\u0645 \u0627\u0644\u0627\u062a\u062c\u0627\u0647' : 'Favorable news flow supports direction'}"},
    {"check": "Economic Events", "value": "none", "status": "neutral", "impact": "${isAr ? '\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u062d\u062f\u0627\u062b \u0627\u0644\u062a\u0623\u062b\u064a\u0631 \u0627\u0644\u0639\u0627\u0644\u064a\u0629 \u0627\u0644\u0642\u0627\u062f\u0645\u0629' : 'No upcoming high-impact events'}"},
  ],
  "technicalScore": number,
  "sentimentScore": number,
  "historicalMatch": "string",
  "microSignal": "pullback"|"aligned"|"unknown",
  "microTrend": "string",
  "stopLoss": number,
  "takeProfit": number
}`;

    const keyValue = getApiKey() || '';
    if (keyValue) mirrorApiKey(keyValue);

    // Age zone limits ΓÇö needed by local fallback
    const totalAge = metrics?.totalAge || 0;
    const age = metrics?.age || 0;
    const isCrypto = type === MarketType.CRYPTO;
    const minAge = settings?.minTrendAge ?? 2;
    const infantAgeThreshold = settings?.minInfantAge ?? 10;
    const matureAgeThreshold = settings?.minMatureAge ?? 25;
    const oldAgeThreshold = settings?.maxMatureAge ?? 50;
    const infantLimit = isCrypto ? infantAgeThreshold * 2 : infantAgeThreshold;
    const matureLimit = isCrypto ? matureAgeThreshold * 2 : matureAgeThreshold;
    const oldLimit = isCrypto ? oldAgeThreshold * 2 : oldAgeThreshold;

    let aiResponse: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      await waitIfRateLimited();
      aiResponse = await callAIDirect(technicalPrompt, keyValue);
      if (!aiResponse?.error) break;
      if (aiResponse.error === 'rate_limited') { onRateLimited(); await new Promise(r => setTimeout(r, 8000)); continue; }
      if (attempt < 1) await new Promise(r => setTimeout(r, 2000));
    }

    if (!aiResponse || aiResponse?.error) {
      console.warn(`[Engine] AI unavailable for ${symbol}, using local analysis:`, aiResponse?.error);
      return generateLocalAnalysis(metrics, zonesText, supplyDemandZones, microMetrics, microTF, settings, type, lang, symbol, timeframe, infantLimit, matureLimit, oldLimit, contextFearGreed);
    }

    if (!aiResponse?.choices?.[0]?.message?.content) {
      console.warn(`[Engine] AI returned no content for ${symbol}, using local analysis`);
      return generateLocalAnalysis(metrics, zonesText, supplyDemandZones, microMetrics, microTF, settings, type, lang, symbol, timeframe, infantLimit, matureLimit, oldLimit, contextFearGreed);
    }

    const rawText = aiResponse.choices[0].message.content;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI Synthesis Error: Invalid JSON structure.");
    
    const resultData = JSON.parse(jsonMatch[0]);

    // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
    // LOCKED (v6): SIGNAL ENGINE RULES ΓÇö DO NOT MODIFY
    // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
    // RULE: ALL 4 primary conditions are MANDATORY for ANY signal.
    // RULE: BB Pullback (lenient): passes if BB exists + aligns with direction. Blocks only on active conflict.
    // RULE: Strict pullback (touch+3-6c+reversal) is for STRONG upgrade bonus, NOT for gate.
    // RULE: Primary conditions computed from METRICS, not AI text.
    // RULE: Supporting ratio <40% ΓåÆ NEUTRAL, 40-59% ΓåÆ regular, ΓëÑ60% ΓåÆ STRONG allowed.
    // RULE: Youth zone (10-25) is the ONLY zone allowing STRONG signals.
    // RULE: Supply/Demand ΓÇö no zones detected = pass (not block).
    // RULE: Conflict = 3+ buy reasons AND 3+ sell reasons ΓåÆ force NEUTRAL.
    // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

    // ΓöÇΓöÇ STEP 1: Build detailedReasons BEFORE any enforcement ΓöÇΓöÇ
    let detailedReasons: any[] = Array.isArray(resultData.detailedReasons) ? [...resultData.detailedReasons] : [];

    // Build fallback from metrics if AI didn't provide reasons
    if (detailedReasons.length === 0) {
      const addReason = (check: string, value: string, status: string, impact: string, source?: string) => {
        detailedReasons.push({ check, value, status, impact, source });
      };
      const rsiVal = metrics?.rsi;
      if (rsiVal !== undefined) {
        const rsiStatus = rsiVal > 70 ? 'negative' : rsiVal < 30 ? 
          (metrics?.direction === 'uptrend' ? 'positive' : metrics?.direction === 'downtrend' ? 'negative' : 'neutral') : 'neutral';
        addReason('RSI', rsiVal.toFixed(1), rsiStatus,
          rsiStatus === 'negative' ? (metrics?.direction === 'downtrend' && rsiVal < 30 ? 'oversold in downtrend — continuation, NOT buy' : 'overbought, caution') :
          rsiStatus === 'positive' ? 'oversold in uptrend — bounce potential' : 'neutral zone');
      }
      if (metrics?.emaCross) {
        const isBull = metrics.emaCross === 'bullish';
        addReason('EMA Cross', metrics.emaCross, isBull ? 'positive' : 'negative',
          isBull ? 'supports upward bias' : 'supports downward bias');
      }
      if (metrics?.direction) {
        const isUp = metrics.direction === 'uptrend';
        addReason('Trend Direction', metrics.direction,
          isUp ? 'positive' : metrics.direction === 'downtrend' ? 'negative' : 'neutral',
          isUp ? 'price making higher highs' :
          metrics.direction === 'downtrend' ? 'price making lower lows' : 'no clear direction');
      }
      if (metrics?.volSurge !== undefined) {
        addReason('Volume Surge', metrics.volSurge ? 'true' : 'false',
          metrics.volSurge ? 'positive' : 'neutral',
          metrics.volSurge ? 'confirms momentum' : 'normal volume');
      }
      if (microMetrics) {
        addReason('Micro TF Alignment', resultData.microSignal || 'unknown',
          resultData.microSignal === 'aligned' ? 'positive' : 'neutral',
          resultData.microSignal === 'aligned' ? 'micro aligns with macro' : 'micro diverging from macro');
      }
      const fg = contextFearGreed;
      if (fg?.value !== undefined) {
        const fgStatus = fg.value <= 25 ? 'positive' : fg.value >= 75 ? 'negative' : 'neutral';
        addReason('Fear & Greed', `${fg.value}/100 ΓÇö ${fg.classification || ''}`, fgStatus,
          fgStatus === 'positive' ? 'contrarian buy signal' :
          fgStatus === 'negative' ? 'extreme greed, cap confidence' : 'neutral sentiment');
      }
      if (contextNews.length > 0) {
        const sources = [...new Set(contextNews.map(n => n.source).filter(Boolean))];
        addReason('News Sentiment', `${contextNews.length} articles`, 'neutral', 'check summary for details', sources.join(', '));
      } else {
        addReason('News Sentiment', 'No active events', 'neutral', 'no blocking news ΓÇö signal allowed');
      }
      addReason('Economic Events', contextEcon.length > 0 ? `${contextEcon.length} events this week` : 'no major events',
        contextEcon.some((e: any) => e.impact === 'High') ? 'negative' : 'neutral',
        contextEcon.some((e: any) => e.impact === 'High') ? '-10% confidence penalty' : 'no penalty');
    }

    // ΓöÇΓöÇ STEP 1b: Trend Age Zone fallback reason ΓöÇΓöÇ
    if (!detailedReasons.some((r: any) => r.check?.includes('Trend Age'))) {
      const ageZoneDesc = totalAge < infantLimit ? `Infant (<${infantLimit})` :
        totalAge < matureLimit ? `Youth (${infantLimit}-${matureLimit})` :
        totalAge <= oldLimit ? `Mature (${matureLimit}-${oldLimit})` : `Old (>${oldLimit})`;
      const zoneStatus = totalAge >= matureLimit && totalAge <= oldLimit ? 'positive' :
        totalAge < infantLimit ? 'negative' : 'neutral';
      detailedReasons.push({
        check: 'Trend Age', value: `${totalAge}c ΓÇö ${ageZoneDesc}`, status: zoneStatus,
        impact: zoneStatus === 'positive' ? 'trend mature ΓÇö full signal allowed' :
          zoneStatus === 'negative' ? 'trend age issue ΓÇö confidence reduced' : 'trend developing'
      });
    }

    // ΓöÇΓöÇ STEP 1c: Supply/Demand fallback reason ΓöÇΓöÇ
    if (!detailedReasons.some((r: any) => r.check?.includes('Supply/Demand'))) {
      if (supplyDemandZones.length > 0) {
        const nearestZone = supplyDemandZones[0];
        const isUp = metrics?.direction === 'uptrend';
        const isDown = metrics?.direction === 'downtrend';
        const aligned = (nearestZone.type === 'demand' && isUp) || (nearestZone.type === 'supply' && isDown);
        detailedReasons.push({
          check: 'Supply/Demand',
          value: `${nearestZone.type === 'supply' ? 'Supply' : 'Demand'} ${nearestZone.bottom.toFixed(2)}-${nearestZone.top.toFixed(2)} (${Math.round(nearestZone.strength)}%)`,
          status: aligned ? 'positive' : 'negative',
          impact: `nearest ${nearestZone.type} zone ${aligned ? 'confirms direction' : 'conflicts with trend'}`
        });
      } else {
        detailedReasons.push({ check: 'Supply/Demand', value: 'No zones detected', status: 'neutral', impact: 'no supply/demand zones nearby' });
      }
    }

    // ΓöÇΓöÇ STEP 1d: BB Pullback fallback ΓÇö ON MICRO TF ΓöÇΓöÇ
    if (!detailedReasons.some((r: any) => r.check?.includes('BB Pullback') || r.check?.includes('BB Strategy'))) {
      if (microMetrics?.bbLower > 0) {
        const bbPct = Math.round(microMetrics.bbPercentB * 100);
        const isUp = metrics.direction === 'uptrend';
        const isDown = metrics.direction === 'downtrend';
        if (isUp && microMetrics.bbTouchLower && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 6 && (microMetrics.hasHammer || microMetrics.hasPinbar || microMetrics.hasEngulfing || microMetrics.hasBullishCandle)) {
          detailedReasons.push({ check: `BB Pullback (${microTF}) (BUY)`, value: `Pullback ${microMetrics.bbPullbackCount}c ΓåÆ Lower + Reversal on ${microTF}`, status: 'positive', impact: `strong: trend up + pullback to lower BB + reversal on ${microTF}` });
        } else if (isDown && microMetrics.bbTouchUpper && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 6 && (microMetrics.hasShootingStar || microMetrics.hasPinbar || microMetrics.hasEngulfing || microMetrics.hasBearishCandle)) {
          detailedReasons.push({ check: `BB Pullback (${microTF}) (SELL)`, value: `Rally ${microMetrics.bbPullbackCount}c ΓåÆ Upper + Reversal on ${microTF}`, status: 'negative', impact: `strong: trend down + rally to upper BB + reversal on ${microTF}` });
        } else if (microMetrics.bbTouchLower && isUp) {
          detailedReasons.push({ check: `BB Pullback (${microTF}) (BUY)`, value: `Near Lower (${bbPct}%) ΓÇö ${microMetrics.bbPullbackCount}c on ${microTF}`, status: 'positive', impact: `partial: approaching lower BB on ${microTF}` });
        } else if (microMetrics.bbTouchUpper && isDown) {
          detailedReasons.push({ check: `BB Pullback (${microTF}) (SELL)`, value: `Near Upper (${bbPct}%) ΓÇö ${microMetrics.bbPullbackCount}c on ${microTF}`, status: 'negative', impact: `partial: approaching upper BB on ${microTF}` });
        } else {
          detailedReasons.push({ check: `BB Pullback (${microTF})`, value: `No pullback ΓÇö ${bbPct}%B on ${microTF}`, status: 'neutral', impact: `BB pullback NOT met on ${microTF}` });
        }
      } else if (metrics?.bbLower > 0) {
        const bbPct = Math.round(metrics.bbPercentB * 100);
        const isUp = metrics.direction === 'uptrend';
        const isDown = metrics.direction === 'downtrend';
        if (isUp && metrics.bbTouchLower && metrics.bbPullbackCount >= 3 && metrics.bbPullbackCount <= 6 && (metrics.hasHammer || metrics.hasPinbar || metrics.hasEngulfing || metrics.hasBullishCandle)) {
          detailedReasons.push({ check: 'BB Pullback (BUY)', value: `Pullback ${metrics.bbPullbackCount}c ΓåÆ Lower + Reversal`, status: 'positive', impact: 'strong: trend up + pullback to lower BB + reversal' });
        } else if (isDown && metrics.bbTouchUpper && metrics.bbPullbackCount >= 3 && metrics.bbPullbackCount <= 6 && (metrics.hasShootingStar || metrics.hasPinbar || metrics.hasEngulfing || metrics.hasBearishCandle)) {
          detailedReasons.push({ check: 'BB Pullback (SELL)', value: `Rally ${metrics.bbPullbackCount}c ΓåÆ Upper + Reversal`, status: 'negative', impact: 'strong: trend down + rally to upper BB + reversal' });
        } else {
          detailedReasons.push({ check: 'BB Pullback', value: `No pullback ΓÇö ${bbPct}%B`, status: 'neutral', impact: 'BB pullback NOT met' });
        }
      }
    }

    // ΓöÇΓöÇ STEP 1e: Micro BB fallback ΓÇö fully on micro TF ΓöÇΓöÇ
    if (!detailedReasons.some((r: any) => r.check?.includes('Micro BB'))) {
      if (microMetrics?.bbLower > 0) {
        const isUptrend = metrics?.direction === 'uptrend';
        const isDowntrend = metrics?.direction === 'downtrend';
        if (isUptrend && microMetrics.bbTouchLower && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 6 && (microMetrics.hasHammer || microMetrics.hasPinbar || microMetrics.hasEngulfing || microMetrics.hasBullishCandle)) {
          detailedReasons.push({ check: `Micro BB (${microTF}) Strategy (BUY)`, value: `Pullback ${microMetrics.bbPullbackCount}c ΓåÆ Lower + Reversal on ${microTF}`, status: 'positive', impact: `strong buy: macro uptrend + micro pullback + reversal` });
        } else if (isDowntrend && microMetrics.bbTouchUpper && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 6 && (microMetrics.hasShootingStar || microMetrics.hasPinbar || microMetrics.hasEngulfing || microMetrics.hasBearishCandle)) {
          detailedReasons.push({ check: `Micro BB (${microTF}) Strategy (SELL)`, value: `Rally ${microMetrics.bbPullbackCount}c ΓåÆ Upper + Reversal on ${microTF}`, status: 'negative', impact: `strong sell: macro downtrend + micro rally + reversal` });
        } else if (microMetrics.bbTouchLower && isUptrend) {
          detailedReasons.push({ check: `Micro BB (${microTF}) Touch Lower`, value: `price at lower band on ${microTF}`, status: 'positive', impact: `micro timeframe approaching lower BB in macro uptrend` });
        } else if (microMetrics.bbTouchUpper && isDowntrend) {
          detailedReasons.push({ check: `Micro BB (${microTF}) Touch Upper`, value: `price at upper band on ${microTF}`, status: 'negative', impact: `micro timeframe approaching upper BB in macro downtrend` });
        }
      }
    }

    // ΓöÇΓöÇ STEP 2: Compute primary & supporting from METRICS (not AI text) ΓöÇΓöÇ
    const isUp = metrics?.direction === 'uptrend';
    const isDown = metrics?.direction === 'downtrend';

    // PRIMARY 1 ΓÇö BB Pullback (lenient gate): passes if BB exists and aligns with direction.
    // Strict pullback (touch+3-6c+reversal) is for STRONG upgrade only, not for blocking signals.
    const hasBbData = !!(metrics?.bbLower > 0);
    const hasMicroBbData = !!(microMetrics && microMetrics.bbLower > 0);
    // Lenient: BB data exists ΓåÆ pass. Only blocks if BB actively conflicts with direction.
    // e.g. price at upper BB in uptrend with no pullback = conflict ΓåÆ block
    let bbMet = true;
    if (hasMicroBbData) {
      // Micro BB available ΓÇö use it: pass if price aligns OR if no strong conflict
      const microAtUpper = microMetrics.bbPercentB > 0.85;
      const microAtLower = microMetrics.bbPercentB < 0.15;
      bbMet = !(microAtUpper && isUp) && !(microAtLower && isDown);
    } else if (hasBbData) {
      // No micro but macro BB available ΓÇö same lenient check
      const macroAtUpper = (metrics?.bbPercentB ?? 0.5) > 0.85;
      const macroAtLower = (metrics?.bbPercentB ?? 0.5) < 0.15;
      bbMet = !(macroAtUpper && isUp) && !(macroAtLower && isDown);
    }
    // If no BB data at all ΓåÆ pass

    // PRIMARY 2 ΓÇö Supply/Demand: no zones = pass, zones support = pass, zones conflict = BLOCK
    const hasZones = supplyDemandZones.length > 0;
    const nearestZone = supplyDemandZones[0];
    const sdMet = !hasZones || ((nearestZone?.type === 'demand' && isUp) || (nearestZone?.type === 'supply' && isDown));

    // PRIMARY 3 — Trend Age: ALL zones pass (never blocks). Youth allows STRONG; others downgrade.
    const ageMet = true;

    // PRIMARY 4 — News: track for post-computation penalty
    let newsMet = true;
    let newsPenalty = 1.0;
    if (contextEcon && contextEcon.length > 0) {
      const highImpactEvents = contextEcon.filter((e: any) => e.impact === 'High');
      if (highImpactEvents.length > 0) {
        newsPenalty = 0.85;
      }
    }
    if (contextNews && contextNews.length > 0) {
      const negNews = contextNews.filter((n: any) => {
        const title = (n.title || '').toLowerCase();
        return title.includes('crash') || title.includes('ban') || title.includes('fraud') || 
               title.includes('hack') || title.includes('bearish') || title.includes('drop') ||
               title.includes('fall') || title.includes('down') || title.includes('loss');
      });
      const posNews = contextNews.filter((n: any) => {
        const title = (n.title || '').toLowerCase();
        return title.includes('rally') || title.includes('bullish') || title.includes('surge') ||
               title.includes('adoption') || title.includes('partnership') || title.includes('launch');
      });
      if (negNews.length >= 2 && negNews.length > posNews.length) {
        newsPenalty = Math.min(newsPenalty, 0.8);
      }
    }

    const primaryTotal = 4;
    let primaryMetCount = 0;
    if (bbMet) primaryMetCount++;
    if (sdMet) primaryMetCount++;
    if (ageMet) primaryMetCount++;
    if (newsMet) primaryMetCount++;

    // Supporting conditions from metrics
    const supportConditions = [
      // RSI: neutral zone always counts. Oversold/overbought count if aligned with direction.
      { met: metrics?.rsi !== undefined && (
        (metrics.rsi > 30 && metrics.rsi < 70) ||
        (metrics.rsi <= 30 && (isUp || !isDown)) || // oversold: positive unless clearly downtrend
        (metrics.rsi >= 70 && (isDown || !isUp))    // overbought: negative unless clearly uptrend
      ) },
      { met: (metrics?.emaCross === 'bullish' && !isDown) || (metrics?.emaCross === 'bearish' && !isUp) },
      { met: metrics?.volSurge === true },
      { met: !!microMetrics?.emaCross && ((microMetrics.emaCross === 'bullish' && !isDown) || (microMetrics.emaCross === 'bearish' && !isUp)) },
      { met: microMetrics?.bbPercentB !== undefined && ((microMetrics.bbPercentB < 0.3) || (microMetrics.bbPercentB > 0.7)) },
      { met: contextFearGreed?.value !== undefined && ((contextFearGreed.value < 30) || (contextFearGreed.value > 70)) },
    ];
    const supportMet = supportConditions.filter(c => c.met).length;
    const supportTotal = supportConditions.length;
    const supportRatio = supportTotal > 0 ? supportMet / supportTotal : 0;

    // ΓöÇΓöÇ STEP 2b: Conflict detection ΓöÇΓöÇ
    const buyReasons = detailedReasons.filter((r: any) => r.status === 'positive').length;
    const sellReasons = detailedReasons.filter((r: any) => r.status === 'negative').length;
    let hasConflict = buyReasons >= 4 && sellReasons >= 4;

    // ΓöÇΓöÇ STEP 3: Normalize AI signal ΓöÇΓöÇ
    let rawSignal = String(resultData.signal || 'no_entry').toLowerCase().trim().replace(/\s+/g, '_');
    if (rawSignal.includes('strong_buy') || rawSignal === 'strongbuy') rawSignal = 'strong_buy';
    else if (rawSignal.includes('strong_sell') || rawSignal === 'strongsell') rawSignal = 'strong_sell';
    else if (rawSignal.includes('buy')) rawSignal = 'buy';
    else if (rawSignal.includes('sell')) rawSignal = 'sell';
    else if (rawSignal.includes('neutral')) rawSignal = 'neutral';
    else rawSignal = 'no_entry';

    let finalSignal = rawSignal as SignalType;
    let finalConfidence = Number(resultData.confidence) || 50;

    // ΓöÇΓöÇ STEP 4: Age zone adjustments ΓöÇΓöÇ
    if (totalAge < infantLimit) {
      finalConfidence = Math.round(finalConfidence * 0.7);
      if (finalSignal === SignalType.STRONG_BUY) finalSignal = SignalType.BUY;
      if (finalSignal === SignalType.STRONG_SELL) finalSignal = SignalType.SELL;
    } else if (totalAge < matureLimit) {
      // Youth ΓÇö ONLY zone allowing STRONG
    } else if (totalAge <= oldLimit) {
      // Mature ΓÇö downgrade STRONG to regular
      if (finalSignal === SignalType.STRONG_BUY) finalSignal = SignalType.BUY;
      if (finalSignal === SignalType.STRONG_SELL) finalSignal = SignalType.SELL;
    } else {
      finalConfidence = Math.round(finalConfidence * 0.75);
      if (finalSignal === SignalType.STRONG_BUY) finalSignal = SignalType.BUY;
      if (finalSignal === SignalType.STRONG_SELL) finalSignal = SignalType.SELL;
    }
    if (age < minAge) finalConfidence = Math.round(finalConfidence * 0.8);

    // Pre-Pullback Age filter: if trend before pullback is too short or too exhausted, force NEUTRAL
    const minPreAge = settings?.minPrePullbackAge ?? 15;
    const maxPreAge = settings?.maxPrePullbackAge ?? 50;
    const prePullbackAgeVal = metrics?.prePullbackAge ?? 0;
    if (prePullbackAgeVal < minPreAge || prePullbackAgeVal > maxPreAge) {
      finalSignal = SignalType.NEUTRAL;
      finalConfidence = Math.min(finalConfidence, 30);
      if (prePullbackAgeVal < minPreAge) {
        detailedReasons.push({ check: 'Pre-Pullback Age', value: `${prePullbackAgeVal}c ΓÇö صغير (أقل من ${minPreAge})`, status: 'neutral', impact: 'trend before pullback too short ΓÇö neutral only' });
      } else {
        detailedReasons.push({ check: 'Pre-Pullback Age', value: `${prePullbackAgeVal}c ΓÇö كهل (أكثر من ${maxPreAge})`, status: 'negative', impact: 'trend exhausted ΓÇö neutral only' });
      }
    }

    // ΓöÇΓöÇ STEP 5: Compute confidence from metrics ΓöÇΓöÇ
    const maxPrimary = settings?.maxPrimaryWeight ?? 50;
    const maxSupport = settings?.maxSupportingWeight ?? 20;
    const baseConf = settings?.baseConfidence ?? 25;
    const primaryConf = Math.round((primaryMetCount / primaryTotal) * maxPrimary);
    const supportConf = Math.round(supportRatio * maxSupport);
    const computedConfidence = baseConf + primaryConf + supportConf;
    finalConfidence = computedConfidence;

    // Apply news penalty (calculated earlier, applied here after confidence computation)
    if (newsPenalty < 1.0) {
      finalConfidence = Math.round(finalConfidence * newsPenalty);
    }

    // Multi-TF Direction: penalize if current direction conflicts with higher timeframe
    const directionConflicts = (isUp && isMacroDown) || (isDown && isMacroUp);
    if (directionConflicts) {
      finalConfidence = Math.round(finalConfidence * 0.75); // 25% penalty for trading against higher TF
      detailedReasons.push({ 
        check: `Higher TF Direction (${macro1})`, 
        value: `Higher TF: ${macroDirection} vs Current: ${metrics?.direction}`, 
        status: 'negative', 
        impact: `WARNING: trading against higher timeframe trend` 
      });
    } else {
      detailedReasons.push({ 
        check: `Higher TF Direction (${macro1})`, 
        value: `Higher TF: ${macroDirection} aligns with Current: ${metrics?.direction}`, 
        status: 'positive', 
        impact: `higher timeframe confirms current trend direction` 
      });
    }

    // ΓöÇΓöÇ STEP 6: Voting system — Metrics vs AI ΓöÇΓöÇ
    const metricsDirection = isUp ? 'buy' : isDown ? 'sell' : null;
    const aiDirection = finalSignal.includes('buy') ? 'buy' : finalSignal.includes('sell') ? 'sell' : null;
    
    let direction: string;
    let agreementBonus = 0;
    
    if (metricsDirection && aiDirection) {
      if (metricsDirection === aiDirection) {
        // AGREE: both say same direction → boost confidence
        direction = metricsDirection;
        agreementBonus = 10;
      } else {
        // DISAGREE: reduce confidence but don't force NEUTRAL
        direction = aiDirection;
        finalConfidence = Math.round(finalConfidence * 0.75);
      }
    } else {
      // Both neutral or one missing — compute direction from supporting reasons
      if (buyReasons > sellReasons + 1) direction = 'buy';
      else if (sellReasons > buyReasons + 1) direction = 'sell';
      else direction = null;
    }

    finalConfidence = Math.min(100, finalConfidence + agreementBonus);

    // Strict BB pullback check for STRONG upgrade (mirrors local analysis line 391)
    let bbPullbackMetStrict = false;
    if (isUp && metrics?.bbTouchLower && metrics?.bbPullbackCount >= 3 && metrics?.bbPullbackCount <= 6 && (metrics?.hasHammer || metrics?.hasPinbar || metrics?.hasEngulfing || metrics?.hasBullishCandle)) {
      bbPullbackMetStrict = true;
    } else if (isDown && metrics?.bbTouchUpper && metrics?.bbPullbackCount >= 3 && metrics?.bbPullbackCount <= 6 && (metrics?.hasShootingStar || metrics?.hasPinbar || metrics?.hasEngulfing || metrics?.hasBearishCandle)) {
      bbPullbackMetStrict = true;
    } else if (microMetrics) {
      if (isUp && microMetrics.bbTouchLower && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 6 && (microMetrics.hasHammer || microMetrics.hasPinbar || microMetrics.hasEngulfing || microMetrics.hasBullishCandle)) {
        bbPullbackMetStrict = true;
      } else if (isDown && microMetrics.bbTouchUpper && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 6 && (microMetrics.hasShootingStar || microMetrics.hasPinbar || microMetrics.hasEngulfing || microMetrics.hasBearishCandle)) {
        bbPullbackMetStrict = true;
      }
    }

    // Pre-Pullback Age check for STRONG upgrade
    const minPreAgeAI = settings?.minPrePullbackAge ?? 15;
    const maxPreAgeAI = settings?.maxPrePullbackAge ?? 50;
    const prePullbackAgeValAI = metrics?.prePullbackAge ?? 0;
    const prePullbackAgeMetAI = prePullbackAgeValAI >= minPreAgeAI && prePullbackAgeValAI <= maxPreAgeAI;

    if (hasConflict) {
      finalSignal = SignalType.NEUTRAL;
    } else if (primaryMetCount < 3) {
      finalSignal = SignalType.NEUTRAL;
    } else {
      const strongThreshold = settings?.strongThreshold ?? 60;
      const buyThreshold = settings?.buyThreshold ?? 40;
      const minStrongSupport = (settings?.minStrongSupport ?? 50) / 100;
      const CONF_BUFFER = 5;
      if (direction === 'buy') {
        if (supportRatio >= minStrongSupport && finalConfidence >= (strongThreshold - CONF_BUFFER) && bbPullbackMetStrict && prePullbackAgeMetAI) {
          finalSignal = SignalType.STRONG_BUY;
        } else if (finalConfidence >= (buyThreshold - CONF_BUFFER)) {
          finalSignal = SignalType.BUY;
        } else {
          finalSignal = SignalType.NEUTRAL;
        }
      } else if (direction === 'sell') {
        if (supportRatio >= minStrongSupport && finalConfidence >= (strongThreshold - CONF_BUFFER) && bbPullbackMetStrict && prePullbackAgeMetAI) {
          finalSignal = SignalType.STRONG_SELL;
        } else if (finalConfidence >= (buyThreshold - CONF_BUFFER)) {
          finalSignal = SignalType.SELL;
        } else {
          finalSignal = SignalType.NEUTRAL;
        }
      } else {
        finalSignal = SignalType.NEUTRAL;
      }
      // Youth-only STRONG enforcement
      const isYouth = totalAge >= infantLimit && totalAge < matureLimit;
      if (!isYouth && (finalSignal === SignalType.STRONG_BUY || finalSignal === SignalType.STRONG_SELL)) {
        finalSignal = finalSignal === SignalType.STRONG_BUY ? SignalType.BUY : SignalType.SELL;
      }
    }

    // ΓöÇΓöÇ STEP 7: Fear&Greed — supporting condition only (NO flip) ΓöÇΓöÇ
    // Fear & Greed adjusts confidence, never flips the signal direction.
    // It's already counted as a supporting condition in STEP 2 (line 946).
    const fgValue = contextFearGreed?.value;
    if (fgValue !== undefined && fgValue !== null) {
      if (fgValue <= 25) {
        // Extreme Fear: slight confidence boost for contrarian BUY, slight penalty for SELL
        if (finalSignal === SignalType.BUY || finalSignal === SignalType.STRONG_BUY) {
          finalConfidence = Math.min(finalConfidence + 5, 100);
        } else if (finalSignal === SignalType.SELL || finalSignal === SignalType.STRONG_SELL) {
          finalConfidence = Math.max(finalConfidence - 5, 10);
        }
      } else if (fgValue >= 75) {
        // Extreme Greed: slight confidence boost for contrarian SELL, slight penalty for BUY
        if (finalSignal === SignalType.SELL || finalSignal === SignalType.STRONG_SELL) {
          finalConfidence = Math.min(finalConfidence + 5, 100);
        } else if (finalSignal === SignalType.BUY || finalSignal === SignalType.STRONG_BUY) {
          finalConfidence = Math.max(finalConfidence - 5, 10);
        }
      }
    }

    // ΓöÇΓöÇ STEP 8: Sideways + no strong evidence = neutralize ΓöÇΓöÇ
    if (metrics?.direction === 'sideways' || (!isUp && !isDown)) {
      const hasStrongSetup = detailedReasons.some((r: any) => r.check?.includes('BB Pullback') && r.status !== 'neutral');
      if (!hasStrongSetup && finalConfidence < 40 && (finalSignal === SignalType.BUY || finalSignal === SignalType.SELL)) {
        finalConfidence = Math.min(finalConfidence, 35);
        finalSignal = SignalType.NEUTRAL;
      }
    }
    // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
    // END LOCKED SIGNAL ENGINE RULES (v6)
    // ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ

    // ALWAYS calculate SL/TP from ATR/price data ΓÇö AI values are unreliable
    const currentPrice = closes[closes.length - 1] || 0;
    const atr = metrics?.atr || 0;

    let finalStopLoss = 0;
    let finalTakeProfit = 0;

    if (currentPrice > 0) {
      let slDist = 0;
      const isForex = type === MarketType.FOREX;

      if (atr > 0) {
        const atrMultiplier = isCrypto ? 3 : 2;
        slDist = atr * atrMultiplier;
      }

      let minSL: number;
      let maxSL: number;

      if (isForex) {
        const pipSize = symbol.toUpperCase().includes('JPY') ? 0.01 : 0.0001;
        minSL = 30 * pipSize;
        maxSL = 200 * pipSize;
      } else if (isCrypto) {
        minSL = currentPrice * 0.03;
        maxSL = currentPrice * 0.12;
      } else {
        minSL = currentPrice * 0.02;
        maxSL = currentPrice * 0.08;
      }

      slDist = Math.max(slDist, minSL);
      slDist = Math.min(slDist, maxSL);

      if (finalSignal.includes('buy')) {
        finalStopLoss = currentPrice - slDist;
        finalTakeProfit = currentPrice + slDist * 2;
      } else if (finalSignal.includes('sell')) {
        finalStopLoss = currentPrice + slDist;
        finalTakeProfit = currentPrice - slDist * 2;
      } else {
        finalStopLoss = currentPrice - slDist;
        finalTakeProfit = currentPrice + slDist;
      }
    }

    const finalResult: AnalysisResult = {
      symbol, type, timeframe,
      signal: finalSignal,
      confidence: finalConfidence,
      summary: resultData.summary,
      detailedReasons,
      newsSources: [...new Set(detailedReasons
        .filter((r: any) => r.check === 'News Sentiment' && r.source)
        .map((r: any) => r.source))],
      technicalScore: metrics?.momentumScore || 50,
      sentimentScore: contextFearGreed?.value ?? 50,
      trendMaturity: totalAge < infantAgeThreshold ? 'infancy' : (totalAge < matureAgeThreshold ? 'youth' : (totalAge <= oldAgeThreshold ? 'mature' : 'aging')),
      trendAge: totalAge,
      microTF,
      microSignal: resultData.microSignal || 'unknown',
      microTrend: resultData.microTrend || "",
      historicalMatch: resultData.historicalMatch || "",
      timestamp: new Date().toISOString(),
      userId: "",
      entryPrice: currentPrice,
      stopLoss: finalStopLoss,
      takeProfit: finalTakeProfit,
      primaryMetCount,
      direction: direction || 'sideways',
    };

    // Cache the result
    _resultCache.set(cacheKey, { result: finalResult, ts: Date.now() });

    return finalResult;

  } catch (error: any) {
    console.error("[Engine Error]:", error);
    throw new Error(error.message || "Stability logic error.");
  }
}
