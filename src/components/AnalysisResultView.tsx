import React, { useState, useRef, useCallback } from 'react';
import { AnalysisResult, SignalType, StrategySettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, ShieldAlert, MessageSquare, BarChart2, ChevronDown } from 'lucide-react';
import TradingViewWidget from './TradingViewWidget';
import LotSizeCalculator from './LotSizeCalculator';
import { cn } from '../lib/utils';
import { Language, translations } from '../lib/i18n';
import { playClick, initAudio } from '../lib/audioEngine';

interface AnalysisResultViewProps {
  results: AnalysisResult[];
  lang: Language;
  settings?: StrategySettings;
}

const SIGNAL_CONFIG: Record<SignalType, { labelKey: keyof typeof translations.en, color: string, bg: string, border: string, icon: any, labelAr: string, labelEn: string }> = {
    [SignalType.STRONG_BUY]: { labelKey: "strong_buy" as any, color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/40", icon: null, labelAr: "\u0634\u0631\u0627\u0621 \u0642\u0648\u064a", labelEn: "Strong Buy" },
    [SignalType.BUY]: { labelKey: "buy" as any, color: "text-emerald-400/80", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: null, labelAr: "\u0634\u0631\u0627\u0621", labelEn: "Buy" },
    [SignalType.NEUTRAL]: { labelKey: "neutral" as any, color: "text-slate-400", bg: "bg-slate-500/20", border: "border-slate-500/20", icon: null, labelAr: "\u0645\u062d\u0627\u064a\u062f", labelEn: "Neutral" },
    [SignalType.SELL]: { labelKey: "sell" as any, color: "text-red-400/80", bg: "bg-red-500/10", border: "border-red-500/20", icon: null, labelAr: "\u0628\u064a\u0639", labelEn: "Sell" },
    [SignalType.STRONG_SELL]: { labelKey: "strong_sell" as any, color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/40", icon: null, labelAr: "\u0628\u064a\u0639 \u0642\u0648\u064a", labelEn: "Strong Sell" },
    [SignalType.NO_ENTRY]: { labelKey: "no_entry" as any, color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/10", icon: null, labelAr: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0641\u0631\u0635\u0629", labelEn: "No Entry" },
};

export default function AnalysisResultView({ results, lang, settings }: AnalysisResultViewProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());
  const audioInitRef = useRef(false);

  const handleClick = useCallback(() => {
    if (!audioInitRef.current) {
      initAudio();
      audioInitRef.current = true;
    }
    playClick();
  }, []);

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
            {isAr ? '\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c \u062a\u062d\u0644\u064a\u0644' : 'No analysis results'}
          </h3>
          <p className="text-brand-muted text-sm max-w-lg">
            {isAr ? '\u0644\u0645 \u064a\u062a\u0645 \u062c\u0644\u0628 \u0646\u062a\u0627\u0626\u062c \u0627\u0644\u062a\u062d\u0644\u064a\u0644 \u0645\u0646 \u0627\u0644\u0645\u0632\u0648\u062f. \u062a\u0639\u064a\u062f \u0644\u0644\u0645\u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.' : 'Could not get analysis results from the provider. Try again.'}
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

      {/* 3. Compact Opportunity Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-w-4xl mx-auto items-start px-2 sm:px-0">
        {sortedResults.map((res, idx) => {
          const meta = SIGNAL_CONFIG[res.signal] || SIGNAL_CONFIG[SignalType.NEUTRAL];
          const isSelected = selectedIndex === idx;
          const isExpanded = expandedCard === `${res.symbol}_${idx}`;
          const isBuy = res.signal.includes('buy');
          const isStrong = res.signal === 'strong_buy' || res.signal === 'strong_sell';
          const isJPY = res.symbol.includes('JPY');
          const decimals = isJPY ? 3 : 5;
          const entry = res.entryPrice || 0;
          const tp = res.takeProfit || 0;
          const sl = res.stopLoss || 0;

          return (
            <motion.div
              key={res.symbol + idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={cn(
                "rounded-lg border transition-all",
                isSelected
                  ? "border-white/10 bg-brand-alt/80"
                  : "border-white/5 bg-brand-alt/45 hover:border-white/10"
              )}
            >
              {/* Compact Header - Always Visible */}
              <button
                onClick={() => {
                  setSelectedIndex(idx);
                  setExpandedCard(isExpanded ? null : `${res.symbol}_${idx}`);
                  handleClick();
                }}
                className={cn(
                  "w-full px-1.5 sm:px-2 py-1.5 sm:py-2 flex flex-col items-center gap-1 sm:gap-1.5 rounded-t-lg transition-all",
                  isSelected ? "border-b border-[#F59E0B]/30" : ""
                )}
              >
                {/* Symbol and SL/TP Row */}
                <div className="flex items-center gap-0.5 sm:gap-1 px-0.5">
                  {/* Take Profit (TP) Box */}
                  <div className="flex-1 bg-emerald-500/15 border border-emerald-500/30 rounded-lg sm:rounded-xl px-1.5 sm:px-3 py-1.5 sm:py-3 shrink-0 flex items-center justify-center">
                    <span className="text-xs sm:text-lg font-black font-mono text-emerald-400">{tp ? tp.toFixed(decimals) : '—'}</span>
                  </div>

                  {/* Symbol in Middle */}
                  <div className="flex items-center justify-center min-w-[36px] sm:min-w-[48px] shrink-0">
                    <span className={`text-[10px] sm:text-sm font-black font-mono ${meta.color}`}>{res.symbol}</span>
                  </div>

                  {/* Stop Loss (SL) Box */}
                  <div className="flex-1 bg-red-500/15 border border-red-500/30 rounded-lg sm:rounded-xl px-1.5 sm:px-3 py-1.5 sm:py-3 shrink-0 flex items-center justify-center">
                    <span className="text-xs sm:text-lg font-black font-mono text-red-400">{sl ? sl.toFixed(decimals) : '—'}</span>
                  </div>
                </div>

                {/* Signal text */}
                <span className={`text-[10px] sm:text-xs font-black ${meta.color}`}>
                  {isAr ? meta.labelAr : meta.labelEn}
                </span>

                {/* Confidence + Time row */}
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className={`text-sm sm:text-lg font-black font-mono ${meta.color}`}>{res.confidence}%</span>
                  {res.confidence < 40 && (
                    <span className="text-[8px] sm:text-[9px] font-black text-yellow-600 bg-yellow-100 px-1 sm:px-1.5 py-0.5 rounded-full" title={isAr ? 'نتيجة غير مؤكدة' : 'Low confidence'}>
                      {isAr ? '⚠️' : '⚠️ LOW'}
                    </span>
                  )}
                  <div className={`flex items-center gap-0.5 text-[8px] sm:text-[10px] font-bold ${meta.color}/40`}>
                    <span>{formatPublishDate(res.timestamp)}</span>
                  </div>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-yellow-400/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Expanded Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="origin-top"
                  >
                    <div className="px-2 pb-2 space-y-2 border-t border-white/5 pt-2">
                      {/* Lot Size Calculator - hidden for neutral */}
                      {res.signal !== 'neutral' && res.signal !== 'no_entry' && (
                        <LotSizeCalculator
                          symbol={res.symbol}
                          stopLoss={sl}
                          takeProfit={tp}
                          entryPrice={entry}
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

                      {/* Expand/Collapse Conditions Button */}
                      {res.detailedReasons && res.detailedReasons.length > 0 && (
                        <button
                          onClick={() => {
                            handleClick();
                            const newSet = new Set(expandedReasons);
                            const key = `${res.symbol}_${idx}`;
                            if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
                            setExpandedReasons(newSet);
                          }}
                          className="w-full flex items-center justify-between text-xs font-bold text-yellow-400/70 hover:text-yellow-400 transition-colors py-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <MessageSquare size={14} />
                            <span>{isAr ? '\u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u062a\u0642\u064a\u064a\u0645\u064a\u0629' : 'Conditions'} ({res.detailedReasons.length})</span>
                          </div>
                          <span className="text-xs">{expandedReasons.has(`${res.symbol}_${idx}`) ? '\u25B2' : '\u25BC'}</span>
                        </button>
                      )}

                      {/* Primary & Supporting Reasons - Split into 2 sections */}
                      <AnimatePresence>
                      {expandedReasons.has(`${res.symbol}_${idx}`) && res.detailedReasons && res.detailedReasons.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          {(() => {
                        const PRIMARY_CHECKS = ['BB Pullback', 'Micro BB', 'Supply/Demand', 'Trend Age', 'Pre-Pullback Age', 'News', 'Economic Events'];
                        const primaryReasons = res.detailedReasons.filter((r: any) => PRIMARY_CHECKS.some(p => r.check?.includes(p)));
                        const supportingReasons = res.detailedReasons.filter((r: any) => !PRIMARY_CHECKS.some(p => r.check?.includes(p)));

                        const getAgeBadge = () => {
                          if (res.trendAge === undefined) return null;
                          const age = res.trendAge;
                          if (age < 10) return { label: isAr ? '\u0637\u0641\u0644' : 'Infant', color: 'text-red-400 bg-red-500/15 border-red-500/30' };
                          if (age < 25) return { label: isAr ? '\u0634\u0627\u0628' : 'Youth', color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' };
                          if (age <= 75) return { label: isAr ? '\u0646\u0627\u0636\u062c' : 'Mature', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' };
                          return { label: isAr ? '\u0634\u064a\u062e' : 'Old', color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' };
                        };
                        const ageBadge = getAgeBadge();

                        const renderReason = (reason: any, i: number) => (
                          <div key={i} className="bg-white/[0.04] rounded-lg p-3 border border-white/10" title={reason.impact || ''}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                                reason.status === 'positive' ? 'bg-emerald-400' :
                                reason.status === 'negative' ? 'bg-red-400' : 'bg-slate-400'
                              }`} />
                              <span className={`font-bold text-sm sm:text-base shrink-0 ${reason.status === 'positive' ? 'text-emerald-400' : reason.status === 'negative' ? 'text-red-400' : 'text-slate-400'}`}>
                                {reason.check}
                              </span>
                              <span className={`font-mono text-sm sm:text-base break-all font-semibold ${reason.status === 'positive' ? 'text-emerald-300' : reason.status === 'negative' ? 'text-red-300' : 'text-slate-300'}`}>
                                {reason.value}
                              </span>
                            </div>
                            {reason.dates && (
                              <div className={`ml-5 mt-1.5 text-sm font-mono whitespace-pre-line ${reason.status === 'positive' ? 'text-emerald-300/70' : reason.status === 'negative' ? 'text-red-300/70' : 'text-slate-300/70'}`}>
                                {reason.dates}
                              </div>
                            )}
                            {reason.impact && (
                              <p className={`text-sm mt-1.5 ml-5 leading-relaxed ${reason.status === 'positive' ? 'text-emerald-300/60' : reason.status === 'negative' ? 'text-red-300/60' : 'text-slate-300/60'}`}>
                                {reason.impact}
                              </p>
                            )}
                          </div>
                        );

                        return (
                          <div className="space-y-2">
                            {/* Primary Conditions Section */}
                            {primaryReasons.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                                    <span className="text-sm font-black text-amber-400 uppercase tracking-wider">
                                      {isAr ? '\u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629' : 'PRIMARY CONDITIONS'}
                                    </span>
                                    <span className="text-xs font-bold text-amber-400/50 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                      {primaryReasons.length}
                                    </span>
                                  </div>
                                  {ageBadge && (
                                    <span className={`text-xs font-black px-3 py-1 rounded-full border ${ageBadge.color}`}>
                                      {ageBadge.label} ({res.trendAge}c)
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-1.5">
                                  {primaryReasons.map(renderReason)}
                                </div>
                              </div>
                            )}

                            {/* Supporting Conditions Section */}
                            {supportingReasons.length > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                                  <span className="text-sm font-black text-blue-400 uppercase tracking-wider">
                                    {isAr ? '\u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u062f\u0627\u0639\u0645\u0629' : 'SUPPORTING CONDITIONS'}
                                  </span>
                                  <span className="text-xs font-bold text-blue-400/50 bg-blue-500/10 px-2 py-0.5 rounded-full">
                                    {supportingReasons.length}
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  {supportingReasons.map(renderReason)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                        </motion.div>
                      )}
                      </AnimatePresence>

                      {/* View Chart Button */}
                      <button
                        onClick={() => { setSelectedIndex(idx); handleClick(); }}
                        className={`w-full py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-[#F59E0B] text-black'
                            : 'bg-white/5 border border-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        <BarChart2 size={12} />
                        <span>{isAr ? '\u0639\u0631\u0636 \u0627\u0644\u0634\u0627\u0631\u0637' : 'View Chart'}</span>
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
