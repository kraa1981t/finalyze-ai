import React from 'react';
import { getOpenStockExchanges } from '../lib/marketHours';
import { Language, translations } from '../lib/i18n';

interface MarketHoursIndicatorProps {
  lang: Language;
  compact?: boolean;
}

const CAT_KEYS = ['forex', 'crypto', 'stocks', 'metals'] as const;

function isCategoryOpen(key: string, now: Date): boolean {
  if (key === 'crypto') return true;
  if (key === 'stocks') return getOpenStockExchanges(now).length > 0;
  const day = now.getDay();
  return day !== 0 && day !== 6;
}

export default function MarketHoursIndicator({ lang, compact = false }: MarketHoursIndicatorProps) {
  const isAr = lang === 'ar';
  const t = translations[lang];
  const now = new Date();

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {CAT_KEYS.map(key => {
          const open = isCategoryOpen(key, now);
          const label = isAr ? (key === 'forex' ? 'ف' : key === 'crypto' ? 'ك' : key === 'stocks' ? 'س' : 'م') : key[0].toUpperCase();
          return (
            <span
              key={key}
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-black border transition-colors ${
                open ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'
              }`}
              title={`${key}: ${open ? (isAr ? 'مفتوح' : 'Open') : (isAr ? 'مغلق' : 'Closed')}`}
            >
              {label}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {CAT_KEYS.map(key => {
        const open = isCategoryOpen(key, now);
        const label = isAr ? (key === 'forex' ? t.forex : key === 'crypto' ? t.crypto : key === 'stocks' ? t.stocks : t.metals) : (key === 'forex' ? 'Forex' : key === 'crypto' ? 'Crypto' : key === 'stocks' ? 'Stocks' : 'Metals');
        return (
          <span
            key={key}
            className={`inline-flex items-center justify-center min-w-[44px] h-6 rounded-full text-[10px] font-black border transition-colors ${
              open ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-red-500/20 text-red-400 border-red-500/40'
            }`}
            title={`${label}: ${open ? (isAr ? 'سوق مفتوح' : 'Market Open') : (isAr ? 'سوق مغلق' : 'Market Closed')}`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}