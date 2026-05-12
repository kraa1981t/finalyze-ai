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
}

const SIGNAL_CONFIG: Record<SignalType, { labelKey: keyof typeof translations.en, color: string, bg: string, icon: any }> = {
    [SignalType.STRONG_BUY]: { labelKey: "strong_buy" as any, color: "#10B981", bg: "bg-emerald-500/20", icon: TrendingUp },
    [SignalType.BUY]: { labelKey: "buy" as any, color: "#34D399", bg: "bg-emerald-500/10", icon: TrendingUp },
    [SignalType.NEUTRAL]: { labelKey: "neutral" as any, color: "#94A3B8", bg: "bg-slate-500/20", icon: Minus },
    [SignalType.SELL]: { labelKey: "sell" as any, color: "#F87171", bg: "bg-red-500/20", icon: TrendingDown },
    [SignalType.STRONG_SELL]: { labelKey: "strong_sell" as any, color: "#EF4444", bg: "bg-red-500/30", icon: ShieldAlert },
    [SignalType.NO_ENTRY]: { labelKey: "no_entry" as any, color: "#64748B", bg: "bg-slate-500/10", icon: ShieldAlert },
};

export default function AnalysisResultView({ results, lang }: AnalysisResultViewProps) {
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
  if (!selectedResult) return null;

  const isRTL = lang === 'ar';

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
      <div className="space-y-3 max-w-2xl mx-auto">
        <div className={cn("flex items-center justify-between px-4", isRTL ? "flex-row" : "flex-row-reverse")}>
          <span className="text-[10px] font-bold text-brand-muted font-mono uppercase tracking-widest">Analyzed: {results.length}</span>
          <h3 className="text-sm font-black text-brand-text flex items-center gap-2 uppercase tracking-[0.2em]">
            <Zap size={14} className="text-secondary fill-secondary" />
            {t.finalDecision}
          </h3>
        </div>

        <div className="space-y-2">
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div 
                  className={cn(
                    "relative overflow-hidden h-10 rounded-xl border transition-all cursor-pointer group flex items-center px-4 gap-4",
                    isSelected 
                      ? "border-primary bg-brand-alt shadow-lg ring-2 ring-primary/10" 
                      : "border-brand-text/5 bg-brand-alt/50 hover:border-brand-text/10"
                  )}
                  onClick={() => setSelectedIndex(idx)}
                >
                  {/* Rank */}
                  <div className={cn(
                    "w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-[10px] font-black",
                    isSelected ? "bg-primary text-white" : "bg-brand-text/10 text-brand-muted"
                  )}>
                    {idx + 1}
                  </div>

                  {/* Symbol */}
                  <span className="text-sm font-black text-brand-text tracking-tighter italic shrink-0 w-20">{res.symbol}</span>

                  {/* Signal */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={cn("p-1 rounded-md", resConfig.bg)}>
                       <ResIcon size={12} style={{ color: signalColor }} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: signalColor }}>
                      {t[res.signal as keyof typeof t]}
                    </span>
                  </div>

                  {/* Confidence Bar */}
                  <div className="flex-grow flex items-center gap-3 min-w-[100px]">
                    <div className="h-1 flex-grow bg-brand-bg/40 rounded-full overflow-hidden">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${res.confidence}%` }}
                         className="h-full"
                         style={{ backgroundColor: signalColor }}
                       />
                    </div>
                    <span className="text-[10px] font-black tabular-nums" style={{ color: signalColor }}>{res.confidence}%</span>
                  </div>

                  {/* Trend Maturity Badge (Icon only for space) */}
                  {res.trendMaturity && (
                    <div className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase shrink-0",
                      res.trendMaturity === 'youth' ? "bg-emerald-500/10 text-emerald-400" : 
                      res.trendMaturity === 'infancy' ? "bg-blue-500/10 text-blue-400" : 
                      "bg-orange-500/10 text-orange-400"
                    )}>
                       <Zap size={8} />
                       {isRTL ? '' : res.trendMaturity}
                    </div>
                  )}

                  {/* Read More Icon */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}
                    className="p-1 hover:bg-brand-text/10 rounded-md text-primary transition-colors shrink-0"
                  >
                     <ChevronRight size={14} />
                  </button>
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
