import { MarketType, AnalysisResult, TradingStyle, SignalType, StrategySettings } from "../types";
import { DEFAULT_STRATEGY_SETTINGS } from "../constants";
import { fetchMarketContext } from "./marketContextService";
import { onRateLimited, waitIfRateLimited } from "./rateLimitTracker";

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

async function callGroqDirect(prompt: string, apiKey: string, signal: AbortSignal) {
  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: "system", content: "You are a professional financial analyst AI. Always respond in valid JSON format." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
      signal
    });
    if (resp.status === 429) return { error: 'rate_limited' };
    if (!resp.ok) return { error: `Groq: ${resp.status}` };
    return await resp.json();
  } catch (e: any) {
    return { error: e.name === 'AbortError' ? 'Request timed out' : e.message };
  }
}

async function callGoogleDirect(prompt: string, apiKey: string, signal: AbortSignal) {
  for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a financial analyst. ${prompt}` }] }],
          generationConfig: { temperature: 0.1 }
        }),
        signal
      });
      if (resp.status === 429) continue;
      if (resp.ok) {
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) return { choices: [{ message: { content: text } }] };
      }
    } catch {}
  }
  return { error: 'Google failed' };
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

    const technicalPrompt = `You are an Elite Institutional Trader (ICT/SMC). Analyze ${symbol} (${type}, ${timeframe}, ${tradingStyle}) and return a JSON trading decision with DETAILED step-by-step reasoning.

MARKET DATA: RSI ${metrics?.rsi?.toFixed(1)}, Trend ${metrics?.direction}, EMA Cross ${metrics?.emaCross}, Vol Surge ${metrics?.volSurge}, Trend Length ${metrics?.totalAge}c, Momentum ${metrics?.age}c.

MICRO (${microTF}): RSI ${microMetrics?.rsi ? microMetrics.rsi.toFixed(1) : 'N/A'}, Trend ${microMetrics?.direction || 'sideways'}, EMA ${microMetrics?.emaCross || 'unknown'}.

CONTEXT: Fear&Greed ${contextFearGreed?.value ?? 'N/A'}/100 (${contextFearGreed?.classification ?? 'Unknown'}). News: ${newsText.substring(0, 300)}. Events: ${eventsText.substring(0, 200)}.

SETTINGS: NewsGuard ${settings.useNewsGuard ? 'ON' : 'OFF'}, Volume ${settings.useVolumeAnalysis ? 'ON' : 'OFF'}, HigherTF ${settings.useHigherTimeframe ? 'ON' : 'OFF'}, Indicators ${settings.useIndicators ? 'ON' : 'OFF'}.

SUPPLY & DEMAND ZONES: ${zonesText}

RULES:
- ONLY "strong_buy"/"strong_sell" if micro (${microTF}) is ALIGNED with macro. If micro is in pullback → downgrade to "buy"/"sell".
- Trend age zones: <10 infancy (cap 65), <25 youth (downgrade strong, cap 70), 25-50 mature (full), >50 old (cap 65).
- Fear&Greed: Extreme Fear (0-25)=contrarian, Greed (55-75)=trend follow, Extreme Greed (75-100)=cap confidence at 75.
- If HIGH impact economic event within 24h, warn in summary and reduce confidence -10% if NewsGuard is ON.
- Write summary and each reason in ${lang === 'ar' ? 'ARABIC' : 'ENGLISH'}. Professional financial tone.
- In detailedReasons, list EVERY condition you checked and its outcome.

Return ONLY valid JSON:
{
  "signal": "strong_buy"|"buy"|"neutral"|"sell"|"strong_sell"|"no_entry",
  "confidence": number (0-100),
  "summary": "string — comprehensive Arabic/English paragraph covering ALL factors: RSI, EMA, trend, age zone, volume, micro alignment, Fear&Greed, news sources, economic events",
  "detailedReasons": [
    {"check": "RSI", "value": "62.5", "status": "neutral", "impact": "no change"},
    {"check": "EMA Cross", "value": "bullish", "status": "positive", "impact": "supports buy"},
    {"check": "Trend Direction", "value": "uptrend", "status": "positive", "impact": "supports buy"},
    {"check": "Trend Age Zone", "value": "mature (32 candles)", "status": "positive", "impact": "full confidence allowed"},
    {"check": "Volume Surge", "value": "true", "status": "positive", "impact": "confirms momentum"},
    {"check": "Supply/Demand Zone", "value": "demand 1.0850-1.0880 strength 72%", "status": "positive", "impact": "price near demand zone"},
    {"check": "Micro TF Alignment", "value": "aligned", "status": "positive", "impact": "strong signal allowed"},
    {"check": "Fear&Greed", "value": "45/100 Neutral", "status": "neutral", "impact": "no modification"},
    {"check": "News Sentiment", "value": "2 positive articles", "status": "positive", "source": "Reuters, CNBC", "impact": "supports confidence"},
    {"check": "Economic Events", "value": "no high impact events", "status": "neutral", "impact": "no penalty"}
  ],
  "technicalScore": number,
  "sentimentScore": number,
  "historicalMatch": "string",
  "microSignal": "pullback"|"aligned"|"unknown",
  "microTrend": "string"
}`;

    const keyValue = getApiKey();
    if (!keyValue) throw new Error(lang === 'ar' ? 'لا يوجد مفتاح API.' : 'No API key found.');
    mirrorApiKey(keyValue);

    await waitIfRateLimited();

    // Direct browser-to-API call (bypasses Vercel 10s server timeout)
    const isGoogle = keyValue.startsWith('AIzaSy');
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 15000);

    let aiResponse: any;
    if (isGoogle) {
      aiResponse = await callGoogleDirect(technicalPrompt, keyValue, ac.signal);
    } else {
      aiResponse = await callGroqDirect(technicalPrompt, keyValue, ac.signal);
    }
    clearTimeout(timeoutId);

    let lastError: string | null = null;
    if (aiResponse?.error) {
      lastError = aiResponse.error;
      if (/429|rate.?limit|too many requests/i.test(lastError)) onRateLimited();
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
      userId: ""
    };

  } catch (error: any) {
    console.error("[Engine Error]:", error);
    throw new Error(error.message || "Stability logic error.");
  }
}
