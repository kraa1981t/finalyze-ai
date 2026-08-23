import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut, signInAnonymously } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc, collection, addDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, where, setDoc, query, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { playSuccess, playFail, playCompletion, playStart, initAudio } from './lib/audioEngine';
import { trackPageView, trackClick } from './lib/tracking';
import { TrendingUp, Activity, ArrowLeft, Users, Shield } from 'lucide-react';
import Header from './components/Header';
import AnalysisForm from './components/AnalysisForm';
import AnalysisResultView from './components/AnalysisResultView';
import ConnectionStatus from './components/ConnectionStatus';
import LoginOverlay from './components/LoginOverlay';
import DevicePreview from './components/DevicePreview';
import SettingsModal from './components/SettingsModal';
import SidebarPanel from './components/SidebarPanel';
import TopSignals from './components/TopSignals';
import AdBanner from './components/AdBanner';
import PortfolioPanel from './components/PortfolioPanel';
import ClientDashboard from './components/ClientDashboard';
import AnalysisDetailPage from './components/AnalysisDetailPage';

import { AnalysisResult, StrategySettings, AutoAnalysisSettings, MarketType, TradingStyle } from './types';
import { DEFAULT_STRATEGY_SETTINGS, DEFAULT_AUTO_SETTINGS, SYMBOL_CATEGORIES, ALL_SYMBOLS_DB, SYMBOL_GROUPS, FREE_SYMBOLS } from './constants';
import { Language, translations } from './lib/i18n';
import { analyzeMarket, getApiKey } from './services/geminiService';
import { waitIfRateLimited } from './services/rateLimitTracker';
import { resolveConflicts } from './services/portfolioRiskService';
import ApiKeyModal from './components/ApiKeyModal';
import SubscriptionModal from './components/SubscriptionModal';
import PaymentModal from './components/PaymentModal';
import ProfilePage from './components/ProfilePage';
import AboutPage from './components/AboutPage';
import SuggestionsPage from './components/SuggestionsPage';
import TradeNowPage from './components/TradeNowPage';

function hasAnyStoredKey(): boolean {
  try {
    const k1 = localStorage.getItem('finalyze_key1_value');
    const k1en = localStorage.getItem('finalyze_key1_enabled') !== 'false';
    const oldKey = localStorage.getItem('finalyze_user_groq_api_key');
    return (!!k1 && k1en) || !!oldKey;
  } catch { return false; }
}
import ClientMonitor from './components/ClientMonitor';
import SiteStatsPage from './components/SiteStatsPage';
import AdsManager from './components/AdsManager';
import { AdSlot } from './components/AdsManager';
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
  const [detailResult, setDetailResult] = useState<AnalysisResult | null>(null);
  const [clientSignals, setClientSignals] = useState<AnalysisResult[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('finalyze_client_signals') || '[]');
      return saved.filter((s: any) => !s.isSideways);
    } catch { return []; }
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'en');
  useEffect(() => {
    localStorage.setItem('language', lang);
  }, [lang]);
  // Cleanup old API key artifacts on mount
  useEffect(() => {
    try {
      const k1 = localStorage.getItem('finalyze_key1_value');
      const old = localStorage.getItem('finalyze_user_groq_api_key');
      if (old && old === k1) localStorage.removeItem('finalyze_user_groq_api_key');
      if (old && !old.startsWith('gsk_') && !old.startsWith('AIzaSy') && !old.startsWith('AQ.')) localStorage.removeItem('finalyze_user_groq_api_key');
      localStorage.removeItem('finalyze_key1_provider');
      localStorage.removeItem('finalyze_key2_value');
    } catch {}
  }, []);
  const [isDark, setIsDark] = useState<boolean>(() => localStorage.getItem('theme') !== 'light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [newSuggestionsCount, setNewSuggestionsCount] = useState(0);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsPWA(standalone);
  }, []);
  const [freemiumDisabled, setFreemiumDisabled] = useState(() => localStorage.getItem('finalyze_freemium_disabled') === 'true');
  const [clientLoginRequired, setClientLoginRequired] = useState(() => localStorage.getItem('finalyze_client_login_required') === 'true');
  const [needsApiKey, setNeedsApiKeyState] = useState<string | null>(() => {
    try { return localStorage.getItem('finalyze_needs_api_key'); } catch { return null; }
  });
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
  const getPageFromHash = (): 'main' | 'settings' | 'apiKey' | 'plans' | 'radar' | 'paymentSettings' | 'clientMonitor' | 'profile' | 'about' | 'suggestions' | 'ads' | 'siteStats' | 'trade' => {
    const hash = window.location.hash.slice(1);
    if (['settings', 'apiKey', 'plans', 'radar', 'paymentSettings', 'clientMonitor', 'profile', 'about', 'suggestions', 'ads', 'siteStats', 'trade'].includes(hash)) return hash as any;
    return 'main';
  };
  const [activePage, setActivePage] = useState<'main' | 'settings' | 'apiKey' | 'plans' | 'radar' | 'paymentSettings' | 'clientMonitor' | 'profile' | 'about' | 'suggestions' | 'ads' | 'siteStats' | 'trade'>(getPageFromHash);
  const navStackRef = useRef<string[]>([]);

  const navigateTo = (page: any) => {
    if (page !== activePage) {
      navStackRef.current.push(activePage);
      setActivePage(page);
      if (!isDeveloperSession()) trackPageView(page).catch(() => {});
    }
  };

  const goBack = () => {
    if (navStackRef.current.length > 0) {
      const prev = navStackRef.current.pop()!;
      setActivePage(prev);
    } else {
      setActivePage('main');
    }
  };

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.page) {
        setActivePage(e.state.page);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [showForm, setShowForm] = useState(true);
  const [isScanningFinished, setIsScanningFinished] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('auto_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // If radar is enabled, start as "waiting" (yellow), not scanning (green)
        return parsed.isEnabled === true;
      }
    } catch {}
    return false;
  });
  const [foundAnyStrong, setFoundAnyStrong] = useState(false);
  const [newSignalAlert, setNewSignalAlert] = useState<string | null>(null);
  // CLIENT: Radar status from developer
  const [clientRadarRunning, setClientRadarRunning] = useState(false);
  const [showRadarComplete, setShowRadarComplete] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'phone' | 'tablet' | null>(null);
  const prevRadarRunningRef = useRef(false);
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

  const DEV_EMAILS = ['taybekraa@gmail.com', 'kraakraa109@gmail.com', 'bachasalman69@gmail.com'];

  const isDeveloperSession = () => {
    if (!user) return false;
    const email = (user.email || '').toLowerCase().trim();
    return DEV_EMAILS.includes(email);
  };

  const DEV_ONLY_PAGES = ['clientMonitor', 'ads', 'siteStats'];
  const effectivePage = (DEV_ONLY_PAGES.includes(activePage) && !isDeveloperSession()) ? 'main' : activePage;

  // CLIENT: Mirror results from developer via Firestore ΓÇö poll collection every 10s, NO orderBy
  useEffect(() => {
    if (isDeveloperSession()) return;
    // Allow if user is logged in OR if login is not required (guest mode)
    if (!user && clientLoginRequired) return;
    console.log('[CLIENT] Setting up Firestore polling for shared_results');

    const isFirstLoad = !localStorage.getItem('finalyze_client_signals');
    let hasPlayedFirstSound = false;

    const loadFromFirestore = async () => {
      try {
        console.log('[CLIENT] Polling shared_results collection...');
        const snap = await getDocs(collection(db, 'shared_results'));
        console.log(`[CLIENT] Found ${snap.size} docs in shared_results`);
        
        if (snap.empty) {
          console.warn('[CLIENT] shared_results collection is empty');
          setClientSignals([]);
          localStorage.removeItem('finalyze_client_signals');
          return;
        }
        
        // Find the latest doc by comparing timestamps (handle string, Date, Timestamp, number)
        let latestData: any = null;
        let latestTs = 0;
        
        snap.forEach(d => {
          const dta = d.data();
          let ts = 0;
          if (dta.timestamp) {
            if (typeof dta.timestamp === 'string') ts = new Date(dta.timestamp).getTime();
            else if (typeof dta.timestamp === 'object' && dta.timestamp.toMillis) ts = dta.timestamp.toMillis();
            else if (dta.timestamp instanceof Date) ts = dta.timestamp.getTime();
            else if (typeof dta.timestamp === 'number') ts = dta.timestamp;
          }
          if (ts >= latestTs) { latestTs = ts; latestData = dta; }
        });
        
        if (!latestData) {
          console.warn('[CLIENT] No docs with valid timestamp found');
          setClientSignals([]);
          localStorage.removeItem('finalyze_client_signals');
          return;
        }
        
        const results = latestData.results;
        if (!results || !Array.isArray(results) || results.length === 0) {
          console.warn('[CLIENT] Latest doc has no results array, clearing');
          setClientSignals([]);
          localStorage.removeItem('finalyze_client_signals');
          return;
        }
        
        const strongCount = results.filter((r: any) => r.signal === 'strong_buy' || r.signal === 'strong_sell').length;
        console.log(`[CLIENT] Setting ${results.length} signals (${strongCount} strong)`);
        
        // Alert for any new signal (any symbol not seen before)
        const currentSignals = JSON.parse(localStorage.getItem('finalyze_client_signals') || '[]');
        const currentSymbols = new Set(currentSignals.map((s: any) => s.symbol));
        const newSignals = results.filter((r: any) => !currentSymbols.has(r.symbol));
        const hasNewSignal = newSignals.length > 0;

        // Play sound on first load if signals exist
        if (isFirstLoad && !hasPlayedFirstSound && results.length > 0) {
          hasPlayedFirstSound = true;
          const symbols = results.map((r: any) => r.symbol).join(' ΓÇó ');
          setNewSignalAlert(lang === 'ar' ? `\u062a\u0646\u0628\u064a\u0647 \u0641\u0631\u0635\u0629 \u062c\u062f\u064a\u062f\u0629 \u2014 ${symbols}` : `New Opportunity Alert \u2014 ${symbols}`);
          setTimeout(() => setNewSignalAlert(null), 10000);
          try { playAudio('success'); } catch {}
        }
        // Play sound when any new opportunity arrives
        else if (hasNewSignal) {
          const newSymbols = newSignals.map((r: any) => r.symbol).join(' ΓÇó ');
          setNewSignalAlert(lang === 'ar' ? `\u062a\u0646\u0628\u064a\u0647 \u0641\u0631\u0635\u0629 \u062c\u062f\u064a\u062f\u0629 \u2014 ${newSymbols}` : `New Opportunity Alert \u2014 ${newSymbols}`);
          setTimeout(() => setNewSignalAlert(null), 10000);
          try { playAudio('success'); } catch {}
        }
        
        setClientSignals(results.filter((r: any) => !r.isSideways));
        localStorage.setItem('finalyze_client_signals', JSON.stringify(results.filter((r: any) => !r.isSideways)));
      } catch (e: any) {
        console.error('[CLIENT] Failed to load shared results:', e?.code || e?.message || e);
      }
    };
    
    // Initial fetch immediately
    loadFromFirestore();
    
    // Poll every 10 seconds
    const interval = setInterval(loadFromFirestore, 10000);
    
    return () => {
      console.log('[CLIENT] Cleaning up Firestore polling');
      clearInterval(interval);
    };
  }, [user, lang]);

  // CLIENT: Sync freemium state from Firestore
  useEffect(() => {
    if (isDeveloperSession()) return;
    if (!user && clientLoginRequired) return;
    const syncFreemium = async () => {
      try {
        const snap = await getDoc(doc(db, 'shared_settings', 'freemium'));
        if (snap.exists()) {
          const data = snap.data();
          const disabled = data.disabled === true;
          setFreemiumDisabled(disabled);
          localStorage.setItem('finalyze_freemium_disabled', disabled ? 'true' : 'false');
          console.log('[CLIENT] Freemium state synced from Firestore:', disabled);
        }
      } catch (e) {
        console.warn('[CLIENT] Failed to sync freemium state:', e);
      }
    };
    syncFreemium();
    const interval = setInterval(syncFreemium, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // CLIENT: Sync clientLoginRequired state from Firestore
  useEffect(() => {
    const syncClientLogin = async () => {
      try {
        const snap = await getDoc(doc(db, 'shared_settings', 'clientLogin'));
        if (snap.exists()) {
          const data = snap.data();
          const required = data.required === true;
          setClientLoginRequired(required);
          localStorage.setItem('finalyze_client_login_required', required ? 'true' : 'false');
          console.log('[SYNC] Client login state synced from Firestore:', required);
        }
      } catch (e) {
        console.warn('[SYNC] Failed to sync client login state:', e);
      }
    };
    syncClientLogin();
    const interval = setInterval(syncClientLogin, 10000);
    return () => clearInterval(interval);
  }, []);

  // CLIENT: Poll radar status from developer
  useEffect(() => {
    if (isDeveloperSession()) return;
    if (!user && clientLoginRequired) return;
    let prevRunning = false;

    const checkRadarStatus = async () => {
      try {
        const snap = await getDocs(collection(db, 'shared_status'));
        if (snap.empty) return;
        let latestData: any = null;
        let latestTs = 0;
        snap.forEach(d => {
          const dta = d.data();
          let ts = 0;
          if (dta.timestamp) {
            if (typeof dta.timestamp === 'string') ts = new Date(dta.timestamp).getTime();
            else if (typeof dta.timestamp === 'number') ts = dta.timestamp;
          }
          if (ts >= latestTs) { latestTs = ts; latestData = dta; }
        });
        if (!latestData) return;
        const running = latestData.isRunning === true;
        setClientRadarRunning(running);

        // Radar just finished: play sound + show green banner
        if (prevRunning && !running) {
          try { initAudio(); } catch {}
          playAudio('completion');
          setShowRadarComplete(true);
          setTimeout(() => setShowRadarComplete(false), 30000);
        }
        prevRunning = running;
      } catch (e) {
        console.warn('[CLIENT] Failed to check radar status:', e);
      }
    };

    checkRadarStatus();
    const interval = setInterval(checkRadarStatus, 10000);
    return () => clearInterval(interval);
  }, [user]);

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

  const isNewClient = useMemo(() => {
    try {
      const localClients = JSON.parse(localStorage.getItem('finalyze_clients') || '[]');
      if (!user || !user.email) return false;
      const email = user.email.toLowerCase();
      const inClients = clients.some((c: any) => c.email?.toLowerCase() === email);
      const inLocal = localClients.some((c: any) => c.email?.toLowerCase() === email);
      return !inClients && !inLocal;
    } catch (e) {
      return false;
    }
  }, [clients, user]);

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

  const isBannedEmail = (email: string): boolean => {
    const banned: string[] = JSON.parse(localStorage.getItem('finalyze_banned_emails') || '[]');
    return banned.includes(email.toLowerCase().trim());
  };

  const banClient = async (clientId: string) => {
    const target = clients.find(c => c.id === clientId);
    if (!target) return;
    const email = target.email.toLowerCase().trim();
    // Add to banned emails list
    const banned: string[] = JSON.parse(localStorage.getItem('finalyze_banned_emails') || '[]');
    if (!banned.includes(email)) {
      banned.push(email);
      localStorage.setItem('finalyze_banned_emails', JSON.stringify(banned));
    }
    // Update Firestore
    try { await updateDoc(doc(db, 'clients', clientId), { status: 'banned' }); } catch (e) { console.warn('Firestore ban failed:', e); }
    // Update localStorage clients
    const localClients: ClientRecord[] = JSON.parse(localStorage.getItem('finalyze_clients') || '[]');
    localStorage.setItem('finalyze_clients', JSON.stringify(localClients.map(c => c.id === clientId ? { ...c, status: 'banned' as const } : c)));
    fetchClients();
  };

  const deleteClientRecord = async (clientId: string) => {
    const target = clients.find(c => c.id === clientId);
    // Remove from Firestore
    try { await deleteDoc(doc(db, 'clients', clientId)); } catch (e) { console.warn('Firestore delete failed:', e); }
    // Remove from localStorage clients
    const localClients: ClientRecord[] = JSON.parse(localStorage.getItem('finalyze_clients') || '[]');
    localStorage.setItem('finalyze_clients', JSON.stringify(localClients.filter(c => c.id !== clientId)));
    // Remove from banned list (delete = unban + make email available again)
    if (target) {
      const banned: string[] = JSON.parse(localStorage.getItem('finalyze_banned_emails') || '[]');
      localStorage.setItem('finalyze_banned_emails', JSON.stringify(banned.filter(e => e !== target.email.toLowerCase().trim())));
    }
    fetchClients();
  };

  const deleteClientByEmail = async (email: string) => {
    const lowerEmail = email.toLowerCase().trim();
    // Remove from Firestore
    try {
      const snap = await getDocs(query(collection(db, 'clients'), where('email', '==', lowerEmail)));
      snap.docs.forEach(async (d) => { await deleteDoc(doc(db, 'clients', d.id)); });
    } catch (e) { console.warn('Firestore delete by email failed:', e); }
    // Remove from localStorage clients
    const localClients: ClientRecord[] = JSON.parse(localStorage.getItem('finalyze_clients') || '[]');
    localStorage.setItem('finalyze_clients', JSON.stringify(localClients.filter(c => c.email.toLowerCase() !== lowerEmail)));
    // Remove from client emails list
    const clientEmails: any[] = JSON.parse(localStorage.getItem('finalyze_client_emails') || '[]');
    localStorage.setItem('finalyze_client_emails', JSON.stringify(clientEmails.filter((c: any) => c.email.toLowerCase() !== lowerEmail)));
    // Remove from banned list
    const banned: string[] = JSON.parse(localStorage.getItem('finalyze_banned_emails') || '[]');
    localStorage.setItem('finalyze_banned_emails', JSON.stringify(banned.filter(e => e !== lowerEmail)));
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

  const [cardColor, setCardColor] = useState<string>(() => {
    return localStorage.getItem('card_color') || '#F59E0B';
  });

  useEffect(() => {
    localStorage.setItem('card_color', cardColor);
    const r = parseInt(cardColor.slice(1, 3), 16);
    const g = parseInt(cardColor.slice(3, 5), 16);
    const b = parseInt(cardColor.slice(5, 7), 16);
    document.documentElement.style.setProperty('--card-bg', `${r},${g},${b}`);
    document.documentElement.style.setProperty('--card-bg-active', `${r},${g},${b}`);
  }, [cardColor]);

  useEffect(() => {
    localStorage.setItem('auto_settings', JSON.stringify(autoSettings));
  }, [autoSettings]);
  const autoSettingsRef = useRef(autoSettings);
  useEffect(() => {
    autoSettingsRef.current = autoSettings;
  }, [autoSettings]);

  // Web Audio API ΓÇö unlock AudioContext on first user click (browser autoplay policy)
  useEffect(() => {
    const unlock = () => {
      initAudio();
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('mousedown', unlock);
    };
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('mousedown', unlock, { passive: true });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('mousedown', unlock);
    };
  }, []);

  // Sync URL hash with activePage so refreshes keep the same page
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if ((hash || 'main') !== activePage) {
      window.location.hash = activePage === 'main' ? '' : activePage;
    }
  }, [activePage]);

  useEffect(() => {
    const VALID_PAGES = ['settings', 'apiKey', 'plans', 'radar', 'paymentSettings', 'clientMonitor', 'profile', 'about', 'suggestions', 'ads', 'siteStats', 'trade'];
    const DEV_ONLY_PAGES = ['clientMonitor', 'ads', 'siteStats'];
    const onHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (!VALID_PAGES.includes(hash)) { setActivePage('main'); return; }
      if (DEV_ONLY_PAGES.includes(hash) && !isDeveloperSession()) { setActivePage('main'); return; }
      setActivePage(hash as any);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [user]);

  const [progress, setProgress] = useState<{ current: string, total: number, index: number, failed?: number } | null>(null);
  const [topSignals, setTopSignals] = useState<AnalysisResult[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('top_signals_persistent') || '[]');
      // Filter out neutral signals on page load
      return stored.filter((s: AnalysisResult) => s.signal !== 'neutral' && s.signal !== 'no_entry');
    } catch { return []; }
  });
  const [lastSyncStatus, setLastSyncStatus] = useState<{ ok: boolean; count?: number; error?: string; time: number } | null>(null);

  // Web Audio API ΓÇö no unlock needed

  const playAudio = (type?: 'success' | 'fail' | 'completion' | 'start') => {
    const vol = Math.max(0, Math.min(1, autoSettings.volume || 0.5));
    if (type === 'success') playSuccess(vol);
    else if (type === 'completion') playCompletion(vol);
    else if (type === 'start') playStart(vol);
    else playFail(vol);
  };

  // Strip undefined values recursively (Firestore rejects undefined)
  const cleanForFirestore = (obj: any): any => {
    if (obj === undefined || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(cleanForFirestore);
    if (typeof obj === 'object') {
      const clean: any = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) clean[k] = cleanForFirestore(v);
      }
      return clean;
    }
    return obj;
  };

  // Track the most up-to-date signals instantly to avoid stale closures
  const signalsRef = useRef(topSignals);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    signalsRef.current = topSignals;
    localStorage.setItem('top_signals_persistent', JSON.stringify(topSignals));

    // Debounced synchronization to Firestore ΓÇö only the latest state wins
    if (isDeveloperSession()) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        setDoc(doc(db, 'shared_results', 'latest'), cleanForFirestore({
          results: topSignals,
          timestamp: new Date().toISOString(),
          developerEmail: user?.email || '',
        })).then(() => {
          console.log('Top signals synced to Firestore successfully, count:', topSignals.length);
          setLastSyncStatus({ ok: true, count: topSignals.length, time: Date.now() });
        }).catch(e => {
          console.warn('Failed to sync top signals to Firestore:', e);
          setLastSyncStatus({ ok: false, error: String(e), time: Date.now() });
        });
      }, 300);
    }
  }, [topSignals, user]);

  // DEVELOPER: Force sync on startup — ensures signals are always in Firestore
  useEffect(() => {
    if (!isDeveloperSession() || !user) return;
    const current = signalsRef.current;
    if (current.length === 0) return;
    console.log('[DEV] Startup sync — pushing', current.length, 'signals to Firestore');
    setDoc(doc(db, 'shared_results', 'latest'), cleanForFirestore({
      results: current,
      timestamp: new Date().toISOString(),
      developerEmail: user?.email || '',
    })).then(() => {
      console.log('[DEV] Startup sync successful');
      setLastSyncStatus({ ok: true, count: current.length, time: Date.now() });
    }).catch(e => {
      console.warn('[DEV] Startup sync failed:', e);
      setLastSyncStatus({ ok: false, error: String(e), time: Date.now() });
    });
  }, [user]);

  // DEVELOPER: Sync radar status to Firestore so clients see banners
  useEffect(() => {
    if (!isDeveloperSession() || !user) return;
    const isRunning = !isScanningFinished && autoSettings.isEnabled;
    setDoc(doc(db, 'shared_status', 'latest'), {
      isRunning,
      timestamp: new Date().toISOString(),
      developerEmail: user?.email || '',
    }).catch(e => console.warn('[DEV] Failed to sync radar status:', e));
  }, [isScanningFinished, autoSettings.isEnabled, user]);

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

  const saveStrategySettings = () => {
    localStorage.setItem('strategy_settings', JSON.stringify(settings));
  };
  const saveAutoSettings = async () => {
    localStorage.setItem('auto_settings', JSON.stringify(autoSettings));
    // Developer: save to Firestore so clients get the alert settings
    if (isDeveloperSession()) {
      try {
        await setDoc(doc(db, 'shared_alerts', 'latest'), {
          autoSettings,
          strategySettings: settings,
          timestamp: new Date().toISOString(),
        });
      } catch (e) { console.warn('Failed to save alerts to Firestore:', e); }
    }
  };

  const updateTopSignals = (results: AnalysisResult[]) => {
    try {
    let changed = false;
    let hasBrandNewSymbol = false;
    const now = Date.now();

    // ΓöÇΓöÇ TIMEFRAME-BASED HOLD PERIODS ΓöÇΓöÇ
    const getHoldPeriods = (tf: string) => {
      switch (tf) {
        case '1d': return { minHold: 24 * 3600 * 1000, maxAge: 72 * 3600 * 1000 };
        case '4h': return { minHold: 4 * 3600 * 1000, maxAge: 12 * 3600 * 1000 };
        case '1h': return { minHold: 1 * 3600 * 1000, maxAge: 3 * 3600 * 1000 };
        case '15m': return { minHold: 30 * 60 * 1000, maxAge: 60 * 60 * 1000 };
        case '5m': return { minHold: 15 * 60 * 1000, maxAge: 30 * 60 * 1000 };
        default: return { minHold: 4 * 3600 * 1000, maxAge: 12 * 3600 * 1000 };
      }
    };

    // ΓöÇΓöÇ SIGNAL RANK ΓöÇΓöÇ
    const signalRank: Record<string, number> = {
      'strong_buy': 5, 'strong_sell': 5, 'buy': 4, 'sell': 4, 'neutral': 2, 'no_entry': 1
    };

    // ΓöÇΓöÇ CHECK IF MARKET DATA ACTUALLY CHANGED ΓöÇΓöÇ
    const hasRealMarketChange = (oldRes: AnalysisResult, newRes: AnalysisResult): boolean => {
      // RSI crossed boundaries
      const oldRsi = oldRes.technicalScore;
      const newRsi = newRes.technicalScore;
      if ((oldRsi <= 70 && newRsi > 70) || (oldRsi >= 30 && newRsi < 30)) return true;
      // Direction flipped
      if (oldRes.direction && newRes.direction && oldRes.direction !== newRes.direction) return true;
      // Confidence dropped drastically (more than 30 points)
      if (oldRes.confidence - newRes.confidence > 30) return true;
      // Signal rank changed
      if ((signalRank[oldRes.signal] || 0) > (signalRank[newRes.signal] || 0)) return true;
      return false;
    };

    // Purge signals that exceeded max age
    let updated = signalsRef.current.filter(s => {
      const { maxAge } = getHoldPeriods(s.timeframe);
      const age = now - new Date(s.timestamp).getTime();
      if (age >= maxAge) {
        changed = true;
        return false;
      }
      return true;
    });

    results.forEach(res => {
      if (res.signal === 'neutral' || res.signal === 'no_entry') return; // neutral hidden
      if (res.isSideways) return; // sideways signals completely hidden

      const existing = updated.find(s => s.symbol === res.symbol);
      const { minHold } = getHoldPeriods(res.timeframe);
      const existingAge = existing ? now - new Date(existing.timestamp).getTime() : Infinity;
      const withinMinHold = existingAge < minHold;

      if (existing) {
        // ΓöÇΓöÇ RULE: Within min hold ΓåÆ NEVER remove or downgrade unless 2+ primary conditions collapsed ΓöÇΓöÇ
        if (withinMinHold) {
          const oldPrimary = existing.primaryMetCount ?? 4;
          const newPrimary = res.primaryMetCount ?? 4;
          const primaryDrop = oldPrimary - newPrimary;

          // Allow UPGRADE always (strong_buy > buy)
          const newRank = signalRank[res.signal] || 0;
          const oldRank = signalRank[existing.signal] || 0;
          if (newRank > oldRank) {
            updated = updated.map(s => s.symbol === res.symbol ? res : s);
            changed = true;
          }
          // Allow downgrade ONLY if 2+ primary conditions collapsed AND market data actually changed
          else if (primaryDrop >= 2 && hasRealMarketChange(existing, res)) {
            updated = updated.map(s => s.symbol === res.symbol ? res : s);
            changed = true;
          }
          // Otherwise: keep existing signal untouched
          return;
        }

        // ΓöÇΓöÇ Past min hold: allow normal signal evolution ΓöÇΓöÇ
        // Still require market data change for downgrade
        const oldPrimary = existing.primaryMetCount ?? 4;
        const newPrimary = res.primaryMetCount ?? 4;
        const primaryDrop = oldPrimary - newPrimary;
        const newRank = signalRank[res.signal] || 0;
        const oldRank = signalRank[existing.signal] || 0;

        if (newRank >= oldRank) {
          // Upgrade or same: always apply
          updated = updated.map(s => s.symbol === res.symbol ? res : s);
          changed = true;
        } else if (primaryDrop >= 2 && hasRealMarketChange(existing, res)) {
          // Downgrade: only if 2+ primary collapsed AND data changed
          updated = updated.map(s => s.symbol === res.symbol ? res : s);
          changed = true;
        }
        // else: no meaningful change ΓåÆ keep existing
      } else {
        // ΓöÇΓöÇ Brand new symbol: add to top signals ΓöÇΓöÇ
        updated.unshift(res);
        changed = true;
        hasBrandNewSymbol = true;
      }
    });

    if (changed) {
      const previousMap = new Map(signalsRef.current.map(s => [s.symbol, s]));
      const resolved = resolveConflicts(updated);
      const resolvedSet = new Set(resolved.map(s => s.symbol));

      // BUG FIX: Restore signals that were previously visible but removed by
      // resolveCorrelationConflicts when new correlated symbols appeared
      for (const [sym, prevSig] of previousMap) {
        if (!resolvedSet.has(sym)) {
          const currentSig = updated.find(u => u.symbol === sym);
          if (currentSig) resolved.push(currentSig);
        }
      }

      // Separate strong and regular signals (exclude sideways)
      const strong = resolved.filter(s => (s.signal === 'strong_buy' || s.signal === 'strong_sell') && !s.isSideways);
      const regular = resolved.filter(s => (s.signal === 'buy' || s.signal === 'sell') && !s.isSideways);
      
      // Pass all signals - TopSignals component handles category-based display
      // Each category independently shows its strong signals + top 3 regular
      setTopSignals([...strong, ...regular]);

      if (hasBrandNewSymbol) {
        setNewSignalAlert(lang === 'ar' ? '\u2705 \u0644\u0642\u062f \u0631\u0635\u0629 \u062a\u062f\u0627\u0648\u0644 \u0642\u0648\u064a\u0629 \u062c\u062f\u064a\u062f\u0629!' : '\u2705 New strong trading opportunity detected!');
        setTimeout(() => setNewSignalAlert(null), 8000);
        setTimeout(() => {
          try { initAudio(); } catch {}
          playAudio('success');
        }, 400);
      }
    }
    } catch (e) { console.warn('[updateTopSignals] Error:', e); }
  };

  const removeSignal = async (symbol: string) => {
    const updated = signalsRef.current.filter(s => s.symbol !== symbol);
    setTopSignals(updated);
    if (isDeveloperSession()) {
      try {
        await setDoc(doc(db, 'shared_results', 'latest'), cleanForFirestore({
          results: updated,
          timestamp: new Date().toISOString(),
          developerEmail: user?.email || '',
        }));
      } catch (e) { console.warn('[removeSignal] Firestore sync failed:', e); }
    }
  };

  const handleClearAll = async () => {
    setTopSignals([]);
    if (isDeveloperSession()) {
      try {
        const resetToken = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        await setDoc(doc(db, 'shared_results', 'latest'), cleanForFirestore({
          results: [],
          resetToken,
          timestamp: new Date().toISOString(),
          developerEmail: user?.email || '',
        }));
        console.log('Clear synced to Firestore, token:', resetToken);
      } catch (e) {
        console.warn('Failed to clear Firestore shared_results:', e);
      }
    }
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

  // AUTO-CLEAR STALE SIGNALS AT START OF NEW TRADING DAY
  const lastPurgeDateRef = useRef<string>('');
  useEffect(() => {
    const checkAndPurgeNewDay = async () => {
      const today = new Date().toDateString();
      if (lastPurgeDateRef.current === today) return;
      const lastPurgeStored = localStorage.getItem('finalyze_last_purge_date');
      if (lastPurgeStored === today) {
        lastPurgeDateRef.current = today;
        return;
      }

      const day = new Date().getDay();
      const isWeekend = day === 0 || day === 6;
      const allCryptos = ALL_SYMBOLS_DB.crypto || [];

      if (!isDeveloperSession()) {
        const today2 = new Date().toDateString();
        const clientLastDate = localStorage.getItem('finalyze_client_results_date');
        if (clientLastDate !== today2) {
          setClientSignals([]);
          localStorage.removeItem('finalyze_client_signals');
          localStorage.setItem('finalyze_client_results_date', today2);
        }
        lastPurgeDateRef.current = today;
        localStorage.setItem('finalyze_last_purge_date', today);
        return;
      }

      const current = signalsRef.current;
      let filtered: AnalysisResult[];
      if (isWeekend) {
        filtered = current.filter(s => {
          const sym = s.symbol.toUpperCase();
          return allCryptos.includes(sym) || sym.includes('-USD') || sym.endsWith('USD');
        });
      } else {
        filtered = [];
      }

      lastPurgeDateRef.current = today;
      localStorage.setItem('finalyze_last_purge_date', today);
      localStorage.setItem('top_signals_persistent', JSON.stringify(filtered));
      setTopSignals(filtered);

      try {
        const resetToken = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
        await setDoc(doc(db, 'shared_results', 'latest'), cleanForFirestore({
          results: filtered,
          resetToken,
          timestamp: new Date().toISOString(),
          developerEmail: user?.email || '',
        }));
        console.log('Automated new trading day purge executed. Remaining:', filtered.length);
      } catch (e) {
        console.warn('[purgeNewDay] Firestore purge failed:', e);
      }
    };

    checkAndPurgeNewDay();
    const interval = setInterval(checkAndPurgeNewDay, 5 * 60 * 1000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, [user]);

  // RADAR - Developer only, never auto-starts on page load
  const radarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runRadarScan = useCallback(async () => {
    const s = autoSettingsRef.current;
    if (!s.isEnabled) return;

    // Ensure audio is unlocked (may be called before first user click if radar auto-starts)
    try { initAudio(); } catch {}

    // Play start alert sound
    try { playAudio('start'); } catch {}

    const cats = s.category === 'all'
      ? Object.keys(SYMBOL_CATEGORIES) as (keyof typeof SYMBOL_CATEGORIES)[]
      : (s.category || 'all').split(',') as (keyof typeof SYMBOL_CATEGORIES)[];

    const open = cats.filter(isMarketOpen);
    if (open.length === 0) return;

    setIsScanningFinished(false);

    let hidden: string[] = [];
    let custom: string[] = [];
    try {
      hidden = JSON.parse(localStorage.getItem('finalyze_hidden_symbols') || '[]');
      custom = JSON.parse(localStorage.getItem('finalyze_custom_symbols') || '[]');
    } catch {}

    // Track ALL results from this scan directly (not via batched React state)
    const scanResults: AnalysisResult[] = [];
    let scanFailed = 0;

    for (const cat of open) {
      if (!autoSettingsRef.current.isEnabled) break;

      const syms = hasActivePlan
        ? (() => {
            const g = SYMBOL_GROUPS[cat]?.flatMap(x => x.symbols) || [];
            const c = custom.filter(x =>
              (ALL_SYMBOLS_DB[cat] || []).includes(x) && !g.includes(x)
            );
            return [...g, ...c].filter(x => !hidden.includes(x));
          })()
        : (FREE_SYMBOLS[cat] || []);

      const mt = cat === 'crypto' ? MarketType.CRYPTO :
                 cat === 'stocks' ? MarketType.STOCKS :
                 cat === 'metals' ? MarketType.METALS : MarketType.FOREX;

      for (const sym of syms) {
        if (!autoSettingsRef.current.isEnabled) break;

        setProgress({ current: sym, total: syms.length, index: scanResults.length, failed: scanFailed });

        let lastError: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (!autoSettingsRef.current.isEnabled) break;
          await waitIfRateLimited();
          try {
            const r = await Promise.race([
              analyzeMarket({
                symbol: sym, type: mt,
                timeframe: s.timeframe,
                tradingStyle: s.tradingStyle,
                settings, lang
              }),
              new Promise<any>((_, rej) => setTimeout(() => rej(new Error('timeout')), 60000))
            ]);
            if (r && !(r as any).error) {
              const sig = r.signal || '';
              if (sig && sig !== 'no_entry' && sig !== 'neutral' && !r.isSideways) updateTopSignals([r]);
              if (sig && sig !== 'no_entry' && sig !== 'neutral' && !r.isSideways) {
                scanResults.push(r);
                setClientSignals(prev => {
                  const u = [...prev.filter(x => x.symbol !== r.symbol), r];
                  localStorage.setItem('finalyze_client_signals', JSON.stringify(u.slice(-100)));
                  return u.slice(-100);
                });
              }
              lastError = null;
              break;
            }
          } catch (e: any) {
            lastError = e;
            const isTimeout = e?.message === 'timeout';
            const isRateLimit = e?.message?.includes('429') || e?.message?.includes('rate');
            if (isRateLimit) {
              await new Promise(r => setTimeout(r, 15000));
              continue;
            }
            if (isTimeout && attempt === 0) {
              await new Promise(r => setTimeout(r, 5000));
              continue;
            }
            break;
          }
        }
        if (lastError) {
          console.error(`Radar Error [${sym}]:`, lastError.message);
          scanFailed++;
          setProgress({ current: sym, total: syms.length, index: scanResults.length, failed: scanFailed });
          await new Promise(r => setTimeout(r, 3000));
        } else {
          const key = getApiKey();
          const d = (key.startsWith('AIzaSy') || key.startsWith('AQ.')) ? 3500 : 2500;
          await new Promise(r => setTimeout(r, d));
        }
      }
    }

    // Save results to Firestore for clients ΓÇö only if there are results
    try {
      const merged = signalsRef.current || [];
      if (merged.length > 0) {
        await Promise.race([
          setDoc(doc(db, 'shared_results', 'latest'), cleanForFirestore({
            results: merged.slice(-100),
            timestamp: new Date().toISOString(),
            developerEmail: user?.email || '',
          })),
          new Promise<null>((_, rej) => setTimeout(() => rej(new Error('shared_results timeout')), 15000))
        ]);
        setLastSyncStatus({ ok: true, count: merged.length, time: Date.now() });
        console.log('Radar scan synced to Firestore, count:', merged.length);
      }
    } catch (e) {
      console.warn('Firestore sync failed:', e);
      setLastSyncStatus({ ok: false, error: String(e), time: Date.now() });
    }

    // Save alerts to Firestore for clients
    try {
      await Promise.race([
        setDoc(doc(db, 'shared_alerts', 'latest'), {
          autoSettings: s,
          strategySettings: settings,
          timestamp: new Date().toISOString(),
        }),
        new Promise<null>((_, rej) => setTimeout(() => rej(new Error('shared_alerts timeout')), 15000))
      ]);
    } catch (e) {
      console.warn('Firestore save failed:', e);
    }

    // Clear progress
    setProgress(null);
  }, [settings, lang, hasActivePlan, user]);

  // Radar lifecycle: start on toggle-ON, stop on toggle-OFF
  const prevRadarEnabledRef = useRef(false);
  const radarFirstRenderRef = useRef(true);

  useEffect(() => {
    if (!isDeveloperSession()) return;

    const isOn = autoSettings.isEnabled;
    const wasOn = prevRadarEnabledRef.current;
    prevRadarEnabledRef.current = isOn;

    // Turned OFF: cancel timer, stop
    if (wasOn && !isOn) {
      if (radarTimerRef.current) {
        clearTimeout(radarTimerRef.current);
        radarTimerRef.current = null;
      }
      return;
    }

    if (!isOn) return;

    // Shared scan loop
    const loop = async () => {
      try {
        await runRadarScan();
      } catch (e) {
        console.error('Radar error:', e);
      } finally {
        setIsScanningFinished(true);
        setFoundAnyStrong(signalsRef.current.length > 0);
        try { initAudio(); } catch {}
        playAudio('completion');

        if (autoSettingsRef.current.isEnabled) {
          const ms = (autoSettingsRef.current.interval || 15) * 60000;
          radarTimerRef.current = setTimeout(() => {
            radarTimerRef.current = null;
            setIsScanningFinished(false);
            loop();
          }, ms);
        }
      }
    };

    // First render: schedule first scan after interval, don't scan now
    if (radarFirstRenderRef.current) {
      radarFirstRenderRef.current = false;
      setIsScanningFinished(true);
      const ms = (autoSettings.interval || 15) * 60000;
      radarTimerRef.current = setTimeout(() => {
        radarTimerRef.current = null;
        setIsScanningFinished(false);
        loop();
      }, ms);
      return;
    }

    // Toggled from OFF to ON ΓÇö scan immediately
    if (!wasOn) {
      loop();
    }
  }, [autoSettings.isEnabled]);

  // Build version check: force cache bust on new deploy
  useEffect(() => {
    try {
      const currentVersion = __BUILD_VERSION__;
      const storedVersion = localStorage.getItem('finalyze_build_version');
      if (storedVersion && storedVersion !== currentVersion) {
        console.log('New version detected. Old:', storedVersion, 'New:', currentVersion, '— clearing caches and reloading.');
        // Clear browser caches
        if ('caches' in window) {
          caches.keys().then(names => names.forEach(name => caches.delete(name)));
        }
        // Clear stale client data
        localStorage.removeItem('finalyze_client_signals');
        localStorage.removeItem('finalyze_client_results_date');
        localStorage.removeItem('finalyze_client_reset_token');
        localStorage.removeItem('top_signals_persistent');
        localStorage.removeItem('finalyze_client_alerts');
        localStorage.removeItem('finalyze_custom_logo');
        // Save new version then hard reload
        localStorage.setItem('finalyze_build_version', currentVersion);
        window.location.reload();
        return;
      }
      localStorage.setItem('finalyze_build_version', currentVersion);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.removeItem('finalyze_verify_link');
    setLoginError(null);
    setRedirecting(false);
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
                            email.includes('dev');

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
        if (isDeveloper) {
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
        const localKey = localStorage.getItem('finalyze_key1_value') || localStorage.getItem('finalyze_user_groq_api_key');
        if (localKey) {
          setHasApiKey(true);
        } else {
          try {
            const userDoc = await getDoc(doc(db, 'users', u.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              if (data?.groqApiKey || data?.geminiApiKey) {
                const ak = data.groqApiKey || data.geminiApiKey;
                localStorage.setItem('finalyze_user_groq_api_key', ak);
                localStorage.setItem('finalyze_key1_value', ak);
                localStorage.setItem('finalyze_key1_provider', 'groq');
                try { sessionStorage.setItem('finalyze_key_mirror', ak); document.cookie = `finalyze_api_key=${encodeURIComponent(ak)}; path=/; max-age=31536000; SameSite=Lax`; } catch {}
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

  // Redirect non-dev users away from dev-only pages
  useEffect(() => {
    if (!loading && !isDeveloperSession() && DEV_ONLY_PAGES.includes(activePage)) {
      setActivePage('main');
      window.location.hash = '';
    }
  }, [loading, user, activePage]);

  // Load custom audios from IndexedDB on startup
  useEffect(() => {
    const loadSavedAudios = async () => {
      try {
        const { getAudioBlob } = await import('./lib/db');
        const { loadCustomAudio } = await import('./lib/audioEngine');
        
        const successBlob = await getAudioBlob('custom_success');
        if (successBlob) await loadCustomAudio('custom_success', successBlob);
        
        const failBlob = await getAudioBlob('custom_fail');
        if (failBlob) await loadCustomAudio('custom_fail', failBlob);
        
        const completionBlob = await getAudioBlob('custom_completion');
        if (completionBlob) await loadCustomAudio('custom_completion', completionBlob);
        
        console.log('Saved custom audios loaded into audio engine successfully.');
      } catch (e) {
        console.warn('Failed to load saved custom audios from IndexedDB:', e);
      }
    };
    loadSavedAudios();

    // Hot-reload when custom audios are updated from Settings
    const handleAudioUpdate = () => {
      loadSavedAudios();
    };
    window.addEventListener('custom-audio-updated', handleAudioUpdate);
    return () => window.removeEventListener('custom-audio-updated', handleAudioUpdate);
  }, []);

  // Sync freemium state from localStorage (when PaymentModal toggles it)
  useEffect(() => {
    const sync = () => setFreemiumDisabled(localStorage.getItem('finalyze_freemium_disabled') === 'true');
    window.addEventListener('freemium-toggle', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('freemium-toggle', sync); window.removeEventListener('storage', sync); };
  }, []);

  // Redirect away from plans page when freemium is ON (full free access)
  useEffect(() => {
    if (activePage === 'plans' && freemiumDisabled && !isDeveloperSession()) {
      setActivePage('main');
    }
  }, [activePage, freemiumDisabled]);

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
            alert(lang === 'ar' ? '\u26a0\ufe0f \u0631\u0628\u0637 \u0627\u0644\u062a\u062d\u0642\u0642 \u063a\u064a\u0631 \u0635\u0627\u0644\u062d \u0623\u0648 \u0645\u0646\u062a\u0647\u064a.' : '\u26a0\ufe0f Invalid or expired verification link.');
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch (e) {
          console.error('Verification error:', e);
          window.history.replaceState({}, '', window.location.pathname);
        }
      })();
    }
  }, [loading]);

  const processGoogleUser = async (email: string, displayName?: string, photoURL?: string) => {
    // Developer emails ΓåÆ sign in directly
    if (email === 'taybekraa@gmail.com' || email === 'bachasalman69@gmail.com' || email.includes('dev')) {
      localStorage.setItem('finalyze_auth_user', JSON.stringify({ uid: 'dev_' + email.replace(/[^a-zA-Z0-9]/g, ''), email, displayName: 'Developer', emailVerified: true }));
      localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());
      setUser({ uid: 'dev_' + email.replace(/[^a-zA-Z0-9]/g, ''), email, displayName: 'Developer', emailVerified: true } as User);
      setHasApiKey(true);
      persistNeedsApiKey(null);
      fetchClients();
      return;
    }

    try {
      const existingSnap = await getDocs(query(collection(db, 'clients'), where('email', '==', email)));
      const existing = existingSnap.docs[0]?.data();

      if (existing?.groqApiKey && !hasAnyStoredKey()) {
        const ak = existing.groqApiKey;
        localStorage.setItem('finalyze_user_groq_api_key', ak);
        localStorage.setItem('finalyze_key1_value', ak);
        localStorage.setItem('finalyze_key1_provider', 'groq');
        try { sessionStorage.setItem('finalyze_key_mirror', ak); } catch {}
      }

      if (isBannedEmail(email) || existing?.status === 'banned') {
        setLoginError(lang === 'ar' ? '\u062d\u0635\u0631 \u0627\u0644\u062d\u0633\u0627\u0628 \u0645\u062d\u0638\u0648\u0638. \u0644\u0627 \u064a\u0645\u0643\u0646\u0643 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644.' : 'This account is banned. You cannot log in.');
        setRedirecting(false);
        return;
      }

      // Set session via localStorage FIRST
      localStorage.setItem('finalyze_auth_user', JSON.stringify({ uid: email, email, displayName: displayName || 'Client', photoURL: photoURL || '', emailVerified: true }));
      localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());

      // Set user in state
      setUser({ uid: email, email, displayName: displayName || 'Client', photoURL: photoURL || '', emailVerified: true } as User);
      setHasApiKey(hasAnyStoredKey());
      persistNeedsApiKey(null);

      const clientEmails: any[] = JSON.parse(localStorage.getItem('finalyze_client_emails') || '[]');
      if (!clientEmails.some((c: any) => c.email === email)) {
        clientEmails.push({ email, registeredAt: new Date().toISOString(), uid: email });
        localStorage.setItem('finalyze_client_emails', JSON.stringify(clientEmails));
      }

      try {
        if (existingSnap.docs[0]) {
          await updateDoc(doc(db, 'clients', existingSnap.docs[0].id), { status: 'verified', plan: 'free' });
        } else {
          const count = (await getDocs(collection(db, 'clients'))).size;
          await addDoc(collection(db, 'clients'), {
            email, status: 'verified', plan: 'free', planExpiry: null,
            registeredAt: serverTimestamp(), rank: count + 1,
          });
        }
      } catch (e) { console.warn('Firestore save on login failed:', e); }

      const localClients: any[] = JSON.parse(localStorage.getItem('finalyze_clients') || '[]');
      if (!localClients.some((c: any) => c.email?.toLowerCase() === email.toLowerCase())) {
        localClients.push({
          id: 'local_' + Date.now(),
          email,
          status: 'verified',
          plan: 'free',
          planExpiry: null,
          registeredAt: new Date().toISOString(),
          rank: 0,
        });
        localStorage.setItem('finalyze_clients', JSON.stringify(localClients));
        fetchClients();
      }
    } catch (innerErr) {
      console.error('Non-critical error during client setup:', innerErr);
      localStorage.setItem('finalyze_auth_user', JSON.stringify({ uid: email, email, displayName: displayName || 'Client', photoURL: photoURL || '', emailVerified: true }));
      localStorage.setItem('finalyze_auth_timestamp', Date.now().toString());
      setUser({ uid: email, email, displayName: displayName || 'Client', photoURL: photoURL || '', emailVerified: true } as User);
      setHasApiKey(hasAnyStoredKey());
      persistNeedsApiKey(null);
    }
  };

  // Fetch new suggestions count for developer notifications
  useEffect(() => {
    if (!user) return;
    const fetchSuggestionsCount = async () => {
      try {
        const isDev = isDeveloperSession();
        if (!isDev) return;
        const snap = await getDocs(query(collection(db, 'analysisResults'), where('_type', '==', 'suggestion')));
        const total = snap.size;
        // Fetch hidden count
        let hiddenCount = 0;
        try {
          const hiddenSnap = await getDocs(query(collection(db, 'userPreferences'), where('__name__', '==', 'dev_hidden_suggestions')));
          if (!hiddenSnap.empty) {
            const hiddenData = hiddenSnap.docs[0].data();
            hiddenCount = (hiddenData.hiddenIds || []).length;
          }
        } catch {}
        setNewSuggestionsCount(Math.max(0, total - hiddenCount));
      } catch {}
    };
    fetchSuggestionsCount();
    const interval = setInterval(fetchSuggestionsCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogin = async () => {
    setActivePage('main');
    setPaymentPlan(null);
    setAnalysisResults(null);
    setIsSidebarOpen(false);
    setLoginError(null);
    setManualAuthUrl(null);
    setRedirecting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const email = result?.user?.email || result?.user?.providerData?.[0]?.email || '';
      if (!email) { throw new Error('no_email'); }
      await processGoogleUser(email, result.user.displayName || undefined, result.user.photoURL || undefined);
    } catch (error: any) {
      console.error("=== Google sign-in ERROR ===", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setLoginError('\u0644\u0642\u062f \u0623\u063a\u0644\u0642\u062a \u0646\u0627\u0641\u0630\u0629 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644. \u062a\u0639\u064a\u062f \u0644\u0644\u0645\u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.');
      } else if (error.code === 'auth/unauthorized-domain') {
        setLoginError(`\u062d\u0635\u0631 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 (${window.location.hostname}) \u063a\u064a\u0631 \u0645\u0635\u063a\u064a\u0631 \u0639\u0644\u0649 Firebase.`);
      } else if (error.message === 'no_email') {
        setLoginError('\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u062d\u0635\u0648\u0644 \u0639\u0644\u0649 \u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0627\u0644\u0645\u0631\u0636\u064a \u0628\u0647. \u062a\u0639\u064a\u062f \u0644\u0644\u0645\u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.');
      } else {
        setLoginError(`Google sign-in error: ${error.code || error.message}`);
      }
    } finally {
      setRedirecting(false);
    }
  };

  const handleLogout = async () => {
    signOut(auth).catch(() => {});
    localStorage.removeItem('finalyze_auth_user');
    localStorage.removeItem('finalyze_auth_timestamp');
    localStorage.removeItem('finalyze_verify_link');
    localStorage.removeItem('finalyze_geo');
    localStorage.removeItem('finalyze_build_version');
    localStorage.removeItem('finalyze_client_signals');
    localStorage.removeItem('finalyze_client_results_date');
    localStorage.removeItem('finalyze_client_reset_token');
    localStorage.removeItem('top_signals_persistent');
    localStorage.removeItem('finalyze_client_alerts');
    localStorage.removeItem('active_subscription');
    sessionStorage.clear();
    window.location.href = '/';
  };

  const t = translations[lang];

  // Track initial page view (skip for developer)
  useEffect(() => {
    if (!isDeveloperSession()) trackPageView('main').catch(() => {});
  }, [user]);

  // Auto sign-in anonymously when clientLoginRequired is false
  useEffect(() => {
    if (!clientLoginRequired && !user && !loading) {
      console.log('[AUTH] Client login disabled, entering as guest (no auth needed)');
      // No auth needed — Firestore rules allow unauthenticated reads
    }
  }, [clientLoginRequired, user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg relative">
      {/* Analysis Detail Page Overlay */}
      {detailResult && (
        <AnalysisDetailPage
          result={detailResult}
          onBack={() => setDetailResult(null)}
          lang={lang}
        />
      )}

      <AnimatePresence>
        {newSignalAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4"
          >
            <div className="bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-4 flex items-center justify-between shadow-2xl shadow-emerald-500/20">
              <span className="text-emerald-400 text-xs font-black uppercase tracking-widest">
                {newSignalAlert}
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!user && !loading && clientLoginRequired && (
          <LoginOverlay 
            onLogin={handleLogin} 
            lang={lang}
            onLangChange={setLang}
            loginError={loginError}
            onClearError={() => { setLoginError(null); setPendingVerifyLink(null); }}
            redirecting={redirecting}
            manualAuthUrl={manualAuthUrl}
          />
        )}
      </AnimatePresence>

      {/* Blocking API Key overlay ΓÇö REMOVED for clients. API key is only managed via Settings (developer only). */}

      <Header 
        user={user} onLogin={handleLogin} onLogout={handleLogout} 
        isDark={isDark} toggleTheme={() => setIsDark(!isDark)}
        lang={lang} onLangChange={setLang}
        showBack={!!analysisResults} onBack={() => { setAnalysisResults(null); setAnalysisError(null); goBack(); }}
        autoSettings={autoSettings} onAutoSettingsChange={setAutoSettings}
        isWaiting={isScanningFinished}
        hasApiKey={hasApiKey || isDeveloperSession()}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isDeveloper={isDeveloperSession()}
        lastSyncStatus={lastSyncStatus}
        analysisProgress={progress}
        isAnalyzing={isAnalyzing}
        newSuggestionsCount={effectivePage === 'suggestions' ? 0 : newSuggestionsCount}
        onNavigateSuggestions={() => navigateTo('suggestions')}
        clientRadarRunning={!isDeveloperSession() && clientRadarRunning}
        showRadarComplete={!isDeveloperSession() && showRadarComplete}
        onPreview={isDeveloperSession() ? (device) => setPreviewDevice(device) : undefined}
        isPWA={isPWA || window.self !== window.top}
        onNavigatePage={(page) => { navigateTo(page); setIsSidebarOpen(false); }}
        freemiumDisabled={freemiumDisabled}
        compact={effectivePage === 'trade'}
      />

      {/* Sidebar Panel - dropdown below menu icon */}
      <AnimatePresence>
        {isSidebarOpen && !isPWA && window.self === window.top && (
          <SidebarPanel
            lang={lang}
            onClose={() => setIsSidebarOpen(false)}
            onNavigate={(page) => { navigateTo(page); setIsSidebarOpen(false); }}
            isDeveloper={isDeveloperSession()}
            freemiumDisabled={freemiumDisabled}
            onPreview={isDeveloperSession() ? (device) => setPreviewDevice(device) : undefined}
          />
        )}
      </AnimatePresence>

      {/* Device Preview Overlay */}
      <DevicePreview
        isOpen={!!previewDevice}
        onClose={() => setPreviewDevice(null)}
        device={previewDevice || 'phone'}
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
              {lang === 'ar' ? '\u0644\u0627 \u062a\u0648\u062c\u062f \u0625\u0634\u0627\u0631\u0627\u062a \u0642\u0648\u064a\u0629 \u062d\u0627\u0644\u064a\u0627\u064b' : 'No strong signals currently'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      
      <main className={`flex-grow max-w-7xl mx-auto w-full px-4 relative transition-all duration-300 ${effectivePage === 'trade' ? 'pt-[100px] pb-3' : 'pt-[340px] pb-8'}`}>
        {/* Dedicated pages (from dashboard) */}
        {effectivePage !== 'main' && !needsApiKey && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

             {effectivePage === 'settings' && (
               <SettingsModal
                key={user?.uid || 'no-session'}
                isOpen={true}
                onClose={goBack}
                settings={settings}
                onSettingsChange={(s) => { setSettings(s); }}
                onSave={saveStrategySettings}
                user={user}
                asPage
                lang={lang}
                onDeleteClientResults={handleClearAll}
              />
            )}

            {effectivePage === 'apiKey' && (
              <ApiKeyModal
                key={user?.uid || 'no-session'}
                isOpen={true}
                onClose={goBack}
                isBlocking={false}
                lang={lang}
                user={user}
                onSaved={(key) => { setHasApiKey(!!key); goBack(); }}
                onLogout={handleLogout}
                asPage
              />
            )}

            {effectivePage === 'plans' && !paymentPlan && !(freemiumDisabled && !isDeveloperSession()) && (
              <SubscriptionModal
                key={user?.uid || 'no-session'}
                isOpen={true}
                onClose={goBack}
                onSelectPlan={(amount, label, durationDays) => { navigateTo('plans'); setPaymentPlan({ amount, label, durationDays }); }}
                asPage
              />
            )}

            {effectivePage === 'plans' && paymentPlan && !(freemiumDisabled && !isDeveloperSession()) && (
              <PaymentModal
                key={user?.uid || 'no-session'}
                isOpen={true}
                onClose={() => { setPaymentPlan(null); goBack(); }}
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
                   navigateTo('main');
                }}
              />
            )}

            {effectivePage === 'radar' && (
              <RadarSettingsPage
                key={user?.uid || 'no-session'}
                autoSettings={autoSettings}
                onAutoSettingsChange={setAutoSettings}
                onSave={saveAutoSettings}
                isWaiting={isScanningFinished}
                lang={lang}
                hasActivePlan={hasActivePlan}
                onUpgrade={() => navigateTo('plans')}
              />
            )}

            {effectivePage === 'paymentSettings' && (
              <PaymentModal
                key={user?.uid || 'no-session'}
                isOpen={true}
                onClose={goBack}
                planLabel=""
                amount={0}
                asPage
                manageMode
                lang={lang}
                freemiumDisabled={freemiumDisabled}
                onFreemiumToggle={(v: boolean) => { setFreemiumDisabled(v); localStorage.setItem('finalyze_freemium_disabled', v ? 'true' : 'false'); setDoc(doc(db, 'shared_settings', 'freemium'), { disabled: v, updatedAt: Date.now() }).catch(console.warn); }}
              />
            )}

            {effectivePage === 'clientMonitor' && isDeveloperSession() && (
              <ClientMonitor
                key={user?.uid || 'no-session'}
                clients={clients}
                lang={lang}
                onRefresh={fetchClients}
                onBan={banClient}
                onDelete={deleteClientRecord}
                onDeleteByEmail={deleteClientByEmail}
                onRenew={renewClientPlan}
                freemiumDisabled={freemiumDisabled}
                onFreemiumToggle={(v: boolean) => { setFreemiumDisabled(v); localStorage.setItem('finalyze_freemium_disabled', v ? 'true' : 'false'); setDoc(doc(db, 'shared_settings', 'freemium'), { disabled: v, updatedAt: Date.now() }).catch(console.warn); }}
                clientLoginRequired={clientLoginRequired}
                onClientLoginToggle={(v: boolean) => { setClientLoginRequired(v); localStorage.setItem('finalyze_client_login_required', v ? 'true' : 'false'); setDoc(doc(db, 'shared_settings', 'clientLogin'), { required: v, updatedAt: Date.now() }).catch(console.warn); }}
              />
            )}

            {effectivePage === 'ads' && isDeveloperSession() && (
              <AdsManager lang={lang} onBack={() => goBack()} />
            )}

            {effectivePage === 'siteStats' && isDeveloperSession() && (
              <SiteStatsPage lang={lang} />
            )}

            {effectivePage === 'profile' && (
              <ProfilePage
                user={user}
                lang={lang}
                onBack={goBack}
                isDeveloper={isDeveloperSession()}
              />
            )}

            {effectivePage === 'about' && (
              <AboutPage
                lang={lang}
                onBack={goBack}
                onGoToSuggestions={() => navigateTo('suggestions')}
              />
            )}

            {effectivePage === 'suggestions' && (
              <SuggestionsPage
                lang={lang}
                onBack={() => navigateTo('about')}
                userName={user?.displayName || user?.email || ''}
                isDeveloper={isDeveloperSession()}
                onHideCount={(n) => setNewSuggestionsCount(prev => Math.max(0, prev - n))}
              />
            )}

            {effectivePage === 'trade' && (
              <TradeNowPage lang={lang} user={user} />
            )}
          </motion.div>
        )}

        {/* FORM - hidden during analysis, hidden when results show, hidden when ApiKey is needed, hidden for clients */}
        <div style={{ display: isAnalyzing || analysisResults || effectivePage !== 'main' || !!needsApiKey || !isDeveloperSession() ? 'none' : 'block' }}>
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
            onSelect={handleSelectSignal} onDetail={setDetailResult} onClearAll={handleClearAll}
            lang={lang} 
          />

          <div className="w-full bg-[#D1FAE5]/40 backdrop-blur-xl rounded-full my-10 h-3 border border-[#D1FAE5]/60 shadow-[0_0_25px_rgba(209,250,229,0.3)]" />

          <AnalysisForm 
             user={user} lang={lang} settings={settings}
             hasActivePlan={hasActivePlan}
              onUpgrade={() => navigateTo('plans')}
              onBegin={() => { setIsAnalyzing(true); setAnalysisError(null); try { playStart(autoSettings.volume || 0.5); } catch {} }}
             onProgress={(current, total, index, failed) => setProgress({ current, total, index, failed })}
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
              onError={(errMsg, allFailed) => { setAnalysisResults(null); setAnalysisError(errMsg || null); setIsAnalyzing(false); setProgress(null); }}
          />
          <ConnectionStatus lang={lang} />
        </div>

        {/* Ads for all users */}
        <AdSlot position="between" lang={lang} />

        {/* CLIENT DASHBOARD - shows for non-developers on main page */}
        {!isDeveloperSession() && !analysisResults && !isAnalyzing && effectivePage === 'main' && (
          <div className="max-w-7xl mx-auto px-4">
            <AdSlot position="header" lang={lang} />
            <ClientDashboard results={clientSignals} lang={lang} hasActivePlan={hasActivePlan} onDetail={setDetailResult} />
          </div>
        )}

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
              <div className="max-w-4xl mx-auto mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-amber-400 text-sm font-medium">{analysisError}</p>
                <button onClick={() => { setAnalysisResults(null); setAnalysisError(null); }} className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline">
                  {lang === 'ar' ? '\u062a\u0639\u064a\u062f \u0644\u0644\u0645\u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649' : 'Try again'}
                </button>
              </div>
            )}
            <AnalysisResultView results={analysisResults} lang={lang} settings={settings} onDetail={setDetailResult} />
          </motion.div>
        )}

        {/* Floating back button - always visible on all pages */}
        {(effectivePage !== 'main' || detailResult || analysisResults) && (
          <button
            onClick={() => { if (detailResult) { setDetailResult(null); } else if (analysisResults) { setAnalysisResults(null); setAnalysisError(null); } goBack(); }}
            className="fixed bottom-6 right-6 z-[90] flex items-center gap-3 bg-[#F59E0B] hover:bg-[#d97706] transition-all rounded-2xl px-5 py-4 shadow-2xl shadow-[#F59E0B]/30 active:scale-95 group"
          >
            <ArrowLeft size={22} className="text-black group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-black text-black">{lang === 'ar' ? '\u0639\u0648\u062f\u0629 \u0644\u0644\u062e\u0644\u0641' : 'Go back'}</span>
          </button>
        )}
      </main>

      {/* Adsterra Banner 728x90 - Only for clients */}
      <AdBanner position="footer" isDeveloper={isDeveloperSession()} className="py-4" />

      <footer className="py-8 border-t border-white/5 bg-brand-alt/30">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">
          <p>┬⌐ {new Date().getFullYear()} Joseph.Trading. {t.allRightsReserved}.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">{t.privacyPolicy}</a>
            <a href="#" className="hover:text-primary transition-colors">{t.termsOfUse}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}




