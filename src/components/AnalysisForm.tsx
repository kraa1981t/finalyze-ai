import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { User } from 'firebase/auth';
import { ChevronDown, Search, ArrowRight, TrendingUp, Bitcoin, DollarSign, Gem, Briefcase, Play, ListFilter, Plus, Zap, X, Clock } from 'lucide-react';
import { MarketType, AnalysisResult, TradingStyle, StrategySettings } from '../types';
import { MARKET_CATEGORIES, TIMEFRAMES, SYMBOL_GROUPS, TRADING_STYLES, ALL_SYMBOLS_DB } from '../constants';
import { analyzeMarket } from '../services/geminiService';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Language, translations } from '../lib/i18n';

interface AnalysisFormProps {
  user: User | null;
  onBegin: () => void;
  onProgress: (current: string, total: number, index: number) => void;
  onResult: (res: AnalysisResult[]) => void;
  onError: () => void;
  lang: Language;
  settings: StrategySettings;
}

interface FormValues {
  symbol: string;
  type: MarketType;
  timeframe: string;
  tradingStyle: TradingStyle;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  DollarSign: <DollarSign size={20} />,
  Bitcoin: <Bitcoin size={20} />,
  TrendingUp: <TrendingUp size={20} />,
  Gem: <Gem size={20} />,
  Zap: <Zap size={18} />,
  Play: <Play size={18} />,
  Clock: <Clock size={18} />,
};

export default function AnalysisForm({ user, onBegin, onProgress, onResult, onError, lang, settings }: AnalysisFormProps) {
  const t = translations[lang];
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [analyzingIndex, setAnalyzingIndex] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [showAllSymbols, setShowAllSymbols] = useState(false);
  const [hiddenSymbols, setHiddenSymbols] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('finalyze_hidden_symbols');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [customSymbols, setCustomSymbols] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('finalyze_custom_symbols');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('finalyze_hidden_symbols', JSON.stringify(hiddenSymbols));
  }, [hiddenSymbols]);

  useEffect(() => {
    localStorage.setItem('finalyze_custom_symbols', JSON.stringify(customSymbols));
  }, [customSymbols]);

  const [activeDropdown, setActiveDropdown] = useState<MarketType | null>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      type: MarketType.FOREX,
      timeframe: "1d",
      tradingStyle: TradingStyle.SWING_TRADING,
      symbol: ""
    }
  });

  const selectedType = watch("type");
  const selectedTimeframe = watch("timeframe");
  const selectedStyle = watch("tradingStyle");
  const isRTL = lang === 'ar';

  // Update hidden symbol input when selections change
  useEffect(() => {
    setValue("symbol", selectedSymbols.join(", "));
  }, [selectedSymbols, setValue]);

  const toggleSymbol = (sym: string) => {
    setSelectedSymbols(prev => 
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const selectAllInCategory = () => {
    const allGroupsSymbols = SYMBOL_GROUPS[selectedType]?.flatMap(g => g.symbols) || [];
    const customForType = customSymbols.filter(s => 
      (ALL_SYMBOLS_DB[selectedType] || []).includes(s) &&
      !allGroupsSymbols.includes(s)
    );
    const all = [...allGroupsSymbols, ...customForType].filter(s => !hiddenSymbols.includes(s));
    
    const areAllSelected = all.length > 0 && all.every(s => selectedSymbols.includes(s));
    
    if (areAllSelected) {
      setSelectedSymbols(prev => prev.filter(s => !all.includes(s)));
    } else {
      setSelectedSymbols(prev => [...new Set([...prev, ...all])]);
    }
  };

  const removeSymbol = (sym: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (customSymbols.includes(sym)) {
      setCustomSymbols(prev => prev.filter(s => s !== sym));
    } else {
      setHiddenSymbols(prev => [...prev, sym]);
    }
    setSelectedSymbols(prev => prev.filter(s => s !== sym));
  };

  const isMarketOpen = (category: string) => {
    if (category === 'crypto') return true;
    const day = new Date().getDay();
    if (day === 0 || day === 6) return false;
    return true;
  };

  const clearAll = () => setSelectedSymbols([]);

  const onSubmit = async (data: FormValues) => {
    setFormError(null);
    
    // Radical Market Blocking
    if (!isMarketOpen(data.type)) {
      setFormError(lang === 'ar' ? 'عفواً.. هذه الأسواق مغلقة حالياً ولا يمكن تحليلها' : 'Sorry.. These markets are currently closed and cannot be analyzed');
      return;
    }

    console.log("[Form] Submit clicked. Symbols:", selectedSymbols, "Manual:", data.symbol);

    if (!user) {
      setFormError(t.loginRequired);
      return;
    }

    const manualSymbols = data.symbol.split(/[,\s]+/)
      .map(s => s.trim())
      .filter(s => s !== "");
    
    const allSymbolsToAnalyze = [...new Set([...selectedSymbols, ...manualSymbols])]
      .filter(s => s && s.length > 1);

    if (allSymbolsToAnalyze.length === 0) {
      setFormError(t.selectAtLeastOne);
      return;
    }

    console.log("[Form] Beginning analysis for:", allSymbolsToAnalyze);
    onBegin();
    const results: AnalysisResult[] = [];

    try {
      for (let i = 0; i < allSymbolsToAnalyze.length; i++) {
        const currentSymbol = allSymbolsToAnalyze[i];
        setAnalyzingIndex(i);
        onProgress(currentSymbol, allSymbolsToAnalyze.length, i);
        
        try {
          const result = await analyzeMarket({
            symbol: currentSymbol,
            type: data.type,
            timeframe: data.timeframe,
            tradingStyle: data.tradingStyle,
            settings: settings,
            lang: lang
          });
          
          if (!result) throw new Error("Result is null");

          result.userId = user.uid;
          results.push(result);

          // Save to Firestore background (don't block UI if it fails)
          addDoc(collection(db, "analysisResults"), {
            ...result,
            timestamp: serverTimestamp(),
          }).catch(err => console.error("History storage error:", err));

        } catch (symbolError: any) {
          console.error(`[Analysis Error] ${currentSymbol}:`, symbolError);
          const msg = symbolError.message || (lang === 'ar' ? "فشل التحليل بسبب خطأ غير معروف" : "Analysis failed due to unknown error");
          setFormError(`${currentSymbol}: ${msg}`);
          // REMOVED: alert() popup as it is annoying for the user.
        }

        // Add 4.5-second delay between requests to prevent API Rate Limiting (429 errors)
        if (i < allSymbolsToAnalyze.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 4500));
        }
      }

      setAnalyzingIndex(null);
      
      if (results.length > 0) {
        onResult(results);
      } else {
        onError();
      }
    } catch (error: any) {
      console.error("[Global Form Error]:", error);
      setAnalyzingIndex(null);
      onError();
      setFormError(error.message || "Unknown error occurred.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        
        <AnimatePresence>
          {formError && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500/10 border border-red-500/50 p-4 rounded-2xl text-red-500 text-base font-black text-center mb-4"
            >
              {formError}
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="space-y-4">
          <label className="text-base font-black text-brand-text opacity-100 uppercase tracking-widest pl-2">{t.selectMarket}</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {MARKET_CATEGORIES.map((cat) => (
              <div key={cat.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setValue("type", cat.id);
                    setActiveDropdown(activeDropdown === cat.id ? null : cat.id);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between p-4 md:p-5 rounded-[2rem] border-2 transition-all group relative overflow-hidden",
                    selectedType === cat.id 
                      ? "border-primary bg-primary/10 text-brand-text shadow-[0_0_30px_rgba(16,185,129,0.1)] scale-[1.02]" 
                      : "border-white/5 bg-brand-alt/50 text-brand-text hover:border-brand-text/20 hover:bg-brand-text/5"
                  )}
                >
                  {selectedType === cat.id && (
                    <motion.div 
                      layoutId="activeMarket"
                      className="absolute inset-0 bg-primary/5 -z-10"
                    />
                  )}
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2.5 rounded-xl transition-all", 
                      selectedType === cat.id ? "bg-primary text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]" : "bg-brand-text/5 text-brand-muted"
                    )}>
                      {ICON_MAP[cat.icon]}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-base font-black uppercase tracking-widest">{t[cat.id as keyof typeof t]}</span>
                      <span className="text-xs font-bold opacity-100 uppercase">{t.popularSymbols}</span>
                    </div>
                  </div>
                  
                  <div className={cn(
                    "p-1.5 rounded-lg transition-all",
                    activeDropdown === cat.id ? "rotate-180 bg-primary/30 text-primary" : "text-brand-muted"
                  )}>
                    <ChevronDown size={14} />
                  </div>
                </button>

                <AnimatePresence>
                  {activeDropdown === cat.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setActiveDropdown(null)} 
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full left-0 right-0 mt-4 p-6 bg-brand-bg border border-brand-text/10 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] z-50 min-w-[300px] md:min-w-[400px] max-h-[450px] overflow-y-auto custom-scrollbar"
                      >
                        <div className="flex items-center justify-between mb-4">
                           <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                             <span className="text-sm font-black text-brand-text uppercase tracking-[0.2em]">{t.popularSymbols}</span>
                           </div>
                           <span className="text-xs font-bold text-brand-muted uppercase">{t[cat.id as keyof typeof t]}</span>
                        </div>

                        {/* Dropdown Search */}
                        <div className="relative mb-6">
                           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" size={14} />
                           <input 
                             type="text"
                             placeholder={lang === 'ar' ? 'بحث عن أي رمز عالمي...' : 'Search global symbols...'}
                             value={dropdownSearch}
                             onChange={(e) => setDropdownSearch(e.target.value)}
                             className="w-full bg-brand-text/5 border border-brand-text/10 rounded-2xl py-3 pl-10 pr-4 text-sm font-bold text-brand-text placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                           />
                           {dropdownSearch && (
                             <button 
                               onClick={() => setDropdownSearch("")}
                               className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text"
                             >
                               <X size={12} />
                             </button>
                           )}
                        </div>

                        <div className="space-y-6">
                          <div className="space-y-3">
                            {dropdownSearch ? (
                              <>
                                <h6 className="text-xs font-black text-primary uppercase tracking-widest px-1">
                                  {lang === 'ar' ? 'نتائج البحث' : 'Search Results'}
                                </h6>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {(() => {
                                    const dropdownDisplayed = [
                                      ...(SYMBOL_GROUPS[cat.id]?.flatMap(g => g.symbols) || []),
                                      ...customSymbols
                                    ].filter(sym => !hiddenSymbols.includes(sym));

                                    const results = ALL_SYMBOLS_DB[cat.id]
                                      ?.filter(s => s.toLowerCase().includes(dropdownSearch.toLowerCase()) && !dropdownDisplayed.includes(s)) || [];

                                    return (
                                      <>
                                        {results.slice(0, 24).map((sym) => (
                                          <button
                                            key={sym}
                                            type="button"
                                            onClick={() => {
                                              setHiddenSymbols(prev => prev.filter(s => s !== sym));
                                              if (!customSymbols.includes(sym)) {
                                                setCustomSymbols(prev => [...prev, sym]);
                                              }
                                              setDropdownSearch("");
                                              setActiveDropdown(null);
                                              setValue("type", cat.id);
                                            }}
                                            className="flex items-center justify-between p-3 rounded-xl text-sm font-black transition-all border bg-brand-text/5 border-brand-text/10 text-brand-text hover:text-brand-text hover:bg-brand-text/10"
                                          >
                                            <span>{sym}</span>
                                            <Plus size={10} className="opacity-100" />
                                          </button>
                                        ))}
                                        {results.length === 0 && (
                                          <p className="text-xs text-brand-muted w-full text-center py-4 italic col-span-full">
                                            {lang === 'ar' ? 'لا توجد رموز إضافية مطابقة للبحث' : 'No additional matching symbols found'}
                                          </p>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </>
                            ) : (
                              <div className="py-6 text-center text-sm text-brand-muted font-bold italic">
                                {lang === 'ar' ? 'اكتب للبحث عن رموز إضافية...' : 'Type to search for additional symbols...'}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-8 pt-6 border-t border-white/5">
                           <button 
                             type="button"
                             onClick={() => setActiveDropdown(null)}
                             className="w-full py-3 bg-brand-text/5 hover:bg-brand-text/10 rounded-xl text-sm font-black text-brand-text transition-all uppercase tracking-widest"
                           >
                             {lang === 'ar' ? 'إغلاق القائمة' : 'Close Menu'}
                           </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 bg-brand-alt p-8 rounded-[3rem] border border-brand-text/10 shadow-2xl transition-all">
          <div className={cn("flex items-center justify-between border-b border-brand-text/10 pb-6", isRTL ? "flex-row-reverse" : "flex-row")}>
             <label className="text-base font-black text-brand-text opacity-100 uppercase tracking-[0.2em]">{t.selectSymbols}</label>
             <div className="flex gap-3">
               <button 
                  type="button" 
                  onClick={selectAllInCategory}
                  className={cn(
                    "text-sm font-black px-4 py-2 rounded-full transition-all",
                    SYMBOL_GROUPS[selectedType]?.flatMap(g => g.symbols).every(s => selectedSymbols.includes(s))
                      ? "bg-primary text-white" 
                      : "bg-brand-text/10 text-brand-text hover:bg-brand-text/20"
                  )}
                >
                 {SYMBOL_GROUPS[selectedType]?.flatMap(g => g.symbols).every(s => selectedSymbols.includes(s))
                    ? t.unselectAll 
                    : t.selectAll}
               </button>
               <button 
                  type="button" 
                  onClick={clearAll}
                  className="text-sm font-black text-brand-text px-4 py-2 bg-brand-text/10 rounded-full hover:bg-brand-text/20 transition-colors"
                >
                 {t.clear}
               </button>
             </div>
          </div>

          <div className="space-y-6 pt-6 h-[400px] overflow-y-auto px-2 custom-scrollbar">
            {/* Symbol Groups & Browse */}
            <div className="space-y-8">
              {SYMBOL_GROUPS[selectedType]?.map((group, index, arr) => {
                let groupSymbols = group.symbols.filter(sym => !hiddenSymbols.includes(sym));
                
                // Append custom symbols to the last group of the category
                if (index === arr.length - 1) {
                  const allGroupsSymbols = SYMBOL_GROUPS[selectedType]?.flatMap(g => g.symbols) || [];
                  const customForType = customSymbols.filter(s => 
                    (ALL_SYMBOLS_DB[selectedType] || []).includes(s) &&
                    !hiddenSymbols.includes(s) &&
                    !allGroupsSymbols.includes(s)
                  );
                  groupSymbols = [...groupSymbols, ...customForType];
                }

                if (groupSymbols.length === 0) return null;
                
                return (
                  <div key={group.label} className="space-y-3">
                    <h6 className="text-sm font-black text-brand-muted uppercase tracking-widest px-2">
                      {t[group.label as keyof typeof t] || group.label}
                    </h6>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                      {groupSymbols.map((sym) => (
                        <div key={sym} className="relative group">
                          <button
                            type="button"
                            onClick={() => toggleSymbol(sym)}
                            className={cn(
                              "w-full flex items-center justify-center p-3 rounded-xl text-sm font-black transition-all border",
                              selectedSymbols.includes(sym)
                                ? "bg-primary border-primary/50 text-brand-text shadow-[0_5px_15px_rgba(16,185,129,0.2)]"
                                : "bg-brand-text/5 border-white/5 text-brand-text hover:bg-brand-text/10 hover:border-brand-text/10"
                            )}
                          >
                            {sym}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => removeSymbol(sym, e)}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-brand-text rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600 shadow-md"
                          >
                            <X size={8} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Global Symbol Search */}
            <div className="space-y-4 pt-8 border-t border-brand-text/10">
               <div className="relative">
                 <Search className={cn("absolute top-1/2 -translate-y-1/2 text-brand-muted", isRTL ? "right-4" : "left-4")} size={16} />
                 <input 
                   type="text"
                   placeholder={t.searchSymbol}
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className={cn(
                     "w-full bg-brand-text/5 border border-brand-text/10 rounded-2xl py-4 text-sm font-bold text-brand-text placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all",
                     isRTL ? "pr-12 pl-4" : "pl-12 pr-4"
                   )}
                 />
                 {searchTerm && (
                   <button 
                     onClick={() => setSearchTerm("")}
                     className={cn("absolute top-1/2 -translate-y-1/2 text-brand-text hover:text-brand-text", isRTL ? "left-4" : "right-4")}
                   >
                     <X size={14} />
                   </button>
                 )}
               </div>

               {searchTerm && (
                 <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-black/20 rounded-2xl border border-white/5">
                   {(() => {
                     const globalDisplayed = [
                       ...(SYMBOL_GROUPS[selectedType]?.flatMap(g => g.symbols) || []),
                       ...customSymbols
                     ].filter(sym => !hiddenSymbols.includes(sym));

                     const results = ALL_SYMBOLS_DB[selectedType]
                       ?.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()) && !globalDisplayed.includes(s)) || [];

                     return (
                       <>
                         {results.slice(0, 50).map((sym) => (
                           <button
                             key={sym}
                             type="button"
                             onClick={() => {
                               setHiddenSymbols(prev => prev.filter(s => s !== sym));
                               if (!customSymbols.includes(sym)) {
                                 setCustomSymbols(prev => [...prev, sym]);
                               }
                               setSearchTerm("");
                             }}
                             className={cn(
                               "px-4 py-2 rounded-xl text-sm font-black border transition-all",
                               selectedSymbols.includes(sym)
                                 ? "bg-primary border-primary text-brand-text"
                                 : "bg-brand-text/5 border-brand-text/10 text-brand-text hover:border-white/30"
                             )}
                           >
                             {sym}
                           </button>
                         ))}
                         {results.length === 0 && (
                           <p className="text-sm text-brand-muted w-full text-center py-2 italic">No matching symbols found</p>
                         )}
                       </>
                     );
                   })()}
                 </div>
               )}
            </div>


            
            <div className="pt-8 border-t border-brand-text/10">
               <label className="text-sm font-black text-brand-text opacity-100 uppercase mb-3 block pl-2">{t.manualInput}</label>
               <input
                 {...register("symbol")}
                 dir="ltr"
                 placeholder="BTCUSD, SOLUSD, ETHUSD..."
                 className="w-full p-5 bg-black/40 border border-brand-text/10 rounded-2xl text-base font-mono focus:ring-4 ring-primary/20 focus:outline-none text-brand-text placeholder:text-brand-muted"
               />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-4">
            <label className="text-base font-black text-brand-text opacity-100 uppercase tracking-widest pl-2">{t.tradingStyle}</label>
            <div className="grid grid-cols-1 gap-3">
              {TRADING_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setValue("tradingStyle", style.id as TradingStyle)}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left",
                    selectedStyle === style.id 
                      ? "border-primary bg-primary/30 text-brand-text shadow-lg" 
                      : "border-brand-text/10 bg-brand-alt text-brand-text hover:border-brand-text/20"
                  )}
                >
                  <div className={cn("p-2 rounded-lg", selectedStyle === style.id ? "bg-primary" : "bg-brand-text/10")}>
                    {ICON_MAP[style.icon]}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-black uppercase">{t[style.label as keyof typeof t]}</span>
                    <span className="text-sm opacity-90">
                      {style.id === 'swing_trading' ? (lang === 'ar' ? 'تركيز على الاتجاهات الكبرى (4س/يومي) - الأكثر أماناً' : 'Focus on major trends (H4/D1) - Safest') : ''}
                      {style.id === 'day_trading' ? (lang === 'ar' ? 'تحركات اليوم الحالي فقط' : 'Current day moves only') : ''}
                      {style.id === 'scalping' ? (lang === 'ar' ? 'تحركات لحظية سريعة جداً' : 'Very fast intraday moves') : ''}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-base font-black text-brand-text opacity-100 uppercase tracking-widest pl-2">{t.timeframe}</label>
            <div className="grid grid-cols-3 gap-3">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setValue("timeframe", tf.id)}
                  className={cn(
                    "p-5 rounded-2xl border-2 transition-all text-base font-black uppercase",
                    selectedTimeframe === tf.id 
                      ? "border-primary bg-primary/30 text-brand-text shadow-lg" 
                      : "border-brand-text/10 bg-brand-alt text-brand-text/60 hover:border-brand-text/20 hover:text-brand-text"
                  )}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4">
          <motion.button
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={analyzingIndex !== null}
            className="w-full h-20 bg-brand-text text-brand-bg rounded-[2rem] font-display font-black text-2xl flex items-center justify-center gap-4 shadow-2xl hover:bg-primary hover:text-brand-text transition-all group disabled:opacity-100"
          >
            {analyzingIndex !== null ? (
              <>
                <div className="w-6 h-6 border-4 border-brand-bg border-t-transparent rounded-full animate-spin" />
                <span>{t.analyzing}</span>
              </>
            ) : (
              <>
                <Zap size={28} className="fill-secondary text-secondary group-hover:fill-white group-hover:text-brand-text transition-colors" />
                <span>{t.startManualNow}</span>
              </>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );
}

