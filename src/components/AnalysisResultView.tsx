import React, { useState, useRef, useCallback } from 'react';
import { AnalysisResult, SignalType, StrategySettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, ShieldAlert, MessageSquare, BarChart2, ChevronDown, Info, ArrowLeft } from 'lucide-react';
import TradingViewEmbed from './TradingViewEmbed';
import { cn } from '../lib/utils';
import { Language, translations } from '../lib/i18n';
import { playClick, initAudio } from '../lib/audioEngine';
import { lt, ltp, pick, pkick, loc } from '../lib/i18nUI';

interface AnalysisResultViewProps {
  results: AnalysisResult[];
  lang: Language;
  settings?: StrategySettings;
  onDetail?: (result: AnalysisResult) => void;
  onTrade?: (symbol: string) => void;
}

const SIGNAL_CONFIG: Record<SignalType, { labelKey: keyof typeof translations.en, color: string, bg: string, border: string, icon: any, labelAr: string, labelEn: string, labelEs: string, labelRu: string, labelFr: string, symbolColor: string }> = {
    [SignalType.STRONG_BUY]: { labelKey: "strong_buy" as any, color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/40", icon: null, labelEn: "Strong Buy Signal", labelAr: "إشارة شراء قوي", labelEs: "Compra Fuerte", labelRu: "Сильная покупка", labelFr: "Achat fort", symbolColor: '#00ff88' },
    [SignalType.BUY]: { labelKey: "buy" as any, color: "text-emerald-400/80", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: null, labelEn: "Buy Signal", labelAr: "إشارة شراء", labelEs: "Compra", labelRu: "Покупка", labelFr: "Achat", symbolColor: '#66ffaa' },
    [SignalType.NEUTRAL]: { labelKey: "neutral" as any, color: "text-slate-400", bg: "bg-slate-500/20", border: "border-slate-500/20", icon: null, labelEn: "Neutral", labelAr: "محايد", labelEs: "Neutral", labelRu: "Нейтрально", labelFr: "Neutre", symbolColor: '#ffffff' },
    [SignalType.SELL]: { labelKey: "sell" as any, color: "text-red-400/80", bg: "bg-red-500/10", border: "border-red-500/20", icon: null, labelEn: "Sell Signal", labelAr: "إشارة بيع", labelEs: "Venta", labelRu: "Продажа", labelFr: "Vente", symbolColor: '#ff5555' },
    [SignalType.STRONG_SELL]: { labelKey: "strong_sell" as any, color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/40", icon: null, labelEn: "Strong Sell Signal", labelAr: "إشارة بيع قوي", labelEs: "Venta Fuerte", labelRu: "Сильная продажа", labelFr: "Vente forte", symbolColor: '#ff4444' },
    [SignalType.NO_ENTRY]: { labelKey: "no_entry" as any, color: "text-slate-500", bg: "bg-slate-500/10", border: "border-slate-500/10", icon: null, labelEn: "No Entry", labelAr: "لا توجد فرصة", labelEs: "Sin Entrada", labelRu: "Нет входа", labelFr: "Pas d'entrée", symbolColor: '#ffffff' },
};

export default function AnalysisResultView({ results, lang, settings, onDetail, onTrade }: AnalysisResultViewProps) {
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
    try { const d = new Date(timestamp); return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`; }
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
            {lt(lang, 355)}
          </h3>
          <p className="text-brand-muted text-sm max-w-lg">
            {lt(lang, 177)}
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

      {/* 3. Compact Opportunity Cards | MOBILE: 1 full-width rectangle per row (all info visible), DESKTOP: unchanged (2 via sm, 3 via lg) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-2 items-start px-1 md:px-2 lg:px-0">
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
              style={{ alignSelf: 'start', backgroundColor: 'rgba(var(--card-bg),0.92)', minHeight: 'auto' }}
              className="signal-card rounded-2xl border-2 border-amber-500/50 transition-all overflow-hidden shadow-lg"
            >
              {/* Card content - same as TopSignals | MOBILE: rectangle expanded, full width, all text visible */}
              <button
                onClick={() => { setSelectedIndex(idx); handleClick(); }}
                className="w-full px-5 py-4 md:py-3 flex flex-col items-center gap-2 min-h-[128px] md:min-h-0 justify-center"
              >
                <div className="flex items-center justify-center w-full gap-3 flex-wrap">
                  <span className="text-lg md:text-sm font-black font-mono whitespace-nowrap" style={{color:'#00ff88'}}>{tp ? tp.toFixed(decimals) : '—'}</span>
                  <span className="text-3xl md:text-xl font-black italic flex-shrink-0 text-center whitespace-nowrap" style={{ color: meta.symbolColor }}>{res.symbol}</span>
                  <span className="text-lg md:text-sm font-black font-mono whitespace-nowrap" style={{color:'#ff4444'}}>{sl ? sl.toFixed(decimals) : '—'}</span>
                </div>
                <span className="text-xl md:text-base font-black text-center leading-tight px-1 whitespace-normal break-words" style={{color: meta.symbolColor}}>{pkick(lang, meta, 'label')}</span>
                <div className="flex items-center gap-3 flex-wrap justify-center">
                  <span className="text-3xl md:text-3xl font-black font-mono whitespace-nowrap" style={{color:'#ffffff'}}>{res.confidence}%</span>
                  <span className="text-xs md:text-xs font-bold whitespace-nowrap" style={{color:'rgba(255,255,255,0.85)'}}>{formatPublishDate(res.timestamp)}</span>
                </div>
              </button>

              {/* Yellow Analysis Reasons button */}
              {res.detailedReasons && res.detailedReasons.length > 0 && onDetail && (
                <button
                  onClick={() => onDetail(res)}
                  className="w-full py-2 bg-[#F59E0B] hover:bg-[#d97706] transition-all text-black font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <span>{lt(lang, 81)}</span>
                  <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-[9px]">{res.detailedReasons.length}</span>
                </button>
              )}

              {/* Trade button */}
              {onTrade && (
                <button
                  onClick={(e) => { e.stopPropagation(); onTrade(res.symbol); }}
                  className="w-full py-2 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/40 border-t border-[#F59E0B]/30 transition-all flex items-center justify-center gap-2"
                  title={ltp(lang, 648, res.symbol)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 17l6-6 4 4 8-8" />
                    <path d="M17 7h4v4" />
                  </svg>
                  <span className="text-[11px] font-black text-[#F59E0B] uppercase tracking-wider">{lt(lang, 573)}</span>
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
