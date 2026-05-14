import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Layout, LineChart, PieChart, Shield, Zap, TrendingUp, Search, Info } from 'lucide-react';
import Header from './components/Header';
import Hero from './components/Hero';
import AnalysisForm from './components/AnalysisForm';
import AnalysisResultView from './components/AnalysisResultView';
import ConnectionStatus from './components/ConnectionStatus';
import LoginOverlay from './components/LoginOverlay';
import SettingsModal from './components/SettingsModal';
import TopSignals from './components/TopSignals';
import { AnalysisResult, StrategySettings, AutoAnalysisSettings, MarketType } from './types';
import { DEFAULT_STRATEGY_SETTINGS, DEFAULT_AUTO_SETTINGS, SYMBOL_CATEGORIES } from './constants';
import { Language, translations } from './lib/i18n';
import { analyzeMarket } from './services/geminiService';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ current: string, total: number, index: number } | null>(null);
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'en');
  const [isDark, setIsDark] = useState<boolean>(() => localStorage.getItem('theme') !== 'light');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<StrategySettings>(() => {
    const saved = localStorage.getItem('strategy_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return DEFAULT_STRATEGY_SETTINGS; }
    }
    return DEFAULT_STRATEGY_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('language', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('strategy_settings', JSON.stringify(settings));
  }, [settings]);

  const [autoSettings, setAutoSettings] = useState<AutoAnalysisSettings>(() => {
    const saved = localStorage.getItem('auto_settings');
    let settings = DEFAULT_AUTO_SETTINGS;
    if (saved) {
      try { settings = JSON.parse(saved); } catch (e) { settings = DEFAULT_AUTO_SETTINGS; }
    }
    // Always force enable on startup as requested
    return { ...settings, isEnabled: true };
  });

  useEffect(() => {
    localStorage.setItem('auto_settings', JSON.stringify(autoSettings));
  }, [autoSettings]);

  const [isScanningFinished, setIsScanningFinished] = useState(false);
  const [foundAnyStrong, setFoundAnyStrong] = useState(false);

  // Background Auto-Scanner Engine
  useEffect(() => {
    if (!autoSettings.isEnabled) {
      setIsScanningFinished(false);
      return;
    }

    let isSubscribed = true;
    let timeoutId: NodeJS.Timeout;

    const runAutoScan = async () => {
      if (!isSubscribed || isAnalyzing) {
        timeoutId = setTimeout(runAutoScan, 10000);
        return;
      }

      setIsScanningFinished(false);
      let foundInThisCycle = false;

      const categories = autoSettings.category === 'all' 
        ? Object.keys(SYMBOL_CATEGORIES) as (keyof typeof SYMBOL_CATEGORIES)[]
        : [autoSettings.category as keyof typeof SYMBOL_CATEGORIES];

      for (const cat of categories) {
        const symbols = SYMBOL_CATEGORIES[cat];
        const mType = cat === 'crypto' ? MarketType.CRYPTO : 
                      cat === 'stocks' ? MarketType.STOCKS :
                      cat === 'metals' ? MarketType.METALS : MarketType.FOREX;

        for (const symbol of symbols) {
          if (!isSubscribed || !autoSettings.isEnabled || isAnalyzing) break;
          
          try {
            const result = await analyzeMarket({
              symbol,
              type: mType,
              timeframe: autoSettings.timeframe,
              tradingStyle: autoSettings.tradingStyle,
              settings,
              lang
            });
            
            if (result && isSubscribed) {
               const isStrong = result.confidence >= settings.minStrongConfidence && result.signal !== 'no_entry';
               const isAnySignal = result.signal !== 'no_entry' && result.signal !== 'neutral';

               if (isStrong) {
                 foundInThisCycle = true;
                 const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3');
                 audio.volume = autoSettings.volume;
                 audio.play().catch(() => {});
                 setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 2000);
                 updateTopSignals([result]);
               } else if (autoSettings.showAllSignals && isAnySignal) {
                 updateTopSignals([result]);
               }
            }
            await new Promise(r => setTimeout(r, 4000));
          } catch (e) {
            console.error(`Auto-scan failed:`, e);
          }
        }
        if (!isSubscribed || !autoSettings.isEnabled || isAnalyzing) break;
      }

      if (isSubscribed) {
        const finishedAt = Date.now();
        const hasVisibleSignals = foundInThisCycle || (autoSettings.showAllSignals && topSignals.length > 0);

        if (!hasVisibleSignals) {
          // No signals sound
          const failAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
          failAudio.volume = autoSettings.volume;
          failAudio.play().catch(() => {});
          setTimeout(() => { failAudio.pause(); failAudio.currentTime = 0; }, 2000);
        }
        
        setIsScanningFinished(true);
        setFoundAnyStrong(hasVisibleSignals);
        
        // Use functional update to ensure we use latest state
        setAutoSettings(prev => ({ ...prev, lastFinishedAt: finishedAt }));
        
        const nextScanDelay = autoSettings.interval * 60000;
        timeoutId = setTimeout(runAutoScan, nextScanDelay);
      }
    };

    // Session Intelligence: Distinguish between Refresh and Fresh Open
    const isRefresh = sessionStorage.getItem('radar_session_active') === 'true';
    let initialDelay = 2000;

    if (isRefresh && autoSettings.lastFinishedAt) {
      const elapsed = Date.now() - autoSettings.lastFinishedAt;
      const totalWait = autoSettings.interval * 60000;
      if (elapsed < totalWait) {
        initialDelay = totalWait - elapsed;
        setIsScanningFinished(true);
      }
    } else {
      // Fresh open: Start now and mark session as active
      sessionStorage.setItem('radar_session_active', 'true');
    }

    timeoutId = setTimeout(runAutoScan, initialDelay);
    return () => { isSubscribed = false; clearTimeout(timeoutId); };
  }, [autoSettings.isEnabled, autoSettings.category, autoSettings.timeframe, autoSettings.interval, isAnalyzing]);
  
  const [topSignals, setTopSignals] = useState<AnalysisResult[]>(() => {
    const saved = localStorage.getItem('top_signals');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { return []; }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('top_signals', JSON.stringify(topSignals));
  }, [topSignals]);

  const updateTopSignals = (results: AnalysisResult[]) => {
    setTopSignals(prev => {
      let updated = [...prev];
      results.forEach(res => {
        const isActionable = res.signal !== 'no_entry' && res.signal !== 'neutral';
        const isStrong = res.confidence >= settings.minStrongConfidence;
        
        // Show if it's strong OR if user wants to see everything actionable
        if (isStrong || (autoSettings.showAllSignals && isActionable)) {
          const index = updated.findIndex(s => s.symbol === res.symbol);
          if (index >= 0) {
            updated[index] = res;
          } else {
            updated.unshift(res);
          }
        } else {
          // If it's no longer strong/actionable and we are filtering, remove it
          updated = updated.filter(s => s.symbol !== res.symbol);
        }
      });
      return updated.slice(0, 15); // Show up to 15 top opportunities
    });
  };

  const removeSignal = (symbol: string) => {
    setTopSignals(prev => prev.filter(s => s.symbol !== symbol));
  };
  
  const handleSelectSignal = (result: AnalysisResult) => {
    setAnalysisResults([result]);
  };

  useEffect(() => {
    // Apply theme
    if (isDark) {
      document.body.classList.remove('light');
    } else {
      document.body.classList.add('light');
    }
  }, [isDark]);

  useEffect(() => {
    // Auto-detect direction
    document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const t = translations[lang];

  useEffect(() => {
    // Explicitly set persistence to local (survives browser restart)
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      // Bypass login for local development
      setUser(u || { uid: 'developer', email: 'bachasalman69@gmail.com', displayName: 'Developer' } as any);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setAnalysisResults(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <motion.div
           animate={{ rotate: 360 }}
           transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
           className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex-col bg-brand-bg relative p-3 md:p-16 flex">
      <div className="site-frame" />
      <AnimatePresence>
        {!user && !loading && (
          <LoginOverlay onLogin={handleLogin} lang={lang} />
        )}
      </AnimatePresence>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        onSettingsChange={setSettings} 
      />

      <Header 
        user={user} 
        onLogin={handleLogin} 
        onLogout={handleLogout} 
        isDark={isDark}
        toggleTheme={() => setIsDark(!isDark)}
        lang={lang}
        onLangChange={setLang}
        onOpenSettings={() => setIsSettingsOpen(true)}
        showBack={!!analysisResults}
        onBack={() => setAnalysisResults(null)}
        autoSettings={autoSettings}
        onAutoSettingsChange={setAutoSettings}
        isWaiting={isScanningFinished}
      />

      <AnimatePresence>
        {isScanningFinished && !foundAnyStrong && autoSettings.isEnabled && (
          <motion.div
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            className="w-full bg-brand-alt border-b border-red-500/20 py-2 px-4 flex items-center justify-center gap-2 overflow-hidden"
          >
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-500 text-[10px] font-black uppercase tracking-[0.2em]">
              {lang === 'ar' ? 'لا توجد إشارة قوية حالياً' : 'No strong signals currently'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      
      <main className="flex-grow">
        <AnimatePresence mode="wait">
          {!analysisResults && !isAnalyzing ? (
            <motion.div
              key="analysis-input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-7xl mx-auto px-4 py-8"
            >
              <TopSignals 
                signals={topSignals} 
                onRemove={removeSignal} 
                onSelect={handleSelectSignal} 
                lang={lang} 
              />
              <AnalysisForm 
                 user={user} 
                 lang={lang}
                 settings={settings}
                 onBegin={() => setIsAnalyzing(true)}
                 onProgress={(current, total, index) => setProgress({ current, total, index })}
                 onResult={(results) => {
                   setAnalysisResults(results);
                   setIsAnalyzing(false);
                   setProgress(null);
                   updateTopSignals(results);
                 }} 
                 onError={() => {
                   setIsAnalyzing(false);
                   setProgress(null);
                 }}
              />
              <ConnectionStatus />
            </motion.div>
          ) : isAnalyzing ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-grow flex flex-col items-center justify-center p-8 space-y-8"
            >
              <div className="relative w-32 h-32">
                <motion.div
                  animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 border-b-2 border-primary rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                />
                <div className="absolute inset-0 flex items-center justify-center text-primary">
                  <TrendingUp size={48} />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-display font-bold tracking-tight text-brand-text">{t.analyzing}</h2>
                {progress && (
                  <div className="space-y-1">
                    <p className="text-primary font-black animate-pulse">
                      {progress.current}
                    </p>
                    <p className="text-slate-500 text-sm font-mono uppercase tracking-widest">
                      {progress.index + 1} / {progress.total}
                    </p>
                  </div>
                )}
                <p className="text-slate-500 font-sans">{t.analyzingSub}</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-7xl mx-auto px-4 py-8"
            >
              <AnalysisResultView results={analysisResults || []} lang={lang} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-8 border-t border-white/5 bg-brand-alt/30">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">
          <p>© {new Date().getFullYear()} Finalyze AI. {t.allRightsReserved}.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">{t.privacyPolicy}</a>
            <a href="#" className="hover:text-primary transition-colors">{t.termsOfUse}</a>
            <a href="#" className="hover:text-primary transition-colors">API Documentation</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
