import React, { useState } from 'react';
import { AnalysisResult, SignalType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Zap, ShieldAlert, ChevronDown, ChevronUp, BarChart2, Info, Activity, Clock, Lock } from 'lucide-react';
import TradingViewWidget from './TradingViewWidget';
import { Language, translations } from '../lib/i18n';

interface ClientDashboardProps {
  results: AnalysisResult[];
  lang: Language;
  hasActivePlan?: boolean;
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: any; labelAr: string; labelEn: string }> = {
  [SignalType.STRONG_BUY]: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', icon: TrendingUp, labelAr: 'شراء قوي', labelEn: 'Strong Buy' },
  [SignalType.STRONG_SELL]: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/40', icon: ShieldAlert, labelAr: 'بيع قوي', labelEn: 'Strong Sell' },
  [SignalType.BUY]: { color: 'text-emerald-400/80', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: TrendingUp, labelAr: 'شراء', labelEn: 'Buy' },
  [SignalType.SELL]: { color: 'text-red-400/80', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: ShieldAlert, labelAr: 'بيع', labelEn: 'Sell' },
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
  const [expandedReasons, setExpandedReasons] = useState<string | null>(null);

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

  // Apply per-category limit (2 symbols per category) when free plan is disabled
  const FREE_LIMIT = 2;
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

      {/* 4. Opportunities List with Detailed Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedStrong.map((res) => {
          const meta = SIGNAL_META[res.signal] || SIGNAL_META[SignalType.STRONG_BUY];
          const Icon = meta.icon;
          const isSelected = selectedSymbol === res.symbol || (!selectedSymbol && sortedStrong[0].symbol === res.symbol);
          const isLocked = lockedIds.has(res.symbol + '_' + res.timestamp);

          return (
            <motion.div
              key={res.symbol}
              layout
              className={`rounded-2xl p-5 border bg-brand-alt/45 backdrop-blur-md transition-all shadow-lg flex flex-col justify-between ${
                isSelected && !isLocked ? 'border-primary ring-1 ring-primary bg-brand-alt/80 scale-[1.01]' : 'border-white/5 hover:border-white/10 hover:bg-brand-alt/60'
              } ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div>
                {/* Header: Symbol & Signal & Time */}
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-white tracking-tighter italic">{res.symbol}</span>
                      <span className="text-xs bg-white/5 border border-white/10 text-white/60 px-2 py-0.5 rounded font-black uppercase">
                        {res.timeframe}
                      </span>
                    </div>
                    {/* Publish Date */}
                    <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-bold">
                      <Clock size={10} />
                      <span>{formatPublishDate(res.timestamp, lang)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    <div className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${meta.bg} ${meta.border} border ${isLocked ? 'bg-amber-500/20 border-amber-500/50' : ''}`}>
                      {isLocked ? (
                        <Lock size={12} className="text-amber-400" />
                      ) : (
                        <Icon size={12} className={meta.color} />
                      )}
                      <span className={`text-[10px] font-black uppercase ${isLocked ? 'text-amber-400' : meta.color}`}>
                        {isLocked ? (isAr ? 'محدود' : 'Limited') : (isAr ? meta.labelAr : meta.labelEn)}
                      </span>
                    </div>
                    <span className="text-[11px] font-black text-white/60 font-mono">
                      {isAr ? `ثقة: ${res.confidence}%` : `Conf: ${res.confidence}%`}
                    </span>
                  </div>
                </div>

                {/* Target Levels: Stop Loss & Take Profit */}
                {res.stopLoss && res.takeProfit ? (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                      <span className="text-[9px] block text-red-400 font-bold uppercase tracking-wider mb-0.5">
                        {isAr ? 'وقف الخسارة (SL)' : 'Stop Loss (SL)'}
                      </span>
                      <span className="text-sm font-extrabold text-red-500 font-mono">
                        {res.stopLoss.toFixed(res.symbol.includes('JPY') ? 3 : 5)}
                      </span>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                      <span className="text-[9px] block text-emerald-400 font-bold uppercase tracking-wider mb-0.5">
                        {isAr ? 'جني الأرباح (TP)' : 'Take Profit (TP)'}
                      </span>
                      <span className="text-sm font-extrabold text-emerald-500 font-mono">
                        {res.takeProfit.toFixed(res.symbol.includes('JPY') ? 3 : 5)}
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Analysis Reasons Directly Visible */}
                {res.summary && (
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-xs text-white/70 leading-relaxed mb-4">
                    <p className="font-bold">{res.summary}</p>
                  </div>
                )}

                {/* Technical Indicator Checks (Collapsible) */}
                {res.detailedReasons && res.detailedReasons.length > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedReasons(expandedReasons === res.symbol ? null : res.symbol);
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-white/50 hover:text-white transition-colors"
                    >
                      <Info size={12} />
                      <span>{isAr ? 'شروط وتفاصيل المؤشرات الفنية' : 'Technical Indicator Checks'}</span>
                      {expandedReasons === res.symbol ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                    <AnimatePresence>
                      {expandedReasons === res.symbol && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1.5 mt-2.5 overflow-hidden"
                        >
                          {res.detailedReasons.map((reason, i) => (
                            <div key={i} className="bg-white/[0.02] rounded-lg p-2.5 border border-white/5 flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                  reason.status === 'positive' ? 'bg-emerald-400' :
                                  reason.status === 'negative' ? 'bg-red-400' : 'bg-white/30'
                                }`} />
                                <span className="font-bold text-white/80">{reason.check}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-white/40 font-mono">{reason.value}</span>
                                {reason.impact && (
                                  <span className="block text-[9px] text-white/30 mt-0.5">{reason.impact}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* View Chart Button */}
              <button
                onClick={() => setSelectedSymbol(res.symbol)}
                className={`w-full mt-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  isSelected 
                    ? 'bg-primary text-white shadow-lg' 
                    : 'bg-white/5 border border-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <BarChart2 size={12} />
                <span>{isAr ? 'عرض الشارت التفاعلي' : 'View Interactive Chart'}</span>
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
