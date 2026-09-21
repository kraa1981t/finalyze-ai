import { fetchNewsDirect } from './apiDirect';

const URGENT_KEYWORDS = [
  'breaking', 'urgent', 'just in', 'flash crash', 'circuit breaker',
  'crash', 'crashes', 'plunge', 'plunges', 'plummet', 'collapse', 'panic',
  'sell-off', 'selloff', 'slump', 'tumble', 'tumbles',
  'surge', 'surges', 'soar', 'soars', 'spike', 'spikes', 'rally', 'record high', 'all-time high',
  'halt', 'halted', 'emergency', 'war', 'attack', 'default', 'bankrupt', 'bankruptcy',
  'rate hike', 'rate cut', 'fomc', 'inflation', 'cpi', 'recession', 'sanctions', 'black swan',
];

export interface UrgentHeadline {
  title: string;
  source: string;
}

export async function fetchUrgentNews(): Promise<UrgentHeadline[]> {
  try {
    const items = await fetchNewsDirect('stock market OR forex OR gold OR bitcoin when:1d');
    const out: UrgentHeadline[] = [];
    for (const it of items) {
      const title = String(it?.title || '');
      const lower = title.toLowerCase();
      if (URGENT_KEYWORDS.some((k) => lower.includes(k))) {
        out.push({ title, source: String(it?.source || 'News') });
      }
    }
    return out;
  } catch {
    return [];
  }
}
