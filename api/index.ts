import express from "express";

const app = express();

app.use(express.json());

// API Route: Health check (v3)
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    version: "3.0-PureAPI",
    env: process.env.NODE_ENV || "unknown"
  });
});

// API Route: Market Data
app.get("/api/market-data", async (req, res) => {
  try {
    const symbol = req.query.symbol as string;
    const timeframe = (req.query.timeframe as string) || '1d';
    if (!symbol) return res.status(400).json({ error: "Symbol is required" });

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
    else if (timeframe === '4h') { interval = '60m'; range = '1mo'; } 
    else if (timeframe === '1d') { interval = '1d'; range = '1mo'; }
    else if (timeframe === '1w') { interval = '1wk'; range = '1y'; }
    else if (timeframe === '1M') { interval = '1mo'; range = '5y'; }
    else if (timeframe === '1Y') { interval = '3mo'; range = '10y'; }
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=${range}&interval=${interval}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch market data" });
  }
});

// API Route: AI Analysis Proxy
app.post("/api/ai-analysis", async (req, res) => {
  try {
    const { prompt } = req.body;
    const apiKey = process.env.VITE_QWEN_API_KEY;
    const apiUrl = process.env.VITE_QWEN_API_URL;
    const model = process.env.VITE_QWEN_MODEL || "qwen-plus";

    if (!apiKey) return res.status(500).json({ error: "[DEBUG] API Key Missing in Vercel Env" });
    if (!apiUrl) return res.status(500).json({ error: "[DEBUG] API URL Missing in Vercel Env" });

    const response = await fetch(`${apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a professional financial analyst AI." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ 
        error: `[QWEN_SERVER_ERROR] ${response.status}: ${JSON.stringify(errorData)}` 
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: `[SERVER_CRASH] ${error.message}` });
  }
});

// Export the app for Vercel serverless functions
export default app;
