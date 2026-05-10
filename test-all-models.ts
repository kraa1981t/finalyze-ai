import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: "AIzaSyBnAz-XwrS6Dku1aZBPC-OxCMz3-p1nRqc" });
async function test() {
  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-flash-latest"];
  for (const m of models) {
    try {
      const response = await ai.models.generateContent({
        model: m,
        contents: [{ role: "user", parts: [{ text: "Hello" }] }],
      });
      console.log(`[${m}] Success`);
    } catch(e: any) {
      console.error(`[${m}] Error:`, e.message);
    }
  }
}
test();

