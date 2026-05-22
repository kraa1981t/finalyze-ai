import express from "express";

const app = express();
app.use(express.json());

// API Route: Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "4.0-Institutional", node: process.version });
});

// Helper for Market Data Fetching
const fetchMarketData = async (sym: string, rangeStr: string, intervalStr: string) => {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${rangeStr}&interval=${intervalStr}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json',
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

// API Route: Market Data
app.get("/api/market-data", async (req, res) => {
  try {
    const symbol = req.query.symbol as string;
    const timeframe = (req.query.timeframe as string) || '1d';
    if (!symbol) return res.status(400).json({ error: "Symbol is required" });

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

    // Symbol Try-Loop
    let attempts = [];
    if (yahooSymbol.length >= 6 && (yahooSymbol.includes('USD') || yahooSymbol.includes('EUR') || yahooSymbol.includes('JPY'))) {
      const base = yahooSymbol.replace('USD', '').replace('-USD', '').replace('=X', '');
      attempts = [`${base}-USD`, `${yahooSymbol}=X`, `${base}USD=X`, yahooSymbol, `${base}=F`, `${base}USD`];
    } else {
      attempts = [yahooSymbol, `${yahooSymbol}=X`, `${yahooSymbol}-USD`].filter(Boolean);
    }

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
      for (const attempt of uniqueAttempts) {
        finalData = await fetchMarketData(attempt, '1mo', '1d');
        if (finalData) break;
      }
    }

    if (!finalData) return res.status(404).json({ error: "No data found" });
    res.json(finalData);
  } catch (error: any) {
    res.status(500).json({ error: "Server Error" });
  }
});

// API Route: AI Analysis Proxy (for Groq API)
app.post("/api/ai-analysis", async (req, res) => {
  try {
    const { prompt, userApiKey } = req.body;
    const apiKey = userApiKey || process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || "llama3-70b-8192";

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
    res.status(500).json({ error: error.message });
  }
});

export default app;
