import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: "AIzaSyBnAz-XwrS6Dku1aZBPC-OxCMz3-p1nRqc" });
async function test() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: "Hello" }] }],
    });
    console.log("Success:", response.text);
  } catch(e: any) {
    console.error("Error:", e.message);
  }
}
test();

