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

  const getLabel = (key: string) => {
    if (isAr) {
      switch (key) {
        case 'forex': return t.forex;
        case 'crypto': return t.crypto;
        case 'stocks': return t.stocks;
        case 'metals': return t.metals;
        default: return key;
      }
    }
    switch (key) {
      case 'forex': return 'Forex';
      case 'crypto': return 'Crypto';
      case 'stocks': return 'Stocks';
      case 'metals': return 'Metals';
      default: return key;
    }
  };

  const getOpenTitle = (label: string, open: boolean) => {
    return `${label}: ${open ? (isAr ? 'سوق مفتوح' : 'Market Open') : (isAr ? 'سوق مغلق' : 'Market Closed')}`;
  };

  const circleClass = compact
    ? 'inline-flex items-center justify-center min-w-[72px] h-12 rounded-full text-xs font-black border transition-colors'
    : 'flex-1 inline-flex items-center justify-center h-14 rounded-full text-sm font-black border transition-colors';

  const colorClass = (open: boolean) => open
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
    : 'bg-red-500/20 text-red-400 border-red-500/40';

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2">
        {CAT_KEYS.map(key => {
          const open = isCategoryOpen(key, now);
          const label = getLabel(key);
          return (
            <span
              key={key}
              className={`${circleClass} ${colorClass(open)}`}
              title={getOpenTitle(label, open)}
            >
              {label}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 w-full">
      {CAT_KEYS.map(key => {
        const open = isCategoryOpen(key, now);
        const label = getLabel(key);
        return (
          <span
            key={key}
            className={`${circleClass} ${colorClass(open)}`}
            title={getOpenTitle(label, open)}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}