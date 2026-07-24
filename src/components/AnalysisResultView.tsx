import React, { useState, useRef, useCallback } from 'react';
import { AnalysisResult, SignalType, StrategySettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, ShieldAlert, MessageSquare, BarChart2, ChevronDown, Info } from 'lucide-react';
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

const SIGNAL_CONFIG: Record<SignalType, { labelKey: keyof typeof translations.en, color: string, bg: string, border: string, icon: any, labelAr: string, labelEn: string, symbolColor: string }> = {
    [SignalType.STRONG_BUY]: { labelKey: "strong_buy" as any, color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/40", icon: null, labelAr: "إشارة شراء قوي", labelEn: "Strong Buy Signal", symbolColor: '#00ff88' },
    [SignalType.BUY]: { labelKey: "buy" as any, color: "text-emerald-400/80", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: null, labelAr: "إشارة شراء", labelEn: "Buy Signal", symbolColor: '#66ffaa' },
    [SignalType.NEUTRAL]: { labelKey: "neutral" as any, color: "text-slate-400", bg: "bg-slate-500/20", border: "border-slate-500/20", icon: null, labelAr: "محايد", labelEn: "Neutral", symbolColor: '#ffffff' },
    [SignalType.SELL]: { labelKey: "sell" as any, color: "text-red-400/80", bg: "bg-red-500/10", border: "border-red-500/20", icon: null, labelAr: "إشارة بيع", labelEn: "Sell Signal", symbolColor: '#ff5555' },
    [SignalType.STRONG_SELL]: { labelKey: "strong_sell" as any, color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/40", icon: null, labelAr: "إشارة بيع قوي", labelEn: "Strong Sell Signal", symbolColor: '#ff4444' },
    [SignalType.NO_ENTRY]: { labelKey: "no_entry" as any, color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/10", icon: null, labelAr: "لا توجد فرصة", labelEn: "No Entry", symbolColor: '#ffffff' },
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
      <div className="w-full">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 items-start px-2 sm:px-0">
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
              style={{ alignSelf: 'start', backgroundColor: 'rgba(var(--card-bg),0.88)' }}
              className="signal-card rounded-xl border-2 border-amber-600/40 transition-all overflow-hidden"
            >
              {/* Compact Header - Always Visible */}
              <button
                onClick={() => {
                  setSelectedIndex(idx);
                  setExpandedCard(isExpanded ? null : `${res.symbol}_${idx}`);
                  handleClick();
                }}
                className="w-full px-3 py-1.5 flex flex-col items-center gap-1"
              >
                <div className="flex items-center justify-center w-full gap-2 overflow-hidden">
                  <span className="text-sm sm:text-base font-black font-mono" style={{color:'#00ff88'}}>{tp ? tp.toFixed(decimals) : '—'}</span>
                  <span className="text-lg sm:text-xl font-black italic flex-shrink-0 text-center" style={{ color: meta.symbolColor }}>{res.symbol}</span>
                  <span className="text-sm sm:text-base font-black font-mono" style={{color:'#ff4444'}}>{sl ? sl.toFixed(decimals) : '—'}</span>
                </div>
                <span className="text-base sm:text-lg font-black" style={{color: meta.symbolColor}}>{isAr ? meta.labelAr : meta.labelEn}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-3xl font-black font-mono" style={{color:'#ffffff'}}>{res.confidence}%</span>
                  <div className="flex items-center gap-0.5">
                    <span className="text-[10px] sm:text-xs font-bold" style={{color:'rgba(255,255,255,0.85)'}}>{formatPublishDate(res.timestamp)}</span>
                  </div>
                </div>
              </button>

              {/* Expand/Collapse Arrow */}
              <button onClick={(e) => { e.stopPropagation(); setExpandedCard(isExpanded ? null : `${res.symbol}_${idx}`); }} className="w-full flex items-center justify-center py-1 text-white/40 hover:text-white/70 transition-colors">
                <span className="text-xs">{isExpanded ? '\u25B2' : '\u25BC'}</span>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-white/10" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  <div className="px-3 py-2 space-y-2">
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
                      <div className="bg-white/10 rounded-lg p-2.5 border border-white/10 text-sm text-white/80 leading-relaxed">
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
                        className="w-full flex items-center justify-between text-sm font-bold text-white hover:text-white/80 transition-colors py-1"
                      >
                        <div className="flex items-center gap-1.5">
                          <Info size={14} />
                          <span>{isAr ? 'الشروط التقييمية' : 'Conditions'} ({res.detailedReasons.length})</span>
                        </div>
                        <span className="text-xs">{expandedReasons.has(`${res.symbol}_${idx}`) ? '\u25B2' : '\u25BC'}</span>
                      </button>
                    )}

                    {/* Primary & Supporting Reasons */}
                    {expandedReasons.has(`${res.symbol}_${idx}`) && res.detailedReasons && res.detailedReasons.length > 0 && (
                      <div className="space-y-2">
                        {(() => {
                          const PRIMARY_CHECKS = ['BB Pullback', 'Micro BB', 'Supply/Demand', 'Trend Age', 'Pre-Pullback Age', 'News', 'Economic Events'];
                          const primaryReasons = res.detailedReasons.filter((r: any) => PRIMARY_CHECKS.some(p => r.check?.includes(p)));
                          const supportingReasons = res.detailedReasons.filter((r: any) => !PRIMARY_CHECKS.some(p => r.check?.includes(p)));

                          const getAgeBadge = () => {
                            if (res.trendAge === undefined) return null;
                            const age = res.trendAge;
                            if (age < 10) return { label: isAr ? 'طفل' : 'Infant', color: 'text-red-400 bg-red-500/15 border-red-500/30' };
                            if (age < 25) return { label: isAr ? 'شاب' : 'Youth', color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' };
                            if (age <= 75) return { label: isAr ? 'ناضج' : 'Mature', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' };
                            return { label: isAr ? 'شيخ' : 'Old', color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' };
                          };
                          const ageBadge = getAgeBadge();

                          const renderReason = (reason: any, i: number) => (
                            <div key={i} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)'}} className="rounded-lg p-3" title={reason.impact || ''}>
                              <div className="flex items-center gap-2.5">
                                <div className={`w-4 h-4 rounded-full shrink-0 ${reason.status === 'positive' ? 'bg-emerald-400' : reason.status === 'negative' ? 'bg-red-400' : 'bg-white/70'}`} />
                                <span style={{color: reason.status === 'positive' ? '#00ff88' : reason.status === 'negative' ? '#ff4444' : '#ffffff'}} className="font-bold text-base sm:text-lg shrink-0">{reason.check}</span>
                                <span style={{color: reason.status === 'positive' ? '#00ff88' : reason.status === 'negative' ? '#ff4444' : '#ffffff'}} className="font-mono text-sm sm:text-base break-all font-bold">{reason.value}</span>
                              </div>
                              {reason.dates && <div style={{color: reason.status === 'positive' ? '#00ff88' : reason.status === 'negative' ? '#ff4444' : '#ffffff',opacity:0.8}} className="ml-6 mt-2 text-sm font-mono whitespace-pre-line">{reason.dates}</div>}
                              {reason.impact && <p style={{color: reason.status === 'positive' ? '#00ff88' : reason.status === 'negative' ? '#ff4444' : '#ffffff',opacity:0.7}} className="text-sm mt-2 ml-6 leading-relaxed">{reason.impact}</p>}
                            </div>
                          );

                          return (
                            <>
                              {primaryReasons.length > 0 && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                                      <span className="text-sm font-black text-amber-400 uppercase tracking-wider">{isAr ? 'الشروط الأساسية' : 'PRIMARY CONDITIONS'}</span>
                                      <span className="text-xs font-bold text-amber-400/50 bg-amber-500/10 px-2 py-0.5 rounded-full">{primaryReasons.length}</span>
                                    </div>
                                    {ageBadge && <span className={`text-xs font-black px-3 py-1 rounded-full border ${ageBadge.color}`}>{ageBadge.label} ({res.trendAge}c)</span>}
                                  </div>
                                  <div className="space-y-1.5">{primaryReasons.map(renderReason)}</div>
                                </div>
                              )}
                              {supportingReasons.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                                    <span className="text-sm font-black text-blue-400 uppercase tracking-wider">{isAr ? 'الشروط الداعمة' : 'SUPPORTING CONDITIONS'}</span>
                                    <span className="text-xs font-bold text-blue-400/50 bg-blue-500/10 px-2 py-0.5 rounded-full">{supportingReasons.length}</span>
                                  </div>
                                  <div className="space-y-1.5">{supportingReasons.map(renderReason)}</div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
