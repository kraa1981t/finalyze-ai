import React, { useState } from 'react';
import { AnalysisResult, SignalType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, Zap, ShieldAlert, ChevronDown, ChevronUp, X, BarChart2, Info, Activity } from 'lucide-react';
import TradingViewWidget from './TradingViewWidget';
import { Language, translations } from '../lib/i18n';

interface ClientDashboardProps {
  results: AnalysisResult[];
  lang: Language;
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; icon: any; labelAr: string; labelEn: string }> = {
  [SignalType.STRONG_BUY]: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', icon: TrendingUp, labelAr: 'شراء قوي', labelEn: 'Strong Buy' },
  [SignalType.BUY]: { color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-400/20', icon: TrendingUp, labelAr: 'شراء', labelEn: 'Buy' },
  [SignalType.STRONG_SELL]: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/40', icon: ShieldAlert, labelAr: 'بيع قوي', labelEn: 'Strong Sell' },
  [SignalType.SELL]: { color: 'text-red-300', bg: 'bg-red-500/10', border: 'border-red-400/20', icon: TrendingDown, labelAr: 'بيع', labelEn: 'Sell' },
};

function SignalCard({ result, lang, onSelect, isSelected }: { result: AnalysisResult; lang: Language; onSelect: () => void; isSelected: boolean }) {
  const t = translations[lang];
  const isAr = lang === 'ar';
  const meta = SIGNAL_META[result.signal];
  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onSelect}
      className={`w-full text-right rounded-2xl p-4 border transition-all shadow-lg hover:shadow-xl ${meta.bg} ${meta.border} ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-brand-bg' : ''}`}
      style={{ direction: isAr ? 'rtl' : 'ltr' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={18} className={meta.color} />
          <span className={`text-sm font-black ${meta.color}`}>{isAr ? meta.labelAr : meta.labelEn}</span>
        </div>
        <span className="text-xl font-black text-white">{result.symbol}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/60 font-bold">{result.type}</span>
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${result.signal.includes('buy') ? 'bg-emerald-400' : 'bg-red-400'}`} style={{ width: `${result.confidence}%` }} />
          </div>
          <span className="text-xs text-white/70 font-bold">{result.confidence}%</span>
        </div>
      </div>
    </motion.button>
  );
}

export default function ClientDashboard({ results, lang }: ClientDashboardProps) {
  const isAr = lang === 'ar';
  const t = translations[lang];
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [expandedReasons, setExpandedReasons] = useState<string | null>(null);

  const filtered = results.filter(r => r.signal !== SignalType.NO_ENTRY && r.signal !== SignalType.NEUTRAL);
  const strong = filtered.filter(r => r.signal === SignalType.STRONG_BUY || r.signal === SignalType.STRONG_SELL);
  const medium = filtered.filter(r => r.signal === SignalType.BUY || r.signal === SignalType.SELL);

  const selectedResult = results.find(r => r.symbol === selectedSymbol);

  const signalOrder = (s: string) => {
    if (s === SignalType.STRONG_BUY) return 0;
    if (s === SignalType.BUY) return 1;
    if (s === SignalType.SELL) return 2;
    if (s === SignalType.STRONG_SELL) return 3;
    return 4;
  };

  const sortedStrong = [...strong].sort((a, b) => signalOrder(a.signal) - signalOrder(b.signal) || b.confidence - a.confidence);
  const sortedMedium = [...medium].sort((a, b) => signalOrder(a.signal) - signalOrder(b.signal) || b.confidence - a.confidence);

  if (filtered.length === 0) {
    return (
      <div className="space-y-6" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        {/* Auto-analysis status banner - always show */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-3 flex items-center gap-3">
          <div className="relative">
            <Activity size={20} className="text-emerald-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          </div>
          <span className="text-sm font-black text-emerald-400">
            {isAr ? 'التحليل التلقائي نشط' : 'Auto Analysis Active'}
          </span>
          <span className="text-xs text-emerald-400/60 font-bold">
            {isAr ? 'يتم التحليل مرة واحدة يومياً' : 'Analyzing once daily'}
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
            {isAr ? 'جاري تحليل الرموز...' : 'Analyzing symbols...'}
          </h3>
          <p className="text-sm text-white/40 mt-2">
            {isAr ? 'سيظهر التحليل التلقائي هنا قريباً' : 'Auto analysis results will appear here shortly'}
          </p>
        </div>
      </div>
    );
  }

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
          {isAr ? 'يتم التحليل مرة واحدة يومياً' : 'Analyzing once daily'}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <Zap size={22} className="text-primary" />
        <h2 className="text-lg font-black text-white">
          {isAr ? 'إشارات التداول' : 'Trading Signals'}
        </h2>
        <span className="text-xs text-white/40 font-bold">({filtered.length})</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strong Signals - Right */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-emerald-400 to-red-400" />
            <h3 className="text-sm font-black text-white/80 uppercase tracking-wider">
              {isAr ? 'إشارات قوية' : 'Strong Signals'}
            </h3>
            <span className="text-xs text-white/40 font-bold">({strong.length})</span>
          </div>
          {sortedStrong.length === 0 ? (
            <div className="bg-brand-alt/50 rounded-2xl p-8 border border-white/5 text-center">
              <p className="text-xs text-white/40 font-bold">{isAr ? 'لا توجد إشارات قوية حالياً' : 'No strong signals right now'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedStrong.map(r => (
                <SignalCard
                  key={r.symbol}
                  result={r}
                  lang={lang}
                  isSelected={selectedSymbol === r.symbol}
                  onSelect={() => setSelectedSymbol(selectedSymbol === r.symbol ? null : r.symbol)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Medium Signals - Left */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-emerald-300/60 to-red-300/60" />
            <h3 className="text-sm font-black text-white/80 uppercase tracking-wider">
              {isAr ? 'إشارات متوسطة' : 'Medium Signals'}
            </h3>
            <span className="text-xs text-white/40 font-bold">({medium.length})</span>
          </div>
          {sortedMedium.length === 0 ? (
            <div className="bg-brand-alt/50 rounded-2xl p-8 border border-white/5 text-center">
              <p className="text-xs text-white/40 font-bold">{isAr ? 'لا توجد إشارات متوسطة حالياً' : 'No medium signals right now'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedMedium.map(r => (
                <SignalCard
                  key={r.symbol}
                  result={r}
                  lang={lang}
                  isSelected={selectedSymbol === r.symbol}
                  onSelect={() => setSelectedSymbol(selectedSymbol === r.symbol ? null : r.symbol)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Symbol: Chart + Reasons */}
      <AnimatePresence>
        {selectedResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-6 bg-brand-alt rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <BarChart2 size={20} className="text-primary" />
                <span className="text-base font-black text-white">{selectedResult.symbol}</span>
                {SIGNAL_META[selectedResult.signal] && (
                  <span className={`text-xs font-black px-3 py-1 rounded-full ${SIGNAL_META[selectedResult.signal].bg} ${SIGNAL_META[selectedResult.signal].color} border ${SIGNAL_META[selectedResult.signal].border}`}>
                    {isAr ? SIGNAL_META[selectedResult.signal].labelAr : SIGNAL_META[selectedResult.signal].labelEn}
                  </span>
                )}
              </div>
              <button onClick={() => setSelectedSymbol(null)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                <X size={18} className="text-white/60" />
              </button>
            </div>

            <div className="p-4">
              <div className="h-[400px] rounded-2xl overflow-hidden">
                <TradingViewWidget symbol={selectedResult.symbol} />
              </div>
            </div>

            {/* Summary */}
            {selectedResult.summary && (
              <div className="px-6 pb-4">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                  <p className="text-sm text-white/70 font-bold leading-relaxed" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
                    {selectedResult.summary}
                  </p>
                </div>
              </div>
            )}

            {/* Detailed Reasons */}
            {selectedResult.detailedReasons && selectedResult.detailedReasons.length > 0 && (
              <div className="px-6 pb-6">
                <button
                  onClick={() => setExpandedReasons(expandedReasons === selectedResult.symbol ? null : selectedResult.symbol)}
                  className="flex items-center gap-2 mb-3 text-sm font-black text-white/80 hover:text-white transition-colors"
                >
                  <Info size={16} />
                  {isAr ? 'أسباب التحليل' : 'Analysis Reasons'}
                  {expandedReasons === selectedResult.symbol ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <AnimatePresence>
                  {expandedReasons === selectedResult.symbol && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {selectedResult.detailedReasons.map((reason, i) => (
                        <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/5 flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            reason.status === 'positive' ? 'bg-emerald-400' :
                            reason.status === 'negative' ? 'bg-red-400' : 'bg-white/40'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-white/80">{reason.check}</span>
                              <span className="text-[10px] text-white/40 font-bold">{reason.value}</span>
                            </div>
                            {reason.impact && (
                              <p className="text-[11px] text-white/50 mt-0.5 font-bold" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
                                {reason.impact}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
