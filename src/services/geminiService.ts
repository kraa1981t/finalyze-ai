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

      **STRICT TECHNICAL MANDATES (MANDATORY CONDITIONS)**:
      1. DATA VERIFICATION: Look at the provided prices for ${timeframe}. Identify the color of the last 5 candles.
      2. CONSECUTIVE CANDLES: The user requires exactly "${settings.consecutiveCandles}" consecutive candles of the same color leading into the current state.
         - If you do not see ${settings.consecutiveCandles} consecutive candles of the same color, you CANNOT return "strong_buy" or "strong_sell".
      3. MANDATORY CANDLE MOMENTUM (HARD BLOCKER): Evaluate the body size (Open vs Close) of the current or most recent closed candle on ${timeframe}.
         - The body must be visibly strong and show clear momentum relative to the average size of the previous 10 candles.
         - If the body size is small, weak, or shows indecision (like a Doji), you MUST return "no_entry" or "neutral" immediately. No trade is allowed without strong momentum.
      4. SIMPLIFIED TIMEFRAME ALIGNMENT: 
         - Compare the trend of ${timeframe} with the NEXT higher timeframe (${macro1}).
         - If ${timeframe} is Bullish but ${macro1} is Bearish (or vice versa), you MUST return "no_entry". They must both match direction.
      5. PIVOT POINTS: Use levels (PP, R1, S1) only for finding the entry price after rules 2, 3, and 4 are confirmed.
      6. SECONDARY FACTORS: News and Sentiment can only be used to boost an already perfect technical setup. They cannot override any technical failure.

      **FINAL SIGNAL LOGIC**:
      - "strong_buy"/"strong_sell": Rules 2, 3, and 4 are perfectly satisfied. Confidence >= 85%.
      - "buy"/"sell": Rules 3 and 4 are satisfied, but Rule 2 is slightly weaker. Confidence ${settings.minConfidence}% - 84%.
      - "no_entry"/"neutral": Any failure of Rule 3 (Mandatory Size), any conflict in Rule 4 (Alignment), or low confidence.

      Return ONLY a VALID JSON object:
      {
        "symbol": "${symbol}",
        "signal": "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell" | "no_entry",
        "confidence": number,
        "summary": "Report explaining how mandatory candle size (${settings.minCandleSizePx}) and alignment with ${macro1} were verified...",
        "technicalScore": number,
        "sentimentScore": number,
        "trendMaturity": "infancy" | "youth" | "aging",
        "trendAge": number,
        "historicalMatch": "Pattern description"
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
