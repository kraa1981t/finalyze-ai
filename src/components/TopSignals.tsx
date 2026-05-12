import React from 'react';
import { AnalysisResult, SignalType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, TrendingUp, TrendingDown, Minus, ShieldAlert, X, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Language, translations } from '../lib/i18n';

interface TopSignalsProps {
  signals: AnalysisResult[];
  onRemove: (symbol: string) => void;
  onSelect: (result: AnalysisResult) => void;
  lang: Language;
}

const SIGNAL_CONFIG: Record<string, { color: string, bg: string, icon: any }> = {
    [SignalType.STRONG_BUY]: { color: "#10B981", bg: "bg-emerald-500/20", icon: TrendingUp },
    [SignalType.BUY]: { color: "#34D399", bg: "bg-emerald-500/10", icon: TrendingUp },
    [SignalType.NEUTRAL]: { color: "#94A3B8", bg: "bg-slate-500/20", icon: Minus },
    [SignalType.SELL]: { color: "#F87171", bg: "bg-red-500/20", icon: TrendingDown },
    [SignalType.STRONG_SELL]: { color: "#EF4444", bg: "bg-red-500/30", icon: ShieldAlert },
    [SignalType.NO_ENTRY]: { color: "#64748B", bg: "bg-slate-500/10", icon: ShieldAlert },
};

export default function TopSignals({ signals, onRemove, onSelect, lang }: TopSignalsProps) {
  const t = translations[lang];
  const isRTL = lang === 'ar';

  if (signals.length === 0) return null;

  return (
    <div className="mb-12 space-y-4">
      <div className={cn("flex items-center justify-between px-4", isRTL ? "flex-row" : "flex-row-reverse")}>
        <span className="text-[10px] font-bold text-brand-muted font-mono uppercase tracking-widest">Live Hot Signals</span>
        <h3 className="text-sm font-black text-brand-text flex items-center gap-2 uppercase tracking-[0.2em]">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          {t.topSignals}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {signals.map((res, idx) => {
            const resConfig = SIGNAL_CONFIG[res.signal] || SIGNAL_CONFIG[SignalType.NEUTRAL];
            const ResIcon = resConfig.icon;
            const isBuy = res.signal.includes('buy');
            const isSell = res.signal.includes('sell');
            const signalColor = isBuy ? '#10B981' : isSell ? '#EF4444' : '#94A3B8';

            return (
              <motion.div
                key={res.symbol}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="group relative"
              >
                <div 
                  className="relative overflow-hidden h-[50px] rounded-xl border border-brand-text/10 bg-brand-alt/40 backdrop-blur-md transition-all cursor-pointer hover:border-primary/30 flex items-center px-3 gap-2"
                  onClick={() => onSelect(res)}
                >
                  {/* Rank (Hot Badge) */}
                  <div className="w-6 h-6 shrink-0 rounded-md bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black">
                    <Zap size={12} className="fill-primary" />
                  </div>

                  {/* Symbol */}
                  <span className="text-sm font-black text-brand-text tracking-tighter italic shrink-0 w-16 truncate">{res.symbol}</span>

                  {/* Signal Badge */}
                  <div className={cn("px-2 py-1 rounded-md flex items-center gap-1.5 shrink-0", resConfig.bg)}>
                     <ResIcon size={12} style={{ color: signalColor }} />
                     <span className="text-[9px] font-black uppercase" style={{ color: signalColor }}>
                       {t[res.signal as keyof typeof t]}
                     </span>
                  </div>

                  {/* Confidence % */}
                  <div className="flex-grow text-right">
                    <span className="text-[11px] font-black tabular-nums" style={{ color: signalColor }}>{res.confidence}%</span>
                  </div>

                  {/* Manual Delete Button */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRemove(res.symbol); }}
                    className="p-1 hover:bg-red-500/20 rounded-md text-brand-muted hover:text-red-500 transition-colors shrink-0"
                    title={t.delete}
                  >
                     <X size={14} />
                  </button>

                  {/* Integrated Bottom Confidence Bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-bg/40">
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
        </AnimatePresence>
      </div>
    </div>
  );
}
