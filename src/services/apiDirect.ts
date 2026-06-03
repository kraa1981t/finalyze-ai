const BINANCE_BASE = 'https://api.binance.com/api/v3';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const ALTERNATIVE_BASE = 'https://api.alternative.me';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GROQ_BASE = 'https://api.groq.com/openai/v1';

const TIMEFRAME_MAP: Record<string, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
  '1d': '1d', '3d': '3d', '1w': '1w', '1M': '1M',
};

const LIMIT_MAP: Record<string, number> = {
  '1m': 100, '5m': 100, '15m': 200, '30m': 200,
  '1h': 200, '2h': 200, '4h': 500, '6h': 500,
  '8h': 500, '12h': 500, '1d': 365, '3d': 365,
  '1w': 200, '1M': 200,
};

const CRYPTO_MAP: Record<string, string> = {
  'BTCUSD': 'BTCUSDT', 'ETHUSD': 'ETHUSDT', 'SOLUSD': 'SOLUSDT',
  'XRPUSD': 'XRPUSDT', 'DOGEUSD': 'DOGEUSDT', 'ADAUSD': 'ADAUSDT',
  'DOTUSD': 'DOTUSDT', 'MATICUSD': 'MATICUSDT', 'LINKUSD': 'LINKUSDT',
  'UNIUSD': 'UNIUSDT', 'AVAXUSD': 'AVAXUSDT', 'ATOMUSD': 'ATOMUSDT',
  'LTCUSD': 'LTCUSDT', 'BCHUSD': 'BCHUSDT', 'XLMUSD': 'XLMUSDT',
  'TRXUSD': 'TRXUSDT', 'FILUSD': 'FILUSDT', 'APTUSD': 'APTUSDT',
  'ARBUSD': 'ARBUSDT', 'OPUSD': 'OPUSDT', 'INJUSD': 'INJUSDT',
  'RUNEUSD': 'RUNEUSDT', 'AAVEUSD': 'AAVEUSDT', 'MKRUSD': 'MKRUSDT',
  'SNXUSD': 'SNXUSDT', 'CRVUSD': 'CRVUSDT', 'COMPUSD': 'COMPUSDT',
  'YFIUSD': 'YFIUSDT', 'SUSHIUSD': 'SUSHIUSDT', 'BLURUSD': 'BLURUSDT',
  'BTCUSDT': 'BTCUSDT', 'ETHUSDT': 'ETHUSDT',
};

export function getApiBaseUrl(): string {
  return '';
}

function findCryptoPair(symbol: string): string | null {
  const upper = symbol.toUpperCase().replace(/ /g, '');
  if (CRYPTO_MAP[upper]) return CRYPTO_MAP[upper];
  if (upper.endsWith('USD') || upper.endsWith('USDT')) {
    const base = upper.replace(/USD(T)?$/, '');
    if (base && base.length <= 10) return `${base}USDT`;
  }
  const knownCoins = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'DOT', 'MATIC', 'LINK',
    'UNI', 'AVAX', 'ATOM', 'LTC', 'BCH', 'XLM', 'TRX', 'FIL', 'APT', 'ARB', 'OP',
    'INJ', 'RUNE', 'AAVE', 'MKR', 'SNX', 'CRV', 'COMP', 'YFI', 'SUSHI', 'BLUR'];
  for (const coin of knownCoins) {
    if (upper.includes(coin)) return `${coin}USDT`;
  }
  return null;
}

function toYahooFormat(klines: any[][], symbol: string): any {
  return {
    chart: {
      result: [{
        meta: { symbol, regularMarketTime: Math.floor(Date.now() / 1000) },
        timestamp: klines.map(k => Math.floor(k[0] / 1000)),
        indicators: {
          quote: [{
            open: klines.map(k => parseFloat(k[1])),
            high: klines.map(k => parseFloat(k[2])),
            low: klines.map(k => parseFloat(k[3])),
            close: klines.map(k => parseFloat(k[4])),
            volume: klines.map(k => parseFloat(k[5])),
          }]
        }
      }]
    }
  };
}

export async function fetchFearGreedDirect(): Promise<{ value: number; classification: string }> {
  try {
    const url = `${ALTERNATIVE_BASE}/fng/?limit=1`;
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 10000);
    let r = await fetch(url, { signal: ac.signal });
    clearTimeout(timeout);
    if (!r.ok || r.status === 0) {
      const ac2 = new AbortController();
      const timeout2 = setTimeout(() => ac2.abort(), 10000);
      r = await fetch(CORS_PROXY + encodeURIComponent(url), { signal: ac2.signal });
      clearTimeout(timeout2);
    }
    const d = await r.json();
    const item = d?.data?.[0];
    return { value: Number(item?.value) || 50, classification: item?.value_classification || 'Neutral' };
  } catch {
    return { value: 50, classification: 'Neutral' };
  }
}

export async function fetchEconCalendarDirect(): Promise<any[]> {
  try {
    const url = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 10000);
    let r = await fetch(url, { signal: ac.signal });
    clearTimeout(timeout);
    if (!r.ok || r.status === 0) {
      const ac2 = new AbortController();
      const timeout2 = setTimeout(() => ac2.abort(), 10000);
      r = await fetch(CORS_PROXY + encodeURIComponent(url), { signal: ac2.signal });
      clearTimeout(timeout2);
    }
    const data = await r.json();
    return (data || []).filter((e: any) => e.impact === 'High' || e.impact === 'Medium').slice(0, 10).map((e: any) => ({
      title: e.title, country: e.country, date: e.date,
      impact: e.impact, forecast: e.forecast || '-', previous: e.previous || '-',
    }));
  } catch {
    return [];
  }
}

export async function fetchNewsDirect(query: string): Promise<any[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 10000);
    let r = await fetch(url, { signal: ac.signal });
    clearTimeout(timeout);
    if (!r.ok || r.status === 0) {
      const ac2 = new AbortController();
      const timeout2 = setTimeout(() => ac2.abort(), 10000);
      r = await fetch(CORS_PROXY + encodeURIComponent(url), { signal: ac2.signal });
      clearTimeout(timeout2);
    }
    const xml = await r.text();
    const titles = [...xml.matchAll(/<title>(.*?)<\/title>/g)].slice(1).map(m => m[1]);
    const sources = [...xml.matchAll(/<source>(.*?)<\/source>/g)].map(m => m[1]);
    return titles.slice(0, 8).map((title, i) => ({ title, source: sources[i] || 'News' }));
  } catch {
    return [];
  }
}

export async function fetchCryptoPricesDirect(): Promise<any> {
  try {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 10000);
    const r = await fetch(`${COINGECKO_BASE}/simple/price?ids=bitcoin,ethereum,litecoin,tron,solana&vs_currencies=usd`, { signal: ac.signal });
    clearTimeout(timeout);
    if (r.ok) return await r.json();
    return {
      bitcoin: { usd: 67000 }, ethereum: { usd: 3200 },
      litecoin: { usd: 85 }, tron: { usd: 0.12 }, solana: { usd: 150 },
    };
  } catch {
    return {
      bitcoin: { usd: 67000 }, ethereum: { usd: 3200 },
      litecoin: { usd: 85 }, tron: { usd: 0.12 }, solana: { usd: 150 },
    };
  }
}

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

function symbolToYahooForex(symbol: string): string | null {
  const upper = symbol.toUpperCase().replace(/ /g, '');
  // Forex pairs: EURUSD → EURUSD=X
  if (/^[A-Z]{6}$/.test(upper)) {
    return `${upper}=X`;
  }
  // Stock symbols: AAPL, TSLA etc
  if (/^[A-Z]{1,5}$/.test(upper) && !upper.endsWith('USD')) {
    return upper;
  }
  // Crypto: BTCUSD → BTC-USD
  if (upper.endsWith('USD') && !upper.endsWith('USDT')) {
    const base = upper.replace('USD', '');
    return `${base}-USD`;
  }
  return null;
}

function yahooInterval(timeframe: string): string {
  const map: Record<string, string> = {
    '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1h': '1h', '4h': '1d', '1d': '1d', '1w': '1wk', '1M': '1mo',
  };
  return map[timeframe] || '1d';
}

function yahooRange(timeframe: string): string {
  const map: Record<string, string> = {
    '1m': '5d', '5m': '5d', '15m': '1mo', '30m': '1mo',
    '1h': '3mo', '4h': '6mo', '1d': '1y', '1w': '2y', '1M': '5y',
  };
  return map[timeframe] || '1y';
}

async function fetchYahooFinance(symbol: string, timeframe: string): Promise<any> {
  const yahooSymbol = symbolToYahooForex(symbol);
  if (!yahooSymbol) throw new Error('Cannot convert symbol to Yahoo format');

  const interval = yahooInterval(timeframe);
  const range = yahooRange(timeframe);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=${interval}&range=${range}`;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 15000);

  try {
    // Try direct first
    let r = await fetch(url, { signal: ac.signal });
    clearTimeout(timeout);

    // If CORS blocked, try proxy
    if (!r.ok || r.status === 0) {
      const ac2 = new AbortController();
      const timeout2 = setTimeout(() => ac2.abort(), 15000);
      r = await fetch(CORS_PROXY + encodeURIComponent(url), { signal: ac2.signal });
      clearTimeout(timeout2);
    }

    if (!r.ok) throw new Error(`Yahoo: HTTP ${r.status}`);
    const data = await r.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error('No Yahoo data');

    const ts = result.timestamp;
    const q = result.indicators?.quote?.[0];
    if (!ts || !q || !q.close) throw new Error('Incomplete Yahoo data');

    return {
      chart: {
        result: [{
          meta: { symbol },
          timestamp: ts,
          indicators: {
            quote: [{
              open: q.open,
              high: q.high,
              low: q.low,
              close: q.close,
              volume: q.volume || ts.map(() => 0),
            }]
          }
        }]
      }
    };
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

export async function fetchMarketDataDirect(symbol: string, timeframe: string): Promise<any> {
  // 1. Try Binance first (crypto only, no CORS issues)
  const binancePair = findCryptoPair(symbol);
  if (binancePair) {
    try {
      const interval = TIMEFRAME_MAP[timeframe] || '1d';
      const limit = LIMIT_MAP[timeframe] || 100;
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 10000);
      const r = await fetch(`${BINANCE_BASE}/klines?symbol=${binancePair}&interval=${interval}&limit=${limit}`, { signal: ac.signal });
      clearTimeout(timeout);
      if (r.ok) {
        const klines = await r.json();
        if (klines && klines.length >= 10) return toYahooFormat(klines, symbol);
      }
    } catch {}
  }

  // 2. Try Yahoo Finance (forex + stocks + crypto fallback)
  try {
    return await fetchYahooFinance(symbol, timeframe);
  } catch {}

  throw new Error('Market data currently unavailable from the source.');
}

export async function callAIDirect(prompt: string, apiKey: string): Promise<any> {
  if (!apiKey) return { error: 'No API key provided' };

  const isGemini = apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.');
  const isGroq = apiKey.startsWith('gsk_');

  // Try Groq first (preferred — faster, more reliable for batch)
  if (isGroq) {
    const groqResult = await callGroqDirect(prompt, apiKey);
    if (!groqResult?.error) return groqResult;
    // If Groq fails, try Gemini as fallback
    const k2 = localStorage.getItem('finalyze_key2_value') || localStorage.getItem('finalyze_key1_value');
    if (k2 && k2 !== apiKey) {
      const gemResult = await callAIDirect(prompt, k2);
      if (!gemResult?.error) return gemResult;
    }
    return groqResult;
  }

  // Try Gemini
  if (isGemini) {
    const gemResult = await callGeminiDirect(prompt, apiKey);
    if (!gemResult?.error) return gemResult;
    // If Gemini fails, try Groq as fallback
    const k2 = localStorage.getItem('finalyze_key2_value') || localStorage.getItem('finalyze_key1_value');
    if (k2 && k2 !== apiKey) {
      const groqResult = await callAIDirect(prompt, k2);
      if (!groqResult?.error) return groqResult;
    }
    return gemResult;
  }

  return { error: 'Unrecognized API key format. Use Google Gemini (AIza...) or Groq (gsk_...)' };
}

async function callGeminiDirect(prompt: string, apiKey: string): Promise<any> {
  const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
  for (const model of models) {
    try {
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 25000);
      let resp = await fetch(`${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a financial analyst. ${prompt}` }] }],
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
        }),
        signal: ac.signal
      });
      clearTimeout(timeout);
      if (!resp.ok && (resp.status === 404 || resp.status === 400)) {
        const v1Resp = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are a financial analyst. ${prompt}` }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
          }),
          signal: ac.signal
        });
        if (v1Resp.ok) resp = v1Resp;
      }
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        const msg = err?.error?.message || `Google: HTTP ${resp.status}`;
        if (resp.status === 400 || resp.status === 401 || resp.status === 403) return { error: msg };
        continue;
      }
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { choices: [{ message: { content: text } }] };
    } catch (e: any) {
      if (e.name === 'AbortError') continue;
    }
  }
  return { error: 'Google AI: All models failed or timed out' };
}

async function callGroqDirect(prompt: string, apiKey: string): Promise<any> {
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  for (const model of models) {
    try {
      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 25000);
      const resp = await fetch(`${GROQ_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: "You are a professional financial analyst AI. Always respond in valid JSON format." }, { role: "user", content: prompt }],
          temperature: 0.1,
          response_format: { type: "json_object" }
        }),
        signal: ac.signal
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        const msg = err?.error?.message || `Groq: HTTP ${resp.status}`;
        if (resp.status === 400 || resp.status === 401 || resp.status === 403) return { error: msg };
        continue;
      }
      const data = await resp.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text) return { choices: [{ message: { content: text } }] };
    } catch (e: any) {
      if (e.name === 'AbortError') continue;
    }
  }
  return { error: 'Groq: All models exhausted' };
}
