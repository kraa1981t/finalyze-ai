import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 5000;

  // Global request logger
  app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json());
  console.log("[Server] Initializing Finalyze Engine...");

  // API Route: Health check
  app.get("/api/health", (req, res) => {
    const distPath = path.resolve(process.cwd(), "dist");
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV || "unknown",
      distExists: fs.existsSync(distPath),
      indexExists: fs.existsSync(path.join(distPath, "index.html"))
    });
  });

  // API Route: Market Context - Fear & Greed Index
  app.get("/api/context-fear-greed", async (_req, res) => {
    try {
      const response = await fetch("https://api.alternative.me/fng/?limit=1");
      const data = await response.json();
      const item = data?.data?.[0];
      res.json({ value: Number(item?.value) || 50, classification: item?.value_classification || "Neutral" });
    } catch {
      res.json({ value: 50, classification: "Neutral" });
    }
  });

  // API Route: Market Context - Latest News
  app.get("/api/context-news", async (req, res) => {
    try {
      const query = (req.query.query as string) || "financial markets";
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
      const response = await fetch(rssUrl);
      const xml = await response.text();
      const titles = [...xml.matchAll(/<title>(.*?)<\/title>/g)].slice(1).map(m => m[1]);
      const sources = [...xml.matchAll(/<source>(.*?)<\/source>/g)].map(m => m[1]);
      const articles = titles.slice(0, 8).map((title, i) => ({
        title,
        source: sources[i] || "News"
      }));
      res.json({ articles });
    } catch {
      res.json({ articles: [] });
    }
  });

  // API Route: Market Context - Economic Calendar
  app.get("/api/context-econ-calendar", async (_req, res) => {
    try {
      const response = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json");
      const data = await response.json();
      const events = (data || []).filter((e: any) => e.impact === "High" || e.impact === "Medium").slice(0, 10).map((e: any) => ({
        title: e.title,
        country: e.country,
        date: e.date,
        impact: e.impact,
        forecast: e.forecast || "-",
        previous: e.previous || "-"
      }));
      res.json({ events });
    } catch {
      res.json({ events: [] });
    }
  });

  // API Route: Market Data (Proxy to Yahoo Finance)
  app.get("/api/market-data", async (req, res) => {
    try {
      const symbol = req.query.symbol as string;
      const timeframe = (req.query.timeframe as string) || '1d';
      
      if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" });
      }

      let yahooSymbol = symbol.toUpperCase().replace(/ /g, '');
      
      // Custom Yahoo Finance Mappings for Metals
      const customMappings: Record<string, string> = {
        'XAUUSD': 'GC=F', // Gold Futures
        'XAGUSD': 'SI=F', // Silver Futures
        'XPTUSD': 'PL=F', // Platinum
        'XPDUSD': 'PA=F', // Palladium
        'XCUUSD': 'HG=F', // Copper
        'XALUSD': 'ALI=F', // Aluminum
        'XZNUSD': 'ZNC=F', // Zinc
        'XNIUSD': 'NIC=F', // Nickel
        'XPBUSD': 'LED=F', // Lead
      };
      
      if (customMappings[yahooSymbol]) {
        yahooSymbol = customMappings[yahooSymbol];
      }

      let interval = '1d';
      let range = '14d';
      
      // Timeframe Mapping
      if (timeframe === '1m') { interval = '1m'; range = '1d'; }
      else if (timeframe === '5m') { interval = '5m'; range = '5d'; }
      else if (timeframe === '15m') { interval = '15m'; range = '5d'; }
      else if (timeframe === '1h') { interval = '60m'; range = '1mo'; }
      else if (timeframe === '4h') { interval = '1h'; range = '3mo'; } 
      else if (timeframe === '1d') { interval = '1d'; range = '6mo'; }
      else if (timeframe === '1w') { interval = '1wk'; range = '2y'; }

      const fetchMarketData = async (sym: string, rangeStr: string, intervalStr: string) => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${rangeStr}&interval=${intervalStr}`;
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
              'Accept': 'application/json',
              'Accept-Language': 'en-US,en;q=0.9',
              'Origin': 'https://finance.yahoo.com',
              'Referer': 'https://finance.yahoo.com/'
            }
          });
          if (!response.ok) return null;
          const data = await response.json();
          if (data.chart?.result?.[0]) return data;
          return null;
        } catch (e) {
          return null;
        }
      };

      // Try multiple variations for the symbol
      let attempts = [];
      if (yahooSymbol.length >= 6 && (yahooSymbol.includes('USD') || yahooSymbol.includes('EUR') || yahooSymbol.includes('JPY'))) {
        const base = yahooSymbol.replace('USD', '').replace('-USD', '').replace('=X', '');
        attempts = [
          `${base}-USD`, // Direct Crypto
          `${yahooSymbol}=X`, // Direct Forex
          `${base}USD=X`, // Combined
          yahooSymbol, // Raw
          `${base}=F`, // Futures (Metals)
          `${base}USD`, // Simple
        ];
      } else {
        attempts = [yahooSymbol, `${yahooSymbol}=X`, `${yahooSymbol}-USD`].filter(Boolean);
      }

      // De-duplicate attempts
      const uniqueAttempts = Array.from(new Set(attempts));
      
      let finalData = null;
      const intervalsToTry = [interval, '5m', '15m', '60m', '1d'];
      
      outer: for (const attempt of uniqueAttempts) {
        for (const intv of intervalsToTry) {
          finalData = await fetchMarketData(attempt, range, intv);
          if (finalData) break outer;
        }
      }

      if (!finalData) {
        // Absolute last resort: Max range, Daily interval
        for (const attempt of uniqueAttempts) {
          finalData = await fetchMarketData(attempt, '1mo', '1d');
          if (finalData) break;
        }
      }

      if (!finalData) {
        return res.status(404).json({ error: `Symbol ${symbol} not found after multiple attempts.` });
      }
      
      res.json(finalData);
    } catch (error: any) {
      console.error("Market data error:", error);
      res.status(500).json({ error: "Failed to fetch market data" });
    }
  });

  // API Route: AI Analysis Proxy (for Groq API)
  app.post("/api/ai-analysis", async (req, res) => {
    try {
      const { prompt, userApiKey } = req.body;
      const apiKey = userApiKey || process.env.GROQ_API_KEY;
      const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

      if (!apiKey) {
        return res.status(400).json({ error: "Groq API Key is required. Please set your key in the top-right toolbar." });
      }

      const groqUrl = "https://api.groq.com/openai/v1/chat/completions";

      let retries = 3;
      let response;
      let data;

      while (retries > 0) {
        response = await fetch(groqUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: "You are a professional financial analyst AI. You provide strict, math-based technical analysis. Always respond in valid JSON format." },
              { role: "user", content: prompt }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
          })
        });

        if (response.status === 429) {
          retries--;
          if (retries === 0) break;
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `AI API returned ${response.status}`;
          try {
            const errJson = JSON.parse(errorText);
            errorMessage = errJson?.error?.message || errJson?.error?.code || errorMessage;
          } catch {}
          return res.status(response.status).json({ error: errorMessage });
        }

        data = await response.json();
        break;
      }

      if (!data) {
        return res.status(503).json({ error: "AI service temporarily unavailable. Please try again." });
      }

      // Groq returns OpenAI-compatible format directly
      const content = data?.choices?.[0]?.message?.content || '';
      res.json({
        choices: [{
          message: { content }
        }]
      });
    } catch (error: any) {
      console.error("AI Proxy error:", error);
      res.status(500).json({ error: error.message || "Internal server error during AI analysis" });
    }
  });
  
  const distPath = path.resolve(process.cwd(), "dist");
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && fs.existsSync(distPath)) {
    console.log("[Server] Production mode: Serving static files from /dist");
    app.use(express.static(distPath, { etag: false })); // Disable Etag to force refresh
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    console.log("[Server] Development mode: Starting Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Finalyze AI is LIVE at: http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical Server Crash:", err);
  process.exit(1);
});
