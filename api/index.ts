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

// API Route: Register new client with API key
app.post("/api/register-client-with-key", async (req, res) => {
  try {
    const { email, uid, apiKeyType } = req.body;
    if (!email || !uid) {
      return res.status(400).json({ error: "email and uid required" });
    }

    // Store client registration with timestamp
    const clientData = {
      email: email.toLowerCase().trim(),
      uid,
      status: 'active',
      plan: 'free',
      planExpiry: null,
      registeredAt: new Date().toISOString(),
      apiKeyType: apiKeyType || 'gemini',
    };

    console.log("Registering client:", clientData);
    res.json({ success: true, message: "Client registered successfully", client: clientData });
  } catch (error: any) {
    console.error("Client registration error:", error);
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

// Helper: Yahoo Finance Fetch
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

// Helper: Binance Klines → Yahoo format
const SERVER_CRYPTO_MAP: Record<string, string> = {
  'BTCUSD': 'BTCUSDT', 'ETHUSD': 'ETHUSDT', 'SOLUSD': 'SOLUSDT',
  'XRPUSD': 'XRPUSDT', 'DOGEUSD': 'DOGEUSDT', 'ADAUSD': 'ADAUSDT',
  'DOTUSD': 'DOTUSDT', 'MATICUSD': 'MATICUSDT', 'LINKUSD': 'LINKUSDT',
  'UNIUSD': 'UNIUSDT', 'AVAXUSD': 'AVAXUSDT', 'ATOMUSD': 'ATOMUSDT',
  'LTCUSD': 'LTCUSDT', 'BCHUSD': 'BCHUSDT', 'XLMUSD': 'XLMUSDT',
  'TRXUSD': 'TRXUSDT', 'FILUSD': 'FILUSDT', 'APTUSD': 'APTUSDT',
  'ARBUSD': 'ARBUSDT', 'OPUSD': 'OPUSDT', 'INJUSD': 'INJUSDT',
  'BTCUSDT': 'BTCUSDT', 'ETHUSDT': 'ETHUSDT', 'SOLUSDT': 'SOLUSDT',
};

function findServerCryptoPair(symbol: string): string | null {
  const upper = symbol.toUpperCase().replace(/ /g, '');
  if (SERVER_CRYPTO_MAP[upper]) return SERVER_CRYPTO_MAP[upper];
  if (upper.endsWith('USD') || upper.endsWith('USDT')) {
    const base = upper.replace(/USD(T)?$/, '');
    if (base && base.length <= 10) return `${base}USDT`;
  }
  const knownCoins = ['BTC','ETH','SOL','XRP','DOGE','ADA','DOT','MATIC','LINK',
    'UNI','AVAX','ATOM','LTC','BCH','XLM','TRX','FIL','APT','ARB','OP','INJ'];
  for (const coin of knownCoins) {
    if (upper.startsWith(coin)) return `${coin}USDT`;
  }
  return null;
}

const SERVER_INTERVAL_MAP: Record<string, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w', '1M': '1M',
};
const SERVER_LIMIT_MAP: Record<string, number> = {
  '1m': 100, '5m': 100, '15m': 200, '1h': 200, '4h': 500,
  '1d': 365, '1w': 200, '1M': 200,
};

const BINANCE_ENDPOINTS = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api3.binance.com',
  'https://data-api.binance.vision',
];

const fetchBinanceData = async (symbol: string, timeframe: string): Promise<any> => {
  const pair = findServerCryptoPair(symbol);
  if (!pair) return null;
  const interval = SERVER_INTERVAL_MAP[timeframe] || '1d';
  const limit = SERVER_LIMIT_MAP[timeframe] || 100;
  
  for (const base of BINANCE_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const url = `${base}/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) continue;
      const klines = await response.json();
      if (!klines || klines.length < 10) continue;
      return {
        chart: {
          result: [{
            meta: { symbol, regularMarketTime: Math.floor(Date.now() / 1000) },
            timestamp: klines.map((k: any[]) => Math.floor(k[0] / 1000)),
            indicators: {
              quote: [{
                open: klines.map((k: any[]) => parseFloat(k[1])),
                high: klines.map((k: any[]) => parseFloat(k[2])),
                low: klines.map((k: any[]) => parseFloat(k[3])),
                close: klines.map((k: any[]) => parseFloat(k[4])),
                volume: klines.map((k: any[]) => parseFloat(k[5])),
              }]
            }
          }]
        }
      };
    } catch (e) {
      clearTimeout(timeout);
    }
  }
  return null;
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

    const hasEquals = yahooSymbol.includes('=');
    const cryptoPair = findServerCryptoPair(rawSymbol);
    const isCrypto = !!cryptoPair && !isMetal;
    const isForex = !isMetal && !hasEquals && !isCrypto && yahooSymbol.length >= 6 && (
      yahooSymbol.endsWith('USD') || yahooSymbol.endsWith('EUR') ||
      yahooSymbol.endsWith('JPY') || yahooSymbol.endsWith('GBP') ||
      yahooSymbol.endsWith('AUD') || yahooSymbol.endsWith('NZD') ||
      yahooSymbol.endsWith('CAD') || yahooSymbol.endsWith('CHF')
    );

    if (isCrypto) {
      const binanceData = await fetchBinanceData(rawSymbol, timeframe);
      if (binanceData) return res.json(binanceData);
    }

    let attempts: string[] = [];
    if (isMetal || hasEquals) {
      attempts = [yahooSymbol];
    } else if (isForex) {
      attempts = [`${yahooSymbol}=X`];
      const base = yahooSymbol.slice(0, 3);
      const quote = yahooSymbol.slice(3);
      if (base.length === 3 && quote.length === 3) {
        attempts.push(`${base}-${quote}`);
      }
    } else {
      attempts = [yahooSymbol];
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

    const hasQuotes = finalData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.length > 0;
    if (!hasQuotes) return res.status(404).json({ error: "No data found" });
    res.json(finalData);
  } catch (error: any) {
    res.status(500).json({ error: "Server Error" });
  }
});

// API Route: Factory Reset — trigger redeploy from stable-v1
const STABLE_VERSION_HASH = '62c47deed780f1122533632a688f7760ff0c71f5';
const STABLE_VERSION_TAG = 'stable-v1';
const GITHUB_REPO = 'kraa1981t/finalyze-ai';
const GITHUB_ACTIONS_URL = `https://github.com/${GITHUB_REPO}/actions/new`;

app.post("/api/factory-reset", async (req, res) => {
  const errors: string[] = [];

  try {
    // Strategy 1: Vercel Deploy Hook
    const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
    if (deployHookUrl) {
      const resp = await fetch(deployHookUrl, { method: 'POST' });
      if (resp.ok || resp.status < 500) {
        return res.json({
          success: true, method: 'vercel-hook',
          stableVersion: STABLE_VERSION_HASH, stableTag: STABLE_VERSION_TAG,
          message: `Factory reset via Vercel hook. Redeploying ${STABLE_VERSION_TAG}...`
        });
      }
      errors.push(`Vercel hook returned ${resp.status}`);
    }

    // Strategy 2: GitHub API force-push (uses PAT from env or request header)
    const githubToken = process.env.GITHUB_PAT || (req.body?.pat as string);
    if (githubToken) {
      const stableSha = STABLE_VERSION_HASH;
      const patchResp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/refs/heads/main`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${githubToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha: stableSha, force: true })
      });
      if (patchResp.ok) {
        return res.json({
          success: true, method: 'github-force-push',
          stableVersion: STABLE_VERSION_HASH, stableTag: STABLE_VERSION_TAG,
          message: `Factory reset via GitHub force-push. Main branch reset to ${STABLE_VERSION_TAG}. Vercel will redeploy shortly.`
        });
      }
      const errData = await patchResp.json().catch(() => ({}));
      errors.push(`GitHub force-push failed: ${errData?.message || patchResp.status}`);
    }
  } catch (e: any) {
    errors.push(e.message);
  }

  // Fallback: return instructions with redirect URL
  return res.json({
    success: true, stableVersion: STABLE_VERSION_HASH, stableTag: STABLE_VERSION_TAG,
    message: `لإعادة التعيين، زُر صفحة GitHub Actions يدوياً.`,
    methods: {
      vercelHook: deployHookUrl ? 'configured' : 'missing (set VERCEL_DEPLOY_HOOK_URL)',
      githubActions: GITHUB_ACTIONS_URL,
      manual: `git fetch --tags && git push --force origin ${STABLE_VERSION_TAG}:main`
    },
    errors: errors.length > 0 ? errors : undefined,
    redirectUrl: GITHUB_ACTIONS_URL
  });
});

// API Route: Save Current Version as Stable
app.post("/api/save-stable", async (req, res) => {
  try {
    const githubToken = process.env.GITHUB_PAT || (req.body?.pat as string);
    if (!githubToken) {
      return res.json({ success: false, message: 'GitHub PAT required (set GITHUB_PAT env var or send pat in body)' });
    }

    const headers = { 'Authorization': `Bearer ${githubToken}`, 'Content-Type': 'application/json' };

    // 1. Get latest commit SHA on main
    const mainRef = await (await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/refs/heads/main`, { headers })).json();
    const latestSha = mainRef.object?.sha;
    if (!latestSha) return res.json({ success: false, message: 'Could not get latest commit' });

    // 2. Update stable-v1 tag to point to latest commit
    const tagResp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/refs/tags/${STABLE_VERSION_TAG}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ sha: latestSha, force: true })
    });

    if (!tagResp.ok && tagResp.status === 404) {
      // Tag doesn't exist yet — create it
      await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/refs`, {
        method: 'POST', headers,
        body: JSON.stringify({ ref: `refs/tags/${STABLE_VERSION_TAG}`, sha: latestSha })
      });
    } else if (!tagResp.ok) {
      const err = await tagResp.json().catch(() => ({}));
      return res.json({ success: false, message: `Tag update failed: ${err.message || tagResp.status}` });
    }

    // 3. Update stable-ref.json
    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const commitMsg = await (await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/commits/${latestSha}`, { headers })).json();
    const refContent = JSON.stringify({
      stableVersion: latestSha,
      description: `${latestSha.substring(0, 7)} ${(commitMsg.message || '').split('\n')[0]}`,
      savedAt: dateStr,
      autoUpdate: true
    }, null, 2);

    // Check if stable-ref.json exists
    let existingSha: string | null = null;
    const existingResp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/.backups/stable-ref.json`, { headers });
    if (existingResp.ok) {
      const existing = await existingResp.json();
      existingSha = existing.sha;
    }

    await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/.backups/stable-ref.json`, {
      method: 'PUT', headers,
      body: JSON.stringify({
        message: `Update stable-ref to ${latestSha.substring(0, 7)}`,
        content: Buffer.from(refContent).toString('base64'),
        sha: existingSha
      })
    });

    return res.json({
      success: true,
      stableVersion: latestSha,
      message: `✅ Stable version updated to ${latestSha.substring(0, 7)}`
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// API Route: AI Analysis Proxy — Groq (gsk_) or Google Gemini (AIzaSy)
app.post("/api/ai-analysis", async (req, res) => {
  try {
    const { prompt, userApiKey } = req.body;
    
    // Check if the user is a developer bypassing the key screen
    const isDevBypass = userApiKey === '__dev_bypass__';
    
    // Use user-provided API key if available
    let key = (userApiKey && userApiKey !== '__dev_bypass__') ? userApiKey.trim() : '';

    if (!key && !isDevBypass) {
      return res.status(400).json({ 
        error: "API Key is required. Please set your own Google Gemini or Groq API key in the settings modal." 
      });
    }

    let result: any = null;

    if (key) {
      // Use the client's custom key exclusively
      if (key.startsWith('AIzaSy') || key.startsWith('AQ.')) {
        result = await callGoogle(key, prompt);
      } else {
        result = await callGroq(key, prompt);
      }
      
      // If client key failed, return their specific error immediately! Never fall back to system keys for normal clients.
      if (!result || result.error || !result.content) {
        const errMsg = result?.error || 'Your API key could not be successfully executed.';
        return res.status(400).json({ error: errMsg });
      }
    } else if (isDevBypass) {
      // ONLY developer bypass is allowed to use the server-side system keys
      const systemGeminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      const systemGroqKey = process.env.GROQ_API_KEY;

      let fallbackSuccess = false;

      if (systemGeminiKey) {
        const sysResult = await callGoogle(systemGeminiKey, prompt);
        if (sysResult && sysResult.content) {
          result = sysResult;
          fallbackSuccess = true;
        }
      }
      
      if (!fallbackSuccess && systemGroqKey) {
        const sysResult = await callGroq(systemGroqKey, prompt);
        if (sysResult && sysResult.content) {
          result = sysResult;
          fallbackSuccess = true;
        }
      }

      if (!fallbackSuccess) {
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
  const models = [process.env.GROQ_MODEL || "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  let lastError = 'Groq: all models exhausted due to rate limits or invalid key';
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
    try {
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 5000);
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: ac.signal
      });
      clearTimeout(timeout);
      
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        lastError = errData?.error?.message || `Groq: HTTP ${resp.status}`;
        // If the key is invalid (400, 401, 403), abort immediately.
        if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
          return { error: lastError };
        }
        continue; // Try next model
      }
      
      const data = await resp.json().catch(() => ({}));
      const text = data?.choices?.[0]?.message?.content || '';
      if (text) return { content: text };
    } catch (e: any) {
      lastError = e.name === 'AbortError' ? 'Groq: Request timed out' : e.message;
    }
  }
  return { error: lastError };
}

async function callGoogle(apiKey: string, prompt: string) {
  const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
  let lastError = 'Google: all models exhausted due to rate limits or invalid key';
  for (const model of models) {
    try {
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 5000);
      
      let resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
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
      
      // If v1beta returns 404 (Not Found) or 400 (Bad Request), fallback immediately to stable v1 API endpoint!
      if (!resp.ok && (resp.status === 404 || resp.status === 400)) {
        const v1Ac = new AbortController();
        const v1Timeout = setTimeout(() => v1Ac.abort(), 5000);
        try {
          const v1Resp = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `You are a financial analyst. ${prompt}` }] }],
              generationConfig: { 
                temperature: 0.1,
                responseMimeType: "application/json"
              }
            }),
            signal: v1Ac.signal
          });
          clearTimeout(v1Timeout);
          if (v1Resp.ok) {
            resp = v1Resp;
          }
        } catch {
          clearTimeout(v1Timeout);
        }
      }
      
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        lastError = errData?.error?.message || `Google: HTTP ${resp.status}`;
        // If the key is invalid or expired (400, 401, 403), abort immediately.
        if (resp.status === 400 || resp.status === 401 || resp.status === 403) {
          return { error: lastError };
        }
        continue; // Try next model
      }
      
      const data = await resp.json().catch(() => ({}));
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) return { content: text };
    } catch (e: any) {
      lastError = e.name === 'AbortError' ? 'Google: Request timed out' : e.message;
    }
  }
  return { error: lastError };
}

export default app;
