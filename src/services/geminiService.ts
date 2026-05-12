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
    console.log(`[Qwen AI] Deep analysis for ${symbol}...`);
    
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
    
    // Check if we actually got real data
    const hasRealData = fetchedData.some(d => !d.includes('Data unavailable'));
    const dataQualityNote = hasRealData 
      ? 'REAL LIVE DATA IS PROVIDED. Base your entire analysis on these exact numbers.'
      : 'WARNING: Live data unavailable. State this clearly and return no_entry.';
    
    const marketDataContext = `
      ${fetchedData.join('\n')}
      ${dataQualityNote}
    `;

    const technicalPrompt = `
You are a strict, rule-based quantitative trading system. You do NOT have opinions or hunches. 
You ONLY follow mathematical rules applied to the provided price data.

SYMBOL: ${symbol} | MARKET: ${type} | TIMEFRAME: ${timeframe} | STYLE: ${tradingStyle}

${marketDataContext}

══════════════════════════════════════════════
MANDATORY IRON-CLAD RULES — NO EXCEPTIONS EVER
══════════════════════════════════════════════

STEP 1 — TREND DIRECTION:
Look at the last 50 close prices provided. Determine:
a) Is price making Higher Highs + Higher Lows? → UPTREND
b) Is price making Lower Highs + Lower Lows? → DOWNTREND  
c) Neither clearly? → SIDEWAYS (must return no_entry)

STEP 2 — TREND AGE (Count exactly):
Count how many consecutive candles have maintained the current trend direction (continuous HH+HL or LH+LL chain).
This is your "trendAge" number.

STEP 3 — PHASE CLASSIFICATION (STRICT, CANNOT BE OVERRIDDEN):
- Phase "infancy":  trendAge 1 to 5 candles   → Signal MUST be "no_entry". No exceptions.
- Phase "youth":    trendAge 6 to 12 candles   → Signal MUST be "buy" or "sell". NEVER strong.
- Phase "prime":    trendAge 13 to 25 candles  → Signal MUST be "strong_buy" or "strong_sell". ONLY if momentum confirms.
- Phase "aging":    trendAge 26+ candles       → Signal MUST be "no_entry". No exceptions.

CRITICAL: If trendMaturity is "infancy" or "aging", the signal field MUST be "no_entry". Period.
CRITICAL: If trendMaturity is "youth", the signal MUST be "buy" or "sell" (NOT strong).
CRITICAL: If trendMaturity is "prime", and momentum is strong, signal is "strong_buy" or "strong_sell".

STEP 4 — CONFIDENCE CALCULATION (only for youth/prime phases):
Base score starts at 50. Add points for each condition met:
+15 if macro timeframe (${macro1}) trend aligns with primary trend.
+10 if price is bouncing from a clear Supply/Demand zone.
+10 if the last 3 candles are strong directional candles (bodies > 60% of total range).
+10 if no major conflicting news/geopolitical risk.
+5  if market sentiment aligns with direction.
Maximum possible: 100. Minimum for any trade signal: 55.
If total confidence < 55, return "no_entry" regardless of phase.

STEP 5 — TIMEFRAME ALIGNMENT (${macro1}):
If primary trend OPPOSES the macro timeframe trend, reduce confidence by 20 points.

STRONG SIGNAL THRESHOLD: ${settings.minStrongConfidence}% (for "prime" phase only)

══════════════════════════════════════════════
LANGUAGE RULE — ABSOLUTE
══════════════════════════════════════════════
Write "summary" and "historicalMatch" ENTIRELY in ${lang === 'ar' ? 'ARABIC (العربية)' : 'ENGLISH'}.
Mixing languages = system failure.

══════════════════════════════════════════════
OUTPUT FORMAT — RETURN ONLY THIS JSON OBJECT
══════════════════════════════════════════════
{
  "symbol": "${symbol}",
  "trendDirection": "uptrend" | "downtrend" | "sideways",
  "trendAge": <exact integer count of candles in current trend>,
  "trendMaturity": "infancy" | "youth" | "prime" | "aging",
  "signal": "strong_buy" | "buy" | "no_entry" | "sell" | "strong_sell",
  "confidence": <integer 0-100>,
  "technicalScore": <integer 0-100>,
  "sentimentScore": <integer 0-100>,
  "summary": "<analysis in ${lang === 'ar' ? 'Arabic' : 'English'} only>",
  "historicalMatch": "<historical pattern in ${lang === 'ar' ? 'Arabic' : 'English'} only>"
}
`;

    let attempt = 0;
    const maxRetries = 2;
    let lastError: any = null;
    let resultData: any = null;

    while (attempt <= maxRetries) {
      try {
        const response = await fetch('/api/ai-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: technicalPrompt })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Server Error: ${response.status}`);
        }

        const data = await response.json();
        const rawText = data.choices[0]?.message?.content;
        
        if (!rawText) throw new Error("Empty response from AI engine.");
        
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No valid JSON found in AI response.");
        
        resultData = JSON.parse(jsonMatch[0]);
        break;
      } catch (err: any) {
        lastError = err;
        attempt++;
        if (attempt <= maxRetries) {
          await new Promise(r => setTimeout(r, attempt * 1500));
        }
      }
    }

    if (!resultData) {
      throw new Error(`AI Analysis failed: ${lastError?.message}`);
    }
    
    // ══════════════════════════════════════════════
    // CODE-LEVEL JUDGE — ENFORCES PHASE RULES
    // This overrides any AI output that violates the phase rules
    // ══════════════════════════════════════════════
    const trendAge = resultData.trendAge || 0;
    const trendMaturity = resultData.trendMaturity || 'infancy';
    let signal = (resultData.signal || 'no_entry').toLowerCase().replace(/\s+/g, '_') as SignalType;
    let confidence = Math.min(100, Math.max(0, resultData.confidence || 0));

    // RULE 1: Infancy → FORCE no_entry
    if (trendMaturity === 'infancy' || trendAge <= 5) {
      signal = SignalType.NO_ENTRY;
      confidence = Math.min(confidence, 45);
    }
    // RULE 2: Aging → FORCE no_entry  
    else if (trendMaturity === 'aging' || trendAge >= 26) {
      signal = SignalType.NO_ENTRY;
      confidence = Math.min(confidence, 45);
    }
    // RULE 3: Youth → FORBID strong signals
    else if (trendMaturity === 'youth' || (trendAge >= 6 && trendAge <= 12)) {
      if (signal === SignalType.STRONG_BUY) signal = SignalType.BUY;
      if (signal === SignalType.STRONG_SELL) signal = SignalType.SELL;
    }
    // RULE 4: Prime → Only allow strong if confidence >= minStrongConfidence
    else if (trendMaturity === 'prime' || (trendAge >= 13 && trendAge <= 25)) {
      if (signal === SignalType.STRONG_BUY && confidence < settings.minStrongConfidence) signal = SignalType.BUY;
      if (signal === SignalType.STRONG_SELL && confidence < settings.minStrongConfidence) signal = SignalType.SELL;
    }

    // RULE 5: No_entry if confidence too low
    if (confidence < 55 && signal !== SignalType.NO_ENTRY) {
      signal = SignalType.NO_ENTRY;
    }

    // RULE 6: Sideways market → always no_entry
    if (resultData.trendDirection === 'sideways') {
      signal = SignalType.NO_ENTRY;
    }
    // Map 'prime' back to closest display value for UI
    const displayMaturity = trendMaturity === 'prime' ? 'youth' : trendMaturity;

    return {
      symbol: resultData.symbol || symbol,
      type,
      timeframe,
      signal,
      confidence,
      summary: resultData.summary || (lang === 'ar' ? 'البيانات غير متاحة' : 'Data unavailable'),
      technicalScore: resultData.technicalScore || 50,
      sentimentScore: resultData.sentimentScore || 50,
      trendMaturity: displayMaturity as any,
      trendAge,
      historicalMatch: resultData.historicalMatch || '',
      timestamp: new Date().toISOString(),
      userId: '',
    };
  } catch (error: any) {
    console.error("[AI Error]:", error);
    throw new Error(error.message || "AI analysis failed.");
  }
}
