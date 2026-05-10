import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: "AIzaSyBnAz-XwrS6Dku1aZBPC-OxCMz3-p1nRqc" });
async function test() {
  try {
    const models = await ai.models.list();
    for await (const model of models) {
      console.log(model.name);
    }
  } catch(e: any) {
    console.error("Error:", e.message);
  }
}
test();

