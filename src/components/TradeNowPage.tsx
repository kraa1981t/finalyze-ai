import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, TrendingUp, Info, Wallet, X, Loader2, Plus } from 'lucide-react';
import { User } from 'firebase/auth';
import { SYMBOL_CATEGORIES } from '../constants';
import { Language } from '../lib/i18n';
import TradingViewWidget from './TradingViewWidget';
import {
  PaperTrade, getTradeStore, getLivePrice, subscribePrices,
  calcPnl, getDefaultQty, START_BALANCE,
} from '../services/paperTradingService';
import { searchSymbols, catEmoji, SuggestedSymbol } from '../services/symbolSuggestions';

interface TradeNowPageProps {
  lang: Language;
  user: User | null;
}

const CUSTOM_KEY = 'paper_trading_custom_symbols';
const CUSTOM_TV_KEY = 'paper_trading_custom_tv_map';
const HIDDEN_KEY = 'paper_trading_hidden_symbols';

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

function toTvSymbol(sym: string): string {
  const s = sym.trim().toUpperCase();
  const tvMap = loadTvMap();
  if (tvMap[s]) return tvMap[s];
  if (s.includes(':')) return s; // full TV symbol e.g. NASDAQ:TSLA
  if ((SYMBOL_CATEGORIES.crypto as string[]).includes(s)) return `BINANCE:${s.replace('USD', 'USDT')}`;
  if ((SYMBOL_CATEGORIES.metals as string[]).includes(s)) return `OANDA:${s}`;
  if ((SYMBOL_CATEGORIES.forex as string[]).includes(s)) return `FX:${s}`;
  const indexMap: Record<string, string> = {
    US500: 'FOREXCOM:SPXUSD', US30: 'FOREXCOM:NSXUSD', US100: 'FOREXCOM:NDXUSD',
    SPY: 'AMEX:SPY', QQQ: 'NASDAQ:QQQ',
  };
  if (indexMap[s]) return indexMap[s];
  return `NASDAQ:${s}`;
}

function detectCategory(sym: string): string {
  const s = sym.toUpperCase().replace(/[-_=]/g, '');
  for (const [cat, syms] of Object.entries(SYMBOL_CATEGORIES)) {
    if ((syms as string[]).includes(s)) return cat;
  }
  if (/BTC|ETH|USDT|COIN|DOGE/.test(s)) return 'crypto';
  if (/XAU|XAG|GOLD|SILVER/.test(s)) return 'metals';
  return 'stocks';
}

const fmtMoney = (v: number) =>
  `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPrice = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 });

export default function TradeNowPage({ lang, user }: TradeNowPageProps) {
  const isAr = lang === 'ar';
  const [category, setCategory] = useState<string>('forex');
  const [symbol, setSymbol] = useState<string>('EURUSD');

  // Custom symbols
  const [customSymbols, setCustomSymbols] = useState<string[]>(loadCustomSymbols);
  const [hiddenSymbols, setHiddenSymbols] = useState<string[]>(loadHiddenSymbols);
  const [newSymbol, setNewSymbol] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = searchSymbols(newSymbol);

  // Trading state
  const [balance, setBalance] = useState<number>(START_BALANCE);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [qty, setQty] = useState<number>(getDefaultQty('forex'));
  const [tpPercent, setTpPercent] = useState<string>('');
  const [slPercent, setSlPercent] = useState<string>('');
  const [tab, setTab] = useState<'positions' | 'history'>('positions');
  const [busy, setBusy] = useState(false);
  const [priceLoading, setPriceLoading] = useState(true);

  const store = getTradeStore(user);

  const allSymbolsFor = (cat: string): string[] => {
    if (cat === 'custom') return customSymbols;
    return (SYMBOL_CATEGORIES[cat as keyof typeof SYMBOL_CATEGORIES] || []).filter((s) => !hiddenSymbols.includes(s));
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
        setTrades(list.sort((a, b) => b.openedAt - a.openedAt));
      } catch {}
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
    });
    return unsub;
  }, [symbol, openTrades.length]);

  const checkAutoClose = useCallback(async (sym: string, price: number) => {
    const targets = trades.filter((t) => t.status === 'open' && t.symbol === sym);
    for (const t of targets) {
      const hitTp = t.tp != null && ((t.side === 'buy' && price >= t.tp) || (t.side === 'sell' && price <= t.tp));
      const hitSl = t.sl != null && ((t.side === 'buy' && price <= t.sl) || (t.side === 'sell' && price >= t.sl));
      if (hitTp || hitSl) await closeTradeInternal(t, price, hitTp ? 'tp' : 'sl');
    }
  }, [trades, balance]);

  async function closeTradeInternal(t: PaperTrade, exitPrice: number, reason: 'manual' | 'tp' | 'sl') {
    const pnl = calcPnl(t, exitPrice);
    await store.updateTrade(t.id, { status: 'closed', exitPrice, pnl, closeReason: reason, closedAt: Date.now() });
    const newBalance = balance + pnl;
    setBalance(newBalance);
    await store.saveBalance(newBalance);
    setTrades((prev) => prev.map((x) => x.id === t.id ? { ...x, status: 'closed', exitPrice, pnl, closeReason: reason, closedAt: Date.now() } : x));
  }

  function selectCategory(key: string) {
    setCategory(key);
    const first = allSymbolsFor(key)[0] || '';
    setSymbol(first);
    if (first) setQty(getDefaultQty(detectCategory(first)));
  }

  function addCustomSymbol() {
    const raw = newSymbol.trim().toUpperCase();
    if (!raw) return;
    if (customSymbols.includes(raw)) { setNewSymbol(''); setShowSuggestions(false); return; }
    const list = [...customSymbols, raw];
    setCustomSymbols(list);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    setNewSymbol('');
    setShowSuggestions(false);
    // Jump straight into the new symbol
    setCategory('custom');
    setSymbol(raw);
    setQty(getDefaultQty(detectCategory(raw)));
  }

  function addFromSuggestion(s: SuggestedSymbol) {
    let list = customSymbols;
    if (!list.includes(s.symbol)) {
      list = [...list, s.symbol];
      setCustomSymbols(list);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
      const tvMap = loadTvMap();
      tvMap[s.symbol] = s.tv;
      localStorage.setItem(CUSTOM_TV_KEY, JSON.stringify(tvMap));
    }
    setNewSymbol('');
    setShowSuggestions(false);
    setCategory('custom');
    setSymbol(s.symbol);
    setQty(getDefaultQty(detectCategory(s.symbol)));
  }

  function removeCustomSymbol(sym: string) {
    const list = customSymbols.filter((s) => s !== sym);
    setCustomSymbols(list);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
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
    setBusy(true);
    try {
      const tpVal = tpPercent ? (side === 'buy'
        ? livePrice * (1 + parseFloat(tpPercent) / 100)
        : livePrice * (1 - parseFloat(tpPercent) / 100)) : null;
      const slVal = slPercent ? (side === 'buy'
        ? livePrice * (1 - parseFloat(slPercent) / 100)
        : livePrice * (1 + parseFloat(slPercent) / 100)) : null;
      const cat = detectCategory(symbol);
      const id = await store.addTrade({
        symbol, category: cat, side, qty,
        entryPrice: livePrice,
        status: 'open',
        tp: tpVal, sl: slVal,
        openedAt: Date.now(),
      });
      setTrades((prev) => [{ id, symbol, category: cat, side, qty, entryPrice: livePrice, status: 'open', tp: tpVal, sl: slVal, openedAt: Date.now() }, ...prev]);
      setTpPercent(''); setSlPercent('');
    } finally {
      setBusy(false);
    }
  }

  async function closeTrade(t: PaperTrade) {
    const exit = priceOf(t);
    if (!exit) return;
    await closeTradeInternal(t, exit, 'manual');
  }

  const stats = React.useMemo(() => {
    const wins = closedTrades.filter((t) => (t.pnl ?? 0) > 0).length;
    const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    return { total: closedTrades.length, winRate: closedTrades.length ? Math.round((wins / closedTrades.length) * 100) : 0, totalPnl };
  }, [closedTrades]);

  return (
    <div className="max-w-7xl mx-auto px-4 pt-2 pb-3 space-y-3">
      {/* Account bar */}
      <div className="rounded-2xl border border-[#F59E0B]/40 bg-gradient-to-r from-[#F59E0B]/15 via-transparent to-transparent px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[#F59E0B] flex items-center justify-center shadow-lg shadow-[#F59E0B]/30">
            <TrendingUp size={20} className="text-black" />
          </div>
          <span className="text-lg font-black text-brand-text">{isAr ? 'تداول الآن' : 'Trade Now'}</span>
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
          <a
            href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(toTvSymbol(symbol))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#d97706] text-black font-black uppercase shadow-lg shadow-[#F59E0B]/30 active:scale-95 transition-all"
          >
            <ExternalLink size={16} />
            TradingView
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left: Symbol selector + Chart */}
        <div className="lg:col-span-2 space-y-2">
          {/* Symbol Selector */}
          <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur-sm p-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_TABS.map((tabC) => (
                <button
                  key={tabC.key}
                  onClick={() => selectCategory(tabC.key)}
                  className={`px-5 py-2.5 rounded-xl text-lg font-black transition-all border ${
                    category === tabC.key
                      ? 'bg-[#F59E0B] text-black border-[#F59E0B] shadow-lg shadow-[#F59E0B]/25'
                      : 'bg-white/5 text-brand-text/60 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {tabC.emoji} {isAr ? tabC.labelAr : tabC.labelEn}
                </button>
              ))}
              {customSymbols.length > 0 && (
                <button
                  onClick={() => selectCategory('custom')}
                  className={`px-5 py-2.5 rounded-xl text-lg font-black transition-all border ${
                    category === 'custom'
                      ? 'bg-sky-500 text-black border-sky-400 shadow-lg shadow-sky-500/25'
                      : 'bg-sky-500/10 text-sky-300 border-sky-500/30 hover:bg-sky-500/20'
                  }`}
                >
                  ⭐ {isAr ? 'مخصص' : 'Custom'} ({customSymbols.length})
                </button>
              )}
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
                  placeholder={isAr ? 'ابحث وأضف أي رمز — مثال: BTC أو Tesla أو EURUSD' : 'Search & add any symbol — e.g. BTC, Tesla, EURUSD'}
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
                    return (
                      <button
                        key={s.symbol + s.tv}
                        onClick={() => addFromSuggestion(s)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-lg flex-shrink-0">{catEmoji(s.cat)}</span>
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
                const isCustom = category === 'custom';
                return (
                  <div key={sym} className="relative group">
                    <button
                      onClick={() => { setSymbol(sym); setQty(getDefaultQty(detectCategory(sym))); }}
                      className={`pl-3 pr-8 py-2 rounded-xl text-base font-black transition-all border ${
                        symbol === sym
                          ? 'bg-emerald-500 text-black border-emerald-400'
                          : 'bg-white/5 text-brand-text/80 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {sym}
                    </button>
                    {/* Delete mark on every symbol */}
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

            {/* Restore hidden symbols */}
            {hiddenSymbols.length > 0 && category !== 'custom' && (
              <button
                onClick={restoreAllSymbols}
                className="text-xs font-black text-sky-400 hover:text-sky-300 underline underline-offset-2"
              >
                {isAr ? `↩ استعادة الرموز المحذوفة (${hiddenSymbols.length})` : `↩ Restore removed symbols (${hiddenSymbols.length})`}
              </button>
            )}
          </div>

          {/* Chart */}
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/20 h-[calc(100vh-420px)] min-h-[380px] relative">
            <TradingViewWidget symbol={toTvSymbol(symbol)} />
            <div className="absolute top-3 left-3 z-10 px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm border border-white/20 text-white text-base font-black flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              {symbol}
              {priceLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <span className="text-emerald-400">{fmtPrice(livePrice)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Order ticket */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xl font-black text-brand-text uppercase tracking-wide">{symbol || '—'}</span>
              {priceLoading ? (
                <Loader2 size={18} className="animate-spin text-brand-text/50" />
              ) : (
                <span dir="ltr" className="text-2xl font-black text-emerald-400">{fmtPrice(livePrice)}</span>
              )}
            </div>

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

            {/* TP/SL percent */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-black uppercase text-emerald-400/90 tracking-wider">TP %</label>
                <input
                  type="text" inputMode="decimal" lang="en" dir="ltr"
                  placeholder={isAr ? 'اختياري' : 'optional'}
                  value={tpPercent}
                  onChange={(e) => setTpPercent(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="w-full h-11 mt-1 rounded-xl bg-black/40 border border-white/15 text-center text-base font-bold text-brand-text outline-none focus:border-emerald-500 placeholder:text-brand-text/25 placeholder:text-sm"
                  style={{ direction: 'ltr' }}
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase text-red-400/90 tracking-wider">SL %</label>
                <input
                  type="text" inputMode="decimal" lang="en" dir="ltr"
                  placeholder={isAr ? 'اختياري' : 'optional'}
                  value={slPercent}
                  onChange={(e) => setSlPercent(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="w-full h-11 mt-1 rounded-xl bg-black/40 border border-white/15 text-center text-base font-bold text-brand-text outline-none focus:border-red-500 placeholder:text-brand-text/25 placeholder:text-sm"
                  style={{ direction: 'ltr' }}
                />
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
                {isAr ? 'السعر غير متاح لهذا الرمز — يمكنك المتابعة عبر TradingView' : 'Live price unavailable — trade via TradingView instead'}
              </p>
            )}
          </div>

          {/* Stats mini */}
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 grid grid-cols-3 gap-2 text-center">
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

        <div className="max-h-[300px] overflow-y-auto">
          {tab === 'positions' ? (
            openTrades.length === 0 ? (
              <div className="py-8 text-center text-base font-bold text-brand-text/40">
                {isAr ? 'لا توجد صفقات مفتوحة — افتح صفقة من لوحة الأوامر' : 'No open positions — place a trade from the order panel'}
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-black uppercase text-brand-text/40 tracking-wider border-b border-white/10">
                    <th className="px-4 py-2">{isAr ? 'الرمز' : 'Symbol'}</th>
                    <th className="px-4 py-2">{isAr ? 'الاتجاه' : 'Side'}</th>
                    <th className="px-4 py-2">{isAr ? 'الحجم' : 'Qty'}</th>
                    <th className="px-4 py-2">{isAr ? 'الدخول' : 'Entry'}</th>
                    <th className="px-4 py-2">{isAr ? 'الحالي' : 'Current'}</th>
                    <th className="px-4 py-2">{isAr ? 'الربح/الخسارة' : 'P&L'}</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {openTrades.map((t) => {
                    const cur = priceOf(t);
                    const pnl = cur != null ? calcPnl(t, cur) : 0;
                    return (
                      <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-2.5 text-sm font-black text-brand-text">{t.symbol}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase ${t.side === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {t.side === 'buy' ? (isAr ? 'شراء' : 'BUY') : (isAr ? 'بيع' : 'SELL')}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm font-bold text-brand-text/80" dir="ltr">{t.qty}</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-brand-text/80" dir="ltr">{fmtPrice(t.entryPrice)}</td>
                        <td className="px-4 py-2.5 text-sm font-bold text-brand-text/80" dir="ltr">{cur ? fmtPrice(cur) : '—'}</td>
                        <td className={`px-4 py-2.5 text-sm font-black ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">{cur ? fmtMoney(pnl) : '—'}</td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => closeTrade(t)}
                            disabled={!cur}
                            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 disabled:opacity-40 text-xs font-black uppercase transition-colors"
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
                  <tr className="text-xs font-black uppercase text-brand-text/40 tracking-wider border-b border-white/10">
                    <th className="px-4 py-2">{isAr ? 'الرمز' : 'Symbol'}</th>
                    <th className="px-4 py-2">{isAr ? 'الاتجاه' : 'Side'}</th>
                    <th className="px-4 py-2">{isAr ? 'الدخول' : 'Entry'}</th>
                    <th className="px-4 py-2">{isAr ? 'الخروج' : 'Exit'}</th>
                    <th className="px-4 py-2">{isAr ? 'السبب' : 'Reason'}</th>
                    <th className="px-4 py-2">{isAr ? 'النتيجة' : 'Result'}</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map((t) => (
                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-2.5 text-sm font-black text-brand-text">{t.symbol}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase ${t.side === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {t.side === 'buy' ? (isAr ? 'شراء' : 'BUY') : (isAr ? 'بيع' : 'SELL')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm font-bold text-brand-text/80" dir="ltr">{fmtPrice(t.entryPrice)}</td>
                      <td className="px-4 py-2.5 text-sm font-bold text-brand-text/80" dir="ltr">{fmtPrice(t.exitPrice)}</td>
                      <td className="px-4 py-2.5 text-xs font-black uppercase text-brand-text/50">
                        {t.closeReason === 'tp' ? 'TP' : t.closeReason === 'sl' ? 'SL' : (isAr ? 'يدوي' : 'Manual')}
                      </td>
                      <td className={`px-4 py-2.5 text-sm font-black ${(t.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">{fmtMoney(t.pnl ?? 0)}</td>
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
            ? 'تداول تجريبي بالكامل بأموال وهمية وأسعار حقيقية لحظية. يمكنك إضافة أي رمز متاح على TradingView من حقل الإضافة أعلاه.'
            : 'Fully simulated trading with virtual funds and real-time prices. Add any TradingView-available symbol using the field above.'}
        </span>
      </div>
    </div>
  );
}
