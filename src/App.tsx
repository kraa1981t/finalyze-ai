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
import { AnalysisResult, StrategySettings, MarketType } from './types';
import { DEFAULT_STRATEGY_SETTINGS, MARKET_SYMBOLS } from './constants';
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

  // ══════════════════════════════════════════════
  // AUTO ANALYSIS ENGINE (BACKGROUND SCANNER)
  // ══════════════════════════════════════════════
  const [isAutoScanning, setIsAutoScanning] = useState(false);

  const runAutoAnalysis = async () => {
    if (isAutoScanning || !settings.isAutoAnalysisEnabled) return;
    
    setIsAutoScanning(true);
    console.log("[Auto Analysis]: Starting sequential scan...");

    const categories = settings.autoAnalysisCategory === 'all' 
      ? Object.keys(MARKET_SYMBOLS) 
      : [settings.autoAnalysisCategory];

    const allSymbols: { symbol: string, type: MarketType }[] = [];
    categories.forEach(cat => {
      const type = cat as MarketType;
      MARKET_SYMBOLS[type]?.forEach(sym => {
        allSymbols.push({ symbol: sym, type });
      });
    });

    // Shuffle to vary start point
    const shuffled = [...allSymbols].sort(() => Math.random() - 0.5);

    for (const item of shuffled) {
      if (!settings.isAutoAnalysisEnabled) break; // Stop if disabled during scan
      
      try {
        const result = await analyzeMarket(
          item.symbol, 
          item.type, 
          '1h', // Default timeframe for auto analysis
          'day_trading', // Default style
          lang
        );

        if (result.confidence >= settings.minStrongConfidence && result.signal.includes('strong')) {
          updateTopSignals([result]);
          console.log(`[Auto Analysis]: Found Strong Signal for ${item.symbol}`);
        }
        
        // Wait 2 seconds between symbols to be polite to the API/Engine
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`[Auto Analysis Error] for ${item.symbol}:`, error);
      }
    }

    setIsAutoScanning(false);
    localStorage.setItem('last_auto_analysis', Date.now().toString());
    console.log("[Auto Analysis]: Scan completed.");
  };

  useEffect(() => {
    if (!settings.isAutoAnalysisEnabled) return;

    const checkAndRun = () => {
      const lastRun = localStorage.getItem('last_auto_analysis');
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      if (!lastRun || now - parseInt(lastRun) >= oneHour) {
        runAutoAnalysis();
      }
    };

    const interval = setInterval(checkAndRun, 5 * 60 * 1000); // Check every 5 mins
    checkAndRun(); // Initial check

    return () => clearInterval(interval);
  }, [settings.isAutoAnalysisEnabled, lang]);
  
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

  const updateTopSignals = (newResults: AnalysisResult[]) => {
    setTopSignals(prev => {
      let updated = [...prev];
      newResults.forEach(res => {
        // Keep if confidence >= settings.minStrongConfidence AND trend is NOT aging
        if (res.confidence >= settings.minStrongConfidence && res.trendMaturity !== 'aging' && res.signal !== 'no_entry' && res.signal !== 'neutral') {
          const index = updated.findIndex(s => s.symbol === res.symbol);
          if (index !== -1) {
            updated[index] = res;
          } else {
            updated.unshift(res);
          }
        } else {
          // If a symbol is re-analyzed and no longer fits, remove it
          updated = updated.filter(s => s.symbol !== res.symbol);
        }
      });
      return updated.slice(0, 12); // Keep top 12
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
      />
      
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
