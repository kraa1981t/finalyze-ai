import React from 'react';
import { AnalysisResult } from '../types';
import { TrendingUp, TrendingDown, DollarSign, Bitcoin, Gem, Activity } from 'lucide-react';
import { cn } from '../lib/utils';
import { Language } from '../lib/i18n';

interface SignalSummaryProps {
  signals: AnalysisResult[];
  lang: Language;
}

const CATEGORY_CONFIG: Record<string, { icon: any; color: string; labelAr: string; labelEn: string }> = {
  forex: { icon: DollarSign, color: '#3B82F6', labelAr: 'الفوركس', labelEn: 'Forex' },
  crypto: { icon: Bitcoin, color: '#F59E0B', labelAr: 'الكريبتو', labelEn: 'Crypto' },
  stocks: { icon: Activity, color: '#8B5CF6', labelAr: 'الأسهم', labelEn: 'Stocks' },
  metals: { icon: Gem, color: '#EC4899', labelAr: 'المعادن', labelEn: 'Metals' },
};

const SYMBOL_CATEGORIES: Record<string, string[]> = {
  forex: [
    'EURUSD', 'EURGBP', 'EURJPY', 'EURAUD', 'EURNZD', 'EURCAD', 'EURCHF',
    'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF', 'USDJPY', 'USDMXN',
    'GBPJPY', 'GBPAUD', 'GBPNZD', 'GBPCAD', 'GBPCHF',
    'AUDJPY', 'AUDNZD', 'AUDCAD', 'AUDCHF', 'NZDJPY', 'NZDCAD', 'NZDCHF',
    'CADJPY', 'CADCHF', 'CHFJPY'
  ],
  crypto: [
    'BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD', 'XRPUSD', 'ADAUSD', 'AVAXUSD',
    'DOGEUSD', 'SHIBUSD', 'PEPEUSD', 'WIFUSD', 'BONKUSD',
    'DOTUSD', 'LINKUSD', 'MATICUSD', 'UNIUSD', 'LTCUSD', 'BCHUSD'
  ],
  stocks: [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
    'XOM', 'CVX', 'SHEL', 'TTE', 'BP',
    'JPM', 'BAC', 'WFC', 'C', 'GS'
  ],
  metals: ['XAUUSD', 'XAGUSD', 'XPTUSD', 'XCUUSD', 'XPDUSD']
};

export default function SignalSummary({ signals, lang }: SignalSummaryProps) {
  if (signals.length === 0) return null;
  const isRTL = lang === 'ar';

  const categories = Object.entries(SYMBOL_CATEGORIES).map(([cat, symbols]) => {
    const catSignals = signals.filter(s => {
      const sym = s.symbol.replace(/[-/]/g, '').toUpperCase();
      return symbols.some(su => sym.includes(su.replace('USD', ''))) || symbols.includes(sym);
    });

    const buys = catSignals.filter(s => s.signal.includes('buy')).length;
    const sells = catSignals.filter(s => s.signal.includes('sell')).length;
    const net = buys - sells;

    return { cat, buys, sells, net, count: catSignals.length, ...CATEGORY_CONFIG[cat] };
  }).filter(c => c.count > 0);

  if (categories.length === 0) return null;

  const totalBuys = categories.reduce((a, c) => a + c.buys, 0);
  const totalSells = categories.reduce((a, c) => a + c.sells, 0);
  const totalNet = totalBuys - totalSells;

  return (
    <div className="mb-6 rounded-2xl border border-brand-text/10 bg-brand-alt/40 backdrop-blur-md p-4">
      <h3 className={cn("text-[10px] font-black uppercase tracking-[0.2em] text-brand-muted mb-3 flex items-center gap-2", isRTL ? "flex-row-reverse" : "")}>
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        {isRTL ? 'ملخص الإشارات' : 'Signal Summary'}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {categories.map(({ cat, buys, sells, net, color, icon: Icon, labelAr, labelEn }) => (
          <div key={cat} className="rounded-xl bg-brand-bg/40 border border-brand-text/5 p-3">
            <div className={cn("flex items-center gap-2 mb-2", isRTL ? "flex-row-reverse" : "")}>
              <Icon size={14} style={{ color }} />
              <span className="text-[10px] font-black uppercase tracking-wider" style={{ color }}>
                {isRTL ? labelAr : labelEn}
              </span>
            </div>
            <div className={cn("flex items-center gap-3", isRTL ? "flex-row-reverse" : "")}>
              <span className="text-sm font-black text-emerald-400">{buys} ↑</span>
              <span className="text-sm font-black text-red-400">{sells} ↓</span>
            </div>
            <div className={cn("mt-1 text-[10px] font-black", isRTL ? "text-right" : "text-left",
              net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-slate-500')}>
              {isRTL ? 'صافي' : 'Net'}: {net > 0 ? '+' : ''}{net}
            </div>
          </div>
        ))}
      </div>

      <div className={cn("flex items-center gap-4 pt-2 border-t border-brand-text/5", isRTL ? "flex-row-reverse justify-end" : "")}>
        <span className="text-xs font-black text-emerald-400">{totalBuys} ↑ {isRTL ? 'شراء' : 'Buy'}</span>
        <span className="text-xs font-black text-red-400">{totalSells} ↓ {isRTL ? 'بيع' : 'Sell'}</span>
        <span className={cn("text-xs font-black",
          totalNet > 0 ? 'text-emerald-400' : totalNet < 0 ? 'text-red-400' : 'text-slate-500')}>
          {isRTL ? 'الصافي' : 'Net'}: {totalNet > 0 ? '+' : ''}{totalNet}
        </span>
      </div>
    </div>
  );
}
