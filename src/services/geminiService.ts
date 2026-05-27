import { MarketType, AnalysisResult, TradingStyle, SignalType, StrategySettings } from "../types";
import { DEFAULT_STRATEGY_SETTINGS } from "../constants";
import { fetchMarketContext } from "./marketContextService";
import { onRateLimited } from "./rateLimitTracker";

/**
 * ROBUST TECHNICAL ENGINE (VERSION 2.0)
 * Works with minimal data (10+ candles) and handles gaps gracefully.
 */
function calculateTechnicalMetrics(closes: number[], highs: number[], lows: number[], volumes?: number[]) {
  if (!closes || closes.length < 10) return null;

  const len = closes.length;
  
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

  return { direction, age, totalAge, rsi, emaCross, volSurge, momentumScore: upScore / (upScore + downScore) * 100 };
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
    const rawData = await fetch(`/api/market-data?symbol=${symbol}&timeframe=${timeframe}`).then(r => r.json());
    const quotes = rawData.chart?.result?.[0]?.indicators?.quote?.[0];
    
    if (!quotes || !quotes.close) {
      throw new Error("Market data currently unavailable from the source.");
    }

    const closes = quotes.close.filter((c: any) => c != null);
    const highs = quotes.high.filter((c: any) => c != null);
    const lows = quotes.low.filter((c: any) => c != null);
    const volumes = quotes.volume?.filter((v: any) => v != null);

    if (closes.length < 10) {
      throw new Error(`Insufficient data for ${symbol}.`);
    }

    const metrics = calculateTechnicalMetrics(closes, highs, lows, volumes);

    const macro2 = TF_PROGRESSION[Math.min(currentIndex + 2, TF_PROGRESSION.length - 1)];
    const microTF = currentIndex > 0 ? TF_PROGRESSION[currentIndex - 1] : TF_PROGRESSION[0];
    
    // Fetch Lower Timeframe (Micro) Data for Wave Confirmation
    let microCloses: number[] = [];
    let microMetrics = null;
    try {
      const microData = await fetch(`/api/market-data?symbol=${symbol}&timeframe=${microTF}`).then(r => r.json());
      const microQuotes = microData.chart?.result?.[0]?.indicators?.quote?.[0];
      if (microQuotes && microQuotes.close) {
        microCloses = microQuotes.close.filter((c: any) => c != null);
        if (microCloses.length >= 10) {
          microMetrics = calculateTechnicalMetrics(microCloses, [], [], []);
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

    const technicalPrompt = `You are an Elite Institutional Trader (ICT/SMC). Analyze ${symbol} (${type}, ${timeframe}, ${tradingStyle}) and return a JSON trading decision.

MARKET DATA: RSI ${metrics?.rsi?.toFixed(1)}, Trend ${metrics?.direction}, EMA Cross ${metrics?.emaCross}, Vol Surge ${metrics?.volSurge}, Trend Length ${metrics?.totalAge}c, Momentum ${metrics?.age}c.

MICRO (${microTF}): RSI ${microMetrics?.rsi ? microMetrics.rsi.toFixed(1) : 'N/A'}, Trend ${microMetrics?.direction || 'sideways'}, EMA ${microMetrics?.emaCross || 'unknown'}.

CONTEXT: Fear&Greed ${contextFearGreed?.value ?? 'N/A'}/100 (${contextFearGreed?.classification ?? 'Unknown'}). News: ${newsText.substring(0, 200)}. Events: ${eventsText.substring(0, 200)}.

SETTINGS: NewsGuard ${settings.useNewsGuard ? 'ON' : 'OFF'}, Volume ${settings.useVolumeAnalysis ? 'ON' : 'OFF'}, HigherTF ${settings.useHigherTimeframe ? 'ON' : 'OFF'}, Indicators ${settings.useIndicators ? 'ON' : 'OFF'}.

RULES:
- ONLY "strong_buy"/"strong_sell" if micro (${microTF}) is ALIGNED with macro. If micro is in pullback → downgrade to "buy"/"sell".
- INFANCY (1-5): moderate risk. YOUTH (6-25): optimal. AGING (>25): exhaustion risk.
- Fear&Greed: Extreme Fear (0-25)=contrarian, Greed (55-75)=trend follow, Extreme Greed (75-100)=cap confidence at 75.
- If HIGH impact economic event within 24h, warn in summary and reduce confidence -10% if NewsGuard is ON.
- Write summary and microTrend in ${lang === 'ar' ? 'ARABIC' : 'ENGLISH'}. Professional financial tone.

Return ONLY valid JSON:
{
  "signal": "strong_buy"|"buy"|"neutral"|"sell"|"strong_sell"|"no_entry",
  "confidence": number (0-100),
  "summary": "string",
  "technicalScore": number,
  "sentimentScore": number,
  "historicalMatch": "string",
  "microSignal": "pullback"|"aligned"|"unknown",
  "microTrend": "string"
}`;

    let aiResponse: any;
    let lastError: string | null = null;

    // Load key from localStorage
    const keyValue = localStorage.getItem('finalyze_key1_value') || localStorage.getItem('finalyze_user_groq_api_key') || '';
    if (!keyValue) throw new Error(lang === 'ar' ? 'لا يوجد مفتاح API.' : 'No API key found.');

    // Single request — server tries all providers internally (Groq→DeepSeek→Google→OpenAI)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    aiResponse = await fetch('/api/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: technicalPrompt, userApiKey: keyValue, provider: 'groq' }),
      signal: controller.signal
    }).then(r => r.json()).catch(e => ({ error: e.name === 'AbortError' ? 'Request timed out' : e.message }));
    clearTimeout(timeoutId);

    if (!aiResponse?.error && aiResponse?.choices?.[0]?.message?.content) {
      lastError = null;
    } else {
      lastError = aiResponse?.error || 'All providers failed';
      if (/429|rate.?limit|too many requests/i.test(lastError)) onRateLimited();
    }

    if (lastError) {
      throw new Error(lastError);
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

    // Zone 1: Too young — confidence cap
    if (totalAge < infantLimit) {
      if (finalConfidence > 65) finalConfidence = 65;
    }
    // Zone 2: Infant — downgrade strong signals to normal
    else if (totalAge < matureLimit) {
      if (finalSignal === SignalType.STRONG_BUY) finalSignal = SignalType.BUY;
      else if (finalSignal === SignalType.STRONG_SELL) finalSignal = SignalType.SELL;
      if (finalConfidence > 70) finalConfidence = 70;
    }
    // Zone 3: Mature — full strength allowed (no modification)
    else if (totalAge <= oldLimit) {
      // Strong signals pass through at full confidence
    }
    // Zone 4: Old/Exhaustion — confidence cap
    else {
      if (finalConfidence > 65) finalConfidence = 65;
    }

    // Also cap confidence if consecutive momentum (age) is too short
    if (age < minAge && finalConfidence > 65) {
      finalConfidence = 65;
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

    return {
      symbol, type, timeframe,
      signal: finalSignal,
      confidence: finalConfidence,
      summary: resultData.summary,
      technicalScore: metrics?.momentumScore || 50,
      sentimentScore: contextFearGreed?.value ?? 50,
      trendMaturity: totalAge < infantAgeThreshold ? 'infancy' : (totalAge < matureAgeThreshold ? 'youth' : (totalAge <= oldAgeThreshold ? 'mature' : 'aging')),
      trendAge: totalAge,
      microTF,
      microSignal: resultData.microSignal || 'unknown',
      microTrend: resultData.microTrend || "",
      historicalMatch: resultData.historicalMatch || "",
      timestamp: new Date().toISOString(),
      userId: ""
    };

  } catch (error: any) {
    console.error("[Engine Error]:", error);
    throw new Error(error.message || "Stability logic error.");
  }
}
