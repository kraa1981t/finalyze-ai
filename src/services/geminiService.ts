import { MarketType, AnalysisResult, TradingStyle, SignalType, StrategySettings } from "../types";
import { DEFAULT_STRATEGY_SETTINGS } from "../constants";
import { fetchMarketContext } from "./marketContextService";
import { onRateLimited, waitIfRateLimited } from "./rateLimitTracker";
import { fetchMarketDataDirect, callAIDirect } from './apiDirect';
import { getCorrelationGroup } from "./portfolioRiskService";

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
    // 5. Cookie (most persistent — survives redeploy, browser restart)
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
    // Cookie: 1 year expiry — survives redeploy, browser restart
    document.cookie = `finalyze_api_key=${encodeURIComponent(key)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {}
}

function calculateSupplyDemandZones(highs: number[], lows: number[], volumes: number[], closes: number[]) {
  const zones: { type: 'supply' | 'demand'; top: number; bottom: number; strength: number }[] = [];
  const len = highs.length;
  if (len < 15) return zones;

  for (let i = 5; i < len - 5; i++) {
    const isPivotHigh = highs[i] > highs[i - 1] && highs[i] > highs[i - 2] && highs[i] > highs[i + 1] && highs[i] > highs[i + 2];
    const isPivotLow = lows[i] < lows[i - 1] && lows[i] < lows[i - 2] && lows[i] < lows[i + 1] && lows[i] < lows[i + 2];
    if (!isPivotHigh && !isPivotLow) continue;

    const vol = volumes[i] || 0;
    const avgVol = volumes.slice(Math.max(0, i - 5), i + 5).filter(v => v).reduce((a, b) => a + b, 0) / Math.max(volumes.slice(Math.max(0, i - 5), i + 5).filter(v => v).length, 1);
    const volRatio = avgVol > 0 ? vol / avgVol : 1;

    if (isPivotHigh && volRatio > 1.2) {
      zones.push({ type: 'supply', top: highs[i] * 1.002, bottom: lows[i] * 0.998, strength: Math.min(100, volRatio * 50) });
    }
    if (isPivotLow && volRatio > 1.2) {
      zones.push({ type: 'demand', top: highs[i] * 1.002, bottom: lows[i] * 0.998, strength: Math.min(100, volRatio * 50) });
    }
  }
  return zones.slice(0, 6);
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

  // 2. EMA Cross (9 vs 21) — true Exponential Moving Average
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

  // 3. Trend Direction
  let upScore = 0;
  let downScore = 0;
  const window = Math.min(len - 1, 15); 
  for (let i = 0; i < window; i++) {
    const curr = len - 1 - i;
    const prev = curr - 1;
    if (closes[curr] > closes[prev]) upScore++; else downScore++;
  }

  let direction: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
  if (upScore > downScore + 2) direction = 'uptrend';
  else if (downScore > upScore + 2) direction = 'downtrend';

  // 4. Age (Relaxed for Crypto)
  let age = 0;
  for (let i = 1; i < len; i++) {
    const curr = len - i;
    const isUp = closes[curr] > closes[curr - 1];
    if (direction === 'uptrend' && isUp) age++;
    else if (direction === 'downtrend' && !isUp) age++;
    else break;
  }

  // 4b. Total Trend Age — structural trend length (last 2+ consecutive opposite candles)
  let totalAge = 0;
  if (direction !== 'sideways') {
    let consecutiveAgainst = 0;
    for (let i = 1; i < len; i++) {
      const curr = len - i;
      const prev = curr - 1;
      const isAgainst = direction === 'uptrend'
        ? closes[curr] < closes[prev]
        : closes[curr] > closes[prev];
      if (isAgainst) {
        consecutiveAgainst++;
        if (consecutiveAgainst >= 2) {
          totalAge = i - consecutiveAgainst;
          break;
        }
      } else {
        consecutiveAgainst = 0;
      }
    }
    if (consecutiveAgainst < 2) totalAge = len;
  }

  // 5. Volume Surge
  let volSurge = false;
  if (volumes && volumes.length > 5) {
    const lastVol = volumes[len - 1];
    const avgVol = volumes.slice(-6, -1).reduce((a, b) => a + b, 0) / 5;
    volSurge = lastVol > avgVol * 1.5;
  }

  // 6. ATR (14-period Average True Range) — for dynamic SL/TP
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

  // 8. Bollinger Band Pullback Detection (3-5 candles opposite to trend)
  let bbPullbackCount = 0;
  let bbTouchLower = false;
  let bbTouchUpper = false;
  if (len >= 5 && bbLower > 0) {
    // Count consecutive opposite candles
    for (let i = len - 1; i >= Math.max(0, len - 5); i--) {
      const isBearish = closes[i] < safeOpens[i];
      const isBullish = closes[i] > safeOpens[i];
      if (direction === 'uptrend' && isBearish) bbPullbackCount++;
      else if (direction === 'downtrend' && isBullish) bbPullbackCount++;
      else break;
    }
    // Check if price touched or approached lower/upper band (within 0.3%)
    const currentPrice = closes[len - 1];
    bbTouchLower = currentPrice <= bbLower * 1.003;
    bbTouchUpper = currentPrice >= bbUpper * 0.997;
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

  return {
    direction, age, totalAge, rsi, emaCross, volSurge, atr,
    bbUpper, bbMiddle, bbLower, bbWidth, bbPercentB,
    bbPullbackCount, bbTouchLower, bbTouchUpper,
    hasHammer, hasPinbar, hasEngulfing, hasShootingStar,
    momentumScore: upScore / (upScore + downScore) * 100
  };
}

// Batch analysis: ONE AI call for ALL symbols — eliminates rate limiting
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
      ? supplyDemandZones.map(z => `${z.type === 'supply' ? 'Supply' : 'Demand'} zone: ${z.bottom.toFixed(2)}–${z.top.toFixed(2)} (strength ${z.strength.toFixed(0)}%)`).join('. ')
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
    const newsText = contextNews.length > 0 ? contextNews.map((n: any) => `• ${n.title} (${n.source})`).join('\n') : 'No recent news available.';
    const eventsText = contextEcon.length > 0 ? contextEcon.map((e: any) => `• ${e.country} | ${e.title} | Impact: ${e.impact} | Forecast: ${e.forecast} | Previous: ${e.previous}`).join('\n') : 'No major economic events this week.';
    return { metrics, microMetrics, supplyDemandZones, contextNews, contextFearGreed, contextEcon, microTF, zonesText, newsText, eventsText };
  } catch (e: any) {
    return { error: e.message || 'Failed to fetch data' };
  }
}

function generateLocalAnalysis(
  metrics: any, zonesText: string, supplyDemandZones: any[], microMetrics: any, microTF: string,
  settings: StrategySettings, type: MarketType, lang: string, symbol: string, infantLimit: number, matureLimit: number, oldLimit: number
): { signal: SignalType; confidence: number; summary: string; detailedReasons: any[]; microSignal: string; microTrend: string; technicalScore: number; sentimentScore: number; historicalMatch: string } {
  const minAge = settings?.minTrendAge ?? 2;
  const age = metrics?.age || 0;
  const totalAge = metrics?.totalAge || 0;
  let score = 0;
  const reasons: any[] = [];

  if (metrics?.rsi !== undefined) {
    const rsi = metrics.rsi;
    if (rsi < 30) { score += 2; reasons.push({ check: 'RSI', value: rsi.toFixed(1), status: 'positive', impact: 'oversold, bounce potential' }); }
    else if (rsi > 70) { score -= 2; reasons.push({ check: 'RSI', value: rsi.toFixed(1), status: 'negative', impact: 'overbought, caution' }); }
    else { reasons.push({ check: 'RSI', value: rsi.toFixed(1), status: 'neutral', impact: 'neutral zone' }); }
  }
  if (metrics?.emaCross === 'bullish') { score += 1.5; reasons.push({ check: 'EMA Cross', value: 'bullish', status: 'positive', impact: 'supports upward bias' }); }
  else if (metrics?.emaCross === 'bearish') { score -= 1.5; reasons.push({ check: 'EMA Cross', value: 'bearish', status: 'negative', impact: 'supports downward bias' }); }
  if (metrics?.direction === 'uptrend') { score += 1; reasons.push({ check: 'Trend Direction', value: 'uptrend', status: 'positive', impact: 'price making higher highs' }); }
  else if (metrics?.direction === 'downtrend') { score -= 1; reasons.push({ check: 'Trend Direction', value: 'downtrend', status: 'negative', impact: 'price making lower lows' }); }
  else { reasons.push({ check: 'Trend Direction', value: 'sideways', status: 'neutral', impact: 'no clear direction' }); }
  if (metrics?.volSurge) {
    score += score >= 0 ? 0.5 : -0.5;
    reasons.push({ check: 'Volume Surge', value: 'true', status: score >= 0 ? 'positive' : 'negative', impact: 'confirms momentum' });
  }
  if (supplyDemandZones?.length > 0) {
    const z = supplyDemandZones[0];
    reasons.push({ check: 'Supply/Demand Zone', value: `${z.type === 'supply' ? 'Supply' : 'Demand'} ${z.bottom.toFixed(2)}-${z.top.toFixed(2)}`, status: 'neutral', impact: `nearest ${z.type} zone` });
    if (z.type === 'demand') score += 0.5;
    else score -= 0.5;
  }
  if (microMetrics) {
    let microScore = 0;
    if (microMetrics.rsi !== undefined) { if (microMetrics.rsi < 30) microScore += 1; else if (microMetrics.rsi > 70) microScore -= 1; }
    if (microMetrics.emaCross === 'bullish') microScore += 1;
    else if (microMetrics.emaCross === 'bearish') microScore -= 1;
    const microSignal = (microScore > 0 && score > 0) ? 'aligned' : (microScore < 0 && score < 0) ? 'aligned' : 'pullback';
    reasons.push({ check: 'Micro TF Alignment', value: microSignal, status: microSignal === 'aligned' ? 'positive' : 'neutral', impact: microSignal === 'aligned' ? 'micro aligns with macro' : 'micro diverging' });
  }

  // Bollinger Bands Strategy — Pullback with Trend
  if (metrics?.bbLower > 0 && metrics?.bbUpper > 0) {
    const bbPct = Math.round(metrics.bbPercentB * 100);
    const isUptrend = metrics.direction === 'uptrend';
    const isDowntrend = metrics.direction === 'downtrend';

    // BUY SETUP: Uptrend + pullback to lower band + reversal candle
    if (isUptrend && metrics.bbTouchLower && metrics.bbPullbackCount >= 3 && metrics.bbPullbackCount <= 5 && (metrics.hasHammer || metrics.hasPinbar || metrics.hasEngulfing)) {
      score += 3;
      reasons.push({
        check: 'BB Strategy (BUY)',
        value: `Pullback ${metrics.bbPullbackCount} candles → Lower Band + Reversal`,
        status: 'positive',
        impact: `strong buy: trend up + ${metrics.bbPullbackCount} pullback candles + touch lower BB + reversal candle`
      });
    }
    // SELL SETUP: Downtrend + rally to upper band + reversal candle
    else if (isDowntrend && metrics.bbTouchUpper && metrics.bbPullbackCount >= 3 && metrics.bbPullbackCount <= 5 && (metrics.hasShootingStar || metrics.hasPinbar || metrics.hasEngulfing)) {
      score -= 3;
      reasons.push({
        check: 'BB Strategy (SELL)',
        value: `Rally ${metrics.bbPullbackCount} candles → Upper Band + Reversal`,
        status: 'negative',
        impact: `strong sell: trend down + ${metrics.bbPullbackCount} rally candles + touch upper BB + reversal candle`
      });
    }
    // Partial BB signals
    else {
      if (metrics.bbTouchLower && isUptrend) {
        score += 0.5;
        reasons.push({ check: 'BB Touch Lower', value: `price at lower band (${bbPct}%)`, status: 'positive', impact: 'approaching lower BB in uptrend' });
      }
      if (metrics.bbTouchUpper && isDowntrend) {
        score -= 0.5;
        reasons.push({ check: 'BB Touch Upper', value: `price at upper band (${bbPct}%)`, status: 'negative', impact: 'approaching upper BB in downtrend' });
      }
      if (metrics.hasHammer || metrics.hasPinbar) {
        reasons.push({ check: 'Reversal Candle', value: metrics.hasHammer ? 'Hammer' : 'Pinbar', status: 'neutral', impact: 'potential reversal pattern detected' });
      }
      reasons.push({ check: 'BB Info', value: `Upper: ${metrics.bbUpper.toFixed(4)} | Mid: ${metrics.bbMiddle.toFixed(4)} | Lower: ${metrics.bbLower.toFixed(4)}`, status: 'neutral', impact: `Bollinger Bands — ${bbPct}%B` });
    }
  }

  // Micro BB Strategy — Pullback on lower timeframe confirms entry
  if (microMetrics?.bbLower > 0 && microMetrics?.bbUpper > 0) {
    const isUptrend = metrics?.direction === 'uptrend';
    const isDowntrend = metrics?.direction === 'downtrend';

    // BUY: Macro uptrend + Micro BB touch lower + pullback 3-5 + reversal candle
    if (isUptrend && microMetrics.bbTouchLower && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 5 && (microMetrics.hasHammer || microMetrics.hasPinbar || microMetrics.hasEngulfing)) {
      score += 3;
      reasons.push({
        check: `Micro BB (${microTF}) Strategy (BUY)`,
        value: `Pullback ${microMetrics.bbPullbackCount}c → Lower Band + Reversal on ${microTF}`,
        status: 'positive',
        impact: `strong buy: macro uptrend + micro pullback ${microMetrics.bbPullbackCount} candles + touch lower BB + reversal candle`
      });
    }
    // SELL: Macro downtrend + Micro BB touch upper + rally 3-5 + reversal candle
    else if (isDowntrend && microMetrics.bbTouchUpper && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 5 && (microMetrics.hasShootingStar || microMetrics.hasPinbar || microMetrics.hasEngulfing)) {
      score -= 3;
      reasons.push({
        check: `Micro BB (${microTF}) Strategy (SELL)`,
        value: `Rally ${microMetrics.bbPullbackCount}c → Upper Band + Reversal on ${microTF}`,
        status: 'negative',
        impact: `strong sell: macro downtrend + micro rally ${microMetrics.bbPullbackCount} candles + touch upper BB + reversal candle`
      });
    }
    // Partial micro BB signals
    else {
      if (microMetrics.bbTouchLower && isUptrend) {
        score += 0.5;
        reasons.push({ check: `Micro BB (${microTF}) Touch Lower`, value: `price at lower band on ${microTF}`, status: 'positive', impact: `micro timeframe approaching lower BB in macro uptrend` });
      }
      if (microMetrics.bbTouchUpper && isDowntrend) {
        score -= 0.5;
        reasons.push({ check: `Micro BB (${microTF}) Touch Upper`, value: `price at upper band on ${microTF}`, status: 'negative', impact: `micro timeframe approaching upper BB in macro downtrend` });
      }
    }
  }

  // Cross-Asset Correlation & Cointelligence Intelligence
  const corrGroup = getCorrelationGroup(symbol);
  if (corrGroup) {
    const corrPct = Math.round(corrGroup.correlation * 100);
    reasons.push({
      check: 'Cross-Asset Correlation',
      value: `${corrGroup.label} (${corrPct}%)`,
      status: 'neutral',
      impact: `correlated with ${corrGroup.symbols.filter(s => s !== symbol).join(', ')} — portfolio diversification applies`
    });
  }

  let rawSignal: SignalType;
  let confidence: number;
  const absScore = Math.abs(score);
  if (score >= 3) { rawSignal = SignalType.STRONG_BUY; confidence = Math.min(95, 80 + Math.round((absScore - 3) * 5)); }
  else if (score >= 1.5) { rawSignal = SignalType.BUY; confidence = Math.round(60 + (absScore - 1.5) * 13.3); }
  else if (score <= -3) { rawSignal = SignalType.STRONG_SELL; confidence = Math.min(95, 80 + Math.round((absScore - 3) * 5)); }
  else if (score <= -1.5) { rawSignal = SignalType.SELL; confidence = Math.round(60 + (absScore - 1.5) * 13.3); }
  else { rawSignal = SignalType.NEUTRAL; confidence = Math.round(40 + absScore * 13.3); }

  // Apply age zone caps — proportional reduction instead of fixed values
  if (totalAge < infantLimit) {
    confidence = Math.round(confidence * 0.7);
  }
  else if (totalAge < matureLimit) {
    if (rawSignal === SignalType.STRONG_BUY) rawSignal = SignalType.BUY;
    else if (rawSignal === SignalType.STRONG_SELL) rawSignal = SignalType.SELL;
    confidence = Math.round(confidence * 0.85);
  }
  else if (totalAge > oldLimit) {
    confidence = Math.round(confidence * 0.75);
  }
  if (age < minAge) {
    confidence = Math.round(confidence * 0.8);
  }
  const minConf = settings?.minConfidence || 55;
  if (confidence < minConf) rawSignal = SignalType.NEUTRAL;

  const dir = metrics?.direction || 'sideways';
  const summary = lang === 'ar'
    ? `تحليل فني محلي: ${symbol} — ${dir === 'uptrend' ? 'اتجاه صاعد' : dir === 'downtrend' ? 'اتجاه هابط' : 'بدون اتجاه'}. RSI ${metrics?.rsi?.toFixed(1) || 'N/A'}. الثقة: ${confidence}%.`
    : `Local analysis: ${symbol} — ${dir} trend. RSI ${metrics?.rsi?.toFixed(1) || 'N/A'}. Confidence: ${confidence}%.`;

  return {
    signal: rawSignal, confidence, summary, detailedReasons: reasons,
    microSignal: 'unknown', microTrend: '', technicalScore: Math.round(score * 16.7 + 50),
    sentimentScore: 50, historicalMatch: ''
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

  // Analyze each symbol individually — one AI call per symbol for maximum accuracy
  for (let i = 0; i < total; i++) {
    const p = paramsList[i];
    if (onProgress) onProgress(p.symbol, total, i, errors.length);

    let lastError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 5000));
        if (i > 0 || attempt > 0) await new Promise(r => setTimeout(r, 1200));
        await waitIfRateLimited();

        console.log(`[Batch] Analyzing ${p.symbol} (${i + 1}/${total}) attempt ${attempt + 1}...`);
        const result = await analyzeMarket({
          symbol: p.symbol,
          type: p.type,
          timeframe: p.timeframe,
          tradingStyle: p.tradingStyle,
          settings,
          lang
        });
        console.log(`[Batch] ${p.symbol} → ${result.signal} (${result.confidence}%)`);
        results.push(result);
        lastError = null;
        break;
      } catch (e: any) {
        lastError = e;
        console.warn(`[Batch] Attempt ${attempt + 1} FAILED ${p.symbol}:`, e.message);
      }
    }
    if (lastError) {
      errors.push({ symbol: p.symbol, error: lastError.message || 'Analysis failed' });
    }
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

  try {
    const TF_PROGRESSION = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M', '1Y'];
    const currentIndex = TF_PROGRESSION.indexOf(timeframe);
    const macro1 = TF_PROGRESSION[Math.min(currentIndex + 1, TF_PROGRESSION.length - 1)];
    
    // Fetch Data
    const rawData = await fetchMarketDataDirect(symbol, timeframe).catch(() => ({ chart: { result: [{ indicators: { quote: [{}] } }] } }));
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
      ? supplyDemandZones.map(z => `${z.type === 'supply' ? 'Supply' : 'Demand'} zone: ${z.bottom.toFixed(2)}–${z.top.toFixed(2)} (strength ${z.strength.toFixed(0)}%)`).join('. ')
      : 'No clear zones detected.';

    const macro2 = TF_PROGRESSION[Math.min(currentIndex + 2, TF_PROGRESSION.length - 1)];
    const microTF = currentIndex > 0 ? TF_PROGRESSION[currentIndex - 1] : TF_PROGRESSION[0];
    
    // Fetch Lower Timeframe (Micro) Data for Wave Confirmation
    let microCloses: number[] = [];
    let microMetrics = null;
    try {
      const microData = await fetchMarketDataDirect(symbol, microTF).catch(() => ({ chart: { result: [{ indicators: { quote: [{}] } }] } }));
      const microQuotes = microData.chart?.result?.[0]?.indicators?.quote?.[0];
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
    
    // Fetch real market context (Fear & Greed, News, Economic Events)
    let contextFearGreed = null;
    let contextNews: { title: string; source: string }[] = [];
    let contextEcon: any[] = [];
    try {
      const ctx = await fetchMarketContext(symbol);
      contextFearGreed = ctx.fearGreed;
      contextNews = ctx.news;
      contextEcon = ctx.econEvents;
    } catch (e) {
      console.warn("[Context] Failed to fetch market context:", e);
    }
    const newsText = contextNews.length > 0
      ? contextNews.map(n => `• ${n.title} (${n.source})`).join('\n')
      : 'No recent news available.';
    const eventsText = contextEcon.length > 0
      ? contextEcon.map(e => `• ${e.country} | ${e.title} | Impact: ${e.impact} | Forecast: ${e.forecast} | Previous: ${e.previous}`).join('\n')
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
- ONLY "strong_buy"/"strong_sell" if micro (${microTF}) is ALIGNED with macro. If micro is in pullback → downgrade to "buy"/"sell".
- Trend age zones: <10 infancy (cap 65), <25 youth (downgrade strong, cap 70), 25-50 mature (full), >50 old (cap 65).
- Fear&Greed: Extreme Fear (0-25)=contrarian, Greed (55-75)=trend follow, Extreme Greed (75-100)=cap confidence at 75.
- If HIGH impact economic event within 24h, warn in summary and reduce confidence -10% if NewsGuard is ON.
- BOLLINGER BANDS STRATEGY: If trend is UP and price pulled back 3-5 candles to touch Lower BB + reversal candle (hammer/pinbar/engulfing) → STRONG BUY. If trend is DOWN and price rallied 3-5 candles to touch Upper BB + reversal candle (shooting star/pinbar/engulfing) → STRONG SELL. This is a premium entry condition — give it HIGH weight in your decision.
- MICRO BB STRATEGY: Use the MICRO timeframe BB data to confirm entry timing. If MACRO trend is UP and MICRO BB touches Lower band with 3-5 pullback candles + reversal candle → STRONG BUY (early entry at pullback). If MACRO trend is DOWN and MICRO BB touches Upper band with 3-5 rally candles + reversal candle → STRONG SELL (early entry at correction). This is the MOST PREMIUM entry — catching the start of correction on the lower timeframe.

LANGUAGE RULES (CRITICAL):
${isAr ? `- ALL text fields (summary, detailedReasons impact) MUST be written in formal Arabic (فصحى) using professional financial terminology.
- Use terms like: الزخم، الاتجاه، الاختراق، مناطق العرض والطلب، التوافق الزمني، معنويات السوق، الأحداث الاقتصادية.
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
  "summary": "string — 2-3 sentence summary",
  "detailedReasons": [
    {"check": "RSI", "value": "62.5", "status": "neutral", "impact": "${isAr ? 'الزخم متوازن دون قراءة متطرفة' : 'Momentum balanced, no extreme reading'}"},
    {"check": "EMA Cross", "value": "bullish", "status": "positive", "impact": "${isAr ? 'المتوسط 9 فوق المتوسط 21 يدعم الاتجاه الصاعد' : '9 EMA above 21 EMA supports upward bias'}"},
    {"check": "Trend Direction", "value": "uptrend", "status": "positive", "impact": "${isAr ? 'السعر يسجّل قِمم وقيعان أعلى' : 'Price making higher highs and higher lows'}"},
    {"check": "Trend Age Zone", "value": "mature (32c)", "status": "positive", "impact": "${isAr ? 'منطقة ناضجة تسمح بالثقة الكاملة' : 'Mature zone allows full confidence'}"},
    {"check": "Volume Surge", "value": "true", "status": "positive", "impact": "${isAr ? 'ارتفاع الحجم يؤكد زخم الاختراق' : 'Volume spike confirms breakout momentum'}"},
    {"check": "Supply/Demand", "value": "demand 1.085", "status": "positive", "impact": "${isAr ? 'السعر يرتكز على منطقة طلب قوية' : 'Price resting on strong demand zone'}"},
    {"check": "Micro Alignment", "value": "aligned", "status": "positive", "impact": "${isAr ? 'الإطار الزمني الأصغر يؤكد الاتجاه العام' : 'Lower timeframe confirms macro direction'}"},
    {"check": "Fear&Greed", "value": "45/100", "status": "neutral", "impact": "${isAr ? 'معنويات السوق محايدة دون تطرف' : 'Market sentiment balanced, no extreme'}"},
    {"check": "News Sentiment", "value": "2 positive", "status": "positive", "impact": "${isAr ? 'تدفق أخبار إيجابي يدعم الاتجاه' : 'Favorable news flow supports direction'}"},
    {"check": "Economic Events", "value": "none", "status": "neutral", "impact": "${isAr ? 'لا أحداث اقتصادية عالية التأثير قادمة' : 'No upcoming high-impact events'}"}
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

    let aiResponse: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      await waitIfRateLimited();
      aiResponse = await callAIDirect(technicalPrompt, keyValue);
      if (!aiResponse?.error) break;
      if (aiResponse.error === 'rate_limited') { onRateLimited(); await new Promise(r => setTimeout(r, 10000)); continue; }
      if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
    }

    if (!aiResponse || aiResponse?.error) {
      throw new Error(aiResponse?.error || "AI service unavailable");
    }

    if (!aiResponse?.choices?.[0]?.message?.content) {
      throw new Error("AI Synthesis Error: No response content.");
    }

    const rawText = aiResponse.choices[0].message.content;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI Synthesis Error: Invalid JSON structure.");
    
    const resultData = JSON.parse(jsonMatch[0]);

    // ══════════════════════════════════════════════
    // PHASE 3: FINAL ENFORCEMENT & NORMALIZATION
    // ══════════════════════════════════════════════
    // Normalize signal: lowercase, replace spaces/underscores to match enum keys
    let rawSignal = String(resultData.signal || 'no_entry').toLowerCase().trim().replace(/\s+/g, '_');
    
    // Direct mapping for common AI variations
    if (rawSignal.includes('strong_buy') || rawSignal === 'strongbuy') rawSignal = 'strong_buy';
    else if (rawSignal.includes('strong_sell') || rawSignal === 'strongsell') rawSignal = 'strong_sell';
    else if (rawSignal.includes('buy')) rawSignal = 'buy';
    else if (rawSignal.includes('sell')) rawSignal = 'sell';
    else if (rawSignal.includes('neutral')) rawSignal = 'neutral';
    else rawSignal = 'no_entry';

    let finalSignal = rawSignal as SignalType;
    let finalConfidence = Number(resultData.confidence) || 50;

    // TREND AGE ZONE ENFORCEMENT
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

    // Zone 1: Too young — proportional confidence reduction
    if (totalAge < infantLimit) {
      finalConfidence = Math.round(finalConfidence * 0.7);
    }
    // Zone 2: Infant — downgrade strong signals to normal
    else if (totalAge < matureLimit) {
      if (finalSignal === SignalType.STRONG_BUY) finalSignal = SignalType.BUY;
      else if (finalSignal === SignalType.STRONG_SELL) finalSignal = SignalType.SELL;
      finalConfidence = Math.round(finalConfidence * 0.85);
    }
    // Zone 3: Mature — full strength allowed (no modification)
    else if (totalAge <= oldLimit) {
      // Strong signals pass through at full confidence
    }
    // Zone 4: Old/Exhaustion — proportional confidence reduction
    else {
      finalConfidence = Math.round(finalConfidence * 0.75);
    }

    // Also cap confidence if consecutive momentum (age) is too short
    if (age < minAge) {
      finalConfidence = Math.round(finalConfidence * 0.8);
    }

    // STRICT MATHEMATICAL ENFORCEMENT OF SETTINGS
    const minConf = settings?.minConfidence || 55;
    const strongConf = settings?.minStrongConfidence || 80;

    // Rule 1: Enforce minimum confidence threshold (Downgrade to neutral/no_entry if below minConfidence)
    if (finalConfidence < minConf) {
      finalSignal = SignalType.NEUTRAL;
    } else {
      // Rule 2: If signal is strong but confidence is below the minStrongConfidence threshold, downgrade it
      if (finalSignal === SignalType.STRONG_BUY && finalConfidence < strongConf) {
        finalSignal = SignalType.BUY;
      } else if (finalSignal === SignalType.STRONG_SELL && finalConfidence < strongConf) {
        finalSignal = SignalType.SELL;
      }
      // Rule 3: If signal is buy/sell but confidence meets or exceeds minStrongConfidence threshold, upgrade it
      else if (finalSignal === SignalType.BUY && finalConfidence >= strongConf) {
        finalSignal = SignalType.STRONG_BUY;
      } else if (finalSignal === SignalType.SELL && finalConfidence >= strongConf) {
        finalSignal = SignalType.STRONG_SELL;
      }
    }

    // ══════════════════════════════════════════════
    // FALLBACK: Build detailedReasons from metrics if AI didn't provide them
    // ══════════════════════════════════════════════
    let detailedReasons = resultData.detailedReasons;
    if (!detailedReasons || !Array.isArray(detailedReasons) || detailedReasons.length === 0) {
      detailedReasons = [];
      const addReason = (check: string, value: string, status: string, impact: string, source?: string) => {
        detailedReasons.push({ check, value, status, impact, source });
      };
      // RSI
      const rsiVal = metrics?.rsi;
      if (rsiVal !== undefined) {
        const rsiStatus = rsiVal > 70 ? 'negative' : rsiVal < 30 ? 'positive' : 'neutral';
        addReason('RSI', rsiVal.toFixed(1), rsiStatus,
          rsiStatus === 'negative' ? 'overbought, caution' :
          rsiStatus === 'positive' ? 'oversold, bounce potential' : 'neutral zone');
      }
      // EMA Cross
      if (metrics?.emaCross) {
        const isBull = metrics.emaCross === 'bullish';
        addReason('EMA Cross', metrics.emaCross, isBull ? 'positive' : 'negative',
          isBull ? 'supports upward bias' : 'supports downward bias');
      }
      // Trend Direction
      if (metrics?.direction) {
        const isUp = metrics.direction === 'uptrend';
        addReason('Trend Direction', metrics.direction,
          isUp ? 'positive' : metrics.direction === 'downtrend' ? 'negative' : 'neutral',
          isUp ? 'price making higher highs' :
          metrics.direction === 'downtrend' ? 'price making lower lows' : 'no clear direction');
      }
      // Trend Age Zone
      const ageZoneDesc = totalAge < infantLimit ? `infancy (<${infantLimit})` :
        totalAge < matureLimit ? `youth (${infantLimit}-${matureLimit})` :
        totalAge <= oldLimit ? `mature (${matureLimit}-${oldLimit})` : `old (>${oldLimit})`;
      const zoneStatus = totalAge < infantLimit ? 'neutral' :
        totalAge < matureLimit ? 'neutral' :
        totalAge <= oldLimit ? 'positive' : 'neutral';
      addReason('Trend Age Zone', `${totalAge}c — ${ageZoneDesc}`, zoneStatus,
        totalAge < infantLimit ? 'confidence capped at 65' :
        totalAge < matureLimit ? 'strong signals downgraded' :
        totalAge <= oldLimit ? 'full confidence allowed' : 'confidence capped at 65');
      // Volume Surge
      if (metrics?.volSurge !== undefined) {
        addReason('Volume Surge', metrics.volSurge ? 'true' : 'false',
          metrics.volSurge ? 'positive' : 'neutral',
          metrics.volSurge ? 'confirms momentum' : 'normal volume');
      }
      // Supply/Demand Zones
      if (supplyDemandZones.length > 0) {
        const nearestZone = supplyDemandZones[0];
        addReason('Supply/Demand Zone',
          `${nearestZone.type === 'supply' ? 'Supply' : 'Demand'} ${nearestZone.bottom.toFixed(2)}-${nearestZone.top.toFixed(2)} strength ${nearestZone.strength.toFixed(0)}%`,
          'neutral', `nearest ${nearestZone.type} zone identified`);
      }
      // Micro TF
      addReason('Micro TF Alignment', resultData.microSignal || 'unknown',
        resultData.microSignal === 'aligned' ? 'positive' : resultData.microSignal === 'pullback' ? 'neutral' : 'neutral',
        resultData.microSignal === 'aligned' ? 'micro aligns with macro' : 'micro diverging from macro');
      // Bollinger Bands
      if (metrics?.bbLower > 0) {
        const bbPct = Math.round(metrics.bbPercentB * 100);
        if (metrics.bbTouchLower && metrics.direction === 'uptrend' && (metrics.hasHammer || metrics.hasPinbar || metrics.hasEngulfing)) {
          addReason('BB Strategy (BUY)', `Pullback ${metrics.bbPullbackCount}c → Lower + Reversal`, 'positive',
            `strong buy: trend up + pullback to lower BB + reversal candle`);
        } else if (metrics.bbTouchUpper && metrics.direction === 'downtrend' && (metrics.hasShootingStar || metrics.hasPinbar || metrics.hasEngulfing)) {
          addReason('BB Strategy (SELL)', `Rally ${metrics.bbPullbackCount}c → Upper + Reversal`, 'negative',
            `strong sell: trend down + rally to upper BB + reversal candle`);
        } else {
          addReason('Bollinger Bands', `U:${metrics.bbUpper.toFixed(4)} M:${metrics.bbMiddle.toFixed(4)} L:${metrics.bbLower.toFixed(4)} (${bbPct}%B)`, 'neutral',
            `BB width ${metrics.bbWidth.toFixed(4)}`);
        }
      }
      // Micro BB Strategy
      if (microMetrics?.bbLower > 0) {
        const isUptrend = metrics?.direction === 'uptrend';
        const isDowntrend = metrics?.direction === 'downtrend';
        if (isUptrend && microMetrics.bbTouchLower && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 5 && (microMetrics.hasHammer || microMetrics.hasPinbar || microMetrics.hasEngulfing)) {
          addReason(`Micro BB (${microTF}) Strategy (BUY)`, `Pullback ${microMetrics.bbPullbackCount}c → Lower + Reversal on ${microTF}`, 'positive',
            `strong buy: macro uptrend + micro pullback ${microMetrics.bbPullbackCount} candles + touch lower BB + reversal candle`);
        } else if (isDowntrend && microMetrics.bbTouchUpper && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 5 && (microMetrics.hasShootingStar || microMetrics.hasPinbar || microMetrics.hasEngulfing)) {
          addReason(`Micro BB (${microTF}) Strategy (SELL)`, `Rally ${microMetrics.bbPullbackCount}c → Upper + Reversal on ${microTF}`, 'negative',
            `strong sell: macro downtrend + micro rally ${microMetrics.bbPullbackCount} candles + touch upper BB + reversal candle`);
        } else if (microMetrics.bbTouchLower && isUptrend) {
          addReason(`Micro BB (${microTF}) Touch Lower`, `price at lower band on ${microTF}`, 'positive',
            `micro timeframe approaching lower BB in macro uptrend`);
        } else if (microMetrics.bbTouchUpper && isDowntrend) {
          addReason(`Micro BB (${microTF}) Touch Upper`, `price at upper band on ${microTF}`, 'negative',
            `micro timeframe approaching upper BB in macro downtrend`);
        }
      }
      // Fear&Greed
      const fg = contextFearGreed;
      if (fg?.value !== undefined) {
        const fgStatus = fg.value <= 25 ? 'positive' : fg.value >= 75 ? 'negative' : 'neutral';
        addReason('Fear & Greed', `${fg.value}/100 — ${fg.classification || ''}`, fgStatus,
          fgStatus === 'positive' ? 'contrarian buy signal' :
          fgStatus === 'negative' ? 'extreme greed, cap confidence' : 'neutral sentiment');
      }
      // News
      if (contextNews.length > 0) {
        const sources = [...new Set(contextNews.map(n => n.source).filter(Boolean))];
        addReason('News Sentiment', `${contextNews.length} articles`, 'neutral', 'check summary for details', sources.join(', '));
      }
      // Economic Events
      addReason('Economic Events', contextEcon.length > 0 ? `${contextEcon.length} events this week` : 'no major events',
        contextEcon.some((e: any) => e.impact === 'High') ? 'negative' : 'neutral',
        contextEcon.some((e: any) => e.impact === 'High') ? '-10% confidence penalty' : 'no penalty');
    }

    // ALWAYS calculate SL/TP from ATR/price data — AI values are unreliable
    const currentPrice = closes[closes.length - 1] || 0;
    const atr = metrics?.atr || 0;

    let finalStopLoss = 0;
    let finalTakeProfit = 0;

    if (currentPrice > 0) {
      // Determine SL distance based on instrument type and ATR
      let slDist = 0;
      const isForex = type === MarketType.FOREX;
      const isCrypto = type === MarketType.CRYPTO;

      if (atr > 0) {
        const atrMultiplier = isCrypto ? 3 : 2;
        slDist = atr * atrMultiplier;
      }

      let minSL: number;
      let maxSL: number;

      if (isForex) {
        // Forex: use pip-based min/max (pipSize = 0.0001 for most, 0.01 for JPY)
        const pipSize = symbol.toUpperCase().includes('JPY') ? 0.01 : 0.0001;
        const minPips = 30;   // 30 pips minimum SL
        const maxPips = 200;  // 200 pips maximum SL
        minSL = minPips * pipSize;
        maxSL = maxPips * pipSize;
      } else if (isCrypto) {
        minSL = currentPrice * 0.03;  // 3%
        maxSL = currentPrice * 0.12;  // 12%
      } else {
        minSL = currentPrice * 0.02;  // 2%
        maxSL = currentPrice * 0.08;  // 8%
      }

      // Apply min/max constraints
      slDist = Math.max(slDist, minSL);
      slDist = Math.min(slDist, maxSL);

      if (finalSignal.includes('buy')) {
        finalStopLoss = currentPrice - slDist;
        finalTakeProfit = currentPrice + slDist * 2;
      } else if (finalSignal.includes('sell')) {
        finalStopLoss = currentPrice + slDist;
        finalTakeProfit = currentPrice - slDist * 2;
      } else {
        // Neutral
        finalStopLoss = currentPrice - slDist;
        finalTakeProfit = currentPrice + slDist;
      }
    }

    return {
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
      takeProfit: finalTakeProfit
    };

  } catch (error: any) {
    console.error("[Engine Error]:", error);
    throw new Error(error.message || "Stability logic error.");
  }
}
