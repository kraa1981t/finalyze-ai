import { MarketType, AnalysisResult, TradingStyle, SignalType, StrategySettings } from "../types";
import { DEFAULT_STRATEGY_SETTINGS } from "../constants";
import { GoogleGenAI } from "@google/genai";

let apiKeys: string[] = [];
let currentKeyIndex: number = 0;

function initializeKeys() {
  if (apiKeys.length > 0) return;
  const keysStr = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEYS) || process.env.VITE_GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  apiKeys = keysStr.split(',').map(k => k.trim()).filter(k => k.length > 0);
  console.log(`[AI Client] Loaded ${apiKeys.length} keys for rotation.`);
  if (apiKeys.length === 0) {
    const errorMsg = "تنبيه: مفاتيح Gemini API غير متوفرة. يرجى التأكد من إعداد VITE_GEMINI_API_KEYS في بيئة التطبيق (ملف .env).";
    alert(errorMsg);
    throw new Error(errorMsg);
  }
}

function getNextAiClient(): GoogleGenAI {
  initializeKeys();
  const key = apiKeys[currentKeyIndex];
  // Round-robin: move to next key for the next request
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return new GoogleGenAI({ apiKey: key });
}

function rotateKey() {
  if (apiKeys.length <= 1) return;
  const oldKey = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  console.warn(`[Key Rotation] Key ending in ...${oldKey.slice(-4)} exhausted. Switched to key ending in ...${apiKeys[currentKeyIndex].slice(-4)}`);
}

async function fetchTimeframeData(symbol: string, timeframe: string): Promise<string> {
  try {
    const response = await fetch(`/api/market-data?symbol=${symbol}&timeframe=${timeframe}`);
    if (response.ok) {
      const data = await response.json();
      const quotes = data.chart?.result?.[0]?.indicators?.quote?.[0];
      if (quotes && quotes.close && quotes.close.length > 0) {
         const closes = quotes.close.slice(-50).map((n: number) => n?.toFixed(4)).join(", ");
         const opens = quotes.open.slice(-50).map((n: number) => n?.toFixed(4)).join(", ");
         const highs = quotes.high.slice(-50).map((n: number) => n?.toFixed(4)).join(", ");
         const lows = quotes.low.slice(-50).map((n: number) => n?.toFixed(4)).join(", ");
         
         return `
      === LIVE MARKET DATA (${timeframe} - Last 50 Candles) ===
      Open:  [${opens}]
      High:  [${highs}]
      Low:   [${lows}]
      Close: [${closes}]`;
      }
    }
  } catch (e) {
    console.warn(`Could not fetch live market data for ${timeframe}`, e);
  }
  return `\n      === LIVE MARKET DATA (${timeframe}) ===\n      Data unavailable.`;
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
    console.log(`[AI Client] Performing deep multi-timeframe analysis for ${symbol}...`);
    
    // Determine micro and macro timeframes for rigorous validation
    const TF_PROGRESSION = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M', '1Y'];
    const currentIndex = TF_PROGRESSION.indexOf(timeframe);
    
    let microTF = '1h';
    let macro1 = '1d';
    let macro2 = '1w';
    
    if (currentIndex !== -1) {
       microTF = TF_PROGRESSION[Math.max(currentIndex - 1, 0)];
       macro1 = TF_PROGRESSION[Math.min(currentIndex + 1, TF_PROGRESSION.length - 1)];
       macro2 = TF_PROGRESSION[Math.min(currentIndex + 2, TF_PROGRESSION.length - 1)];
    }
    
    // Fetch all required timeframes concurrently
    const timeframesToFetch = Array.from(new Set([microTF, timeframe, macro1, macro2]));
    const dataPromises = timeframesToFetch.map(tf => fetchTimeframeData(symbol, tf));
    const fetchedData = await Promise.all(dataPromises);
    
    const marketDataContext = `
      ${fetchedData.join('\n')}
      
      Note: You MUST use these exact prices to calculate candle sizes and mathematically verify the momentum rules.
    `;

    const technicalPrompt = `
      Perform a professional financial analysis for: ${symbol}
      Market Type: ${type}
      Primary Timeframe: ${timeframe}
      Trading Strategy Style: ${tradingStyle}

      ${marketDataContext}

      **DYNAMIC ANALYSIS RULES (TOP-DOWN STRATEGY)**:
      1. Analyze the trend based ONLY on the provided live market data for the multiple timeframes. Do not guess or hallucinate data.
      2. CONSECUTIVE CANDLES & DIRECTION: The user requested "${settings.consecutiveCandles}" consecutive candle(s). This means the CURRENT candle AND the preceding ${settings.consecutiveCandles} candle(s) on the Primary Timeframe (${timeframe}) MUST be the EXACT SAME COLOR (same direction). If they alternate colors, severely reduce confidence.
      3. CANDLE SIZE CONDITION: The current candle on the Primary Timeframe (${timeframe}) AND the current candle on the Next Higher Timeframe (${macro1}) MUST BOTH be large/strong candles (visually representing >= ${settings.minCandleSizePx}px). If either is weak or a doji, reduce confidence.
      4. MOMENTUM THRESHOLD: Calculate the momentum strength ONLY for the Primary Timeframe (${timeframe}) current candle. If its momentum >= ${settings.momentumThreshold}%, it strongly supports a trade entry.
      5. STRICT SUPPLY/DEMAND ALIGNMENT: Check the 50-candle history across the 3 synchronized timeframes (${timeframe}, ${macro1}, ${macro2}). If historical S/D zones align in the exact same direction with a strength >= ${settings.supplyDemandStrength}%, this heavily increases confidence. If any macro timeframe contradicts the primary timeframe's direction, severely reduce your confidence score.
      6. PIVOT POINTS (MICRO-TIMEFRAME ENTRY): Calculate standard Pivot Points (PP, R1, S1) using the provided data for the Micro Timeframe (${microTF}). For a Buy/Sell signal, the current price MUST be interacting with or very close to a key pivot level. If the price is floating in the middle of nowhere, reduce confidence.
      7. TREND MATURITY ASSESSMENT (AGE OF TREND): Analyze the lifecycle of the current trend on the Primary Timeframe (${timeframe}) using the 50-candle history.
         - INFANCY (مرحلة الطفولة): Trend has just started (e.g., 1-3 candles since a crossover or breakout). Risk: False signal. Avoid or proceed with extreme caution.
         - YOUTH (مرحلة الشباب): Trend is clearly established and has strong, increasing momentum. Price is moving healthily. THIS IS THE OPTIMAL ENTRY PHASE.
         - AGING (مرحلة الشيخوخة): Trend has been running for a long time (exhaustion), candles are getting smaller, or price is significantly overextended from the moving averages. If the trend is "Aging", severely reduce the confidence score.
      ${settings.useIndicators ? '8. Use RSI and Moving Averages for momentum confirmation and to detect exhaustion.' : '8. (Indicators are disabled, skip RSI/MA).'}
      9. LIVE NEWS & DISASTERS: Use your Google Search tool to check for breaking news, ongoing wars, economic collapses of major countries, or crises affecting ${symbol}. If a catastrophic event or highly volatile news is breaking RIGHT NOW, factor this heavily into the market state.
      10. SOCIAL SENTIMENT VOTE: Search social media sentiment (reactions of whales, big traders, and the public) regarding ${symbol}. Calculate a "Sentiment Vote Percentage" (0-100) reflecting the bullishness/bearishness of the crowd. Assign this percentage to the \`sentimentScore\` field.
      
      **CONFIDENCE & SIGNAL RULES**:
      Calculate a realistic final "confidence" percentage (0-100) based on how well the data met the technical conditions.
      - If technical trend is Bullish and confidence >= 80%, return "signal": "strong_buy".
      - If technical trend is Bullish and confidence between ${settings.minConfidence}% and 79%, return "signal": "buy".
      - If technical trend is Bearish and confidence >= 80%, return "signal": "strong_sell".
      - If technical trend is Bearish and confidence between ${settings.minConfidence}% and 79%, return "signal": "sell".
      - If confidence is BELOW ${settings.minConfidence}% (due to contradictions, weak momentum, or poor alignment), return "signal": "no_entry".

      **SENTIMENT OVERRIDE RULE**:
      - If the \`sentimentScore\` (Social Vote) is GREATER THAN OR EQUAL TO 60% in the EXACT SAME DIRECTION as the technical trend (e.g., Technical is Buy AND Sentiment is >= 60% Bullish), you MUST boost the final confidence to >= 80% and output a "strong_buy" or "strong_sell" signal. This confirms that the whales and public agree with the chart.
      - If the \`sentimentScore\` contradicts the technical trend strongly, lower your technical confidence significantly.

      **OUTPUT SPECIFICATIONS**:
      - Provide a detailed summary STRICTLY IN ${lang === 'ar' ? 'ARABIC' : lang === 'fr' ? 'FRENCH' : 'ENGLISH'}.
      - Ensure the "confidence" is a realistic percentage (0-100).
      - Maintain a professional financial tone.

      Return ONLY a VALID JSON object:
      {
        "symbol": "${symbol}",
        "signal": "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell" | "no_entry",
        "confidence": number,
        "summary": "Detailed report in the requested language...",
        "technicalScore": number,
        "sentimentScore": number,
        "trendMaturity": "infancy" | "youth" | "aging" | "unknown",
        "trendAge": number (estimated candles),
        "historicalMatch": "Pattern description"
      }
    `;

    console.log(`[AI Client] Calling Gemini API for ${symbol}...`);
    
    initializeKeys(); // Ensure keys are loaded to know the count
    let attempt = 0;
    const maxAttempts = Math.max(1, apiKeys.length);
    let lastError: any = null;
    let response: any = null;

    while (attempt < maxAttempts) {
      try {
        const ai = getNextAiClient();
        response = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: [{ role: "user", parts: [{ text: technicalPrompt }] }],
          config: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        });
        break; // Success! Exit the retry loop.
      } catch (err: any) {
        lastError = err;
        const errMsg = err.message || "";
        const isRetryable = err.status === 429 || err.status === 403 || err.status === 503 || 
                           errMsg.toLowerCase().includes("quota") || 
                           errMsg.toLowerCase().includes("exhausted") || 
                           errMsg.toLowerCase().includes("high demand") ||
                           errMsg.toLowerCase().includes("unavailable");
        
        if (isRetryable && attempt < maxAttempts + 3) {
          if (apiKeys.length > 1) rotateKey();
          attempt++;
          const waitTime = Math.min(attempt * 3000, 15000);
          console.warn(`[AI Retry] Attempt ${attempt} after error: ${errMsg}. Waiting ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          throw err;
        }
      }
    }

    if (!response) {
       const keyStatus = apiKeys.map(k => `...${k.slice(-4)}`).join(', ');
       throw new Error(`تم رفض الطلب من قبل الذكاء الاصطناعي (السبب: ${lastError?.message || 'غير معروف'}). تم تجربة ${apiKeys.length} مفاتيح.`);
    }

    const rawText = response.text;
    
    if (!rawText) {
      throw new Error("تلقى التطبيق استجابة فارغة من الذكاء الاصطناعي.");
    }
    
    let resultData;
    try {
      resultData = JSON.parse(rawText.replace(/```json/g, "").replace(/```/g, "").trim());
    } catch (parseError) {
      console.error("[AI JSON Parse Error]:", parseError, "Raw text:", rawText);
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          resultData = JSON.parse(jsonMatch[0]);
        } catch (innerError) {
          throw new Error("فشل في تحليل بيانات الذكاء الاصطناعي.");
        }
      } else {
        throw new Error("فشل في قراءة بيانات التحليل المستلمة.");
      }
    }
    
    let signal = (resultData.signal || "neutral").toLowerCase().replace(/\s+/g, '_');
    const validSignals = ["strong_buy", "buy", "neutral", "sell", "strong_sell", "no_entry"];
    
    if (!validSignals.includes(signal)) {
      if (signal.includes('strong') && signal.includes('buy')) signal = "strong_buy";
      else if (signal.includes('strong') && signal.includes('sell')) signal = "strong_sell";
      else if (signal.includes('buy')) signal = "buy";
      else if (signal.includes('sell')) signal = "sell";
      else signal = "neutral";
    }

    return {
      symbol: resultData.symbol || symbol,
      type,
      timeframe,
      signal: signal as SignalType,
      confidence: resultData.confidence || 50,
      summary: resultData.summary || "فشل التحليل.",
      technicalScore: resultData.technicalScore || 50,
      sentimentScore: resultData.sentimentScore || 50,
      trendMaturity: resultData.trendMaturity || 'unknown',
      trendAge: resultData.trendAge || 0,
      historicalMatch: resultData.historicalMatch || "",
      timestamp: new Date().toISOString(),
      userId: "", 
    };
  } catch (error: any) {
    console.error("[AI Error]:", error);
    throw new Error(error.message || "فشل تحليل الذكاء الاصطناعي.");
  }
}
