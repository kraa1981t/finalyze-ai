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
import { lt, ltp, pick, pkick, loc } from '../lib/i18nUI';

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

const symbolsMeta: { sym: string; nameEn: string; nameAr: string; nameEs: string; nameRu: string; nameFr: string; icon: any; color: string; digits: number }[] = [
  { sym: 'XAUUSD', nameEn: 'Gold (Ounce)', nameAr: 'الذهب (أونصة)', nameEs: 'Oro (onza)', nameRu: 'Золото (унция)', nameFr: 'Or (once)', icon: Gem, color: 'from-amber-400 to-yellow-600', digits: 2 },
  { sym: 'XAGUSD', nameEn: 'Silver (Ounce)', nameAr: 'الفضة (أونصة)', nameEs: 'Plata (onza)', nameRu: 'Серебро (унция)', nameFr: 'Argent (once)', icon: Coins, color: 'from-slate-300 to-slate-500', digits: 3 },
  { sym: 'BTCUSDT', nameEn: 'Bitcoin', nameAr: 'البيتكوين', nameEs: 'Bitcoin', nameRu: 'Биткоин', nameFr: 'Bitcoin', icon: Bitcoin, color: 'from-orange-400 to-amber-600', digits: 0 },
  { sym: 'ETHUSDT', nameEn: 'Ethereum', nameAr: 'الإيثيريوم', nameEs: 'Ethereum', nameRu: 'Эфириум', nameFr: 'Ethereum', icon: Activity, color: 'from-indigo-400 to-violet-600', digits: 0 },
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

function FAQItem({ f, lang, open, onToggle }: { f: { qEn: string; qAr: string; qEs: string; qRu: string; qFr: string; aEn: string; aAr: string; aEs: string; aRu: string; aFr: string }; lang: Language; open: boolean; onToggle: () => void }) {
  return (
    <div className="bg-brand-alt rounded-2xl border border-white/10 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="text-base font-black text-white">{pkick(lang, f, 'q')}</span>
        <ChevronDown size={18} className={`text-[#F59E0B] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="px-5 pb-5 text-base text-white/70 leading-relaxed">{pkick(lang, f, 'a')}</div>
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
    const titleEn = 'Live Gold & Bitcoin Prices Today - Joseph.Trading';
    const titleAr = 'أسعار الذهب والبيتكوين والعملات اليوم مباشرة - Joseph.Trading';
    const titleEs = 'Precios de Oro y Bitcoin en Vivo Hoy - Joseph.Trading';
    const titleRu = 'Цены на золото и биткоин сегодня в прямом эфире - Joseph.Trading';
    const titleFr = 'Cours de l’or et du Bitcoin en direct aujourd’hui - Joseph.Trading';
    const descEn = 'Live gold price in Algeria and worldwide, real-time Bitcoin and Ethereum prices. Gold, silver and crypto prices with continuous updates and professional charts.';
    const descAr = 'سعر الذهب اليوم في الجزائر والدولار والعالم، سعر البيتكوين والإيثيريوم لحظة بلحظة. أسعار حية للذهب والفضة والعملات الرقمية مع تحديث مستمر ومخططات احترافية.';
    const descEs = 'Precio del oro en Argelia y el mundo, precios del Bitcoin y Ethereum en tiempo real. Oro, plata y criptomonedas con actualización continua y gráficos profesionales.';
    const descRu = 'Цена золота в Алжире и мире, цены на биткоин и эфириум в реальном времени. Золото, серебро и криптовалюты с непрерывным обновлением и профессиональными графиками.';
    const descFr = 'Cours de l’or en Algérie et dans le monde, prix du Bitcoin et de l’Ethereum en temps réel. Or, argent et cryptos avec mises à jour continues et graphiques professionnels.';
    document.title = pkick(lang, { titleEn, titleAr, titleEs, titleRu, titleFr }, 'title');
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.setAttribute('name', 'description'); document.head.appendChild(meta); }
    meta.setAttribute('content', pkick(lang, { descEn, descAr, descEs, descRu, descFr }, 'desc'));

    let ogp = document.querySelector('meta[property="og:title"]');
    if (!ogp) { ogp = document.createElement('meta'); ogp.setAttribute('property', 'og:title'); document.head.appendChild(ogp); }
    ogp.setAttribute('content', pkick(lang, { titleEn, titleAr, titleEs, titleRu, titleFr }, 'title'));

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
      name: pkick(lang, { titleEn, titleAr, titleEs, titleRu, titleFr }, 'title'),
      url: 'https://joseph-trading.vercel.app/#/prices',
      inLanguage: lang,
      description: pkick(lang, { descEn, descAr, descEs, descRu, descFr }, 'desc'),
      mainEntity: {
        '@type': 'ItemList',
        name: lt(lang, 298),
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
  }, [lang, lt]);

  const goldDzd = xau != null && dzd != null ? xau * dzd : null;
  const goldEur = xau != null && eurusd != null && eurusd > 0 ? xau / eurusd : null;
  const silverDzd = xag != null && dzd != null ? xag * dzd : null;
  const btcDzd = btc != null && dzd != null ? btc * dzd : null;
  const ethDzd = eth != null && dzd != null ? eth * dzd : null;

  const faqs: { qEn: string; qAr: string; qEs: string; qRu: string; qFr: string; aEn: string; aAr: string; aEs: string; aRu: string; aFr: string }[] = [
    {
      qEn: 'What is today gold price?',
      qAr: 'كم سعر الذهب اليوم؟',
      qEs: '¿Cuál es el precio del oro hoy?',
      qRu: 'Какова цена золота сегодня?',
      qFr: 'Quel est le prix de l’or aujourd’hui ?',
      aEn: 'Today gold price is shown live in the table above per ounce in US dollars, with conversion to Algerian Dinar. The price changes in real time following global gold markets (COMEX and London Spot).',
      aAr: 'سعر الذهب اليوم يُعرض مباشرة في الجدول أعلاه بالأونصة بالدولار الأمريكي، مع التحويل إلى الدينار الجزائري. يتغير السعر لحظياً حسب أسواق الذهب العالمية (COMEX وLondon Spot) فهذا يساعدك على معرفة سعر الذهب الحقيقي لتداولك أو استثمارك.',
      aEs: 'El precio del oro de hoy se muestra en vivo en la tabla de arriba por onza en dólares estadounidenses, con conversión a dinar argelino. El precio cambia en tiempo real siguiendo los mercados mundiales del oro (COMEX y London Spot).',
      aRu: 'Цена золота сегодня отображается в таблице выше за унцию в долларах США с пересчётом в алжирский динар. Цена меняется в реальном времени в зависимости от мировых рынков золота (COMEX и London Spot).',
      aFr: 'Le prix de l’or d’aujourd’hui est affiché en direct dans le tableau ci-dessus par once en dollars américains, avec conversion en dinar algérien. Le prix évolue en temps réel selon les marchés mondiaux de l’or (COMEX et London Spot).',
    },
    {
      qEn: 'Are Bitcoin and crypto prices live?',
      qAr: 'هل أسعار البيتكوين والعملات الرقمية حية؟',
      qEs: '¿Los precios de Bitcoin y las criptomonedas están en vivo?',
      qRu: 'Актуальны ли цены на биткоин и криптовалюты?',
      qFr: 'Les prix du Bitcoin et des cryptos sont-ils en direct ?',
      aEn: 'Yes, all prices shown are fetched live from market venues such as Binance for crypto and Twelve Data/Yahoo for metals, and refresh automatically every 60 seconds.',
      aAr: 'نعم، جميع الأسعار المعروضة في الصفحة تُجلب مباشرة من بورصات ومنصات حية مثل Binance لأسعار العملات الرقمية وTwelve Data/Yahoo لأسعار الذهب والمعادن، ويتم تحديثها تلقائياً كل 60 ثانية دون الحاجة لإعادة تحميل الصفحة.',
      aEs: 'Sí, todos los precios mostrados se obtienen en vivo de mercados como Binance para criptomonedas y Twelve Data/Yahoo para metales, y se actualizan automáticamente cada 60 segundos.',
      aRu: 'Да, все показанные цены загружаются в реальном времени с площадок, таких как Binance для криптовалют и Twelve Data/Yahoo для металлов, и обновляются автоматически каждые 60 секунд.',
      aFr: 'Oui, tous les prix affichés proviennent en direct de plateformes comme Binance pour les cryptos et Twelve Data/Yahoo pour les métaux, et se mettent à jour automatiquement toutes les 60 secondes.',
    },
    {
      qEn: 'What is the gold price in Algerian Dinar?',
      qAr: 'ما هو سعر الذهب بالدينار الجزائري؟',
      qEs: '¿Cuál es el precio del oro en dinar argelino?',
      qRu: 'Какова цена золота в алжирском динаре?',
      qFr: 'Quel est le prix de l’or en dinar algérien ?',
      aEn: 'Our site converts the gold price to Algerian Dinar (DZD) automatically every update so you always see today gold value in your local currency.',
      aAr: `موقعنا يحول سعر الذهب مباشرة إلى الدينار الجزائري (DZD) تلقائياً. حالياً أونصة الذهب تعادل تقريباً ${goldDzd != null ? fmt(goldDzd, 0) + ' دينار جزائري' : '—'}، ويتم تحديث هذا المبلغ مع كل تحرك في سوق الذهب أو صرف العملات.`,
      aEs: `Nuestro sitio convierte el precio del oro a dinar argelino (DZD) automáticamente. Actualmente una onza de oro equivale aproximadamente a ${goldDzd != null ? fmt(goldDzd, 0) + ' dinares argelinos' : '—'}, y esta cantidad se actualiza con cada movimiento del mercado del oro o del cambio de divisas.`,
      aRu: `Наш сайт автоматически конвертирует цену золота в алжирский динар (DZD). Сейчас унция золота стоит примерно ${goldDzd != null ? fmt(goldDzd, 0) + ' алжирских динаров' : '—'}, и эта сумма обновляется при каждом движении рынка золота или валютного курса.`,
      aFr: `Notre site convertit automatiquement le prix de l’or en dinar algérien (DZD). Actuellement, une once d’or vaut environ ${goldDzd != null ? fmt(goldDzd, 0) + ' dinares algériens' : '—'}, montant mis à jour à chaque mouvement du marché de l’or ou du change.`,
    },
    {
      qEn: 'What is the price of one gram of gold?',
      qAr: 'كم سعر غرام الذهب؟',
      qEs: '¿Cuál es el precio de un gramo de oro?',
      qRu: 'Сколько стоит один грамм золота?',
      qFr: 'Quel est le prix d’un gramme d’or ?',
      aEn: 'One gram of gold is computed by dividing the ounce price (31.1 grams). The current per-gram price is shown above.',
      aAr: `غرام الذهب يُحسب بتقسيم سعر الأونصة (31.1 غرام) على عدد الغرامات. حالياً سعر الغرام الواحد يعادل ${xau != null ? fmt(xau / 31.1035, 2) + ' دولار' : '—'}، ويمكنك حساب أي كمية بسهولة من السعر المعروض.`,
      aEs: `Un gramo de oro se calcula dividiendo el precio de la onza (31.1 gramos). Actualmente el precio por gramo es de ${xau != null ? fmt(xau / 31.1035, 2) + ' dólares' : '—'}. Puedes calcular cualquier cantidad con el precio mostrado.`,
      aRu: `Грамм золота рассчитывается делением цены унции (31,1 грамма). Сейчас цена за грамм составляет ${xau != null ? fmt(xau / 31.1035, 2) + ' долларов' : '—'}. Вы можете легко рассчитать любое количество по показанной цене.`,
      aFr: `Un gramme d’or se calcule en divisant le prix de l’once (31,1 grammes). Le prix actuel du gramme est de ${xau != null ? fmt(xau / 31.1035, 2) + ' dollars' : '—'}. Vous pouvez calculer n’importe quelle quantité à partir du prix affiché.`,
    },
    {
      qEn: 'Is trading gold and crypto safe?',
      qAr: 'هل التداول في الذهب والعملات الرقمية آمن؟',
      qEs: '¿Es seguro operar con oro y criptomonedas?',
      qRu: 'Безопасна ли торговля золотом и криптовалютами?',
      qFr: 'Est-il sûr de trader l’or et les cryptos ?',
      aEn: 'Trading involves financial risk regardless of the asset. Always use strict risk management and stop-loss orders. Joseph.Trading provides professional analysis and signals to help you decide more consciously.',
      aAr: 'التداول يحمل مخاطر مالية مهما كان الأصل، لذلك ننصح دائماً باستخدام إدارة مخاطر صارمة وتحديد أوامر وقف الخسارة. Joseph.Trading يقدم إشارات تداول وتحليلات فنية احترافية تساعدك على اتخاذ قرارات أكثر وعياً، لكن القرار النهائي ومسؤولية التداول تعود إليك.',
      aEs: 'Operar implica riesgo financiero independientemente del activo. Utiliza siempre una gestión estricta del riesgo y órdenes de stop-loss. Joseph.Trading ofrece análisis y señales profesionales para ayudarte a decidir con más conciencia.',
      aRu: 'Торговля всегда сопряжена с финансовым риском независимо от актива. Всегда используйте строгое управление рисками и стоп-лосс. Joseph.Trading предоставляет профессиональный анализ и сигналы, чтобы помочь вам принимать более осознанные решения.',
      aFr: 'Le trading comporte toujours un risque financier quel que soit l’actif. Utilisez toujours une gestion stricte du risque et des ordres stop-loss. Joseph.Trading fournit des analyses et des signaux professionnels pour vous aider à décider plus consciemment.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
      <button onClick={onBack} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group">
        <ArrowLeft size={20} className={`group-hover:-translate-x-1 transition-transform ${isAr ? 'rotate-180' : ''}`} />
        <span className="text-sm font-bold">{lt(lang, 97)}</span>
      </button>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto bg-[#F59E0B]/20 rounded-3xl flex items-center justify-center border border-[#F59E0B]/30">
          <TrendingUp size={32} className="text-[#F59E0B]" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white">
          {lt(lang, 300)}
        </h1>
        <p className="text-white/60 text-base max-w-2xl mx-auto leading-relaxed">
          {lt(lang, 262)}
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {lt(lang, 296)}
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/60 text-xs font-black px-3 py-1 rounded-full">
            <Timer size={13} className="text-[#F59E0B]" />
            {ltp(lang, 674, String(countdown))}
          </span>
          <button
            onClick={() => refresh(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 bg-[#F59E0B] text-black text-xs font-black px-3 py-1 rounded-full hover:bg-[#d97706] transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {lt(lang, 454)}
          </button>
        </div>
        <p className="text-sm text-white/40">
          {live.XAUUSD?.ts ? new Date(live.XAUUSD.ts).toLocaleString(loc(lang), { dateStyle: 'medium', timeStyle: 'medium' }) : '—'}
        </p>
      </motion.div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold rounded-xl px-4 py-3 text-center">
          {lt(lang, 523)}
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
                  <p className="text-sm font-black text-white/80">{pkick(lang, m, 'name')}</p>
                  <p className="text-xs font-bold text-white/40 font-mono">{m.sym}</p>
                </div>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-3xl font-black text-white tabular-nums leading-none">
                    {p != null ? `$${fmt(p, m.digits)}` : '—'}
                  </p>
                  <p className="text-sm font-bold text-white/40 mt-1">
                    {lt(lang, 595)}
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
                    {'≈'} {fmt(dzdVal, m.digits === 0 ? 0 : 2)} {lt(lang, 214)}
                  </p>
                ) : (
                  <p className="text-sm font-bold text-white/25 text-right">{lt(lang, 74)}</p>
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
            <h2 className="text-base font-black text-white">{lt(lang, 596)}</h2>
          </div>
          <p className="text-4xl font-black text-white tabular-nums">{dzd != null ? dzd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</p>
          <p className="text-sm font-bold text-white/50 mt-2 leading-relaxed">
            {lt(lang, 86)}
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-brand-alt rounded-2xl border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info size={20} className="text-[#F59E0B]" />
            <h2 className="text-base font-black text-white">{lt(lang, 443)}</h2>
          </div>
          <ul className="space-y-2 text-sm font-bold text-white/60 leading-relaxed">
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />{ltp(lang, 675, xau != null ? '$' + fmt(xau / 31.1035, 2) : '—')}</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />{ltp(lang, 676, goldEur != null ? fmt(goldEur, 0) : '—')}</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />{ltp(lang, 677, silverDzd != null ? fmt(silverDzd, 0) : '—')}</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />{ltp(lang, 678, btcDzd != null ? fmt(btcDzd, 0) : '—')}</li>
          </ul>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-black text-white">{lt(lang, 299)}</h2>
          <span className="text-xs font-black text-white/40">{lt(lang, 524)}</span>
        </div>
        <div className="h-[340px] sm:h-[420px]">
          <TradingViewEmbed symbol="XAUUSD" interval="60" />
        </div>
      </motion.div>

      <MarketBriefing lang={lang} />

      <AdSlot position="between" lang={lang} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-brand-alt rounded-2xl border border-white/10 p-5 sm:p-6 space-y-4">
        <h2 className="text-xl sm:text-2xl font-black text-white">{lt(lang, 563)}</h2>
        <div className="space-y-3.5 text-base text-white/70 leading-relaxed">
          {lang === 'ar' ? (
            <>
              <p><strong className="text-white/80">سعر الذهب اليوم:</strong> يعد الذهب من أهم الأصول الآمنة في العالم، ويتأثر سعره بمجموعة من العوامل أهمها قرارات البنوك الفيدرالية الأمريكية، بيانات التضخم، قوة الدولار، والطلب العالمي من البنوك المركزية وصناديق الاستثمار. عندما يتراجع الدولار، يرتفع الذهب عادة والعكس صحيح.</p>
              <p><strong className="text-white/80">الذهب في السوق الجزائري:</strong> شهد سعر الذهب اهتماماً متزايداً في الجزائر، حيث يلجأ المواطنون إلى شراء الذهب كوسيلة ادخار وحماية من تقلبات العملة. تجدر الإشارة أن السعر المعروض هنا هو السعر العالمي الفوري، وقد يختلف سعر غرام الذهب في محلات الصاغة المحلية بسبب الإضافة الضريبية وهامش الربح والطلب المحلي.</p>
              <p><strong className="text-white/80">سعر البيتكوين والعملات الرقمية:</strong> البيتكوين يعمل 24 ساعة على مدار الأسبوع، ويتميز بتقلبات حادة تتأثر بالتطورات التنظيمية العالمية، والسيولة في البورصات الكبرى مثل Binance، ومستويات التضخم في الولايات المتحدة. سعر الإيثيريوم يرتبط أيضاً بنشاط تطبيقات التمويل اللامركزي (DeFi) وتحديثات الشبكة الرئيسية.</p>
              <p><strong className="text-white/80">الفوركس والدولار:</strong> سعر الدولار مقابل الدينار الجزائري (USD/DZD) يرتبط باستقرار العرض والطلب في سوق الصرف الوطني وقرارات بنك الجزائر، بينما يتبع سعر اليورو والدولار في العالم تحركات أسعار الفائدة عند البنوك المركزية الكبرى.</p>
            </>
          ) : lang === 'es' ? (
            <>
              <p><strong className="text-white/80">Precio del oro hoy:</strong> El oro es uno de los activos refugio más importantes del mundo. Su precio reacciona a la política de la Reserva Federal, los datos de inflación, la fortaleza del dólar y la demanda de los bancos centrales y fondos de inversión. Cuando el dólar se debilita, el oro suele subir y viceversa.</p>
              <p><strong className="text-white/80">Oro en el mercado argelino:</strong> El precio del oro ha ganado creciente interés en Argelia, donde la gente compra oro como ahorro y protección frente a las fluctuaciones de la moneda. Cabe señalar que el precio mostrado aquí es el precio al contado mundial; el precio del gramo en las tiendas locales puede variar por impuestos, márgenes y demanda local.</p>
              <p><strong className="text-white/80">Bitcoin y criptomonedas:</strong> Bitcoin opera las 24 horas los 7 días y es conocido por su fuerte volatilidad impulsada por la regulación global, la liquidez en grandes exchanges como Binance y las expectativas de inflación en EE. UU. El precio de Ethereum también sigue la actividad de las finanzas descentralizadas (DeFi) y las actualizaciones de red.</p>
              <p><strong className="text-white/80">Forex y USD:</strong> La tasa USD frente al dinar argelino (USD/DZD) refleja la oferta y la demanda en el mercado de divisas nacional y la política del Banco de Argelia, mientras que el EUR/USD sigue los movimientos de las tasas de interés de los principales bancos centrales.</p>
            </>
          ) : lang === 'ru' ? (
            <>
              <p><strong className="text-white/80">Цена золота сегодня:</strong> Золото — один из важнейших защитных активов в мире. Его цена реагирует на политику ФРС США, данные по инфляции, силу доллара и спрос со стороны центральных банков и инвестиционных фондов. Когда доллар ослабевает, золото обычно дорожает, и наоборот.</p>
              <p><strong className="text-white/80">Золото на алжирском рынке:</strong> В Алжире растёт интерес к золоту: люди покупают его как средство сбережения и защиту от колебаний валюты. Отметим, что указанная здесь цена — это мировая спотовая цена; цена грамма в местных ювелирных магазинах может отличаться из-за налогов, маржи и местного спроса.</p>
              <p><strong className="text-white/80">Биткоин и криптовалюты:</strong> Биткоин торгуется круглосуточно 7 дней в неделю и отличается резкой волатильностью из-за глобального регулирования, ликвидности крупных бирж, таких как Binance, и инфляционных ожиданий в США. Цена Эфириума также зависит от активности децентрализованных финансов (DeFi) и крупных обновлений сети.</p>
              <p><strong className="text-white/80">Форекс и доллар:</strong> Курс доллара к алжирскому динару (USD/DZD) отражает спрос и предложение на национальном валютном рынке и политику Банка Алжира, тогда как EUR/USD следует за движением процентных ставок ведущих центральных банков.</p>
            </>
          ) : lang === 'fr' ? (
            <>
              <p><strong className="text-white/80">Prix de l’or aujourd’hui :</strong> L’or est l’un des actifs refuges les plus importants au monde. Son prix réagit à la politique de la Réserve fédérale américaine, aux données d’inflation, à la force du dollar et à la demande des banques centrales et des fonds d’investissement. Lorsque le dollar faiblit, l’or monte généralement, et inversement.</p>
              <p><strong className="text-white/80">L’or sur le marché algérien :</strong> Le prix de l’or suscite un intérêt croissant en Algérie, où l’or est acheté comme épargne et protection contre les fluctuations de la monnaie. À noter : le prix affiché ici est le prix au comptant mondial ; le prix du gramme dans les bijouteries locales peut varier selon la fiscalité, les marges et la demande locale.</p>
              <p><strong className="text-white/80">Bitcoin et cryptomonnaies :</strong> Le Bitcoin négocie 24h/24 et 7j/7, avec une forte volatilité liée à la réglementation mondiale, à la liquidité des grandes places comme Binance et aux attentes d’inflation aux États-Unis. Le prix de l’Ethereum suit aussi l’activité de la finance décentralisée (DeFi) et les grandes mises à jour du réseau.</p>
              <p><strong className="text-white/80">Forex et USD :</strong> Le taux USD contre dinar algérien (USD/DZD) reflète l’offre et la demande sur le marché des changes national et la politique de la Banque d’Algérie, tandis que l’EUR/USD suit les mouvements de taux des grandes banques centrales.</p>
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
        <h2 className="text-xl sm:text-2xl font-black text-white">{lt(lang, 266)}</h2>
        <div className="space-y-2">
          {faqs.map((f, i) => (
            <FAQItem key={i} f={f} lang={lang} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
        <p className="text-sm text-white/50 leading-relaxed">
          {lt(lang, 209)}
        </p>
      </motion.div>
    </div>
  );
}