import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown, ChevronDown, Coins,
  Gem, Bitcoin, Activity, Info, CheckCircle2, CircleDollarSign, Timer,
} from 'lucide-react';
import { Language } from '../lib/i18n';
import TradingViewEmbed from '../components/TradingViewEmbed';
import { AdSlot } from '../components/AdsManager';
import MarketBriefing from '../components/MarketBriefing';

interface SeoPricesPageProps {
  lang: Language;
  onBack: () => void;
}

interface Q {
  price: number;
  ts: number;
}

const CACHE_KEY = 'seo_prices_cache';

const FALLBACK: Record<string, number> = {
  XAUUSD: 2465.4,
  XAGUSD: 30.85,
  BTCUSDT: 67420,
  ETHUSDT: 3350,
  USDDZD: 133.2,
  EURUSD: 1.085,
};

const symbolsMeta: { sym: string; nameAr: string; nameEn: string; icon: any; color: string; digits: number }[] = [
  { sym: 'XAUUSD', nameAr: 'الذهب (أونصة)', nameEn: 'Gold (Ounce)', icon: Gem, color: 'from-amber-400 to-yellow-600', digits: 2 },
  { sym: 'XAGUSD', nameAr: 'الفضة (أونصة)', nameEn: 'Silver (Ounce)', icon: Coins, color: 'from-slate-300 to-slate-500', digits: 3 },
  { sym: 'BTCUSDT', nameAr: 'البيتكوين', nameEn: 'Bitcoin', icon: Bitcoin, color: 'from-orange-400 to-amber-600', digits: 0 },
  { sym: 'ETHUSDT', nameAr: 'الإيثيريوم', nameEn: 'Ethereum', icon: Activity, color: 'from-indigo-400 to-violet-600', digits: 0 },
];

const HISTORY_LEN = 24;

function fmt(n: number | null | undefined, digits: number): string {
  if (n == null || !isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtSigned(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '';
  const s = n > 0 ? '+' : '';
  return `${s}${n.toFixed(2)}%`;
}

function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 120;
  const h = 36;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color = positive ? '#10B981' : '#EF4444';
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-80" aria-hidden>
      <polyline points={coords.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FAQItem({ qAr, qEn, aAr, aEn, isAr, open, onToggle }: { qAr: string; qEn: string; aAr: string; aEn: string; open: boolean; onToggle: () => void; isAr: boolean }) {
  return (
    <div className="bg-brand-alt rounded-2xl border border-white/10 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="text-base font-black text-white">{isAr ? qAr : qEn}</span>
        <ChevronDown size={18} className={`text-[#F59E0B] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="px-5 pb-5 text-base text-white/70 leading-relaxed">{isAr ? aAr : aEn}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SeoPricesPage({ lang, onBack }: SeoPricesPageProps) {
  const isAr = lang === 'ar';

  const [live, setLive] = useState<Record<string, Q>>(() => {
    try {
      const d = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      const out: Record<string, Q> = {};
      for (const k of Object.keys(FALLBACK)) {
        if (d && typeof d[k]?.price === 'number' && d[k].price > 0) out[k] = { price: d[k].price, ts: d[k].ts || Date.now() };
      }
      return out;
    } catch { return {}; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const prevPricesRef = useRef<Record<string, number>>({});
  const historyRef = useRef<Record<string, number[]>>({});

  const price = (sym: string): number | null => live[sym]?.price ?? FALLBACK[sym] ?? null;
  const xau = price('XAUUSD');
  const xag = price('XAGUSD');
  const btc = price('BTCUSDT');
  const eth = price('ETHUSDT');
  const dzd = price('USDDZD');
  const eurusd = price('EURUSD');

  const refresh = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setLoading(true);
    const out: Record<string, number> = {};
    await Promise.allSettled(Object.keys(FALLBACK).map(async (sym) => {
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 9000);
        const r = await fetch(`/api/quote?symbol=${encodeURIComponent(sym)}`, { signal: ac.signal });
        clearTimeout(timer);
        if (r.ok) {
          const d = await r.json();
          const p = Number(d?.price);
          if (isFinite(p) && p > 0) out[sym] = p;
        }
      } catch { /* keep last known */ }
    }));

    const prev = prevPricesRef.current;
    const newPrev: Record<string, number> = {};
    const nextHistory = { ...historyRef.current };
    Object.keys(FALLBACK).forEach((sym) => {
      const v = out[sym];
      if (v == null) return;
      newPrev[sym] = prev[sym] ?? v;
      const h = [...(nextHistory[sym] || []), v];
      if (h.length > HISTORY_LEN) h.shift();
      nextHistory[sym] = h;
    });
    prevPricesRef.current = newPrev;
    historyRef.current = nextHistory;

    setLive((old) => {
      const merged: Record<string, Q> = { ...old };
      Object.entries(out).forEach(([sym, v]) => { merged[sym] = { price: v, ts: Date.now() }; });
      return merged;
    });
    setPrevPrices(newPrev);
    setHistory(nextHistory);
    setError(Object.keys(out).length === 0);
    setLoading(false);
    setRefreshing(false);
    setCountdown(60);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.entries(out).reduce<Record<string, { price: number; ts: number }>>((acc, [sym, v]) => {
        acc[sym] = { price: v, ts: Date.now() };
        return acc;
      }, {})));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { refresh(); return 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [refresh]);

  const changePct = (sym: string): number | null => {
    const cur = price(sym);
    const p = prevPrices[sym];
    if (cur == null || p == null || p <= 0) return null;
    return ((cur - p) / p) * 100;
  };

  useEffect(() => {
    const titleAr = 'أسعار الذهب والبيتكوين والعملات اليوم مباشرة - Joseph.Trading';
    const titleEn = 'Live Gold & Bitcoin Prices Today - Joseph.Trading';
    const descAr = 'سعر الذهب اليوم في الجزائر والدولار والعالم، سعر البيتكوين والإيثيريوم لحظة بلحظة. أسعار حية للذهب والفضة والعملات الرقمية مع تحديث مستمر ومخططات احترافية.';
    const descEn = 'Live gold price in Algeria and worldwide, real-time Bitcoin and Ethereum prices. Gold, silver and crypto prices with continuous updates and professional charts.';
    document.title = isAr ? titleAr : titleEn;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
    meta.setAttribute('content', isAr ? descAr : descEn);

    let ogp = document.querySelector('meta[property="og:title"]');
    if (!ogp) { ogp = document.createElement('meta'); ogp.setAttribute('property', 'og:title'); document.head.appendChild(ogp); }
    ogp.setAttribute('content', isAr ? titleAr : titleEn);

    let base = document.querySelector('link[rel="canonical"]');
    if (!base) { base = document.createElement('link'); base.setAttribute('rel', 'canonical'); document.head.appendChild(base); }
    base.setAttribute('href', `https://joseph-trading.vercel.app/#/prices`);

    const removeLd = () => { document.getElementById('seo-prices-jsonld')?.remove(); };
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.id = 'seo-prices-jsonld';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: isAr ? titleAr : titleEn,
      url: 'https://joseph-trading.vercel.app/#/prices',
      inLanguage: isAr ? 'ar' : 'en',
      description: isAr ? descAr : descEn,
      mainEntity: {
        '@type': 'ItemList',
        name: isAr ? 'الأسعار المالية الحية' : 'Live Financial Prices',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Gold XAU/USD', url: 'https://joseph-trading.vercel.app/#/prices' },
          { '@type': 'ListItem', position: 2, name: 'Silver XAG/USD', url: 'https://joseph-trading.vercel.app/#/prices' },
          { '@type': 'ListItem', position: 3, name: 'Bitcoin BTC/USD', url: 'https://joseph-trading.vercel.app/#/prices' },
          { '@type': 'ListItem', position: 4, name: 'Ethereum ETH/USD', url: 'https://joseph-trading.vercel.app/#/prices' },
        ],
      },
    });
    document.head.appendChild(ld);
    return () => { removeLd(); document.title = 'Joseph.Trading - AI Trading Signals | Forex, Crypto & Stock Analysis'; };
  }, [isAr]);

  const goldDzd = xau != null && dzd != null ? xau * dzd : null;
  const goldEur = xau != null && eurusd != null && eurusd > 0 ? xau / eurusd : null;
  const silverDzd = xag != null && dzd != null ? xag * dzd : null;
  const btcDzd = btc != null && dzd != null ? btc * dzd : null;
  const ethDzd = eth != null && dzd != null ? eth * dzd : null;

  const faqs: { qAr: string; qEn: string; aAr: string; aEn: string }[] = [
    {
      qAr: 'كم سعر الذهب اليوم؟',
      qEn: 'What is today gold price?',
      aAr: 'سعر الذهب اليوم يُعرض مباشرة في الجدول أعلاه بالأونصة بالدولار الأمريكي، مع التحويل إلى الدينار الجزائري. يتغير السعر لحظياً حسب أسواق الذهب العالمية (COMEX وLondon Spot) فهذا يساعدك على معرفة سعر الذهب الحقيقي لتداولك أو استثمارك.',
      aEn: 'Today gold price is shown live in the table above per ounce in US dollars, with conversion to Algerian Dinar. The price changes in real time following global gold markets (COMEX and London Spot).',
    },
    {
      qAr: 'هل أسعار البيتكوين والعملات الرقمية حية؟',
      qEn: 'Are Bitcoin and crypto prices live?',
      aAr: 'نعم، جميع الأسعار المعروضة في الصفحة تُجلب مباشرة من بورصات ومنصات حية مثل Binance لأسعار العملات الرقمية وTwelve Data/Yahoo لأسعار الذهب والمعادن، ويتم تحديثها تلقائياً كل 60 ثانية دون الحاجة لإعادة تحميل الصفحة.',
      aEn: 'Yes, all prices shown are fetched live from market venues such as Binance for crypto and Twelve Data/Yahoo for metals, and refresh automatically every 60 seconds.',
    },
    {
      qAr: 'ما هو سعر الذهب بالدينار الجزائري؟',
      qEn: 'What is the gold price in Algerian Dinar?',
      aAr: `موقعنا يحول سعر الذهب مباشرة إلى الدينار الجزائري (DZD) تلقائياً. حالياً أونصة الذهب تعادل تقريباً ${goldDzd != null ? fmt(goldDzd, 0) + ' دينار جزائري' : '—'}، ويتم تحديث هذا المبلغ مع كل تحرك في سوق الذهب أو صرف العملات.`,
      aEn: 'Our site converts the gold price to Algerian Dinar (DZD) automatically every update so you always see today gold value in your local currency.',
    },
    {
      qAr: 'كم سعر غرام الذهب؟',
      qEn: 'What is the price of one gram of gold?',
      aAr: `غرام الذهب يُحسب بتقسيم سعر الأونصة (31.1 غرام) على عدد الغرامات. حالياً سعر الغرام الواحد يعادل ${xau != null ? fmt(xau / 31.1035, 2) + ' دولار' : '—'}، ويمكنك حساب أي كمية بسهولة من السعر المعروض.`,
      aEn: 'One gram of gold is computed by dividing the ounce price (31.1 grams). The current per-gram price is shown above.',
    },
    {
      qAr: 'هل التداول في الذهب والعملات الرقمية آمن؟',
      qEn: 'Is trading gold and crypto safe?',
      aAr: 'التداول يحمل مخاطر مالية مهما كان الأصل، لذلك ننصح دائماً باستخدام إدارة مخاطر صارمة وتحديد أوامر وقف الخسارة. Joseph.Trading يقدم إشارات تداول وتحليلات فنية احترافية تساعدك على اتخاذ قرارات أكثر وعياً، لكن القرار النهائي ومسؤولية التداول تعود إليك.',
      aEn: 'Trading involves financial risk regardless of the asset. Always use strict risk management and stop-loss orders. Joseph.Trading provides professional analysis and signals to help you decide more consciously.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
      <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group">
        <ArrowLeft size={20} className={`group-hover:-translate-x-1 transition-transform ${isAr ? 'rotate-180' : ''}`} />
        <span className="text-sm font-bold">{isAr ? 'رجوع' : 'Back'}</span>
      </button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto bg-[#F59E0B]/20 rounded-3xl flex items-center justify-center border border-[#F59E0B]/30">
          <TrendingUp size={32} className="text-[#F59E0B]" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white">
          {isAr ? 'أسعار الذهب والبيتكوين والعملات اليوم مباشرة' : 'Live Gold, Bitcoin & Crypto Prices Today'}
        </h1>
        <p className="text-white/60 text-base max-w-2xl mx-auto leading-relaxed">
          {isAr
            ? 'تابع سعر الذهب والفضة والدولار والعملات الرقمية لحظة بلحظة. أسعار حية تتحدث تلقائياً كل دقيقة مع التحويل إلى الدينار الجزائري.'
            : 'Follow gold, silver, forex and crypto prices in real time. Live prices refresh every minute with automatic conversion to Algerian Dinar.'}
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {isAr ? 'أسعار حية' : 'LIVE'}
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/60 text-xs font-black px-3 py-1 rounded-full">
            <Timer size={13} className="text-[#F59E0B]" />
            {isAr ? `تحديث تلقائي خلال ${countdown}ث` : `Auto-refresh in ${countdown}s`}
          </span>
          <button
            onClick={() => refresh(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 bg-[#F59E0B] text-black text-xs font-black px-3 py-1 rounded-full hover:bg-[#d97706] transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {isAr ? 'تحديث الآن' : 'Refresh'}
          </button>
        </div>
        <p className="text-sm text-white/40">
          {live.XAUUSD?.ts ? new Date(live.XAUUSD.ts).toLocaleString(isAr ? 'ar-DZ' : 'en-US', { dateStyle: 'medium', timeStyle: 'medium' }) : '—'}
        </p>
      </motion.div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold rounded-xl px-4 py-3 text-center">
          {isAr ? 'تعذر الوصول إلى بعض مصادر الأسعار — يتم عرض آخر الأسعار المعروفة.' : 'Some price sources are unreachable — showing the last known prices.'}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-live="polite">
        {symbolsMeta.map((m, i) => {
          const Icon = m.icon;
          const p = price(m.sym);
          const chg = changePct(m.sym);
          const positive = chg != null && chg >= 0;
          const pts = history[m.sym] || [];
          const dzdVal = m.sym === 'XAUUSD' ? goldDzd : m.sym === 'XAGUSD' ? silverDzd : m.sym === 'BTCUSDT' ? btcDzd : ethDzd;
          return (
            <motion.div
              key={m.sym}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={`bg-brand-alt rounded-2xl border border-white/10 p-4 flex flex-col gap-3 ${loading ? 'opacity-90' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`shrink-0 w-10 h-10 bg-gradient-to-br ${m.color} rounded-xl flex items-center justify-center border border-white/10 text-black shadow-md`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-white/80">{isAr ? m.nameAr : m.nameEn}</p>
                  <p className="text-xs font-bold text-white/40 font-mono">{m.sym}</p>
                </div>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-3xl font-black text-white tabular-nums leading-none">
                    {p != null ? `$${fmt(p, m.digits)}` : '—'}
                  </p>
                  <p className="text-sm font-bold text-white/40 mt-1">
                    {isAr ? 'دولار أمريكي' : 'US Dollar'}
                  </p>
                </div>
                <div className="text-right">
                  {chg != null ? (
                    <span className={`inline-flex items-center gap-1 text-sm font-black ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {positive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      {fmtSigned(chg)}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-white/30">{isAr ? '—' : '—'}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Sparkline points={pts} positive={positive} />
                {dzdVal != null ? (
                  <p className="text-sm font-black text-[#F59E0B] text-right leading-tight">
                    {isAr ? '≈' : '≈'} {fmt(dzdVal, m.digits === 0 ? 0 : 2)} {isAr ? 'دج' : 'DZD'}
                  </p>
                ) : (
                  <p className="text-sm font-bold text-white/25 text-right">{isAr ? 'دينار جزائري' : 'Algerian Dinar'}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AdSlot position="inline" lang={lang} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-brand-alt rounded-2xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CircleDollarSign size={20} className="text-[#F59E0B]" />
            <h2 className="text-base font-black text-white">{isAr ? 'الدولار مقابل الدينار الجزائري' : 'USD / Algerian Dinar'}</h2>
          </div>
          <p className="text-4xl font-black text-white tabular-nums">{dzd != null ? dzd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</p>
          <p className="text-sm font-bold text-white/50 mt-2 leading-relaxed">
            {isAr
              ? 'معدل الصرف الرسمي التقريبي من مصادر البنوك المركزية، يتغير يومياً. استخدمه لحساب قيمة الذهب والعملات الرقمية بالدينار الجزائري.'
              : 'Approximate official exchange rate from central bank sources, updated daily. Use it to value gold and crypto in Algerian Dinar.'}
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-brand-alt rounded-2xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info size={20} className="text-[#F59E0B]" />
            <h2 className="text-base font-black text-white">{isAr ? 'معلومات سريعة عن الأسعار' : 'Quick Price Facts'}</h2>
          </div>
          <ul className="space-y-2 text-sm font-bold text-white/60 leading-relaxed">
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />{isAr ? `غرام الذهب عالمياً ≈ ${xau != null ? '$' + fmt(xau / 31.1035, 2) : '—'}` : `World gold per gram ≈ ${xau != null ? '$' + fmt(xau / 31.1035, 2) : '—'}`}</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />{isAr ? `أونصة الذهب باليورو ≈ €${goldEur != null ? fmt(goldEur, 0) : '—'}` : `Gold per ounce in EUR ≈ €${goldEur != null ? fmt(goldEur, 0) : '—'}`}</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />{isAr ? `أونصة الفضة بالدينار ≈ ${silverDzd != null ? fmt(silverDzd, 0) : '—'} دج` : `Silver per ounce in DZD ≈ ${silverDzd != null ? fmt(silverDzd, 0) : '—'}`}</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />{isAr ? `البيتكوين بالدينار ≈ ${btcDzd != null ? fmt(btcDzd, 0) : '—'} دج` : `Bitcoin in DZD ≈ ${btcDzd != null ? fmt(btcDzd, 0) : '—'}`}</li>
          </ul>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-black text-white">{isAr ? 'مخطط الذهب الفوري' : 'Live Gold Chart'}</h2>
          <span className="text-xs font-black text-white/40">{isAr ? 'مصدر: TradingView' : 'Source: TradingView'}</span>
        </div>
        <div className="h-[340px] sm:h-[420px]">
          <TradingViewEmbed symbol="XAUUSD" interval="60" />
        </div>
      </motion.div>

      <MarketBriefing lang={lang} />

      <AdSlot position="between" lang={lang} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-brand-alt rounded-2xl border border-white/10 p-5 sm:p-6 space-y-4">
        <h2 className="text-xl sm:text-2xl font-black text-white">{isAr ? 'تحليل أسواق الذهب والعملات اليوم' : 'Today Gold & Crypto Market Outlook'}</h2>
        <div className="space-y-3.5 text-base text-white/70 leading-relaxed">
          {isAr ? (
            <>
              <p><strong className="text-white/80">سعر الذهب اليوم:</strong> يعد الذهب من أهم الأصول الآمنة في العالم، ويتأثر سعره بمجموعة من العوامل أهمها قرارات البنوك الفيدرالية الأمريكية، بيانات التضخم، قوة الدولار، والطلب العالمي من البنوك المركزية وصناديق الاستثمار. عندما يتراجع الدولار، يرتفع الذهب عادة والعكس صحيح.</p>
              <p><strong className="text-white/80">الذهب في السوق الجزائري:</strong> شهد سعر الذهب اهتماماً متزايداً في الجزائر، حيث يلجأ المواطنون إلى شراء الذهب كوسيلة ادخار وحماية من تقلبات العملة. تجدر الإشارة أن السعر المعروض هنا هو السعر العالمي الفوري، وقد يختلف سعر غرام الذهب في محلات الصاغة المحلية بسبب الإضافة الضريبية وهامش الربح والطلب المحلي.</p>
              <p><strong className="text-white/80">سعر البيتكوين والعملات الرقمية:</strong> البيتكوين يعمل 24 ساعة على مدار الأسبوع، ويتميز بتقلبات حادة تتأثر بالتطورات التنظيمية العالمية، والسيولة في البورصات الكبرى مثل Binance، ومستويات التضخم في الولايات المتحدة. سعر الإيثيريوم يرتبط أيضاً بنشاط تطبيقات التمويل اللامركزي (DeFi) وتحديثات الشبكة الرئيسية.</p>
              <p><strong className="text-white/80">الفوركس والدولار:</strong> سعر الدولار مقابل الدينار الجزائري (USD/DZD) يرتبط باستقرار العرض والطلب في سوق الصرف الوطني وقرارات بنك الجزائر، بينما يتبع سعر اليورو والدولار في العالم تحركات أسعار الفائدة عند البنوك المركزية الكبرى.</p>
            </>
          ) : (
            <>
              <p><strong className="text-white/80">Today Gold Price:</strong> Gold is one of the world most important safe-haven assets. Its price reacts to US Federal Reserve policy, inflation data, the strength of the US dollar, and demand from central banks and investment funds. When the dollar weakens, gold usually rises and vice versa.</p>
              <p><strong className="text-white/80">Bitcoin & Crypto:</strong> Bitcoin trades 24/7 and is known for sharp volatility driven by global regulation, liquidity on major exchanges such as Binance, and US inflation expectations. Ethereum price also tracks decentralized finance (DeFi) activity and major network upgrades.</p>
              <p><strong className="text-white/80">Forex & USD:</strong> The USD to Algerian Dinar (USD/DZD) rate reflects supply and demand in the national exchange market and Bank of Algeria policy, while EUR/USD follows interest rate moves at major central banks.</p>
            </>
          )}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="space-y-3">
        <h2 className="text-xl sm:text-2xl font-black text-white">{isAr ? 'أسئلة شائعة عن أسعار الذهب والعملات' : 'Frequently Asked Questions'}</h2>
        <div className="space-y-2">
          {faqs.map((f, i) => (
            <FAQItem key={i} qAr={f.qAr} qEn={f.qEn} aAr={f.aAr} aEn={f.aEn} isAr={isAr} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
        <p className="text-sm text-white/50 leading-relaxed">
          {isAr
            ? 'إخلاء مسؤولية: الأسعار المعروضة هي أسعار السوق الفورية العالمية لأغراض معلوماتية وتعليمية فقط، ولا تمثل توصية بيع أو شراء. التداول في الأسواق المالية يحمل مخاطر خسارة كبيرة، وقد تختلف الأسعار المحلية عند التجار بحسب الرسوم والعرض والطلب.'
            : 'Disclaimer: Prices shown are global live spot rates for informational and educational purposes only and are not buy/sell recommendations. Trading financial markets carries high risk and local dealer prices may differ due to fees, supply and demand.'}
        </p>
      </motion.div>
    </div>
  );
}