import React, { useState, useEffect, useRef, useMemo } from 'react';
import { onAuthStateChanged, User, signInWithPopup, getRedirectResult, GoogleAuthProvider, signOut, signInAnonymously } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, query, orderBy, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Activity, ArrowLeft, Users, Shield } from 'lucide-react';
import Header from './components/Header';
import AnalysisForm from './components/AnalysisForm';
import AnalysisResultView from './components/AnalysisResultView';
import ConnectionStatus from './components/ConnectionStatus';
import LoginOverlay from './components/LoginOverlay';
import SettingsModal from './components/SettingsModal';
import SidebarPanel from './components/SidebarPanel';
import TopSignals from './components/TopSignals';
import PortfolioPanel from './components/PortfolioPanel';

import { AnalysisResult, StrategySettings, AutoAnalysisSettings, MarketType, TradingStyle } from './types';
import { DEFAULT_STRATEGY_SETTINGS, DEFAULT_AUTO_SETTINGS, SYMBOL_CATEGORIES, ALL_SYMBOLS_DB, SYMBOL_GROUPS, FREE_SYMBOLS } from './constants';
import { Language, translations } from './lib/i18n';
import { analyzeMarket } from './services/geminiService';
import { resolveConflicts } from './services/portfolioRiskService';
import ApiKeyModal from './components/ApiKeyModal';
import SubscriptionModal from './components/SubscriptionModal';
import PaymentModal from './components/PaymentModal';

function hasAnyStoredKey(): boolean {
  try {
    const k1 = localStorage.getItem('finalyze_key1_value');
    const k1en = localStorage.getItem('finalyze_key1_enabled') !== 'false';
    const oldKey = localStorage.getItem('finalyze_user_groq_api_key');
    return (!!k1 && k1en) || !!oldKey;
  } catch { return false; }
}
import ClientMonitor from './components/ClientMonitor';
import RadarSettingsPage from './components/RadarSettingsPage';


export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [manualAuthUrl, setManualAuthUrl] = useState<string | null>(null);
  const [paymentPlan, setPaymentPlan] = useState<{ amount: number; label: string; durationDays: number } | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(() => {
    const k1 = localStorage.getItem('finalyze_key1_value');
    const k1en = localStorage.getItem('finalyze_key1_enabled') !== 'false';
    return (!!k1 && k1en) || hasAnyStoredKey();
  });
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'ar');
  const [isDark, setIsDark] = useState<boolean>(() => localStorage.getItem('theme') !== 'light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [freemiumDisabled, setFreemiumDisabled] = useState(() => localStorage.getItem('finalyze_freemium_disabled') === 'true');
  const [needsApiKey, setNeedsApiKeyState] = useState<string | null>(null);
  const [pendingVerifyLink, setPendingVerifyLink] = useState<string | null>(localStorage.getItem('finalyze_verify_link') || null);
  const persistNeedsApiKey = (email: string | null) => {
    if (email) {
      // Safety net: never block registered clients (those already in finalyze_clients)
      const allClients: any[] = JSON.parse(localStorage.getItem('finalyze_clients') || '[]');
      if (email && allClients.some((c: any) => c.email === email)) {
        localStorage.removeItem('finalyze_needs_api_key');
        localStorage.removeItem('finalyze_needs_api_key_timestamp');
        setNeedsApiKeyState(null);
        return;
      }
      localStorage.setItem('finalyze_needs_api_key', email);
      localStorage.setItem('finalyze_needs_api_key_timestamp', Date.now().toString());
    } else {
      localStorage.removeItem('finalyze_needs_api_key');
      localStorage.removeItem('finalyze_needs_api_key_timestamp');
    }
    setNeedsApiKeyState(email);
  };
  const getPageFromHash = (): 'main' | 'settings' | 'apiKey' | 'plans' | 'radar' | 'paymentSettings' | 'clientMonitor' | 'profile' => {
    const hash = window.location.hash.slice(1);
    if (['settings', 'apiKey', 'plans', 'radar', 'paymentSettings', 'clientMonitor'].includes(hash)) return hash as any;
    return 'main';
  };
  const [activePage, setActivePage] = useState<'main' | 'settings' | 'apiKey' | 'plans' | 'radar' | 'paymentSettings' | 'clientMonitor' | 'profile'>(getPageFromHash);
  const [showForm, setShowForm] = useState(true);
  const [isScanningFinished, setIsScanningFinished] = useState(() => localStorage.getItem('radar_scan_finished') === 'true');
  const [foundAnyStrong, setFoundAnyStrong] = useState(false);
  const [activeSubscription, setActiveSubscription] = useState<{ label: string; amount: number; expiryDate: string } | null>(() => {
    try {
      const saved = localStorage.getItem('active_subscription');
      if (!saved) return null;
      const sub = JSON.parse(saved);
      if (new Date(sub.expiryDate) < new Date()) {
        localStorage.removeItem('active_subscription');
        return null;
      }
      return sub;
    } catch { return null; }
  });

  const isDeveloperSession = () => {
    // 1. URL parameter bypass — add ?dev or ?owner=1 to any URL to bypass as developer
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('dev') || params.get('owner') === '1') {
        localStorage.setItem('finalyze_dev_bypass_active', 'true');
        return true;
      }
    }
    // 2. Standard localStorage flag
    if (localStorage.getItem('finalyze_dev_bypass_active') === 'true') return true;
    // 3. User email checks
    if (!user) return false;
    const email = user.email || '';
    const activeDevEmail = localStorage.getItem('finalyze_dev_email') || 'bachasalman69@gmail.com';
    return email === activeDevEmail ||
           email === 'bachasalman69@gmail.com' ||
           email === 'taybekraa@gmail.com' ||
           email.includes('dev');
  };

  const hasActivePlan = useMemo((): boolean => {
    if (isDeveloperSession()) return true;
    if (activeSubscription && new Date(activeSubscription.expiryDate) > new Date()) return true;
    if (freemiumDisabled) return true;
    // Double-check localStorage directly as failsafe
    if (localStorage.getItem('finalyze_freemium_disabled') === 'true') return true;
    return false;
  }, [user, activeSubscription, freemiumDisabled]);
  
  
  interface ClientRecord {
    id: string;
    email: string;
    uid: string;
    status: 'verified' | 'pending' | 'banned';
    plan: 'free' | 'paid';
    planExpiry: string | null;
    registeredAt: any;
    rank: number;
  }
  const [clients, setClients] = useState<ClientRecord[]>([]);

  const fetchClients = async () => {
    // Merge Firestore clients with localStorage fallback
    const localClients: ClientRecord[] = JSON.parse(localStorage.getItem('finalyze_clients') || '[]');
    try {
      const q = query(collection(db, 'clients'), orderBy('rank', 'asc'));
      const snap = await getDocs(q);
      const fsClients = snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientRecord));
      const fsEmails = new Set(fsClients.map(c => c.email));
      const merged = [...fsClients, ...localClients.filter(c => !fsEmails.has(c.email))];
      // Sync localStorage with merged data so all clients persist locally
      localStorage.setItem('finalyze_clients', JSON.stringify(merged));
      setClients(merged);
    } catch (e) {
      console.warn('Failed to fetch clients from Firestore, using local cache:', e);
      setClients(localClients);
    }
  };

  const saveClientRecord = async (uid: string, email: string) => {
    try {
      const existing = await getDocs(query(collection(db, 'clients'), where('uid', '==', uid)));
      if (!existing.empty) return;
      const count = (await getDocs(collection(db, 'clients'))).size;
      await addDoc(collection(db, 'clients'), {
        email, uid, status: 'inactive', plan: 'free', planExpiry: null,
        registeredAt: serverTimestamp(), rank: count + 1,
      });
    } catch (e) {
      console.warn('Failed to save client record:', e);
    }
  };

  const updateClientStatus = async (uid: string, status: 'active' | 'inactive' | 'banned') => {
    try {
      const snap = await getDocs(query(collection(db, 'clients'), where('uid', '==', uid)));
      if (!snap.empty) {
        await updateDoc(doc(db, 'clients', snap.docs[0].id), { status });
        fetchClients();
      }
    } catch (e) { console.warn('Failed to update client status:', e); }
  };

  const banClient = async (clientId: string) => {
    await updateDoc(doc(db, 'clients', clientId), { status: 'banned' });
    fetchClients();
  };

  const deleteClientRecord = async (clientId: string) => {
    await deleteDoc(doc(db, 'clients', clientId));
    fetchClients();
  };

  const renewClientPlan = async (clientId: string, days: number) => {
    const exp = new Date();
    exp.setDate(exp.getDate() + days);
    await updateDoc(doc(db, 'clients', clientId), { plan: 'paid', planExpiry: exp.toISOString() });
    fetchClients();
  };

  const [settings, setSettings] = useState<StrategySettings>(() => {
    const saved = localStorage.getItem('strategy_settings');
    if (saved) {
      try { return { ...DEFAULT_STRATEGY_SETTINGS, ...JSON.parse(saved) }; } catch (e) { return DEFAULT_STRATEGY_SETTINGS; }
    }
    return DEFAULT_STRATEGY_SETTINGS;
  });

  const [autoSettings, setAutoSettings] = useState<AutoAnalysisSettings>(() => {
    const saved = localStorage.getItem('auto_settings');
    let base = DEFAULT_AUTO_SETTINGS;
    if (saved) {
      try { base = { ...base, ...JSON.parse(saved) }; } catch (e) { base = DEFAULT_AUTO_SETTINGS; }
    }
    return base;
  });

  useEffect(() => {
    localStorage.setItem('auto_settings', JSON.stringify(autoSettings));
  }, [autoSettings]);
  const autoSettingsRef = useRef(autoSettings);
  useEffect(() => {
    autoSettingsRef.current = autoSettings;
  }, [autoSettings]);

  useEffect(() => {
    localStorage.setItem('radar_scan_finished', isScanningFinished.toString());
  }, [isScanningFinished]);

  const [isRadarUnlocked, setIsRadarUnlocked] = useState(false);

  const [customAudioUrls, setCustomAudioUrls] = useState<{ success?: string, fail?: string }>({});

  const loadCustomAudio = async () => {
    try {
      const { getAudioBlob } = await import('./lib/db');
      const successBlob = await getAudioBlob('custom_success');
      const failBlob = await getAudioBlob('custom_fail');
      
      setCustomAudioUrls(prev => {
        // Revoke old object URLs to avoid memory leaks
        if (prev.success) URL.revokeObjectURL(prev.success);
        if (prev.fail) URL.revokeObjectURL(prev.fail);
        return {
          success: successBlob ? URL.createObjectURL(successBlob) : undefined,
          fail: failBlob ? URL.createObjectURL(failBlob) : undefined
        };
      });
    } catch (e) {
      console.warn("Failed to load custom audio from DB", e);
    }
  };

  // Load persistent custom audio from IndexedDB on startup or settings change
  useEffect(() => {
    loadCustomAudio();
  }, [autoSettings.successSound, autoSettings.failSound]);

  // Listen to custom audio update events for hot-reloading new uploads
  useEffect(() => {
    const handleAudioChange = () => {
      loadCustomAudio();
    };
    window.addEventListener('custom-audio-updated', handleAudioChange);
    return () => window.removeEventListener('custom-audio-updated', handleAudioChange);
  }, []);

  // Sync URL hash with activePage so refreshes keep the same page
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if ((hash || 'main') !== activePage) {
      window.location.hash = activePage === 'main' ? '' : activePage;
    }
  }, [activePage]);

  useEffect(() => {
    const onHashChange = () => setActivePage(getPageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
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

  // Global automatic silent audio unlock on first user interaction (click/touch)
  useEffect(() => {
    const unlockAudio = () => {
      const successAudio = successAudioRef.current;
      const failAudio = failAudioRef.current;

      if (successAudio) {
        successAudio.play()
          .then(() => {
            successAudio.pause();
            successAudio.currentTime = 0;
          })
          .catch(e => console.log("Success audio silent unlock failed:", e));
      }

      if (failAudio) {
        failAudio.play()
          .then(() => {
            failAudio.pause();
            failAudio.currentTime = 0;
          })
          .catch(e => console.log("Fail audio silent unlock failed:", e));
      }

      setIsRadarUnlocked(true);

      // Clean up event listeners immediately after first user interaction
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('mousedown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('mousedown', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('mousedown', unlockAudio);
    };
  }, []);

  const playAudio = (type?: 'success' | 'fail') => {
    const audioEl = type === 'success' ? successAudioRef.current : failAudioRef.current;
    
    if (audioEl) {
      audioEl.volume = Math.max(0, Math.min(1, autoSettings.volume || 0.5));
      audioEl.currentTime = 0; // Force restart
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => console.warn(`Audio playback blocked/interrupted (${type}):`, e));
      }
    }
  };

  const handleUnlockRadar = () => {
    // Legacy support for header trigger, but global unlock listener already guarantees freedom!
    setIsRadarUnlocked(true);
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

  const saveStrategySettings = () => {
    localStorage.setItem('strategy_settings', JSON.stringify(settings));
  };
  const saveAutoSettings = () => {
    localStorage.setItem('auto_settings', JSON.stringify(autoSettings));
  };

  const updateTopSignals = (results: AnalysisResult[]) => {
    let changed = false;
    let hasBrandNewSymbol = false;
    let updated = [...signalsRef.current];

    results.forEach(res => {
      const isStrong = res.confidence >= settings.minStrongConfidence && (res.signal === 'strong_buy' || res.signal === 'strong_sell');
      
      if (isStrong) {
        const index = updated.findIndex(s => s.symbol === res.symbol);
        if (index >= 0) {
          if (updated[index].timestamp !== res.timestamp) {
            changed = true;
          }
          updated[index] = res;
        } else {
          updated.unshift(res);
          changed = true;
          hasBrandNewSymbol = true;
        }
      } else {
        const prevLength = updated.length;
        updated = updated.filter(s => s.symbol !== res.symbol);
        if (updated.length < prevLength) changed = true;
      }
    });

    if (changed) {
      // Resolve conflicts: when buy & sell coexist in same cluster, keep only the best
      const resolved = resolveConflicts(updated);
      setTopSignals(resolved.slice(0, 15));
      
      if (hasBrandNewSymbol) {
        setTimeout(() => {
          playAudio('success');
        }, 400);
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
  const prevEnabledRef = useRef(false);
  const prevConfigRef = useRef({
    interval: autoSettings.interval,
    timeframe: autoSettings.timeframe,
    category: autoSettings.category,
    tradingStyle: autoSettings.tradingStyle
  });

  useEffect(() => {
    const saved = localStorage.getItem('auto_settings');
    const savedIsEnabled = saved ? (() => { try { return JSON.parse(saved).isEnabled === true; } catch { return false; } })() : false;
    // Respect user toggle-off even if localStorage still has enabled=true
    if (!autoSettings.isEnabled && prevEnabledRef.current) {
      prevEnabledRef.current = false;
      return;
    }
    if (!autoSettings.isEnabled && !savedIsEnabled) {
      prevEnabledRef.current = false;
      return;
    }
    // Override ref from localStorage on mount to bypass state initialization bug
    if (!autoSettings.isEnabled && savedIsEnabled && !prevEnabledRef.current) {
      autoSettingsRef.current = { ...autoSettingsRef.current, isEnabled: true };
    }

    let isSubscribed = true;
    let timeoutId: NodeJS.Timeout;

    // Detect if the user just clicked/toggled the Radar ON
    const justToggledOn = !prevEnabledRef.current;
    
    // Detect if any configuration settings changed
    const configChanged = 
      prevConfigRef.current.interval !== autoSettings.interval ||
      prevConfigRef.current.timeframe !== autoSettings.timeframe ||
      prevConfigRef.current.category !== autoSettings.category ||
      prevConfigRef.current.tradingStyle !== autoSettings.tradingStyle;

    // Update refs for next run
    prevEnabledRef.current = true;
    prevConfigRef.current = {
      interval: autoSettings.interval,
      timeframe: autoSettings.timeframe,
      category: autoSettings.category,
      tradingStyle: autoSettings.tradingStyle
    };

    const runAutoScan = async () => {
      if (!isSubscribed || isAnalyzing) {
        timeoutId = setTimeout(runAutoScan, 5000);
        return;
      }

      const currentSettings = autoSettingsRef.current;
      const categories = currentSettings.category === 'all' 
        ? Object.keys(SYMBOL_CATEGORIES) as (keyof typeof SYMBOL_CATEGORIES)[]
        : (currentSettings.category || 'all').split(',') as (keyof typeof SYMBOL_CATEGORIES)[];

      // Check if any category is actually open
      const openCategories = categories.filter(isMarketOpen);
      if (openCategories.length === 0) {
        setIsScanningFinished(true);
        timeoutId = setTimeout(runAutoScan, 30000); // Check again in 30s
        return;
      }

      setIsScanningFinished(false);

      // Respect user deleted/hidden symbols in all categories
      let hiddenSymbols: string[] = [];
      let customSymbols: string[] = [];
      try {
        const savedHidden = localStorage.getItem('finalyze_hidden_symbols');
        hiddenSymbols = savedHidden ? JSON.parse(savedHidden) : [];
        const savedCustom = localStorage.getItem('finalyze_custom_symbols');
        customSymbols = savedCustom ? JSON.parse(savedCustom) : [];
      } catch (e) {
        console.warn("Failed to load symbols for auto scan:", e);
      }

      for (const cat of openCategories) {
        // FREE plan: only scan FREE_SYMBOLS, otherwise unify like manual form
        const symbols = hasActivePlan
          ? (() => {
              const allGroupsSymbols = SYMBOL_GROUPS[cat]?.flatMap(g => g.symbols) || [];
              const customForType = customSymbols.filter(s => 
                (ALL_SYMBOLS_DB[cat] || []).includes(s) &&
                !allGroupsSymbols.includes(s)
              );
              const allSymbolsCombined = [...allGroupsSymbols, ...customForType];
              return allSymbolsCombined.filter(s => !hiddenSymbols.includes(s));
            })()
          : (FREE_SYMBOLS[cat] || []);
        
        const mType = cat === 'crypto' ? MarketType.CRYPTO : 
                      cat === 'stocks' ? MarketType.STOCKS :
                      cat === 'metals' ? MarketType.METALS : MarketType.FOREX;

        for (const symbol of symbols) {
          if (!isSubscribed || !autoSettingsRef.current.isEnabled || isAnalyzing) break;
          // Check if client is banned (via API key / email)
          if (user?.email) {
            try {
              const statusSnap = await getDocs(query(collection(db, 'clients'), where('email', '==', user.email)));
              const clientData = statusSnap.docs[0]?.data();
              if (clientData?.status === 'banned') {
                try { localStorage.removeItem('finalyze_key1_value'); localStorage.removeItem('finalyze_user_groq_api_key'); } catch {}
                setHasApiKey(false);
                break;
              }
            } catch {}
          }
          try {
            const tf = !hasActivePlan ? '1d' : currentSettings.timeframe;
            const ts = !hasActivePlan ? TradingStyle.DAY_TRADING : currentSettings.tradingStyle;
            const result = await analyzeMarket({
              symbol, type: mType, timeframe: tf,
              tradingStyle: ts, settings, lang
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
            await new Promise(r => setTimeout(r, 6000));
          } catch (e) { 
            console.error("Analysis Loop Error:", e);
            await new Promise(r => setTimeout(r, 8000));
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

    // If just toggled ON or if configuration changed, force an immediate start (delay of 1000ms)
    const nextScanAt = (justToggledOn || configChanged || autoSettings.forceRestart) ? 0 : parseInt(localStorage.getItem('radar_next_scan_at') || '0');
    const now = Date.now();
    let initialDelay = 1000;

    if (now < nextScanAt) {
      initialDelay = nextScanAt - now;
      setIsScanningFinished(true);
    } else {
      setIsScanningFinished(false);
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
    // Clear stale auth state on mount
    localStorage.removeItem('finalyze_verify_link');
    setLoginError(null);
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
        }
      })
      .catch((error: any) => {
        console.error("Redirect login failure on mount:", error);
      })
      .finally(() => {
        setRedirecting(false);
      });
  }, []);

  useEffect(() => {
    // 1. Check if we have a persistent custom session
    const savedUserJson = localStorage.getItem('finalyze_auth_user');
    const savedTimestampStr = localStorage.getItem('finalyze_auth_timestamp');

    if (savedUserJson && savedTimestampStr) {
      try {
        const savedUser = JSON.parse(savedUserJson) as User;
        const savedTimestamp = parseInt(savedTimestampStr, 10);
        const email = savedUser.email || '';

        // Check if the user is a developer:
        const activeDevEmail = localStorage.getItem('finalyze_dev_email') || 'bachasalman69@gmail.com';
        const isDeveloper = email === activeDevEmail ||
                            email === 'bachasalman69@gmail.com' || 
                            email === 'taybekraa@gmail.com' || 
                            email.includes('dev') ||
                            localStorage.getItem('finalyze_dev_bypass_active') === 'true';

        if (isDeveloper) {
          // Keep developer session active forever
          setUser(savedUser);
          setHasApiKey(true);
          persistNeedsApiKey(null);
          setLoading(false);
          return;
        } else {
          // Regular client session expires after 3 days (3 * 24 * 60 * 60 * 1000 ms)
          const elapsed = Date.now() - savedTimestamp;
          const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
          if (elapsed < threeDaysInMs) {
            setUser(savedUser);
            const localKey = (() => {
              const k1 = localStorage.getItem('finalyze_key1_value');
              if (k1 && localStorage.getItem('finalyze_key1_enabled') !== 'false') return k1;
              return localStorage.getItem('finalyze_user_groq_api_key') || '';
            })();
            if (localKey) {
              setHasApiKey(true);
            } else {
              setHasApiKey(false);
            }
            persistNeedsApiKey(null);
            setLoading(false);
            return;
          } else {
            // Session expired! Clear custom keys
            localStorage.removeItem('finalyze_auth_user');
            localStorage.removeItem('finalyze_auth_timestamp');
            localStorage.removeItem('finalyze_dev_bypass_active');
          }
        }
      } catch (e) {
        console.error("Failed to restore persistent custom session:", e);
      }
    }

    // 2. Standard Firebase Auth listener
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      // Don't let state changes override custom persistent session if it is set
      if (localStorage.getItem('finalyze_auth_user')) {
        setLoading(false);
        return;
      }
      
      if (u) {
        setUser(u);
        const email = u.email || '';
        const activeDevEmail = localStorage.getItem('finalyze_dev_email') || 'bachasalman69@gmail.com';
        const isDeveloper = email === activeDevEmail || email === 'bachasalman69@gmail.com' || email === 'taybekraa@gmail.com' || email.includes('dev');

        // Fetch clients list for developer session
        if (isDeveloper || localStorage.getItem('finalyze_dev_bypass_active') === 'true') {
          fetchClients();
        }
        
        // Cache Firebase session in custom storage for 3-day / permanent benefits
        const mockCompactUser = {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName || 'User',
          photoURL: u.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
          emailVerified: u.emailVerified,
        };
        localStorage.setItem('finalyze_auth_user', JSON.stringify(mockCompactUser));
        localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());
        if (isDeveloper) {
          localStorage.setItem('finalyze_dev_bypass_active', 'true');
        }

        const localKey = localStorage.getItem('finalyze_key1_value') || localStorage.getItem('finalyze_user_groq_api_key');
        if (localKey) {
          setHasApiKey(true);
        } else {
          try {
            const userDoc = await getDoc(doc(db, 'users', u.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              if (data?.groqApiKey || data?.geminiApiKey) {
                localStorage.setItem('finalyze_user_groq_api_key', data.groqApiKey || data.geminiApiKey);
                localStorage.setItem('finalyze_key1_value', data.groqApiKey || data.geminiApiKey);
                localStorage.setItem('finalyze_key1_provider', 'groq');
                setHasApiKey(true);
              } else {
                setHasApiKey(false);
              }
            } else {
              setHasApiKey(false);
            }
          } catch (err) {
            console.error("Failed to load user API key from Firestore:", err);
            setHasApiKey(false);
          }
        }
      } else {
        setUser(null);
        setHasApiKey(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load clients from localStorage on mount (always, regardless of auth state)
  useEffect(() => {
    const localClients = JSON.parse(localStorage.getItem('finalyze_clients') || '[]');
    if (localClients.length > 0) {
      setClients(localClients);
    }
    // Also try Firestore in background
    fetchClients();
  }, []);

  // Fetch clients on mount if developer bypass is active
  useEffect(() => {
    if (!loading && isDeveloperSession()) {
      fetchClients();
    }
  }, [loading]);

  // Sync freemium state from localStorage (when PaymentModal toggles it)
  useEffect(() => {
    const sync = () => setFreemiumDisabled(localStorage.getItem('finalyze_freemium_disabled') === 'true');
    window.addEventListener('freemium-toggle', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('freemium-toggle', sync); window.removeEventListener('storage', sync); };
  }, []);

  // Handle email verification from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vEmail = params.get('email');
    const vToken = params.get('token');
    const isVerify = params.get('verify') === 'true';

    if (isVerify && vEmail && vToken) {
      (async () => {
        try {
          const snap = await getDocs(query(collection(db, 'clients'), where('email', '==', vEmail), where('verifyToken', '==', vToken)));
          if (!snap.empty) {
            const docRef = doc(db, 'clients', snap.docs[0].id);
            await updateDoc(docRef, { status: 'verified', verifyToken: '' });
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
            // Auto sign-in anonymously and redirect to API key setup
            localStorage.setItem('finalyze_auth_user', JSON.stringify({ email: vEmail, placeholder: true }));
            localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());
            localStorage.removeItem('finalyze_dev_bypass_active');
            localStorage.removeItem('active_subscription');
            const cred = await signInAnonymously(auth);
            const mockUser = {
              uid: cred.user.uid, email: vEmail,
              displayName: 'Client',
              photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150',
              emailVerified: true,
            } as User;
            setUser(mockUser);
            persistNeedsApiKey(null);
          } else {
            alert(lang === 'ar' ? '❌ رابط التفعيل غير صالح أو منتهي.' : '❌ Invalid or expired verification link.');
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch (e) {
          console.error('Verification error:', e);
          window.history.replaceState({}, '', window.location.pathname);
        }
      })();
    }
  }, [loading]);

  const handleLogin = async () => {
    setActivePage('main');
    setPaymentPlan(null);
    setAnalysisResults(null);
    setIsSidebarOpen(false);
    setLoginError(null);
    setManualAuthUrl(null);
    setRedirecting(true);
    let googleUserEmail = '';
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const email = result?.user?.email || result?.user?.providerData?.[0]?.email || '';
      if (!email) { throw new Error('no_email'); }
      googleUserEmail = email;

      // Developer emails → sign in directly
      if (email === 'taybekraa@gmail.com' || email === 'bachasalman69@gmail.com' || email.includes('dev')) {
        await signOut(auth);
        setUser({ uid: 'dev_' + email.replace(/[^a-zA-Z0-9]/g, ''), email, displayName: 'Developer', emailVerified: true } as User);
        return;
      }

      // Try to save as pending client and send email
      try {
        const existingSnap = await getDocs(query(collection(db, 'clients'), where('email', '==', email)));
        const existing = existingSnap.docs[0]?.data();

        // Restore API key from Firestore if missing from localStorage
        if (existing?.groqApiKey && !hasAnyStoredKey()) {
          localStorage.setItem('finalyze_user_groq_api_key', existing.groqApiKey);
          localStorage.setItem('finalyze_key1_value', existing.groqApiKey);
          localStorage.setItem('finalyze_key1_provider', 'groq');
        }

        // Check if banned
        if (existing?.status === 'banned') {
          setLoginError(isAr ? 'هذا الحساب محظور. لا يمكنك تسجيل الدخول.' : 'This account is banned. You cannot log in.');
          setRedirecting(false);
          return;
        }

        if (existing?.status === 'verified') {
          // Already verified — sign in directly (keep existing API keys)
          await signOut(auth);
          const cred = await signInAnonymously(auth);
          localStorage.setItem('finalyze_auth_user', JSON.stringify({ email, placeholder: true }));
          localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());
          setUser({ uid: cred.user.uid, email, displayName: result.user.displayName || 'Client', photoURL: result.user.photoURL || '', emailVerified: true } as User);
          const hasKey = hasAnyStoredKey();
          setHasApiKey(hasKey);
          persistNeedsApiKey(null);
          return;
        }

        // New or existing pending — only clear API keys for truly new users
        const isNewUser = !existingSnap.docs[0];
        if (isNewUser) {
          localStorage.removeItem('finalyze_key1_value');
          localStorage.removeItem('finalyze_user_groq_api_key');
          setHasApiKey(false);
        }
        // New or pending — save to localStorage + Firestore, send email, show API key page
        await signOut(auth);
        const cred = await signInAnonymously(auth);
        // Save to localStorage immediately so Client Monitor shows all registered users
        // Save to Firestore as well (rules now published)
        try {
          const existingFs = await getDocs(query(collection(db, 'clients'), where('email', '==', email)));
          if (existingFs.docs[0]) {
            await updateDoc(doc(db, 'clients', existingFs.docs[0].id), { uid: cred.user.uid, status: 'pending' });
          } else {
            await addDoc(collection(db, 'clients'), {
              email, uid: cred.user.uid, status: 'pending', plan: 'free', planExpiry: null,
              registeredAt: serverTimestamp(), rank: 0,
            });
          }
        } catch (e) { console.warn('Firestore save on login failed:', e); }
        const verifyToken = Math.random().toString(36).slice(2, 15) + Date.now().toString(36);
        const verifyLink = `${window.location.origin}?verify=true&email=${encodeURIComponent(email)}&token=${verifyToken}`;
        // Send email (best effort)
        fetch('/api/send-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, verifyLink }) }).catch(() => {});
        // Sign in and show blocking API key page immediately
        localStorage.setItem('finalyze_auth_user', JSON.stringify({ email, placeholder: true }));
        localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());
        localStorage.setItem('finalyze_verify_link', verifyLink);
        setUser({ uid: cred.user.uid, email, displayName: result.user.displayName || 'Client', photoURL: result.user.photoURL || '', emailVerified: true } as User);
        // Only show blocking for truly new users without a saved key
        persistNeedsApiKey(isNewUser && !hasAnyStoredKey() ? email : null);
        return;
      } catch (innerErr) {
        // Firestore/anon auth failed — still sign user in with basic session
        console.error('Non-critical error during client setup:', innerErr);
        localStorage.setItem('finalyze_auth_user', JSON.stringify({ email, placeholder: true }));
        localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());
        setUser({ uid: 'fallback_' + Date.now(), email, displayName: result.user.displayName || 'Client', emailVerified: true } as User);
        const hasKey = hasAnyStoredKey();
        setHasApiKey(hasKey);
        if (!hasKey) {
          persistNeedsApiKey(email);
        } else {
          persistNeedsApiKey(null);
        }
        return;
      }
    } catch (error: any) {
      console.error("=== signInWithPopup ERROR ===", error);
      if (googleUserEmail) {
        // Popup succeeded but something else failed — sign in directly anyway
        localStorage.setItem('finalyze_auth_user', JSON.stringify({ email: googleUserEmail, placeholder: true }));
        localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());
        setUser({ uid: 'fallback_' + Date.now(), email: googleUserEmail, displayName: 'Client', emailVerified: true } as User);
        const hasKey = hasAnyStoredKey();
        setHasApiKey(hasKey);
        if (!hasKey) {
          persistNeedsApiKey(googleUserEmail);
        } else {
          persistNeedsApiKey(null);
        }
        return;
      }
      if (error.code === 'auth/unauthorized-domain') {
        setLoginError(`⛔ هذا النطاق (${window.location.hostname}) غير مسموح به في Firebase.`);
      } else if (error.code === 'auth/popup-closed-by-user') {
        setLoginError('تم إغلاق نافذة تسجيل الدخول. حاول مرة أخرى.');
      } else if (error.message === 'no_email') {
        setLoginError('لم نتمكن من الحصول على بريدك الإلكتروني. حاول مرة أخرى.');
      } else {
        setLoginError(`Google sign-in error: ${error.code || error.message}`);
      }
    } finally {
      setRedirecting(false);
    }
  };

  const handleClientAuth = async (email: string, password?: string) => {
    setActivePage('main');
    setPaymentPlan(null);
    setAnalysisResults(null);
    setIsSidebarOpen(false);
    setLoginError(null);
    try {
      // Check if client is already registered in Firestore
      const existingSnap = await getDocs(query(collection(db, 'clients'), where('email', '==', email)));
      const existing = existingSnap.docs[0];

      if (existing) {
        const data = existing.data();
        if (data.status === 'verified') {
          // Already verified — sign in directly
          localStorage.setItem('finalyze_auth_user', JSON.stringify({ email, placeholder: true }));
          localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());
          const cred = await signInAnonymously(auth);
          const mockUser = {
            uid: cred.user.uid, email,
            displayName: 'Client',
            photoURL: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150',
            emailVerified: true,
          } as User;
          setUser(mockUser);
          localStorage.setItem('finalyze_auth_user', JSON.stringify(mockUser));
          localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());
          localStorage.removeItem('finalyze_dev_bypass_active');
          localStorage.removeItem('active_subscription');
          setActiveSubscription(null);
          const hasKey = hasAnyStoredKey();
          setHasApiKey(hasKey);
          persistNeedsApiKey(null);
          return;
        }
        // Not verified — resend verification
        if (data.verifyToken) {
          // Sign in and show verification banner
          localStorage.setItem('finalyze_auth_user', JSON.stringify({ email, placeholder: true }));
          localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());
          const vLink = `${window.location.origin}/verify?email=${encodeURIComponent(email)}&token=${data.verifyToken}`;
          localStorage.setItem('finalyze_verify_link', vLink);
          setPendingVerifyLink(vLink);
          const cred = await signInAnonymously(auth);
          setUser({ uid: cred.user.uid, email, displayName: '', emailVerified: true } as User);
          return;
        }
      }

      // New client registration
      if (!password) {
        setLoginError('auth/weak-password');
        return;
      }

      // Generate verification token
      const verifyToken = Math.random().toString(36).slice(2, 15) + Date.now().toString(36);
      const verifyLink = `${window.location.origin}/verify?email=${encodeURIComponent(email)}&token=${verifyToken}`;

      // Simple hash for password (client-side, for demo purposes)
      const pwdHash = btoa(password + ':finalyze_salt');

      // Save to Firestore
      const cred = await signInAnonymously(auth);
      await addDoc(collection(db, 'clients'), {
        email, uid: cred.user.uid, password: pwdHash, verifyToken,
        status: 'pending', plan: 'free', planExpiry: null,
        registeredAt: serverTimestamp(), rank: 0,
      });

      // Sign in directly and show verification banner on main page
      localStorage.setItem('finalyze_auth_user', JSON.stringify({ email, placeholder: true }));
      localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());
      localStorage.setItem('finalyze_verify_link', verifyLink);
      setPendingVerifyLink(verifyLink);
      const mockUser = {
        uid: cred.user.uid, email, displayName: '', emailVerified: true,
      } as User;
      setUser(mockUser);
    } catch (err: any) {
      localStorage.removeItem('finalyze_auth_user');
      localStorage.removeItem('finalyze_auth_timestamp');
      if (err.code === 'auth/network-request-failed') {
        setLoginError('auth/network-request-failed');
      } else {
        setLoginError(err.code || err.message);
      }
    }
  };

  const handleBypassLogin = (email?: string) => {
    setActivePage('main');
    setPaymentPlan(null);
    setAnalysisResults(null);
    setIsSidebarOpen(false);
    const activeDevEmail = localStorage.getItem('finalyze_dev_email') || 'bachasalman69@gmail.com';
    const finalEmail = email || activeDevEmail;
    
    const isDeveloper = finalEmail === activeDevEmail || 
                        finalEmail === 'bachasalman69@gmail.com' || 
                        finalEmail === 'taybekraa@gmail.com' || 
                        finalEmail.includes('dev');
                        
    const mockUser = {
      uid: 'mock_uid_' + finalEmail.replace(/[^a-zA-Z0-9]/g, ''),
      email: finalEmail,
      displayName: isDeveloper ? 'Developer' : 'Premium Subscriber',
      photoURL: isDeveloper 
        ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150'
        : 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150',
      emailVerified: true,
    } as User;

    setUser(mockUser);
    localStorage.setItem('finalyze_auth_user', JSON.stringify(mockUser));
    localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());
    
    if (isDeveloper) {
      localStorage.setItem('finalyze_dev_bypass_active', 'true');
      fetchClients();
    } else {
      localStorage.removeItem('finalyze_dev_bypass_active');
      // Grant premium access for bypass login clients
      const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 10).toISOString();
      const premiumSub = { label: 'Premium', amount: 0, expiryDate: farFuture };
      localStorage.setItem('active_subscription', JSON.stringify(premiumSub));
      setActiveSubscription(premiumSub);
    }
    
    setHasApiKey(hasAnyStoredKey());
    setLoginError(null);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("SignOut firebase warning:", e);
    }
    localStorage.removeItem('finalyze_dev_bypass_active');
    localStorage.removeItem('finalyze_auth_user');
    localStorage.removeItem('finalyze_auth_timestamp');
    localStorage.removeItem('finalyze_verify_link');
    persistNeedsApiKey(null);
    setNeedsApiKeyState(null);
    setHasApiKey(false);
    setPaymentPlan(null);
    setActiveSubscription(null);
    setAnalysisResults(null);
    setUser(null);
    setPendingVerifyLink(null);
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
        key={customAudioUrls.success || 'success_default'}
        ref={successAudioRef} 
        src={autoSettings.successSound === 'custom' ? customAudioUrls.success : (autoSettings.successSound || 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg')} 
        preload="auto" 
      />
      <audio 
        key={customAudioUrls.fail || 'fail_default'}
        ref={failAudioRef} 
        src={autoSettings.failSound === 'custom' ? customAudioUrls.fail : (autoSettings.failSound || 'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg')} 
        preload="auto" 
      />

      <AnimatePresence>
        {!user && !loading && (
          <LoginOverlay 
            onLogin={handleLogin} 
            onBypassLogin={handleBypassLogin}
            onClientAuth={handleClientAuth}
            lang={lang} 
            loginError={loginError}
            onClearError={() => { setLoginError(null); setPendingVerifyLink(null); }}
            redirecting={redirecting}
            manualAuthUrl={manualAuthUrl}
          />
        )}
      </AnimatePresence>

      {/* Blocking API Key overlay — only for NEW users (not in finalyze_clients) */}
      {user && user.email && !hasApiKey && !isDeveloperSession() && !JSON.parse(localStorage.getItem('finalyze_clients') || '[]').some((c: any) => c.email === user.email) && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <ApiKeyModal
            key={user?.uid || 'no-session'}
            isOpen={true}
            onClose={() => {}}
            isBlocking={true}
            lang={lang}
            user={user}
            onSaved={async (apiKey) => {
              setHasApiKey(true);
              persistNeedsApiKey(null);
              setActivePage('main');
              // Save client to Firestore + localStorage after key validation
              const email = user?.email;
              if (email) {
                const newClient = {
                  id: 'local_' + Date.now(),
                  email,
                  uid: user?.uid || '',
                  status: 'pending' as const,
                  plan: 'free' as const,
                  planExpiry: null,
                  registeredAt: new Date().toISOString(),
                  rank: 0,
                  groqApiKey: apiKey,
                };
                // Save to localStorage as the permanent record
                const localClients: any[] = JSON.parse(localStorage.getItem('finalyze_clients') || '[]');
                const existingIdx = localClients.findIndex(c => c.email === email);
                if (existingIdx >= 0) {
                  localClients[existingIdx] = { ...localClients[existingIdx], groqApiKey: apiKey };
                } else {
                  localClients.push(newClient);
                }
                localStorage.setItem('finalyze_clients', JSON.stringify(localClients));
                fetchClients();
                // Try Firestore (best effort)
                try {
                  const existingSnap = await getDocs(query(collection(db, 'clients'), where('email', '==', email)));
                  if (existingSnap.docs[0]) {
                    await updateDoc(doc(db, 'clients', existingSnap.docs[0].id), { groqApiKey: apiKey });
                  } else {
                    await addDoc(collection(db, 'clients'), {
                      email, groqApiKey: apiKey,
                      status: 'pending', plan: 'free', planExpiry: null,
                      registeredAt: serverTimestamp(), rank: 0,
                    });
                  }
                } catch (e) { console.warn('Failed to save client to Firestore, localStorage fallback active:', e); }
              }
            }}
            onLogout={handleLogout}
            asPage
          />
        </div>
      )}

      <Header 
        user={user} onLogin={handleLogin} onLogout={handleLogout} 
        isDark={isDark} toggleTheme={() => setIsDark(!isDark)}
        lang={lang} onLangChange={setLang}
        showBack={!!analysisResults} onBack={() => setAnalysisResults(null)}
        autoSettings={autoSettings} onAutoSettingsChange={setAutoSettings}
        isWaiting={isScanningFinished}
        hasApiKey={hasApiKey || isDeveloperSession()}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Sidebar Panel - pushes content, doesn't overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <SidebarPanel
            lang={lang}
            onClose={() => setIsSidebarOpen(false)}
            onNavigate={(page) => { setActivePage(page); setIsSidebarOpen(false); }}
            isDeveloper={isDeveloperSession()}
            freemiumDisabled={freemiumDisabled}
          />
        )}
      </AnimatePresence>

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
      
      <main className={`flex-grow max-w-7xl mx-auto w-full px-4 py-8 pt-28 relative transition-all duration-300 ${isSidebarOpen ? (lang === 'ar' ? 'mr-56' : 'ml-56') : ''}`}>
        {/* Dedicated pages (from dashboard) */}
        {activePage !== 'main' && !needsApiKey && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <button
              onClick={() => setActivePage('main')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-alt border border-white/10 text-brand-muted hover:text-brand-text transition-colors mb-6"
            >
              <ArrowLeft size={18} />
              <span className="text-xs font-black uppercase tracking-widest">
                {lang === 'ar' ? 'العودة للرئيسية' : 'Back to Main'}
              </span>
            </button>

             {activePage === 'settings' && (
              <SettingsModal
                key={user?.uid || 'no-session'}
                isOpen={true}
                onClose={() => setActivePage('main')}
                settings={settings}
                onSettingsChange={(s) => { setSettings(s); }}
                onSave={saveStrategySettings}
                user={user}
                asPage
                lang={lang}
              />
            )}

            {activePage === 'apiKey' && (
              <ApiKeyModal
                key={user?.uid || 'no-session'}
                isOpen={true}
                onClose={() => setActivePage('main')}
                isBlocking={false}
                lang={lang}
                user={user}
                onSaved={() => { setHasApiKey(true); setActivePage('main'); }}
                onLogout={handleLogout}
                asPage
              />
            )}

            {activePage === 'plans' && !paymentPlan && (
              <SubscriptionModal
                key={user?.uid || 'no-session'}
                isOpen={true}
                onClose={() => setActivePage('main')}
                onSelectPlan={(amount, label, durationDays) => { setPaymentPlan({ amount, label, durationDays }); }}
                asPage
              />
            )}

            {activePage === 'plans' && paymentPlan && (
              <PaymentModal
                key={user?.uid || 'no-session'}
                isOpen={true}
                onClose={() => { setPaymentPlan(null); setActivePage('main'); }}
                planLabel={paymentPlan?.label || ''}
                amount={paymentPlan?.amount || 0}
                asPage
                lang={lang}
                onConfirm={() => {
                  const plan = paymentPlan!;
                  const expiryDate = new Date();
                  expiryDate.setDate(expiryDate.getDate() + plan.durationDays);
                  const sub = {
                    label: plan.label,
                    amount: plan.amount,
                    activatedAt: new Date().toISOString(),
                    expiryDate: expiryDate.toISOString(),
                  };
                  localStorage.setItem('active_subscription', JSON.stringify(sub));
                  setActiveSubscription(sub);
                  setPaymentPlan(null);
                  setActivePage('main');
                }}
              />
            )}

            {activePage === 'radar' && (
              <RadarSettingsPage
                key={user?.uid || 'no-session'}
                autoSettings={autoSettings}
                onAutoSettingsChange={setAutoSettings}
                onSave={saveAutoSettings}
                isWaiting={isScanningFinished}
                lang={lang}
                hasActivePlan={hasActivePlan}
                onUpgrade={() => setActivePage('plans')}
              />
            )}

            {activePage === 'paymentSettings' && (
              <PaymentModal
                key={user?.uid || 'no-session'}
                isOpen={true}
                onClose={() => setActivePage('main')}
                planLabel=""
                amount={0}
                asPage
                manageMode
                lang={lang}
                freemiumDisabled={freemiumDisabled}
                onFreemiumToggle={(v: boolean) => { setFreemiumDisabled(v); localStorage.setItem('finalyze_freemium_disabled', v ? 'true' : 'false'); }}
              />
            )}

            {activePage === 'clientMonitor' && isDeveloperSession() && (
              <ClientMonitor
                key={user?.uid || 'no-session'}
                clients={clients}
                lang={lang}
                onRefresh={fetchClients}
                onBan={banClient}
                onDelete={deleteClientRecord}
                onRenew={renewClientPlan}
                freemiumDisabled={freemiumDisabled}
                onFreemiumToggle={(v: boolean) => { setFreemiumDisabled(v); localStorage.setItem('finalyze_freemium_disabled', v ? 'true' : 'false'); }}
              />
            )}

            {activePage === 'profile' && (
              <div className="bg-brand-alt border border-white/10 rounded-[32px] p-6 md:p-8 max-w-lg mx-auto">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-black text-xl shadow-lg">
                    {user?.email?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">{lang === 'ar' ? 'الملف الشخصي' : 'Profile'}</h3>
                    <p className="text-sm text-slate-400">{user?.email || (lang === 'ar' ? 'زائر' : 'Guest')}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <span className="text-xs text-slate-500 font-bold block mb-1">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</span>
                    <span className="text-sm font-bold text-white">{user?.email || (lang === 'ar' ? 'غير مسجل' : 'Not logged in')}</span>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <span className="text-xs text-slate-500 font-bold block mb-1">{lang === 'ar' ? 'المعرف' : 'User ID'}</span>
                    <span className="text-sm font-mono text-white/70 break-all">{user?.uid || '—'}</span>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <span className="text-xs text-slate-500 font-bold block mb-1">{lang === 'ar' ? 'الخطة' : 'Plan'}</span>
                    <span className="text-sm font-bold text-emerald-400">{activeSubscription ? `${activeSubscription.label}` : (lang === 'ar' ? 'مجانية' : 'Free')}</span>
                  </div>
                  {activeSubscription && (
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                      <span className="text-xs text-slate-500 font-bold block mb-1">{lang === 'ar' ? 'تاريخ الانتهاء' : 'Expiry'}</span>
                      <span className="text-sm font-bold text-white">{new Date(activeSubscription.expiryDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
                <button onClick={() => setActivePage('main')} className="mt-6 w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm hover:bg-white/10 transition-all">
                  {lang === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* FORM - hidden during analysis, hidden when results show, hidden when ApiKey is needed */}
        <div style={{ display: isAnalyzing || analysisResults || activePage !== 'main' || !!needsApiKey ? 'none' : 'block' }}>
          {activeSubscription && (() => {
            const daysLeft = Math.ceil((new Date(activeSubscription.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 mb-6 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-emerald-400">{activeSubscription.label} Plan Active</span>
                  <span className="text-xs text-slate-500 mr-3">{daysLeft} days remaining</span>
                </div>
                <button
                  onClick={() => { localStorage.removeItem('active_subscription'); setActiveSubscription(null); }}
                  className="text-[10px] text-red-400 hover:text-red-300 underline"
                >
                  Cancel
                </button>
              </div>
            );
          })()}
          <TopSignals 
            signals={topSignals} onRemove={removeSignal} 
            onSelect={handleSelectSignal} onClearAll={() => setTopSignals([])}
            lang={lang} 
          />

          <PortfolioPanel signals={topSignals} lang={lang} />

          <div className="h-[10px] bg-emerald-500 rounded-full my-10 shadow-[0_0_20px_rgba(16,185,129,0.7)] border-t border-emerald-400/20" />

          <AnalysisForm 
             user={user} lang={lang} settings={settings}
             hasActivePlan={hasActivePlan}
             onUpgrade={() => setActivePage('plans')}
              onBegin={() => { setIsAnalyzing(true); setAnalysisError(null); }}
             onProgress={(current, total, index) => setProgress({ current, total, index })}
             onResult={(results) => {
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
                setAnalysisError(null);
                setProgress(null);
               updateTopSignals(filtered);
               playAudio('fail');
             }} 
              onError={(errMsg) => { setAnalysisResults([]); setAnalysisError(errMsg || null); setIsAnalyzing(false); setProgress(null); }}
          />
          <ConnectionStatus lang={lang} />
        </div>

        {/* Loading view - separate, no overlap with form */}
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center p-8 space-y-8 min-h-[60vh]">
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
          </div>
        )}

        {/* Results */}
        {analysisResults && !isAnalyzing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {analysisError && (
              <div className="max-w-4xl mx-auto mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm font-medium">{analysisError}</p>
                <button onClick={() => { setAnalysisResults(null); setAnalysisError(null); }} className="mt-2 text-xs text-red-400 hover:text-red-300 underline">
                  {lang === 'ar' ? 'حاول مرة أخرى' : 'Try again'}
                </button>
              </div>
            )}
            {!analysisError && <AnalysisResultView results={analysisResults} lang={lang} settings={settings} />}
          </motion.div>
        )}
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
