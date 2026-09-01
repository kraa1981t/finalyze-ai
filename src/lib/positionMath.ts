export type InstrumentType = 'forex_jpy' | 'forex' | 'crypto' | 'stock';

export interface InstrumentConfig {
  decimals: number;
  pipSize: number;
  pipLabel: string;
  contractSize: number;
  quoteIsUSD: boolean;
  pipValuePerLotUSD: number;
  symbol: string;
}

const CRYPTO_NAMES = ['BTC','ETH','DOGE','SOL','XRP','ADA','DOT','SHIB','AVAX','MATIC','LINK','UNI','ATOM','LTC','BCH','NEAR','FIL','APT','ARB','OP','SUI','SEI','PEPE','WIF','BONK','TON','TRX','RENDER','FET','INJ'];
const CURRENCIES = ['EUR','GBP','AUD','NZD','CAD','CHF','USD','JPY','TRY','ZAR','MXN','SEK','NOK','DKK','SGD','HKD','CNY','INR','THB','PLN','HUF','CZK','ILS','PHP','IDR','MYR','KRW','TWD'];

// Approximate USD/JPY used to convert JPY-quoted pip values to USD
const USDJPY_APPROX = 150;

// 1 lot of a stock = 100 shares (standard broker contract), so 0.01 lot = 1 share.
export const STOCK_CONTRACT_SIZE = 100;

// Convert a price change in the instrument's own currency into USD.
// Yahoo returns Japanese/European stock prices in their local currency (JPY/EUR/GBP/CHF/NOK)
// while US stocks are already USD. Returns the USD value of 1 unit of the local currency.
export function currencyToUsdFactor(symbol: string): number {
  const s = (symbol || '').toUpperCase();
  if (/\.T$/.test(s)) return 1 / USDJPY_APPROX;          // JPY -> USD
  if (/\.(PA|DE|AS|MI)$/.test(s)) return 1.08;           // EUR -> USD
  if (/\.L$/.test(s)) return 1.27;                        // GBP -> USD
  if (/\.SW$/.test(s)) return 1 / 0.88;                   // CHF -> USD
  if (/\.CO$/.test(s)) return 0.095;                      // NOK -> USD
  return 1;                                               // USD (US stocks/ADR)
}

export function detectInstrumentType(symbol: string): InstrumentType {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');

  for (const c of CRYPTO_NAMES) {
    if (s.startsWith(c) && s.endsWith('USD')) return 'crypto';
  }
  if (CRYPTO_NAMES.some(c => s === c || s === c + 'USD' || s === c + 'USDT')) return 'crypto';

  const found = CURRENCIES.filter(c => s.includes(c));
  if (found.length >= 2) {
    if (s.includes('JPY')) return 'forex_jpy';
    return 'forex';
  }

  return 'stock';
}

export function getInstrumentConfig(symbol: string): InstrumentConfig {
  const type = detectInstrumentType(symbol);
  switch (type) {
    case 'forex':
      return { decimals: 5, pipSize: 0.0001, pipLabel: 'pip', contractSize: 100000, quoteIsUSD: true, pipValuePerLotUSD: 10, symbol };
    case 'forex_jpy':
      return { decimals: 3, pipSize: 0.01, pipLabel: 'pip', contractSize: 100000, quoteIsUSD: false, pipValuePerLotUSD: 1000 / USDJPY_APPROX, symbol };
    case 'crypto':
      return { decimals: 2, pipSize: 0.01, pipLabel: 'point', contractSize: 100, quoteIsUSD: true, pipValuePerLotUSD: 1, symbol };
    case 'stock':
      return { decimals: 2, pipSize: 0.01, pipLabel: 'point', contractSize: 100, quoteIsUSD: true, pipValuePerLotUSD: 1, symbol };
  }
}

// USD risk amount for a given stop distance (in price), qty and category.
// - forex/metals: qty is in lots -> amount = pips * pip value of the lot
// - stock/crypto: qty is in units/shares -> amount = price difference * qty
export function slAmountUSD(symbol: string, slDistance: number, qty: number, category: string): number {
  if (category === 'forex' || category === 'metals') {
    const cfg = getInstrumentConfig(symbol);
    return (slDistance / cfg.pipSize) * cfg.pipValuePerLotUSD * qty;
  }
  if (category === 'stocks') {
    return slDistance * qty * STOCK_CONTRACT_SIZE * currencyToUsdFactor(symbol);
  }
  return slDistance * qty;
}

// Convert a USD amount back to a limit price given entry, side of the level,
// qty and category. `above` = true places the level above entry (profit-side
// for a buy / loss-side for a sell), `above` = false places it below entry.
export function usdToPrice(symbol: string, amountUSD: number, entryPrice: number, above: boolean, qty: number, category: string): number {
  if (category === 'forex' || category === 'metals') {
    const cfg = getInstrumentConfig(symbol);
    const pips = amountUSD / (cfg.pipValuePerLotUSD * qty);
    const distance = pips * cfg.pipSize;
    return above ? entryPrice + distance : entryPrice - distance;
  }
  if (amountUSD > 0 && qty > 0) {
    const distance = category === 'stocks'
      ? amountUSD / (qty * STOCK_CONTRACT_SIZE * currencyToUsdFactor(symbol))
      : amountUSD / qty;
    return above ? entryPrice + distance : entryPrice - distance;
  }
  return entryPrice;
}

// Convenience: USD amounts for SL & TP prices at a given entry/qty/category.
export function pricesToUsd(
  symbol: string,
  slPrice: number,
  tpPrice: number,
  entry: number,
  qty: number,
  category: string,
): { slUsd: number; tpUsd: number } | null {
  if (entry <= 0 || qty <= 0) return null;
  return {
    slUsd: slAmountUSD(symbol, Math.abs(entry - slPrice), qty, category),
    tpUsd: slAmountUSD(symbol, Math.abs(entry - tpPrice), qty, category),
  };
}
