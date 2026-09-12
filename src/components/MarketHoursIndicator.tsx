import React from 'react';
import { getOpenStockExchanges, exchangeLabel } from '../lib/marketHours';
import { Language, translations } from '../lib/i18n';

interface MarketHoursIndicatorProps {
  lang: Language;
  compact?: boolean;
}

const CAT_KEYS = ['forex', 'crypto', 'stocks', 'metals'] as const;

function isCategoryOpen(key: string, now: Date): boolean {
  if (key === 'crypto') return true;
  if (key === 'stocks') return getOpenStockExchanges(now).length > 0;
  const day = now.getUTCDay();
  return day !== 0 && day !== 6;
}

export default function MarketHoursIndicator({ lang, compact = false }: MarketHoursIndicatorProps) {
  const isAr = lang === 'ar';
  const t = translations[lang];
  const now = new Date();

  const getLabelAndStatus = (key: string) => {
    const open = isCategoryOpen(key, now);
    let label: string;
    let status: string;
    if (isAr) {
      switch (key) {
        case 'forex': label = t.forex; break;
        case 'crypto': label = t.crypto; break;
        case 'stocks': label = t.stocks; break;
        case 'metals': label = t.metals; break;
        default: label = key;
      }
    } else {
      switch (key) {
        case 'forex': label = 'Forex'; break;
        case 'crypto': label = 'Crypto'; break;
        case 'stocks': label = 'Stocks'; break;
        case 'metals': label = 'Metals'; break;
        default: label = key;
      }
    }

    if (key === 'stocks') {
      const openExchanges = getOpenStockExchanges(now);
      if (openExchanges.length > 0) {
        status = openExchanges.map(ex => exchangeLabel(ex.key, isAr ? 'ar' : 'en')).join(isAr ? '، ' : ', ');
      } else {
        status = isAr ? 'سوق مغلق' : 'Market Closed';
      }
    } else {
      status = open ? (isAr ? 'سوق مفتوح' : 'Market Open') : (isAr ? 'سوق مغلق' : 'Market Closed');
    }
    const statusShort = open ? (isAr ? 'مفتوح' : 'Open') : (isAr ? 'مغلق' : 'Closed');
    return { label, status, statusShort, open };
  };

  const getLabel = (key: string): string => getLabelAndStatus(key).label;

  const circleContent = (({ label, status, statusShort }: { label: string; status: string; statusShort: string }) => {
    if (compact) {
      return (
        <span className="flex flex-col items-center text-sm">
          {label}
          <div className="mt-1 text-[10px]">{statusShort}</div>
        </span>
      );
    }
    return (
      <div className="flex flex-col items-center leading-tight">
        <span className="text-sm md:text-xl font-black whitespace-nowrap leading-tight">{label}</span>
        <span className="mt-1 text-[10px] md:hidden font-black whitespace-nowrap leading-tight">{statusShort}</span>
        <span className="hidden md:block mt-1 text-base font-black whitespace-nowrap leading-tight">{status}</span>
      </div>
    );
  });

  const getOpenTitle = (label: string, status: string) => {
    return `${label}: ${status}`;
  };

  const circleClass = compact
    ? 'inline-flex items-center justify-center min-w-[80px] h-14 rounded-full text-sm font-black border transition-colors'
    : 'flex-1 min-w-[64px] md:min-w-0 inline-flex items-center justify-center h-14 md:h-20 rounded-full text-base font-black border transition-colors px-2 md:px-0 whitespace-nowrap';

  const colorClass = (open: boolean) => open
    ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-500/30'
    : 'bg-red-500 text-white border-red-600 shadow-lg shadow-red-500/30';

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2">
        {CAT_KEYS.map(key => {
          const { label, status, statusShort, open } = getLabelAndStatus(key);
          return (
            <span
              key={key}
              className={`${circleClass} ${colorClass(open)}`}
              title={getOpenTitle(label, status)}
            >
              {circleContent({ label, status, statusShort })}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 md:gap-3 w-full overflow-x-auto md:overflow-visible" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
      {CAT_KEYS.map(key => {
        const { label, status, statusShort, open } = getLabelAndStatus(key);
        return (
          <span
            key={key}
            className={`${circleClass} ${colorClass(open)}`}
            title={getOpenTitle(label, status)}
          >
            {circleContent({ label, status, statusShort })}
          </span>
        );
      })}
    </div>
  );
}