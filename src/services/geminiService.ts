import { MarketType, AnalysisResult, TradingStyle, SignalType, StrategySettings } from "../types";
import { DEFAULT_STRATEGY_SETTINGS } from "../constants";

/**
 * ROBUST TECHNICAL ENGINE (VERSION 2.0)
 * Works with minimal data (10+ candles) and handles gaps gracefully.
 */
function calculateTechnicalMetrics(closes: number[], highs: number[], lows: number[], volumes?: number[]) {
  if (!closes || closes.length < 10) return null;

  const len = closes.length;
  
  // 1. RSI (14)
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < Math.min(len, 15); i++) {
    const diff = closes[len - i] - closes[len - i - 1];
    if (diff >= 0) avgGain += diff; else avgLoss -= diff;
  }
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  // 2. EMA Cross (9 vs 21)
  const ema9 = closes.slice(-9).reduce((a, b) => a + b, 0) / 9;
  const ema21 = closes.slice(-21).reduce((a, b) => a + b, 0) / 21;
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

  // 5. Volume Surge
  let volSurge = false;
  if (volumes && volumes.length > 5) {
    const lastVol = volumes[len - 1];
    const avgVol = volumes.slice(-6, -1).reduce((a, b) => a + b, 0) / 5;
    volSurge = lastVol > avgVol * 1.5;
  }

  return { direction, age, rsi, emaCross, volSurge, momentumScore: upScore / (upScore + downScore) * 100 };
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

    const macro2 = TF_PROGRESSION[Math.min(currentIndex + 2, TF_PROGRESSION.length - 1)];
    const microTF = currentIndex > 0 ? TF_PROGRESSION[currentIndex - 1] : TF_PROGRESSION[0];
      You are an Elite Institutional Trader and Quantitative Analyst (ICT/SMC Expert).
      Your task is to analyze the following asset and provide a definitive trading decision.

      **MARKET DATA**:
      - Symbol: ${symbol}
      - Market Type: ${type}
      - Primary Timeframe: ${timeframe}
      - Trading Style: ${tradingStyle}
      - Calculated RSI: ${metrics?.rsi?.toFixed(1)}
      - Current Trend: ${metrics?.direction}
      - EMA Cross (9/21): ${metrics?.emaCross}
      - Volume Surge: ${metrics?.volSurge ? 'Yes' : 'No'}
      - Trend Age (Candles): ${metrics?.age}

      **INSTITUTIONAL ANALYSIS INSTRUCTIONS**:
      1. MARKET STRUCTURE (SMC): Identify if there is a Break of Structure (BOS) or Change of Character (CHOCH) on the ${timeframe} timeframe.
      2. LIQUIDITY POOLS: Identify where retail stop-losses are resting (Buy Side/Sell Side Liquidity). Is the market currently sweeping liquidity or expanding away from it?
      3. FAIR VALUE GAPS (FVG) / IMBALANCES: Are there unfilled FVGs acting as magnets for price?
      4. ORDER BLOCKS (OB): Is the price mitigating a valid Institutional Order Block?
      5. STRICT ALIGNMENT: If any macro timeframe contradicts the primary direction, reduce confidence.
      6. TREND MATURITY: Analyze the lifecycle (age=${metrics?.age}).
         - INFANCY (1-5 candles): Just started. High risk of false breakout.
         - YOUTH (6-25 candles): Optimal entry.
         - AGING (>25 candles): Exhaustion risk.
      
      **CONFIDENCE & SIGNAL RULES**:
      Calculate a realistic final "confidence" percentage (0-100) based on how well the data met the conditions.
      - Bullish + Confidence >= 80%: "strong_buy"
      - Bullish + Confidence 50-79%: "buy"
      - Bearish + Confidence >= 80%: "strong_sell"
      - Bearish + Confidence 50-79%: "sell"
      - Below 50% or conflicting: "no_entry"

      **OUTPUT SPECIFICATIONS**:
      - Provide a detailed summary STRICTLY IN ${lang === 'ar' ? 'ARABIC' : lang === 'fr' ? 'FRENCH' : 'ENGLISH'}.
      - Maintain a professional financial tone.

      Return ONLY a VALID JSON object:
      {
        "signal": "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell" | "no_entry",
        "confidence": number,
        "summary": "Detailed report...",
        "technicalScore": number,
        "sentimentScore": number,
        "historicalMatch": "Pattern description"
      }
    `;

    const aiResponse = await fetch('/api/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: technicalPrompt })
    }).then(r => r.json());

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

    // RELAXED ENFORCEMENT for Crypto & Live conditions
    const age = metrics?.age || 0;
    const isCrypto = type === MarketType.CRYPTO;

    if (age < 2 || (isCrypto ? age > 60 : age > 35)) {
      if (finalConfidence > 70) finalConfidence = 65; // Soft downgrade instead of hard block
    }

    return {
      symbol, type, timeframe,
      signal: finalSignal,
      confidence: finalConfidence,
      summary: resultData.summary,
      technicalScore: metrics?.momentumScore || 50,
      sentimentScore: finalConfidence,
      trendMaturity: age <= 5 ? 'infancy' : (age <= 25 ? 'youth' : 'aging'),
      trendAge: age,
      historicalMatch: resultData.historicalMatch || "",
      timestamp: new Date().toISOString(),
      userId: ""
    };

  } catch (error: any) {
    console.error("[Engine Error]:", error);
    throw new Error(error.message || "Stability logic error.");
  }
}
