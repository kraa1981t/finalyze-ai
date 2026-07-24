import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AnalysisResult, SignalType, MarketType } from '../types';
import { Activity, Zap, BarChart2, Info, Lock } from 'lucide-react';
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

const SIGNAL_META: Record<string, { color: string; bg: string; border: string; labelAr: string; labelEn: string; symbolColor: string }> = {
  [SignalType.STRONG_BUY]: { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', labelAr: 'إشارة شراء قوي', labelEn: 'Strong Buy Signal', symbolColor: '#00ff88' },
  [SignalType.STRONG_SELL]: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/40', labelAr: 'إشارة بيع قوي', labelEn: 'Strong Sell Signal', symbolColor: '#ff4444' },
  [SignalType.BUY]: { color: 'text-emerald-400/80', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', labelAr: 'إشارة شراء', labelEn: 'Buy Signal', symbolColor: '#66ffaa' },
  [SignalType.SELL]: { color: 'text-red-400/80', bg: 'bg-red-500/10', border: 'border-red-500/20', labelAr: 'إشارة بيع', labelEn: 'Sell Signal', symbolColor: '#ff5555' },
};

const CATEGORY_CONFIG: Record<string, { emoji: string; labelAr: string; labelEn: string; color: string; borderColor: string }> = {
  forex: { emoji: '\uD83D\uDCB1', labelAr: 'الفوركس', labelEn: 'Forex', color: 'text-blue-400', borderColor: 'border-blue-500/30' },
  crypto: { emoji: '\uD83E\uDDF1', labelAr: 'الكريبتو', labelEn: 'Crypto', color: 'text-purple-400', borderColor: 'border-purple-500/30' },
  stocks: { emoji: '\uD83D\uDCC8', labelAr: 'الأسهم', labelEn: 'Stocks', color: 'text-yellow-400', borderColor: 'border-yellow-500/30' },
  metals: { emoji: '\uD83D\uDC8E', labelAr: 'المعادن', labelEn: 'Metals', color: 'text-orange-400', borderColor: 'border-orange-500/30' },
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
    const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = isAr ? daysAr[date.getDay()] : daysEn[date.getDay()];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${dayName} ${hours}:${minutes}`;
  } catch {
    return timestamp;
  }
};

export default function ClientDashboard({ results, lang, hasActivePlan = false }: ClientDashboardProps) {
  const isAr = lang === 'ar';
  const t = translations[lang];
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [symbolExplicitlySelected, setSymbolExplicitlySelected] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());
  const audioInitRef = useRef(false);

  const handleClick = useCallback(() => {
    if (!audioInitRef.current) { initAudio(); audioInitRef.current = true; }
    playClick();
  }, []);

  const now = Date.now();
  const getHoldPeriods = (tf: string) => {
    switch (tf) {
      case '1d': return { maxAge: 72 * 3600 * 1000 };
      case '4h': return { maxAge: 12 * 3600 * 1000 };
      case '1h': return { maxAge: 3 * 3600 * 1000 };
      case '15m': return { maxAge: 60 * 60 * 1000 };
      case '5m': return { maxAge: 30 * 60 * 1000 };
      default: return { maxAge: 12 * 3600 * 1000 };
    }
  };
  const activeResults = results.filter(r => {
    if (r.signal === 'neutral' || r.signal === 'no_entry') return false;
    const { maxAge } = getHoldPeriods(r.timeframe);
    return (now - new Date(r.timestamp).getTime()) < maxAge;
  });

  const grouped: Record<string, AnalysisResult[]> = { forex: [], crypto: [], stocks: [], metals: [] };
  for (const s of activeResults) {
    const cat = getSymbolCategory(s.symbol);
    if (grouped[cat]) grouped[cat].push(s);
    else grouped.forex.push(s);
  }
  const catOrder = ['forex', 'crypto', 'stocks', 'metals'] as const;
  const activeCategories = catOrder.filter(cat => grouped[cat].length > 0);

  const allFiltered = activeCategories.flatMap(cat => grouped[cat]);
  const activeResult = selectedSymbol ? allFiltered.find(r => r.symbol === selectedSymbol) : null;
  const activeSymbol = symbolExplicitlySelected && activeResult ? activeResult.symbol : null;

  if (allFiltered.length === 0) {
    return (
      <div className="space-y-6" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-3 flex items-center gap-3">
          <div className="relative">
            <Activity size={20} className="text-emerald-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          </div>
          <span className="text-sm font-black text-emerald-400">{isAr ? 'التحليل التلقائي نشط' : 'Auto Analysis Active'}</span>
          <span className="text-xs text-emerald-400/60 font-bold">{isAr ? 'يتم تحليل الفرض في الوقت الفعلي من المطور' : 'Opportunities synchronized in real-time from developer'}</span>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 border-b-2 border-emerald-400 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center"><Activity size={24} className="text-emerald-400" /></div>
          </div>
          <h3 className="text-xl font-black text-white/60">{isAr ? 'في انتظار نشر فرض جديدة...' : 'Waiting for new opportunities...'}</h3>
          <p className="text-sm text-white/40 mt-2">{isAr ? 'ستظهر الفرص القوية والعادية بمجرد نشرها من المطور' : 'Strong and regular opportunities will appear once published by developer'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
      <style>{`.signal-card .text-emerald-400{color:#059669!important}.signal-card .text-red-400{color:#dc2626!important}`}</style>
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-3 flex items-center gap-3">
        <div className="relative">
          <Activity size={20} className="text-emerald-400" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        </div>
        <span className="text-sm font-black text-emerald-400">{isAr ? 'التحليل التلقائي نشط' : 'Auto Analysis Active'}</span>
        <span className="text-xs text-emerald-400/60 font-bold">{isAr ? 'يتم مزامنة الفرص تلقائياً' : 'Opportunities synchronized in real-time'}</span>
      </div>

      {/* Signal Cards grouped by category */}
      <div className="space-y-4">
        {activeCategories.map(cat => {
          const catSignals = grouped[cat];
          const cfg = CATEGORY_CONFIG[cat];
          const strong = catSignals.filter(s => s.signal === SignalType.STRONG_BUY || s.signal === SignalType.STRONG_SELL);
          const regular = catSignals.filter(s => s.signal === SignalType.BUY || s.signal === SignalType.SELL);
          const top3 = regular.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
          const displaySignals = [...strong, ...top3];
          return (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="text-base">{cfg.emoji}</span>
                <span className={`text-sm font-black ${cfg.color}`}>{isAr ? cfg.labelAr : cfg.labelEn}</span>
                <span className="text-xs text-white/40 font-bold">({displaySignals.length})</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {displaySignals.map((res, idx) => (
                  <ClientSignalCard key={`all_${res.symbol}_${idx}`} res={res} isAr={isAr} lang={lang} selectedSymbol={selectedSymbol} expandedCard={expandedCard} expandedReasons={expandedReasons} onExpandCard={setExpandedCard} onExpandReasons={setExpandedReasons} onSelect={(sym) => { if (selectedSymbol === sym) { setSelectedSymbol(null); setSymbolExplicitlySelected(false); } else { setSelectedSymbol(sym); setSymbolExplicitlySelected(true); } handleClick(); }} hasActivePlan={hasActivePlan} formatPublishDate={formatPublishDate} cardKey={`all_${res.symbol}_${idx}`} onClick={handleClick} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart - only shown when symbol is selected */}
      {activeSymbol && (
        <div className="bg-brand-alt rounded-3xl border border-white/10 overflow-hidden shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={18} className="text-primary" />
            <span className="text-base font-black text-white italic tracking-wider">{activeSymbol}</span>
            {activeResult && SIGNAL_META[activeResult.signal] && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${SIGNAL_META[activeResult.signal].bg} ${SIGNAL_META[activeResult.signal].color} border ${SIGNAL_META[activeResult.signal].border}`}>
                {isAr ? SIGNAL_META[activeResult.signal].labelAr : SIGNAL_META[activeResult.signal].labelEn}
              </span>
            )}
          </div>
          <div className="h-[350px] md:h-[500px] rounded-2xl overflow-hidden relative">
            <TradingViewWidget symbol={activeSymbol} />
          </div>
        </div>
      )}
    </div>
  );
}

function ClientSignalCard({ res, isAr, lang, selectedSymbol, expandedCard, expandedReasons, onExpandCard, onExpandReasons, onSelect, hasActivePlan, formatPublishDate, cardKey, onClick }: {
  res: AnalysisResult; isAr: boolean; lang: Language; selectedSymbol: string | null;
  expandedCard: string | null; expandedReasons: Set<string>;
  onExpandCard: (v: string | null) => void; onExpandReasons: (v: Set<string>) => void;
  onSelect: (sym: string) => void; hasActivePlan: boolean;
  formatPublishDate: (ts: string, lang: string) => string; cardKey: string;
  onClick?: () => void;
}) {
  const meta = SIGNAL_META[res.signal] || SIGNAL_META[SignalType.BUY];
  const isSelected = selectedSymbol === res.symbol;
  const isExpanded = expandedCard === cardKey;
  const cardRef = useRef<HTMLDivElement>(null);
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
    if (age < 10) return { label: isAr ? 'طفل' : 'Infant', color: 'text-red-300 bg-red-500/20 border-red-500/30' };
    if (age < 25) return { label: isAr ? 'شاب' : 'Youth', color: 'text-yellow-300 bg-yellow-500/20 border-yellow-500/30' };
    if (age <= 75) return { label: isAr ? 'ناضج' : 'Mature', color: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/30' };
    return { label: isAr ? 'شيخ' : 'Old', color: 'text-orange-300 bg-orange-500/20 border-orange-500/30' };
  };
  const ageBadge = getAgeBadge();

  const renderReason = (reason: any, i: number) => (
    <div key={i} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)'}} className="rounded-lg p-3" title={reason.impact || ''}>
      <div className="flex items-center gap-2.5">
        <div className={`w-4 h-4 rounded-full shrink-0 ${reason.status === 'positive' ? 'bg-emerald-400' : reason.status === 'negative' ? 'bg-red-400' : 'bg-white/70'}`} />
        <span style={{color: reason.status === 'positive' ? '#00ff88' : reason.status === 'negative' ? '#ff4444' : '#ffffff'}} className="font-bold text-base sm:text-lg shrink-0">{reason.check}</span>
        <span style={{color: reason.status === 'positive' ? '#00ff88' : reason.status === 'negative' ? '#ff4444' : '#ffffff'}} className="font-mono text-sm sm:text-base break-all font-bold">{reason.value}</span>
      </div>
      {reason.dates && <div style={{color: reason.status === 'positive' ? '#00ff88' : reason.status === 'negative' ? '#ff4444' : '#ffffff',opacity:0.8}} className="ml-6 mt-2 text-sm font-mono whitespace-pre-line">{reason.dates}</div>}
      {reason.impact && <p style={{color: reason.status === 'positive' ? '#00ff88' : reason.status === 'negative' ? '#ff4444' : '#ffffff',opacity:0.7}} className="text-sm mt-2 ml-6 leading-relaxed">{reason.impact}</p>}
    </div>
  );

  const isReasonsExpanded = expandedReasons.has(cardKey);

  useEffect(() => {
    if (isExpanded && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [isExpanded]);

  return (
    <div ref={cardRef} data-card={cardKey} style={{ alignSelf: 'start', backgroundColor: 'rgba(var(--card-bg),0.88)' }} className="signal-card rounded-xl border-2 border-amber-600/40 transition-all overflow-hidden">
      <button onClick={() => { onSelect(res.symbol); onClick?.(); }} className="w-full px-3 py-1.5 flex flex-col items-center gap-1">
        <div className="flex items-center justify-center w-full gap-2 overflow-hidden">
          <span className="text-sm sm:text-base font-black font-mono" style={{color:'#00ff88'}}>{tp ? tp.toFixed(decimals) : '\u2014'}</span>
          <span className="text-lg sm:text-xl font-black italic flex-shrink-0 text-center" style={{ color: meta.symbolColor }}>{res.symbol}</span>
          <span className="text-sm sm:text-base font-black font-mono" style={{color:'#ff4444'}}>{sl ? sl.toFixed(decimals) : '\u2014'}</span>
        </div>
        <span className="text-base sm:text-lg font-black" style={{color: meta.symbolColor}}>{isAr ? meta.labelAr : meta.labelEn}</span>
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-3xl font-black font-mono" style={{color:'#ffffff'}}>{res.confidence}%</span>
          <div className="flex items-center gap-0.5">
            <span className="text-[10px] sm:text-xs font-bold" style={{color:'rgba(255,255,255,0.85)'}}>{formatPublishDate(res.timestamp, lang)}</span>
          </div>
        </div>
      </button>

      <button onClick={(e) => { e.stopPropagation(); onExpandCard(isExpanded ? null : cardKey); }} className="w-full flex items-center justify-center py-1 text-white/40 hover:text-white/70 transition-colors">
        <span className="text-xs">{isExpanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-white/10" style={{ maxHeight: '350px', overflowY: 'auto' }}>
          <div className="px-3 py-2 space-y-2">
            {res.signal !== 'neutral' && res.signal !== 'no_entry' && (
              <LotSizeCalculator symbol={res.symbol} stopLoss={sl} takeProfit={tp} entryPrice={entry} signal={res.signal as any} lang={(isAr ? 'ar' : 'en') as 'ar' | 'en'} />
            )}

            {res.summary && <div className="bg-white/10 rounded-lg p-2.5 border border-white/10 text-sm text-white/80 leading-relaxed"><p className="font-bold">{res.summary}</p></div>}

            {res.detailedReasons && res.detailedReasons.length > 0 && (
              <div className="space-y-2">
                <button onClick={(e) => { e.stopPropagation(); onClick?.(); const newSet = new Set(expandedReasons); if (isReasonsExpanded) newSet.delete(cardKey); else newSet.add(cardKey); onExpandReasons(newSet); }} className="w-full flex items-center justify-between text-sm font-bold text-white hover:text-white/80 transition-colors py-1">
                  <div className="flex items-center gap-1.5">
                    <Info size={14} />
                    <span>{isAr ? 'الشروط التقييمية' : 'Conditions'} ({res.detailedReasons.length})</span>
                  </div>
                  <span className="text-xs">{isReasonsExpanded ? '\u25B2' : '\u25BC'}</span>
                </button>

                {isReasonsExpanded && (
                  <div className="space-y-1.5 pt-1">
                    {primaryReasons.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                            <span className="text-base font-black text-white uppercase tracking-wider">{isAr ? 'الشروط الأساسية' : 'PRIMARY CONDITIONS'}</span>
                            <span className="text-sm font-bold text-white/60 bg-white/10 px-2 py-0.5 rounded-full">{primaryReasons.length}</span>
                          </div>
                          {ageBadge && <span className={`text-sm font-black px-3 py-1 rounded-full border ${ageBadge.color}`}>{ageBadge.label} ({res.trendAge}c)</span>}
                        </div>
                        <div className="space-y-1.5">{primaryReasons.map(renderReason)}</div>
                      </div>
                    )}
                    {supportingReasons.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-300" />
                          <span className="text-base font-black text-white uppercase tracking-wider">{isAr ? 'الشروط الداعمة' : 'SUPPORTING CONDITIONS'}</span>
                          <span className="text-sm font-bold text-white/60 bg-white/10 px-2 py-0.5 rounded-full">{supportingReasons.length}</span>
                        </div>
                        <div className="space-y-1.5">{supportingReasons.map(renderReason)}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
