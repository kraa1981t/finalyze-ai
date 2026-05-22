interface FearGreedData {
  value: number;
  classification: string;
}

interface NewsArticle {
  title: string;
  source: string;
}

interface EconEvent {
  date: string;
  title: string;
  country: string;
  impact: string;
  forecast: string;
  previous: string;
}

export interface MarketContext {
  fearGreed: FearGreedData | null;
  news: NewsArticle[];
  econEvents: EconEvent[];
}

const CACHE_TTL = 10 * 60 * 1000;
let fgCache: { data: FearGreedData; ts: number } | null = null;
let ecCache: { data: EconEvent[]; ts: number } | null = null;

async function getFearGreed(): Promise<FearGreedData> {
  if (fgCache && Date.now() - fgCache.ts < CACHE_TTL) return fgCache.data;
  try {
    const r = await fetch('/api/context-fear-greed');
    const d = await r.json();
    fgCache = { data: d, ts: Date.now() };
    return d;
  } catch {
    return { value: 50, classification: 'Neutral' };
  }
}

async function getEconCalendar(): Promise<EconEvent[]> {
  if (ecCache && Date.now() - ecCache.ts < CACHE_TTL) return ecCache.data;
  try {
    const r = await fetch('/api/context-econ-calendar');
    const d = await r.json();
    ecCache = { data: d.events || [], ts: Date.now() };
    return d.events || [];
  } catch {
    return [];
  }
}

async function getNews(query: string): Promise<NewsArticle[]> {
  try {
    const r = await fetch(`/api/context-news?query=${encodeURIComponent(query)}`);
    const d = await r.json();
    return d.articles || [];
  } catch {
    return [];
  }
}

function symbolToQuery(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.includes('BTC')) return 'Bitcoin cryptocurrency';
  if (upper.includes('ETH')) return 'Ethereum cryptocurrency';
  if (upper.includes('SOL')) return 'Solana cryptocurrency';
  if (upper.includes('XRP')) return 'XRP cryptocurrency';
  if (upper.includes('DOGE')) return 'Dogecoin cryptocurrency';
  if (upper.includes('XAU')) return 'Gold market price';
  if (upper.includes('XAG')) return 'Silver market price';
  if (upper.includes('EUR')) return 'Euro forex market';
  if (upper.includes('GBP')) return 'Pound forex market';
  if (upper.includes('JPY')) return 'Yen forex market';
  if (upper.includes('AUD')) return 'Australian dollar forex';
  if (upper.includes('CAD')) return 'Canadian dollar forex';
  if (upper.includes('NZD')) return 'New Zealand dollar forex';
  if (upper.includes('XPT')) return 'Platinum market';
  if (upper.includes('XPD')) return 'Palladium market';
  if (upper.includes('XCU')) return 'Copper market';
  return `${symbol} financial market`;
}

export async function fetchMarketContext(symbol: string): Promise<MarketContext> {
  const query = symbolToQuery(symbol);
  const [fearGreed, econEvents, news] = await Promise.all([
    getFearGreed(),
    getEconCalendar(),
    getNews(query),
  ]);
  return { fearGreed, news, econEvents };
}
