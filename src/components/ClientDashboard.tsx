import React, { useState } from 'react';
import { AnalysisResult, SignalType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Zap, BarChart2, Info, Lock } from 'lucide-react';
import TradingViewWidget from './TradingViewWidget';
import LotSizeCalculator from './LotSizeCalculator';
import { Language, translations } from '../lib/i18n';

interface ClientDashboardProps {
  results: AnalysisResult[];
  lang: Language;
  hasActivePlan?: boolean;
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
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = isAr ? daysAr[date.getDay()] : daysEn[date.getDay()];
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return isAr 
      ? `${dayName} الساعة ${hours}:${minutes}`
      : `${dayName} at ${hours}:${minutes}`;
  } catch {
    return timestamp;
  }
};

export default function ClientDashboard({ results, lang, hasActivePlan = false }: ClientDashboardProps) {
  const isAr = lang === 'ar';
  const t = translations[lang];
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());

  // Filter for active STRONG signals only (less than 20 hours old)
  const maxAgeInMs = 20 * 60 * 60 * 1000;
  const now = Date.now();
  const filtered = results.filter(r => 
    (r.signal === SignalType.STRONG_BUY || r.signal === SignalType.STRONG_SELL) &&
    (now - new Date(r.timestamp).getTime()) < maxAgeInMs
  );

  const signalOrder = (s: string) => {
    if (s === SignalType.STRONG_BUY) return 0;
    if (s === SignalType.BUY) return 1;
    if (s === SignalType.SELL) return 2;
    if (s === SignalType.STRONG_SELL) return 3;
    return 4;
  };

  const sortedAll = [...filtered].sort((a, b) => signalOrder(a.signal) - signalOrder(b.signal) || b.confidence - a.confidence);

  // Apply per-category limit (1 symbol per category) when free plan is disabled
  const FREE_LIMIT = 1;
  const sortedStrong = hasActivePlan
    ? sortedAll
    : (() => {
        const counts: Record<string, number> = {};
        return sortedAll.filter(r => {
          const cat = r.category || 'Unknown';
          counts[cat] = (counts[cat] || 0) + 1;
          return counts[cat] <= FREE_LIMIT;
        });
      })();

  const isLimited = !hasActivePlan && sortedAll.length > sortedStrong.length;
  const lockedCount = sortedAll.length - sortedStrong.length;

  // Determine which are locked (for rendering lock icons)
  const lockedIds = new Set<string>();
  if (!hasActivePlan) {
    const counts: Record<string, number> = {};
    for (const r of sortedAll) {
      const cat = r.category || 'Unknown';
      counts[cat] = (counts[cat] || 0) + 1;
      if (counts[cat] > FREE_LIMIT) {
        lockedIds.add(r.symbol + '_' + r.timestamp);
      }
    }
  }

  // Auto-select the first symbol or active one for the chart
  const activeResult = sortedStrong.find(r => r.symbol === selectedSymbol) || sortedStrong[0];
  const activeSymbol = activeResult?.symbol || null;

  if (filtered.length === 0) {
    return (
      <div className="space-y-6" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        {/* Auto-analysis status banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-3 flex items-center gap-3">
          <div className="relative">
            <Activity size={20} className="text-emerald-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          </div>
          <span className="text-sm font-black text-emerald-400">
            {isAr ? 'التحليل التلقائي نشط' : 'Auto Analysis Active'}
          </span>
          <span className="text-xs text-emerald-400/60 font-bold">
            {isAr ? 'يتم تحديث الفرص في الوقت الفعلي من المطور' : 'Opportunities synchronized in real-time from developer'}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 border-b-2 border-emerald-400 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Activity size={24} className="text-emerald-400" />
            </div>
          </div>
          <h3 className="text-xl font-black text-white/60">
            {isAr ? 'في انتظار نشر فرص جديدة...' : 'Waiting for new opportunities...'}
          </h3>
          <p className="text-sm text-white/40 mt-2">
            {isAr ? 'ستظهر التحليلات والفرص القوية بمجرد نشرها من حساب المطور' : 'Strong analyses and signals will appear once published by developer'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
      {/* 1. Auto-analysis status banner */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-3 flex items-center gap-3">
        <div className="relative">
          <Activity size={20} className="text-emerald-400" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        </div>
        <span className="text-sm font-black text-emerald-400">
          {isAr ? 'التحليل التلقائي نشط' : 'Auto Analysis Active'}
        </span>
        <span className="text-xs text-emerald-400/60 font-bold">
          {isAr ? 'يتم تحديث فرص تلقائياً فور صدورها' : 'Opportunities synchronized in real-time'}
        </span>
      </div>

      {/* Upgrade banner when limited */}
      {isLimited && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-3 flex items-center gap-3">
          <Lock size={20} className="text-amber-400" />
          <div>
            <span className="text-sm font-black text-amber-400">
              {isAr ? `عرض ${sortedStrong.length} من ${sortedAll.length} فرصة` : `Showing ${sortedStrong.length} of ${sortedAll.length} opportunities`}
            </span>
            <p className="text-xs text-amber-400/60 font-bold">
              {isAr ? `اشترِ خطة للوصول لجميع ${sortedAll.length} فرصة متاحة` : `Purchase a plan to access all ${sortedAll.length} available opportunities`}
            </p>
          </div>
        </div>
      )}

      {/* 2. Chart Section at the Very Top */}
      {activeSymbol && (
        <div className="bg-brand-alt rounded-3xl border border-white/10 overflow-hidden shadow-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <BarChart2 size={20} className="text-primary" />
              <span className="text-lg font-black text-white italic tracking-wider">{activeSymbol}</span>
              {SIGNAL_META[activeResult.signal] && (
                <span className={`text-xs font-black px-3 py-1 rounded-full ${SIGNAL_META[activeResult.signal].bg} ${SIGNAL_META[activeResult.signal].color} border ${SIGNAL_META[activeResult.signal].border}`}>
                  {isAr ? SIGNAL_META[activeResult.signal].labelAr : SIGNAL_META[activeResult.signal].labelEn}
                </span>
              )}
            </div>
            <span className="text-xs text-white/40 font-bold font-mono">
              {formatPublishDate(activeResult.timestamp, lang)}
            </span>
          </div>
          <div className="h-[350px] md:h-[400px] rounded-2xl overflow-hidden relative">
            <TradingViewWidget symbol={activeSymbol} />
          </div>
        </div>
      )}

      {/* 3. Section Title */}
      <div className="flex items-center gap-3 mt-8 mb-2">
        <Zap size={22} className="text-primary animate-pulse" />
        <h2 className="text-lg font-black text-white">
          {isAr ? 'الفرص القوية المتاحة' : 'Strong Trading Opportunities'}
        </h2>
        <span className="text-xs text-white/40 font-bold">({sortedStrong.length})</span>
        {!hasActivePlan && (
          <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
            <Lock size={12} />
            {isAr ? 'محدود' : 'Limited'}
          </span>
        )}
      </div>

      {/* 4. Compact Opportunity Cards - 3 per row */}
      <div className="grid grid-cols-3 gap-2 items-start">
        {sortedStrong.map((res, idx) => {
          const meta = SIGNAL_META[res.signal] || SIGNAL_META[SignalType.STRONG_BUY];
          const isSelected = selectedSymbol === res.symbol || (!selectedSymbol && sortedStrong[0].symbol === res.symbol);
          const isLocked = lockedIds.has(res.symbol + '_' + res.timestamp);
          const isExpanded = expandedCard === res.symbol;

          const isJPY = res.symbol.includes('JPY');
          const decimals = isJPY ? 3 : 5;
          const entry = res.entryPrice || 0;
          const tp = res.takeProfit || 0;
          const sl = res.stopLoss || 0;

          return (
            <motion.div
              key={res.symbol}
              layout
              className={`rounded-lg border transition-all ${
                isSelected && !isLocked
                  ? 'border-white/10 bg-brand-alt/80'
                  : 'border-white/5 bg-brand-alt/45 hover:border-white/10'
              } ${isLocked ? 'opacity-40 pointer-events-none' : ''}`}
            >
              {/* Compact Header - Always Visible */}
              <button
                onClick={() => {
                  if (!isLocked) {
                    setSelectedSymbol(res.symbol);
                    setExpandedCard(isExpanded ? null : res.symbol);
                  }
                }}
                className={`w-full px-3 py-3 flex flex-col items-center gap-2 rounded-t-lg transition-all ${isSelected && !isLocked ? 'border-b border-[#F59E0B]/30' : ''}`}
              >
                {/* Symbol and SL/TP Row */}
                <div className="flex items-center gap-1 px-1">
                  {/* Take Profit (TP) Box */}
                  <div className="flex-1 bg-emerald-500/15 border border-emerald-500/30 rounded-xl px-3 py-3 shrink-0 flex items-center justify-center">
                    <span className="text-lg font-black font-mono text-emerald-400">{tp ? tp.toFixed(decimals) : '—'}</span>
                  </div>

                  {/* Symbol in Middle */}
                  <div className="flex items-center justify-center min-w-[48px] shrink-0">
                    <span className={`text-sm font-black font-mono ${meta.color}`}>{res.symbol}</span>
                  </div>

                  {/* Stop Loss (SL) Box */}
                  <div className="flex-1 bg-red-500/15 border border-red-500/30 rounded-xl px-3 py-3 shrink-0 flex items-center justify-center">
                    <span className="text-lg font-black font-mono text-red-400">{sl ? sl.toFixed(decimals) : '—'}</span>
                  </div>
                </div>

                {/* Signal text */}
                <span className={`text-xs font-black ${meta.color}`}>
                  {isLocked ? (isAr ? 'محدود' : 'Limited') : (isAr ? meta.labelAr : meta.labelEn)}
                </span>

                {/* Confidence + Time row */}
                <div className="flex items-center gap-2">
                  {isLocked && <Lock size={14} className="text-amber-400 shrink-0" />}
                  <span className={`text-lg font-black font-mono ${meta.color}`}>{res.confidence}%</span>
                  <div className={`flex items-center gap-0.5 text-[10px] font-bold ${meta.color}/40`}>
                    <span>{formatPublishDate(res.timestamp, lang)}</span>
                  </div>
                </div>
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
                    <div className="px-2 pb-1.5 space-y-1.5 border-t border-white/5 pt-1.5">
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
                        <div className="bg-white/5 rounded p-1.5 border border-white/5 text-[10px] text-yellow-400/70 leading-relaxed">
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
                            <div className="flex items-center gap-1.5">
                              <Info size={14} />
                              <span className="text-xs">{isAr ? 'المؤشرات' : 'Indicators'} ({res.detailedReasons.length})</span>
                            </div>
                            <span className="text-xs">{expandedReasons.has(`${res.symbol}_${idx}`) ? '▼' : '▶'}</span>
                          </button>
                          <AnimatePresence>
                            {expandedReasons.has(`${res.symbol}_${idx}`) && (
                              <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                    className="origin-center"
                              >
                                <div className="space-y-1.5 pt-1">
                                  {res.detailedReasons.map((reason, i) => (
                                    <div key={i} className="bg-white/[0.02] rounded p-2 border border-white/5 flex items-center justify-between text-xs">
                                      <div className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${
                                          reason.status === 'positive' ? 'bg-emerald-400' :
                                          reason.status === 'negative' ? 'bg-red-400' : 'bg-slate-400'
                                        }`} />
                                        <span className={`font-bold ${reason.status === 'positive' ? 'text-emerald-400/80' : reason.status === 'negative' ? 'text-red-400/80' : 'text-slate-400/80'}`}>{reason.check}</span>
                                      </div>
                                      <span className={`font-mono text-xs ${reason.status === 'positive' ? 'text-emerald-400/50' : reason.status === 'negative' ? 'text-red-400/50' : 'text-slate-400/50'}`}>{reason.value}</span>
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
                        onClick={() => setSelectedSymbol(res.symbol)}
                        className="w-full py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider bg-[#F59E0B] text-black flex items-center justify-center gap-1"
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
