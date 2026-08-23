import React, { useState } from 'react';
import { ExternalLink, TrendingUp, ShieldCheck, Info } from 'lucide-react';
import { SYMBOL_CATEGORIES } from '../constants';
import { Language } from '../lib/i18n';
import TradingViewWidget from './TradingViewWidget';

interface TradeNowPageProps {
  lang: Language;
}

const CATEGORY_TABS = [
  { key: 'forex', labelAr: 'الفوركس', labelEn: 'Forex', emoji: '\uD83D\uDCB1' },
  { key: 'crypto', labelAr: 'الكريبتو', labelEn: 'Crypto', emoji: '\uD83E\uDDF1' },
  { key: 'stocks', labelAr: 'الأسهم', labelEn: 'Stocks', emoji: '\uD83D\uDCC8' },
  { key: 'metals', labelAr: 'المعادن', labelEn: 'Metals', emoji: '\uD83D\uDC8E' },
];

function toTvSymbol(sym: string): string {
  const s = sym.toUpperCase();
  if ((SYMBOL_CATEGORIES.crypto as string[]).includes(s)) {
    return `BINANCE:${s.replace('USD', 'USDT')}`;
  }
  if ((SYMBOL_CATEGORIES.metals as string[]).includes(s)) {
    return `OANDA:${s}`;
  }
  if ((SYMBOL_CATEGORIES.forex as string[]).includes(s)) {
    return `FX:${s}`;
  }
  const indexMap: Record<string, string> = {
    US500: 'FOREXCOM:SPXUSD',
    US30: 'FOREXCOM:NSXUSD',
    US100: 'FOREXCOM:NDXUSD',
    SPY: 'AMEX:SPY',
    QQQ: 'NASDAQ:QQQ',
  };
  if (indexMap[s]) return indexMap[s];
  return `NASDAQ:${s}`;
}

export default function TradeNowPage({ lang }: TradeNowPageProps) {
  const isAr = lang === 'ar';
  const [category, setCategory] = useState<string>('forex');
  const [symbol, setSymbol] = useState<string>('EURUSD');

  const symbols = SYMBOL_CATEGORIES[category as keyof typeof SYMBOL_CATEGORIES] || [];
  const tvSymbol = toTvSymbol(symbol);

  const selectCategory = (key: string) => {
    setCategory(key);
    setSymbol((SYMBOL_CATEGORIES[key as keyof typeof SYMBOL_CATEGORIES] || [])[0] || '');
  };

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
              {isAr ? 'افتح صفقات تداولية مباشرة عبر منصة TradingView بحساب مجاني' : 'Place live trades via TradingView with a free account'}
            </p>
          </div>
        </div>
        <a
          href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#F59E0B] hover:bg-[#d97706] text-black font-black uppercase tracking-wider shadow-xl shadow-[#F59E0B]/30 active:scale-95 transition-all"
        >
          <ExternalLink size={18} />
          {isAr ? 'افتح منصة التداول' : 'Open Trading Platform'}
        </a>
      </div>

      {/* Free Account Badge */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 flex items-center gap-3">
        <ShieldCheck size={22} className="text-emerald-400 flex-shrink-0" />
        <span className="text-sm font-bold text-emerald-300">
          {isAr
            ? 'حساب TradingView مجاني يتيح لك فتح صفقات تجريبية (Paper Trading) على جميع الرموز المعروضة في الموقع'
            : 'A free TradingView account lets you place paper trades on all symbols displayed on this site'}
        </span>
      </div>

      {/* Symbol Selector */}
      <div className="rounded-3xl border border-white/10 bg-black/20 backdrop-blur-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => selectCategory(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-all border ${
                category === tab.key
                  ? 'bg-[#F59E0B] text-black border-[#F59E0B] shadow-lg shadow-[#F59E0B]/25'
                  : 'bg-white/5 text-brand-text/60 border-white/10 hover:bg-white/10'
              }`}
            >
              {tab.emoji} {isAr ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
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
      <div className="rounded-3xl overflow-hidden border border-white/10 bg-black/20 h-[520px] relative">
        <TradingViewWidget symbol={tvSymbol} />
        <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-white text-xs font-black flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {symbol}
        </div>
      </div>

      {/* Info Footer */}
      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 flex items-start gap-3">
        <Info size={18} className="text-sky-400 flex-shrink-0 mt-0.5" />
        <span className="text-xs font-bold text-brand-text/60 leading-relaxed">
          {isAr
            ? 'الصفقات تُنفَّذ داخل منصة TradingView نفسها بعد تسجيل الدخول بحسابك المجاني. هذا القسم للتداول اليدوي فقط ولا علاقة له بإشارات التحليل التلقائي.'
            : 'Trades are executed inside TradingView itself after signing in with your free account. This section is for manual trading only and is separate from the auto analysis signals.'}
        </span>
      </div>
    </div>
  );
}
