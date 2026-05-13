
/**
 * REFINED TECHNICAL ENGINE
 * Balances strictness with market reality (allows minor pullbacks).
 */
function calculateTechnicalMetrics(closes: number[], highs: number[], lows: number[]) {
  if (closes.length < 25) return null;

  // 1. Trend Direction (using a weighted window)
  let upScore = 0;
  let downScore = 0;
  const windowSize = 20;
  for (let i = 1; i < windowSize; i++) {
    const idx = closes.length - 1 - i;
    if (idx < 0) break;
    if (closes[idx + 1] > closes[idx]) upScore++; else downScore++;
    if (highs[idx + 1] > highs[idx]) upScore++; else downScore++;
  }

  let direction: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
  const threshold = 8; // More flexible than before
  if (upScore > downScore + threshold) direction = 'uptrend';
  else if (downScore > upScore + threshold) direction = 'downtrend';

  // 2. Trend Age (Robust counting - allows 2 pullback candles)
  let age = 0;
  let pullbacks = 0;
  const maxPullbacks = 2;
  
  for (let i = 1; i < closes.length; i++) {
    const idx = closes.length - i;
    const isUpCandle = closes[idx] > closes[idx - 1];
    
    if (direction === 'uptrend') {
      if (isUpCandle) {
        age++;
      } else if (pullbacks < maxPullbacks) {
        pullbacks++; // Allow minor pause
      } else break;
    } else if (direction === 'downtrend') {
      if (!isUpCandle) {
        age++;
      } else if (pullbacks < maxPullbacks) {
        pullbacks++;
      } else break;
    } else break;
  }

  // 3. Momentum (Volume-weighted body size)
  const last5 = closes.slice(-5);
  let totalRange = 0;
  let totalBody = 0;
  for (let i = 1; i < last5.length; i++) {
    totalBody += Math.abs(last5[i] - last5[i-1]);
    totalRange += (highs[highs.length-1-(last5.length-1-i)] - lows[lows.length-1-(last5.length-1-i)]) || 0.0001;
  }
  const momentumScore = Math.min(100, (totalBody / totalRange) * 100);

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
    
    if (!quotes || !quotes.close || quotes.close.length < 25) {
      throw new Error("Insufficient market data for deep stability check.");
    }

    const closes = quotes.close.filter((c: any) => c != null);
    const highs = quotes.high.filter((c: any) => c != null);
    const lows = quotes.low.filter((c: any) => c != null);

    const metrics = calculateTechnicalMetrics(closes, highs, lows);
    
    // ══════════════════════════════════════════════
    // PHASE 1: HARD STABILITY CHECK
    // ══════════════════════════════════════════════
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
