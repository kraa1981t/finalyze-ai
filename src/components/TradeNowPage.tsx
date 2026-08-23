import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, TrendingUp, ShieldCheck, Info, Wallet, X, Loader2 } from 'lucide-react';
import { User } from 'firebase/auth';
import { SYMBOL_CATEGORIES } from '../constants';
import { Language } from '../lib/i18n';
import TradingViewWidget from './TradingViewWidget';
import {
  PaperTrade, getTradeStore, getLivePrice, subscribePrices,
  calcPnl, getDefaultQty, START_BALANCE,
} from '../services/paperTradingService';

interface TradeNowPageProps {
  lang: Language;
  user: User | null;
}

const CATEGORY_TABS = [
  { key: 'forex', labelAr: 'الفوركس', labelEn: 'Forex', emoji: '\uD83D\uDCB1' },
  { key: 'crypto', labelAr: 'الكريبتو', labelEn: 'Crypto', emoji: '\uD83E\uDDF1' },
  { key: 'stocks', labelAr: 'الأسهم', labelEn: 'Stocks', emoji: '\uD83D\uDCC8' },
  { key: 'metals', labelAr: 'المعادن', labelEn: 'Metals', emoji: '\uD83D\uDC8E' },
];

function toTvSymbol(sym: string): string {
  const s = sym.toUpperCase();
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

const fmtMoney = (v: number) =>
  `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TradeNowPage({ lang, user }: TradeNowPageProps) {
  const isAr = lang === 'ar';
  const [category, setCategory] = useState<string>('forex');
  const [symbol, setSymbol] = useState<string>('EURUSD');

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
  const symbols = SYMBOL_CATEGORIES[category as keyof typeof SYMBOL_CATEGORIES] || [];
  const openTrades = trades.filter((t) => t.status === 'open');
  const closedTrades = trades.filter((t) => t.status === 'closed').slice(0, 30);

  const symbolOpenTrades = openTrades.filter((t) => t.symbol === symbol);
  const unrealizedPnl = livePrice
    ? openTrades.reduce((sum, t) => sum + calcPnl(t, livePriceFor(t, livePrice)), 0)
    : 0;

  function livePriceFor(t: PaperTrade, fallback: number): number {
    return priceMapRef.current[t.symbol] ?? t.entryPrice ?? fallback;
  }
  const priceMapRef = React.useRef<Record<string, number>>({});

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
    setLivePrice(null);
    (async () => {
      const p = await getLivePrice(symbol);
      if (!alive) return;
      setLivePrice(p);
      setPriceLoading(false);
      priceMapRef.current[symbol] = p ?? priceMapRef.current[symbol];
    })();
    return () => { alive = false; };
  }, [symbol]);

  // Subscribe to prices for all symbols involved
  useEffect(() => {
    const watchList = [...new Set([...openTrades.map((t) => t.symbol), symbol])];
    if (watchList.length === 0) return;
    const unsub = subscribePrices(watchList, (sym, price) => {
      priceMapRef.current[sym] = price;
      if (sym === symbol) { setLivePrice(price); setPriceLoading(false); }
      // Auto-close TP/SL check
      checkAutoClose(sym, price);
    });
    return unsub;
  }, [symbol, openTrades.length]);

  const checkAutoClose = useCallback(async (sym: string, price: number) => {
    const targets = trades.filter((t) => t.status === 'open' && t.symbol === sym);
    for (const t of targets) {
      const hitTp = t.tp != null && ((t.side === 'buy' && price >= t.tp) || (t.side === 'sell' && price <= t.tp));
      const hitSl = t.sl != null && ((t.side === 'buy' && price <= t.sl) || (t.side === 'sell' && price >= t.sl));
      if (hitTp || hitSl) {
        await closeTradeInternal(t, price, hitTp ? 'tp' : 'sl');
      }
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
    const first = (SYMBOL_CATEGORIES[key as keyof typeof SYMBOL_CATEGORIES] || [])[0] || '';
    setSymbol(first);
    setQty(getDefaultQty(key));
  }

  async function openTrade(side: 'buy' | 'sell') {
    if (!livePrice || busy) return;
    if (qty <= 0) return;
    setBusy(true);
    try {
      const tpVal = tpPercent ? (side === 'buy'
        ? livePrice * (1 + parseFloat(tpPercent) / 100)
        : livePrice * (1 - parseFloat(tpPercent) / 100)) : null;
      const slVal = slPercent ? (side === 'buy'
        ? livePrice * (1 - parseFloat(slPercent) / 100)
        : livePrice * (1 + parseFloat(slPercent) / 100)) : null;
      const id = await store.addTrade({
        symbol, category, side, qty,
        entryPrice: livePrice,
        status: 'open',
        tp: tpVal, sl: slVal,
        openedAt: Date.now(),
      });
      setTrades((prev) => [{ id, symbol, category, side, qty, entryPrice: livePrice, status: 'open', tp: tpVal, sl: slVal, openedAt: Date.now() }, ...prev]);
      setTpPercent(''); setSlPercent('');
    } finally {
      setBusy(false);
    }
  }

  async function closeTrade(t: PaperTrade) {
    const exit = priceMapRef.current[t.symbol];
    if (!exit) return;
    await closeTradeInternal(t, exit, 'manual');
  }

  const stats = React.useMemo(() => {
    const wins = closedTrades.filter((t) => (t.pnl ?? 0) > 0).length;
    const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const best = closedTrades.reduce((b, t) => Math.max(b, t.pnl ?? 0), 0);
    return { wins, total: closedTrades.length, winRate: closedTrades.length ? Math.round((wins / closedTrades.length) * 100) : 0, totalPnl, best };
  }, [closedTrades]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header Card */}
      <div className="rounded-3xl border border-[#F59E0B]/40 bg-gradient-to-r from-[#F59E0B]/15 via-[#F59E0B]/5 to-transparent p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F59E0B] flex items-center justify-center shadow-xl shadow-[#F59E0B]/30">
            <TrendingUp size={28} className="text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-brand-text leading-tight">
              {isAr ? 'تداول الآن' : 'Trade Now'}
            </h1>
            <p className="text-sm font-bold text-brand-text/70">
              {isAr ? 'تداول تجريبي بأسعار حقيقية — رصيد وهمي $10,000' : 'Paper trading with real-time prices — $10,000 virtual balance'}
            </p>
          </div>
        </div>
        {/* Account bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-center min-w-[110px]">
            <div className="text-[10px] font-black uppercase text-brand-text/50 tracking-wider">{isAr ? 'الرصيد' : 'Balance'}</div>
            <div className="text-sm font-black text-emerald-400">${balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-center min-w-[110px]">
            <div className="text-[10px] font-black uppercase text-brand-text/50 tracking-wider">{isAr ? 'الإجمالي' : 'Equity'}</div>
            <div className={`text-sm font-black ${unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${equity.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-black/30 border border-white/10 text-center min-w-[110px]">
            <div className="text-[10px] font-black uppercase text-brand-text/50 tracking-wider">{isAr ? 'ربح مفتوح' : 'Open P&L'}</div>
            <div className={`text-sm font-black ${unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMoney(unrealizedPnl)}</div>
          </div>
          <a
            href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(toTvSymbol(symbol))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#F59E0B] hover:bg-[#d97706] text-black font-black uppercase tracking-wider shadow-xl shadow-[#F59E0B]/30 active:scale-95 transition-all"
          >
            <ExternalLink size={18} />
            {isAr ? 'TradingView' : 'TradingView'}
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Symbol selector + Chart */}
        <div className="lg:col-span-2 space-y-3">
          {/* Symbol Selector */}
          <div className="rounded-3xl border border-white/10 bg-black/20 backdrop-blur-sm p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_TABS.map((tabC) => (
                <button
                  key={tabC.key}
                  onClick={() => selectCategory(tabC.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-all border ${
                    category === tabC.key
                      ? 'bg-[#F59E0B] text-black border-[#F59E0B] shadow-lg shadow-[#F59E0B]/25'
                      : 'bg-white/5 text-brand-text/60 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {tabC.emoji} {isAr ? tabC.labelAr : tabC.labelEn}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto">
              {symbols.map((sym) => (
                <button
                  key={sym}
                  onClick={() => setSymbol(sym)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all border ${
                    symbol === sym
                      ? 'bg-emerald-500 text-black border-emerald-400'
                      : 'bg-white/5 text-brand-text/70 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-3xl overflow-hidden border border-white/10 bg-black/20 h-[480px] relative">
            <TradingViewWidget symbol={toTvSymbol(symbol)} />
            <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-white text-xs font-black flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {symbol}
              {priceLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : livePrice ? (
                <span className={livePrice >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {livePrice.toLocaleString('en-US', { maximumFractionDigits: symbol.includes('JPY') ? 3 : 5 })}
                </span>
              ) : (
                <span className="text-yellow-400">{isAr ? 'لا سعر' : 'N/A'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Order ticket */}
        <div className="space-y-3">
          <div className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-brand-text uppercase tracking-wider">{symbol}</span>
              {priceLoading ? (
                <Loader2 size={16} className="animate-spin text-brand-text/50" />
              ) : (
                <span className="text-lg font-black text-emerald-400">
                  {livePrice?.toLocaleString('en-US', { maximumFractionDigits: 5 }) ?? '—'}
                </span>
              )}
            </div>

            {/* Qty */}
            <div>
              <label className="text-[10px] font-black uppercase text-brand-text/50 tracking-wider">
                {category === 'forex' || category === 'metals'
                  ? (isAr ? 'الحجم (لوت)' : 'Volume (lots)')
                  : category === 'crypto' ? (isAr ? 'الكمية (وحدات)' : 'Quantity (units)')
                  : (isAr ? 'عدد الأسهم' : 'Shares')}
              </label>
              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => setQty((q) => Math.max(0.01, +(q / 2).toFixed(4)))} className="w-9 h-9 rounded-lg bg-white/10 text-brand-text font-black hover:bg-white/20">÷</button>
                <input
                  type="number" step="any" min="0"
                  value={qty}
                  onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                  className="flex-1 h-9 rounded-lg bg-black/40 border border-white/15 text-center text-sm font-black text-brand-text outline-none focus:border-emerald-500"
                />
                <button onClick={() => setQty((q) => +(q * 2).toFixed(4))} className="w-9 h-9 rounded-lg bg-white/10 text-brand-text font-black hover:bg-white/20">×</button>
              </div>
            </div>

            {/* TP/SL percent */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black uppercase text-emerald-400/80 tracking-wider">TP %</label>
                <input
                  type="number" step="any" min="0" placeholder={isAr ? 'اختياري' : 'optional'}
                  value={tpPercent}
                  onChange={(e) => setTpPercent(e.target.value)}
                  className="w-full h-9 mt-1 rounded-lg bg-black/40 border border-white/15 text-center text-sm font-bold text-brand-text outline-none focus:border-emerald-500 placeholder:text-brand-text/25"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-red-400/80 tracking-wider">SL %</label>
                <input
                  type="number" step="any" min="0" placeholder={isAr ? 'اختياري' : 'optional'}
                  value={slPercent}
                  onChange={(e) => setSlPercent(e.target.value)}
                  className="w-full h-9 mt-1 rounded-lg bg-black/40 border border-white/15 text-center text-sm font-bold text-brand-text outline-none focus:border-red-500 placeholder:text-brand-text/25"
                />
              </div>
            </div>

            {/* Buy/Sell */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => openTrade('buy')}
                disabled={!livePrice || busy || qty <= 0}
                className="py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
              >
                {isAr ? 'شراء' : 'Buy'}
              </button>
              <button
                onClick={() => openTrade('sell')}
                disabled={!livePrice || busy || qty <= 0}
                className="py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase tracking-wider shadow-lg shadow-red-500/25 active:scale-95 transition-all"
              >
                {isAr ? 'بيع' : 'Sell'}
              </button>
            </div>
            {!livePrice && !priceLoading && (
              <p className="text-[11px] font-bold text-yellow-400/80 text-center">
                {isAr ? 'السعر غير متاح لهذا الرمز حالياً — جرّب رمزاً آخر' : 'Live price unavailable for this symbol — try another'}
              </p>
            )}
          </div>

          {/* Stats mini */}
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[9px] font-black uppercase text-brand-text/50">{isAr ? 'صفقات' : 'Trades'}</div>
              <div className="text-sm font-black text-brand-text">{stats.total}</div>
            </div>
            <div>
              <div className="text-[9px] font-black uppercase text-brand-text/50">{isAr ? 'نسبة الفوز' : 'Win rate'}</div>
              <div className="text-sm font-black text-emerald-400">{stats.winRate}%</div>
            </div>
            <div>
              <div className="text-[9px] font-black uppercase text-brand-text/50">{isAr ? 'صافي الربح' : 'Net P&L'}</div>
              <div className={`text-sm font-black ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMoney(stats.totalPnl)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Positions / History */}
      <div className="rounded-3xl border border-white/10 bg-black/20 backdrop-blur-sm overflow-hidden">
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setTab('positions')}
            className={`flex-1 py-3 text-sm font-black uppercase tracking-wider transition-colors ${tab === 'positions' ? 'bg-white/10 text-brand-text border-b-2 border-[#F59E0B]' : 'text-brand-text/50 hover:text-brand-text/80'}`}
          >
            {isAr ? `الصفقات المفتوحة (${openTrades.length})` : `Positions (${openTrades.length})`}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-3 text-sm font-black uppercase tracking-wider transition-colors ${tab === 'history' ? 'bg-white/10 text-brand-text border-b-2 border-[#F59E0B]' : 'text-brand-text/50 hover:text-brand-text/80'}`}
          >
            {isAr ? 'السجل' : 'History'}
          </button>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {tab === 'positions' ? (
            openTrades.length === 0 ? (
              <div className="py-10 text-center text-sm font-bold text-brand-text/40">
                {isAr ? 'لا توجد صفقات مفتوحة — افتح صفقة من لوحة الأوامر' : 'No open positions — place a trade from the order panel'}
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase text-brand-text/40 tracking-wider border-b border-white/10">
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
                    const cur = priceMapRef.current[t.symbol];
                    const pnl = cur != null ? calcPnl(t, cur) : 0;
                    return (
                      <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-2.5 text-xs font-black text-brand-text">{t.symbol}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${t.side === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {t.side === 'buy' ? (isAr ? 'شراء' : 'BUY') : (isAr ? 'بيع' : 'SELL')}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-bold text-brand-text/70">{t.qty}</td>
                        <td className="px-4 py-2.5 text-xs font-bold text-brand-text/70">{t.entryPrice.toLocaleString('en-US', { maximumFractionDigits: 5 })}</td>
                        <td className="px-4 py-2.5 text-xs font-bold text-brand-text/70">{cur ? cur.toLocaleString('en-US', { maximumFractionDigits: 5 }) : '—'}</td>
                        <td className={`px-4 py-2.5 text-xs font-black ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{cur ? fmtMoney(pnl) : '—'}</td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => closeTrade(t)}
                            disabled={!cur}
                            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 disabled:opacity-40 text-[10px] font-black uppercase transition-colors"
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
              <div className="py-10 text-center text-sm font-bold text-brand-text/40">
                {isAr ? 'لا يوجد سجل بعد' : 'No history yet'}
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase text-brand-text/40 tracking-wider border-b border-white/10">
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
                      <td className="px-4 py-2.5 text-xs font-black text-brand-text">{t.symbol}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${t.side === 'buy' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {t.side === 'buy' ? (isAr ? 'شراء' : 'BUY') : (isAr ? 'بيع' : 'SELL')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-bold text-brand-text/70">{t.entryPrice.toLocaleString('en-US', { maximumFractionDigits: 5 })}</td>
                      <td className="px-4 py-2.5 text-xs font-bold text-brand-text/70">{t.exitPrice?.toLocaleString('en-US', { maximumFractionDigits: 5 }) ?? '—'}</td>
                      <td className="px-4 py-2.5 text-[10px] font-black uppercase text-brand-text/50">
                        {t.closeReason === 'tp' ? 'TP' : t.closeReason === 'sl' ? 'SL' : (isAr ? 'يدوي' : 'Manual')}
                      </td>
                      <td className={`px-4 py-2.5 text-xs font-black ${(t.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtMoney(t.pnl ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* Info Footer */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 flex items-start gap-3">
        <Info size={18} className="text-sky-400 flex-shrink-0 mt-0.5" />
        <span className="text-xs font-bold text-brand-text/60 leading-relaxed">
          {isAr
            ? 'تداول تجريبي بالكامل بأموال وهمية وأسعار حقيقية لحظية. لا علاقة له بأي أموال حقيقية أو منصة تداول خارجية. الشارت من TradingView للعرض فقط.'
            : 'Fully simulated trading with virtual funds and real-time market prices. No real money or external broker involved. Chart provided by TradingView for viewing only.'}
        </span>
      </div>
    </div>
  );
}
