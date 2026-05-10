import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const ai = new GoogleGenAI({ apiKey: "AIzaSyBnAz-XwrS6Dku1aZBPC-OxCMz3-p1nRqc" });

async function test() {
  const prompt = `
      Perform a professional financial analysis for: EURUSD
      Market Type: forex
      Primary Timeframe: 1h
      Trading Strategy Style: swing

      === LIVE MARKET DATA (1h - Last 50 Candles) ===
      Open:  [1.0500, 1.0510, 1.0520, 1.0515, 1.0525]
      High:  [1.0515, 1.0525, 1.0530, 1.0525, 1.0540]
      Low:   [1.0490, 1.0505, 1.0510, 1.0500, 1.0520]
      Close: [1.0510, 1.0520, 1.0515, 1.0525, 1.0535]

      === LIVE MARKET DATA (1d - Last 50 Candles) ===
      Open:  [1.0400, 1.0450, 1.0480, 1.0500, 1.0510]
      High:  [1.0460, 1.0490, 1.0510, 1.0530, 1.0540]
      Low:   [1.0380, 1.0420, 1.0450, 1.0480, 1.0490]
      Close: [1.0450, 1.0480, 1.0500, 1.0510, 1.0535]

      === LIVE MARKET DATA (1w - Last 50 Candles) ===
      Open:  [1.0200, 1.0300, 1.0400, 1.0450, 1.0500]
      High:  [1.0350, 1.0450, 1.0500, 1.0550, 1.0540]
      Low:   [1.0150, 1.0250, 1.0350, 1.0400, 1.0450]
      Close: [1.0300, 1.0400, 1.0450, 1.0500, 1.0535]
      
      Note: You MUST use these exact prices to calculate candle sizes and mathematically verify the momentum rules.

      **DYNAMIC ANALYSIS RULES**:
      1. Analyze the trend based ONLY on the provided live market data for the multiple timeframes. Do not guess or hallucinate data.
      2. CANDLE MOMENTUM CONDITION: Using the provided 50 candles for the Primary Timeframe (1h), verify if the most recent 1 candle(s) show a momentum strength of at least 55%. If this momentum is absent, return "signal": "no_entry".
      3. STRICT SUPPLY/DEMAND ALIGNMENT: You are provided with the exact 50-candle history for the current timeframe (1h) and macro timeframes (1d, 1w). You MUST mathematically verify that the momentum and trend align across ALL these timeframes in the exact same direction, and check for historical Supply/Demand zones within these 50 candles. If the directional strength across these timeframes is < 55%, or if any macro timeframe contradicts the current trend, you MUST return "signal": "no_entry".
      4. (Indicators are disabled, skip RSI/MA).
      5. (News Guard disabled, ignore news impact).

      **CONFIDENCE & SIGNAL RULES**:
      - If conditions are met and confidence is >= 80%, return "signal": "strong_buy" or "strong_sell".
      - If conditions are met and confidence is between 55% and 79%, return "signal": "buy" or "sell".
      - If conditions are NOT met or momentum is weak, return "signal": "no_entry" or "neutral".

      **OUTPUT SPECIFICATIONS**:
      - Provide a detailed summary in ARABIC.
      - Ensure the "confidence" is a realistic percentage (0-100).
      - Maintain a professional financial tone.

      Return ONLY a VALID JSON object:
      {
        "symbol": "EURUSD",
        "signal": "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell" | "no_entry",
        "confidence": number,
        "summary": "Detailed Arabic report...",
        "technicalScore": number,
        "sentimentScore": number,
        "historicalMatch": "Pattern description"
      }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.1, responseMimeType: "application/json" }
    });
    console.log(response.text);
  } catch(e) {
    console.error(e);
  }
}
test();

