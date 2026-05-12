import { MarketType, AnalysisResult, TradingStyle, SignalType, StrategySettings } from "../types";
import { DEFAULT_STRATEGY_SETTINGS } from "../constants";

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
    console.log(`[Qwen AI] Performing deep multi-timeframe analysis for ${symbol}...`);
    
    const TF_PROGRESSION = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M', '1Y'];
    const currentIndex = TF_PROGRESSION.indexOf(timeframe);
    
    let microTF = '1h';
    let macro1 = '1d';
    
    if (currentIndex !== -1) {
       microTF = TF_PROGRESSION[Math.max(currentIndex - 1, 0)];
       macro1 = TF_PROGRESSION[Math.min(currentIndex + 1, TF_PROGRESSION.length - 1)];
    }
    
    const timeframesToFetch = Array.from(new Set([microTF, timeframe, macro1]));
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

      **TECHNICAL ANALYSIS GUIDELINES**:
      1. MARKET TREND & MATURITY: 
         - Determine the current trend direction using the last 50 candles.
         - Calculate "Trend Age" (how many candles this specific trend has lasted). 
         - Classify "Trend Maturity": "infancy" (1-5 candles, newly forming), "youth" (6-15 candles, strong and safe to enter), "aging" (16+ candles, nearing exhaustion/reversal). We strongly prefer "youth" trends.
      2. MOMENTUM (CANDLE SIZE): Evaluate the size of the recent candles. Strong directional candles increase confidence.
      3. TIMEFRAME ALIGNMENT: 
         - Check the next higher timeframe (${macro1}) to see the broader trend.
         - If ${timeframe} aligns with ${macro1}, confidence is HIGH.
         - If they conflict, you can still suggest a trade, but lower the confidence score.
      4. SUPPLY & DEMAND ZONES (SMC): 
         - Identify strong structural Support/Resistance or Supply/Demand zones. 
         - If the price is reacting strongly off a fresh Supply/Demand zone, boost the confidence score significantly. Trading away from these zones is preferred.
      5. PRIMARY DIRECTIVE: Do your best to find a valid trading opportunity. Avoid returning "neutral" or "no_entry" unless the market is completely dead and flat (e.g., extremely low volatility, consecutive dojis).
      6. NEWS & GEOPOLITICS: 
         - Explicitly consider current global Economic/Political News, Wars, and Natural Disasters. 
         - If a major event is causing extreme volatility against the technical trend, lower the confidence or signal "neutral".
      7. SENTIMENT & VOTING: 
         - Consider the general market sentiment (Fear & Greed).
         - If sentiment aligns with your technical setup, boost the confidence score.

      **FINAL SIGNAL LOGIC**:
      - "strong_buy"/"strong_sell": Clear trend, strong momentum candles, and alignment with ${macro1}. Confidence ${settings.minStrongConfidence}-100%.
      - "buy"/"sell": Good setup, but maybe slight timeframe conflict or average momentum. Confidence 60-${settings.minStrongConfidence - 1}%.
      - "neutral"/"no_entry": ONLY use this if the market is completely flat, zero momentum, and unpredictable.

      **FINAL AND MOST IMPORTANT RULE REGARDING LANGUAGE**:
      The user's interface is currently in ${lang === 'ar' ? 'ARABIC' : 'ENGLISH'}. 
      You MUST write the "summary" and "historicalMatch" fields entirely in ${lang === 'ar' ? 'ARABIC (اللغة العربية)' : 'ENGLISH'}.
      If you output the wrong language, the system will crash. Do not mix languages.

      Return ONLY a VALID JSON object:
      {
        "symbol": "${symbol}",
        "signal": "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell" | "no_entry",
        "confidence": number,
        "summary": "${lang === 'ar' ? 'اكتب تقرير التحليل هنا باللغة العربية فقط...' : 'Write the analysis report here in English only...'}",
        "technicalScore": number,
        "sentimentScore": number,
        "trendMaturity": "infancy" | "youth" | "aging",
        "trendAge": number,
        "historicalMatch": "${lang === 'ar' ? 'اكتب النمط التاريخي هنا باللغة العربية...' : 'Write historical pattern here in English...'}"
      }
    `;

    let attempt = 0;
    const maxRetries = 3;
    let lastError: any = null;
    let resultData: any = null;

    while (attempt <= maxRetries) {
      try {
        const response = await fetch('/api/ai-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: technicalPrompt
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server Error: ${response.status}`);
        }

        const data = await response.json();
        const rawText = data.choices[0]?.message?.content;
        
        if (!rawText) throw new Error("Empty response from AI engine.");
        
        resultData = JSON.parse(rawText);
        break; // Success
      } catch (err: any) {
        lastError = err;
        attempt++;
        if (attempt <= maxRetries) {
          const waitTime = attempt * 2000;
          console.warn(`[AI Proxy Retry] Attempt ${attempt} failed: ${err.message}. Retrying in ${waitTime}ms...`);
          await new Promise(r => setTimeout(r, waitTime));
        }
      }
    }

    if (!resultData) {
      throw new Error(`AI Analysis failed after ${maxRetries} attempts: ${lastError?.message}`);
    }
    
    let signal = (resultData.signal || "neutral").toLowerCase().replace(/\s+/g, '_');
    
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
