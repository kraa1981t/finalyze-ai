import { db } from '../lib/firebase';
import { collection, doc, getDoc, setDoc, addDoc, updateDoc, query, where, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { SYMBOL_CATEGORIES } from '../constants';

export interface PaperTrade {
  id: string;
  symbol: string;
  category: string;
  side: 'buy' | 'sell';
  qty: number;
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  status: 'open' | 'closed';
  closeReason?: 'manual' | 'tp' | 'sl';
  tp?: number | null;
  sl?: number | null;
  openedAt: number;
  closedAt?: number;
}

export const START_BALANCE = 10000;
export const MIN_BALANCE = 500;

// ---------- Contract specs (TradingView-style) ----------
// Default lot follows total balance: baseline $500 -> 0.01 lot,
// every extra $1000 adds 0.01 (e.g. $7000 -> 0.08).
export function lotMultiplierForBalance(balance: number): number {
  return Math.floor(Math.max(balance, MIN_BALANCE) / 1000) + 1;
}

export function getDefaultQty(category: string, balance: number = START_BALANCE): number {
  const m = lotMultiplierForBalance(balance);
  switch (category) {
    case 'forex': return +(0.01 * m).toFixed(2);   // lots (1 lot = 100,000 units)
    case 'crypto': return +(0.1 * m).toFixed(2);   // units of coin
    case 'stocks': return Math.max(1, m);          // shares
    case 'metals': return +(0.01 * m).toFixed(2);  // lots (1 lot = 100 oz)
    default: return 1;
  }
}

export function calcPnl(trade: Pick<PaperTrade, 'category' | 'symbol' | 'side' | 'qty' | 'entryPrice'>, currentPrice: number): number {
  const dir = trade.side === 'buy' ? 1 : -1;
  const diff = (currentPrice - trade.entryPrice) * dir;
  switch (trade.category) {
    case 'forex': {
      // Standard lot = 100k units. USD-quote pairs: P&L in USD directly.
      // Quote-currency pairs (JPY/crosses): convert approximately through price.
      const s = trade.symbol.toUpperCase();
      if (s.endsWith('USD')) return diff * trade.qty * 100000;
      return (diff / Math.max(currentPrice, 0.0001)) * trade.qty * 100000;
    }
    case 'metals':
      return diff * trade.qty * 100; // 1 lot = 100 oz
    case 'crypto':
    case 'stocks':
    default:
      return diff * trade.qty;
  }
}

export function formatPnl(v: number): string {
  const sign = v >= 0 ? '+' : '';
  return `${sign}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${v < 0 ? '' : ''}` .replace('+$', v >= 0 ? '+$' : '-$');
}

// ---------- Price engine ----------
type PriceListener = (price: number) => void;

const _priceCache = new Map<string, { price: number; ts: number }>();
const PRICE_TTL = 2500;

async function fetchServerLastPrice(symbol: string): Promise<number | null> {
  try {
    const r = await fetch(`/api/market-data?symbol=${encodeURIComponent(symbol)}&timeframe=5m`);
    if (!r.ok) return null;
    const d = await r.json();
    const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (Array.isArray(closes)) {
      for (let i = closes.length - 1; i >= 0; i--) {
        const c = closes[i];
        if (c != null && c > 0) return c;
      }
    }
  } catch {}
  return null;
}

export async function getLivePrice(symbol: string): Promise<number | null> {
  const cached = _priceCache.get(symbol);
  if (cached && Date.now() - cached.ts < PRICE_TTL) return cached.price;

  // Route ALL assets (crypto, forex, metals, indices) through the backend
  // server proxy /api/market-data. The server resolves crypto -> Binance and
  // forex/metals -> Yahoo/TwelveData server-side, bypassing browser CORS.
  // No browser-direct Binance calls (CORS-blocked) and no unreliable external
  // CORS proxies (corsproxy.io/allorigins often fail with 403).
  const price = await fetchServerLastPrice(symbol);

  if (price != null) {
    _priceCache.set(symbol, { price, ts: Date.now() });
  }
  return price;
}

// Poll prices for a list of symbols, calling listener on each update.
export function subscribePrices(symbols: string[], listener: (symbol: string, price: number) => void): () => void {
  let alive = true;
  const tick = async () => {
    if (!alive) return;
    const unique = [...new Set(symbols)];
    await Promise.all(unique.map(async (sym) => {
      const p = await getLivePrice(sym);
      if (p != null && alive) listener(sym, p);
    }));
  };
  tick();
  const iv = setInterval(tick, 3000);
  return () => { alive = false; clearInterval(iv); };
}

// ---------- Storage adapters ----------
interface TradeStore {
  getAccount(): Promise<{ balance: number }>;
  saveBalance(balance: number): Promise<void>;
  listTrades(): Promise<PaperTrade[]>;
  addTrade(t: Omit<PaperTrade, 'id'>): Promise<string>;
  updateTrade(id: string, patch: Partial<PaperTrade>): Promise<void>;
  resetAccount(newBalance: number): Promise<void>;
}

class LocalStore implements TradeStore {
  private key = 'paper_trading_data';
  private read(): { balance: number; trades: PaperTrade[] } {
    try {
      return JSON.parse(localStorage.getItem(this.key) || '') || { balance: START_BALANCE, trades: [] };
    } catch { return { balance: START_BALANCE, trades: [] }; }
  }
  private write(data: { balance: number; trades: PaperTrade[] }) {
    localStorage.setItem(this.key, JSON.stringify(data));
  }
  async getAccount() { return { balance: this.read().balance }; }
  async saveBalance(balance: number) { const d = this.read(); d.balance = balance; this.write(d); }
  async listTrades() { return this.read().trades; }
  async addTrade(t: Omit<PaperTrade, 'id'>) {
    const d = this.read();
    const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    d.trades.unshift({ ...t, id });
    this.write(d);
    return id;
  }
  async updateTrade(id: string, patch: Partial<PaperTrade>) {
    const d = this.read();
    const idx = d.trades.findIndex((t) => t.id === id);
    if (idx >= 0) { d.trades[idx] = { ...d.trades[idx], ...patch }; this.write(d); }
  }
  async resetAccount(newBalance: number) {
    this.write({ balance: newBalance, trades: [] });
  }
}

class FirestoreStore implements TradeStore {
  constructor(private uid: string) {}
  async getAccount() {
    const snap = await getDoc(doc(db, 'paper_accounts', this.uid));
    if (!snap.exists()) {
      await setDoc(doc(db, 'paper_accounts', this.uid), { balance: START_BALANCE, createdAt: Timestamp.now() });
      return { balance: START_BALANCE };
    }
    return { balance: snap.data().balance ?? START_BALANCE };
  }
  async saveBalance(balance: number) {
    await setDoc(doc(db, 'paper_accounts', this.uid), { balance, updatedAt: Timestamp.now() }, { merge: true });
  }
  async listTrades(): Promise<PaperTrade[]> {
    const q = query(collection(db, 'paper_trades'), where('uid', '==', this.uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PaperTrade[];
  }
  async addTrade(t: Omit<PaperTrade, 'id'>) {
    const ref = await addDoc(collection(db, 'paper_trades'), { ...t, uid: this.uid });
    return ref.id;
  }
  async updateTrade(id: string, patch: Partial<PaperTrade>) {
    await updateDoc(doc(db, 'paper_trades', id), patch as any);
  }
  async resetAccount(newBalance: number) {
    await setDoc(doc(db, 'paper_accounts', this.uid), { balance: newBalance, startBalance: newBalance, updatedAt: Timestamp.now() }, { merge: true });
    const snap = await getDocs(query(collection(db, 'paper_trades'), where('uid', '==', this.uid)));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export function getTradeStore(user: User | null): TradeStore {
  if (user?.uid) return new FirestoreStore(user.uid);
  return new LocalStore();
}
