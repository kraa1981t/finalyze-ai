import React, { useState } from 'react';
import { AnalysisResult, SignalType } from '../types';
import { X, Trash2, BarChart2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Language, translations } from '../lib/i18n';
import { SYMBOL_CATEGORIES, ALL_SYMBOLS_DB } from '../constants';
import TradingViewEmbed from './TradingViewEmbed';
import MarketHoursIndicator from './MarketHoursIndicator';

interface TopSignalsProps {
  signals: AnalysisResult[];
  onRemove: (symbol: string) => void;
  onSelect: (result: AnalysisResult) => void;
  onDetail: (result: AnalysisResult) => void;
  onClearAll: () => void;
  lang: Language;
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; labelAr: string; labelEn: string; symbolColor: string }> = {
  [SignalType.STRONG_BUY]: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', labelAr: 'إشارة شراء قوي', labelEn: 'Strong Buy Signal', symbolColor: '#00ff88' },
  [SignalType.STRONG_SELL]: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/40', labelAr: 'إشارة بيع قوي', labelEn: 'Strong Sell Signal', symbolColor: '#ff4444' },
  [SignalType.BUY]: { color: 'text-emerald-400/80', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', labelAr: 'إشارة شراء', labelEn: 'Buy Signal', symbolColor: '#66ffaa' },
  [SignalType.SELL]: { color: 'text-red-400/80', bg: 'bg-red-500/10', border: 'border-red-500/20', labelAr: 'إشارة بيع', labelEn: 'Sell Signal', symbolColor: '#ff5555' },
};

const CATEGORY_CONFIG: Record<string, { emoji: string; labelAr: string; labelEn: string; color: string; borderColor: string }> = {
  forex: { emoji: '\uD83D\uDCB1', labelAr: 'الفوركس', labelEn: 'Forex', color: 'text-blue-400', borderColor: 'border-blue-500/30' },
  crypto: { emoji: '\uD83E\uDDF1', labelAr: 'الكريبتو', labelEn: 'Crypto', color: 'text-purple-400', borderColor: 'border-purple-500/30' },
  stocks: { emoji: '\uD83D\uDCC8', labelAr: 'الأسهم', labelEn: 'Stocks', color: 'text-yellow-400', borderColor: 'border-yellow-500/30' },
  metals: { emoji: '\uD83D\uDC8E', labelAr: 'المعادن', labelEn: 'Metals', color: 'text-orange-400', borderColor: 'border-orange-500/30' },
};

function getSymbolCategory(symbol: string): string {
  const sym = symbol.toUpperCase().replace(/[-_=]/g, '');
  for (const [cat, syms] of Object.entries(SYMBOL_CATEGORIES)) {
    if ((syms as string[]).includes(sym)) return cat.startsWith('stocks') ? 'stocks' : cat;
  }
  for (const [cat, syms] of Object.entries(ALL_SYMBOLS_DB)) {
    if ((syms as string[]).includes(sym)) return cat.startsWith('stocks') ? 'stocks' : cat;
  }
  if (sym.endsWith('USD') && !sym.startsWith('USD') && sym.length > 6) return 'crypto';
  if (/\.(T|AS|PA|DE|L|SW|CO)$/.test(symbol)) return 'stocks';
  return 'forex';
}

const formatPublishDate = (timestamp: string, lang: string) => {
  try {
    const date = new Date(timestamp);
    const isAr = lang === 'ar';
    const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = isAr ? daysAr[date.getDay()] : daysEn[date.getDay()];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${dayName} ${hours}:${minutes}`;
  } catch {
    return timestamp;
  }
};

export default function TopSignals({ signals, onRemove, onSelect, onDetail, onClearAll, lang }: TopSignalsProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null);

  if (signals.length === 0) return (
    <div className="mb-12 space-y-6">
      <MarketHoursIndicator lang={lang} />
      <div className={cn("flex items-center justify-between px-4", isAr ? "flex-row-reverse" : "flex-row")}>
        <span className="text-sm font-black text-yellow-400 uppercase tracking-[0.2em]">{t.bestSignals}</span>
        <button 
          onClick={onClearAll}
          className="flex items-center gap-2 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-500 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
        >
          <Trash2 size={12} />
          {t.clearAllResults}
        </button>
      </div>
      <div className="w-full bg-[#D1FAE5]/40 backdrop-blur-xl rounded-full h-3 border border-[#D1FAE5]/60 shadow-[0_0_25px_rgba(209,250,229,0.3)]" />
      <p className="text-center text-white/30 text-sm py-8">
        {isAr ? 'لا توجد إشارات حالياً - ابدأ التحليل التلقائي لرؤية الإشارات' : 'No signals yet - start auto analysis to see signals'}
      </p>
    </div>
  );

  const filteredSignals = signals.filter(s => !s.isSideways);

  const grouped: Record<string, AnalysisResult[]> = { forex: [], crypto: [], stocks: [], metals: [] };
  for (const s of filteredSignals) {
    const cat = getSymbolCategory(s.symbol);
    if (grouped[cat]) grouped[cat].push(s);
    else grouped.forex.push(s);
  }

  const catOrder = ['forex', 'crypto', 'stocks', 'metals'] as const;

  return (
    <div className="mb-12 space-y-6">
      <style>{`.signal-card .text-emerald-400{color:#059669!important}.signal-card .text-red-400{color:#dc2626!important}`}</style>
      <MarketHoursIndicator lang={lang} />
      <div className={cn("flex items-center justify-between px-4", isAr ? "flex-row-reverse" : "flex-row")}>
        <span className="text-sm font-black text-yellow-400 flex items-center gap-2 uppercase tracking-[0.2em]">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          {t.bestSignals}
        </span>
        <button 
          onClick={onClearAll}
          className="flex items-center gap-2 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-500 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
        >
          <Trash2 size={12} />
          {t.clearAllResults}
        </button>
      </div>

      {catOrder.map(cat => {
        const catSignals = grouped[cat];
        if (catSignals.length === 0) return null;
        const cfg = CATEGORY_CONFIG[cat];
        const strong = catSignals.filter(s => s.signal === SignalType.STRONG_BUY || s.signal === SignalType.STRONG_SELL);
        const regular = catSignals.filter(s => s.signal === SignalType.BUY || s.signal === SignalType.SELL);
        const top3 = regular.sort((a, b) => b.confidence - a.confidence).slice(0, 3);

        return (
          <div key={cat} className="space-y-2">
            <div className={cn("flex items-center gap-2 px-2 py-1 rounded-lg border", cfg.borderColor, "bg-brand-alt/60")}>
              <span className="text-base">{cfg.emoji}</span>
              <span className={cn("text-xs font-black uppercase tracking-widest", cfg.color)}>
                {isAr ? cfg.labelAr : cfg.labelEn}
              </span>
              <span className="text-[10px] text-white/30 font-bold">({catSignals.length})</span>
            </div>

            {strong.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {strong.map((res, idx) => (
                  <SignalCard key={`s_${res.symbol}_${idx}`} res={res} isAr={isAr} onSelect={(r) => {
                    if (selectedSymbol === r.symbol) {
                      setSelectedSymbol(null);
                      setSelectedResult(null);
                    } else {
                      setSelectedSymbol(r.symbol);
                      setSelectedResult(r);
                    }
                  }} onDetail={onDetail} onRemove={onRemove} formatPublishDate={formatPublishDate} cardKey={`s_${res.symbol}_${idx}`} isSelected={selectedSymbol === res.symbol} />
                ))}
              </div>
            )}

            {top3.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {top3.map((res, idx) => (
                  <SignalCard key={`r_${res.symbol}_${idx}`} res={res} isAr={isAr} onSelect={(r) => {
                    if (selectedSymbol === r.symbol) {
                      setSelectedSymbol(null);
                      setSelectedResult(null);
                    } else {
                      setSelectedSymbol(r.symbol);
                      setSelectedResult(r);
                    }
                  }} onDetail={onDetail} onRemove={onRemove} formatPublishDate={formatPublishDate} cardKey={`r_${res.symbol}_${idx}`} isSelected={selectedSymbol === res.symbol} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Inline TradingView Chart */}
      {selectedSymbol && selectedResult && (
        <div className="bg-brand-alt rounded-3xl border border-white/10 overflow-hidden shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={18} className="text-primary" />
            <span className="text-base font-black text-white italic tracking-wider">{selectedSymbol}</span>
            {SIGNAL_META[selectedResult.signal] && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${SIGNAL_META[selectedResult.signal].bg} ${SIGNAL_META[selectedResult.signal].color} border ${SIGNAL_META[selectedResult.signal].border}`}>
                {isAr ? SIGNAL_META[selectedResult.signal].labelAr : SIGNAL_META[selectedResult.signal].labelEn}
              </span>
            )}
          </div>
          <div className="h-[350px] md:h-[500px] rounded-2xl overflow-hidden relative">
            <TradingViewEmbed symbol={selectedSymbol} interval="60" />
          </div>
        </div>
      )}
    </div>
  );
}

function SignalCard({ res, isAr, onSelect, onDetail, onRemove, formatPublishDate, cardKey, isSelected }: {
  res: AnalysisResult; isAr: boolean;
  onSelect: (r: AnalysisResult) => void; onDetail: (r: AnalysisResult) => void; onRemove: (s: string) => void;
  formatPublishDate: (ts: string, lang: string) => string; cardKey: string; isSelected?: boolean;
}) {
  const meta = SIGNAL_META[res.signal] || SIGNAL_META[SignalType.BUY];
  const isJPY = res.symbol.includes('JPY');
  const decimals = isJPY ? 3 : 5;
  const isStrong = res.signal === SignalType.STRONG_BUY || res.signal === SignalType.STRONG_SELL;
  const isVeryStrong = res.confidence >= 95;
  const tpPrice = res.takeProfit || 0;
  const slPrice = res.stopLoss || 0;

  return (
    <div className={cn("signal-card rounded-xl border-2 transition-all overflow-hidden relative", isSelected ? 'border-yellow-400 shadow-lg shadow-yellow-400/20' : 'border-amber-600/40')} style={{ backgroundColor: `rgba(var(--card-bg),0.88)`, alignSelf: 'start' }}>
      {/* Very strong signal star */}
      {isVeryStrong && (
        <div className="absolute top-1 right-1 z-20" title={isAr ? 'فرصة قوية جداً' : 'Very Strong Opportunity'}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="white" className="drop-shadow-[0_0_8px_rgba(255,255,255,1)] animate-[pulse_1.5s_ease-in-out_infinite]">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
      )}
      {/* Main card content */}
      <button onClick={() => { onSelect(res); }} className="w-full px-3 py-1.5 flex flex-col items-center gap-1">
        <div className="flex items-center justify-center w-full gap-2 overflow-hidden">
          <span className="text-sm sm:text-base font-black font-mono" style={{color:'#00ff88'}}>{tpPrice ? tpPrice.toFixed(decimals) : '—'}</span>
          <span className="text-lg sm:text-xl font-black italic flex-shrink-0 text-center" style={{ color: meta.symbolColor }}>{res.symbol}</span>
          <span className="text-sm sm:text-base font-black font-mono" style={{color:'#ff4444'}}>{slPrice ? slPrice.toFixed(decimals) : '—'}</span>
        </div>
        <span className="text-base sm:text-lg font-black" style={{color: meta.symbolColor}}>{isAr ? meta.labelAr : meta.labelEn}</span>
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-3xl font-black font-mono" style={{color:'#ffffff'}}>{res.confidence}%</span>
          {res.isSideways !== undefined && (
            <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${
              res.isSideways ? 'text-white bg-white/20 border-white/30' :
              res.sidewaysDirection === 'uptrend' ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/30' :
              res.sidewaysDirection === 'downtrend' ? 'text-red-300 bg-red-500/20 border-red-500/30' : ''
            }`}>
              {res.isSideways ? (isAr ? 'عرضي' : 'Side') : res.sidewaysDirection === 'uptrend' ? (isAr ? 'صاعد' : 'Up') : res.sidewaysDirection === 'downtrend' ? (isAr ? 'هابط' : 'Down') : ''}
            </span>
          )}
          <span className="text-[10px] sm:text-xs font-bold" style={{color:'rgba(255,255,255,0.85)'}}>{formatPublishDate(res.timestamp, isAr ? 'ar' : 'en')}</span>
        </div>
      </button>

      {/* Yellow Analysis Reasons button - directly under percentage */}
      {res.detailedReasons && res.detailedReasons.length > 0 && (
        <button onClick={(e) => { e.stopPropagation(); onDetail(res); }} className="w-full py-2.5 bg-[#F59E0B] hover:bg-[#d97706] transition-all text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2">
          <span>{isAr ? 'اسباب التحليل' : 'Analysis Reasons'}</span>
          <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{res.detailedReasons.length}</span>
        </button>
      )}

      {/* Remove button */}
      <button onClick={(e) => { e.stopPropagation(); onRemove(res.symbol); }} className="absolute top-1 left-1 p-1 hover:bg-red-500/20 rounded-md text-white/20 hover:text-red-500 transition-colors">
        <X size={12} />
      </button>
    </div>
  );
}

