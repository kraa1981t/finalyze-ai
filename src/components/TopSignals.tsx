import React, { useState } from 'react';
import { AnalysisResult, SignalType, MarketType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
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

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; labelAr: string; labelEn: string }> = {
  [SignalType.STRONG_BUY]: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', labelAr: 'شراء قوي', labelEn: 'Strong Buy' },
  [SignalType.STRONG_SELL]: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/40', labelAr: 'بيع قوي', labelEn: 'Strong Sell' },
  [SignalType.BUY]: { color: 'text-emerald-400/80', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', labelAr: 'شراء', labelEn: 'Buy' },
  [SignalType.SELL]: { color: 'text-red-400/80', bg: 'bg-red-500/10', border: 'border-red-500/20', labelAr: 'بيع', labelEn: 'Sell' },
};

const CATEGORY_CONFIG: Record<string, { emoji: string; labelAr: string; labelEn: string; color: string; borderColor: string }> = {
  forex: { emoji: '\uD83D\uDCB1', labelAr: '\u0627\u0644\u0641\u0648\u0631\u0643\u0633', labelEn: 'Forex', color: 'text-blue-400', borderColor: 'border-blue-500/30' },
  crypto: { emoji: '\uD83E\uDDF1', labelAr: '\u0627\u0644\u0643\u0631\u064A\u0628\u062A\u0648', labelEn: 'Crypto', color: 'text-purple-400', borderColor: 'border-purple-500/30' },
  stocks: { emoji: '\uD83D\uDCC8', labelAr: '\u0627\u0644\u0623\u0633\u0647\u0645', labelEn: 'Stocks', color: 'text-yellow-400', borderColor: 'border-yellow-500/30' },
  metals: { emoji: '\uD83D\uDC8E', labelAr: '\u0627\u0644\u0645\u0639\u0627\u062F\u0646', labelEn: 'Metals', color: 'text-orange-400', borderColor: 'border-orange-500/30' },
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
    const daysAr = ['\u0627\u0644\u0623\u062D\u062F', '\u0627\u0644\u0625\u062B\u0646\u064A\u0646', '\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621', '\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621', '\u0627\u0644\u062E\u0645\u064A\u0633', '\u0627\u0644\u062C\u0645\u0639\u0629', '\u0627\u0644\u0633\u0628\u062A'];
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
    const cat = (s.type as string) || getSymbolCategory(s.symbol);
    if (grouped[cat]) grouped[cat].push(s);
    else grouped.forex.push(s);
  }

  const catOrder = ['forex', 'crypto', 'stocks', 'metals'] as const;

  return (
    <div className="mb-12 space-y-6">
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
        const top4 = regular.sort((a, b) => b.confidence - a.confidence).slice(0, 4);

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

            {top4.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {top4.map((res, idx) => (
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
  const isJPY = res.symbol.includes('JPY');
  const decimals = isJPY ? 3 : 5;
  const entry = res.entryPrice || (res.stopLoss && res.takeProfit ? (res.stopLoss + res.takeProfit) / 2 : 1.0);
  const pipSize = isJPY ? 0.01 : 0.0001;
  const slPips = 40;
  const tpPrice = (res.signal.includes('buy')) ? entry + slPips * 2 * pipSize : entry - slPips * 2 * pipSize;
  const slPrice = (res.signal.includes('buy')) ? entry - slPips * pipSize : entry + slPips * pipSize;

  return (
    <div className={cn("rounded-xl border transition-all mx-2", isExpanded ? 'border-primary ring-1 ring-primary bg-brand-alt/80' : 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50')}>
      <button onClick={() => { onSelect(res); onExpand(isExpanded ? null : cardKey); }} className="w-full px-3 py-3 flex flex-col items-center gap-2">
        <div className="flex items-stretch justify-between w-full gap-2 px-1">
          <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-3 py-3 shrink-0 min-w-[70px] flex items-center justify-center">
            <span className="text-base font-black font-mono text-emerald-400">{tpPrice.toFixed(decimals)}</span>
          </div>
          <span className="text-sm font-black text-yellow-400 italic truncate flex items-center">{res.symbol}</span>
          <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-3 shrink-0 min-w-[70px] flex items-center justify-center">
            <span className="text-base font-black font-mono text-red-400">{slPrice.toFixed(decimals)}</span>
          </div>
        </div>
        <span className={`text-xs font-black ${meta.color}`}>{isAr ? meta.labelAr : meta.labelEn}</span>
        <div className="flex items-center gap-3">
          <span className="text-base font-black text-yellow-400 font-mono">{res.confidence}%</span>
          <span className="text-[10px] text-yellow-400/50 font-bold">{formatPublishDate(res.timestamp, lang)}</span>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="px-2 pb-1.5 space-y-1.5 border-t border-white/5 pt-1.5">
              {res.summary && <div className="bg-white/5 rounded p-1.5 border border-white/5 text-[10px] text-yellow-400/70 leading-relaxed"><p className="font-bold">{res.summary}</p></div>}
              {res.detailedReasons && res.detailedReasons.length > 0 && (
                <div className="space-y-1">
                  <button onClick={(e) => { e.stopPropagation(); const n = new Set(expandedReasons); n.has(cardKey) ? n.delete(cardKey) : n.add(cardKey); onExpandReasons(n); }} className="w-full flex items-center justify-between text-xs font-bold text-yellow-400/70 hover:text-yellow-400 py-1">
                    <div className="flex items-center gap-1"><Info size={12} /><span>{isAr ? '\u0627\u0644\u0645\u0648\u0634\u0631\u0627\u062A' : 'Indicators'} ({res.detailedReasons.length})</span></div>
                    <span className="text-[10px]">{expandedReasons.has(cardKey) ? '\u25BC' : '\u25B6'}</span>
                  </button>
                  <AnimatePresence>
                    {expandedReasons.has(cardKey) && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="space-y-1 pt-1">
                          {res.detailedReasons.map((reason, i) => (
                            <div key={i} className="bg-white/[0.02] rounded p-1.5 border border-white/5 flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${reason.status === 'positive' ? 'bg-emerald-400' : reason.status === 'negative' ? 'bg-red-400' : 'bg-white/30'}`} />
                                <span className="font-bold text-yellow-400/80">{reason.check}</span>
                              </div>
                              <span className="text-yellow-400/50 font-mono">{reason.value}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
  const isJPY = res.symbol.includes('JPY');
  const decimals = isJPY ? 3 : 5;
  const entry = res.entryPrice || (res.stopLoss && res.takeProfit ? (res.stopLoss + res.takeProfit) / 2 : 1.0);
  const pipSize = isJPY ? 0.01 : 0.0001;
  const slPips = 25;
  const tpPrice = (res.signal.includes('buy')) ? entry + slPips * 2 * pipSize : entry - slPips * 2 * pipSize;
  const slPrice = (res.signal.includes('buy')) ? entry - slPips * pipSize : entry + slPips * pipSize;

  return (
    <div className={cn("rounded-lg border transition-all", isExpanded ? 'border-primary ring-1 ring-primary bg-brand-alt/80' : 'border-white/5 bg-brand-alt/45 hover:border-white/10')}>
      <button onClick={() => { onSelect(res); onExpand(isExpanded ? null : cardKey); }} className="w-full px-2 py-2 flex flex-col items-center gap-1.5">
        <div className="flex items-stretch justify-between w-full gap-2 px-1">
          <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-3 py-3 shrink-0 min-w-[70px] flex items-center justify-center">
            <span className="text-base font-black font-mono text-emerald-400">{tpPrice.toFixed(decimals)}</span>
          </div>
          <span className="text-sm font-black text-yellow-400 italic truncate flex items-center">{res.symbol}</span>
          <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-3 shrink-0 min-w-[70px] flex items-center justify-center">
            <span className="text-base font-black font-mono text-red-400">{slPrice.toFixed(decimals)}</span>
          </div>
        </div>
        <span className={`text-xs font-black ${meta.color}`}>{isAr ? meta.labelAr : meta.labelEn}</span>
        <div className="flex items-center gap-3">
          <span className="text-base font-black text-yellow-400 font-mono">{res.confidence}%</span>
          <span className="text-[10px] text-yellow-400/50 font-bold">{formatPublishDate(res.timestamp, lang)}</span>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="px-2 pb-1.5 space-y-1.5 border-t border-white/5 pt-1.5">
              {res.summary && <div className="bg-white/5 rounded p-1.5 border border-white/5 text-[10px] text-yellow-400/70 leading-relaxed"><p className="font-bold">{res.summary}</p></div>}
              {res.detailedReasons && res.detailedReasons.length > 0 && (
                <div className="space-y-1">
                  <button onClick={(e) => { e.stopPropagation(); const n = new Set(expandedReasons); n.has(cardKey) ? n.delete(cardKey) : n.add(cardKey); onExpandReasons(n); }} className="w-full flex items-center justify-between text-xs font-bold text-yellow-400/70 hover:text-yellow-400 py-1">
                    <div className="flex items-center gap-1"><Info size={12} /><span>{isAr ? '\u0627\u0644\u0645\u0648\u0634\u0631\u0627\u062A' : 'Indicators'} ({res.detailedReasons.length})</span></div>
                    <span className="text-[10px]">{expandedReasons.has(cardKey) ? '\u25BC' : '\u25B6'}</span>
                  </button>
                  <AnimatePresence>
                    {expandedReasons.has(cardKey) && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="space-y-1 pt-1">
                          {res.detailedReasons.map((reason, i) => (
                            <div key={i} className="bg-white/[0.02] rounded p-1.5 border border-white/5 flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${reason.status === 'positive' ? 'bg-emerald-400' : reason.status === 'negative' ? 'bg-red-400' : 'bg-white/30'}`} />
                                <span className="font-bold text-yellow-400/80">{reason.check}</span>
                              </div>
                              <span className="text-yellow-400/50 font-mono">{reason.value}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button onClick={(e) => { e.stopPropagation(); onRemove(res.symbol); }} className="absolute top-1 left-1 p-1 hover:bg-red-500/20 rounded-md text-white/20 hover:text-red-500 transition-colors">
        <X size={12} />
      </button>
    </div>
  );
}
