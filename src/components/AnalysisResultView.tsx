import React, { useState } from 'react';
import { AnalysisResult, SignalType, StrategySettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, ShieldAlert, MessageSquare, BarChart2, ChevronDown } from 'lucide-react';
import TradingViewWidget from './TradingViewWidget';
import LotSizeCalculator from './LotSizeCalculator';
import { cn } from '../lib/utils';
import { Language, translations } from '../lib/i18n';

interface AnalysisResultViewProps {
  results: AnalysisResult[];
  lang: Language;
  settings?: StrategySettings;
}

const SIGNAL_CONFIG: Record<SignalType, { labelKey: keyof typeof translations.en, color: string, bg: string, border: string, icon: any, labelAr: string, labelEn: string }> = {
    [SignalType.STRONG_BUY]: { labelKey: "strong_buy" as any, color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/40", icon: null, labelAr: "شراء قوي", labelEn: "Strong Buy" },
    [SignalType.BUY]: { labelKey: "buy" as any, color: "text-emerald-400/80", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: null, labelAr: "شراء", labelEn: "Buy" },
    [SignalType.NEUTRAL]: { labelKey: "neutral" as any, color: "text-slate-400", bg: "bg-slate-500/20", border: "border-slate-500/20", icon: null, labelAr: "محايد", labelEn: "Neutral" },
    [SignalType.SELL]: { labelKey: "sell" as any, color: "text-red-400/80", bg: "bg-red-500/10", border: "border-red-500/20", icon: null, labelAr: "بيع", labelEn: "Sell" },
    [SignalType.STRONG_SELL]: { labelKey: "strong_sell" as any, color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/40", icon: null, labelAr: "بيع قوي", labelEn: "Strong Sell" },
    [SignalType.NO_ENTRY]: { labelKey: "no_entry" as any, color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/10", icon: null, labelAr: "لا دخول", labelEn: "No Entry" },
};

export default function AnalysisResultView({ results, lang, settings }: AnalysisResultViewProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());

  const formatPublishDate = (timestamp: string) => {
    try { const d = new Date(timestamp); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
    catch { return timestamp; }
  };

  const sortedResults = [...results].sort((a, b) => {
    const aIsAction = a.signal !== 'no_entry' && a.signal !== 'neutral' ? 1 : 0;
    const bIsAction = b.signal !== 'no_entry' && b.signal !== 'neutral' ? 1 : 0;
    if (aIsAction !== bIsAction) return bIsAction - aIsAction;
    return b.confidence - a.confidence;
  });

  const selectedResult = sortedResults[selectedIndex] || sortedResults[0];

  if (!selectedResult) {
    return (
      <div className="space-y-6 pb-20">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-16 text-center space-y-4 bg-brand-bg rounded-2xl shadow-2xl border border-brand-text/5 min-h-[300px]">
          <ShieldAlert size={48} className="text-red-500/50" />
          <h3 className="text-lg font-black text-brand-text uppercase tracking-widest">
            {isAr ? 'لا توجد نتائج تحليل' : 'No analysis results'}
          </h3>
          <p className="text-brand-muted text-sm max-w-lg">
            {isAr ? 'تعذر الحصول على نتائج التحليل من المزود. حاول مرة أخرى.' : 'Could not get analysis results from the provider. Try again.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Top Section: Interactive Chart */}
      <div className="w-full max-w-4xl mx-auto">
        <div className="h-[250px] md:h-[300px] bg-brand-bg rounded-2xl overflow-hidden shadow-2xl border border-brand-text/5 relative">
          <TradingViewWidget symbol={selectedResult.symbol} />
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
             <div className="px-3 py-1.5 bg-brand-bg/80 backdrop-blur-2xl rounded-full border border-brand-text/20 text-brand-text text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 shadow-2xl">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,1)]" />
               <span className="text-brand-text">LIVE: {selectedResult.symbol}</span>
             </div>
          </div>
        </div>
      </div>

      {/* 2. Section Title */}
      <div className={cn("flex items-center justify-between px-4", isAr ? "flex-row" : "flex-row-reverse")}>
        <span className="text-[10px] font-bold text-brand-muted font-mono">Analyzed: {results.length}</span>
        <h3 className="text-lg font-black text-brand-text flex items-center gap-2">
          <Zap size={18} className="text-secondary fill-secondary" />
          {t.finalDecision}
        </h3>
      </div>

      {/* 3. Compact Opportunity Cards - 3 per row */}
      <div className="grid grid-cols-3 gap-2 max-w-4xl mx-auto">
        {sortedResults.map((res, idx) => {
          const meta = SIGNAL_CONFIG[res.signal] || SIGNAL_CONFIG[SignalType.NEUTRAL];
          const isSelected = selectedIndex === idx;
          const isExpanded = expandedCard === `${res.symbol}_${idx}`;
          const isBuy = res.signal.includes('buy');
          const isStrong = res.signal === 'strong_buy' || res.signal === 'strong_sell';
          const isJPY = res.symbol.includes('JPY');
          const pipSize = isJPY ? 0.01 : 0.0001;
          const decimals = isJPY ? 3 : 5;
          const entry = res.entryPrice || (res.stopLoss + res.takeProfit) / 2;
          const basePips = isStrong ? 40 : 25;
          const slPips = Math.round(basePips);
          const tpPips = slPips * 2;
          const slPrice = isBuy ? entry - slPips * pipSize : entry + slPips * pipSize;
          const tpPrice = isBuy ? entry + tpPips * pipSize : entry - tpPips * pipSize;

          return (
            <motion.div
              key={res.symbol + idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={cn(
                "rounded-lg border transition-all",
                isSelected
                  ? "border-primary ring-1 ring-primary bg-brand-alt/80"
                  : "border-white/5 bg-brand-alt/45 hover:border-white/10"
              )}
            >
              {/* Compact Header - Always Visible */}
              <button
                onClick={() => {
                  setSelectedIndex(idx);
                  setExpandedCard(isExpanded ? null : `${res.symbol}_${idx}`);
                }}
                className="w-full px-2 py-2 flex flex-col items-center gap-1.5"
              >
                {/* Symbol and SL/TP Row */}
                <div className="flex items-stretch justify-between w-full gap-2 px-1">
                  {/* Take Profit (TP) Box on Left */}
                  <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-3 py-3 shrink-0 min-w-[70px] flex items-center justify-center">
                    <span className="text-sm font-black font-mono text-emerald-400">{tpPrice.toFixed(decimals)}</span>
                  </div>

                  {/* Symbol in Middle */}
                  <span className="text-xs font-black text-yellow-400 italic truncate flex items-center">{res.symbol}</span>

                  {/* Stop Loss (SL) Box on Right */}
                  <div className="bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-3 shrink-0 min-w-[70px] flex items-center justify-center">
                    <span className="text-sm font-black font-mono text-red-400">{slPrice.toFixed(decimals)}</span>
                  </div>
                </div>

                {/* Signal text */}
                <span className="text-[10px] font-black text-yellow-400">
                  {isAr ? meta.labelAr : meta.labelEn}
                </span>

                {/* Confidence + Time row */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-yellow-400 font-mono">{res.confidence}%</span>
                  <div className="flex items-center gap-0.5 text-[9px] text-yellow-400/60 font-bold">
                    <span>{formatPublishDate(res.timestamp)}</span>
                  </div>
                </div>
                <ChevronDown
                  size={12}
                  className={`text-yellow-400/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Expanded Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-2 pb-2 space-y-2 border-t border-white/5 pt-2">
                      {/* Lot Size Calculator */}
                      {res.stopLoss && res.takeProfit && (
                        <LotSizeCalculator
                          symbol={res.symbol}
                          stopLoss={res.stopLoss}
                          takeProfit={res.takeProfit}
                          signal={res.signal as any}
                          lang={lang}
                        />
                      )}

                      {/* Summary */}
                      {res.summary && (
                        <div className="bg-white/5 rounded-lg p-2 border border-white/5 text-[10px] text-yellow-400/70 leading-relaxed">
                          <p className="font-bold">{res.summary}</p>
                        </div>
                      )}

                      {/* Technical Reasons - Collapsible */}
                      {res.detailedReasons && res.detailedReasons.length > 0 && (
                        <div className="space-y-1">
                          <button
                            onClick={() => {
                              const newSet = new Set(expandedReasons);
                              const key = `${res.symbol}_${idx}`;
                              if (newSet.has(key)) {
                                newSet.delete(key);
                              } else {
                                newSet.add(key);
                              }
                              setExpandedReasons(newSet);
                            }}
                            className="w-full flex items-center justify-between text-xs font-bold text-yellow-400/70 hover:text-yellow-400 transition-colors py-1"
                          >
                            <div className="flex items-center gap-1">
                              <MessageSquare size={12} />
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

                      {/* View Chart Button */}
                      <button
                        onClick={() => setSelectedIndex(idx)}
                        className={`w-full py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-primary text-white'
                            : 'bg-white/5 border border-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        <BarChart2 size={12} />
                        <span>{isAr ? 'عرض الشارت' : 'View Chart'}</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
