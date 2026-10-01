import { STOCKS_BY_EXCHANGE } from '../constants';

export type StockExchangeKey = 'us' | 'eu' | 'jp';

export interface OpenExchange {
  key: StockExchangeKey;
  labelAr: string;
  labelEn: string;
  symbols: string[];
}

interface ExchangeInfo {
  labelAr: string;
  labelEn: string;
  timezone: string;
  openMin: number;
  closeMin: number;
}

const EXCHANGE_INFO: Record<StockExchangeKey, ExchangeInfo> = {
  us: { labelAr: 'أسهم أمريكا', labelEn: 'US Stocks', timezone: 'America/New_York', openMin: 9 * 60 + 30, closeMin: 16 * 60 },
  eu: { labelAr: 'أسهم أوروبا', labelEn: 'EU Stocks', timezone: 'Europe/Berlin', openMin: 9 * 60, closeMin: 17 * 60 + 30 },
  jp: { labelAr: 'أسهم اليابان', labelEn: 'JP Stocks', timezone: 'Asia/Tokyo', openMin: 9 * 60, closeMin: 15 * 60 },
};

export const ALL_STOCK_EXCHANGES: StockExchangeKey[] = ['us', 'eu', 'jp'];

export function isExchangeOpen(key: StockExchangeKey, now: Date = new Date()): boolean {
  const info = EXCHANGE_INFO[key];
  if (!info) return false;
  const h = parseInt(now.toLocaleString('en-US', { timeZone: info.timezone, hour: 'numeric', hour12: false }));
  const m = parseInt(now.toLocaleString('en-US', { timeZone: info.timezone, minute: 'numeric' }));
  const day = now.toLocaleString('en-US', { timeZone: info.timezone, weekday: 'short' });
  const mins = h * 60 + m;
  return day !== 'Sat' && day !== 'Sun' && mins >= info.openMin && mins < info.closeMin;
}

export function getOpenStockExchanges(now: Date = new Date()): OpenExchange[] {
  const result: OpenExchange[] = [];
  for (const key of ALL_STOCK_EXCHANGES) {
    if (isExchangeOpen(key, now)) {
      result.push({
        key,
        labelAr: EXCHANGE_INFO[key].labelAr,
        labelEn: EXCHANGE_INFO[key].labelEn,
        symbols: STOCKS_BY_EXCHANGE[key] || [],
      });
    }
  }
  return result;
}

export function exchangeLabel(key: StockExchangeKey, lang: 'ar' | 'en'): string {
  const info = EXCHANGE_INFO[key];
  return lang === 'ar' ? info.labelAr : info.labelEn;
}
