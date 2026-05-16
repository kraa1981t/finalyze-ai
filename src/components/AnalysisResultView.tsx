import React, { useState } from 'react';
import { AnalysisResult, SignalType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, Minus, ShieldAlert, Zap, Globe, MessageSquare, BarChart2, ChevronRight, X, History, Scale, AlertCircle, Clock } from 'lucide-react';
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
  
  const sortedResults = [...results].sort((a, b) => b.confidence - a.confidence);
  const selectedResult = sortedResults[selectedIndex] || sortedResults[0];

  const isRTL = lang === 'ar';
  const isWeekend = new Date().getDay() === 0 || new Date().getDay() === 6;
  const isCrypto = selectedResult?.type === 'crypto' || selectedResult?.symbol.includes('USD-') || (selectedResult && ['BTC','ETH','SOL','BNB','XRP','ADA','DOT','AVAX','LINK','MATIC','DOGE','SHIB'].some(c => selectedResult.symbol.startsWith(c)));

  return (
    <div className="space-y-10 pb-20 px-4">
      {/* 1. Market Status Large Indicator - Only show if weekend AND not looking at crypto */}
      {isWeekend && !isCrypto && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-4xl mx-auto py-16 bg-white/5 border-2 border-dashed border-red-500/30 rounded-[3rem] flex flex-col items-center justify-center gap-6 text-center shadow-2xl backdrop-blur-md mb-10"
        >
          <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 shadow-[0_0_50px_rgba(239,68,68,0.3)]">
            <Clock size={48} className="animate-spin-slow" />
          </div>
          <div className="space-y-2">
            <h2 className="text-4xl md:text-5xl font-black text-black tracking-tighter uppercase italic drop-shadow-lg">
              {lang === 'ar' ? 'الأسواق مغلقة الآن' : 'MARKETS CLOSED NOW'}
            </h2>
            <p className="text-black/60 font-black text-xs uppercase tracking-[0.4em]">
              {lang === 'ar' ? 'الرادار يراقب العملات الرقمية فقط (24/7)' : 'RADAR MONITORING CRYPTO ONLY (24/7)'}
            </p>
          </div>
        </motion.div>
      )}

      {/* 2. Top Section: Interactive Chart (Only if we have results) */}
      {selectedResult && (
        <div className="w-full max-w-4xl mx-auto">
          <div className="h-[350px] md:h-[450px] bg-brand-bg rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white/50 relative">
            <TradingViewWidget symbol={selectedResult.symbol} />
            <div className="absolute top-8 left-8 z-10 flex items-center gap-3">
               <div className="px-6 py-3 bg-white/90 backdrop-blur-2xl rounded-2xl border border-black/10 text-black text-[12px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-2xl">
                 <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,1)]" />
                 <span>{selectedResult.symbol} : {selectedResult.confidence}%</span>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Simplified List Section */}
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className={cn("flex items-center justify-between px-6", isRTL ? "flex-row" : "flex-row-reverse")}>
          <span className="text-[11px] font-black text-black/40 font-mono uppercase tracking-[0.3em]">Institutional Feed: {results.length}</span>
          <h3 className="text-lg font-black text-black flex items-center gap-3 uppercase tracking-[0.25em] italic">
            <Zap size={18} className="text-orange-500 fill-orange-500" />
            {t.finalDecision}
          </h3>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-20 text-black/30 font-black uppercase tracking-[0.5em] text-xs">
            {lang === 'ar' ? 'في انتظار إشارات قوية...' : 'AWAITING STRONG SIGNALS...'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedResults.map((res, idx) => {
              const resConfig = SIGNAL_CONFIG[res.signal] || SIGNAL_CONFIG[SignalType.NEUTRAL];
              const ResIcon = resConfig.icon;
              const isSelected = selectedIndex === idx;
              const isBuy = res.signal.includes('buy');
              const isSell = res.signal.includes('sell');
              const signalColor = isBuy ? '#10B981' : isSell ? '#EF4444' : '#64748B';

              return (
                <motion.div
                  key={res.symbol + idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => {
                    setSelectedIndex(idx);
                    setShowDetail(true);
                  }}
                  className={cn(
                    "relative overflow-hidden p-6 rounded-[2rem] border-2 transition-all cursor-pointer group shadow-lg",
                    isSelected 
                      ? "border-primary bg-brand-alt shadow-[0_0_30px_rgba(16,185,129,0.15)] scale-[1.02]" 
                      : "border-brand-text/5 bg-brand-alt/40 hover:border-primary/30 hover:bg-brand-alt"
                  )}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xl font-black text-brand-text tracking-tighter italic">{res.symbol}</span>
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner", resConfig.bg)}>
                      <ResIcon size={20} style={{ color: signalColor }} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-end justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-muted mb-1">Recommendation</span>
                        <span className="text-sm font-black uppercase tracking-wider" style={{ color: signalColor }}>
                          {t[res.signal as keyof typeof t]}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-muted mb-1 block">Certainty</span>
                        <span className="text-2xl font-black italic tracking-tighter" style={{ color: signalColor }}>
                          {res.confidence}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-brand-bg/50 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${res.confidence}%` }}
                        className="h-full"
                        style={{ backgroundColor: signalColor }}
                      />
                    </div>
                  </div>

                  {/* Absolute subtle number */}
                  <span className="absolute top-4 right-6 text-[40px] font-black text-brand-text/5 select-none -z-10">#{idx + 1}</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetail && selectedResult && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetail(false)}
              className="absolute inset-0 bg-white/60 backdrop-blur-2xl"
            />
            <motion.div
              layoutId="detail"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              className="relative w-full max-w-2xl bg-white border-4 border-black rounded-[3rem] overflow-hidden shadow-2xl shadow-black/20 overflow-y-auto max-h-[85vh]"
            >
              <div className="p-10 space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-5xl font-black tracking-tighter text-black italic mb-2">{selectedResult.symbol}</h2>
                    <span className="px-4 py-1.5 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em]">
                      INSTITUTIONAL GRADE • {selectedResult.confidence}%
                    </span>
                  </div>
                  <button onClick={() => setShowDetail(false)} className="p-4 bg-black/5 hover:bg-black text-black hover:text-white rounded-2xl transition-all">
                    <X size={28} />
                  </button>
                </div>

                <div className="p-8 bg-black text-white rounded-[2rem] space-y-6">
                  <div className="flex items-center gap-3">
                    <MessageSquare size={20} className="text-sky-400" />
                    <h4 className="text-xs font-black uppercase tracking-[0.4em]">{t.reasons}</h4>
                  </div>
                  <div className="text-lg font-black leading-relaxed opacity-90 italic">
                    <Markdown>{selectedResult.summary}</Markdown>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-3xl text-center">
                    <span className="text-[10px] font-black uppercase text-black/40 block mb-2">Trend Accuracy</span>
                    <span className="text-3xl font-black text-emerald-600">{selectedResult.technicalScore}%</span>
                  </div>
                  <div className="p-6 bg-sky-500/10 border-2 border-sky-500/20 rounded-3xl text-center">
                    <span className="text-[10px] font-black uppercase text-black/40 block mb-2">Market Pressure</span>
                    <span className="text-3xl font-black text-sky-600">{selectedResult.sentimentScore}%</span>
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
