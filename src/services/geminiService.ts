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
      
      Note: You MUST use these exact prices to calculate candle sizes and verify momentum.
    `;

    const technicalPrompt = `
      Perform a professional financial analysis for: ${symbol}
      Market Type: ${type}
      Primary Timeframe: ${timeframe}
      Trading Strategy Style: ${tradingStyle}

      ${marketDataContext}

      **STRICT TECHNICAL MANDATES (NO EXCEPTIONS)**:
      1. DATA VERIFICATION: You MUST look at the provided "Close" prices for ${timeframe}. Identify the color of each of the last 5 candles (Green if Close > Open, Red if Close < Open).
      2. CONSECUTIVE CANDLES: The user requires exactly "${settings.consecutiveCandles}" consecutive candles of the same color leading into the current state.
         - If you do not see ${settings.consecutiveCandles} consecutive candles of the same color, you CANNOT return a "strong_buy" or "strong_sell".
         - If the colors are mixed (e.g., Green-Red-Green), the maximum signal is "buy" or "sell", and confidence MUST be below 70%.
      3. CANDLE BODY SIZE: Calculate the difference between Open and Close for the last 2 candles. If the body is less than ${settings.minCandleSizePx} units (pips/points), it is considered "Weak". You CANNOT give a "Strong" signal on weak candles.
      4. TIMEFRAME ALIGNMENT (THE LAW): 
         - Compare ${timeframe} with ${macro1} and ${macro2}.
         - If ${timeframe} is Bullish but ${macro1} or ${macro2} is Bearish, you MUST return "no_entry" or "neutral". Conflict between timeframes is a major risk.
      5. PIVOT POINTS: Pivot levels (PP, R1, S1) are for ENTRY confirmation only. They do not define the trend. Use them only to find the best price after the trend is confirmed by rules 2 and 4.
      6. NEWS & SENTIMENT: Sentiment (Social Vote) is SECONDARY. 
         - **NEW RULE**: Sentiment can only increase confidence if the technicals (Rules 1-4) are already perfect. 
         - Sentiment CANNOT turn a "no_entry" into a "buy".
         - Sentiment CANNOT turn a "neutral" into a "strong" signal.
      7. TREND MATURITY:
         - INFANCY: 1-2 candles of trend. Avoid.
         - YOUTH: 3-6 candles with strong bodies. Optimal.
         - AGING: >10 candles or decreasing body size. High risk of reversal.

      **FINAL SIGNAL OUTPUT LOGIC**:
      - "strong_buy"/"strong_sell": ALL rules (1, 2, 3, 4) must be met perfectly. Confidence >= 85%.
      - "buy"/"sell": Rules 1 and 4 are met, but Rule 2 or 3 is slightly weak. Confidence ${settings.minConfidence}% - 84%.
      - "no_entry"/"neutral": Any conflict between timeframes or less than ${settings.minConfidence}% confidence.

      Return ONLY a VALID JSON object:
      {
        "symbol": "${symbol}",
        "signal": "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell" | "no_entry",
        "confidence": number,
        "summary": "Detailed technical report explaining the candle math and alignment...",
        "technicalScore": number,
        "sentimentScore": number,
        "trendMaturity": "infancy" | "youth" | "aging" | "unknown",
        "trendAge": number,
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
