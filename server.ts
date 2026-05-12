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
  const PORT = 3000;

  app.use(express.json());

  console.log("[Server] Checking environment...");

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
      if (yahooSymbol.includes('USD') && yahooSymbol.length >= 6) {
         if (yahooSymbol.startsWith('BTC') || yahooSymbol.startsWith('ETH') || yahooSymbol.startsWith('SOL')) {
             yahooSymbol = yahooSymbol.replace('USD', '-USD');
         } else {
             if (!yahooSymbol.includes('=')) yahooSymbol += '=X';
         }
      } else if (!yahooSymbol.includes('=') && !yahooSymbol.includes('-')) {
         if (yahooSymbol.length === 6) yahooSymbol += '=X';
      }

      let interval = '1d';
      let range = '14d';
      if (timeframe === '1m') { interval = '1m'; range = '1d'; }
      else if (timeframe === '5m') { interval = '5m'; range = '1d'; }
      else if (timeframe === '15m') { interval = '15m'; range = '5d'; }
      else if (timeframe === '1h') { interval = '60m'; range = '10d'; }
      else if (timeframe === '4h') { interval = '90m'; range = '1mo'; } 
      else if (timeframe === '1d') { interval = '1d'; range = '1mo'; }
      else if (timeframe === '1w') { interval = '1wk'; range = '1y'; }
      else if (timeframe === '1M') { interval = '1mo'; range = '5y'; }
      else if (timeframe === '1Y') { interval = '3mo'; range = '10y'; }
      
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=${range}&interval=${interval}`;
      const response = await fetch(url);
      const data = await response.json();
      
      res.json(data);
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
    console.log("[Server] Production mode: Serving static files");
    app.use(express.static(distPath));
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
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
