import { fetchFearGreedDirect, fetchNewsDirect, fetchEconCalendarDirect } from './apiDirect';

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
  advice?: 'avoid_entry' | 'caution' | 'safe';
  hoursUntil?: number;
}

export interface MarketContext {
  fearGreed: FearGreedData | null;
  news: NewsArticle[];
  econEvents: EconEvent[];
}

const CACHE_TTL = 10 * 60 * 1000;
let fgCache: { data: FearGreedData; ts: number } | null = null;
let ecCache: { data: EconEvent[]; ts: number } | null = null;
const newsCache = new Map<string, { data: NewsArticle[]; ts: number }>();
const NEWS_CACHE_TTL = 10 * 60 * 1000;

async function getFearGreed(): Promise<FearGreedData> {
  if (fgCache && Date.now() - fgCache.ts < CACHE_TTL) return fgCache.data;
  const d = await fetchFearGreedDirect();
  fgCache = { data: d, ts: Date.now() };
  return d;
}

async function getEconCalendar(): Promise<EconEvent[]> {
  if (ecCache && Date.now() - ecCache.ts < CACHE_TTL) return ecCache.data;
  const events = await fetchEconCalendarDirect();
  ecCache = { data: events, ts: Date.now() };
  return events;
}

async function getNews(query: string): Promise<NewsArticle[]> {
  const cached = newsCache.get(query);
  if (cached && Date.now() - cached.ts < NEWS_CACHE_TTL) return cached.data;
  const news = await fetchNewsDirect(query);
  newsCache.set(query, { data: news, ts: Date.now() });
  return news;
}

function symbolToQuery(symbol: string): string {
  const upper = symbol.toUpperCase();
  if (upper.includes('BTC')) return 'Bitcoin cryptocurrency';
  if (upper.includes('ETH')) return 'Ethereum cryptocurrency';
  if (upper.includes('SOL')) return 'Solana cryptocurrency';
  if (upper.includes('XRP')) return 'XRP cryptocurrency';
  if (upper.includes('DOGE')) return 'Dogecoin cryptocurrency';
  if (upper.includes('TON')) return 'Toncoin TON cryptocurrency';
  if (upper.includes('SUI')) return 'Sui blockchain cryptocurrency';
  if (upper.includes('SEI')) return 'Sei network cryptocurrency';
  if (upper.includes('NEAR')) return 'NEAR Protocol cryptocurrency';
  if (upper.includes('APT')) return 'Aptos cryptocurrency';
  if (upper.includes('ARB')) return 'Arbitrum cryptocurrency';
  if (upper.includes('OP')) return 'Optimism cryptocurrency';
  if (upper.includes('WLD')) return 'Worldcoin cryptocurrency';
  if (upper.includes('JUP')) return 'Jupiter DEX Solana';
  if (upper.includes('KAS')) return 'Kaspa cryptocurrency';
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
