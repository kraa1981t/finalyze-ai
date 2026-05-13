import { MarketType, AnalysisResult, TradingStyle, SignalType, StrategySettings } from "../types";
import { DEFAULT_STRATEGY_SETTINGS } from "../constants";

/**
 * ROBUST TECHNICAL ENGINE (VERSION 2.0)
 * Works with minimal data (10+ candles) and handles gaps gracefully.
 */
function calculateTechnicalMetrics(closes: number[], highs: number[], lows: number[]) {
  // Hard minimum lowered to 10 to ensure it almost always works
  if (!closes || closes.length < 10) return { direction: 'sideways' as const, age: 0, momentumScore: 0 };

  const len = closes.length;
  let upScore = 0;
  let downScore = 0;
  
  // Dynamic window based on available data
  const window = Math.min(len - 1, 15); 
  
  for (let i = 0; i < window; i++) {
    const curr = len - 1 - i;
    const prev = curr - 1;
    if (closes[curr] > closes[prev]) upScore++; else downScore++;
    if (highs[curr] > highs[prev]) upScore++; else downScore++;
  }

  let direction: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
  const bias = Math.floor(window * 0.3); // 30% bias for trend detection
  if (upScore > downScore + bias) direction = 'uptrend';
  else if (downScore > upScore + bias) direction = 'downtrend';

  // Robust Age counting
  let age = 0;
  let pullbacks = 0;
  for (let i = 1; i < len; i++) {
    const curr = len - i;
    const isUp = closes[curr] > closes[curr - 1];
    if (direction === 'uptrend') {
      if (isUp) age++; else if (pullbacks < 2) pullbacks++; else break;
    } else if (direction === 'downtrend') {
      if (!isUp) age++; else if (pullbacks < 2) pullbacks++; else break;
    } else break;
  }

  // Momentum
  const mWindow = Math.min(len, 5);
  let rangeSum = 0;
  let bodySum = 0;
  for (let i = 1; i < mWindow; i++) {
    bodySum += Math.abs(closes[len-i] - closes[len-i-1]);
    rangeSum += (highs[len-i] - lows[len-i]) || 0.0001;
  }
  const momentumScore = rangeSum > 0 ? Math.min(100, (bodySum / rangeSum) * 100) : 50;

  return { direction, age, momentumScore };
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

    if (closes.length < 15) {
      throw new Error(`Insufficient data for ${symbol} (${closes.length} candles). Need at least 15.`);
    }

    const metrics = calculateTechnicalMetrics(closes, highs, lows);

    if (!metrics || metrics.direction === 'sideways') {
      return {
        symbol, type, timeframe, signal: SignalType.NO_ENTRY, confidence: 25,
        summary: lang === 'ar' ? "السوق في اتجاه عرضي ممل أو متذبذب جداً. لا توجد قوة دفع واضحة حالياً." : "Market is in sideways consolidation or extreme volatility. No clear momentum detected.",
        technicalScore: 20, sentimentScore: 20, trendMaturity: 'unknown', trendAge: 0,
        historicalMatch: "", timestamp: new Date().toISOString(), userId: ""
      };
    }

    // ══════════════════════════════════════════════
    // PHASE 2: AI REASONING
    // ══════════════════════════════════════════════
    const technicalPrompt = `
You are a master technical analyst.
FACTS: Symbol ${symbol}, ${metrics.direction.toUpperCase()}, Age ${metrics.age} candles, Momentum ${metrics.momentumScore.toFixed(1)}%.
Rules: Age 1-5 is infancy (no_entry), 6-25 is tradeable (Youth), 26+ is aging (no_entry).
Evaluate SMC zones and return a professional decision.

Return ONLY JSON:
{
  "signal": "strong_buy" | "buy" | "no_entry" | "sell" | "strong_sell",
  "confidence": number,
  "summary": "Detailed analysis in ${lang === 'ar' ? 'Arabic' : 'English'}",
  "historicalMatch": "Pattern description"
}
`;

    const aiResponse = await fetch('/api/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: technicalPrompt })
    }).then(r => r.json());

    const rawText = aiResponse.choices[0]?.message?.content;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI Synthesis Error");
    const resultData = JSON.parse(jsonMatch[0]);

    // ══════════════════════════════════════════════
    // PHASE 3: FINAL ENFORCEMENT
    // ══════════════════════════════════════════════
    let finalSignal = resultData.signal as SignalType;
    let finalConfidence = resultData.confidence || 50;

    // Force age boundaries
    if (metrics.age <= 5 || metrics.age >= 26) {
      finalSignal = SignalType.NO_ENTRY;
      finalConfidence = Math.min(finalConfidence, 35);
    }

    // Trend alignment check
    if (metrics.direction === 'uptrend' && (finalSignal === SignalType.SELL || finalSignal === SignalType.STRONG_SELL)) {
       finalSignal = SignalType.NO_ENTRY;
       finalConfidence = 40;
    }
    if (metrics.direction === 'downtrend' && (finalSignal === SignalType.BUY || finalSignal === SignalType.STRONG_BUY)) {
       finalSignal = SignalType.NO_ENTRY;
       finalConfidence = 40;
    }

    return {
      symbol, type, timeframe,
      signal: finalSignal,
      confidence: finalConfidence,
      summary: resultData.summary,
      technicalScore: metrics.momentumScore,
      sentimentScore: finalConfidence,
      trendMaturity: metrics.age <= 5 ? 'infancy' : (metrics.age <= 25 ? 'youth' : 'aging'),
      trendAge: metrics.age,
      historicalMatch: resultData.historicalMatch || "",
      timestamp: new Date().toISOString(),
      userId: ""
    };

  } catch (error: any) {
    console.error("[Engine Error]:", error);
    throw new Error(error.message || "Stability logic error.");
  }
}
