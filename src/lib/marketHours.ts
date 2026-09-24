import { STOCKS_BY_EXCHANGE } from '../constants';

export type StockExchangeKey = 'us' | 'eu' | 'jp';
import type { Language } from './i18n';


export interface OpenExchange {
  key: StockExchangeKey;
  labelEn: string;
  labelAr: string;
  labelEs: string;
  labelRu: string;
  labelFr: string;
  symbols: string[];
}

interface ExchangeInfo {
  labelEn: string;
  labelAr: string;
  labelEs: string;
  labelRu: string;
  labelFr: string;
  timezone: string;
  openMin: number;
  closeMin: number;
}

const EXCHANGE_INFO: Record<StockExchangeKey, ExchangeInfo> = {
  us: { labelEn: 'US Stocks', labelAr: 'أسهم أمريكا', labelEs: 'Acciones EE. UU.', labelRu: 'Акции США', labelFr: 'Actions américaines', timezone: 'America/New_York', openMin: 9 * 60 + 30, closeMin: 16 * 60 },
  eu: { labelEn: 'EU Stocks', labelAr: 'أسهم أوروبا', labelEs: 'Acciones UE', labelRu: 'Акции ЕС', labelFr: 'Actions UE', timezone: 'Europe/Berlin', openMin: 9 * 60, closeMin: 17 * 60 + 30 },
  jp: { labelEn: 'JP Stocks', labelAr: 'أسهم اليابان', labelEs: 'Acciones Japón', labelRu: 'Акции Японии', labelFr: 'Actions Japon', timezone: 'Asia/Tokyo', openMin: 9 * 60, closeMin: 15 * 60 },
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
        labelEn: EXCHANGE_INFO[key].labelEn,
        labelAr: EXCHANGE_INFO[key].labelAr,
        labelEs: EXCHANGE_INFO[key].labelEs,
        labelRu: EXCHANGE_INFO[key].labelRu,
        labelFr: EXCHANGE_INFO[key].labelFr,
        symbols: STOCKS_BY_EXCHANGE[key] || [],
      });
    }
  }
  return result;
}

export function exchangeLabel(key: StockExchangeKey, lang: Language): string {
  const info = EXCHANGE_INFO[key];
  if (lang === 'ar') return info.labelAr;
  if (lang === 'es') return info.labelEs;
  if (lang === 'ru') return info.labelRu;
  if (lang === 'fr') return info.labelFr;
  return info.labelEn;
}
