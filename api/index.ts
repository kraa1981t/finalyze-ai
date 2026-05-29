import express from "express";
import nodemailer from "nodemailer";

const FALLBACK_PRICES = {
  bitcoin: { usd: 67000 }, ethereum: { usd: 3200 }, litecoin: { usd: 85 },
  tron: { usd: 0.12 }, solana: { usd: 150 },
};

const app = express();
app.use(express.json());

// API Route: Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "4.0-Institutional", node: process.version });
});

// API Route: Send verification email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'taybemohamed10@gmail.com',
    pass: process.env.EMAIL_APP_PASSWORD || 'chxq jkcg wcia isgi',
  },
});

app.post("/api/send-verification", async (req, res) => {
  try {
    const { email, verifyLink } = req.body;
    if (!email || !verifyLink) {
      return res.status(400).json({ error: "email and verifyLink required" });
    }
    await transporter.sendMail({
      from: '"Finalyze AI" <taybemohamed10@gmail.com>',
      to: email,
      subject: '✅ تأكيد حسابك في Finalyze AI',
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;background:#f9fafb;border-radius:16px;">
          <h2 style="color:#1e293b;text-align:center;">مرحباً بك في Finalyze AI</h2>
          <p style="color:#475569;text-align:center;font-size:15px;">
            اضغط على الزر أدناه لتأكيد حسابك وتفعيل المنصة:
          </p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${verifyLink}" style="display:inline-block;background:#10b981;color:white;padding:14px 32px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:bold;">
              ✅ تأكيد الحساب
            </a>
          </div>
          <p style="color:#94a3b8;text-align:center;font-size:12px;">
            إذا لم تطلب هذا، تجاهل هذه الرسالة.
          </p>
        </div>
      `,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Email send error:", error);
    res.status(500).json({ error: error.message });
  }
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
    const upper = query.toUpperCase();
    let category = 'general';
    if (upper.includes('BTC') || upper.includes('ETH') || upper.includes('SOL') || upper.includes('XRP') || upper.includes('DOGE') || upper.includes('CRYPTO')) category = 'crypto';
    else if (upper.includes('EUR') || upper.includes('GBP') || upper.includes('JPY') || upper.includes('AUD') || upper.includes('CAD') || upper.includes('NZD') || upper.includes('CHF') || upper.includes('FOREX')) category = 'forex';
    else if (upper.includes('XAU') || upper.includes('XAG') || upper.includes('XPT') || upper.includes('XPD') || upper.includes('XCU') || upper.includes('GOLD') || upper.includes('SILVER') || upper.includes('COPPER')) category = 'commodity';

    // Client sends its Finnhub key via header; fallback to env or DEMO
    const clientKey = req.headers['x-finnhub-key'] as string;
    const finnhubKey = clientKey || process.env.FINNHUB_API_KEY || 'DEMO';
    const finnhubUrl = `https://finnhub.io/api/v1/news?category=${category}&token=${finnhubKey}`;
    const resp = await fetch(finnhubUrl);
    if (resp.ok) {
      const data = await resp.json();
      const articles = (data || []).slice(0, 8).map((a: any) => ({
        title: a.headline || '',
        source: a.source || 'Finnhub'
      })).filter((a: any) => a.title);
      if (articles.length > 0) return res.json({ articles });
    }
  } catch {}
  // Fallback: Google News RSS
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(req.query.query as string || "financial markets")}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(rssUrl);
    const xml = await response.text();
    const titles = [...xml.matchAll(/<title>(.*?)<\/title>/g)].slice(1).map(m => m[1]);
    const sources = [...xml.matchAll(/<source>(.*?)<\/source>/g)].map(m => m[1]);
    const articles = titles.slice(0, 8).map((title, i) => ({
      title,
      source: sources[i] || "News"
    }));
    return res.json({ articles });
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

// API Route: Crypto Prices (from Coingecko) for Payment Modal
app.get("/api/crypto-prices", async (_req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,litecoin,tron,solana&vs_currencies=usd", {
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await response.json();
    if (data.bitcoin?.usd) return res.json(data);
    res.json(FALLBACK_PRICES);
  } catch {
    res.json(FALLBACK_PRICES);
  }
});

// Helper for Market Data Fetching
const fetchMarketData = async (sym: string, rangeStr: string, intervalStr: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${rangeStr}&interval=${intervalStr}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'https://finance.yahoo.com',
        'Referer': 'https://finance.yahoo.com/'
      }
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.chart?.result?.[0]) return data;
    return null;
  } catch (e) {
    clearTimeout(timeout);
    return null;
  }
};

// API Route: Market Data
app.get("/api/market-data", async (req, res) => {
  try {
    const symbol = req.query.symbol as string;
    const timeframe = (req.query.timeframe as string) || '1d';
    if (!symbol) return res.status(400).json({ error: "Symbol is required" });

    const rawSymbol = symbol.toUpperCase().replace(/ /g, '');
    const customMappings: Record<string, string> = {
      'XAUUSD': 'GC=F', 'XAGUSD': 'SI=F', 'XPTUSD': 'PL=F', 'XPDUSD': 'PA=F',
      'XCUUSD': 'HG=F', 'XALUSD': 'ALI=F', 'XZNUSD': 'ZNC=F', 'XNIUSD': 'NIC=F', 'XPBUSD': 'LED=F',
    };
    const isMetal = !!customMappings[rawSymbol];
    let yahooSymbol = isMetal ? customMappings[rawSymbol] : rawSymbol;

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

    // Determine symbol format based on type heuristics
    const hasEquals = yahooSymbol.includes('=');
    const isForex = !isMetal && yahooSymbol.length >= 6 && (
      yahooSymbol.endsWith('USD') || yahooSymbol.endsWith('EUR') ||
      yahooSymbol.endsWith('JPY') || yahooSymbol.endsWith('GBP') ||
      yahooSymbol.endsWith('AUD') || yahooSymbol.endsWith('NZD') ||
      yahooSymbol.endsWith('CAD') || yahooSymbol.endsWith('CHF')
    );
    
    // For metals: use mapped futures symbol (e.g., GC=F)
    // For forex: use =X suffix (e.g., EURUSD=X)
    // For stocks/crypto: use symbol as-is (e.g., AAPL, BTC-USD)
    let attempts: string[] = [];
    if (isMetal || hasEquals) {
      attempts = [yahooSymbol];
    } else if (isForex) {
      attempts = [`${yahooSymbol}=X`];
      // Fallback: try with dash format (e.g., EUR-USD, GBP-JPY)
      const base = yahooSymbol.slice(0, 3);
      const quote = yahooSymbol.slice(3);
      if (base.length === 3 && quote.length === 3) {
        attempts.push(`${base}-${quote}`);
      }
    } else {
      attempts = [yahooSymbol];
      // Crypto fallback: append -USD or -BTC
      if (!yahooSymbol.includes('-')) {
        attempts.push(`${yahooSymbol}-USD`);
      }
    }

    let finalData = null;
    for (const attempt of attempts) {
      finalData = await fetchMarketData(attempt, range, interval);
      if (finalData) break;
    }

    if (!finalData) return res.status(404).json({ error: "No data found" });
    res.json(finalData);
  } catch (error: any) {
    res.status(500).json({ error: "Server Error" });
  }
});

// API Route: AI Analysis Proxy — Groq (gsk_) or Google Gemini (AIzaSy)
app.post("/api/ai-analysis", async (req, res) => {
  try {
    const { prompt, userApiKey } = req.body;
    
    // Use user-provided API key if available
    let key = (userApiKey && userApiKey !== '__dev_bypass__') ? userApiKey.trim() : '';

    let result: any = null;
    let keyTried = false;

    if (key) {
      keyTried = true;
      if (key.startsWith('AIzaSy') || key.startsWith('AQ.')) {
        result = await callGoogle(key, prompt);
      } else {
        result = await callGroq(key, prompt);
      }
    }

    // If no custom key was provided, or the custom key failed/errored out, try the server's system keys!
    if (!result || result.error || !result.content) {
      const systemGeminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      const systemGroqKey = process.env.GROQ_API_KEY;

      let fallbackSuccess = false;

      if (systemGeminiKey) {
        const sysResult = await callGoogle(systemGeminiKey, prompt);
        if (sysResult && sysResult.content) {
          result = sysResult;
          fallbackSuccess = true;
        } else if (!result && sysResult) {
          result = sysResult; // capture error if it's the only one we have
        }
      }
      
      if (!fallbackSuccess && systemGroqKey) {
        const sysResult = await callGroq(systemGroqKey, prompt);
        if (sysResult && sysResult.content) {
          result = sysResult;
          fallbackSuccess = true;
        } else if (!result && sysResult) {
          result = sysResult;
        }
      }

      if (!fallbackSuccess) {
        // Return the error from the custom key if we tried it, or the server fallback error
        const errMsg = result?.error || 'No active server API keys could be successfully executed.';
        return res.status(503).json({ error: errMsg });
      }
    }

    // If we reach here, we are guaranteed to have result.content
    return res.json({ choices: [{ message: { content: result.content } }] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function callGroq(apiKey: string, prompt: string) {
  const models = [process.env.GROQ_MODEL || "llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"];
  for (const model of models) {
    const body = {
      model: model,
      messages: [
        { role: "system", content: "You are a professional financial analyst AI. Always respond in valid JSON format." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    };
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const ac = new AbortController();
        const timeout = setTimeout(() => ac.abort(), 20000);
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          signal: ac.signal
        });
        clearTimeout(timeout);
        if (resp.status === 429) {
          if (attempt < 2) { await new Promise(r => setTimeout(r, 1000)); continue; }
          break; // Break the attempt loop to try the next fallback model!
        }
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `Groq: HTTP ${resp.status}`;
          return { error: errMsg };
        }
        const data = await resp.json().catch(() => ({}));
        return { content: data?.choices?.[0]?.message?.content || '' };
      } catch (e: any) {
        if (attempt < 2) { await new Promise(r => setTimeout(r, 500)); continue; }
        break; // Break to try the next model!
      }
    }
  }
  return { error: 'Groq: all models exhausted due to rate limits or invalid key' };
}

async function callGoogle(apiKey: string, prompt: string) {
  const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-1.5-flash'];
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const ac = new AbortController();
        const timeout = setTimeout(() => ac.abort(), 20000);
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are a financial analyst. ${prompt}` }] }],
            generationConfig: { 
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          }),
          signal: ac.signal
        });
        clearTimeout(timeout);
        if (resp.status === 429) {
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
          break; // Break the attempt loop to try the next model!
        }
        if (resp.ok) {
          const data = await resp.json().catch(() => ({}));
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) return { content: text };
        } else {
          const errData = await resp.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `Google: HTTP ${resp.status}`;
          // If the key is invalid or expired (400, 403, 401), abort immediately.
          if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
            return { error: errMsg };
          }
        }
        break;
      } catch {
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
      }
    }
  }
  return { error: 'Google: all models exhausted due to rate limits or invalid key' };
}

export default app;
