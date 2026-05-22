import React from 'react';
import { AnalysisResult, SignalType } from '../types';
import { analyzePortfolio, PortfolioAnalysis, ClusterWarning } from '../services/portfolioRiskService';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, TrendingUp, TrendingDown, BarChart3, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';
import { Language, translations } from '../lib/i18n';

interface PortfolioPanelProps {
  signals: AnalysisResult[];
  lang: Language;
}

const WARNING_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  low: { bg: 'bg-yellow-500/5', border: 'border-yellow-500/20', text: 'text-yellow-500' },
  medium: { bg: 'bg-orange-500/5', border: 'border-orange-500/20', text: 'text-orange-500' },
  high: { bg: 'bg-red-500/5', border: 'border-red-500/20', text: 'text-red-500' },
};

const WARNING_ICONS: Record<string, any> = {
  cluster_overlap: BarChart3,
  inverse_conflict: ShieldAlert,
  cluster_hedge: TrendingDown,
  same_symbol: AlertTriangle,
};

export default function PortfolioPanel({ signals, lang }: PortfolioPanelProps) {
  const [expanded, setExpanded] = React.useState(true);
  const t = translations[lang];
  const isRTL = lang === 'ar';

  if (signals.length < 2) return null;

  const analysis: PortfolioAnalysis = analyzePortfolio(signals);
  if (analysis.warnings.length === 0) return null;

  return (
    <div className="mb-12">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 transition-all"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-500" />
          <span className="text-sm font-black text-red-500 uppercase tracking-wider">
            {isRTL ? 'تحذير المخاطر' : 'Risk Warnings'} ({analysis.warnings.length})
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-black">
          <span className="text-emerald-500">{analysis.totalLong} ↑</span>
          <span className="text-red-500">{analysis.totalShort} ↓</span>
          <span className={cn(
            "tabular-nums",
            analysis.netExposure > 1 ? 'text-emerald-500' : 
            analysis.netExposure < -1 ? 'text-red-500' : 'text-slate-400'
          )}>
            {isRTL ? 'صافي' : 'Net'}: {analysis.netExposure > 0 ? '+' : ''}{analysis.netExposure}
          </span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 p-3">
              {analysis.exposures.filter(e => e.long.length + e.short.length > 0).map((exp) => (
                <div key={exp.cluster} className="p-3 rounded-lg bg-brand-alt/30 border border-white/5">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-brand-muted mb-2">
                    <span>{exp.cluster}</span>
                    <span className={cn(
                      exp.net > 0 ? 'text-emerald-500' : 
                      exp.net < 0 ? 'text-red-500' : 'text-slate-400'
                    )}>
                      {isRTL ? 'محايد' : 'Net'}: {exp.net > 0 ? '+' : ''}{exp.net}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {exp.long.map(s => (
                      <span key={s.symbol} className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        {s.symbol} ↑
                      </span>
                    ))}
                    {exp.short.map(s => (
                      <span key={s.symbol} className="px-2 py-0.5 rounded text-[10px] font-black bg-red-500/10 text-red-500 border border-red-500/20">
                        {s.symbol} ↓
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {analysis.warnings.map((w, i) => {
                const Ws = WARNING_STYLES[w.severity] || WARNING_STYLES.medium;
                const WIcon = WARNING_ICONS[w.type] || AlertTriangle;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn("p-3 rounded-lg border", Ws.bg, Ws.border)}
                  >
                    <div className="flex items-start gap-2">
                      <WIcon size={14} className={cn("shrink-0 mt-0.5", Ws.text)} />
                      <div>
                        <p className={cn("text-xs font-bold leading-relaxed", Ws.text)}>
                          {isRTL ? w.messageAr : w.message}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {w.symbols.map(sym => (
                            <span key={sym} className="px-1.5 py-0.5 rounded text-[9px] font-black bg-white/5 text-brand-muted border border-white/10">
                              {sym}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
