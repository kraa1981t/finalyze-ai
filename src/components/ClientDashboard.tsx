import React, { useState, useRef, useCallback } from 'react';
import { AnalysisResult, SignalType, MarketType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Zap, BarChart2, Info, Lock, MessageSquare } from 'lucide-react';
import TradingViewWidget from './TradingViewWidget';
import LotSizeCalculator from './LotSizeCalculator';
import { Language, translations } from '../lib/i18n';
import { playClick, initAudio } from '../lib/audioEngine';
import { SYMBOL_CATEGORIES } from '../constants';

interface ClientDashboardProps {
  results: AnalysisResult[];
  lang: Language;
  hasActivePlan?: boolean;
}

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; labelAr: string; labelEn: string }> = {
  [SignalType.STRONG_BUY]: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', labelAr: '\u0634\u0631\u0627\u0621 \u0642\u0648\u064A', labelEn: 'Strong Buy' },
  [SignalType.STRONG_SELL]: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/40', labelAr: '\u0628\u064A\u0639 \u0642\u0648\u064A', labelEn: 'Strong Sell' },
  [SignalType.BUY]: { color: 'text-emerald-400/80', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', labelAr: '\u0634\u0631\u0627\u0621', labelEn: 'Buy' },
  [SignalType.SELL]: { color: 'text-red-400/80', bg: 'bg-red-500/10', border: 'border-red-500/20', labelAr: '\u0628\u064A\u0639', labelEn: 'Sell' },
};

const CATEGORY_CONFIG: Record<string, { emoji: string; labelAr: string; labelEn: string; color: string; borderColor: string }> = {
  forex: { emoji: '\uD83D\uDCB1', labelAr: '\u0627\u0644\u0641\u0648\u0631\u0643\u0633', labelEn: 'Forex', color: 'text-blue-400', borderColor: 'border-blue-500/30' },
  crypto: { emoji: '\uD83E\uDDF1', labelAr: '\u0627\u0644\u0643\u0631\u064A\u0628\u062A\u0648', labelEn: 'Crypto', color: 'text-purple-400', borderColor: 'border-purple-500/30' },
  stocks: { emoji: '\uD83D\uDCC8', labelAr: '\u0627\u0644\u0623\u0633\u0647\u0645', labelEn: 'Stocks', color: 'text-yellow-400', borderColor: 'border-yellow-500/30' },
  metals: { emoji: '\uD83D\uDC8E', labelAr: '\u0627\u0644\u0645\u0639\u0627\u062F\u0646', labelEn: 'Metals', color: 'text-orange-400', borderColor: 'border-orange-500/30' },
};

function getSymbolCategory(symbol: string): string {
  const sym = symbol.toUpperCase().replace(/[-_=]/g, '');
  for (const [cat, syms] of Object.entries(SYMBOL_CATEGORIES)) {
    if ((syms as string[]).includes(sym)) return cat;
  }
  if (sym.endsWith('USD') && !sym.startsWith('USD') && sym.length > 6) return 'crypto';
  return 'forex';
}

const formatPublishDate = (timestamp: string, lang: string) => {
  try {
    const date = new Date(timestamp);
    const isAr = lang === 'ar';
    const daysAr = ['\u0627\u0644\u0623\u062D\u062F', '\u0627\u0644\u0625\u062B\u0646\u064A\u0646', '\u0627\u0644\u062B\u0644\u0627\u062B\u0627\u0621', '\u0627\u0644\u0623\u0631\u0628\u0639\u0627\u0621', '\u0627\u0644\u062E\u0645\u064A\u0633', '\u0627\u0644\u062C\u0645\u0639\u0629', '\u0627\u0644\u0633\u0628\u062A'];
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = isAr ? daysAr[date.getDay()] : daysEn[date.getDay()];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return isAr ? `${dayName} \u0627\u0644\u0633\u0627\u0639\u0629 ${hours}:${minutes}` : `${dayName} at ${hours}:${minutes}`;
  } catch {
    return timestamp;
  }
};

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function ClientDashboard({ results, lang, hasActivePlan = false }: ClientDashboardProps) {
  const isAr = lang === 'ar';
  const t = translations[lang];
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());
  const audioInitRef = useRef(false);

  const handleClick = useCallback(() => {
    if (!audioInitRef.current) { initAudio(); audioInitRef.current = true; }
    playClick();
  }, []);

  const maxAgeInMs = 20 * 60 * 60 * 1000;
  const now = Date.now();
  const activeResults = results.filter(r => 
    (now - new Date(r.timestamp).getTime()) < maxAgeInMs &&
    r.signal !== 'neutral' && r.signal !== 'no_entry'
  );

  const grouped: Record<string, AnalysisResult[]> = { forex: [], crypto: [], stocks: [], metals: [] };
  for (const s of activeResults) {
    const cat = (s.type as string) || getSymbolCategory(s.symbol);
    if (grouped[cat]) grouped[cat].push(s);
    else grouped.forex.push(s);
  }
  const catOrder = ['forex', 'crypto', 'stocks', 'metals'] as const;
  const activeCategories = catOrder.filter(cat => grouped[cat].length > 0);

  const allFiltered = activeCategories.flatMap(cat => grouped[cat]);
  const activeResult = allFiltered.find(r => r.symbol === selectedSymbol) || allFiltered[0];
  const activeSymbol = activeResult?.symbol || null;

  if (allFiltered.length === 0) {
    return (
      <div className="space-y-6" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-3 flex items-center gap-3">
          <div className="relative">
            <Activity size={20} className="text-emerald-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          </div>
          <span className="text-sm font-black text-emerald-400">{isAr ? '\u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0646\u0634\u0637' : 'Auto Analysis Active'}</span>
          <span className="text-xs text-emerald-400/60 font-bold">{isAr ? '\u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0641\u0631\u0635 \u0641\u064A \u0627\u0644\u0648\u0642\u062A \u0627\u0644\u0641\u0639\u0644\u064A \u0645\u0646 \u0627\u0644\u0645\u0637\u0648\u0631' : 'Opportunities synchronized in real-time from developer'}</span>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 border-b-2 border-emerald-400 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center"><Activity size={24} className="text-emerald-400" /></div>
          </div>
          <h3 className="text-xl font-black text-white/60">{isAr ? '\u0641\u064A \u0627\u0646\u062A\u0638\u0627\u0631 \u0646\u0634\u0631 \u0641\u0631\u0635 \u062C\u062F\u064A\u062F\u0629...' : 'Waiting for new opportunities...'}</h3>
          <p className="text-sm text-white/40 mt-2">{isAr ? '\u0633\u062A\u0638\u0647\u0631 \u0627\u0644\u0641\u0631\u0635 \u0627\u0644\u0642\u0648\u064A\u0629 \u0648\u0627\u0644\u0639\u0627\u062F\u064A\u0629 \u0628\u0645\u062C\u0631\u062F \u0646\u0634\u0631\u0647\u0627 \u0645\u0646 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0637\u0648\u0631' : 'Strong and regular opportunities will appear once published by developer'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-3 flex items-center gap-3">
        <div className="relative">
          <Activity size={20} className="text-emerald-400" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        </div>
        <span className="text-sm font-black text-emerald-400">{isAr ? '\u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0646\u0634\u0637' : 'Auto Analysis Active'}</span>
        <span className="text-xs text-emerald-400/60 font-bold">{isAr ? '\u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0641\u0631\u0635 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0641\u0648\u0631 \u0635\u062F\u0648\u0631\u0647\u0627' : 'Opportunities synchronized in real-time'}</span>
      </div>

      {activeSymbol && (
        <div className="bg-brand-alt rounded-3xl border border-white/10 overflow-hidden shadow-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <BarChart2 size={20} className="text-primary" />
              <span className="text-lg font-black text-white italic tracking-wider">{activeSymbol}</span>
              {activeResult && SIGNAL_META[activeResult.signal] && (
                <span className={`text-xs font-black px-3 py-1 rounded-full ${SIGNAL_META[activeResult.signal].bg} ${SIGNAL_META[activeResult.signal].color} border ${SIGNAL_META[activeResult.signal].border}`}>
                  {isAr ? SIGNAL_META[activeResult.signal].labelAr : SIGNAL_META[activeResult.signal].labelEn}
                </span>
              )}
            </div>
            <span className="text-xs text-white/40 font-bold font-mono">{formatPublishDate(activeResult?.timestamp || '', lang)}</span>
          </div>
          <div className="h-[350px] md:h-[400px] rounded-2xl overflow-hidden relative"><TradingViewWidget symbol={activeSymbol} /></div>
        </div>
      )}

      {activeCategories.map(cat => {
        const cfg = CATEGORY_CONFIG[cat];
        const catSignals = grouped[cat];
        const strong = catSignals.filter(r => r.signal === SignalType.STRONG_BUY || r.signal === SignalType.STRONG_SELL);
        const regular = catSignals.filter(r => r.signal === SignalType.BUY || r.signal === SignalType.SELL);
        const top4 = regular.sort((a, b) => b.confidence - a.confidence).slice(0, 4);

        return (
          <div key={cat} className="space-y-3">
            <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border bg-brand-alt/60", cfg.borderColor)}>
              <span className="text-xl">{cfg.emoji}</span>
              <span className={cn("text-sm font-black uppercase tracking-widest", cfg.color)}>{isAr ? cfg.labelAr : cfg.labelEn}</span>
              <span className="text-xs text-white/30 font-bold">({catSignals.length})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 items-start px-2 sm:px-0">
              {strong.map((res, idx) => (
                <ClientSignalCard key={`strong_${res.symbol}_${idx}`} res={res} isAr={isAr} lang={lang} selectedSymbol={selectedSymbol} expandedCard={expandedCard} expandedReasons={expandedReasons} onExpandCard={setExpandedCard} onExpandReasons={setExpandedReasons} onSelect={(sym) => { setSelectedSymbol(sym); handleClick(); }} hasActivePlan={hasActivePlan} formatPublishDate={formatPublishDate} cardKey={`strong_${res.symbol}_${idx}`} />
              ))}
              {top4.map((res, idx) => (
                <ClientSignalCard key={`reg_${res.symbol}_${idx}`} res={res} isAr={isAr} lang={lang} selectedSymbol={selectedSymbol} expandedCard={expandedCard} expandedReasons={expandedReasons} onExpandCard={setExpandedCard} onExpandReasons={setExpandedReasons} onSelect={(sym) => { setSelectedSymbol(sym); handleClick(); }} hasActivePlan={hasActivePlan} formatPublishDate={formatPublishDate} cardKey={`reg_${res.symbol}_${idx}`} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ClientSignalCard({ res, isAr, lang, selectedSymbol, expandedCard, expandedReasons, onExpandCard, onExpandReasons, onSelect, hasActivePlan, formatPublishDate, cardKey }: {
  res: AnalysisResult; isAr: boolean; lang: Language; selectedSymbol: string | null;
  expandedCard: string | null; expandedReasons: Set<string>;
  onExpandCard: (v: string | null) => void; onExpandReasons: (v: Set<string>) => void;
  onSelect: (sym: string) => void; hasActivePlan: boolean;
  formatPublishDate: (ts: string, lang: string) => string; cardKey: string;
}) {
  const meta = SIGNAL_META[res.signal] || SIGNAL_META[SignalType.BUY];
  const isSelected = selectedSymbol === res.symbol || (!selectedSymbol && false);
  const isExpanded = expandedCard === cardKey;
  const isJPY = res.symbol.includes('JPY');
  const decimals = isJPY ? 3 : 5;
  const entry = res.entryPrice || 0;
  const tp = res.takeProfit || 0;
  const sl = res.stopLoss || 0;

  const PRIMARY_CHECKS = ['BB Pullback', 'Micro BB', 'Supply/Demand', 'Trend Age', 'Pre-Pullback Age', 'News', 'Economic Events'];
  const primaryReasons = res.detailedReasons?.filter((r: any) => PRIMARY_CHECKS.some(p => r.check?.includes(p))) || [];
  const supportingReasons = res.detailedReasons?.filter((r: any) => !PRIMARY_CHECKS.some(p => r.check?.includes(p))) || [];

  const getAgeBadge = () => {
    if (res.trendAge === undefined) return null;
    const age = res.trendAge;
    if (age < 10) return { label: isAr ? '\u0637\u0641\u0644' : 'Infant', color: 'text-red-400 bg-red-500/15 border-red-500/30' };
    if (age < 25) return { label: isAr ? '\u0634\u0627\u0628' : 'Youth', color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' };
    if (age <= 75) return { label: isAr ? '\u0646\u0627\u0636\u062C' : 'Mature', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' };
    return { label: isAr ? '\u0634\u064A\u062E' : 'Old', color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' };
  };
  const ageBadge = getAgeBadge();

  const renderReason = (reason: any, i: number) => (
    <div key={i} className="bg-white/[0.02] rounded-lg p-3 border border-white/5" title={reason.impact || ''}>
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full shrink-0 ${reason.status === 'positive' ? 'bg-emerald-400' : reason.status === 'negative' ? 'bg-red-400' : 'bg-slate-400'}`} />
        <span className={`font-bold text-sm shrink-0 ${reason.status === 'positive' ? 'text-emerald-400' : reason.status === 'negative' ? 'text-red-400' : 'text-slate-400'}`}>{reason.check}</span>
        <span className={`font-mono text-sm break-all ${reason.status === 'positive' ? 'text-emerald-400/60' : reason.status === 'negative' ? 'text-red-400/60' : 'text-slate-400/60'}`}>{reason.value}</span>
      </div>
      {reason.dates && <div className={`ml-5 mt-1 text-xs font-mono whitespace-pre-line ${reason.status === 'positive' ? 'text-emerald-400/50' : reason.status === 'negative' ? 'text-red-400/50' : 'text-slate-400/50'}`}>{reason.dates}</div>}
      {reason.impact && <p className={`text-xs mt-1 ml-5 leading-relaxed ${reason.status === 'positive' ? 'text-emerald-400/40' : reason.status === 'negative' ? 'text-red-400/40' : 'text-slate-400/40'}`}>{reason.impact}</p>}
    </div>
  );

  const isReasonsExpanded = expandedReasons.has(cardKey);

  return (
    <div className={`rounded-lg border transition-all ${isSelected ? 'border-white/10 bg-brand-alt/80' : 'border-white/5 bg-brand-alt/45 hover:border-white/10'}`}>
      <button onClick={() => { onSelect(res.symbol); setExpandedCard(isExpanded ? null : cardKey); }} className={`w-full px-1.5 sm:px-3 py-1.5 sm:py-3 flex flex-col items-center gap-1 sm:gap-2 rounded-t-lg transition-all ${isSelected ? 'border-b border-[#F59E0B]/30' : ''}`}>
        <div className="flex items-center gap-0.5 sm:gap-1 px-0.5">
          <div className="flex-1 bg-emerald-500/15 border border-emerald-500/30 rounded-lg sm:rounded-xl px-1.5 sm:px-3 py-1.5 sm:py-3 shrink-0 flex items-center justify-center">
            <span className="text-xs sm:text-lg font-black font-mono text-emerald-400">{tp ? tp.toFixed(decimals) : '\u2014'}</span>
          </div>
          <div className="flex items-center justify-center min-w-[36px] sm:min-w-[48px] shrink-0">
            <span className={`text-[10px] sm:text-sm font-black font-mono ${meta.color}`}>{res.symbol}</span>
          </div>
          <div className="flex-1 bg-red-500/15 border border-red-500/30 rounded-lg sm:rounded-xl px-1.5 sm:px-3 py-1.5 sm:py-3 shrink-0 flex items-center justify-center">
            <span className="text-xs sm:text-lg font-black font-mono text-red-400">{sl ? sl.toFixed(decimals) : '\u2014'}</span>
          </div>
        </div>
        <span className={`text-[10px] sm:text-xs font-black ${meta.color}`}>{isAr ? meta.labelAr : meta.labelEn}</span>
        <div className="flex items-center gap-1 sm:gap-2">
          <span className={`text-sm sm:text-lg font-black font-mono ${meta.color}`}>{res.confidence}%</span>
          <div className={`flex items-center gap-0.5 text-[8px] sm:text-[10px] font-bold ${meta.color}/40`}>
            <span>{formatPublishDate(res.timestamp, lang)}</span>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="origin-top">
            <div className="px-2 pb-1.5 space-y-1.5 border-t border-white/5 pt-1.5">
              {res.signal !== 'neutral' && res.signal !== 'no_entry' && (
                <LotSizeCalculator symbol={res.symbol} stopLoss={sl} takeProfit={tp} entryPrice={entry} signal={res.signal as any} lang={(isAr ? 'ar' : 'en') as 'ar' | 'en'} />
              )}

              {res.summary && <div className="bg-white/5 rounded p-1.5 border border-white/5 text-[10px] text-yellow-400/70 leading-relaxed"><p className="font-bold">{res.summary}</p></div>}

              {res.detailedReasons && res.detailedReasons.length > 0 && (
                <div className="space-y-2">
                  <button onClick={() => { handleClick(); const n = new Set(expandedReasons); isReasonsExpanded ? n.delete(cardKey) : n.add(cardKey); onExpandReasons(n); }} className="w-full flex items-center justify-between text-xs font-bold text-yellow-400/70 hover:text-yellow-400 transition-colors py-1">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare size={14} />
                      <span>{isAr ? '\u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u062A\u0642\u064A\u064A\u0645\u064A\u0629' : 'Conditions'} ({res.detailedReasons.length})</span>
                    </div>
                    <span className="text-xs">{isReasonsExpanded ? '\u25B2' : '\u25BC'}</span>
                  </button>

                  <AnimatePresence>
                    {isReasonsExpanded && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="overflow-hidden">
                        <div className="space-y-2 pt-1">
                          {primaryReasons.length > 0 && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                                  <span className="text-sm font-black text-amber-400 uppercase tracking-wider">{isAr ? '\u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629' : 'PRIMARY CONDITIONS'}</span>
                                  <span className="text-xs font-bold text-amber-400/50 bg-amber-500/10 px-2 py-0.5 rounded-full">{primaryReasons.length}</span>
                                </div>
                                {ageBadge && <span className={`text-xs font-black px-3 py-1 rounded-full border ${ageBadge.color}`}>{ageBadge.label} ({res.trendAge}c)</span>}
                              </div>
                              <div className="space-y-1.5">{primaryReasons.map(renderReason)}</div>
                            </div>
                          )}
                          {supportingReasons.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-400" />
                                <span className="text-sm font-black text-blue-400 uppercase tracking-wider">{isAr ? '\u0627\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u062F\u0627\u0639\u0645\u0629' : 'SUPPORTING CONDITIONS'}</span>
                                <span className="text-xs font-bold text-blue-400/50 bg-blue-500/10 px-2 py-0.5 rounded-full">{supportingReasons.length}</span>
                              </div>
                              <div className="space-y-1.5">{supportingReasons.map(renderReason)}</div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <button onClick={() => { onSelect(res.symbol); handleClick(); }} className="w-full py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider bg-[#F59E0B] text-black flex items-center justify-center gap-1">
                <BarChart2 size={12} />
                <span>{isAr ? '\u0639\u0631\u0636 \u0627\u0644\u0634\u0627\u0631\u0637' : 'View Chart'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
