import React, { useState, useRef, useCallback } from 'react';
import { AnalysisResult, SignalType, StrategySettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, ShieldAlert, MessageSquare, BarChart2, ChevronDown, Info, ArrowLeft } from 'lucide-react';
import TradingViewEmbed from './TradingViewEmbed';
import { cn } from '../lib/utils';
import { Language, translations } from '../lib/i18n';
import { playClick, initAudio } from '../lib/audioEngine';

interface AnalysisResultViewProps {
  results: AnalysisResult[];
  lang: Language;
  settings?: StrategySettings;
  onDetail?: (result: AnalysisResult) => void;
}

const SIGNAL_CONFIG: Record<SignalType, { labelKey: keyof typeof translations.en, color: string, bg: string, border: string, icon: any, labelAr: string, labelEn: string, symbolColor: string }> = {
    [SignalType.STRONG_BUY]: { labelKey: "strong_buy" as any, color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/40", icon: null, labelAr: "إشارة شراء قوي", labelEn: "Strong Buy Signal", symbolColor: '#00ff88' },
    [SignalType.BUY]: { labelKey: "buy" as any, color: "text-emerald-400/80", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: null, labelAr: "إشارة شراء", labelEn: "Buy Signal", symbolColor: '#66ffaa' },
    [SignalType.NEUTRAL]: { labelKey: "neutral" as any, color: "text-slate-400", bg: "bg-slate-500/20", border: "border-slate-500/20", icon: null, labelAr: "محايد", labelEn: "Neutral", symbolColor: '#ffffff' },
    [SignalType.SELL]: { labelKey: "sell" as any, color: "text-red-400/80", bg: "bg-red-500/10", border: "border-red-500/20", icon: null, labelAr: "إشارة بيع", labelEn: "Sell Signal", symbolColor: '#ff5555' },
    [SignalType.STRONG_SELL]: { labelKey: "strong_sell" as any, color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/40", icon: null, labelAr: "إشارة بيع قوي", labelEn: "Strong Sell Signal", symbolColor: '#ff4444' },
    [SignalType.NO_ENTRY]: { labelKey: "no_entry" as any, color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/10", icon: null, labelAr: "لا توجد فرصة", labelEn: "No Entry", symbolColor: '#ffffff' },
};

export default function AnalysisResultView({ results, lang, settings, onDetail }: AnalysisResultViewProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';
  const [selectedIndex, setSelectedIndex] = useState(0);
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
          <TradingViewEmbed symbol={selectedResult.symbol} interval="60" />
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

      {/* 3. Compact Opportunity Cards | MOBILE: 2 per row rectangle, DESKTOP: unchanged (1→2→3 via sm/lg) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-2 items-start px-1 md:px-2 lg:px-0">
        {sortedResults.map((res, idx) => {
          const meta = SIGNAL_CONFIG[res.signal] || SIGNAL_CONFIG[SignalType.NEUTRAL];
          const isJPY = res.symbol.includes('JPY');
          const decimals = isJPY ? 3 : 5;
          const tp = res.takeProfit || 0;
          const sl = res.stopLoss || 0;

          return (
            <motion.div
              key={res.symbol + idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              style={{ alignSelf: 'start', backgroundColor: 'rgba(var(--card-bg),0.88)', minHeight: 'auto' }}
              className="signal-card rounded-xl border-2 border-amber-600/40 transition-all overflow-hidden"
            >
              {/* Card content - same as TopSignals | MOBILE: rectangle expanded, 2 per row, all text visible wrapped */}
              <button
                onClick={() => { setSelectedIndex(idx); handleClick(); }}
                className="w-full px-2 md:px-3 py-3 md:py-1.5 flex flex-col items-center gap-1.5 md:gap-1 min-h-[128px] md:min-h-0 justify-center"
              >
                <div className="flex items-center justify-center w-full gap-1 md:gap-2 flex-wrap">
                  <span className="text-[11px] md:text-sm font-black font-mono whitespace-nowrap" style={{color:'#00ff88'}}>{tp ? tp.toFixed(decimals) : '—'}</span>
                  <span className="text-[14px] md:text-lg lg:text-xl font-black italic flex-shrink-0 text-center whitespace-nowrap" style={{ color: meta.symbolColor }}>{res.symbol}</span>
                  <span className="text-[11px] md:text-sm font-black font-mono whitespace-nowrap" style={{color:'#ff4444'}}>{sl ? sl.toFixed(decimals) : '—'}</span>
                </div>
                <span className="text-[13px] md:text-base font-black text-center leading-tight px-1 whitespace-normal break-words" style={{color: meta.symbolColor}}>{isAr ? meta.labelAr : meta.labelEn}</span>
                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap justify-center">
                  <span className="text-xl md:text-3xl font-black font-mono whitespace-nowrap" style={{color:'#ffffff'}}>{res.confidence}%</span>
                  <span className="text-[10px] md:text-xs font-bold whitespace-nowrap" style={{color:'rgba(255,255,255,0.85)'}}>{formatPublishDate(res.timestamp)}</span>
                </div>
              </button>

              {/* Yellow Analysis Reasons button */}
              {res.detailedReasons && res.detailedReasons.length > 0 && onDetail && (
                <button
                  onClick={() => onDetail(res)}
                  className="w-full py-2 bg-[#F59E0B] hover:bg-[#d97706] transition-all text-black font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <span>{isAr ? 'اسباب التحليل' : 'Analysis Reasons'}</span>
                  <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{res.detailedReasons.length}</span>
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
