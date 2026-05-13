
/**
 * HARDCODED TECHNICAL ENGINE
 * These functions perform pure mathematical analysis to ensure 100% stability.
 */
function calculateTechnicalMetrics(closes: number[], highs: number[], lows: number[]) {
  if (closes.length < 20) return null;

  // 1. Trend Direction (using Higher Highs/Lows logic)
  let upScore = 0;
  let downScore = 0;
  for (let i = 1; i < 15; i++) {
    const idx = closes.length - 1 - i;
    if (highs[idx + 1] > highs[idx]) upScore++;
    if (lows[idx + 1] > lows[idx]) upScore++;
    if (highs[idx + 1] < highs[idx]) downScore++;
    if (lows[idx + 1] < lows[idx]) downScore++;
  }

  let direction: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
  if (upScore > downScore + 5) direction = 'uptrend';
  else if (downScore > upScore + 5) direction = 'downtrend';

  // 2. Trend Age (Exact counting)
  let age = 0;
  for (let i = 0; i < closes.length - 1; i++) {
    const idx = closes.length - 1 - i;
    const isUp = closes[idx] > closes[idx - 1];
    if (direction === 'uptrend' && isUp) age++;
    else if (direction === 'downtrend' && !isUp) age++;
    else break;
  }

  // 3. Momentum (Body vs Wick ratio of last 3 candles)
  const last3 = closes.slice(-3);
  const last3Highs = highs.slice(-3);
  const last3Lows = lows.slice(-3);
  let totalMomentum = 0;
  for(let i=0; i<3; i++) {
    const body = Math.abs(closes[closes.length-1-i] - (i === 0 ? closes[closes.length-2] : closes[closes.length-1-i])); // simplified
    const range = last3Highs[i] - last3Lows[i] || 0.0001;
    totalMomentum += (body / range);
  }
  const momentumScore = Math.min(100, (totalMomentum / 3) * 100);

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
    
    if (!quotes || !quotes.close || quotes.close.length < 20) {
      throw new Error("Insufficient market data available for stable analysis.");
    }

    const closes = quotes.close.filter((c: any) => c != null);
    const highs = quotes.high.filter((c: any) => c != null);
    const lows = quotes.low.filter((c: any) => c != null);

    // ══════════════════════════════════════════════
    // PHASE 1: MATHEMATICAL VALIDATION (NO AI YET)
    // ══════════════════════════════════════════════
    const metrics = calculateTechnicalMetrics(closes, highs, lows);
    
    if (!metrics || metrics.direction === 'sideways') {
      return {
        symbol, type, timeframe, signal: SignalType.NO_ENTRY, confidence: 40,
        summary: lang === 'ar' ? "السوق في حالة تذبذب عرضي ولا توجد فرصة دخول آمنة حالياً." : "Market is in sideways consolidation. No safe entry detected.",
        technicalScore: 40, sentimentScore: 50, trendMaturity: 'unknown', trendAge: 0,
        historicalMatch: "", timestamp: new Date().toISOString(), userId: ""
      };
    }

    // ══════════════════════════════════════════════
    // PHASE 2: AI ANALYSIS (ONLY FOR CONTEXT & SMC)
    // ══════════════════════════════════════════════
    const technicalPrompt = `
You are a high-level market analyst. I have already calculated the technical facts. 
Your job is to synthesize them with SMC zones and Sentiment.

FACTS FOR ${symbol} (${timeframe}):
- TREND: ${metrics.direction.toUpperCase()}
- TREND AGE: ${metrics.age} candles
- MOMENTUM SCORE: ${metrics.momentumScore.toFixed(1)}%
- MACRO TF: ${macro1}

STRICT SIGNAL RULES:
1. If AGE is 1-5 (Infancy): Signal MUST be "no_entry".
2. If AGE is 6-12 (Youth): Signal can be "buy" or "sell". (Max confidence 82%).
3. If AGE is 13-25 (Prime): Signal can be "strong_buy" or "strong_sell" (If confidence >= ${settings.minStrongConfidence}%).
4. If AGE is 26+ (Aging): Signal MUST be "no_entry".

Based on these facts, evaluate SMC (Supply/Demand) and News. 
If the trend is ${metrics.direction} and age is good, should we enter?

Return ONLY JSON:
{
  "signal": "strong_buy" | "buy" | "no_entry" | "sell" | "strong_sell",
  "confidence": number,
  "smc_zone": "string",
  "summary": "string in ${lang === 'ar' ? 'Arabic' : 'English'}",
  "historicalMatch": "string"
}
`;

    const aiResponse = await fetch('/api/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: technicalPrompt })
    }).then(r => r.json());

    const rawText = aiResponse.choices[0]?.message?.content;
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI Protocol Error");
    const resultData = JSON.parse(jsonMatch[0]);

    // ══════════════════════════════════════════════
    // PHASE 3: FINAL ENFORCEMENT (THE JUDGE)
    // ══════════════════════════════════════════════
    let finalSignal = resultData.signal as SignalType;
    let finalConfidence = resultData.confidence || 50;

    // Hardcoded logic to prevent AI "flipping"
    if (metrics.direction === 'uptrend' && (finalSignal === SignalType.SELL || finalSignal === SignalType.STRONG_SELL)) {
       finalSignal = SignalType.NO_ENTRY; // AI tried to sell in a proven uptrend
    }
    if (metrics.direction === 'downtrend' && (finalSignal === SignalType.BUY || finalSignal === SignalType.STRONG_BUY)) {
       finalSignal = SignalType.NO_ENTRY; // AI tried to buy in a proven downtrend
    }

    // Force age rules again just in case AI ignored them
    if (metrics.age <= 5 || metrics.age >= 26) finalSignal = SignalType.NO_ENTRY;
    if (metrics.age >= 6 && metrics.age <= 12) {
      if (finalSignal === SignalType.STRONG_BUY) finalSignal = SignalType.BUY;
      if (finalSignal === SignalType.STRONG_SELL) finalSignal = SignalType.SELL;
    }

    return {
      symbol, type, timeframe,
      signal: finalSignal,
      confidence: finalConfidence,
      summary: resultData.summary,
      technicalScore: metrics.momentumScore,
      sentimentScore: finalConfidence,
      trendMaturity: metrics.age <= 5 ? 'infancy' : (metrics.age <= 12 ? 'youth' : (metrics.age <= 25 ? 'youth' : 'aging')),
      trendAge: metrics.age,
      historicalMatch: resultData.historicalMatch || resultData.smc_zone || "",
      timestamp: new Date().toISOString(),
      userId: ""
    };

  } catch (error: any) {
    console.error("[Iron Engine Error]:", error);
    throw new Error(error.message || "Analysis stabilization failure.");
  }
}
