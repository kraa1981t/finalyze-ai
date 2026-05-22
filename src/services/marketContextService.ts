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

function symbolToQuery(symbol: string, type: string): string {
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

export async function fetchMarketContext(symbol: string, type: string): Promise<MarketContext> {
  const query = symbolToQuery(symbol, type);

  const [fearGreedRes, newsRes, econRes] = await Promise.all([
    fetch('/api/context-fear-greed').then(r => r.json()).catch(() => ({ value: 50, classification: 'Neutral' })),
    fetch(`/api/context-news?query=${encodeURIComponent(query)}`).then(r => r.json()).catch(() => ({ articles: [] })),
    fetch('/api/context-econ-calendar').then(r => r.json()).catch(() => ({ events: [] }))
  ]);

  return {
    fearGreed: fearGreedRes as FearGreedData,
    news: (newsRes.articles || []) as NewsArticle[],
    econEvents: (econRes.events || []) as EconEvent[]
  };
}
