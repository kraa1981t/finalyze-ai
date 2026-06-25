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

  // 8. Bollinger Band Pullback Detection (3-6 candles opposite to trend)
  let bbPullbackCount = 0;
  let bbTouchLower = false;
  let bbTouchUpper = false;
  if (len >= 3 && bbLower > 0) {
    for (let i = len - 1; i >= Math.max(0, len - 7); i--) {
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
    direction, age, totalAge, rsi, emaCross, volSurge, atr,
    bbUpper, bbMiddle, bbLower, bbWidth, bbPercentB,
    bbPullbackCount, bbTouchLower, bbTouchUpper,
    hasHammer, hasPinbar, hasEngulfing, hasShootingStar,
    hasBullishCandle, hasBearishCandle,
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

  // ── PRIMARY 1: BB Pullback ──
  if (metrics?.bbLower > 0 && metrics?.bbUpper > 0) {
    const bbPct = Math.round(metrics.bbPercentB * 100);
    if (isUp && metrics.bbTouchLower && metrics.bbPullbackCount >= 3 && metrics.bbPullbackCount <= 6 && (metrics.hasHammer || metrics.hasPinbar || metrics.hasEngulfing || metrics.hasBullishCandle)) {
      primaryScore += 3; bbPullbackMet = true;
      reasons.push({ check: 'BB Pullback (BUY)', value: `Pullback ${metrics.bbPullbackCount}c → Lower + Reversal`, status: 'positive', impact: 'strong: trend up + pullback + reversal', primary: true });
    } else if (isDown && metrics.bbTouchUpper && metrics.bbPullbackCount >= 3 && metrics.bbPullbackCount <= 6 && (metrics.hasShootingStar || metrics.hasPinbar || metrics.hasEngulfing || metrics.hasBearishCandle)) {
      primaryScore -= 3; bbPullbackMet = true;
      reasons.push({ check: 'BB Pullback (SELL)', value: `Rally ${metrics.bbPullbackCount}c → Upper + Reversal`, status: 'negative', impact: 'strong: trend down + rally + reversal', primary: true });
    } else {
      reasons.push({ check: 'BB Pullback', value: `No pullback — ${bbPct}%B`, status: 'neutral', impact: 'BB pullback not met', primary: true });
    }
  }

  // ── PRIMARY 2: Supply/Demand ──
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
    reasons.push({ check: 'Supply/Demand', value: 'No zones detected', status: 'neutral', impact: 'no zones — signal allowed', primary: true });
  }

  // ── PRIMARY 3: Trend Age ──
  if (totalAge >= matureLimit && totalAge <= oldLimit) {
    trendAgeMet = true;
    reasons.push({ check: 'Trend Age', value: `${totalAge}c — Mature`, status: 'positive', impact: 'trend mature — full signal', primary: true });
  } else if (totalAge < infantLimit) {
    reasons.push({ check: 'Trend Age', value: `${totalAge}c — Infant`, status: 'negative', impact: 'trend too young — low confidence', primary: true });
  } else if (totalAge < matureLimit) {
    trendAgeMet = true;
    reasons.push({ check: 'Trend Age', value: `${totalAge}c — Youth`, status: 'positive', impact: 'trend developing — allowed', primary: true });
  } else {
    reasons.push({ check: 'Trend Age', value: `${totalAge}c — Old`, status: 'negative', impact: 'trend exhausting', primary: true });
  }

  // ── PRIMARY 4: News ──
  newsMet = true;
  reasons.push({ check: 'News Sentiment', value: 'No active events', status: 'neutral', impact: 'no blocking news', primary: true });

  // ── SUPPORTING: RSI ──
  if (metrics?.rsi !== undefined) {
    supportTotal++;
    if (metrics.rsi < 30) { supportScore += 1; if (isUp) supportAligned++; reasons.push({ check: 'RSI', value: metrics.rsi.toFixed(1), status: 'positive', impact: 'oversold — supports buy' }); }
    else if (metrics.rsi > 70) { supportScore -= 1; if (isDown) supportAligned++; reasons.push({ check: 'RSI', value: metrics.rsi.toFixed(1), status: 'negative', impact: 'overbought — supports sell' }); }
    else { reasons.push({ check: 'RSI', value: metrics.rsi.toFixed(1), status: 'neutral', impact: 'neutral zone' }); }
  }

  // ── SUPPORTING: EMA Cross ──
  if (metrics?.emaCross === 'bullish') { supportScore += 1; supportTotal++; if (isUp) supportAligned++; reasons.push({ check: 'EMA Cross', value: 'bullish', status: 'positive', impact: 'bullish cross supports up' }); }
  else if (metrics?.emaCross === 'bearish') { supportScore -= 1; supportTotal++; if (isDown) supportAligned++; reasons.push({ check: 'EMA Cross', value: 'bearish', status: 'negative', impact: 'bearish cross supports down' }); }

  // ── SUPPORTING: Trend Direction ──
  if (isUp) { supportScore += 0.5; supportTotal++; supportAligned++; reasons.push({ check: 'Trend Direction', value: 'uptrend', status: 'positive', impact: 'price making higher highs' }); }
  else if (isDown) { supportScore -= 0.5; supportTotal++; supportAligned++; reasons.push({ check: 'Trend Direction', value: 'downtrend', status: 'negative', impact: 'price making lower lows' }); }
  else { supportTotal++; reasons.push({ check: 'Trend Direction', value: 'sideways', status: 'neutral', impact: 'no clear direction' }); }

  // ── SUPPORTING: Volume ──
  if (metrics?.volSurge) { supportTotal++; supportScore += isUp ? 0.5 : isDown ? -0.5 : 0; reasons.push({ check: 'Volume Surge', value: 'true', status: isUp ? 'positive' : isDown ? 'negative' : 'neutral', impact: 'confirms momentum' }); }

  // ── SUPPORTING: Fear&Greed (Contrarian) ──
  if (contextFearGreed?.value !== undefined) {
    supportTotal++;
    const fg = contextFearGreed.value;
    if (fg <= 25) { supportScore += 1.5; if (isUp || !isDown) supportAligned++; reasons.push({ check: 'Fear&Greed', value: `${fg}/100 — ${contextFearGreed.classification}`, status: 'positive', impact: 'extreme fear — contrarian buy signal' }); }
    else if (fg >= 75) { supportScore -= 1.5; if (isDown || !isUp) supportAligned++; reasons.push({ check: 'Fear&Greed', value: `${fg}/100 — ${contextFearGreed.classification}`, status: 'negative', impact: 'extreme greed — contrarian sell signal' }); }
    else { reasons.push({ check: 'Fear&Greed', value: `${fg}/100 — ${contextFearGreed.classification}`, status: 'neutral', impact: 'neutral sentiment' }); }
  }

  // ── SUPPORTING: Micro Alignment ──
  if (microMetrics) {
    supportTotal++;
    const microAligned = (microMetrics.emaCross === 'bullish' && isUp) || (microMetrics.emaCross === 'bearish' && isDown);
    if (microAligned) { supportAligned++; supportScore += isUp ? 0.5 : -0.5; }
    reasons.push({ check: 'Micro Alignment', value: microAligned ? 'aligned' : 'diverging', status: microAligned ? 'positive' : 'neutral', impact: microAligned ? 'micro confirms macro' : 'micro diverging' });
  }

  // ── Compute Score ──
  const totalScore = primaryScore + supportScore;
  const primaryMetCount = [bbPullbackMet, supplyDemandMet, trendAgeMet, newsMet].filter(Boolean).length;

  // ── Sideways penalty: need strong evidence to trade ──
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

  // ── Signal classification ──
  let rawSignal: SignalType;

  // Sideways + no strong evidence = NEUTRAL
  if (!isUp && !isDown && !hasStrongEvidence) {
    rawSignal = SignalType.NEUTRAL;
    confidence = Math.min(confidence, 35);
  } else if (totalScore > 0 && primaryMetCount >= 3) {
    if (confidence >= strongThresh && bbPullbackMet) rawSignal = SignalType.STRONG_BUY;
    else if (confidence >= buyThresh) rawSignal = SignalType.BUY;
    else rawSignal = SignalType.NEUTRAL;
  } else if (totalScore < 0 && primaryMetCount >= 3) {
    if (confidence >= strongThresh && bbPullbackMet) rawSignal = SignalType.STRONG_SELL;
    else if (confidence >= buyThresh) rawSignal = SignalType.SELL;
    else rawSignal = SignalType.NEUTRAL;
  } else {
    rawSignal = SignalType.NEUTRAL;
    confidence = Math.min(confidence, buyThresh - 1);
  }

  // Age zone caps
  if (totalAge < infantLimit) { confidence = Math.round(confidence * 0.7); rawSignal = rawSignal === SignalType.STRONG_BUY ? SignalType.BUY : rawSignal === SignalType.STRONG_SELL ? SignalType.SELL : rawSignal; }
  else if (totalAge < matureLimit) { if (rawSignal === SignalType.STRONG_BUY) rawSignal = SignalType.BUY; if (rawSignal === SignalType.STRONG_SELL) rawSignal = SignalType.SELL; confidence = Math.round(confidence * 0.85); }
  else if (totalAge > oldLimit) { confidence = Math.round(confidence * 0.75); }
  if (age < minAge) confidence = Math.round(confidence * 0.8);

  const minConf = settings?.minConfidence || 45;
  if (confidence < minConf) rawSignal = SignalType.NEUTRAL;

  const dir = metrics?.direction || 'sideways';
  const summary = lang === 'ar'
    ? `تحليل فني: ${symbol} — ${dir === 'uptrend' ? 'اتجاه صاعد' : dir === 'downtrend' ? 'اتجاه هابط' : 'بدون اتجاه.clear'}. RSI ${metrics?.rsi?.toFixed(1) || 'N/A'}. الثقة: ${confidence}%.`
    : `Analysis: ${symbol} — ${dir} trend. RSI ${metrics?.rsi?.toFixed(1) || 'N/A'}. Confidence: ${confidence}%.`;

  return {
    symbol, type, timeframe,
    signal: rawSignal, confidence, summary, detailedReasons: reasons,
    microSignal: 'unknown', microTrend: '', technicalScore: Math.round(totalScore * 16.7 + 50),
    sentimentScore: contextFearGreed?.value ?? 50, historicalMatch: '',
    timestamp: new Date().toISOString(),
    userId: '',
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
        console.log(`[Batch] ${p.symbol} → ${result.signal} (${result.confidence}%)`);
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

  try {
    const TF_PROGRESSION = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M', '1Y'];
    const currentIndex = TF_PROGRESSION.indexOf(timeframe);
    const macro1 = TF_PROGRESSION[Math.min(currentIndex + 1, TF_PROGRESSION.length - 1)];
    
    const macro2 = TF_PROGRESSION[Math.min(currentIndex + 2, TF_PROGRESSION.length - 1)];
    const microTF = currentIndex > 0 ? TF_PROGRESSION[currentIndex - 1] : TF_PROGRESSION[0];

    // Fetch ALL data sources in PARALLEL — saves ~10-15s per symbol
    const [rawData, microDataRaw, ctxResult] = await Promise.all([
      fetchMarketDataDirect(symbol, timeframe).catch(() => ({ chart: { result: [{ indicators: { quote: [{}] } }] } })),
      fetchMarketDataDirect(symbol, microTF).catch(() => ({ chart: { result: [{ indicators: { quote: [{}] } }] } })),
      fetchMarketContext(symbol).catch(() => ({ fearGreed: null, news: [], econEvents: [] })),
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
      ? supplyDemandZones.map(z => `${z.type === 'supply' ? 'Supply' : 'Demand'} zone: ${z.bottom.toFixed(2)}–${z.top.toFixed(2)} (strength ${z.strength.toFixed(0)}%)`).join('. ')
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
- 4 PRIMARY CONDITIONS (must ALL be favorable for strong signal):
  1. BB Pullback: trend + 3-6 pullback candles + touch BB + reversal candle → STRONG BUY/SELL
  2. Supply/Demand: demand zone + uptrend = confirms buy; supply zone + downtrend = confirms sell
  3. Trend Age: <10 infant (reduce confidence), <25 youth, 25-50 mature (full strength), >50 old (reduced)
  4. News Sentiment: negative news blocks strong signal; no news = allowed
- ONLY "strong_buy"/"strong_sell" if ALL 4 primary conditions are favorable + micro (${microTF}) aligned.
- If any primary condition fails → "buy"/"sell" (not strong).
- Supporting conditions (RSI, EMA, Volume, Micro BB) add boost only.
- BOLLINGER BANDS STRATEGY: If trend is UP and price pulled back 3-6 candles to touch Lower BB (or within 1.5%) + reversal candle → STRONG BUY. If trend is DOWN and price rallied 3-6 candles to touch Upper BB (or within 1.5%) + reversal candle → STRONG SELL.
- MICRO BB STRATEGY: Same conditions on micro timeframe → adds +2 boost.

CRITICAL CONTRARIAN RULES:
- Fear&Greed ≤ 25 (EXTREME FEAR): This is a CONTRARIAN BUY signal. Strongly prefer "buy" or "strong_buy". Do NOT give "sell" unless there is overwhelming bearish evidence (all 4 primary conditions met for sell).
- Fear&Greed ≥ 75 (EXTREME GREED): This is a CONTRARIAN SELL signal. Strongly prefer "sell" or "strong_sell". Do NOT give "buy" unless there is overwhelming bullish evidence.
- Fear&Greed 26-40 (Fear): Mild contrarian buy bias. Prefer "buy" over "sell" when indicators are mixed.
- Fear&Greed 60-74 (Greed): Mild contrarian sell bias. Prefer "sell" over "buy" when indicators are mixed.
- Trend "sideways" with no clear direction: Default to "neutral" unless there is a very strong setup (BB pullback + volume + micro alignment).
- Trend Age < 10 (Infant): Significantly reduce confidence. The trend is unreliable. "buy"/"sell" only if indicators are strongly aligned.

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

    // Age zone limits — needed by local fallback
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

    // ══════════════════════════════════════════════
    // LOCKED (v6): SIGNAL ENGINE RULES — DO NOT MODIFY
    // ══════════════════════════════════════════════
    // RULE: ALL 4 primary conditions are MANDATORY for ANY signal.
    // RULE: BB Pullback (lenient): passes if BB exists + aligns with direction. Blocks only on active conflict.
    // RULE: Strict pullback (touch+3-6c+reversal) is for STRONG upgrade bonus, NOT for gate.
    // RULE: Primary conditions computed from METRICS, not AI text.
    // RULE: Supporting ratio <40% → NEUTRAL, 40-59% → regular, ≥60% → STRONG allowed.
    // RULE: Youth zone (10-25) is the ONLY zone allowing STRONG signals.
    // RULE: Supply/Demand — no zones detected = pass (not block).
    // RULE: Conflict = 3+ buy reasons AND 3+ sell reasons → force NEUTRAL.
    // ══════════════════════════════════════════════

    // ── STEP 1: Build detailedReasons BEFORE any enforcement ──
    let detailedReasons: any[] = Array.isArray(resultData.detailedReasons) ? [...resultData.detailedReasons] : [];

    // Build fallback from metrics if AI didn't provide reasons
    if (detailedReasons.length === 0) {
      const addReason = (check: string, value: string, status: string, impact: string, source?: string) => {
        detailedReasons.push({ check, value, status, impact, source });
      };
      const rsiVal = metrics?.rsi;
      if (rsiVal !== undefined) {
        const rsiStatus = rsiVal > 70 ? 'negative' : rsiVal < 30 ? 'positive' : 'neutral';
        addReason('RSI', rsiVal.toFixed(1), rsiStatus,
          rsiStatus === 'negative' ? 'overbought, caution' :
          rsiStatus === 'positive' ? 'oversold, bounce potential' : 'neutral zone');
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
        addReason('Fear & Greed', `${fg.value}/100 — ${fg.classification || ''}`, fgStatus,
          fgStatus === 'positive' ? 'contrarian buy signal' :
          fgStatus === 'negative' ? 'extreme greed, cap confidence' : 'neutral sentiment');
      }
      if (contextNews.length > 0) {
        const sources = [...new Set(contextNews.map(n => n.source).filter(Boolean))];
        addReason('News Sentiment', `${contextNews.length} articles`, 'neutral', 'check summary for details', sources.join(', '));
      } else {
        addReason('News Sentiment', 'No active events', 'neutral', 'no blocking news — signal allowed');
      }
      addReason('Economic Events', contextEcon.length > 0 ? `${contextEcon.length} events this week` : 'no major events',
        contextEcon.some((e: any) => e.impact === 'High') ? 'negative' : 'neutral',
        contextEcon.some((e: any) => e.impact === 'High') ? '-10% confidence penalty' : 'no penalty');
    }

    // ── STEP 1b: Trend Age Zone fallback reason ──
    if (!detailedReasons.some((r: any) => r.check?.includes('Trend Age'))) {
      const ageZoneDesc = totalAge < infantLimit ? `Infant (<${infantLimit})` :
        totalAge < matureLimit ? `Youth (${infantLimit}-${matureLimit})` :
        totalAge <= oldLimit ? `Mature (${matureLimit}-${oldLimit})` : `Old (>${oldLimit})`;
      const zoneStatus = totalAge >= matureLimit && totalAge <= oldLimit ? 'positive' :
        totalAge < infantLimit ? 'negative' : 'neutral';
      detailedReasons.push({
        check: 'Trend Age', value: `${totalAge}c — ${ageZoneDesc}`, status: zoneStatus,
        impact: zoneStatus === 'positive' ? 'trend mature — full signal allowed' :
          zoneStatus === 'negative' ? 'trend age issue — confidence reduced' : 'trend developing'
      });
    }

    // ── STEP 1c: Supply/Demand fallback reason ──
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

    // ── STEP 1d: BB Pullback fallback — ON MICRO TF ──
    if (!detailedReasons.some((r: any) => r.check?.includes('BB Pullback') || r.check?.includes('BB Strategy'))) {
      if (microMetrics?.bbLower > 0) {
        const bbPct = Math.round(microMetrics.bbPercentB * 100);
        const isUp = metrics.direction === 'uptrend';
        const isDown = metrics.direction === 'downtrend';
        if (isUp && microMetrics.bbTouchLower && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 6 && (microMetrics.hasHammer || microMetrics.hasPinbar || microMetrics.hasEngulfing || microMetrics.hasBullishCandle)) {
          detailedReasons.push({ check: `BB Pullback (${microTF}) (BUY)`, value: `Pullback ${microMetrics.bbPullbackCount}c → Lower + Reversal on ${microTF}`, status: 'positive', impact: `strong: trend up + pullback to lower BB + reversal on ${microTF}` });
        } else if (isDown && microMetrics.bbTouchUpper && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 6 && (microMetrics.hasShootingStar || microMetrics.hasPinbar || microMetrics.hasEngulfing || microMetrics.hasBearishCandle)) {
          detailedReasons.push({ check: `BB Pullback (${microTF}) (SELL)`, value: `Rally ${microMetrics.bbPullbackCount}c → Upper + Reversal on ${microTF}`, status: 'negative', impact: `strong: trend down + rally to upper BB + reversal on ${microTF}` });
        } else if (microMetrics.bbTouchLower && isUp) {
          detailedReasons.push({ check: `BB Pullback (${microTF}) (BUY)`, value: `Near Lower (${bbPct}%) — ${microMetrics.bbPullbackCount}c on ${microTF}`, status: 'positive', impact: `partial: approaching lower BB on ${microTF}` });
        } else if (microMetrics.bbTouchUpper && isDown) {
          detailedReasons.push({ check: `BB Pullback (${microTF}) (SELL)`, value: `Near Upper (${bbPct}%) — ${microMetrics.bbPullbackCount}c on ${microTF}`, status: 'negative', impact: `partial: approaching upper BB on ${microTF}` });
        } else {
          detailedReasons.push({ check: `BB Pullback (${microTF})`, value: `No pullback — ${bbPct}%B on ${microTF}`, status: 'neutral', impact: `BB pullback NOT met on ${microTF}` });
        }
      } else if (metrics?.bbLower > 0) {
        const bbPct = Math.round(metrics.bbPercentB * 100);
        const isUp = metrics.direction === 'uptrend';
        const isDown = metrics.direction === 'downtrend';
        if (isUp && metrics.bbTouchLower && metrics.bbPullbackCount >= 3 && metrics.bbPullbackCount <= 6 && (metrics.hasHammer || metrics.hasPinbar || metrics.hasEngulfing || metrics.hasBullishCandle)) {
          detailedReasons.push({ check: 'BB Pullback (BUY)', value: `Pullback ${metrics.bbPullbackCount}c → Lower + Reversal`, status: 'positive', impact: 'strong: trend up + pullback to lower BB + reversal' });
        } else if (isDown && metrics.bbTouchUpper && metrics.bbPullbackCount >= 3 && metrics.bbPullbackCount <= 6 && (metrics.hasShootingStar || metrics.hasPinbar || metrics.hasEngulfing || metrics.hasBearishCandle)) {
          detailedReasons.push({ check: 'BB Pullback (SELL)', value: `Rally ${metrics.bbPullbackCount}c → Upper + Reversal`, status: 'negative', impact: 'strong: trend down + rally to upper BB + reversal' });
        } else {
          detailedReasons.push({ check: 'BB Pullback', value: `No pullback — ${bbPct}%B`, status: 'neutral', impact: 'BB pullback NOT met' });
        }
      }
    }

    // ── STEP 1e: Micro BB fallback — fully on micro TF ──
    if (!detailedReasons.some((r: any) => r.check?.includes('Micro BB'))) {
      if (microMetrics?.bbLower > 0) {
        const isUptrend = metrics?.direction === 'uptrend';
        const isDowntrend = metrics?.direction === 'downtrend';
        if (isUptrend && microMetrics.bbTouchLower && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 6 && (microMetrics.hasHammer || microMetrics.hasPinbar || microMetrics.hasEngulfing || microMetrics.hasBullishCandle)) {
          detailedReasons.push({ check: `Micro BB (${microTF}) Strategy (BUY)`, value: `Pullback ${microMetrics.bbPullbackCount}c → Lower + Reversal on ${microTF}`, status: 'positive', impact: `strong buy: macro uptrend + micro pullback + reversal` });
        } else if (isDowntrend && microMetrics.bbTouchUpper && microMetrics.bbPullbackCount >= 3 && microMetrics.bbPullbackCount <= 6 && (microMetrics.hasShootingStar || microMetrics.hasPinbar || microMetrics.hasEngulfing || microMetrics.hasBearishCandle)) {
          detailedReasons.push({ check: `Micro BB (${microTF}) Strategy (SELL)`, value: `Rally ${microMetrics.bbPullbackCount}c → Upper + Reversal on ${microTF}`, status: 'negative', impact: `strong sell: macro downtrend + micro rally + reversal` });
        } else if (microMetrics.bbTouchLower && isUptrend) {
          detailedReasons.push({ check: `Micro BB (${microTF}) Touch Lower`, value: `price at lower band on ${microTF}`, status: 'positive', impact: `micro timeframe approaching lower BB in macro uptrend` });
        } else if (microMetrics.bbTouchUpper && isDowntrend) {
          detailedReasons.push({ check: `Micro BB (${microTF}) Touch Upper`, value: `price at upper band on ${microTF}`, status: 'negative', impact: `micro timeframe approaching upper BB in macro downtrend` });
        }
      }
    }

    // ── STEP 2: Compute primary & supporting from METRICS (not AI text) ──
    const isUp = metrics?.direction === 'uptrend';
    const isDown = metrics?.direction === 'downtrend';

    // PRIMARY 1 — BB Pullback (lenient gate): passes if BB exists and aligns with direction.
    // Strict pullback (touch+3-6c+reversal) is for STRONG upgrade only, not for blocking signals.
    const hasBbData = !!(metrics?.bbLower > 0);
    const hasMicroBbData = !!(microMetrics && microMetrics.bbLower > 0);
    // Lenient: BB data exists → pass. Only blocks if BB actively conflicts with direction.
    // e.g. price at upper BB in uptrend with no pullback = conflict → block
    let bbMet = true;
    if (hasMicroBbData) {
      // Micro BB available — use it: pass if price aligns OR if no strong conflict
      const microAtUpper = microMetrics.bbPercentB > 0.85;
      const microAtLower = microMetrics.bbPercentB < 0.15;
      bbMet = !(microAtUpper && isUp) && !(microAtLower && isDown);
    } else if (hasBbData) {
      // No micro but macro BB available — same lenient check
      const macroAtUpper = (metrics?.bbPercentB ?? 0.5) > 0.85;
      const macroAtLower = (metrics?.bbPercentB ?? 0.5) < 0.15;
      bbMet = !(macroAtUpper && isUp) && !(macroAtLower && isDown);
    }
    // If no BB data at all → pass

    // PRIMARY 2 — Supply/Demand: no zones = pass, zones support = pass, zones conflict = BLOCK
    const hasZones = supplyDemandZones.length > 0;
    const nearestZone = supplyDemandZones[0];
    const sdMet = !hasZones || ((nearestZone?.type === 'demand' && isUp) || (nearestZone?.type === 'supply' && isDown));

    // PRIMARY 3 — Trend Age: ALL zones pass (never blocks). Youth allows STRONG; others downgrade.
    const ageMet = true;

    // PRIMARY 4 — News: always passes
    const newsMet = true;

    const primaryTotal = 4;
    let primaryMetCount = 0;
    if (bbMet) primaryMetCount++;
    if (sdMet) primaryMetCount++;
    if (ageMet) primaryMetCount++;
    if (newsMet) primaryMetCount++;

    // Supporting conditions from metrics
    const supportConditions = [
      { met: metrics?.rsi !== undefined && ((metrics.rsi > 30 && metrics.rsi < 70) || (metrics.rsi <= 30 && isUp) || (metrics.rsi >= 70 && isDown)) },
      { met: (metrics?.emaCross === 'bullish' && isUp) || (metrics?.emaCross === 'bearish' && isDown) },
      { met: metrics?.volSurge === true },
      { met: !!microMetrics?.emaCross && ((microMetrics.emaCross === 'bullish' && isUp) || (microMetrics.emaCross === 'bearish' && isDown)) },
      { met: microMetrics?.bbPercentB !== undefined && ((microMetrics.bbPercentB < 0.3 && isUp) || (microMetrics.bbPercentB > 0.7 && isDown)) },
      { met: contextFearGreed?.value !== undefined && ((contextFearGreed.value < 30 && isUp) || (contextFearGreed.value > 70 && isDown)) },
    ];
    const supportMet = supportConditions.filter(c => c.met).length;
    const supportTotal = supportConditions.length;
    const supportRatio = supportTotal > 0 ? supportMet / supportTotal : 0;

    // ── STEP 2b: Conflict detection ──
    const buyReasons = detailedReasons.filter((r: any) => r.status === 'positive').length;
    const sellReasons = detailedReasons.filter((r: any) => r.status === 'negative').length;
    const hasConflict = buyReasons >= 3 && sellReasons >= 3;

    // ── STEP 3: Normalize AI signal ──
    let rawSignal = String(resultData.signal || 'no_entry').toLowerCase().trim().replace(/\s+/g, '_');
    if (rawSignal.includes('strong_buy') || rawSignal === 'strongbuy') rawSignal = 'strong_buy';
    else if (rawSignal.includes('strong_sell') || rawSignal === 'strongsell') rawSignal = 'strong_sell';
    else if (rawSignal.includes('buy')) rawSignal = 'buy';
    else if (rawSignal.includes('sell')) rawSignal = 'sell';
    else if (rawSignal.includes('neutral')) rawSignal = 'neutral';
    else rawSignal = 'no_entry';

    let finalSignal = rawSignal as SignalType;
    let finalConfidence = Number(resultData.confidence) || 50;

    // ── STEP 4: Age zone adjustments ──
    if (totalAge < infantLimit) {
      finalConfidence = Math.round(finalConfidence * 0.7);
      if (finalSignal === SignalType.STRONG_BUY) finalSignal = SignalType.BUY;
      if (finalSignal === SignalType.STRONG_SELL) finalSignal = SignalType.SELL;
    } else if (totalAge < matureLimit) {
      // Youth — ONLY zone allowing STRONG
    } else if (totalAge <= oldLimit) {
      // Mature — downgrade STRONG to regular
      if (finalSignal === SignalType.STRONG_BUY) finalSignal = SignalType.BUY;
      if (finalSignal === SignalType.STRONG_SELL) finalSignal = SignalType.SELL;
    } else {
      finalConfidence = Math.round(finalConfidence * 0.75);
      if (finalSignal === SignalType.STRONG_BUY) finalSignal = SignalType.BUY;
      if (finalSignal === SignalType.STRONG_SELL) finalSignal = SignalType.SELL;
    }
    if (age < minAge) finalConfidence = Math.round(finalConfidence * 0.8);

    // ── STEP 5: Compute confidence from metrics ──
    const maxPrimary = settings?.maxPrimaryWeight ?? 50;
    const maxSupport = settings?.maxSupportingWeight ?? 20;
    const baseConf = settings?.baseConfidence ?? 25;
    const primaryConf = Math.round((primaryMetCount / primaryTotal) * maxPrimary);
    const supportConf = Math.round(supportRatio * maxSupport);
    const computedConfidence = baseConf + primaryConf + supportConf;
    finalConfidence = computedConfidence;

    // ── STEP 6: Enforce signal from conditions (metrics-based) ──
    // Derive direction from AI signal OR from metrics
    const aiDirection = finalSignal.includes('buy') ? 'buy' : finalSignal.includes('sell') ? 'sell' : null;
    const metricsDirection = isUp ? 'buy' : isDown ? 'sell' : null;
    const direction = aiDirection || metricsDirection;

    if (hasConflict) {
      finalSignal = SignalType.NEUTRAL;
    } else if (primaryMetCount < 3) {
      finalSignal = SignalType.NEUTRAL;
    } else {
      const strongThreshold = settings?.strongThreshold ?? 60;
      const buyThreshold = settings?.buyThreshold ?? 40;
      const minStrongSupport = (settings?.minStrongSupport ?? 50) / 100;
      if (direction === 'buy') {
        if (supportRatio >= minStrongSupport && finalConfidence >= strongThreshold) {
          finalSignal = SignalType.STRONG_BUY;
        } else if (finalConfidence >= buyThreshold) {
          finalSignal = SignalType.BUY;
        } else {
          finalSignal = SignalType.NEUTRAL;
        }
      } else if (direction === 'sell') {
        if (supportRatio >= minStrongSupport && finalConfidence >= strongThreshold) {
          finalSignal = SignalType.STRONG_SELL;
        } else if (finalConfidence >= buyThreshold) {
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

    // ── STEP 7: Contrarian override for extreme Fear&Greed ──
    const fgValue = contextFearGreed?.value;
    if (fgValue !== undefined && fgValue !== null) {
      // Extreme Fear (≤25): force BUY, block SELL unless overwhelming bearish evidence
      if (fgValue <= 25) {
        if (finalSignal === SignalType.SELL || finalSignal === SignalType.STRONG_SELL) {
          const sellEvidence = detailedReasons.filter((r: any) => r.status === 'negative').length;
          if (sellEvidence < 5) {
            finalSignal = SignalType.BUY;
            finalConfidence = Math.max(finalConfidence, 40);
          }
        }
        if (finalSignal === SignalType.NEUTRAL && primaryMetCount >= 3) {
          finalSignal = SignalType.BUY;
          finalConfidence = Math.max(finalConfidence, 35);
        }
      }
      // Extreme Greed (≥75): force SELL, block BUY unless overwhelming bullish evidence
      else if (fgValue >= 75) {
        if (finalSignal === SignalType.BUY || finalSignal === SignalType.STRONG_BUY) {
          const buyEvidence = detailedReasons.filter((r: any) => r.status === 'positive').length;
          if (buyEvidence < 5) {
            finalSignal = SignalType.SELL;
            finalConfidence = Math.max(finalConfidence, 40);
          }
        }
        if (finalSignal === SignalType.NEUTRAL && primaryMetCount >= 3) {
          finalSignal = SignalType.SELL;
          finalConfidence = Math.max(finalConfidence, 35);
        }
      }
    }

    // ── STEP 8: Sideways + no strong evidence = neutralize ──
    if (metrics?.direction === 'sideways' || (!isUp && !isDown)) {
      const hasStrongSetup = detailedReasons.some((r: any) => r.check?.includes('BB Pullback') && r.status !== 'neutral');
      if (!hasStrongSetup && (finalSignal === SignalType.BUY || finalSignal === SignalType.SELL)) {
        finalConfidence = Math.min(finalConfidence, 35);
        finalSignal = SignalType.NEUTRAL;
      }
    }
    // ══════════════════════════════════════════════
    // END LOCKED SIGNAL ENGINE RULES (v6)
    // ══════════════════════════════════════════════

    // ALWAYS calculate SL/TP from ATR/price data — AI values are unreliable
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
