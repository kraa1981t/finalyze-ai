import React, { useState } from 'react';
import { AnalysisResult, SignalType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, Minus, ShieldAlert, Zap, Globe, MessageSquare, BarChart2, ChevronRight, X, History, Scale } from 'lucide-react';
import TradingViewWidget from './TradingViewWidget';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';
import { Language, translations } from '../lib/i18n';

interface AnalysisResultViewProps {
  results: AnalysisResult[];
  lang: Language;
  settings?: StrategySettings;
}

const SIGNAL_CONFIG: Record<SignalType, { labelKey: keyof typeof translations.en, color: string, bg: string, icon: any }> = {
    [SignalType.STRONG_BUY]: { labelKey: "strong_buy" as any, color: "#10B981", bg: "bg-emerald-500/20", icon: TrendingUp },
    [SignalType.BUY]: { labelKey: "buy" as any, color: "#34D399", bg: "bg-emerald-500/10", icon: TrendingUp },
    [SignalType.NEUTRAL]: { labelKey: "neutral" as any, color: "#94A3B8", bg: "bg-slate-500/20", icon: Minus },
    [SignalType.SELL]: { labelKey: "sell" as any, color: "#F87171", bg: "bg-red-500/20", icon: TrendingDown },
    [SignalType.STRONG_SELL]: { labelKey: "strong_sell" as any, color: "#EF4444", bg: "bg-red-500/30", icon: ShieldAlert },
    [SignalType.NO_ENTRY]: { labelKey: "no_entry" as any, color: "#64748B", bg: "bg-slate-500/10", icon: ShieldAlert },
};

export default function AnalysisResultView({ results, lang, settings }: AnalysisResultViewProps) {
  const t = translations[lang];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  
  const sortedResults = [...results].sort((a, b) => {
    const aIsAction = a.signal !== 'no_entry' && a.signal !== 'neutral' ? 1 : 0;
    const bIsAction = b.signal !== 'no_entry' && b.signal !== 'neutral' ? 1 : 0;
    if (aIsAction !== bIsAction) return bIsAction - aIsAction;
    return b.confidence - a.confidence;
  });
  
  const selectedResult = sortedResults[selectedIndex] || sortedResults[0];

  const isRTL = lang === 'ar';

  if (!selectedResult) {
    return (
      <div className="space-y-8 pb-20">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-20 text-center space-y-6 bg-brand-bg rounded-[2.5rem] shadow-2xl border border-brand-text/5 min-h-[400px]">
          <ShieldAlert size={64} className="text-red-500/50" />
          <h3 className="text-2xl font-black text-brand-text uppercase tracking-widest">
            {isRTL ? 'لا توجد فرص قوية تلبي شروطك حالياً' : 'No strong opportunities currently meet your criteria'}
          </h3>
          <p className="text-brand-muted text-lg max-w-lg">
            {isRTL 
              ? 'قمنا بتحليل السوق ولكن لم نجد أي إشارات شراء أو بيع قوية بنسبة ثقة تتجاوز العتبة المحددة.' 
              : 'We analyzed the market but found no strong buy or sell signals exceeding your confidence threshold.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* 1. Top Section: Interactive Chart */}
      <div className="w-full max-w-4xl mx-auto">
        <div className="h-[300px] md:h-[400px] bg-brand-bg rounded-[2.5rem] overflow-hidden shadow-2xl border border-brand-text/5 relative">
          <TradingViewWidget symbol={selectedResult.symbol} />
          <div className="absolute top-8 left-8 z-10 flex items-center gap-3">
             <div className="px-5 py-2.5 bg-brand-bg/80 backdrop-blur-2xl rounded-full border border-brand-text/20 text-brand-text text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-2xl">
               <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,1)]" />
               <span className="text-brand-text">LIVE MARKET: {selectedResult.symbol}</span>
             </div>
          </div>
        </div>
      </div>

      {/* 2. List Section: Structured Rankings */}
      <div className="space-y-6">
        <div className={cn("flex items-center justify-between px-4", isRTL ? "flex-row" : "flex-row-reverse")}>
          <span className="text-xs font-bold text-brand-muted font-mono">Analyzed: {results.length}</span>
          <h3 className="text-2xl font-black text-brand-text flex items-center gap-3">
            <Zap size={28} className="text-secondary fill-secondary" />
            {t.finalDecision}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedResults.map((res, idx) => {
            const resConfig = SIGNAL_CONFIG[res.signal] || SIGNAL_CONFIG[SignalType.NEUTRAL];
            const ResIcon = resConfig.icon;
            const isSelected = selectedIndex === idx;
            const isBuy = res.signal.includes('buy');
            const isSell = res.signal.includes('sell');
            const signalColor = isBuy ? '#10B981' : isSell ? '#EF4444' : '#94A3B8';

            return (
              <motion.div
                key={res.symbol + idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div 
                  className={cn(
                    "relative overflow-hidden h-[60px] rounded-2xl border transition-all flex items-center px-4 gap-3 group",
                    isSelected 
                      ? "border-primary bg-primary/5 shadow-lg ring-1 ring-primary/20 scale-[1.02]" 
                      : "border-brand-text/10 bg-brand-alt/40 hover:border-primary/30 hover:bg-brand-alt/60"
                  )}
                  onClick={() => setSelectedIndex(idx)}
                >
                  {/* Rank */}
                  <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[11px] font-black bg-brand-text/5 text-brand-muted border border-brand-text/5">
                    {idx + 1}
                  </div>

                  {/* Symbol */}
                  <span className="text-lg font-black text-brand-text tracking-tighter italic shrink-0 w-24 truncate">{res.symbol}</span>

                  {/* Signal Badge */}
                  <div className={cn("px-3 py-1.5 rounded-lg flex items-center gap-2 shrink-0 transition-all", resConfig.bg)}>
                     <ResIcon size={14} style={{ color: signalColor }} />
                     <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: signalColor }}>
                       {t[res.signal as keyof typeof t]}
                     </span>
                  </div>

                  {/* Confidence % */}
                  <div className="flex-grow flex items-center justify-end gap-6">
                    <span className="text-sm font-black tabular-nums" style={{ color: signalColor }}>{res.confidence}%</span>
                    
                    {/* Read Details Icon/Text */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedIndex(idx); setShowDetail(true); }}
                      className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity cursor-pointer p-1"
                    >
                      <span className="text-[9px] font-bold text-primary uppercase hidden sm:block">{t.readMore}</span>
                      <ChevronRight size={16} className="text-primary group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>

                  {/* Integrated Bottom Confidence Bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand-bg/40">
                     <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: `${res.confidence}%` }}
                       className="h-full"
                       style={{ backgroundColor: signalColor }}
                     />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetail && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetail(false)}
              className="absolute inset-0 bg-brand-bg/80 backdrop-blur-xl"
            />
            <motion.div
              layoutId="detail"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-brand-bg border border-brand-text/10 rounded-[3rem] overflow-hidden shadow-2xl shadow-black/50 overflow-y-auto max-h-[90vh]"
            >
              <div className="p-8 md:p-12 space-y-10">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-brand-text/10 rounded-3xl flex items-center justify-center text-primary border border-brand-text/20">
                      {selectedResult.symbol.includes('USD') ? <Globe size={32} /> : <Zap size={32} />}
                    </div>
                    <div>
                      <h2 className="text-4xl font-black tracking-tight text-brand-text italic mb-1">{selectedResult.symbol}</h2>
                      <div className="flex items-center gap-4">
                         <span className="px-3 py-1 bg-primary text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                           {selectedResult.timeframe}
                         </span>
                         <span className="text-brand-muted font-mono text-[10px]">{new Date(selectedResult.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowDetail(false)}
                    className="p-3 bg-brand-text/5 hover:bg-brand-text/10 rounded-2xl text-brand-muted transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                   {/* Left: Summary Analysis */}
                   <div className="lg:col-span-2 space-y-8">
                      <div className="p-8 bg-brand-alt border border-brand-text/5 rounded-[2rem] space-y-4">
                         <div className="flex items-center gap-3 text-secondary">
                           <MessageSquare size={20} />
                           <h4 className="text-sm font-black uppercase tracking-widest">{t.reasons}</h4>
                         </div>
                         <div className="prose prose-invert prose-slate max-w-none text-brand-muted leading-relaxed text-lg">
                            <Markdown>{selectedResult.summary}</Markdown>
                         </div>
                      </div>

                      {selectedResult.historicalMatch && (
                        <div className="p-8 bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem] space-y-4">
                           <div className="flex items-center gap-3 text-emerald-400">
                             <History size={20} />
                             <h4 className="text-sm font-black uppercase tracking-widest">{t.historicalMatch}</h4>
                           </div>
                           <p className="text-brand-muted italic">
                             {selectedResult.historicalMatch}
                           </p>
                        </div>
                      )}
                   </div>

                   {/* Right: Scores & Stats */}
                   <div className="space-y-6">
                      <div className="p-8 bg-brand-alt border border-brand-text/5 rounded-[2rem] flex flex-col items-center gap-6">
                         <div className="text-center">
                            <div className="text-[10px] font-black uppercase tracking-widest text-brand-muted mb-4">{t.confidence}</div>
                            <div className="text-6xl font-black text-primary tracking-tighter italic">
                              {selectedResult.confidence}%
                            </div>
                         </div>
                         <div className="w-full space-y-4">
                            <ScoreRow label={t.trendVitality} score={selectedResult.technicalScore} color="primary" />
                            <ScoreRow label={t.momentum} score={selectedResult.sentimentScore} color="secondary" />
                             
                             {selectedResult.trendMaturity && (
                               <div className="p-4 bg-brand-text/5 rounded-2xl border border-brand-text/10 space-y-2">
                                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-brand-muted">
                                    <span>{t.trendMaturity}</span>
                                    <span className={cn(
                                      selectedResult.trendMaturity === 'youth' ? "text-emerald-400" : 
                                      selectedResult.trendMaturity === 'infancy' ? "text-blue-400" : 
                                      "text-orange-400"
                                    )}>
                                      {t[selectedResult.trendMaturity as keyof typeof t] || selectedResult.trendMaturity}
                                    </span>
                                  </div>
                                  {selectedResult.trendAge !== undefined && (
                                    <div className="text-[10px] font-bold text-brand-muted">
                                      {selectedResult.trendAge} {t.candles}
                                    </div>
                                  )}
                               </div>
                             )}

                             {selectedResult.microTrend && (
                               <div className={cn(
                                 "p-4 rounded-2xl border space-y-2 shadow-sm transition-all",
                                 selectedResult.microSignal === 'aligned' 
                                   ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                                   : selectedResult.microSignal === 'pullback'
                                     ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                     : "bg-brand-text/5 border-brand-text/10 text-brand-muted"
                               )}>
                                 <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest leading-none">
                                   <span className="text-brand-muted">Micro Trigger ({selectedResult.microTF || 'N/A'})</span>
                                   <span className={cn(
                                     "px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase",
                                     selectedResult.microSignal === 'aligned' ? "bg-emerald-500 text-white animate-pulse" : "bg-amber-500 text-black"
                                   )}>
                                     {selectedResult.microSignal === 'aligned' ? (isRTL ? "تأكيد الدخول" : "ALIGNED") : (isRTL ? "انتظار التصحيح" : "PULLBACK")}
                                   </span>
                                 </div>
                                 <div className="text-[12px] font-bold text-brand-text mt-1 leading-normal">
                                   {selectedResult.microTrend}
                                 </div>
                               </div>
                             )}

                         </div>
                      </div>

                      <div className="p-8 bg-brand-bg/40 border border-brand-text/5 rounded-[2rem] space-y-4">
                         <div className="flex items-center gap-3 text-brand-muted">
                           <ShieldAlert size={18} />
                           <h4 className="text-xs font-black uppercase tracking-widest">Risk Guard</h4>
                         </div>
                         <p className="text-[11px] text-brand-muted leading-relaxed">
                            Analysis assumes standard institutional risk parameters. Stop-loss should align with nearest H4 liquidity zone.
                         </p>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScoreRow({ label, score, color }: { label: string, score: number, color: 'primary' | 'secondary' }) {
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-brand-muted">
        <span>{label}</span>
        <span className={color === 'primary' ? "text-primary" : "text-secondary"}>{score}%</span>
      </div>
      <div className="h-1.5 bg-brand-text/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          className={cn("h-full", color === 'primary' ? "bg-primary" : "bg-secondary")}
        />
      </div>
    </div>
  );
}
