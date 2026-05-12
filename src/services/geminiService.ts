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

// Deterministic Trend Calculation (Dual EMA Crossover Logic)
function calculateTrendMaturity(closes: number[]): { maturity: 'infancy' | 'youth' | 'aging', age: number, direction: 'up' | 'down' | 'flat', reason?: string } {
  if (closes.length < 25) return { maturity: 'infancy', age: 1, direction: 'flat', reason: 'بيانات غير كافية لحساب الاتجاه' };
  
  // Calculate EMA 9 and EMA 21
  const ema = (data: number[], period: number) => {
    const k = 2 / (period + 1);
    let val = data[0];
    for (let i = 1; i < data.length; i++) val = data[i] * k + val * (1 - k);
    return val;
  };

  const getEMAAt = (data: number[], period: number, index: number) => {
    const k = 2 / (period + 1);
    let val = data[0];
    const subset = data.slice(0, index + 1);
    for (let i = 1; i < subset.length; i++) val = subset[i] * k + val * (1 - k);
    return val;
  };

  const currentEMA9 = ema(closes, 9);
  const currentEMA21 = ema(closes, 21);
  const direction = currentEMA9 > currentEMA21 ? 'up' : 'down';
  
  let age = 0;
  for (let i = closes.length - 1; i >= 0; i--) {
    const e9 = getEMAAt(closes, 9, i);
    const e21 = getEMAAt(closes, 21, i);
    const d = e9 > e21 ? 'up' : 'down';
    if (d === direction) {
      age++;
    } else {
      break;
    }
  }

  let maturity: 'infancy' | 'youth' | 'aging' = 'youth';
  let reason = '';

  if (age <= 3) {
    maturity = 'infancy';
    reason = 'الاتجاه لا يزال في بدايته (مرحلة طفولة) - خطر الدخول الكاذب.';
  } else if (age >= 30) {
    maturity = 'aging';
    reason = 'الاتجاه استُنزف تماماً (مرحلة شيخوخة) - خطر الانعكاس الوشيك.';
  }

  return { maturity, age, direction, reason };
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
    const microTF = currentIndex !== -1 ? TF_PROGRESSION[Math.max(currentIndex - 1, 0)] : '15m';
    const macro1 = currentIndex !== -1 ? TF_PROGRESSION[Math.min(currentIndex + 1, TF_PROGRESSION.length - 1)] : '4h';
    
    const timeframesToFetch = Array.from(new Set([microTF, timeframe, macro1]));
    const fetchedData = await Promise.all(timeframesToFetch.map(tf => fetchTimeframeData(symbol, tf)));
    
    // Extract closes
    const mainTFContent = fetchedData.find(d => d.includes(`(${timeframe} - Last 50 Candles)`)) || "";
    const closeMatch = mainTFContent.match(/Close: \[([\d\.,\s]+)\]/);
    const closeArray = closeMatch ? closeMatch[1].split(',').map(Number) : [];
    
    const trend = calculateTrendMaturity(closeArray);
    
    const technicalPrompt = `
      Deep Financial Analysis for: ${symbol}
      Market Fact: Trend is ${trend.direction.toUpperCase()}, Age ${trend.age} candles, Stage ${trend.maturity.toUpperCase()}.
      
      ${fetchedData.join('\n')}

      **STRICT CONSTITUTION**:
      1. INFANCY (1-3 candles): Return "no_entry". Reason: Early trend.
      2. AGING (30+ candles): Return "no_entry". Reason: Exhausted trend.
      3. PEAK YOUTH (4-15 candles): "strong_buy/sell" allowed if technicals and ${macro1} alignment are 90%+.
      4. MATURE YOUTH (16-29 candles): Only "buy/sell" allowed. No strong signals.
      
      Return JSON:
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

    const response = await fetch('/api/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: technicalPrompt, temperature: 0.05 })
    });

    const resultData = response.ok ? await response.json().then(d => JSON.parse(d.choices[0].message.content)) : null;
    if (!resultData) throw new Error("AI Engine offline.");

    let finalSignal = resultData.signal.toLowerCase();
    let finalSummary = resultData.summary;

    if (trend.maturity === 'infancy' || trend.maturity === 'aging') {
      finalSignal = "no_entry";
      finalSummary = lang === 'ar' ? trend.reason : `Trend is in ${trend.maturity} stage. Safe entry is not available.`;
    }

    return {
      symbol: resultData.symbol || symbol,
      type, timeframe,
      signal: finalSignal as SignalType,
      confidence: resultData.confidence || 50,
      summary: finalSummary,
      technicalScore: resultData.technicalScore || 50,
      sentimentScore: resultData.sentimentScore || 50,
      trendMaturity: trend.maturity,
      trendAge: trend.age,
      historicalMatch: resultData.historicalMatch || "",
      timestamp: new Date().toISOString(),
      userId: "", 
    };
  } catch (error: any) {
    throw new Error(error.message || "Analysis failed.");
  }
}
