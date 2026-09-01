import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, Info, Wallet, X, Loader2, Plus, RotateCcw, Pencil, Check, XCircle, Trash2, Maximize, Minimize } from 'lucide-react';
import { User } from 'firebase/auth';
import { AnalysisResult } from '../types';
import { SYMBOL_CATEGORIES } from '../constants';
import { Language } from '../lib/i18n';
import TradingViewWidget from './TradingViewWidget';
import MT5Web from './MT5Web';
import {
  PaperTrade, getTradeStore, getLivePrice, subscribePrices,
  calcPnl, getDefaultQty, START_BALANCE, MIN_BALANCE, DEFAULT_LEVERAGE, LEVERAGE_OPTIONS, isMarketOpen,
} from '../services/paperTradingService';
import { searchSymbols, catEmoji, SuggestedSymbol } from '../services/symbolSuggestions';
import { playOpenSound, playCloseSound, playDragTick } from '../lib/tradeSounds';
import { pricesToUsd, usdToPrice, slAmountUSD } from '../lib/positionMath';

interface TradeNowPageProps {
  lang: Language;
  user: User | null;
  signals?: AnalysisResult[];
}

const CUSTOM_KEY = 'paper_trading_custom_symbols';
const CUSTOM_TV_KEY = 'paper_trading_custom_tv_map';
const HIDDEN_KEY = 'paper_trading_hidden_symbols';
const ADDED_CAT_KEY = 'paper_trading_added_by_category';

const CATEGORY_TABS = [
  { key: 'forex', labelAr: 'الفوركس', labelEn: 'Forex', emoji: '\uD83D\uDCB1' },
  { key: 'crypto', labelAr: 'الكريبتو', labelEn: 'Crypto', emoji: '\uD83E\uDDF1' },
  { key: 'stocks', labelAr: 'الأسهم', labelEn: 'Stocks', emoji: '\uD83D\uDCC8' },
  { key: 'metals', labelAr: 'المعادن', labelEn: 'Metals', emoji: '\uD83D\uDC8E' },
];

function loadCustomSymbols(): string[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch { return []; }
}

function loadTvMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CUSTOM_TV_KEY) || '{}'); } catch { return {}; }
}

function loadHiddenSymbols(): string[] {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); } catch { return []; }
}

function loadAddedByCategory(): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(ADDED_CAT_KEY) || '{}'); } catch { return {}; }
}

function toTvSymbol(sym: string): string {
  const s = sym.trim().toUpperCase();
  const tvMap = loadTvMap();
  if (tvMap[s]) return tvMap[s];
  if (s.includes(':')) return s; // full TV symbol e.g. NYSE:JNJ
  if ((SYMBOL_CATEGORIES.crypto as string[]).includes(s)) return `BINANCE:${s.replace('USD', 'USDT')}`;
  if ((SYMBOL_CATEGORIES.metals as string[]).includes(s)) return `OANDA:${s}`;
  if ((SYMBOL_CATEGORIES.forex as string[]).includes(s)) return `FX:${s}`;
  const indexMap: Record<string, string> = {
    US500: 'FOREXCOM:SPXUSD', US30: 'FOREXCOM:NSXUSD', US100: 'FOREXCOM:NDXUSD',
    SPY: 'AMEX:SPY', QQQ: 'NASDAQ:QQQ', DIA: 'AMEX:DIA',
    VIX: 'TVC:VIX', VIX3M: 'TVC:VIX3M',
    DXY: 'TVC:DXY', GOLD: 'TVC:GOLD',白银: 'TVC:SILVER',
    SOXX: 'NASDAQ:SOXX', IWM: 'NYSE:IWM', XLK: 'NYSE:XLK',
    TSLA: 'NASDAQ:TSLA', AAPL: 'NASDAQ:AAPL', NVDA: 'NASDAQ:NVDA',
    AMD: 'NASDAQ:AMD', INTC: 'NASDAQ:INTC', META: 'NASDAQ:META',
    GOOGL: 'NASDAQ:GOOGL', MSFT: 'NASDAQ:MSFT', AMZN: 'NASDAQ:AMZN',
    NFLX: 'NASDAQ:NFLX', COIN: 'NASDAQ:COIN', PLTR: 'NYSE:PLTR',
    JPM: 'NYSE:JPM', V: 'NYSE:V', MA: 'NYSE:MA', JNJ: 'NYSE:JNJ',
    WMT: 'NYSE:WMT', PG: 'NYSE:PG', UNH: 'NYSE:UNH', HD: 'NYSE:HD',
    BAC: 'NYSE:BAC', XOM: 'NYSE:XOM', CVX: 'NYSE:CVX', KO: 'NYSE:KO',
    PEP: 'NASDAQ:PEP', DIS: 'NYSE:DIS', BA: 'NYSE:BA', CAT: 'NYSE:CAT',
    CRM: 'NYSE:CRM', ORCL: 'NYSE:ORCL', T: 'NYSE:T', VZ: 'NYSE:VZ',
    MU: 'NASDAQ:MU', QCOM: 'NASDAQ:QCOM', CSCO: 'NASDAQ:CSCO',
    ABBV: 'NYSE:ABBV', LLY: 'NYSE:LLY', MRK: 'NYSE:MRK', COST: 'NASDAQ:COST',
    ASML: 'NYSE:ASML', TSM: 'NYSE:TSM', ARM: 'NASDAQ:ARM', SMCI: 'NASDAQ:SMCI',
    NOW: 'NYSE:NOW', SHOP: 'NYSE:SHOP', SQ: 'NYSE:SQ', ROKU: 'NASDAQ:ROKU',
    NIO: 'NYSE:NIO', Baba: 'NYSE:BABA', PDD: 'NASDAQ:PDD', JD: 'NASDAQ:JD',
    '7203.T': 'TSE:7203', '6758.T': 'TSE:6758', '8306.T': 'TSE:8306',
    '9984.T': 'TSE:9984', '7974.T': 'TSE:7974', '7267.T': 'TSE:7267',
    '9432.T': 'TSE:9432', '6861.T': 'TSE:6861', '6501.T': 'TSE:6501', '8035.T': 'TSE:8035',
    '7751.T': 'TSE:7751', '6954.T': 'TSE:6954', '6301.T': 'TSE:6301', '5020.T': 'TSE:5020', '9020.T': 'TSE:9020',
    'ASML.AS': 'AMS:ASML', 'MC.PA': 'EPA:MC', 'NESN.SW': 'SWX:NESN', 'SAP.DE': 'ETR:SAP',
    'SHEL.L': 'LON:SHEL', 'ULVR.L': 'LON:ULVR', 'ALV.DE': 'ETR:ALV', 'OR.PA': 'EPA:OR',
    'AZN.L': 'LON:AZN', 'NVO': 'NYSE:NVO', 'ROG.SW': 'SWX:ROG', 'MBG.DE': 'ETR:MBG',
    'BARC.L': 'LON:BARC', 'BNP.PA': 'EPA:BNP',
  };
  if (indexMap[s]) return indexMap[s];
  // For unknown symbols, try NYSE first (most US stocks)
  return `NYSE:${s}`;
}

function detectCategory(sym: string): string {
  const s = sym.toUpperCase().replace(/[-_=]/g, '');
  for (const [cat, syms] of Object.entries(SYMBOL_CATEGORIES)) {
    if ((syms as string[]).includes(s)) return cat;
  }
  if (/^[A-Z]{6}$/.test(s)) return 'forex';
  if (/BTC|ETH|USDT|COIN|DOGE/.test(s)) return 'crypto';
  if (/XAU|XAG|GOLD|SILVER/.test(s)) return 'metals';
  if (/\.T$/.test(sym)) return 'stocks';
  if (/\.(AS|PA|DE|L|SW|CO)$/.test(sym)) return 'stocks';
  return 'stocks';
}

const ORIGINAL_SYMBOLS = new Set<string>(Object.values(SYMBOL_CATEGORIES).flat() as string[]);

function calcMargin(t: Pick<PaperTrade, 'category' | 'symbol' | 'qty' | 'entryPrice'>, leverage: number = DEFAULT_LEVERAGE): number {
  const notional = t.entryPrice * t.qty * (t.category === 'forex' ? 100000 : t.category === 'metals' ? 100 : 1);
  return notional / leverage;
}

const fmtMoney = (v: number) =>
  `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPrice = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 });

// Normalize Eastern Arabic / Persian digits to Western (Latin) digits so the
// SL/TP edit inputs always show standard 0-9 numerals regardless of locale.
const normalizeDecimal = (raw: string): string =>
  raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[^0-9.]/g, '')
    .replace(/(\..*)\./g, '$1');

export default function TradeNowPage({ lang, user, signals = [] }: TradeNowPageProps) {
  const isAr = lang === 'ar';
  const [category, setCategory] = useState<string>('forex');
  const [symbol, setSymbol] = useState<string>('EURUSD');

  // Custom symbols
  const [customSymbols, setCustomSymbols] = useState<string[]>(loadCustomSymbols);
  const [addedByCategory, setAddedByCategory] = useState<Record<string, string[]>>(loadAddedByCategory);
  const [hiddenSymbols, setHiddenSymbols] = useState<string[]>(loadHiddenSymbols);
  const [newSymbol, setNewSymbol] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = searchSymbols(newSymbol);

  // Trading state
  const [balance, setBalance] = useState<number>(START_BALANCE);
  const [leverage, setLeverage] = useState<number>(DEFAULT_LEVERAGE);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [qty, setQty] = useState<number>(getDefaultQty('forex'));
  const [tpPrice, setTpPrice] = useState<string>('');
  const [slPrice, setSlPrice] = useState<string>('');
  const [tab, setTab] = useState<'positions' | 'history'>('positions');
  // Inline SL/TP editing for an open trade
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const chartPanelRef = useRef<HTMLDivElement>(null);
  const [chartFullscreen, setChartFullscreen] = useState(false);
  const [editSl, setEditSl] = useState<string>('');
  const [editTp, setEditTp] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [priceLoading, setPriceLoading] = useState(true);
  const [priceTick, setPriceTick] = useState(0); // triggers re-render for open trades P&L
  // Account reset
  const [showReset, setShowReset] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const resetVal = parseFloat(resetInput) || 0;

  // Bubble pop animation when clicking symbol
  const [popId, setPopId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'chart' | 'mt5'>('chart');
  const [symbolsCollapsed, setSymbolsCollapsed] = useState(false);
  const [ticketCollapsed, setTicketCollapsed] = useState(false);

  // Persist work place across manual refresh (sessionStorage) - clears when browser/tab closed
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('joseph_session_ui');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.symbol) setSymbol(s.symbol);
        if (s.category) setCategory(s.category);
        if (s.tab) setTab(s.tab);
        if (s.platform) setPlatform(s.platform);
        if (typeof s.symbolsCollapsed === 'boolean') setSymbolsCollapsed(s.symbolsCollapsed);
        if (typeof s.ticketCollapsed === 'boolean') setTicketCollapsed(s.ticketCollapsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem('joseph_session_ui', JSON.stringify({ symbol, category, tab, platform, symbolsCollapsed, ticketCollapsed }));
    } catch {}
  }, [symbol, category, tab, platform, symbolsCollapsed, ticketCollapsed]);

  const store = getTradeStore(user);

  // Refs that always hold the latest trades/balance so the price subscription's
  // auto-close callback never reads stale SL/TP or balance (avoid closure bugs).
  const tradesRef = React.useRef<PaperTrade[]>(trades);
  tradesRef.current = trades;
  const balanceRef = React.useRef(balance);
  balanceRef.current = balance;

  // Cooldown: when a user edits SL/TP on an open trade, briefly ignore auto-close
  // for that trade so it does NOT instantly close on the current parked price.
  const levelCooldownRef = React.useRef<Record<string, number>>({});

  // Find matching signal for current symbol
  const matchedSignal = React.useMemo(() => {
    if (!symbol || signals.length === 0) return null;
    return signals.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase()) || null;
  }, [symbol, signals]);

  // Auto-fill SL/TP as USD amounts ($) when symbol changes and matches a signal.
  // Computed from the real SL/TP prices, pip value and current qty, so a 0.01-lot
  // EURJPY order shows a small logical dollar amount instead of an absolute price.
  // Only runs on symbol change so typed SL/TP values are never wiped by price ticks.
  const lastFillSymbol = React.useRef<string | null>(null);
  useEffect(() => {
    if (matchedSignal && matchedSignal.stopLoss && matchedSignal.takeProfit) {
      const entry = matchedSignal.entryPrice || livePrice || 0;
      const cat = detectCategory(matchedSignal.symbol || symbol);
      const usd = pricesToUsd(matchedSignal.symbol || symbol, matchedSignal.stopLoss, matchedSignal.takeProfit, entry, qty, cat);
      if (usd) {
        setSlPrice(usd.slUsd.toFixed(2));
        setTpPrice(usd.tpUsd.toFixed(2));
      } else {
        setSlPrice('');
        setTpPrice('');
      }
    } else if (lastFillSymbol.current !== symbol) {
      setSlPrice('');
      setTpPrice('');
    }
    lastFillSymbol.current = symbol;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);


  const allSymbolsFor = (cat: string): string[] => {
    if (cat === 'custom') return customSymbols;
    const base = SYMBOL_CATEGORIES[cat as keyof typeof SYMBOL_CATEGORIES] || [];
    const extra = addedByCategory[cat] || [];
    return [...new Set([...base, ...extra])].filter((s) => !hiddenSymbols.includes(s));
  };
  const symbols = allSymbolsFor(category);
  const openTrades = trades.filter((t) => t.status === 'open');
  const closedTrades = trades.filter((t) => t.status === 'closed').slice(0, 30);

  const priceMapRef = React.useRef<Record<string, number>>({});
  function priceOf(t: PaperTrade): number | undefined {
    return priceMapRef.current[t.symbol];
  }
  const unrealizedPnl = openTrades.reduce((sum, t) => {
    const p = priceOf(t);
    return p != null ? sum + calcPnl(t, p) : sum;
  }, 0);
  const equity = balance + unrealizedPnl;

  // Load account + trades
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const acc = await store.getAccount();
        const list = await store.listTrades();
        if (!alive) return;
        setBalance(acc.balance);
        setLeverage(acc.leverage);
        setTrades(list.sort((a, b) => b.openedAt - a.openedAt));
      } catch {
        // Fallback: load from localStorage
        try {
          const raw = JSON.parse(localStorage.getItem('paper_trading_data') || '{"balance":10000,"trades":[]}');
          if (alive) { setBalance(raw.balance); setTrades((raw.trades || []).sort((a: any, b: any) => b.openedAt - a.openedAt)); }
        } catch {}
      }
    })();
    return () => { alive = false; };
  }, [user?.uid]);

  // Live price for selected symbol
  useEffect(() => {
    let alive = true;
    setPriceLoading(true);
    (async () => {
      const p = await getLivePrice(symbol);
      if (!alive) return;
      if (p != null) priceMapRef.current[symbol] = p;
      setLivePrice(p);
      setPriceLoading(false);
    })();
    return () => { alive = false; };
  }, [symbol]);

  // Subscribe to prices
  useEffect(() => {
    const watchList = [...new Set([...openTrades.map((t) => t.symbol), symbol])];
    if (watchList.length === 0) return;
    const unsub = subscribePrices(watchList, (sym, price) => {
      priceMapRef.current[sym] = price;
      if (sym === symbol) { setLivePrice(price); setPriceLoading(false); }
      checkAutoClose(sym, price);
      // Trigger re-render so open trades P&L updates live
      if (openTrades.some((t) => t.symbol === sym)) setPriceTick((p) => p + 1);
    });
    return unsub;
  }, [symbol, openTrades.length]);

  const checkAutoClose = useCallback(async (sym: string, price: number) => {
    const currentTrades = tradesRef.current;
    const targets = currentTrades.filter((t) => t.status === 'open' && t.symbol === sym);
    const now = Date.now();
    for (const t of targets) {
      // Skip auto-close right after the user sets SL/TP (cooldown window).
      if ((levelCooldownRef.current[t.id] || 0) > now) continue;
      const hitTp = t.tp != null && ((t.side === 'buy' && price >= t.tp) || (t.side === 'sell' && price <= t.tp));
      const hitSl = t.sl != null && ((t.side === 'buy' && price <= t.sl) || (t.side === 'sell' && price >= t.sl));
      if (hitTp || hitSl) await closeTradeInternal(t, price, hitTp ? 'tp' : 'sl');
    }
  }, []);

  async function closeTradeInternal(t: PaperTrade, exitPrice: number, reason: 'manual' | 'tp' | 'sl') {
    const pnl = calcPnl(t, exitPrice);
    const newBalance = balanceRef.current + pnl;
    try {
      await store.updateTrade(t.id, { status: 'closed', exitPrice, pnl, closeReason: reason, closedAt: Date.now() });
      await store.saveBalance(newBalance);
    } catch {
      // Fallback: save locally
      try {
        const raw = JSON.parse(localStorage.getItem('paper_trading_data') || '{"balance":10000,"trades":[]}');
        const idx = raw.trades.findIndex((x: any) => x.id === t.id);
        if (idx >= 0) raw.trades[idx] = { ...raw.trades[idx], status: 'closed', exitPrice, pnl, closeReason: reason, closedAt: Date.now() };
        raw.balance = newBalance;
        localStorage.setItem('paper_trading_data', JSON.stringify(raw));
      } catch {}
    }
    setBalance(newBalance);
    setTrades((prev) => prev.map((x) => x.id === t.id ? { ...x, status: 'closed', exitPrice, pnl, closeReason: reason, closedAt: Date.now() } : x));
    playCloseSound();
  }

  function selectCategory(key: string) {
    setCategory(key);
    const first = allSymbolsFor(key)[0] || '';
    setSymbol(first);
    if (first) setQty(getDefaultQty(detectCategory(first), balance));
  }

  function unhideSymbol(sym: string) {
    setHiddenSymbols((prev) => {
      if (!prev.includes(sym)) return prev;
      const next = prev.filter((s) => s !== sym);
      if (next.length === 0) localStorage.removeItem(HIDDEN_KEY);
      else localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      return next;
    });
  }

  function addToWatchlist(sym: string) {
    setCustomSymbols((prev) => {
      if (prev.includes(sym)) return prev;
      const next = [...prev, sym];
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      return next;
    });
  }

  function addToCategoryList(sym: string, cat: string) {
    setAddedByCategory((prev) => {
      const cur = prev[cat] || [];
      if (cur.includes(sym)) return prev;
      const next = { ...prev, [cat]: [...cur, sym] };
      localStorage.setItem(ADDED_CAT_KEY, JSON.stringify(next));
      return next;
    });
  }

  function addCustomSymbol() {
    const raw = newSymbol.trim().toUpperCase();
    if (!raw) return;
    setShowSuggestions(false);
    setNewSymbol('');
    // Check if user typed a full TV symbol (e.g., NYSE:JNJ)
    let shortSym = raw;
    let tvSym = raw;
    if (raw.includes(':')) {
      shortSym = raw.split(':')[1];
      tvSym = raw;
    }
    const cat = detectCategory(shortSym);
    unhideSymbol(shortSym);
    addToWatchlist(shortSym);
    addToCategoryList(shortSym, cat);
    // Save TV mapping if it's a full symbol
    if (raw.includes(':')) {
      const tvMap = loadTvMap();
      tvMap[shortSym] = tvSym;
      localStorage.setItem(CUSTOM_TV_KEY, JSON.stringify(tvMap));
    }
    setCategory('custom');
    setSymbol(shortSym);
    setQty(getDefaultQty(cat, balance));
  }

  function addFromSuggestion(s: SuggestedSymbol) {
    setShowSuggestions(false);
    setNewSymbol('');
    const dispCat = s.cat === 'indices' ? 'stocks' : s.cat;
    // Save TV mapping for accurate chart
    const tvMap = loadTvMap();
    tvMap[s.symbol] = s.tv;
    localStorage.setItem(CUSTOM_TV_KEY, JSON.stringify(tvMap));
    addToWatchlist(s.symbol);
    unhideSymbol(s.symbol);
    addToCategoryList(s.symbol, dispCat);
    setCategory('custom');
    setSymbol(s.symbol);
    setQty(getDefaultQty(dispCat, balance));
  }

  function removeCustomSymbol(sym: string) {
    // Remove from watchlist
    const list = customSymbols.filter((s) => s !== sym);
    setCustomSymbols(list);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    // Remove from its category too
    setAddedByCategory((prev) => {
      const next: Record<string, string[]> = {};
      for (const [cat, syms] of Object.entries(prev)) {
        next[cat] = syms.filter((s) => s !== sym);
      }
      localStorage.setItem(ADDED_CAT_KEY, JSON.stringify(next));
      return next;
    });
    // Also remove from TV map
    const tvMap = loadTvMap();
    if (tvMap[sym]) { delete tvMap[sym]; localStorage.setItem(CUSTOM_TV_KEY, JSON.stringify(tvMap)); }
    if (symbol === sym) {
      if (list[0]) { setSymbol(list[0]); }
      else { setCategory('forex'); setSymbol('EURUSD'); }
    }
  }

  function hideSymbol(sym: string) {
    const list = [...new Set([...hiddenSymbols, sym])];
    setHiddenSymbols(list);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(list));
    if (symbol === sym) {
      const remaining = symbols.filter((s) => s !== sym);
      if (remaining[0]) setSymbol(remaining[0]);
      else {
        // Fall back to first category with visible symbols
        for (const c of ['forex', 'crypto', 'stocks', 'metals']) {
          const vis = allSymbolsFor(c);
          if (vis.length > 0) { setCategory(c); setSymbol(vis[0]); return; }
        }
      }
    }
  }

  function restoreAllSymbols() {
    setHiddenSymbols([]);
    localStorage.removeItem(HIDDEN_KEY);
  }

  async function openTrade(side: 'buy' | 'sell') {
    if (!livePrice || busy || qty <= 0) return;
    const pendingCat = detectCategory(symbol);
    // Block opening when the market for this asset is closed (weekend/hours).
    // Crypto trades 24/7 and is always allowed.
    if (!isMarketOpen(pendingCat, symbol)) {
      setToast(isAr
        ? 'السوق مغلق لهذا الأصل، لا يمكن فتح صفقة. التداول متاح حالياً للكريبتو فقط (24/7).'
        : 'Market is closed for this asset — cannot open a trade. Trading is currently available for crypto only (24/7).');
      setTimeout(() => setToast(null), 3500);
      return;
    }
    setBusy(true);

    // Check that the resulting trade's margin fits within the account balance
    const notional = livePrice * qty * (pendingCat === 'forex' ? 100000 : pendingCat === 'metals' ? 100 : 1);
    const requiredMargin = notional / leverage;
    if (requiredMargin > balance) {
      setToast(isAr
        ? `هامش غير كافٍ (مطلوب $${requiredMargin.toFixed(0)} / الرصيد $${balance.toFixed(0)})`
        : `Insufficient margin (need $${requiredMargin.toFixed(0)} / balance $${balance.toFixed(0)})`);
      setTimeout(() => setToast(null), 3000);
      setBusy(false);
      return;
    }

    // SL/TP fields hold USD amounts; convert back to limit prices for execution.
    // TP goes on the profit side (above for buy / below for sell), SL on the
    // loss side (below for buy / above for sell).
    const cat = detectCategory(symbol);
    const isBuy = side === 'buy';
    const tpAmount = parseFloat(tpPrice);
    const slAmount = parseFloat(slPrice);
    let tpVal: number | null = null;
    let slVal: number | null = null;
    if (tpAmount > 0) tpVal = usdToPrice(symbol, tpAmount, livePrice, isBuy, qty, cat);
    else tpVal = matchedSignal?.takeProfit || null;
    if (slAmount > 0) slVal = usdToPrice(symbol, slAmount, livePrice, !isBuy, qty, cat);
    else slVal = matchedSignal?.stopLoss || null;
    const tradeData = { symbol, category: cat, side, qty, entryPrice: livePrice, status: 'open' as const, tp: tpVal, sl: slVal, openedAt: Date.now() };
    let id: string;
    try {
      id = await store.addTrade(tradeData);
    } catch (e) {
      // Fallback: save locally if Firestore fails
      id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      try {
        const raw = JSON.parse(localStorage.getItem('paper_trading_data') || '{"balance":10000,"trades":[]}');
        raw.trades.unshift({ ...tradeData, id });
        localStorage.setItem('paper_trading_data', JSON.stringify(raw));
      } catch {}
    }
    setTrades((prev) => [{ id, ...tradeData }, ...prev]);
    setTpPrice(''); setSlPrice('');
    setBusy(false);
    playOpenSound();
  }

  async function closeTrade(t: PaperTrade) {
    const exit = priceOf(t);
    if (!exit) return;
    if (!isMarketOpen(t.category, t.symbol)) {
      setToast(isAr
        ? 'السوق مغلق لهذا الأصل، لا يمكن إغلاق الصفقة حالياً. الكريبتو يعمل 24/7.'
        : 'Market is closed for this asset — cannot close the trade now. Crypto trades 24/7.');
      setTimeout(() => setToast(null), 3500);
      return;
    }
    await closeTradeInternal(t, exit, 'manual');
  }

  // Close all open trades at once at their current prices.
  async function closeAllTrades() {
    const open = tradesRef.current.filter((t) => t.status === 'open');
    const closable = open.filter((t) => priceMapRef.current[t.symbol] != null);
    if (closable.length === 0) {
      setToast(isAr ? 'لا توجد صفقات يمكن إغلاقها (لا توجد أسعار حالية)' : 'No closable open trades (no current price)');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setBusy(true);
    const now = Date.now();
    let totalPnl = 0;
    const closedMap: Record<string, PaperTrade> = {};
    let localWrite = false;
    for (const t of closable) {
      const exit = priceMapRef.current[t.symbol]!;
      const pnl = calcPnl(t, exit);
      totalPnl += pnl;
      closedMap[t.id] = { ...t, status: 'closed' as const, exitPrice: exit, pnl, closeReason: 'manual' as const, closedAt: now };
      try {
        await store.updateTrade(t.id, { status: 'closed', exitPrice: exit, pnl, closeReason: 'manual' as const, closedAt: now });
      } catch { localWrite = true; }
    }
    const newBalance = balanceRef.current + totalPnl;
    try {
      await store.saveBalance(newBalance);
    } catch { localWrite = true; }
    if (localWrite) {
      try {
        const raw = JSON.parse(localStorage.getItem('paper_trading_data') || '{"balance":10000,"trades":[]}');
        raw.trades = (raw.trades || []).map((x: any) => closedMap[x.id] ? { ...closedMap[x.id] } : x);
        raw.balance = newBalance;
        localStorage.setItem('paper_trading_data', JSON.stringify(raw));
      } catch {}
    }
    setBalance(newBalance);
    setTrades((prev) => prev.map((x) => closedMap[x.id] ? { ...x, ...closedMap[x.id] } : x));
    setBusy(false);
    setToast(isAr ? `تم إغلاق ${closable.length} صفقة دفعة واحدة` : `Closed ${closable.length} trades at once`);
    setTimeout(() => setToast(null), 2500);
    playCloseSound();
  }

  // Clear the closed-trades history (keeps open trades and balance unchanged).
  async function clearHistory() {
    if (closedTrades.length === 0) return;
    setBusy(true);
    try {
      await store.clearHistory();
    } catch {
      try {
        const raw = JSON.parse(localStorage.getItem('paper_trading_data') || '{"balance":10000,"trades":[]}');
        raw.trades = (raw.trades || []).filter((x: any) => x.status !== 'closed');
        localStorage.setItem('paper_trading_data', JSON.stringify(raw));
      } catch {}
    }
    setTrades((prev) => prev.filter((x) => x.status !== 'closed'));
    setBusy(false);
    setConfirmClear(false);
    setToast(isAr ? 'تم مسح السجل' : 'History cleared');
    setTimeout(() => setToast(null), 2000);
  }

  // Toggle the chart panel between normal and fullscreen (native browser fullscreen on the panel).
  async function toggleChartFullscreen() {
    const el = chartPanelRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
    setChartFullscreen(!!document.fullscreenElement);
  }

  useEffect(() => {
    const onFs = () => setChartFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // keep chart time axis always visible after expand/collapse
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    return () => clearTimeout(t);
  }, [symbolsCollapsed, ticketCollapsed]);

  // Manually adjust a TP/SL USD amount by $0.50 steps (up or down)
  const adjustPrice = (kind: 'tp' | 'sl', dir: number) => {
    const raw = kind === 'tp' ? tpPrice : slPrice;
    const base = parseFloat(raw);
    const val = isNaN(base) ? 0 : base;
    const next = Math.max(0, +(val + dir * 0.5).toFixed(2));
    if (kind === 'tp') setTpPrice(String(next)); else setSlPrice(String(next));
  };

  async function adjustSl(tradeId: string, newSl: number) {
    const v = newSl > 0 ? newSl : null;
    setTrades((prev) => prev.map((t) => t.id === tradeId ? { ...t, sl: v } : t));
    setPriceTick(p => p + 1);
    await store.updateTrade(tradeId, { sl: v });
  }

  async function adjustTp(tradeId: string, newTp: number) {
    const v = newTp > 0 ? newTp : null;
    setTrades((prev) => prev.map((t) => t.id === tradeId ? { ...t, tp: v } : t));
    setPriceTick(p => p + 1);
    await store.updateTrade(tradeId, { tp: v });
  }

  async function stepOpenTradeLevel(t: PaperTrade, kind: 'sl' | 'tp', dir: number) {
    const step = 0.25;
    const curUsd = kind === 'sl'
      ? (t.sl != null ? slAmountUSD(t.symbol, Math.abs(t.entryPrice - t.sl), t.qty, t.category) : 0)
      : (t.tp != null ? slAmountUSD(t.symbol, Math.abs(t.entryPrice - t.tp), t.qty, t.category) : 0);
    const nextUsd = +(curUsd + dir * step).toFixed(2);
    if (nextUsd <= 0) {
      playDragTick();
      if (kind === 'sl') await adjustSl(t.id, 0);
      else await adjustTp(t.id, 0);
      return;
    }
    const isBuy = kind === 'tp' ? t.side === 'buy' : t.side !== 'buy';
    const newPrice = usdToPrice(t.symbol, nextUsd, t.entryPrice, isBuy, t.qty, t.category);
    if (newPrice != null && isFinite(newPrice)) {
      playDragTick();
      if (kind === 'sl') await adjustSl(t.id, newPrice);
      else await adjustTp(t.id, newPrice);
    }
  }

  // Start inline editing of an open trade's SL/TP levels.
  // Values are shown/edited in USD amount (consistent with the open ticket).
  function startEditLevels(t: PaperTrade) {
    setEditSl(t.sl != null ? slAmountUSD(t.symbol, Math.abs(t.entryPrice - t.sl), t.qty, t.category).toFixed(2) : '');
    setEditTp(t.tp != null ? slAmountUSD(t.symbol, Math.abs(t.entryPrice - t.tp), t.qty, t.category).toFixed(2) : '');
    setEditId(t.id);
  }

  // Save the edited SL/TP levels and persist to the store.
  // The entered USD amounts are converted back to target prices using the
  // position side (TP on profit side, SL on loss side).
  async function saveEditLevels(t: PaperTrade) {
    const sl = parseFloat(editSl);
    const tp = parseFloat(editTp);
    let nextSl: number | null = null;
    let nextTp: number | null = null;
    if (isFinite(tp) && tp > 0) nextTp = usdToPrice(t.symbol, tp, t.entryPrice, t.side === 'buy', t.qty, t.category);
    if (isFinite(sl) && sl > 0) nextSl = usdToPrice(t.symbol, sl, t.entryPrice, t.side !== 'buy', t.qty, t.category);
    try {
      await store.updateTrade(t.id, { sl: nextSl, tp: nextTp });
    } catch {
      try {
        const raw = JSON.parse(localStorage.getItem('paper_trading_data') || '{"balance":10000,"trades":[]}');
        raw.trades = (raw.trades || []).map((x: any) => x.id === t.id ? { ...x, sl: nextSl, tp: nextTp } : x);
        localStorage.setItem('paper_trading_data', JSON.stringify(raw));
      } catch {}
    }
    setTrades((prev) => prev.map((x) => x.id === t.id ? { ...x, sl: nextSl, tp: nextTp } : x));
    // Ignore auto-close for ~10s so the trade is never closed instantly on the
    // current price right after setting the levels.
    levelCooldownRef.current[t.id] = Date.now() + 10000;
    setEditId(null);
    setToast(isAr ? 'تم تحديث الوقف/الهدف' : 'SL/TP updated');
    setTimeout(() => setToast(null), 2000);
  }

  async function changeLeverage(newLev: number) {
    setLeverage(newLev);
    try {
      await store.saveLeverage(newLev);
    } catch {
      try {
        const raw = JSON.parse(localStorage.getItem('paper_trading_data') || '{"balance":10000,"trades":[]}');
        raw.leverage = newLev;
        localStorage.setItem('paper_trading_data', JSON.stringify(raw));
      } catch {}
    }
    setToast(isAr ? `تم تغيير الرافعة إلى 1:${newLev}` : `Leverage set to 1:${newLev}`);
    setTimeout(() => setToast(null), 2000);
  }

  async function doReset(newBalance: number) {
    const val = Math.max(MIN_BALANCE, Math.floor(newBalance));
    setBusy(true);
    try {
      await store.resetAccount(val);
    } catch (e) {
      // Fallback: always save locally if Firestore fails
      try {
        localStorage.setItem('paper_trading_data', JSON.stringify({ balance: val, leverage: DEFAULT_LEVERAGE, trades: [] }));
      } catch {}
    }
    setBalance(val);
    setLeverage(DEFAULT_LEVERAGE);
    setTrades([]);
    setShowReset(false);
    setResetInput('');
    setQty(getDefaultQty(detectCategory(symbol || ''), val));
    setBusy(false);
  }

  const stats = React.useMemo(() => {
    const wins = closedTrades.filter((t) => (t.pnl ?? 0) > 0).length;
    const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const totalMargin = openTrades.reduce((s, t) => s + calcMargin(t, leverage), 0);
    const marginLevel = totalMargin > 0 ? Math.round((equity / totalMargin) * 100) : 0;
    return { total: closedTrades.length, winRate: closedTrades.length ? Math.round((wins / closedTrades.length) * 100) : 0, totalPnl, totalMargin, marginLevel };
  }, [closedTrades, openTrades.length, equity, leverage]);

  return (
    <div className="max-w-7xl mx-auto px-4 pt-2 pb-3 space-y-3">
      {/* Account bar */}
      <div className="rounded-2xl border border-[#F59E0B]/40 bg-gradient-to-r from-[#F59E0B]/15 via-transparent to-transparent px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#F59E0B] flex items-center justify-center shadow-lg shadow-[#F59E0B]/30">
            <TrendingUp size={20} className="text-black" />
          </div>
          <span className="text-lg font-black text-brand-text">{isAr ? 'تداول تلقائي' : 'Automatic Trading'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlatform('chart')}
            className={`px-6 py-2 rounded-2xl text-[20px] font-black uppercase transition-all leading-none ${
              platform === 'chart' ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            📊 {isAr ? 'الشارت' : 'Chart'}
          </button>
          <button
            onClick={() => window.open('https://metatraderweb.app', '_blank', 'noopener,noreferrer')}
            className="px-6 py-2 rounded-2xl text-[20px] font-black uppercase transition-all leading-none bg-sky-500 text-black hover:bg-sky-400 cursor-pointer active:scale-95"
            title={isAr ? 'افتح منصة MT5 الحقيقية في تبويب جديد لتسجيل الدخول والتداول' : 'Open the live MT5 platform in a new tab to log in and trade'}
          >
            📈 {isAr ? 'MT5 ويب' : 'MT5 Web'} ↗
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-4 py-1.5 rounded-xl bg-black/30 border border-white/10 text-center min-w-[110px]">
            <div className="text-[10px] font-black uppercase text-brand-text/50 tracking-wider">{isAr ? 'الرصيد' : 'Balance'}</div>
            <div className="text-base font-black text-emerald-400">${balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="px-4 py-1.5 rounded-xl bg-black/30 border border-white/10 text-center min-w-[110px]">
            <div className="text-[10px] font-black uppercase text-brand-text/50 tracking-wider">{isAr ? 'الإجمالي' : 'Equity'}</div>
            <div className={`text-base font-black ${unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${equity.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="px-4 py-1.5 rounded-xl bg-black/30 border border-white/10 text-center min-w-[110px]">
            <div className="text-[10px] font-black uppercase text-brand-text/50 tracking-wider">{isAr ? 'ربح مفتوح' : 'Open P&L'}</div>
            <div className={`text-base font-black ${unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMoney(unrealizedPnl)}</div>
          </div>
          <div
            className="px-4 py-1.5 rounded-xl bg-black/30 border border-white/10 text-center min-w-[120px]"
            title={isAr ? 'مستوى الهامش = الإجمالي ÷ الهامش المستخدم × 100' : 'Margin Level = Equity ÷ Used Margin × 100'}
          >
            <div className="text-[10px] font-black uppercase text-brand-text/50 tracking-wider">{isAr ? 'مستوى الهامش' : 'Margin Level'}</div>
            <div className={`text-base font-black ${stats.marginLevel >= 100 ? 'text-emerald-400' : stats.marginLevel > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
              {stats.marginLevel > 0 ? `${stats.marginLevel.toLocaleString('en-US')}%` : '—'}
            </div>
          </div>
          <div className="px-4 py-1.5 rounded-xl bg-black/30 border border-white/10 text-center min-w-[110px]">
            <div className="text-[10px] font-black uppercase text-brand-text/50 tracking-wider">{isAr ? 'الرافعة' : 'Leverage'}</div>
            <select
              value={leverage}
              onChange={(e) => changeLeverage(Number(e.target.value))}
              className="bg-transparent text-base font-black text-sky-300 focus:outline-none cursor-pointer text-center w-full"
              title={isAr ? 'الرافعة المالية' : 'Financial leverage'}
            >
              {LEVERAGE_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="bg-[#0a0f1a] text-white">1:{opt}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setResetInput(''); setShowReset(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-black uppercase shadow-lg shadow-red-500/10 active:scale-95 transition-all"
          >
            <RotateCcw size={16} />
            {isAr ? 'إعادة تعيين' : 'Reset'}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {/* Symbol Selector (full width) */}
        <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur-sm p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black uppercase tracking-wider text-brand-text/60">{isAr ? 'الرموز' : 'Symbols'}</span>
          </div>
          {!symbolsCollapsed && (
          <>
          <div className="flex flex-wrap gap-2">
              {CATEGORY_TABS.map((tabC) => (
                <button
                  key={tabC.key}
                  onClick={() => selectCategory(tabC.key)}
                  className={`px-4 py-2 rounded-xl text-2xl font-black transition-all border ${
                    category === tabC.key
                      ? 'bg-sky-500 text-black border-sky-400 shadow-lg shadow-sky-500/25'
                      : 'bg-sky-500/10 text-sky-300 border-sky-500/20 hover:bg-sky-500/20'
                  }`}
                >
                  {tabC.emoji} {isAr ? tabC.labelAr : tabC.labelEn}
                </button>
              ))}
              {customSymbols.length > 0 && (
                <button
                  onClick={() => selectCategory('custom')}
                  className={`px-4 py-2 rounded-xl text-2xl font-black transition-all border ${
                    category === 'custom'
                      ? 'bg-sky-500 text-black border-sky-400 shadow-lg shadow-sky-500/25'
                      : 'bg-sky-500/10 text-sky-300 border-sky-500/20 hover:bg-sky-500/20'
                  }`}
                >
                  👁️ {isAr ? 'المشاهد' : 'Watch'} ({customSymbols.length})
                </button>
              )}
            </div>

            {/* Symbols grid */}
            <div className="flex flex-wrap gap-1.5 max-h-[130px] overflow-y-auto">
              {symbols.length === 0 && category !== 'custom' && (
                <span className="text-sm font-bold text-brand-text/40 py-2">
                  {isAr ? 'لا رموز ظاهرة' : 'No visible symbols'}
                </span>
              )}
              {category === 'custom' && customSymbols.length === 0 && (
                <span className="text-sm font-bold text-brand-text/40 py-2">
                  {isAr ? 'أضف رمزك الأول من حقل البحث أعلاه' : 'Add your first symbol from the search field above'}
                </span>
              )}
              {symbols.map((sym) => {
                const isCustom = category === 'custom' || !ORIGINAL_SYMBOLS.has(sym);
                return (
                  <div key={sym} className="relative group">
                    <button
                      onClick={() => { setSymbol(sym); setQty(getDefaultQty(detectCategory(sym), balance)); }}
                      className={`pl-4 pr-8 py-2.5 rounded-xl text-lg font-black transition-all border ${
                        symbol === sym
                          ? 'bg-sky-400 text-black border-sky-300 shadow-lg shadow-sky-400/30'
                          : 'bg-sky-500/15 text-sky-300 border-sky-500/25 hover:bg-sky-500/30 hover:text-sky-200'
                      }`}
                    >
                      {sym}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); isCustom ? removeCustomSymbol(sym) : hideSymbol(sym); }}
                      title={isAr ? `حذف ${sym}` : `Remove ${sym}`}
                      className="absolute top-0 right-0 w-5 h-5 rounded-bl-lg rounded-tr-xl bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center opacity-70 group-hover:opacity-100 transition-all"
                    >
                      <X size={11} strokeWidth={3} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add custom symbol with search suggestions */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  dir="ltr"
                  value={newSymbol}
                  onChange={(e) => { setNewSymbol(e.target.value); setShowSuggestions(true); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (suggestions.length > 0 && showSuggestions) addFromSuggestion(suggestions[0]);
                      else addCustomSymbol();
                    }
                    if (e.key === 'Escape') setShowSuggestions(false);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder={isAr ? 'أي رمز TradingView — NYSE:JNJ أو BINANCE:BTCUSDT أو اكتب الرمز مباشرة' : 'Any TradingView symbol — NYSE:JNJ, BINANCE:BTCUSDT, or type directly'}
                  className="flex-1 h-11 rounded-xl bg-black/40 border border-white/15 px-4 text-base font-bold text-brand-text outline-none focus:border-sky-500 placeholder:text-brand-text/30 placeholder:font-medium placeholder:text-sm"
                />
                <button
                  onClick={addCustomSymbol}
                  disabled={!newSymbol.trim()}
                  className="h-11 px-5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-black font-black uppercase flex items-center gap-2 transition-all active:scale-95"
                >
                  <Plus size={18} />
                  {isAr ? 'إضافة' : 'Add'}
                </button>
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && newSymbol.trim() && suggestions.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-[#0a0f1a] border border-white/20 rounded-xl shadow-2xl z-40 max-h-[260px] overflow-y-auto">
                  {suggestions.map((s) => {
                    const added = customSymbols.includes(s.symbol);
                    const isCustom = !ORIGINAL_SYMBOLS.has(s.symbol);
                    return (
                      <button
                        key={s.symbol + s.tv}
                        onClick={() => addFromSuggestion(s)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-lg flex-shrink-0">{isCustom ? '➕' : catEmoji(s.cat)}</span>
                          <span className="text-sm font-black text-brand-text" dir="ltr">{s.symbol}</span>
                          <span className="text-xs font-bold text-brand-text/50 truncate">{isAr ? s.name : s.name}</span>
                        </div>
                        <span className={`flex-shrink-0 text-[10px] font-black uppercase px-2 py-1 rounded-md ${added ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-300'}`}>
                          {added ? (isAr ? 'مضاف ✓' : 'Added ✓') : (isAr ? '+ إضافة' : '+ Add')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>



            {/* Restore hidden symbols */}
            {hiddenSymbols.length > 0 && category !== 'custom' && (
              <button
                onClick={restoreAllSymbols}
                className="text-xs font-black text-sky-400 hover:text-sky-300 underline underline-offset-2"
              >
                {isAr ? `↩ استعادة الرموز المحذوفة (${hiddenSymbols.length})` : `↩ Restore removed symbols (${hiddenSymbols.length})`}
              </button>
            )}

          </>
          )}
          <div className="flex justify-center -mt-1">
              <button
                onClick={() => setSymbolsCollapsed(!symbolsCollapsed)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-brand-text transition-all active:scale-90"
                title={symbolsCollapsed ? (isAr ? 'توسيع الرموز' : 'Expand symbols') : (isAr ? 'طي الرموز' : 'Collapse symbols')}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform ${symbolsCollapsed ? '' : 'rotate-180'}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
            </div>

            {/* Order Ticket (full width) */}
          <div className={`rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm space-y-2 ${ticketCollapsed ? 'p-2 py-2' : 'p-4 space-y-3'}`}>
            <div className={`flex items-center justify-between gap-2 ${ticketCollapsed ? 'py-0' : ''}`}>
              <span className={`font-black text-brand-text uppercase tracking-wide ${ticketCollapsed ? 'text-base' : 'text-xl'}`}>{symbol || '—'}</span>
              {priceLoading ? (
                <Loader2 size={ticketCollapsed ? 14 : 18} className="animate-spin text-brand-text/50" />
              ) : (
                <span dir="ltr" className={`font-black text-emerald-400 ${ticketCollapsed ? 'text-lg' : 'text-2xl'}`}>{fmtPrice(livePrice)}</span>
              )}
            </div>
            {!ticketCollapsed && (
            <>
            {/* Qty */}
            <div>
              <label className="text-xs font-black uppercase text-brand-text/50 tracking-wider">
                {(() => {
                  const cat = detectCategory(symbol || '');
                  if (cat === 'forex' || cat === 'metals') return isAr ? 'الحجم (لوت)' : 'Volume (lots)';
                  if (cat === 'crypto') return isAr ? 'الكمية (وحدات)' : 'Quantity (units)';
                  return isAr ? 'عدد الأسهم' : 'Shares';
                })()}
              </label>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => setQty((q) => Math.max(0.01, +(q / 2).toFixed(4)))} className="w-11 h-11 rounded-xl bg-white/10 text-brand-text text-lg font-black hover:bg-white/20">÷</button>
                <input
                  type="text" inputMode="decimal" lang="en" dir="ltr"
                  value={String(qty)}
                  onChange={(e) => setQty(parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
                  className="flex-1 h-11 rounded-xl bg-black/40 border border-white/15 text-center text-lg font-black text-brand-text outline-none focus:border-emerald-500"
                  style={{ direction: 'ltr' }}
                />
                <button onClick={() => setQty((q) => +(q * 2).toFixed(4))} className="w-11 h-11 rounded-xl bg-white/10 text-brand-text text-lg font-black hover:bg-white/20">×</button>
              </div>
              <div className="flex gap-1.5 mt-2">
                {[0.01, 0.1, 0.5, 1, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => setQty(v)}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-black transition-all ${qty === v ? 'bg-[#F59E0B] text-black' : 'bg-white/5 text-brand-text/60 hover:bg-white/10'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* TP/SL dollar amounts */}
            <div className="grid grid-cols-2 gap-2 items-start">
              <div className="min-w-0">
                <label className="block text-xs font-black uppercase text-emerald-400/90 tracking-wider truncate">{isAr ? 'جني الأرباح ($)' : 'Take Profit ($)'}</label>
                <div className="flex items-stretch gap-1.5 mt-1 min-w-0">
                  <button onClick={() => adjustPrice('tp', -1)} className="w-11 h-11 shrink-0 rounded-xl bg-white/10 text-brand-text text-lg font-black hover:bg-white/20">−</button>
                  <input
                    type="text" inputMode="decimal" lang="en" dir="ltr"
                    placeholder="$"
                    value={tpPrice}
                    onChange={(e) => setTpPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="flex-1 w-full min-w-0 h-11 rounded-xl bg-black/40 border border-white/15 text-center text-base font-bold text-brand-text outline-none focus:border-emerald-500 placeholder:text-brand-text/25 placeholder:text-sm"
                    style={{ direction: 'ltr' }}
                  />
                  <button onClick={() => adjustPrice('tp', 1)} className="w-11 h-11 shrink-0 rounded-xl bg-white/10 text-brand-text text-lg font-black hover:bg-white/20">+</button>
                </div>
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-black uppercase text-red-400/90 tracking-wider truncate">{isAr ? 'وقف الخسارة ($)' : 'Stop Loss ($)'}</label>
                <div className="flex items-stretch gap-1.5 mt-1 min-w-0">
                  <button onClick={() => adjustPrice('sl', -1)} className="w-11 h-11 shrink-0 rounded-xl bg-white/10 text-brand-text text-lg font-black hover:bg-white/20">−</button>
                  <input
                    type="text" inputMode="decimal" lang="en" dir="ltr"
                    placeholder="$"
                    value={slPrice}
                    onChange={(e) => setSlPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="flex-1 w-full min-w-0 h-11 rounded-xl bg-black/40 border border-white/15 text-center text-base font-bold text-brand-text outline-none focus:border-red-500 placeholder:text-brand-text/25 placeholder:text-sm"
                    style={{ direction: 'ltr' }}
                  />
                  <button onClick={() => adjustPrice('sl', 1)} className="w-11 h-11 shrink-0 rounded-xl bg-white/10 text-brand-text text-lg font-black hover:bg-white/20">+</button>
                </div>
              </div>
            </div>

            {/* Buy/Sell */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => openTrade('buy')}
                disabled={!livePrice || busy || qty <= 0}
                className="py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-black text-lg font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
              >
                {isAr ? 'شراء' : 'Buy'}
              </button>
              <button
                onClick={() => openTrade('sell')}
                disabled={!livePrice || busy || qty <= 0}
                className="py-4 rounded-2xl bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-lg font-black uppercase tracking-wider shadow-lg shadow-red-500/25 active:scale-95 transition-all"
              >
                {isAr ? 'بيع' : 'Sell'}
              </button>
            </div>
            {!livePrice && !priceLoading && symbol && (
              <p className="text-xs font-bold text-yellow-400/90 text-center">
                {isAr ? 'السعر غير متاح لهذا الرمز حالياً' : 'Live price unavailable for this symbol'}
              </p>
            )}

          {/* Stats mini */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-[10px] font-black uppercase text-brand-text/50">{isAr ? 'صفقات' : 'Trades'}</div>
              <div className="text-lg font-black text-brand-text">{stats.total}</div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase text-brand-text/50">{isAr ? 'نسبة الفوز' : 'Win rate'}</div>
              <div className="text-lg font-black text-emerald-400">{stats.winRate}%</div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase text-brand-text/50">{isAr ? 'صافي الربح' : 'Net P&L'}</div>
              <div className={`text-lg font-black ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMoney(stats.totalPnl)}</div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase text-brand-text/50">{isAr ? 'الهامش' : 'Margin'}</div>
              <div className={`text-lg font-black ${stats.marginLevel > 200 ? 'text-emerald-400' : stats.marginLevel > 100 ? 'text-yellow-400' : 'text-red-400'}`}>
                {stats.totalMargin > 0 ? `${stats.marginLevel}%` : '—'}
              </div>
            </div>
          </div>
          </>
          )}
          <div className={`flex justify-center ${ticketCollapsed ? '-mt-1' : ''}`}>
            <button
              onClick={() => setTicketCollapsed(!ticketCollapsed)}
              className={`${ticketCollapsed ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-brand-text transition-all active:scale-90`}
              title={ticketCollapsed ? (isAr ? 'توسيع فتح الصفقات' : 'Expand order ticket') : (isAr ? 'طي فتح الصفقات' : 'Collapse order ticket')}
            >
              <svg width={ticketCollapsed ? "28" : "37"} height={ticketCollapsed ? "28" : "37"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform ${ticketCollapsed ? '' : 'rotate-180'}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
          </div>

          {/* Chart / MT5 - يبقى خط التاريخ السفلي ظاهراً مهما فُتحت الأقسام */}
          <div ref={chartPanelRef} className={`rounded-2xl overflow-hidden border border-white/10 bg-black/20 pb-3 relative flex flex-col flex-shrink-0 ${
            symbolsCollapsed && ticketCollapsed ? 'h-[72vh] min-h-[500px] -mt-1' : symbolsCollapsed || ticketCollapsed ? 'h-[62vh] min-h-[440px]' : 'h-[50vh] min-h-[380px]'
          }`}>
            {/* Toggle bar */}
            <div className="flex items-center gap-1 px-2 py-1.5 bg-black/40 border-b border-white/10 flex-shrink-0">
              {platform === 'chart' && (
                <>
                  <button
                    onClick={toggleChartFullscreen}
                    className="flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 text-brand-text/70 hover:text-white px-2.5 py-1 text-xs font-black uppercase tracking-wider transition-colors"
                    title={isAr ? (chartFullscreen ? 'خروج من ملء الشاشة' : 'ملء الشاشة') : (chartFullscreen ? 'Exit fullscreen' : 'Fullscreen')}
                  >
                    {chartFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                    {isAr ? (chartFullscreen ? 'خروج' : 'ملء الشاشة') : (chartFullscreen ? 'Exit' : 'Fullscreen')}
                  </button>
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-black text-white">{symbol}</span>
                    {!priceLoading && <span className="text-xs font-bold text-emerald-400">{fmtPrice(livePrice)}</span>}
                  </div>
                </>
              )}
            </div>
            {/* Content */}
            <div className="flex-1 relative">
              {platform === 'chart' ? (
                <>
                  {(() => {
                    const activeTrade = openTrades.find(t => t.symbol === symbol);
                    return (
                      <TradingViewWidget
                        key={symbol}
                        symbol={symbol}
                        entryPrice={activeTrade?.entryPrice}
                        sl={activeTrade?.sl}
                        tp={activeTrade?.tp}
                        side={activeTrade?.side}
                        category={activeTrade?.category}
                        qty={activeTrade?.qty}
                        openedAt={activeTrade?.openedAt}
                        livePrice={livePrice}
                        onSlChange={activeTrade ? (p) => adjustSl(activeTrade.id, p) : undefined}
                        onTpChange={activeTrade ? (p) => adjustTp(activeTrade.id, p) : undefined}
                      />
                    );
                  })()}
                </>
              ) : (
                <MT5Web symbol={symbol} />
              )}
            </div>
          </div>
      </div>

      {/* Positions / History */}
      <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur-sm overflow-hidden">
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setTab('positions')}
            className={`flex-1 py-3 text-base font-black uppercase tracking-wider transition-colors ${tab === 'positions' ? 'bg-white/10 text-brand-text border-b-2 border-[#F59E0B]' : 'text-brand-text/50 hover:text-brand-text/80'}`}
          >
            {isAr ? `الصفقات المفتوحة (${openTrades.length})` : `Positions (${openTrades.length})`}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-3 text-base font-black uppercase tracking-wider transition-colors ${tab === 'history' ? 'bg-white/10 text-brand-text border-b-2 border-[#F59E0B]' : 'text-brand-text/50 hover:text-brand-text/80'}`}
          >
            {isAr ? 'السجل' : 'History'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-white/10">
          <span className="text-sm font-bold text-brand-text/50">
            {tab === 'positions'
              ? (isAr ? `الصفقات المفتوحة: ${openTrades.length}` : `Open positions: ${openTrades.length}`)
              : (isAr ? `إجمالي السجل: ${closedTrades.length}` : `History entries: ${closedTrades.length}`)}
          </span>
          {tab === 'positions' && openTrades.length > 0 ? (
            <button
              onClick={() => closeAllTrades()}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 px-3 py-1.5 text-xs font-black text-white uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              <XCircle size={14} />
              {isAr ? 'إغلاق الكل' : 'Close All'}
            </button>
          ) : tab === 'history' && closedTrades.length > 0 ? (
            <button
              onClick={() => {
                if (!confirmClear) {
                  setConfirmClear(true);
                  setTimeout(() => setConfirmClear(false), 3000);
                  return;
                }
                clearHistory();
              }}
              disabled={busy}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black text-white uppercase tracking-wider transition-colors disabled:opacity-50 ${confirmClear ? 'bg-red-500 hover:bg-red-600' : 'bg-white/10 hover:bg-white/20'}`}
            >
              <Trash2 size={14} />
              {confirmClear ? (isAr ? 'تأكيد المسح' : 'Confirm') : (isAr ? 'مسح السجل' : 'Clear History')}
            </button>
          ) : null}
        </div>

        <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
          {tab === 'positions' ? (
            openTrades.length === 0 ? (
              <div className="py-8 text-center text-lg font-bold text-brand-text/40">
                {isAr ? 'لا توجد صفقات مفتوحة' : 'No open positions'}
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-sm font-black uppercase text-brand-text/40 tracking-wider border-b border-white/10">
                    <th className="px-4 py-3">{isAr ? 'الرمز' : 'Symbol'}</th>
                    <th className="px-4 py-3">{isAr ? 'الاتجاه' : 'Side'}</th>
                    <th className="px-4 py-3">{isAr ? 'الحجم' : 'Qty'}</th>
                    <th className="px-4 py-3">{isAr ? 'الدخول' : 'Entry'}</th>
                    <th className="px-4 py-3">{isAr ? 'الحالي' : 'Current'}</th>
                    <th className="px-4 py-3">{isAr ? 'الهامش' : 'Margin'}</th>
                    <th className="px-4 py-3">{isAr ? 'الوقف/الهدف' : 'SL / TP'}</th>
                    <th className="px-4 py-3">{isAr ? 'الوقت' : 'Time'}</th>
                    <th className="px-4 py-3">{isAr ? 'الربح/الخسارة' : 'P&L'}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {openTrades.map((t) => {
                    const cur = priceOf(t);
                    const pnl = cur != null ? calcPnl(t, cur) : 0;
                    const margin = calcMargin(t, leverage);
                    const slUsd = t.sl != null ? slAmountUSD(t.symbol, Math.abs(t.entryPrice - t.sl), t.qty, t.category) : null;
                    const tpUsd = t.tp != null ? slAmountUSD(t.symbol, Math.abs(t.entryPrice - t.tp), t.qty, t.category) : null;
                    return (
                      <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 relative">
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const cat = detectCategory(t.symbol);
                              setCategory(cat);
                              setSymbol(t.symbol);
                              setQty(getDefaultQty(cat, balance));
                              setPopId(t.id);
                              setTimeout(() => setPopId(null), 600);
                              setToast(`${isAr ? 'تم فتح شارت' : 'Opening chart for'} ${t.symbol}`);
                              setTimeout(() => setToast(null), 2000);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="relative px-3 py-1.5 rounded-lg text-lg font-black text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 hover:border-sky-400/50 cursor-pointer transition-all active:scale-95"
                          >
                            {popId === t.id && (
                              <span className="absolute inset-0 rounded-lg animate-ping bg-sky-400/30 pointer-events-none" />
                            )}
                            {t.symbol}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1.5 rounded-lg text-lg font-black uppercase ${t.side === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {t.side === 'buy' ? (isAr ? 'شراء' : 'BUY') : (isAr ? 'بيع' : 'SELL')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xl font-bold text-brand-text/80" dir="ltr">{t.qty}</td>
                        <td className="px-4 py-3 text-xl font-bold text-brand-text/80" dir="ltr">{fmtPrice(t.entryPrice)}</td>
                        <td className="px-4 py-3 text-xl font-bold text-brand-text/80" dir="ltr">{cur ? fmtPrice(cur) : '—'}</td>
                        <td className="px-4 py-3 text-lg font-bold text-sky-400" dir="ltr">${margin.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                        <td className="px-4 py-3">
                          {editId === t.id ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editSl}
                                onChange={(e) => setEditSl(normalizeDecimal(e.target.value))}
                                placeholder="SL $"
                                className="w-24 px-2 py-1 rounded-md bg-black/40 border border-red-500/40 text-red-400 text-base font-bold focus:outline-none focus:border-red-400"
                                dir="ltr"
                              />
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editTp}
                                onChange={(e) => setEditTp(normalizeDecimal(e.target.value))}
                                placeholder="TP $"
                                className="w-24 px-2 py-1 rounded-md bg-black/40 border border-emerald-500/40 text-emerald-400 text-base font-bold focus:outline-none focus:border-emerald-400"
                                dir="ltr"
                              />
                              <button
                                onClick={() => saveEditLevels(t)}
                                className="w-8 h-8 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40 flex items-center justify-center transition-colors"
                                title={isAr ? 'حفظ' : 'Save'}
                              >
                                <Check size={17} />
                              </button>
                              <button
                                onClick={() => setEditId(null)}
                                className="w-8 h-8 rounded-md bg-white/10 text-brand-text/70 hover:bg-white/20 flex items-center justify-center transition-colors"
                                title={isAr ? 'إلغاء' : 'Cancel'}
                              >
                                <X size={17} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center gap-0.5">
                                <span className={`text-base font-bold min-w-[52px] text-center ${t.sl != null ? 'text-red-400' : 'text-brand-text/25'}`} dir="ltr">{slUsd != null ? `$${slUsd.toFixed(2)}` : '—'}</span>
                                <div className="flex flex-col gap-0.5">
                                  <button onClick={() => stepOpenTradeLevel(t, 'sl', 1)} className="w-6 h-3.5 rounded bg-red-500/15 hover:bg-red-500/30 text-red-300 flex items-center justify-center active:scale-90 transition-all" title="زيادة SL">▲</button>
                                  <button onClick={() => stepOpenTradeLevel(t, 'sl', -1)} className="w-6 h-3.5 rounded bg-red-500/15 hover:bg-red-500/30 text-red-300 flex items-center justify-center active:scale-90 transition-all" title="نقص SL">▼</button>
                                </div>
                              </div>
                              <span className="text-brand-text/30">/</span>
                              <div className="flex items-center gap-0.5">
                                <span className={`text-base font-bold min-w-[52px] text-center ${t.tp != null ? 'text-emerald-400' : 'text-brand-text/25'}`} dir="ltr">{tpUsd != null ? `$${tpUsd.toFixed(2)}` : '—'}</span>
                                <div className="flex flex-col gap-0.5">
                                  <button onClick={() => stepOpenTradeLevel(t, 'tp', 1)} className="w-6 h-3.5 rounded bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 flex items-center justify-center active:scale-90 transition-all" title="زيادة TP">▲</button>
                                  <button onClick={() => stepOpenTradeLevel(t, 'tp', -1)} className="w-6 h-3.5 rounded bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 flex items-center justify-center active:scale-90 transition-all" title="نقص TP">▼</button>
                                </div>
                              </div>
                              <button
                                onClick={() => startEditLevels(t)}
                                className="w-7 h-7 rounded-md bg-white/10 text-brand-text/60 hover:text-sky-300 hover:bg-sky-500/20 flex items-center justify-center transition-colors ml-1"
                                title={isAr ? 'تعديل الوقف/الهدف (بالدولار)' : 'Edit SL / TP (USD)'}
                              >
                                <Pencil size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-lg font-bold text-brand-text/60" dir="ltr">
                          {(() => {
                            const d = new Date(t.openedAt);
                            const y = d.getFullYear();
                            const mo = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            const hh = String(d.getHours()).padStart(2, '0');
                            const mm = String(d.getMinutes()).padStart(2, '0');
                            return `${y}-${mo}-${day} ${hh}:${mm}`;
                          })()}
                        </td>
                        <td className={`px-4 py-3 text-xl font-black ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">{cur ? fmtMoney(pnl) : '—'}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => closeTrade(t)}
                            disabled={!cur}
                            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 disabled:opacity-40 text-lg font-black uppercase transition-colors"
                          >
                            {isAr ? 'إغلاق' : 'Close'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            closedTrades.length === 0 ? (
              <div className="py-8 text-center text-base font-bold text-brand-text/40">
                {isAr ? 'لا يوجد سجل بعد' : 'No history yet'}
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-sm font-black uppercase text-brand-text/40 tracking-wider border-b border-white/10">
                    <th className="px-4 py-3">{isAr ? 'الرمز' : 'Symbol'}</th>
                    <th className="px-4 py-3">{isAr ? 'الاتجاه' : 'Side'}</th>
                    <th className="px-4 py-3">{isAr ? 'الدخول' : 'Entry'}</th>
                    <th className="px-4 py-3">{isAr ? 'الخروج' : 'Exit'}</th>
                    <th className="px-4 py-3">{isAr ? 'وقت الفتح' : 'Opened'}</th>
                    <th className="px-4 py-3">{isAr ? 'وقت الإغلاق' : 'Closed'}</th>
                    <th className="px-4 py-3">{isAr ? 'السبب' : 'Reason'}</th>
                    <th className="px-4 py-3">{isAr ? 'النتيجة' : 'Result'}</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map((t) => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3">
                        <span className="inline-block px-3 py-1.5 rounded-lg text-lg font-black text-brand-text">
                          {t.symbol}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1.5 rounded-lg text-lg font-black uppercase ${t.side === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {t.side === 'buy' ? (isAr ? 'شراء' : 'BUY') : (isAr ? 'بيع' : 'SELL')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xl font-bold text-brand-text/80" dir="ltr">{fmtPrice(t.entryPrice)}</td>
                      <td className="px-4 py-3 text-xl font-bold text-brand-text/80" dir="ltr">{fmtPrice(t.exitPrice)}</td>
                      <td className="px-4 py-3 text-lg font-bold text-brand-text/60" dir="ltr">{(() => { const d = new Date(t.openedAt); const y = d.getFullYear(); const mo = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); const hh = String(d.getHours()).padStart(2, '0'); const mm = String(d.getMinutes()).padStart(2, '0'); const ss = String(d.getSeconds()).padStart(2, '0'); return `${y}-${mo}-${day} ${hh}:${mm}:${ss}`; })()}</td>
                      <td className="px-4 py-3 text-lg font-bold text-brand-text/60" dir="ltr">{t.closedAt ? (() => { const d = new Date(t.closedAt); const y = d.getFullYear(); const mo = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); const hh = String(d.getHours()).padStart(2, '0'); const mm = String(d.getMinutes()).padStart(2, '0'); const ss = String(d.getSeconds()).padStart(2, '0'); return `${y}-${mo}-${day} ${hh}:${mm}:${ss}`; })() : '—'}</td>
                      <td className="px-4 py-3 text-lg font-black uppercase text-brand-text/50">
                        {t.closeReason === 'tp' ? 'TP' : t.closeReason === 'sl' ? 'SL' : (isAr ? 'يدوي' : 'Manual')}
                      </td>
                      <td className={`px-4 py-3 text-xl font-black ${(t.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">{fmtMoney(t.pnl ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* Info Footer */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 flex items-start gap-3">
        <Info size={16} className="text-sky-400 flex-shrink-0 mt-0.5" />
        <span className="text-xs font-bold text-brand-text/60 leading-relaxed">
          {isAr
            ? 'تداول تجريبي بالكامل بأموال وهمية وأسعار حقيقية لحظية. يمكنك إضافة أي رمز من حقل الإضافة أعلاه.'
            : 'Fully simulated trading with virtual funds and real-time prices. Add any symbol using the field above.'}
        </span>
      </div>

      {/* Reset Account Modal */}
      {showReset && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !busy && setShowReset(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0a0f1a] p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-brand-text flex items-center gap-2">
                <RotateCcw size={20} className="text-red-400" />
                {isAr ? 'إعادة تعيين الحساب' : 'Reset Account'}
              </h3>
              <button onClick={() => setShowReset(false)} disabled={busy} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-brand-text">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs font-bold text-yellow-400/90 leading-relaxed">
              {isAr
                ? 'سيتم حذف جميع الصفقات وإعادة الرصيد إلى القيمة المحددة.'
                : 'All trades will be deleted and balance reset to the chosen value.'}
            </p>

            {/* Custom balance input */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-brand-text/60">$</span>
                <input
                  type="text" inputMode="numeric" lang="en" dir="ltr"
                  value={resetInput}
                  onChange={(e) => setResetInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={isAr ? 'اكتب الرصيد المطلوب' : 'Enter balance'}
                  className="flex-1 h-14 rounded-xl bg-black/40 border border-white/15 px-4 text-2xl font-black text-brand-text outline-none focus:border-sky-500 placeholder:text-brand-text/25 placeholder:text-base"
                  style={{ direction: 'ltr' }}
                  autoFocus
                />
              </div>
              {resetInput && resetVal >= MIN_BALANCE && (
                <p className="mt-2 text-xs font-bold text-brand-text/50">
                  {isAr ? `الحجم الافتراضي: ${(getDefaultQty('forex', resetVal)).toFixed(2)} لوت` : `Default volume: ${(getDefaultQty('forex', resetVal)).toFixed(2)} lots`}
                </p>
              )}
              {resetInput && resetVal < MIN_BALANCE && (
                <p className="mt-2 text-xs font-bold text-red-400">
                  {isAr ? `الحد الأدنى $${MIN_BALANCE}` : `Minimum $${MIN_BALANCE}`}
                </p>
              )}
            </div>

            {/* Quick presets */}
            <div className="flex gap-1.5">
              {[500, 1000, 2500, 5000, 10000].map((v) => (
                <button
                  key={v}
                  onClick={() => setResetInput(String(v))}
                  className={`flex-1 py-2 rounded-lg text-sm font-black transition-all ${resetInput === String(v) ? 'bg-sky-500 text-black' : 'bg-white/5 text-brand-text/60 hover:bg-white/10'}`}
                >
                  {v.toLocaleString('en-US')}
                </button>
              ))}
            </div>

            <button
              onClick={() => doReset(resetVal)}
              disabled={busy || resetVal < MIN_BALANCE}
              className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg"
            >
              {busy ? <Loader2 size={20} className="animate-spin" /> : <RotateCcw size={20} />}
              {isAr ? 'تأكيد' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] animate-bounce">
          <div className="px-5 py-3 rounded-2xl bg-sky-500 text-white text-sm font-black shadow-2xl shadow-sky-500/40 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
