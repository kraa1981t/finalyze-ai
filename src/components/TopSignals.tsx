import React, { useState } from 'react';
import { AnalysisResult, SignalType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Info, X, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Language, translations } from '../lib/i18n';

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

  return (
    <div className="mb-12 space-y-4">
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

      <div className="grid grid-cols-3 gap-2 items-start">
        <AnimatePresence mode="popLayout">
          {signals.map((res, idx) => {
            const meta = SIGNAL_META[res.signal] || SIGNAL_META[SignalType.STRONG_BUY];
            const isExpanded = expandedCard === `${res.symbol}_${idx}`;
            const isBuy = res.signal.includes('buy');
            const isStrong = res.signal === SignalType.STRONG_BUY || res.signal === SignalType.STRONG_SELL;
            const isJPY = res.symbol.includes('JPY');
            const pipSize = isJPY ? 0.01 : 0.0001;
            const decimals = isJPY ? 3 : 5;
            const entry = res.entryPrice || (res.stopLoss && res.takeProfit ? (res.stopLoss + res.takeProfit) / 2 : 1.0);
            const basePips = isStrong ? 40 : 25;
            const slPips = Math.round(basePips);
            const tpPips = slPips * 2;
            const slPrice = isBuy ? entry - slPips * pipSize : entry + slPips * pipSize;
            const tpPrice = isBuy ? entry + tpPips * pipSize : entry - tpPips * pipSize;

            return (
              <motion.div
                key={res.symbol + idx}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <div className={`rounded-lg border transition-all ${
                  isExpanded
                    ? 'border-primary ring-1 ring-primary bg-brand-alt/80'
                    : 'border-white/5 bg-brand-alt/45 hover:border-white/10'
                }`}>
                  <button
                    onClick={() => {
                      onSelect(res);
                      setExpandedCard(isExpanded ? null : `${res.symbol}_${idx}`);
                    }}
                    className="w-full px-2 py-2 flex flex-col items-center gap-1.5"
                  >
                    <div className="flex items-stretch justify-between w-full gap-2 px-1">
                      <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-3 py-3 shrink-0 min-w-[70px] flex items-center justify-center">
                        <span className="text-base font-black font-mono text-emerald-400">{tpPrice.toFixed(decimals)}</span>
                      </div>
                      <span className="text-sm font-black text-yellow-400 italic truncate flex items-center">{res.symbol}</span>
                      <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-3 shrink-0 min-w-[70px] flex items-center justify-center">
                        <span className="text-base font-black font-mono text-red-400">{slPrice.toFixed(decimals)}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-black ${meta.color}`}>
                      {isAr ? meta.labelAr : meta.labelEn}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-black text-yellow-400 font-mono">{res.confidence}%</span>
                      <div className="flex items-center gap-0.5 text-[10px] text-yellow-400/50 font-bold">
                        <span>{formatPublishDate(res.timestamp, lang)}</span>
                      </div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-2 pb-1.5 space-y-1.5 border-t border-white/5 pt-1.5">
                          {res.summary && (
                            <div className="bg-white/5 rounded p-1.5 border border-white/5 text-[10px] text-yellow-400/70 leading-relaxed">
                              <p className="font-bold">{res.summary}</p>
                            </div>
                          )}

                          {res.detailedReasons && res.detailedReasons.length > 0 && (
                            <div className="space-y-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newSet = new Set(expandedReasons);
                                  const key = `${res.symbol}_${idx}`;
                                  if (newSet.has(key)) { newSet.delete(key); } else { newSet.add(key); }
                                  setExpandedReasons(newSet);
                                }}
                                className="w-full flex items-center justify-between text-xs font-bold text-yellow-400/70 hover:text-yellow-400 transition-colors py-1"
                              >
                                <div className="flex items-center gap-1">
                                  <Info size={12} />
                                  <span>{isAr ? 'المؤشرات' : 'Indicators'} ({res.detailedReasons.length})</span>
                                </div>
                                <span className="text-[10px]">{expandedReasons.has(`${res.symbol}_${idx}`) ? '▼' : '▶'}</span>
                              </button>
                              <AnimatePresence>
                                {expandedReasons.has(`${res.symbol}_${idx}`) && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="space-y-1 pt-1">
                                      {res.detailedReasons.map((reason, i) => (
                                        <div key={i} className="bg-white/[0.02] rounded p-1.5 border border-white/5 flex items-center justify-between text-[10px]">
                                          <div className="flex items-center gap-1">
                                            <div className={`w-1.5 h-1.5 rounded-full ${
                                              reason.status === 'positive' ? 'bg-emerald-400' :
                                              reason.status === 'negative' ? 'bg-red-400' : 'bg-white/30'
                                            }`} />
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

                  <button 
                    onClick={(e) => { e.stopPropagation(); onRemove(res.symbol); }}
                    className="absolute top-1 left-1 p-1 hover:bg-red-500/20 rounded-md text-white/20 hover:text-red-500 transition-colors"
                    title={t.delete}
                  >
                    <X size={12} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}