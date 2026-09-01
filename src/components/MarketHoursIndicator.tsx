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
  const day = now.getDay();
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
    return { label, status, open };
  };

  const getLabel = (key: string): string => getLabelAndStatus(key).label;

  const circleContent = (({ label, status }: { label: string; status: string }) => {
    if (compact) {
      return (
        <span className="flex flex-col items-center text-xs">
          {label}
          <div className="mt-1 text-[8px]">{status}</div>
        </span>
      );
    }
    return (
      <div className="flex flex-col items-center text-sm">
        {label}
        <div className="mt-1 text-[10px]">{status}</div>
      </div>
    );
  });

  const getOpenTitle = (label: string, status: string) => {
    return `${label}: ${status}`;
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
          const { label, status, open } = getLabelAndStatus(key);
          return (
            <span
              key={key}
              className={`${circleClass} ${colorClass(open)}`}
              title={getOpenTitle(label, status)}
            >
              {circleContent({ label, status })}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 w-full">
      {CAT_KEYS.map(key => {
        const { label, status, open } = getLabelAndStatus(key);
        return (
          <span
            key={key}
            className={`${circleClass} ${colorClass(open)}`}
            title={getOpenTitle(label, status)}
          >
            {circleContent({ label, status })}
          </span>
        );
      })}
    </div>
  );
}