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

  // API Route: Market Data (Proxy to Yahoo Finance)
  app.get("/api/market-data", async (req, res) => {
    try {
      const symbol = req.query.symbol as string;
      const timeframe = (req.query.timeframe as string) || '1d';
      
      if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" });
      }

      let yahooSymbol = symbol.toUpperCase().replace(/ /g, '');
      
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
          // If the interval requested is already in the list, start from there or skip smaller ones
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

  // API Route: AI Analysis Proxy (Resolves CORS issues)
  app.post("/api/ai-analysis", async (req, res) => {
    try {
      const { prompt } = req.body;
      const apiKey = process.env.VITE_QWEN_API_KEY;
      const apiUrl = process.env.VITE_QWEN_API_URL;
      const model = process.env.VITE_QWEN_MODEL || "qwen-plus";

      if (!apiKey || !apiUrl) {
        return res.status(500).json({ error: "AI API credentials not configured on server." });
      }

      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: "You are a professional financial analyst AI. You provide strict, math-based technical analysis." },
            { role: "user", content: prompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json({ error: errorData.error?.message || "AI Provider Error" });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("AI Proxy error:", error);
      res.status(500).json({ error: "Internal server error during AI analysis" });
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
