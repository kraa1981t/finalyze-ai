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

// Deterministic Trend Calculation
function calculateTrendMaturity(closes: number[]): { maturity: 'infancy' | 'youth' | 'aging', age: number, direction: 'up' | 'down' | 'flat' } {
  if (closes.length < 20) return { maturity: 'infancy', age: 1, direction: 'flat' };
  
  const lastPrice = closes[closes.length - 1];
  // Simple Moving Average (20)
  const sma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const direction = lastPrice > sma20 ? 'up' : 'down';
  
  let age = 0;
  for (let i = closes.length - 1; i >= 0; i--) {
    const p = closes[i];
    const s = closes.slice(Math.max(0, i - 19), i + 1).reduce((a, b) => a + b, 0) / (Math.min(i + 1, 20));
    const d = p > s ? 'up' : 'down';
    if (d === direction) {
      age++;
    } else {
      break;
    }
  }

  let maturity: 'infancy' | 'youth' | 'aging' = 'youth';
  if (age <= 5) maturity = 'infancy';
  else if (age >= 16) maturity = 'aging';

  return { maturity, age, direction };
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
    
    // Extract closes for deterministic calculation
    const mainTFData = fetchedData.find(d => d.includes(`(${timeframe} - Last 50 Candles)`)) || "";
    const closeMatch = mainTFData.match(/Close: \[([\d\.,\s]+)\]/);
    const closeArray = closeMatch ? closeMatch[1].split(',').map(Number) : [];
    
    const trendInfo = calculateTrendMaturity(closeArray);
    
    const marketDataContext = `
      ${fetchedData.join('\n')}
      === DETERMINISTIC TREND ANALYSIS (FACTS) ===
      Calculated Trend Direction: ${trendInfo.direction.toUpperCase()}
      Calculated Trend Age: ${trendInfo.age} candles
      Current Stage: ${trendInfo.maturity.toUpperCase()}
      Note: These facts are NON-NEGOTIABLE. Use them for your analysis.
    `;

    const technicalPrompt = `
      Perform a professional financial analysis for: ${symbol}
      Primary Timeframe: ${timeframe}
      Stage: ${trendInfo.maturity} (${trendInfo.age} candles)

      ${marketDataContext}

      **MANDATORY SIGNAL TRUTH TABLE**:
      1. If Stage is INFANCY or AGING: You MUST return "no_entry".
      2. If Stage is YOUTH (6-10 candles): Suggest "strong_buy" or "strong_sell" if technicals are perfect.
      3. If Stage is YOUTH (11-15 candles): Suggest only "buy" or "sell".
      
      Return ONLY a VALID JSON object:
      {
        "symbol": "${symbol}",
        "signal": "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell" | "no_entry",
        "confidence": number,
        "summary": "Report in ${lang === 'ar' ? 'Arabic' : 'English'}...",
        "technicalScore": number,
        "sentimentScore": number,
        "historicalMatch": "Pattern in ${lang === 'ar' ? 'Arabic' : 'English'}..."
      }
    `;

    let resultData: any = null;
    const response = await fetch('/api/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: technicalPrompt,
        temperature: 0 // ABSOLUTE STABILITY
      })
    });

    if (response.ok) {
      const data = await response.json();
      const rawText = data.choices[0]?.message?.content;
      resultData = JSON.parse(rawText);
    }

    if (!resultData) throw new Error("AI Analysis failed.");

    // Final Logic Enforcement (Safety Gate)
    let finalSignal = (resultData.signal || "neutral").toLowerCase();
    if (trendInfo.maturity === 'infancy' || trendInfo.maturity === 'aging') {
      finalSignal = "no_entry";
    }

    return {
      symbol: resultData.symbol || symbol,
      type,
      timeframe,
      signal: finalSignal as SignalType,
      confidence: resultData.confidence || 50,
      summary: resultData.summary || "فشل التحليل.",
      technicalScore: resultData.technicalScore || 50,
      sentimentScore: resultData.sentimentScore || 50,
      trendMaturity: trendInfo.maturity,
      trendAge: trendInfo.age,
      historicalMatch: resultData.historicalMatch || "",
      timestamp: new Date().toISOString(),
      userId: "", 
    };
  } catch (error: any) {
    console.error("[AI Error]:", error);
    throw new Error(error.message || "فشل تحليل الذكاء الاصطناعي.");
  }
}
