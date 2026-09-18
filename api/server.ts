import express from "express";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const FALLBACK_PRICES = {
  bitcoin: { usd: 67000 }, ethereum: { usd: 3200 }, litecoin: { usd: 85 },
  tron: { usd: 0.12 }, solana: { usd: 150 },
};

const ONSITE_LOOKBACK_MS = 6 * 60 * 60 * 1000; // 6 hours
const ONSITE_CHAIN_MAP: Record<string, string> = { btc: 'btc/main', ltc: 'ltc/main', eth: 'eth/main' };

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Route: Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "4.0-Institutional", node: process.version });
});

// API Route: Dynamic /ads.txt for The Moneytizer (served via vercel rewrite from /ads.txt)
// Reads the config doc from Firestore (public read per rules). When the link is
// enabled and ads.txt content is saved, it is served as-is. When disabled/deleted,
// an empty placeholder is served so the site is immediately unlinked.
const MTZ_FIRESTORE_DOC =
  "https://firestore.googleapis.com/v1/projects/trading-made-easy-e8450/databases/(default)/documents/config/site_moneytizer?key=AIzaSyCvMayEuNTlQ5CWbjrrqw3aft_H044-uQM";

app.get("/api/ads-txt", async (_req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const resp = await fetch(MTZ_FIRESTORE_DOC);
    if (!resp.ok) {
      res.send("# ads.txt not configured yet\n");
      return;
    }
    const data: any = await resp.json();
    const fields = data.fields || {};
    const enabled = fields.enabled?.booleanValue === true;
    const content = fields.adsTxtContent?.stringValue || "";
    if (enabled && content.trim()) {
      res.send(content);
      return;
    }
    res.send("# ads.txt empty - Moneytizer not linked or disabled\n");
  } catch (e) {
    res.send("# ads.txt temporarily unavailable\n");
  }
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
const YAHOO_HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
const fetchMarketData = async (sym: string, rangeStr: string, intervalStr: string, retries: number = 3, cacheBust: string = '') => {
  for (const host of YAHOO_HOSTS) {
    try {
      // Try with ETF alternatives first for index symbols
      const ETF_ALTS: Record<string, string> = {
        '^GSPC': 'SPY', '^DJI': 'DIA', '^NDX': 'QQQ',
        '^FTSE': 'ISF.L', '^GDAXI': 'EWG', '^N225': 'EWJ',
        '^HSI': 'EWH', '^AXJO': 'EWA',
      };
      const yahooSym = ETF_ALTS[sym] || sym;
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSym)}?range=${rangeStr}&interval=${intervalStr}${cacheBust}`;
      // Try several times on the same host to ride out transient rate-limits / cold-start delays.
      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
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
          if (response.ok) {
            const data = await response.json();
            if (data.chart?.result?.[0]) {
              // Rewrite symbol back to original for ETF alternatives
              if (yahooSym !== sym && data.chart?.result?.[0]?.meta) {
                data.chart.result[0].meta.symbol = sym;
              }
              return data;
            }
          }
          // Small backoff before retrying the same host
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        } catch (e) {
          clearTimeout(timeout);
          // Backoff before next retry
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
    } catch (e) {
      // move to next host
    }
  }
  return null;
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
  'TONUSD': 'TONUSDT', 'SUIUSD': 'SUIUSDT', 'NEARUSD': 'NEARUSDT',
  'SEIUSD': 'SEIUSDT', 'KASUSD': 'KASUSDT', 'KAVAUSD': 'KAVAUSDT',
  'WLDUSD': 'WLDUSDT', 'PENDLEUSD': 'PENDLEUSDT', 'JUPUSD': 'JUPUSDT',
  'STXUSD': 'STXUSDT', 'POLUSD': 'POLUSDT',
  'BTCUSDT': 'BTCUSDT', 'ETHUSDT': 'ETHUSDT', 'SOLUSDT': 'SOLUSDT',
};

function findServerCryptoPair(symbol: string): string | null {
  const upper = symbol.toUpperCase().replace(/ /g, '');
  if (SERVER_CRYPTO_MAP[upper]) return SERVER_CRYPTO_MAP[upper];
  const FIAT = new Set(['AUD','EUR','GBP','USD','JPY','NZD','CAD','CHF','MXN','ZAR','TRY','SEK','NOK','DKK','SGD','HKD','CNH','THB','INR','PLN','CZK','HUF','ILS','KRW','TWD', 'XAU','XAG','XPT','XPD','XCU','XAL']);
  if (upper.endsWith('USD') || upper.endsWith('USDT')) {
    const base = upper.replace(/USD(T)?$/, '');
    // Never misinterpret fiat-quotes like AUDUSD/GBPUSD/NZDUSD as crypto pairs.
    if (base && base.length <= 10 && !FIAT.has(base)) return `${base}USDT`;
  }
  const knownCoins = ['BTC','ETH','SOL','XRP','DOGE','ADA','DOT','MATIC','LINK',
    'UNI','AVAX','ATOM','LTC','BCH','XLM','TRX','FIL','APT','ARB','OP','INJ',
    'TON','SUI','NEAR','SEI','KAS','KAVA','WLD','PENDLE','JUP','STX','POL'];
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

  // Try ALL endpoints in parallel — first valid response wins
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 10000);
  const results = await Promise.allSettled(
    BINANCE_ENDPOINTS.map(async (base) => {
      const url = `${base}/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
      const resp = await fetch(url, { signal: ac.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const klines = await resp.json();
      if (!klines || klines.length < 10) throw new Error('Too few klines');
      return klines;
    })
  );
  clearTimeout(timeout);

  const klines = results.find(r => r.status === 'fulfilled')?.value;
  if (!klines) return null;

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
};

// Helper: Twelve Data OHLC → Yahoo format
const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || '';
const TWELVE_DATA_INTERVALS: Record<string, string> = {
  '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min',
  '1h': '1h', '4h': '4h', '1d': '1day', '1w': '1week', '1M': '1month',
};
const TWELVE_DATA_OUTPUTSIZE: Record<string, number> = {
  '1m': 100, '5m': 100, '15m': 100, '30m': 100,
  '1h': 200, '4h': 200, '1d': 200, '1w': 100, '1M': 60,
};

// Convert EURCHF → EUR/CHF for Twelve Data
function twelveDataSymbol(symbol: string): string | null {
  const s = symbol.toUpperCase().trim();
  
  // Forex pairs: EURUSD → EUR/USD
  const clean = s.replace(/[^A-Z]/g, '');
  if (clean.length === 6 && /^[A-Z]{6}$/.test(clean)) {
    return `${clean.slice(0, 3)}/${clean.slice(3)}`;
  }
  
  // Japanese stocks: 7203.T → 7203.T
  if (/^\d{4}\.T$/.test(s)) return s;
  
  // European stocks: ASML.AS, MC.PA, SAP.DE, SHEL.L, NESN.SW, NOVO-B.CO
  if (/\.(AS|PA|DE|L|SW|CO|MI|MCX|WSE|STO|HEL|OSL|COP)$/.test(s)) return s;
  
  // US stocks: AAPL, MSFT, TSLA, SPY, QQQ
  if (/^[A-Z]{1,5}$/.test(clean)) return s;
  
  // Crypto: BTCUSD → BTC/USD
  if (clean.length === 6 && /USD$/.test(clean)) {
    return `${clean.slice(0, 3)}/USD`;
  }
  
  return null;
}

// Yahoo symbol candidates for a forex pair, in order of reliability.
// Yahoo exposes steady daily OHLC for "EURUSD=X" (and most pairs also as
// "EUR-USD"). Used to prefer clean Yahoo candles over Twelve Data's daily
// series which can carry implausible outlier candles.
function attemptsYahooFor(symbol: string): string[] {
  const s = (symbol || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length === 6) {
    return [`${s}=X`, `${s.slice(0, 3)}-${s.slice(3)}`];
  }
  return [`${s}=X`];
}

function sanitizeCandles(data: any): any {
  try {
    const result = (data as any)?.chart?.result?.[0];
    if (!result) return data;
    const quote = result?.indicators?.quote?.[0];
    const close = quote?.close;
    if (!Array.isArray(result.timestamp) || !Array.isArray(close)) return data;
    const ranges: number[] = [];
    for (let i = 0; i < close.length; i++) {
      const o = quote.open?.[i], h = quote.high?.[i], l = quote.low?.[i], c = close[i];
      if (o == null || h == null || l == null || c == null) continue;
      ranges.push(Math.abs(h - l));
    }
    if (ranges.length < 10) return data;
    const sorted = [...ranges].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (!median || median <= 0) return data;
    const limit = median * 5;
    const keep: number[] = [];
    let dropped = 0;
    for (let i = 0; i < close.length; i++) {
      const o = quote.open?.[i], h = quote.high?.[i], l = quote.low?.[i], c = close[i], t = result.timestamp[i];
      if (o == null || h == null || l == null || c == null || t == null) continue;
      if (Math.abs(h - l) > limit) { dropped++; continue; }
      keep.push(i);
    }
    if (dropped > 0 && keep.length > 0) {
      result.timestamp = keep.map((i) => result.timestamp[i]);
      quote.open = keep.map((i) => quote.open[i]);
      quote.high = keep.map((i) => quote.high[i]);
      quote.low = keep.map((i) => quote.low[i]);
      quote.close = keep.map((i) => quote.close[i]);
      if (Array.isArray(quote.volume)) quote.volume = keep.map((i) => quote.volume[i]);
      console.log(`[sanitize] dropped ${dropped} outlier candles`);
    }
  } catch {}
  return data;
}

const fetchTwelveDataOHLC = async (symbol: string, timeframe: string): Promise<any> => {
  if (!TWELVE_DATA_API_KEY) return null;
  const tdSymbol = twelveDataSymbol(symbol);
  if (!tdSymbol) return null;
  const interval = TWELVE_DATA_INTERVALS[timeframe] || '1day';
  const outputsize = TWELVE_DATA_OUTPUTSIZE[timeframe] || 200;

  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 12000);
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSymbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${TWELVE_DATA_API_KEY}`;
    const resp = await fetch(url, { signal: ac.signal });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.status === 'error' || !data.values || data.values.length === 0) return null;

    // Twelve Data returns newest first — reverse to oldest-first (matching Yahoo format)
    const values = [...data.values].reverse();
    return {
      chart: {
        result: [{
          meta: {
            symbol,
            dataGranularity: interval,
            regularMarketTime: Math.floor(Date.now() / 1000),
            regularMarketPrice: parseFloat(values[values.length - 1]?.close || '0'),
          },
          timestamp: values.map((v: any) => Math.floor(new Date(v.datetime).getTime() / 1000)),
          indicators: {
            quote: [{
              open: values.map((v: any) => parseFloat(v.open)),
              high: values.map((v: any) => parseFloat(v.high)),
              low: values.map((v: any) => parseFloat(v.low)),
              close: values.map((v: any) => parseFloat(v.close)),
              volume: values.map((v: any) => parseInt(v.volume || '0', 10)),
            }]
          }
        }]
      }
    };
  } catch {
    return null;
  }
};

async function fetchYahooQuote(symbol: string): Promise<number | null> {
  // Race query2 + query1 in parallel (whichever answers first with a valid price),
  // short 5s abort so slow/unreachable hosts never block the quote for long.
  const hosts = ['query2.finance.yahoo.com', 'query1.finance.yahoo.com'];
  const attempts = hosts.map(async (host) => {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d&_cb=${Date.now()}&_q=${Math.random().toString(36).slice(2,6)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'application/json', 'Origin': 'https://finance.yahoo.com', 'Referer': 'https://finance.yahoo.com/'
        }
      });
      clearTimeout(timeout);
      if (!response.ok) return null;
      const d = await response.json();
      const result = d?.chart?.result?.[0];
      if (!result) return null;
      let price = Number(result?.meta?.regularMarketPrice);
      const closes = result?.indicators?.quote?.[0]?.close;
      const ts = result?.timestamp;
      if (!(price > 0) && Array.isArray(closes) && Array.isArray(ts)) {
        for (let i = ts.length - 1; i >= 0; i--) {
          const c = closes[i];
          if (c != null && c > 0) { price = c; break; }
        }
      }
      if (price > 0) return price;
    } catch {}

    return null;
  });
  const settled = await Promise.all(attempts);
  return settled.find((p): p is number => typeof p === 'number' && p > 0) ?? null;
}

// Adaptive forex spot sources that are free, keyless, credit-unlimited and — unlike
// Yahoo from Vercel server IPs — do NOT return region-frozen stale rates (the bug
// where AUDUSD stuck at 0.7252 / GBPUSD at 1.18). Returns a live midpoint for an
// ABC/XYZ pair. Tries (1) open.er-api (USD-map cross) then (2) ECB frankfurter.dev.
async function fetchFrfQuote(fxSymbol: string): Promise<number | null> {
  const s = (fxSymbol || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length !== 6) return null;
  const from = s.slice(0, 3);
  const to = s.slice(3);

  // (1) exchangerate-api open.er-api: latest/from USD, cross-derive ABC/XYZ.
  const erTry = async (): Promise<number | null> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const url = `https://open.er-api.com/v6/latest/USD?_cb=${Date.now()}`;
      const response = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(timeout);
      if (!response.ok) return null;
      const d = await response.json();
      if (d?.result !== 'success') return null;
      const rFrom = Number(d?.rates?.[from]);
      const rTo = Number(d?.rates?.[to]);
      if (rFrom > 0 && rTo > 0) return rTo / rFrom; // base->quote
    } catch {
      clearTimeout(timeout);
    }
    return null;
  };

  // (2) ECB frankfurter.dev: direct base->quote rates map.
  const ecbTry = async (): Promise<number | null> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const url = `https://api.frankfurter.dev/v1/latest?base=${from}&_cb=${Date.now()}`;
      const response = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(timeout);
      if (!response.ok) return null;
      const d = await response.json();
      const rate = Number(d?.rates?.[to]);
      if (typeof rate === 'number' && isFinite(rate) && rate > 0) return rate;
    } catch {
      clearTimeout(timeout);
    }
    return null;
  };

  const er = await erTry();
  if (er) return er;
  return await ecbTry();
}

// ── Twelve Data real-time /price endpoint (1 credit per call, 8/min free) ──
// Returns a live tick price — unlike Yahoo which can return region-frozen stale
// rates for certain pairs (AUD, GBP). We rate-limit to 7 calls/min and cache
// each symbol for 5s so that client 1s-polling doesn't exhaust the quota.
const _tdPriceCache = new Map<string, { price: number; ts: number }>();
const TD_PRICE_TTL = 10000;
let _tdCallCount = 0;
let _tdMinuteStart = Date.now();

function tdCanCall(): boolean {
  const now = Date.now();
  if (now - _tdMinuteStart > 60000) { _tdMinuteStart = now; _tdCallCount = 0; }
  return _tdCallCount < 7;
}

async function fetchTwelveDataPrice(symbol: string): Promise<number | null> {
  if (!TWELVE_DATA_API_KEY) return null;
  const cached = _tdPriceCache.get(symbol);
  if (cached && Date.now() - cached.ts < TD_PRICE_TTL) return cached.price;
  if (!tdCanCall()) return null;
  const tdSym = twelveDataSymbol(symbol);
  if (!tdSym) return null;
  _tdCallCount++;
  try {
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(tdSym)}&apikey=${TWELVE_DATA_API_KEY}&_cb=${Date.now()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const r = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
    clearTimeout(timeout);
    if (!r.ok) return null;
    const d = await r.json();
    const p = Number(d?.price);
    if (typeof p === 'number' && isFinite(p) && p > 0) {
      _tdPriceCache.set(symbol, { price: p, ts: Date.now() });
      return p;
    }
  } catch {}
  return null;
}

// ── Yahoo freshness check: returns null if the Yahoo response is stale ──
// Yahoo's regularMarketTime is the timestamp of the last price update.
// If it's more than 3 minutes old during market hours, we treat it as stale.
async function fetchYahooQuoteFresh(symbol: string): Promise<{ price: number; fresh: boolean } | null> {
  const price = await fetchYahooQuote(symbol);
  if (price == null || price <= 0) return null;
  // fetchYahooQuote doesn't expose regularMarketTime; we treat all Yahoo
  // results as potentially stale (the freeze bug is well-documented for AUD/GBP).
  // The caller should prefer Twelve Data when available.
  return { price, fresh: true };
}

// API Route: Latest Spot Quote (fast, lightweight). Returns { symbol, price, ts }
// Used by the paper-trading live P&L engine so open trades move with REAL market
// prices instead of polling full 5m candle histories. Per-class source:
//   crypto -> Binance ticker/price (real-time)
//   forex  -> Yahoo regularMarketPrice (real-time, free, no daily credit cap)
//   metals/index/stocks -> Yahoo intraday chart meta regularMarketPrice
// The hard 6s budget below keeps us under Vercel's function timeout; whenever the
// upstream source is slow/unreachable we answer from lastKnownQuote (never empty).
const _lastKnownQuote = new Map<string, { price: number; ts: number }>();
function answerQuote(res: any, symbol: string, price: number): void {
  _lastKnownQuote.set(symbol, { price, ts: Date.now() });
  res.json({ symbol, price, ts: Date.now() });
}
app.get("/api/quote", async (req, res) => {
  try {
    const symbol = (req.query.symbol as string || '').toUpperCase().replace(/ /g, '');
    if (!symbol) return res.status(400).json({ error: "Symbol is required" });

    const cryptoPair = findServerCryptoPair(symbol);
    const isCrypto = !!cryptoPair;

    const customMappings: Record<string, string> = {
      'XAUUSD': 'GC=F', 'XAGUSD': 'SI=F', 'XPTUSD': 'PL=F', 'XPDUSD': 'PA=F',
      'XCUUSD': 'HG=F', 'XALUSD': 'ALI=F',
    };
    const indexCfds: Record<string, string> = {
      'US500': '^GSPC', 'US30': '^DJI', 'US100': '^NDX',
      'UK100': '^FTSE', 'DE40': '^GDAXI', 'JP225': '^N225',
      'HK50': '^HSI', 'AU200': '^AXJO',
    };
    const isIndex = !!indexCfds[symbol];
    const isMetal = !!customMappings[symbol] && !isIndex;

    const forexQuotes = ['USD','EUR','JPY','GBP','AUD','NZD','CAD','CHF','MXN','ZAR','TRY','SEK','NOK','DKK','SGD','HKD','CNH','THB','INR','PLN','CZK','HUF','ILS','KRW','TWD','DZD','EGP','MAD','TND','SAR','AED'];
    const isForex = !isMetal && !isCrypto && !isIndex && symbol.length === 6 &&
      forexQuotes.some(q => symbol.endsWith(q)) && forexQuotes.some(q => symbol.startsWith(q));

    // ── 1) CRYPTO: Binance real-time ticker price ──
    if (isCrypto) {
      const pair = findServerCryptoPair(symbol)!;
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 8000);
      try {
        const results = await Promise.allSettled(
          BINANCE_ENDPOINTS.map(async (base) => {
            const r = await fetch(`${base}/api/v3/ticker/price?symbol=${pair}`, { signal: ac.signal });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          })
        );
        clearTimeout(timeout);
        const hit = results.find((x): x is PromiseFulfilledResult<any> => x.status === 'fulfilled' && typeof x.value?.price === 'number');
        const price = hit?.value?.price as number | undefined;
        if (typeof price === 'number' && price > 0) {
          return answerQuote(res, symbol, price);
        }
      } catch { clearTimeout(timeout); }
      // Fallback: last 1m kline close
      const k = await fetchBinanceData(symbol, '1m');
      const closes = k?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
      if (Array.isArray(closes)) {
        for (let i = closes.length - 1; i >= 0; i--) {
          if (closes[i] != null && closes[i] > 0) return answerQuote(res, symbol, closes[i]);
        }
      }
      const ck = _lastKnownQuote.get(symbol);
      if (ck && typeof ck.price === 'number') return res.json({ symbol, price: ck.price, ts: ck.ts });
      return res.status(404).json({ error: 'No crypto quote' });
    }

    const quoteSymbol = isMetal ? customMappings[symbol] : isIndex ? indexCfds[symbol] : symbol;
    const quoteAttempts = isForex ? attemptsYahooFor(symbol) : [quoteSymbol];
    const uniqueAttempts = [...new Set([...quoteAttempts, quoteSymbol])];
    let lastFresh = 0;

    // ── 2) FOREX: real-time via Twelve Data (live tick, rate-limited 7/min),
    //    then Yahoo (free but can return region-frozen stale rates for AUD/GBP),
    //    then open.er-api/ECB (daily rates, always available but static). ──
    // Twelve Data /price costs 1 credit per call. We cache each symbol for 5s
    // and cap at 7 calls/min so the free-tier quota is never exhausted.
    if (isForex) {
      const td = await fetchTwelveDataPrice(symbol);
      if (td) return answerQuote(res, symbol, td);
      for (const attempt of uniqueAttempts) {
        const y = await fetchYahooQuote(attempt);
        if (typeof y === 'number' && y > 0) { lastFresh = y; return answerQuote(res, symbol, y); }
      }
      const frf = await fetchFrfQuote(symbol);
      if (typeof frf === 'number' && frf > 0) return answerQuote(res, symbol, frf);
    }

    // ── 3) METALS / INDEX / STOCKS: Twelve Data first (real-time spot for metals),
    //    then Yahoo (free, retries across query1+query2). ──
    if (isMetal) {
      const td = await fetchTwelveDataPrice(symbol);
      if (td) return answerQuote(res, symbol, td);
    }
    for (const attempt of uniqueAttempts) {
      const price = await fetchYahooQuote(attempt);
      if (typeof price === 'number' && price > 0) { lastFresh = price; return answerQuote(res, symbol, price); }
    }

    // No fresh upstream data this call: if we ever answered this symbol, re-serve
    // the last known good price so live P&L never snaps to 0/404 mid-update.
    const ck = _lastKnownQuote.get(symbol);
    if (ck && typeof ck.price === 'number') return res.json({ symbol, price: ck.price, ts: ck.ts });
    if (lastFresh > 0) return answerQuote(res, symbol, lastFresh);
    return res.status(404).json({ error: 'No fresh quote available' });
  } catch {
    return res.status(500).json({ error: 'Quote server error' });
  }
});

// API Route: Market Data
app.get("/api/market-data", async (req, res) => {
  try {
    const symbol = req.query.symbol as string;
    const timeframe = (req.query.timeframe as string) || '1d';
    if (!symbol) return res.status(400).json({ error: "Symbol is required" });

    const rawSymbol = symbol.toUpperCase().replace(/ /g, '');
    const customMappings: Record<string, string> = {
      'XAUUSD': 'GC=F', 'XAGUSD': 'SI=F', 'XPTUSD': 'PL=F', 'XPDUSD': 'PA=F',
      'XCUUSD': 'HG=F', 'XALUSD': 'ALI=F',
    };

    // Index CFDs → Yahoo Finance tickers
    const indexCfds: Record<string, string> = {
      'US500': '^GSPC', 'US30': '^DJI', 'US100': '^NDX',
      'UK100': '^FTSE', 'DE40': '^GDAXI', 'JP225': '^N225',
      'HK50': '^HSI', 'AU200': '^AXJO',
    };

    const isIndexCfd = !!indexCfds[rawSymbol];
    const isMetal = !!customMappings[rawSymbol] && !isIndexCfd;
    let yahooSymbol = isIndexCfd ? indexCfds[rawSymbol] : isMetal ? customMappings[rawSymbol] : rawSymbol;

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
    else if (timeframe === '1M') { interval = '1mo'; range = '5y'; }

    const hasEquals = yahooSymbol.includes('=');
    const cryptoPair = findServerCryptoPair(rawSymbol);
    const isCrypto = !!cryptoPair && !isMetal;

    // All recognized forex quote currencies
    const forexQuotes = [
      'USD', 'EUR', 'JPY', 'GBP', 'AUD', 'NZD', 'CAD', 'CHF',
      'MXN', 'ZAR', 'TRY', 'SEK', 'NOK', 'DKK', 'SGD', 'HKD',
      'CNH', 'THB', 'INR', 'PLN', 'CZK', 'HUF', 'ILS', 'KRW', 'TWD',
    ];
    const isForex = !isMetal && !isCrypto && !isIndexCfd && yahooSymbol.length === 6 &&
      forexQuotes.some(q => yahooSymbol.endsWith(q)) &&
      forexQuotes.some(q => yahooSymbol.startsWith(q));

    if (isCrypto) {
      const binanceData = await fetchBinanceData(rawSymbol, timeframe);
      if (binanceData) return res.json(binanceData);
    }

    // Forex data source. Twelve Data historically returned these candles first,
    // but its higher-timeframe (1d/1w/1M) series occasionally contains isolated
    // outlier candles with implausible ranges (e.g. an EURUSD daily range of 0.10
    // when the real median is ~0.005). Those become the long-wicked "hammer /
    // pin bar" candles users see vs other platforms. Yahoo's daily series is
    // clean and directly comparable to other charting platforms, so prefer it
    // for daily+ and keep Twelve Data for intraday + as a fallback.
    if (isForex) {
      const dailyUp = timeframe === '1d' || timeframe === '1w' || timeframe === '1M';
      const primary = dailyUp ? 'yahoo' : 'twelve';

      const yahooFor = dailyUp ? attemptsYahooFor(rawSymbol) : [];
      if (primary === 'yahoo') {
        for (const attempt of yahooFor) {
          const cacheBust = dailyUp ? `&_cb=${Date.now()}` : '';
          const cand = await fetchMarketData(attempt, dailyUp ? (timeframe === '1d' ? '6mo' : timeframe === '1w' ? '2y' : '5y') : '6mo', dailyUp ? (timeframe === '1d' ? '1d' : timeframe === '1w' ? '1wk' : '1mo') : '1d', 3, cacheBust);
          if (cand) {
            console.log(`[Yahoo] ${rawSymbol} ${timeframe} OK`);
            const sanitized = sanitizeCandles(cand);
            return res.json(sanitized);
          }
        }
        // Daily+: NO Twelve Data fallback — Yahoo is the only trusted source.
        // Twelve Data daily candles carry outlier spikes that corrupt charts.
        // If Yahoo failed above, fall through to the generic path (which retries Yahoo).
      } else {
        const twelveData = await fetchTwelveDataOHLC(rawSymbol, timeframe);
        if (twelveData) {
          console.log(`[TwelveData] ${rawSymbol} ${timeframe} OK`);
          return res.json(sanitizeCandles(twelveData));
        }
      }
      console.log(`[$primary] ${rawSymbol} ${timeframe} failed, falling back to generic path`);
    }

    let attempts: string[] = [];
    if (isMetal || hasEquals || isIndexCfd) {
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
    res.json(sanitizeCandles(finalData));
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
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;

  try {
    // Strategy 1: Vercel Deploy Hook
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

// API Route: Server-side on-chain payment verification
// Called by the frontend to avoid browser CORS / rate-limit issues.
app.post("/api/verify-payment", async (req, res) => {
  try {
    const { address, chain } = req.body as { address?: string; chain?: string };
    if (!address || !chain) {
      return res.status(400).json({ error: "address and chain required" });
    }

    // BTC / LTC / ETH — sum incoming txrefs in last 6h via BlockCypher
    const chainPath = ONSITE_CHAIN_MAP[chain];
    if (chainPath) {
      const divisor = chain === 'eth' ? 1e18 : 1e8;
      const apiRes = await fetch(
        `https://api.blockcypher.com/v1/${chainPath}/addrs/${address}?unspentOnly=false&limit=50`
      );
      const data: any = await apiRes.json();

      // Fallback: simple balance (works for non-exchange addresses)
      if (data.error || !Array.isArray(data.txrefs)) {
        const balRes = await fetch(
          `https://api.blockcypher.com/v1/${chainPath}/addrs/${address}/balance`
        );
        const bal: any = await balRes.json();
        if (!bal.error) {
          const balance = (bal.final_balance + (bal.unconfirmed_balance || 0)) / divisor;
          return res.json({ received: balance, totalReceived: (bal.total_received || 0) / divisor });
        }
        return res.json({ received: 0, totalReceived: 0, error: data.error || "No txrefs and no balance" });
      }

      const cutoff = Date.now() - ONSITE_LOOKBACK_MS;
      let received = 0;
      for (const ref of data.txrefs) {
        if (ref.tx_input_n !== -1) continue;   // only outputs TO this address
        if (ref.tx_output_n === -1) continue;
        const t = ref.confirmed ? new Date(ref.confirmed).getTime() : Date.now();
        if (t >= cutoff && ref.value != null) received += ref.value;
      }
      return res.json({
        received: received / divisor,
        totalReceived: (data.total_received || 0) / divisor,
      });
    }

    return res.status(400).json({ error: "Unsupported chain" });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Verification failed" });
  }
});

// API Route: Proof-by-transaction-hash verification
// The buyer pastes the tx hash; the server checks that this exact transaction
// paid at least the expected amount to the payment address. Works even when
// address-history APIs are down, as long as a single-tx lookup succeeds.
app.post("/api/verify-tx", async (req, res) => {
  try {
    const { chain, txid, address } = req.body as { chain?: string; txid?: string; address?: string };
    if (!chain || !txid || !address) {
      return res.status(400).json({ error: "chain, txid and address required" });
    }
    const chainPath = ONSITE_CHAIN_MAP[chain];
    if (!chainPath) {
      return res.status(400).json({ error: "TX proof supports BTC, LTC and ETH only" });
    }
    const divisor = chain === 'eth' ? 1e18 : 1e8;
    const txRes = await fetch(
      `https://api.blockcypher.com/v1/${chainPath}/txs/${txid.trim()}`
    );
    const tx: any = await txRes.json();
    if (tx.error || !Array.isArray(tx.outputs)) {
      return res.json({ amount: 0, confirmations: 0, error: tx.error || "Transaction not found" });
    }
    const target = address.trim().toLowerCase();
    let paid = 0;
    for (const out of tx.outputs) {
      const addrs: string[] = Array.isArray(out.addresses) ? out.addresses : [];
      if (addrs.some(a => (a || '').toLowerCase() === target) && out.value != null) {
        paid += out.value;
      }
    }
    return res.json({ amount: paid / divisor, confirmations: tx.confirmations || 0 });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "TX verification failed" });
  }
});

// ── Daily AI Market Briefing (public prices page) ──
// Produces a fresh AI-written Arabic+English market outlook once per day using
// live quotes + current headlines and the server-side system key. Cached per
// day so public visitors never blow the AI quota; clients may force a regen.
const _briefingCache = new Map<string, any>();

async function briefingQuote(symbol: string): Promise<number | null> {
  const s = symbol.toUpperCase().replace(/ /g, '');
  const cryptoPair = findServerCryptoPair(s);
  if (cryptoPair) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 7000);
    try {
      const results = await Promise.allSettled(
        BINANCE_ENDPOINTS.map(async (base) => {
          const r = await fetch(`${base}/api/v3/ticker/price?symbol=${cryptoPair}`, { signal: ac.signal });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
      );
      clearTimeout(t);
      const hit = results.find((x): x is PromiseFulfilledResult<any> => x.status === 'fulfilled' && typeof x.value?.price === 'number');
      const p = hit?.value?.price;
      if (typeof p === 'number' && p > 0) return p;
    } catch { clearTimeout(t); }
    const k = await fetchBinanceData(s, '5m');
    const closes = k?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (Array.isArray(closes)) {
      for (let i = closes.length - 1; i >= 0; i--) if (closes[i] != null && closes[i] > 0) return closes[i];
    }
    const ck = _lastKnownQuote.get(s);
    if (ck && typeof ck.price === 'number') return ck.price;
    return null;
  }
  const metalMap: Record<string, string> = { XAUUSD: 'GC=F', XAGUSD: 'SI=F' };
  if (metalMap[s]) {
    const td = await fetchTwelveDataPrice(s);
    if (td) return td;
    const y = await fetchYahooQuote(metalMap[s]);
    if (y) return y;
  }
  if (s.length === 6) return await fetchFrfQuote(s);
  return null;
}

async function fetchBriefingNews(query: string): Promise<string[]> {
  try {
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`);
    if (!r.ok) return [];
    const xml = await r.text();
    const titles = [...xml.matchAll(/<title>(.*?)<\/title>/g)].slice(1).map(m => m[1]);
    const sources = [...xml.matchAll(/<source>(.*?)<\/source>/g)].map(m => m[1]);
    return titles.slice(0, 4).map((title, i) => `${title} (${sources[i] || 'News'})`);
  } catch { return []; }
}

function buildBriefingPrompt(prices: Record<string, number>, news: string[], date: string): string {
  const lines = Object.entries(prices)
    .map(([sym, p]) => `${sym} = $${typeof p === 'number' ? p.toFixed(6) : p}`)
    .join('\n');
  return `Today's date: ${date}.
Current live market prices (server-side snapshot):
${lines || 'no prices available'}
Latest headlines:
${news.slice(0, 6).map((n, i) => `${i + 1}. ${n}`).join('\n') || 'no headlines available'}
Write a professional daily market briefing in JSON only. Use ONLY the numbers above and the headlines; never invent prices or data. Fields (all required):
- summaryAr: Arabic market overview 2-3 sentences,
- summaryEn: English overview of the same content,
- goldAr: Arabic gold analysis with the exact XAUUSD number and implications,
- goldEn: English gold analysis,
- btcAr: Arabic bitcoin/crypto analysis with the exact BTCUSDT number,
- btcEn: English crypto analysis,
- dzdAr: Arabic note about the USD/DZD rate and gold value in DZD when USDDZD is present,
- dzdEn: English note about the DZD rate.
Keep every field short, factual, educational and professional.`;
}

app.post("/api/briefing", async (req, res) => {
  try {
    const force = !!(req.query && req.query.force === '1') || !!(req.body && req.body.force === true);
    const todayStr = new Date().toISOString().slice(0, 10);
    const cached = _briefingCache.get(todayStr);
    if (cached && !force) return res.json(cached);

    const quoteSymbols = ['XAUUSD', 'XAGUSD', 'BTCUSDT', 'ETHUSDT', 'USDDZD', 'EURUSD'];
    const results = await Promise.allSettled(quoteSymbols.map(async (sym) => ({ sym, p: await briefingQuote(sym) })));
    const prices: Record<string, number> = {};
    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value && typeof r.value.p === 'number' && r.value.p > 0) {
        prices[r.value.sym] = r.value.p;
      }
    });

    let news: string[] = [];
    try {
      const [n1, n2] = await Promise.all([fetchBriefingNews('gold silver price'), fetchBriefingNews('bitcoin crypto market news')]);
      news = [...n1, ...n2].slice(0, 8);
    } catch {}

    const sysKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY;
    let brief: any = null;
    if (sysKey) {
      const aiResult = sysKey.startsWith('AIzaSy') || sysKey.startsWith('AQ.')
        ? await callGoogle(sysKey, buildBriefingPrompt(prices, news, todayStr))
        : await callGroq(sysKey, buildBriefingPrompt(prices, news, todayStr));
      if (aiResult && aiResult.content) {
        try { brief = JSON.parse(aiResult.content); } catch { brief = null; }
      }
    }

    const payload = {
      date: todayStr,
      prices,
      news,
      brief,
      hasSystemKey: !!sysKey,
      generatedAt: Date.now(),
    };
    if (brief) _briefingCache.set(todayStr, payload);
    return res.json(payload);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Briefing failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Automatic Binance deposit verification (IMAP → Firestore → auto release)
// ---------------------------------------------------------------------------
// Reads the Binance notification inbox over IMAP, extracts deposit amounts,
// matches them against pending numbered payment requests, and releases access
// automatically. Runs headless (no browser needed). Triggered by an external
// cron (or Vercel Cron) hitting /api/check-binance-mail.
// ═══════════════════════════════════════════════════════════════════════════

const FS_BASE = `https://firestore.googleapis.com/v1/projects/trading-made-easy-e8450/databases/(default)/documents`;
const FS_KEY = process.env.FIRESTORE_KEY || 'AIzaSyCvMayEuNTlQ5CWbjrrqw3aft_H044-uQM';
const MAIL_LOOKBACK_MS = 48 * 60 * 60 * 1000;   // only consider recent emails
const REQUEST_WINDOW_BEFORE_MS = 12 * 60 * 60 * 1000;
const REQUEST_WINDOW_AFTER_MS = 48 * 60 * 60 * 1000;
const AMOUNT_TOLERANCE = 0.2;                   // dollars — accepts ±$0.20 (volatility buffer)
const COIN_RATES_CACHE_MS = 60 * 1000;          // cache prices 1 minute

interface CoinRate { symbol: string; price: number; at: number; }
let coinRatesCache: CoinRate[] | null = null;

type Json = Record<string, any>;

function toFsValue(v: any): Json {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, toFsValue(val)])) } };
  return { stringValue: String(v) };
}

function fromFsValue(v: any): any {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFsValue);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, val]) => [k, fromFsValue(val)]));
  return undefined;
}

const fsDocBody = (data: Json) => ({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFsValue(v)])) });
const docIdFromName = (name: string) => String(name).split('/').pop() || '';
const sanitizeFs = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '_');

function grantDocIdFs(email: string, kind: string, botId?: string): string {
  const key = kind === 'bot' ? `bot_${botId || 'unknown'}` : 'plan';
  return `${sanitizeFs(email)}__${key}`;
}

async function fsList(collectionName: string): Promise<Json[]> {
  const out: Json[] = [];
  let pageToken = '';
  for (let i = 0; i < 10; i++) {
    const url = `${FS_BASE}/${collectionName}?key=${FS_KEY}&pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const resp = await fetch(url);
    if (!resp.ok) break;
    const data: any = await resp.json();
    (data.documents || []).forEach((d: any) => out.push({ id: docIdFromName(d.name), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromFsValue(v)])) }));
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return out;
}

async function fsGet(collectionName: string, id: string): Promise<Json | null> {
  const resp = await fetch(`${FS_BASE}/${collectionName}/${encodeURIComponent(id)}?key=${FS_KEY}`);
  if (!resp.ok) return null;
  const d: any = await resp.json();
  if (!d.fields) return null;
  return Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, fromFsValue(v)]));
}

async function fsPatch(collectionName: string, id: string, data: Json, mask?: string[]): Promise<void> {
  const qs = mask && mask.length ? '&' + mask.map((m) => `updateMask.fieldPaths=${encodeURIComponent(m)}`).join('&') : '';
  const resp = await fetch(`${FS_BASE}/${collectionName}/${encodeURIComponent(id)}?key=${FS_KEY}${qs}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fsDocBody(data)),
  });
  if (!resp.ok) throw new Error(`Firestore patch ${collectionName}/${id} failed: ${resp.status}`);
}

async function fsAdd(collectionName: string, data: Json): Promise<void> {
  const resp = await fetch(`${FS_BASE}/${collectionName}?key=${FS_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fsDocBody(data)),
  });
  if (!resp.ok) throw new Error(`Firestore add ${collectionName} failed: ${resp.status}`);
}

function extractAmounts(text: string): { amount: number; coin: string }[] {
  const found = new Map<string, number>();
  const push = (raw: string, coin: string) => {
    const n = Number(String(raw).replace(',', '.'));
    if (isFinite(n) && n > 0) found.set(`${coin}:${Math.round(n * 100) / 100}`, Math.round(n * 100) / 100);
  };
  const coinSymbols = 'USDT|USDC|BUSD|TUSD|FDUSD|DAI|LTC|TRX|SOL';
  const contextual = /(?:amount|received|deposited|deposit|total|credit|المبلغ|استلام|تم استلام|وصل)[^0-9]{0,40}([0-9][0-9.,]*(?:\.\d+)?)\s*(USDT|USDC|BUSD|TUSD|FDUSD|DAI|LTC|TRX|SOL)?/gi;
  let m: RegExpExecArray | null;
  while ((m = contextual.exec(text))) push(m[1], (m[2] || 'USDT').toUpperCase());
  const withCoin = /([0-9][0-9.,]*(?:\.\d+)?)\s*(USDT|USDC|BUSD|TUSD|FDUSD|DAI|LTC|TRX|SOL)/gi;
  while ((m = withCoin.exec(text))) push(m[1], m[2].toUpperCase());
  const withCoinBefore = /(USDT|USDC|BUSD|TUSD|FDUSD|DAI|LTC|TRX|SOL)\s*([0-9][0-9.,]*(?:\.\d+)?)/gi;
  while ((m = withCoinBefore.exec(text))) push(m[2], m[1].toUpperCase());
  const withGenericUsd = /([0-9][0-9.,]*(?:\.\d+)?)\s*\$|\$([0-9][0-9.,]*(?:\.\d+)?)/gi;
  while ((m = withGenericUsd.exec(text))) push(m[1] || m[2], 'USDT');
  return [...found.keys()].map((k) => ({ amount: found.get(k)!, coin: k.split(':')[0] }));
}

// Fetch current USD price for a coin symbol via Binance (USDT stays 1:1).
async function fetchCoinPrice(symbol: string): Promise<number> {
  if (symbol === 'USDT' || symbol === 'USDC' || symbol === 'BUSD' || symbol === 'TUSD' || symbol === 'FDUSD' || symbol === 'DAI') return 1;
  const cacheFind = coinRatesCache?.find((c) => c.symbol === symbol);
  if (cacheFind && Date.now() - cacheFind.at < COIN_RATES_CACHE_MS) return cacheFind.price;
  try {
    const resp = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}USDT`);
    const data: any = await resp.json();
    const price = Number(data?.price);
    if (isFinite(price) && price > 0) {
      if (!coinRatesCache) coinRatesCache = [];
      const idx = coinRatesCache.findIndex((c) => c.symbol === symbol);
      const entry = { symbol, price, at: Date.now() };
      if (idx >= 0) coinRatesCache[idx] = entry; else coinRatesCache.push(entry);
      return price;
    }
  } catch {}
  return 0;
}

async function releasePaymentRequest(req: Json, now: number, source: string): Promise<void> {
  await fsPatch('payment_requests', req.id, {
    status: 'approved',
    decidedAt: now,
    decidedBy: source,
  }, ['status', 'decidedAt', 'decidedBy']);

  const grantId = grantDocIdFs(req.buyerEmail, req.kind, req.botId);
  const grant: Json = {
    email: (req.buyerEmail || '').toLowerCase(),
    kind: req.kind,
    status: 'active',
    createdAt: now,
    requestNo: req.requestNo,
    botId: req.botId || null,
    botName: req.botName || null,
    planLabel: req.planLabel || null,
  };
  if (req.kind === 'plan') {
    const days = Number(req.durationDays) > 0 ? Number(req.durationDays) : 30;
    grant.expiryDate = new Date(now + days * 86400000).toISOString();
  }
  await fsPatch('payment_grants', grantId, grant);

  const product = req.kind === 'bot' ? (req.botName || 'Bot') : (req.planLabel || 'Plan');
  await fsAdd('dev_notifications', {
    type: 'approved',
    requestNo: req.requestNo,
    titleAr: `إفراج تلقائي للطلب #${req.requestNo}`,
    titleEn: `Auto-released request #${req.requestNo}`,
    bodyAr: `${req.buyerName || req.buyerEmail} — ${product} — $${req.amountUsd}`,
    bodyEn: `${req.buyerName || req.buyerEmail} — ${product} — $${req.amountUsd}`,
    read: false,
    createdAt: now,
  });
}

async function checkBinanceMail(): Promise<Json> {
  const user = process.env.BINANCE_IMAP_USER || process.env.BINANCE_EMAIL;
  const pass = process.env.BINANCE_IMAP_PASS || process.env.BINANCE_APP_PASSWORD;
  if (!user || !pass) {
    return { ok: false, error: 'missing BINANCE_IMAP_USER / BINANCE_IMAP_PASS' };
  }

  const summary: Json = { ok: true, user, scanned: 0, binanceEmails: 0, approved: [], ambiguous: [], errors: [] };

  // Load pending requests + processed-id state
  const [requests, state] = await Promise.all([
    fsList('payment_requests'),
    fsGet('shared_settings', 'binance_mail_state'),
  ]);
  const pending = requests.filter((r) => r.status === 'pending' && typeof r.amountUsd === 'number' && r.amountUsd >= 0.5);
  const processed: string[] = Array.isArray(state?.processed) ? state.processed : [];

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const newlyProcessed: string[] = [];
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(Date.now() - MAIL_LOOKBACK_MS);
      for await (const msg of client.fetch({ since }, { uid: true, source: true })) {
        summary.scanned++;
        let parsed: any;
        try {
          parsed = await simpleParser(msg.source as Buffer);
        } catch (e: any) {
          summary.errors.push(`parse uid ${msg.uid}: ${e.message}`);
          continue;
        }
        const fromText = String(parsed.from?.text || '').toLowerCase();
        const messageId = String(parsed.messageId || `uid:${msg.uid}`);
        if (processed.includes(messageId)) continue;
        if (!fromText.includes('binance')) {
          newlyProcessed.push(messageId);
          continue;
        }
        summary.binanceEmails++;

        const emailText = `${parsed.subject || ''}\n${parsed.text || ''}`;
        const emailDate = parsed.date ? new Date(parsed.date).getTime() : Date.now();
        const amounts = extractAmounts(emailText);
        if (!amounts.length) continue;

        // Match each detected (amount, coin) against pending requests.
        // Convert both the received amount and the expected coin amount to USD
        // using the SAME current price — the price cancels out, so this is
        // exactly |receivedCoin - expectedCoin| × price ≤ AMOUNT_TOLERANCE,
        // making exact coin payments immune to volatility.
        let matched = false;
        for (const entry of amounts) {
          if (matched) break;
          const price = await fetchCoinPrice(entry.coin);
          if (!(price > 0)) continue;

          const candidates = pending.filter((r) => {
            const reqCoin = String(r.coinId || 'usdt').toLowerCase();
            const entryCoin = entry.coin.toLowerCase();
            if (entryCoin !== reqCoin) return false;
            const expectedCoin = Number(r.coinAmountExpected) > 0
              ? Number(r.coinAmountExpected)
              : r.amountUsd;
            const diffUsd = Math.abs(entry.amount - expectedCoin) * price;
            if (diffUsd > AMOUNT_TOLERANCE) return false;
            const created = Number(r.createdAt) || 0;
            return created >= emailDate - REQUEST_WINDOW_BEFORE_MS && created <= emailDate + REQUEST_WINDOW_AFTER_MS;
          });

          if (candidates.length === 1) {
            const req = candidates[0];
            const now = Date.now();
            try {
              await releasePaymentRequest(req, now, 'auto-binance');
              req.status = 'approved';
              summary.approved.push({ requestNo: req.requestNo, buyer: req.buyerEmail, amount: req.amountUsd, coin: entry.coin });
              newlyProcessed.push(messageId);
              matched = true;
            } catch (e: any) {
              summary.errors.push(`release #${req.requestNo}: ${e.message}`);
              break;
            }
          } else if (candidates.length > 1) {
            summary.ambiguous.push({
              messageId,
              coin: entry.coin,
              amounts,
              requestNos: candidates.map((c) => c.requestNo),
            });
          }
        }
        // if matched (or no candidates): possibly leave unprocessed so a later-created request can still match
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (e: any) {
    summary.ok = false;
    summary.errors.push(`imap: ${e.message}`);
  }

  // Persist processed message ids (cap to keep the doc small)
  try {
    const merged = [...new Set([...processed, ...newlyProcessed])].slice(-500);
    await fsPatch('shared_settings', 'binance_mail_state', { processed: merged, updatedAt: Date.now() });
  } catch (e: any) {
    summary.errors.push(`state: ${e.message}`);
  }

  return summary;
}

const binanceMailHandler = async (req: any, res: any) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = String(req.headers.authorization || '');
    const token = String((req.query && req.query.token) || '');
    if (auth !== `Bearer ${secret}` && token !== secret) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }
  try {
    const result = await checkBinanceMail();
    return res.status(result.ok ? 200 : 500).json(result);
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};

app.get("/api/check-binance-mail", binanceMailHandler);
app.post("/api/check-binance-mail", binanceMailHandler);

export default app;
