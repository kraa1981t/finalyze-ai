import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, SignalType, MarketType } from '../types';
import { Info, X, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Language, translations } from '../lib/i18n';
import { SYMBOL_CATEGORIES } from '../constants';

interface TopSignalsProps {
  signals: AnalysisResult[];
  onRemove: (symbol: string) => void;
  onSelect: (result: AnalysisResult) => void;
  onClearAll: () => void;
  lang: Language;
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; labelAr: string; labelEn: string; symbolColor: string }> = {
  [SignalType.STRONG_BUY]: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', labelAr: 'شراء قوي', labelEn: 'Strong Buy', symbolColor: '#00ff88' },
  [SignalType.STRONG_SELL]: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/40', labelAr: 'بيع قوي', labelEn: 'Strong Sell', symbolColor: '#ff4444' },
  [SignalType.BUY]: { color: 'text-emerald-400/80', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', labelAr: 'شراء', labelEn: 'Buy', symbolColor: '#66ffaa' },
  [SignalType.SELL]: { color: 'text-red-400/80', bg: 'bg-red-500/10', border: 'border-red-500/20', labelAr: 'بيع', labelEn: 'Sell', symbolColor: '#ff8888' },
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
    if ((syms as string[]).includes(sym)) return cat;
  }
  if (sym.endsWith('USD') && !sym.startsWith('USD') && sym.length > 6) return 'crypto';
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

export default function TopSignals({ signals, onRemove, onSelect, onClearAll, lang }: TopSignalsProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());

  if (signals.length === 0) return null;

  const grouped: Record<string, AnalysisResult[]> = { forex: [], crypto: [], stocks: [], metals: [] };
  for (const s of signals) {
    const cat = getSymbolCategory(s.symbol);
    if (grouped[cat]) grouped[cat].push(s);
    else grouped.forex.push(s);
  }

  const catOrder = ['forex', 'crypto', 'stocks', 'metals'] as const;

  return (
    <div className="mb-12 space-y-6">
      <style>{`.signal-card .text-emerald-400{color:#059669!important}.signal-card .text-red-400{color:#dc2626!important}`}</style>
      <div className={cn("flex items-center justify-between px-4", isAr ? "flex-row" : "flex-row-reverse")}>
        <button 
          onClick={onClearAll}
          className="flex items-center gap-2 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-500 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
        >
          <Trash2 size={12} />
          {t.clearAllResults}
        </button>
        <h3 className="text-sm font-black text-yellow-400 flex items-center gap-2 uppercase tracking-[0.2em]">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          {t.topSignals}
        </h3>
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

            {strong.map((res, idx) => (
              <StrongCard key={`s_${res.symbol}_${idx}`} res={res} isAr={isAr} expandedCard={expandedCard} expandedReasons={expandedReasons} onExpand={setExpandedCard} onExpandReasons={setExpandedReasons} onSelect={onSelect} onRemove={onRemove} formatPublishDate={formatPublishDate} cardKey={`s_${res.symbol}_${idx}`} />
            ))}

            {top3.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {top3.map((res, idx) => (
                  <RegularCard key={`r_${res.symbol}_${idx}`} res={res} isAr={isAr} expandedCard={expandedCard} expandedReasons={expandedReasons} onExpand={setExpandedCard} onExpandReasons={setExpandedReasons} onSelect={onSelect} onRemove={onRemove} formatPublishDate={formatPublishDate} cardKey={`r_${res.symbol}_${idx}`} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StrongCard({ res, isAr, expandedCard, expandedReasons, onExpand, onExpandReasons, onSelect, onRemove, formatPublishDate, cardKey }: {
  res: AnalysisResult; isAr: boolean; expandedCard: string | null; expandedReasons: Set<string>;
  onExpand: (v: string | null) => void; onExpandReasons: (v: Set<string>) => void;
  onSelect: (r: AnalysisResult) => void; onRemove: (s: string) => void;
  formatPublishDate: (ts: string, lang: string) => string; cardKey: string;
}) {
  const meta = SIGNAL_META[res.signal] || SIGNAL_META[SignalType.STRONG_BUY];
  const isExpanded = expandedCard === cardKey;
  const cardRef = useRef<HTMLDivElement>(null);
  const isJPY = res.symbol.includes('JPY');
  const decimals = isJPY ? 3 : 5;
  const entry = res.entryPrice || (res.stopLoss && res.takeProfit ? (res.stopLoss + res.takeProfit) / 2 : 1.0);
  const pipSize = isJPY ? 0.01 : 0.0001;
  const slPips = 40;
  const tpPrice = (res.signal.includes('buy')) ? entry + slPips * 2 * pipSize : entry - slPips * 2 * pipSize;
  const slPrice = (res.signal.includes('buy')) ? entry - slPips * pipSize : entry + slPips * pipSize;

  useEffect(() => {
    if (isExpanded && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [isExpanded]);

  return (
    <div ref={cardRef} className="signal-card rounded-xl border-2 border-amber-600/40 transition-all overflow-hidden" style={{ backgroundColor: `rgba(var(--card-bg),0.88)`, alignSelf: 'start' }}>
      <button onClick={() => { onSelect(res); }} className="w-full px-3 py-1.5 flex flex-col items-center gap-1">
        <div className="flex items-center justify-center w-full gap-2 overflow-hidden">
          <span className="text-sm sm:text-base font-black font-mono" style={{color:'#00ff88'}}>{tpPrice.toFixed(decimals)}</span>
          <span className="text-lg sm:text-xl font-black italic flex-shrink-0 text-center" style={{ color: meta.symbolColor }}>{res.symbol}</span>
          <span className="text-sm sm:text-base font-black font-mono" style={{color:'#ff4444'}}>{slPrice.toFixed(decimals)}</span>
        </div>
        <span className="text-sm sm:text-base font-black" style={{color: meta.symbolColor}}>{isAr ? meta.labelAr : meta.labelEn}</span>
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-3xl font-black font-mono" style={{color:'#ffffff'}}>{res.confidence}%</span>
          <span className="text-[10px] sm:text-xs font-bold" style={{color:'rgba(255,255,255,0.85)'}}>{formatPublishDate(res.timestamp, isAr ? 'ar' : 'en')}</span>
        </div>
      </button>

      <button onClick={(e) => { e.stopPropagation(); onExpand(isExpanded ? null : cardKey); }} className="w-full flex items-center justify-center py-1 text-white/40 hover:text-white/70 transition-colors">
        <span className="text-xs">{isExpanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-white/10" style={{ maxHeight: '350px', overflowY: 'auto' }}>
          <div className="px-3 py-2 space-y-2">
            {res.summary && <div className="bg-white/10 rounded-lg p-2.5 border border-white/10 text-sm text-white/80 leading-relaxed"><p className="font-bold">{res.summary}</p></div>}
            {res.detailedReasons && res.detailedReasons.length > 0 && (
              <div className="space-y-1.5">
                <button onClick={(e) => { e.stopPropagation(); const n = new Set(expandedReasons); n.has(cardKey) ? n.delete(cardKey) : n.add(cardKey); onExpandReasons(n); }} className="w-full flex items-center justify-between text-sm font-bold text-white hover:text-white/80 py-1">
                  <div className="flex items-center gap-1.5"><Info size={14} /><span>{isAr ? 'المشارات' : 'Indicators'} ({res.detailedReasons.length})</span></div>
                  <span className="text-xs">{expandedReasons.has(cardKey) ? '\u25BC' : '\u25B6'}</span>
                </button>
                {expandedReasons.has(cardKey) && (
                  <div className="space-y-1.5 pt-1">
                    {res.detailedReasons.map((reason, i) => (
                      <div key={i} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)'}} className="rounded-lg p-3 flex items-center justify-between text-sm sm:text-base">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-4 h-4 rounded-full shrink-0 ${reason.status === 'positive' ? 'bg-emerald-400' : reason.status === 'negative' ? 'bg-red-400' : 'bg-white/70'}`} />
                          <span style={{color: reason.status === 'positive' ? '#00ff88' : reason.status === 'negative' ? '#ff4444' : '#ffffff'}} className="font-bold text-base sm:text-lg">{reason.check}</span>
                        </div>
                        <span style={{color: reason.status === 'positive' ? '#00ff88' : reason.status === 'negative' ? '#ff4444' : '#ffffff'}} className="font-mono text-sm sm:text-base font-bold">{reason.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <button onClick={(e) => { e.stopPropagation(); onRemove(res.symbol); }} className="absolute top-1 left-1 p-1 hover:bg-red-500/20 rounded-md text-white/20 hover:text-red-500 transition-colors">
        <X size={12} />
      </button>
    </div>
  );
}

function RegularCard({ res, isAr, expandedCard, expandedReasons, onExpand, onExpandReasons, onSelect, onRemove, formatPublishDate, cardKey }: {
  res: AnalysisResult; isAr: boolean; expandedCard: string | null; expandedReasons: Set<string>;
  onExpand: (v: string | null) => void; onExpandReasons: (v: Set<string>) => void;
  onSelect: (r: AnalysisResult) => void; onRemove: (s: string) => void;
  formatPublishDate: (ts: string, lang: string) => string; cardKey: string;
}) {
  const meta = SIGNAL_META[res.signal] || SIGNAL_META[SignalType.BUY];
  const isExpanded = expandedCard === cardKey;
  const cardRef = useRef<HTMLDivElement>(null);
  const isJPY = res.symbol.includes('JPY');
  const decimals = isJPY ? 3 : 5;
  const entry = res.entryPrice || (res.stopLoss && res.takeProfit ? (res.stopLoss + res.takeProfit) / 2 : 1.0);
  const pipSize = isJPY ? 0.01 : 0.0001;
  const slPips = 25;
  const tpPrice = (res.signal.includes('buy')) ? entry + slPips * 2 * pipSize : entry - slPips * 2 * pipSize;
  const slPrice = (res.signal.includes('buy')) ? entry - slPips * pipSize : entry + slPips * pipSize;

  useEffect(() => {
    if (isExpanded && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [isExpanded]);

  return (
    <div ref={cardRef} className="signal-card rounded-xl border-2 border-amber-600/40 transition-all overflow-hidden" style={{ backgroundColor: `rgba(var(--card-bg),0.88)`, alignSelf: 'start' }}>
      <button onClick={() => { onSelect(res); }} className="w-full px-3 py-1.5 flex flex-col items-center gap-1">
        <div className="flex items-center justify-center w-full gap-2 overflow-hidden">
          <span className="text-sm sm:text-base font-black font-mono" style={{color:'#00ff88'}}>{tpPrice.toFixed(decimals)}</span>
          <span className="text-lg sm:text-xl font-black italic flex-shrink-0 text-center" style={{ color: meta.symbolColor }}>{res.symbol}</span>
          <span className="text-sm sm:text-base font-black font-mono" style={{color:'#ff4444'}}>{slPrice.toFixed(decimals)}</span>
        </div>
        <span className="text-sm sm:text-base font-black" style={{color: meta.symbolColor}}>{isAr ? meta.labelAr : meta.labelEn}</span>
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-3xl font-black font-mono" style={{color:'#ffffff'}}>{res.confidence}%</span>
          <span className="text-[10px] sm:text-xs font-bold" style={{color:'rgba(255,255,255,0.85)'}}>{formatPublishDate(res.timestamp, isAr ? 'ar' : 'en')}</span>
        </div>
      </button>

      <button onClick={(e) => { e.stopPropagation(); onExpand(isExpanded ? null : cardKey); }} className="w-full flex items-center justify-center py-1 text-white/40 hover:text-white/70 transition-colors">
        <span className="text-xs">{isExpanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-white/10" style={{ maxHeight: '350px', overflowY: 'auto' }}>
          <div className="px-3 py-2 space-y-2">
            {res.summary && <div className="bg-white/10 rounded-lg p-2.5 border border-white/10 text-sm text-white/80 leading-relaxed"><p className="font-bold">{res.summary}</p></div>}
            {res.detailedReasons && res.detailedReasons.length > 0 && (
              <div className="space-y-1.5">
                <button onClick={(e) => { e.stopPropagation(); const n = new Set(expandedReasons); n.has(cardKey) ? n.delete(cardKey) : n.add(cardKey); onExpandReasons(n); }} className="w-full flex items-center justify-between text-sm font-bold text-white hover:text-white/80 py-1">
                  <div className="flex items-center gap-1.5"><Info size={14} /><span>{isAr ? 'المشارات' : 'Indicators'} ({res.detailedReasons.length})</span></div>
                  <span className="text-xs">{expandedReasons.has(cardKey) ? '\u25BC' : '\u25B6'}</span>
                </button>
                {expandedReasons.has(cardKey) && (
                  <div className="space-y-1.5 pt-1">
                    {res.detailedReasons.map((reason, i) => (
                      <div key={i} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)'}} className="rounded-lg p-3 flex items-center justify-between text-sm sm:text-base">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-4 h-4 rounded-full shrink-0 ${reason.status === 'positive' ? 'bg-emerald-400' : reason.status === 'negative' ? 'bg-red-400' : 'bg-white/70'}`} />
                          <span style={{color: reason.status === 'positive' ? '#00ff88' : reason.status === 'negative' ? '#ff4444' : '#ffffff'}} className="font-bold text-base sm:text-lg">{reason.check}</span>
                        </div>
                        <span style={{color: reason.status === 'positive' ? '#00ff88' : reason.status === 'negative' ? '#ff4444' : '#ffffff'}} className="font-mono text-sm sm:text-base font-bold">{reason.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <button onClick={(e) => { e.stopPropagation(); onRemove(res.symbol); }} className="absolute top-1 left-1 p-1 hover:bg-red-500/20 rounded-md text-white/20 hover:text-red-500 transition-colors">
        <X size={12} />
      </button>
    </div>
  );
}
