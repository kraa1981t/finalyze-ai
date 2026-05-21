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
    
    const technicalPrompt = `
      You are an Elite Institutional Trader and Quantitative Analyst (ICT/SMC Expert).
      Your task is to analyze the following asset and provide a definitive trading decision.

      **MARKET DATA**:
      - Symbol: ${symbol}
      - Market Type: ${type}
      - Primary Timeframe (Macro): ${timeframe}
      - Trading Style: ${tradingStyle}
      - Macro RSI: ${metrics?.rsi?.toFixed(1)}
      - Macro Trend Direction: ${metrics?.direction}
      - Macro EMA Cross (9/21): ${metrics?.emaCross}
      - Volume Surge: ${metrics?.volSurge ? 'Yes' : 'No'}
      - Trend Age (Candles): ${metrics?.age}

      **LOWER TIMEFRAME CONFIRMATION DATA (MICRO WAVE)**:
      - Micro Timeframe: ${microTF}
      - Micro Calculated RSI: ${microMetrics?.rsi ? microMetrics.rsi.toFixed(1) : 'N/A'}
      - Micro Trend Direction: ${microMetrics?.direction || 'sideways'}
      - Micro EMA Cross (9/21): ${microMetrics?.emaCross || 'unknown'}

      **USER STRATEGY SETTINGS**:
      - News & Volatility Guard: ${settings.useNewsGuard ? 'ENABLED' : 'DISABLED'}
      - Volume Confirmation: ${settings.useVolumeAnalysis ? 'ENABLED' : 'DISABLED'}
      - Higher Timeframe Trend Alignment: ${settings.useHigherTimeframe ? 'ENABLED' : 'DISABLED'}
      - Technical Indicator Alignment (EMA/RSI): ${settings.useIndicators ? 'ENABLED' : 'DISABLED'}

      **TOP-DOWN WAVE CONFIRMATION RULES (DIRECT ENTRY OPTIMIZATION)**:
      Your primary goal is to optimize entries to avoid initial drawdowns (e.g. buying at the peak of a bullish leg just as a local pullback starts).
      - Analyze if the lower timeframe (${microTF}) is currently in a "pullback" state or an "aligned" state relative to the Primary Timeframe (${timeframe}):
        * **PULLBACK State**: If the macro trend is "uptrend" but the micro trend (${microTF}) is "downtrend" or has a "bearish" EMA cross or RSI is falling, it means the price is currently correcting. The user should wait!
        * **ALIGNED State**: If the macro trend is "uptrend" and the micro trend (${microTF}) has completed its pullback and is turning bullish (e.g., micro trend is "uptrend" or EMA cross is "bullish" or RSI is rebounding from oversold), it means the pullback is completed. It is the PERFECT moment for direct Market Order entry!
      
      - **Enforce Signal Strictness**:
        * You should ONLY output a signal of "strong_buy" or "strong_sell" if the Micro Timeframe (${microTF}) is **fully ALIGNED** with the macro trend. This guarantees a safe direct Market Order entry for the user with minimal drawdown!
        * If the macro trend is strong but the Micro Timeframe is still actively in a **PULLBACK** state, you MUST downgrade the signal to "buy" (with lower confidence) or "neutral", and clearly flag in "microSignal" that it is a "pullback".

      **STRATEGY EVALUATION & SUPPORTIVE WEIGHTS**:
      1. **NEWS & VOLATILITY GUARD (Dynamic Support Factor)**:
         * If News Guard is ENABLED, evaluate if the recent candles show high volatility or price expansion (indicating high-impact news breakouts). 
         * If the price action is structured (e.g. an institutional news breakout that cleanly Breaks Structure - BOS), treat the news as **SUPPORTIVE momentum** and **ADD +5% to +10% to the confidence score** to reward the strong breakout.
         * Only if the volatility is chaotic, extremely messy, or spread is too high, treat it as dangerous and reduce the confidence score or issue "no_entry".
      2. **MARKET SENTIMENT CONSENSUS (تصويت الجمهور والمؤثرين)**:
         * Calculate a "sentimentScore" (0-100) representing the collective consensus of institutional influencers, retail followers, and financial market sentiment.
         * If the technical setup is highly bullish/bearish and this market consensus aligns with the setup, use it as a **SUPPORTIVE weight to boost the final confidence score**. High confluence between structure and sentiment is rewarded with a higher confidence rating!
      3. **VOLUME CONFIRMATION**: If Volume Confirmation is ENABLED, look for supportive volume. A breakout or strong reversal should ideally be backed by average or above-average volume.
      4. **MACRO ALIGNMENT**: If Higher Timeframe Alignment is ENABLED, ensure the trade aligns with the overall macro trend (e.g., higher timeframes are in a similar direction or consolidating support/resistance).
      5. **TECHNICAL INDICATORS**: If Indicator Alignment is ENABLED, verify that EMA cross (9/21) or RSI are supportive (e.g., not extremely overbought >75 for Buy, or oversold <25 for Sell).

      **INSTITUTIONAL ANALYSIS INSTRUCTIONS**:
      1. MARKET STRUCTURE (SMC): Identify if there is a Break of Structure (BOS) or Change of Character (CHOCH) on the ${timeframe} timeframe.
      2. LIQUIDITY POOLS: Identify where retail stop-losses are resting (Buy Side/Sell Side Liquidity). Is the market currently sweeping liquidity or expanding away from it?
      3. FAIR VALUE GAPS (FVG) / IMBALANCES: Are there unfilled FVGs acting as magnets for price?
      4. ORDER BLOCKS (OB): Is the price mitigating a valid Institutional Order Block?
      5. TREND MATURITY: Analyze the lifecycle (age=${metrics?.age}).
         - INFANCY (1-5 candles): Just started. Moderate risk of false breakout.
         - YOUTH (6-25 candles): Optimal entry window.
         - AGING (>25 candles): Exhaustion risk.
      
      **CONFIDENCE & SIGNAL RULES**:
      Calculate a realistic final "confidence" percentage (0-100) based on your analysis. Your goal is to find active setups:
      - Bullish + Confidence >= 80%: "strong_buy"
      - Bullish + Confidence 50-79%: "buy"
      - Bearish + Confidence >= 80%: "strong_sell"
      - Bearish + Confidence 50-79%: "sell"
      - Below 50% or conflicting: "no_entry"

      **CRITICAL LANGUAGE INSTRUCTION (ABSOLUTE REQUIREMENT)**:
      You MUST write the ENTIRE "summary" and "microTrend" fields strictly and exclusively in ${lang === 'ar' ? 'ARABIC (اللغة العربية)' : lang === 'fr' ? 'FRENCH (Français)' : 'ENGLISH'}. 
      Do NOT output these text fields in any other language. If the user interface is Arabic, your analysis MUST be in Arabic.
      - Maintain a professional financial tone.

      Return ONLY a VALID JSON object:
      {
        "signal": "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell" | "no_entry",
        "confidence": number,
        "summary": "Detailed report...",
        "technicalScore": number,
        "sentimentScore": number,
        "historicalMatch": "Pattern description",
        "microSignal": "pullback" | "aligned" | "unknown",
        "microTrend": "Brief structural wave status (e.g. 'M15 Pullback Completed - Ready for Direct Entry' in Arabic or English)"
      }
    `;

    const userApiKey = localStorage.getItem('finalyze_user_qwen_api_key') || '';
    const aiResponse = await fetch('/api/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: technicalPrompt, userApiKey })
    }).then(r => r.json());

    if (aiResponse?.error) {
      throw new Error(aiResponse.error);
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

    // RELAXED ENFORCEMENT for Crypto & Live conditions
    const age = metrics?.age || 0;
    const isCrypto = type === MarketType.CRYPTO;

    if (age < 2 || (isCrypto ? age > 60 : age > 35)) {
      if (finalConfidence > 70) finalConfidence = 65; // Soft downgrade instead of hard block
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
      sentimentScore: finalConfidence,
      trendMaturity: age <= 8 ? 'infancy' : (age <= 30 ? 'youth' : 'aging'),
      trendAge: age,
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
