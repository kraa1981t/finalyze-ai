import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: "AIzaSyAcGgkdfgOwHTUcmLJ20bQzDe3AR7ZzW_4" });

async function test() {
  const symbol = "EURUSD=X";
  const timeframe = "1h";
  const macro1 = "1d", macro2 = "1w";
  
  // Dummy data instead of fetching, just to see what the AI says
  const dummyData = Array(50).fill(1.1000).join(", ");
  const marketDataContext = `
      === LIVE MARKET DATA (1h - Last 50 Candles) ===
      Open:  [${dummyData}]
      High:  [${dummyData}]
      Low:   [${dummyData}]
      Close: [${dummyData}]
      
      === LIVE MARKET DATA (1d - Last 50 Candles) ===
      Open:  [${dummyData}]
      High:  [${dummyData}]
      Low:   [${dummyData}]
      Close: [${dummyData}]
      
      === LIVE MARKET DATA (1w - Last 50 Candles) ===
      Open:  [${dummyData}]
      High:  [${dummyData}]
      Low:   [${dummyData}]
      Close: [${dummyData}]
  `;

  const technicalPrompt = `
      Perform a professional financial analysis for: ${symbol}
      Market Type: FOREX
      Primary Timeframe: ${timeframe}
      Trading Strategy Style: Scalping

      ${marketDataContext}

      **DYNAMIC ANALYSIS RULES**:
      1. Analyze the trend based ONLY on the provided live market data for the multiple timeframes. Do not guess or hallucinate data.
      2. CANDLE MOMENTUM CONDITION: Using the provided 50 candles for the Primary Timeframe (${timeframe}), verify if the most recent 1 candle(s) show a momentum strength of at least 55%. If this momentum is absent, return "signal": "no_entry".
      3. STRICT SUPPLY/DEMAND ALIGNMENT: You are provided with the exact 50-candle history for the current timeframe (${timeframe}) and macro timeframes (${macro1}, ${macro2}). You MUST mathematically verify that the momentum and trend align across ALL these timeframes in the exact same direction, and check for historical Supply/Demand zones within these 50 candles. If the directional strength across these timeframes is < 55%, or if any macro timeframe contradicts the current trend, you MUST return "signal": "no_entry".
      4. Use RSI and Moving Averages for momentum confirmation.
      
      **CONFIDENCE & SIGNAL RULES**:
      - If conditions are met and confidence is >= 80%, return "signal": "strong_buy" or "strong_sell".
      - If conditions are met and confidence is between 55% and 79%, return "signal": "buy" or "sell".
      - If conditions are NOT met or momentum is weak, return "signal": "no_entry" or "neutral".

      Return ONLY a VALID JSON object:
      {
        "signal": "buy" | "sell" | "no_entry",
        "summary": "reasoning"
      }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [{ role: "user", parts: [{ text: technicalPrompt }] }],
      config: { responseMimeType: "application/json" }
    });
    console.log(response.text);
  } catch(e: any) {
    console.error("Error:", e.message);
  }
}
test();

