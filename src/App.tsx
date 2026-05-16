import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Activity } from 'lucide-react';
import Header from './components/Header';
import AnalysisForm from './components/AnalysisForm';
import AnalysisResultView from './components/AnalysisResultView';
import ConnectionStatus from './components/ConnectionStatus';
import LoginOverlay from './components/LoginOverlay';
import SettingsModal from './components/SettingsModal';
import TopSignals from './components/TopSignals';
import { AnalysisResult, StrategySettings, AutoAnalysisSettings, MarketType } from './types';
import { DEFAULT_STRATEGY_SETTINGS, DEFAULT_AUTO_SETTINGS, SYMBOL_CATEGORIES, ALL_SYMBOLS_DB } from './constants';
import { Language, translations } from './lib/i18n';
import { analyzeMarket } from './services/geminiService';


export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'ar');
  const [isDark, setIsDark] = useState<boolean>(() => localStorage.getItem('theme') !== 'light');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [isScanningFinished, setIsScanningFinished] = useState(false);
  const [foundAnyStrong, setFoundAnyStrong] = useState(false);
  
  const [settings, setSettings] = useState<StrategySettings>(() => {
    const saved = localStorage.getItem('strategy_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return DEFAULT_STRATEGY_SETTINGS; }
    }
    return DEFAULT_STRATEGY_SETTINGS;
  });

  const [autoSettings, setAutoSettings] = useState<AutoAnalysisSettings>(() => {
    const saved = localStorage.getItem('auto_settings');
    let base = DEFAULT_AUTO_SETTINGS;
    if (saved) {
      try { base = JSON.parse(saved); } catch (e) { base = DEFAULT_AUTO_SETTINGS; }
    }
    return { ...base, isEnabled: true };
  });

  const autoSettingsRef = useRef(autoSettings);
  useEffect(() => {
    autoSettingsRef.current = autoSettings;
  }, [autoSettings]);

  const [isRadarUnlocked, setIsRadarUnlocked] = useState(false);

  // Load persistent custom audio from IndexedDB on startup
  useEffect(() => {
    const loadCustomAudio = async () => {
      try {
        const { getAudioBlob } = await import('./lib/db');
        const successBlob = await getAudioBlob('custom_success');
        const failBlob = await getAudioBlob('custom_fail');
        
        if (successBlob && successAudioRef.current) {
          successAudioRef.current.src = URL.createObjectURL(successBlob);
        }
        if (failBlob && failAudioRef.current) {
          failAudioRef.current.src = URL.createObjectURL(failBlob);
        }
      } catch (e) {
        console.warn("Failed to load custom audio from DB", e);
      }
    };
    loadCustomAudio();
  }, []);

  const [progress, setProgress] = useState<{ current: string, total: number, index: number } | null>(null);
  const [topSignals, setTopSignals] = useState<AnalysisResult[]>(() => {
    const saved = localStorage.getItem('top_signals_persistent');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  // NATIVE AUDIO ENGINE (Bulletproof against browser blocks)
  const successAudioRef = useRef<HTMLAudioElement>(null);
  const failAudioRef = useRef<HTMLAudioElement>(null);

  const playAudio = (type: 'success' | 'fail') => {
    if (!isRadarUnlocked) return; // Silent until unlocked
    
    // Check if we should use custom blob or default URL
    const isCustom = (type === 'success' ? autoSettings.successSound : autoSettings.failSound) === 'custom';
    const audioEl = type === 'success' ? successAudioRef.current : failAudioRef.current;
    
    if (audioEl) {
      // If NOT custom, set the src from the settings URL
      if (!isCustom) {
        const url = type === 'success' ? autoSettings.successSound : autoSettings.failSound;
        if (url && !url.startsWith('blob:')) {
          audioEl.src = url;
        }
      }

      audioEl.volume = Math.max(0, Math.min(1, autoSettings.volume || 0.5));
      audioEl.currentTime = 0; // Force restart
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => console.warn(`Audio blocked (${type}):`, e));
      }
    }
  };

  const handleUnlockRadar = () => {
    if (successAudioRef.current) {
      successAudioRef.current.play().then(() => {
        successAudioRef.current?.pause();
        if (successAudioRef.current) successAudioRef.current.currentTime = 0;
        setIsRadarUnlocked(true);
      }).catch(() => {
        // Fallback if play fails immediately
        setIsRadarUnlocked(true);
      });
    } else {
      setIsRadarUnlocked(true);
    }
  };

  // Track the most up-to-date signals instantly to avoid stale closures
  const signalsRef = useRef(topSignals);
  
  useEffect(() => {
    signalsRef.current = topSignals;
    localStorage.setItem('top_signals_persistent', JSON.stringify(topSignals));
  }, [topSignals]);

  useEffect(() => {
    localStorage.setItem('language', lang);
    document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (isDark) document.body.classList.remove('light');
    else document.body.classList.add('light');
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('strategy_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('auto_settings', JSON.stringify(autoSettings));
  }, [autoSettings]);

  const updateTopSignals = (results: AnalysisResult[]) => {
    let changed = false;
    let hasBrandNewSymbol = false;
    let updated = [...signalsRef.current];

    results.forEach(res => {
      const isActionable = res.signal !== 'no_entry' && res.signal !== 'neutral';
      const isStrong = res.confidence >= settings.minStrongConfidence;
      
      if (isStrong || (autoSettings.showAllSignals && isActionable)) {
        const index = updated.findIndex(s => s.symbol === res.symbol);
        if (index >= 0) {
          if (updated[index].timestamp !== res.timestamp) {
            changed = true;
            // No sound for mere updates, only for brand new appearances
          }
          updated[index] = res;
        } else {
          updated.unshift(res);
          changed = true;
          hasBrandNewSymbol = true; // Trigger sound ONLY for new symbols
        }
      } else {
        const prevLength = updated.length;
        updated = updated.filter(s => s.symbol !== res.symbol);
        if (updated.length < prevLength) changed = true;
      }
    });

    if (changed) {
      // 1. UPDATE UI
      setTopSignals(updated.slice(0, 15));
      
      // 2. DELAYED AUDIO TRIGGER (Guarantees visual paints first)
      if (hasBrandNewSymbol) {
        setTimeout(() => {
          playAudio('success');
        }, 400); // 400ms delay ensures UI is visible before sound hits
      }
    }
  };

  const removeSignal = (symbol: string) => {
    setTopSignals(prev => prev.filter(s => s.symbol !== symbol));
  };

  const handleSelectSignal = (result: AnalysisResult) => {
    setAnalysisResults([result]);
    setShowForm(false);
  };

  const isMarketOpen = (category: string) => {
    if (category === 'crypto') return true;
    const day = new Date().getDay();
    // Strictly closed on Saturday (6) and Sunday (0)
    if (day === 0 || day === 6) return false;
    return true;
  };

  // HARD PURGE FOR STALE RESULTS (Weekend Cleanup)
  useEffect(() => {
    const purgeStale = () => {
      const day = new Date().getDay();
      if (day === 0 || day === 6) {
        setTopSignals(prev => {
          const filtered = prev.filter(s => {
            const sym = s.symbol.toUpperCase();
            // Expanded check: includes all cryptos in our DB plus any -USD format
            const allCryptos = ALL_SYMBOLS_DB.crypto || [];
            return allCryptos.includes(sym) || sym.includes('-USD') || sym.endsWith('USD');
          });
          if (filtered.length !== prev.length) {
            localStorage.setItem('top_signals_persistent', JSON.stringify(filtered));
          }
          return filtered;
        });
      }
    };
    purgeStale();
    const interval = setInterval(purgeStale, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // ULTIMATE RADAR LOGIC
  useEffect(() => {
    if (!autoSettings.isEnabled) return;

    let isSubscribed = true;
    let timeoutId: NodeJS.Timeout;

    const runAutoScan = async () => {
      if (!isSubscribed || isAnalyzing) {
        timeoutId = setTimeout(runAutoScan, 5000);
        return;
      }

      const currentSettings = autoSettingsRef.current;
      const categories = currentSettings.category === 'all' 
        ? Object.keys(SYMBOL_CATEGORIES) as (keyof typeof SYMBOL_CATEGORIES)[]
        : [currentSettings.category as keyof typeof SYMBOL_CATEGORIES];

      // Check if any category is actually open
      const openCategories = categories.filter(isMarketOpen);
      if (openCategories.length === 0) {
        setIsScanningFinished(true);
        timeoutId = setTimeout(runAutoScan, 30000); // Check again in 30s
        return;
      }

      setIsScanningFinished(false);

      for (const cat of openCategories) {
        const symbols = SYMBOL_CATEGORIES[cat];
        const mType = cat === 'crypto' ? MarketType.CRYPTO : 
                      cat === 'stocks' ? MarketType.STOCKS :
                      cat === 'metals' ? MarketType.METALS : MarketType.FOREX;

        for (const symbol of symbols) {
          if (!isSubscribed || !autoSettingsRef.current.isEnabled || isAnalyzing) break;
          try {
            const result = await analyzeMarket({
              symbol, type: mType, timeframe: currentSettings.timeframe,
              tradingStyle: currentSettings.tradingStyle, settings, lang
            });
            if (result && isSubscribed) {
              const sig = result.signal || '';
              const threshold = settings?.minStrongConfidence || 80;
              const isStrong = result.confidence >= threshold && (sig.includes('buy') || sig.includes('sell'));
              
              if (isStrong) {
                if (sig === 'buy') result.signal = 'strong_buy' as any;
                if (sig === 'sell') result.signal = 'strong_sell' as any;
                updateTopSignals([result]);
              }
            }
            await new Promise(r => setTimeout(r, 4000));
          } catch (e) { 
            console.error("Analysis Loop Error:", e);
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      }

      if (isSubscribed) {
        const finishedAt = Date.now();
        const nextTime = finishedAt + ((autoSettingsRef.current.interval || 15) * 60000);
        localStorage.setItem('radar_next_scan_at', nextTime.toString());
        
        playAudio('fail');
        
        setIsScanningFinished(true);
        setFoundAnyStrong(signalsRef.current.length > 0);
        setAutoSettings(prev => ({ ...prev, lastFinishedAt: finishedAt }));
        timeoutId = setTimeout(runAutoScan, (autoSettingsRef.current.interval || 15) * 60000);
      }
    };

    const nextScanAt = autoSettings.forceRestart ? 0 : parseInt(localStorage.getItem('radar_next_scan_at') || '0');
    const now = Date.now();
    let initialDelay = 1000;

    if (now < nextScanAt) {
      initialDelay = nextScanAt - now;
      setIsScanningFinished(true);
    }

    timeoutId = setTimeout(runAutoScan, initialDelay);
    return () => { isSubscribed = false; clearTimeout(timeoutId); };
  }, [
    autoSettings.isEnabled, autoSettings.category, autoSettings.timeframe, 
    autoSettings.interval, autoSettings.showAllSignals, autoSettings.tradingStyle,
    autoSettings.forceRestart, // Trigger effect on force restart
    settings.minStrongConfidence
  ]);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u || { uid: 'developer', email: 'bachasalman69@gmail.com', displayName: 'Developer' } as any);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } catch (error) { console.error(error); }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAnalysisResults(null);
  };

  const t = translations[lang];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg relative">
      {/* NATIVE AUDIO ELEMENTS - Hidden but present in DOM for perfect playback */}
      <audio 
        ref={successAudioRef} 
        src={autoSettings.successSound || 'https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3'} 
        preload="auto" 
      />
      <audio 
        ref={failAudioRef} 
        src={autoSettings.failSound || 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'} 
        preload="auto" 
      />

      <AnimatePresence>
        {!user && !loading && <LoginOverlay onLogin={handleLogin} lang={lang} />}
      </AnimatePresence>

      <SettingsModal 
        isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} 
        settings={settings} onSettingsChange={setSettings} 
      />

      <Header 
        user={user} onLogin={handleLogin} onLogout={handleLogout} 
        isDark={isDark} toggleTheme={() => setIsDark(!isDark)}
        lang={lang} onLangChange={setLang}
        onOpenSettings={() => setIsSettingsOpen(true)}
        showBack={!!analysisResults} onBack={() => setAnalysisResults(null)}
        autoSettings={autoSettings} onAutoSettingsChange={setAutoSettings}
        isWaiting={isScanningFinished}
        isRadarUnlocked={isRadarUnlocked}
        onUnlockRadar={handleUnlockRadar}
      />

      <AnimatePresence>
        {isScanningFinished && !foundAnyStrong && autoSettings.isEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-brand-alt border-b border-red-500/20 py-2 text-center"
          >
            <span className="text-red-500 text-[10px] font-black uppercase tracking-widest">
              {lang === 'ar' ? 'لا توجد إشارة قوية حالياً' : 'No strong signals currently'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      
      <main className="flex-grow max-w-7xl mx-auto w-full px-4 py-8">
        <AnimatePresence mode="wait">
          {!analysisResults && !isAnalyzing ? (
            <motion.div key="analysis-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TopSignals 
                signals={topSignals} onRemove={removeSignal} 
                onSelect={handleSelectSignal} onClearAll={() => setTopSignals([])}
                lang={lang} 
              />
              <AnalysisForm 
                 user={user} lang={lang} settings={settings}
                 onBegin={() => setIsAnalyzing(true)}
                 onProgress={(current, total, index) => setProgress({ current, total, index })}
                 onResult={(results) => {
                   // Comprehensive Crypto Check for results
                   const day = new Date().getDay();
                   const allCryptos = ALL_SYMBOLS_DB.crypto || [];
                   
                   const filtered = (day === 0 || day === 6) 
                     ? results.filter(r => {
                         const sym = r.symbol.toUpperCase();
                         return allCryptos.includes(sym) || sym.includes('-USD') || sym.endsWith('USD');
                       })
                     : results;
                   
                   setAnalysisResults(filtered);
                   setIsAnalyzing(false);
                   setProgress(null);
                   updateTopSignals(filtered);
                 }} 
                 onError={() => { setIsAnalyzing(false); setProgress(null); }}
              />
              <ConnectionStatus />
            </motion.div>
          ) : isAnalyzing ? (
            <motion.div key="analyzing" className="flex flex-col items-center justify-center p-8 space-y-8 h-96">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-b-2 border-primary rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-primary">
                  <TrendingUp size={32} />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-brand-text">{t.analyzing}</h2>
                {progress && (
                  <div className="text-primary font-black animate-pulse">
                    {progress.current} ({progress.index + 1}/{progress.total})
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AnalysisResultView results={analysisResults || []} lang={lang} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-8 border-t border-white/5 bg-brand-alt/30">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">
          <p>© {new Date().getFullYear()} Joseph.Trading. {t.allRightsReserved}.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">{t.privacyPolicy}</a>
            <a href="#" className="hover:text-primary transition-colors">{t.termsOfUse}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
