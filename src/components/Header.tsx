import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { TrendingUp, LogIn, LogOut, Moon, Sun, Globe, ArrowLeft, Menu, Zap, AlertTriangle, MessageCircle, Upload, Download, FileAudio, Bell, ExternalLink, Smartphone, Tablet, X, Settings, Key, DollarSign, Users, User as UserIcon, Crown, Info, Lightbulb, Monitor, CalendarDays, Store, BarChart3 } from 'lucide-react';
import { Language, translations } from '../lib/i18n';
import { AutoAnalysisSettings } from '../types';
import { initAudio } from '../lib/audioEngine';
import { BASE_URL } from '../lib/firebase';
import { SYMBOL_CATEGORIES, ALL_SYMBOLS_DB } from '../constants';
import { fetchUrgentNews } from '../services/urgentNews';
import { lt, ltp, pick, pkick, loc } from '../lib/i18nUI';

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

const PROGRESS_CATEGORY_CONFIG: Record<string, { emoji: string; labelEn: string; labelAr: string; labelEs: string; labelRu: string; labelFr: string }> = {
  forex: { emoji: '\uD83D\uDCB1', labelEn: 'Forex', labelAr: 'فوركس', labelEs: 'Forex', labelRu: 'Форекс', labelFr: 'Forex' },
  crypto: { emoji: '\uD83E\uDDF1', labelEn: 'Crypto', labelAr: 'كريبتو', labelEs: 'Cripto', labelRu: 'Крипто', labelFr: 'Crypto' },
  stocks_us: { emoji: '\uD83C\uDDFA\uD83C\uDDF8', labelEn: 'US Stocks', labelAr: 'أسهم أمريكا', labelEs: 'Acciones EE. UU.', labelRu: 'Акции США', labelFr: 'Actions US' },
  stocks_eu: { emoji: '\uD83C\uDDEA\uD83C\uDDFA', labelEn: 'EU Stocks', labelAr: 'أسهم أوروبا', labelEs: 'Acciones UE', labelRu: 'Акции ЕС', labelFr: 'Actions UE' },
  stocks_jp: { emoji: '\uD83C\uDDEF\uD83C\uDDF5', labelEn: 'JP Stocks', labelAr: 'أسهم اليابان', labelEs: 'Acciones JP', labelRu: 'Акции Японии', labelFr: 'Actions JP' },
  metals: { emoji: '\uD83D\uDC8E', labelEn: 'Metals', labelAr: 'معادن', labelEs: 'Metales', labelRu: 'Металлы', labelFr: 'Métaux' },
};

function detectProgressCategory(symbol: string): { key: string; cfg?: typeof PROGRESS_CATEGORY_CONFIG[string] } {
  const sym = (symbol || '').toUpperCase().replace(/[-_=]/g, '');
  for (const [cat, syms] of Object.entries(SYMBOL_CATEGORIES)) {
    if ((syms as string[]).includes(sym)) return { key: cat, cfg: PROGRESS_CATEGORY_CONFIG[cat] };
  }
  for (const [cat, syms] of Object.entries(ALL_SYMBOLS_DB)) {
    if ((syms as string[]).includes(sym)) return { key: cat, cfg: PROGRESS_CATEGORY_CONFIG[cat] };
  }
  const s = symbol.toUpperCase();
  if (/XAU|XAG|GOLD|SILVER/.test(s)) return { key: 'metals', cfg: PROGRESS_CATEGORY_CONFIG.metals };
  if (/BTC|ETH|BNB|SOL|XRP|DOGE|ADA|DOT|AVAX|MATIC|LINK|UNI|SHIB|LTC|ATOM/.test(s)) return { key: 'crypto', cfg: PROGRESS_CATEGORY_CONFIG.crypto };
  if (/EUR|GBP|JPY|CHF|CAD|AUD|NZD|USD/.test(s)) return { key: 'forex', cfg: PROGRESS_CATEGORY_CONFIG.forex };
  if (/\.(T)$/.test(symbol)) return { key: 'stocks_jp', cfg: PROGRESS_CATEGORY_CONFIG.stocks_jp };
  if (/\.(AS|PA|DE|L|SW|CO)$/.test(symbol)) return { key: 'stocks_eu', cfg: PROGRESS_CATEGORY_CONFIG.stocks_eu };
  return { key: 'stocks_us', cfg: PROGRESS_CATEGORY_CONFIG.stocks_us };
}

interface HeaderProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  lang: Language;
  onLangChange: (l: Language) => void;
  showBack?: boolean;
  onBack?: () => void;
  autoSettings: AutoAnalysisSettings;
  onAutoSettingsChange: (s: AutoAnalysisSettings) => void;
  isWaiting?: boolean;
  hasApiKey: boolean;
  onToggleSidebar: () => void;
  isSidebarOpen?: boolean;
  isDeveloper?: boolean;
  lastSyncStatus?: { ok: boolean; count?: number; error?: string; time: number } | null;
  analysisProgress?: { current: string; total: number; index: number; failed?: number; exchange?: string } | null;
  isAnalyzing?: boolean;
  newSuggestionsCount?: number;
  onNavigateSuggestions?: () => void;
  paymentRequestsCount?: number;
  onNavigatePaymentRequests?: () => void;
  clientRadarRunning?: boolean;
  showRadarComplete?: boolean;
  onPreview?: (device: 'phone' | 'tablet') => void;
  isPWA?: boolean;
  onNavigatePage?: (page: 'settings' | 'apiKey' | 'plans' | 'radar' | 'paymentSettings' | 'clientMonitor' | 'profile' | 'about' | 'suggestions' | 'ads' | 'siteStats' | 'trade' | 'manualAnalysis' | 'store' | 'storeSettings' | 'prices' | 'transactions') => void;
  freemiumDisabled?: boolean;
  storeVisited?: boolean;
  compact?: boolean;
}

const LANGUAGES: { code: Language, label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'ru', label: 'Русский' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
];

export default function Header({ 
  user, 
  onLogin, 
  onLogout, 
  isDark, 
  toggleTheme, 
  lang, 
  onLangChange, 
  showBack, 
  onBack,
  autoSettings,
  onAutoSettingsChange,
  isWaiting,
  hasApiKey,
  onToggleSidebar,
  isDeveloper = false,
  lastSyncStatus = null,
  analysisProgress = null,
  isAnalyzing = false,
  newSuggestionsCount = 0,
  onNavigateSuggestions,
  paymentRequestsCount = 0,
  onNavigatePaymentRequests,
  clientRadarRunning = false,
  showRadarComplete = false,
  onPreview,
  isPWA: isPWAMode = false,
  onNavigatePage,
  freemiumDisabled = false,
  storeVisited = false,
  compact = false,
}: HeaderProps) {
  const t = translations[lang];
  const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

  // Live scanning only counts when auto-analysis is actually enabled. This makes
  // the top button flip to OFF the instant the developer toggles it, instead of
  // staying frozen on the last SYNCED/progress state until a scan finishes.
  const liveAnalysisActive = !!(analysisProgress && autoSettings.isEnabled);

  const TIMEFRAME_LABELS: Record<string, { ar: string; en: string; es?: string; ru?: string; fr?: string }> = {
    '15m': { ar: '15 دقيقة', en: '15min', es: '15min', ru: '15 мин', fr: '15min' },
    '1h':  { ar: 'ساعة',     en: '1hr',  es: '1h',    ru: '1 ч',   fr: '1h' },
    '4h':  { ar: '4 ساعات',  en: '4hr',  es: '4h',    ru: '4 ч',   fr: '4h' },
    '1d':  { ar: 'يومي',     en: 'Daily',  es: 'Diario',   ru: 'День',  fr: 'Quotidien' },
    '1w':  { ar: 'أسبوعي',   en: 'Weekly', es: 'Semanal',  ru: 'Неделя', fr: 'Hebdomadaire' },
    '1M':  { ar: 'شهري',     en: 'Monthly',es: 'Mensual',  ru: 'Месяц', fr: 'Mensuel' },
    '1Y':  { ar: 'سنوي',     en: 'Yearly', es: 'Anual',    ru: 'Год',   fr: 'Annuel' },
  };
  const tfLabel = TIMEFRAME_LABELS[autoSettings.timeframe] || { ar: autoSettings.timeframe, en: autoSettings.timeframe };

  const ANALYSIS_LABELS: Record<string, { ar: string; en: string; es?: string; ru?: string; fr?: string }> = {
    '15m': { ar: 'التحليل الربع ساعي', en: '15-Min Analysis', es: 'Análisis de 15 min', ru: 'Анализ за 15 минут', fr: 'Analyse 15 min' },
    '1h':  { ar: 'التحليل الساعي',     en: 'Hourly Analysis', es: 'Análisis por horas', ru: 'Почасовой анализ', fr: 'Analyse horaire' },
    '4h':  { ar: 'التحليل الربعاوي',   en: '4-Hour Analysis', es: 'Análisis de 4 horas', ru: 'Анализ за 4 часа', fr: 'Analyse de 4 heures' },
    '1d':  { ar: 'التحليل اليومي',     en: 'Daily Analysis', es: 'Análisis diario', ru: 'Дневной анализ', fr: 'Analyse quotidienne' },
    '1w':  { ar: 'التحليل الأسبوعي',   en: 'Weekly Analysis', es: 'Análisis semanal', ru: 'Недельный анализ', fr: 'Analyse hebdomadaire' },
    '1M':  { ar: 'التحليل الشهري',     en: 'Monthly Analysis', es: 'Análisis mensual', ru: 'Месячный анализ', fr: 'Analyse mensuelle' },
    '1Y':  { ar: 'التحليل السنوي',     en: 'Yearly Analysis', es: 'Análisis anual', ru: 'Годовой анализ', fr: 'Analyse annuelle' },
  };
  const analysisLabel = ANALYSIS_LABELS[autoSettings.timeframe] || tfLabel;

  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [newsFlash, setNewsFlash] = useState(false);

  useEffect(() => {
    if (isDeveloper) return;
    let stopTimer: ReturnType<typeof setTimeout> | null = null;
    const seen = new Set<string>();
    let initialized = false;
    const check = async () => {
      const items = await fetchUrgentNews();
      if (!initialized) { items.forEach((i) => seen.add(i.title)); initialized = true; return; }
      const fresh = items.filter((i) => !seen.has(i.title));
      fresh.forEach((i) => seen.add(i.title));
      if (fresh.length > 0) {
        setNewsFlash(true);
        if (stopTimer) clearTimeout(stopTimer);
        stopTimer = setTimeout(() => setNewsFlash(false), 60000);
      }
    };
    check();
    const id = setInterval(check, 60000);
    return () => { clearInterval(id); if (stopTimer) clearTimeout(stopTimer); };
  }, [lang, isDeveloper]);
  const isPWA = isPWAMode;
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [mobileLangOpen, setMobileLangOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const langButtonRef = useRef<HTMLButtonElement>(null);
  const [langMenuPos, setLangMenuPos] = useState<{top: number; left: number} | null>(null);

  useEffect(() => {
    setCustomAvatar(localStorage.getItem('finalyze_custom_avatar'));
    setCustomLogo(localStorage.getItem('finalyze_custom_logo'));
    const handleStorage = () => {
      setCustomAvatar(localStorage.getItem('finalyze_custom_avatar'));
      setCustomLogo(localStorage.getItem('finalyze_custom_logo'));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      setTimeout(() => {
        if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node) && !profileButtonRef.current?.contains(e.target as Node)) {
          setShowProfileMenu(false);
        }
        if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node) && !langButtonRef.current?.contains(e.target as Node)) {
          setShowLangMenu(false);
        }
      }, 0);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isMarketClosedToday = () => {
    const day = new Date().getUTCDay();
    return day === 0 || day === 6;
  };

  return (
    <div className="flex flex-col">
      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100]" onClick={() => setShowLogoutConfirm(false)}>
          <div className={`absolute top-[60px] w-64 bg-brand-alt border border-brand-text/10 rounded-xl shadow-2xl overflow-hidden z-[100] ${lang === 'ar' ? 'left-4' : 'right-4'}`} onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-sm font-black text-white">{lt(lang, 304)}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-white/60 mb-3">{lt(lang, 699)}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-white/20 text-white/60 text-xs font-bold hover:bg-white/10 transition-colors"
                >
                  {lt(lang, 120)}
                </button>
                <button
                  onClick={() => { setShowLogoutConfirm(false); onLogout(); }}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors"
                >
                  {lt(lang, 304)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu Overlay - phones (both PWA standalone and normal browser) */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-[85%] max-w-[340px] bg-[#D1FAE5] shadow-2xl overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between px-4 py-4 border-b border-black/10">
              <span className="text-sm font-black text-black uppercase tracking-wider">
                {lt(lang, 730)}
              </span>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors"
              >
                <X size={18} className="text-black" />
              </button>
            </div>
            <div className="flex flex-col gap-2 p-4">
              {/* Radar Status - Client */}
              {!isDeveloper && (<>
                <div className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border-2 shadow-lg transition-all",
                  clientRadarRunning
                    ? 'bg-red-600 border-red-700 text-white shadow-red-500/50 animate-pulse'
                    : showRadarComplete
                      ? 'bg-emerald-600 border-emerald-700 text-white shadow-emerald-500/50'
                      : 'bg-emerald-500/20 border-emerald-500/40'
                )}>
                  <div className="relative">
                    <Zap size={24} className={clientRadarRunning || showRadarComplete ? 'text-white' : 'text-emerald-400'} fill="currentColor" />
                    {clientRadarRunning && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping shadow-[0_0_16px_white]" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] leading-none">
                      {lt(lang, 700)}
                    </span>
                    <span className={cn(
                      "text-[12px] font-black uppercase tracking-wider leading-tight",
                      clientRadarRunning || showRadarComplete ? 'text-white' : 'text-emerald-400'
                    )}>
                      {clientRadarRunning
                        ? (lt(lang, 780))
                        : showRadarComplete
                          ? (lt(lang, 783))
                          : (lt(lang, 51))
                      }
                    </span>
                  </div>
                </div>
              </>)}

              {/* Auto Analysis Toggle - Developer */}
              {isDeveloper && (<>
                <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/20 bg-white/10 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Zap size={18} className={autoSettings.isEnabled ? 'text-emerald-400' : 'text-black/50'} fill={autoSettings.isEnabled ? "currentColor" : "none"} />
                    <span className="text-xs font-black text-black uppercase">
                      {lt(lang, 700)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      initAudio();
                      onAutoSettingsChange({ ...autoSettings, isEnabled: !autoSettings.isEnabled });
                    }}
                    className={cn(
                      "relative w-12 h-6 rounded-full transition-all",
                      autoSettings.isEnabled
                        ? (isWaiting ? 'bg-yellow-500' : 'bg-emerald-500')
                        : 'bg-black/20'
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all",
                      autoSettings.isEnabled ? 'left-6' : 'left-0.5'
                    )} />
                  </button>
                </div>
              </>)}

              {/* Analysis Progress - Developer */}
              {isDeveloper && analysisProgress && (
                <div className="px-4 py-3 rounded-xl border border-blue-500/50 bg-blue-500/15 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs font-black text-black uppercase">
                      {lt(lang, 697)} {analysisProgress.index + 1}/{analysisProgress.total}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-black/70 mt-1 block truncate">{analysisProgress.current}</span>
                </div>
              )}

              {/* Divider: Navigation */}
              <div className="border-t border-black/10 pt-2">
                <span className="text-[9px] font-black uppercase text-black/40 tracking-[0.2em] px-2">
                  {lt(lang, 733)}
                </span>
              </div>

              {/* Sidebar Navigation Items */}
              {/* Trade - always accessible on mobile */}
              <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('trade'); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-black/10 bg-[#F59E0B]/30 hover:bg-[#F59E0B]/50 transition-all shadow-sm">
                <TrendingUp size={18} className="text-[#F59E0B]" />
                <span className="text-xs font-black text-black uppercase min-w-0 leading-snug">{lt(lang, 573)}</span>
              </button>
              <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('prices'); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-black/10 bg-emerald-500/20 hover:bg-emerald-500/40 transition-all shadow-sm">
                <BarChart3 size={18} className="text-emerald-500" />
                <span className="text-xs font-black text-black uppercase min-w-0 leading-snug">{lt(lang, 724)}</span>
              </button>
              {isDeveloper ? (
                <>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('radar'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Zap size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase min-w-0 leading-snug">{lt(lang, 701)}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('manualAnalysis'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all shadow-sm">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-600">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span className="text-xs font-black text-black uppercase min-w-0 leading-snug">{lt(lang, 728)}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('apiKey'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Key size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lt(lang, 84)}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('profile'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <UserIcon size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lt(lang, 742)}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('settings'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Settings size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lt(lang, 755)}</span>
                  </button>
                  {!freemiumDisabled && (
                    <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('plans'); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                      <DollarSign size={18} className="text-[#F59E0B]" />
                      <span className="text-xs font-black text-black uppercase">{lt(lang, 424)}</span>
                    </button>
                  )}
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('storeSettings'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Store size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lt(lang, 527)}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('store'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all shadow-sm">
                    <Store size={18} className="text-emerald-500" />
                    <span className="text-xs font-black text-black uppercase">{lt(lang, 777)}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('clientMonitor'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Users size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lt(lang, 141)}</span>
                  </button>
                  {/* Suggestions - Developer */}
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('suggestions'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/40 transition-all shadow-sm">
                    <div className="relative">
                      <Bell size={18} className="text-[#F59E0B]" />
                      {newSuggestionsCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-lg">
                          {newSuggestionsCount}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-black text-black uppercase">{lt(lang, 762)}</span>
                    {newSuggestionsCount > 0 && (
                      <span className="mr-auto text-[10px] font-black text-[#F59E0B] bg-[#F59E0B]/20 px-2 py-0.5 rounded-full">
                        {newSuggestionsCount} {lt(lang, 348)}
                      </span>
                    )}
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('ads'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/40 transition-all shadow-sm">
                    <Monitor size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lt(lang, 732)}</span>
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('profile'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <UserIcon size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lt(lang, 742)}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('about'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Info size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lt(lang, 694)}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('suggestions'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Lightbulb size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lt(lang, 633)}</span>
                  </button>
                  {!freemiumDisabled && (
                    <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('plans'); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-emerald-500/20 hover:bg-emerald-500/40 transition-all shadow-sm">
                      <Crown size={18} className="text-emerald-500" />
                      <span className="text-xs font-black text-black uppercase">{lt(lang, 706)}</span>
                    </button>
                  )}
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('store'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-sky-500/20 hover:bg-sky-500/40 transition-all shadow-sm">
                    <Store size={18} className="text-sky-500" />
                    <span className="text-xs font-black text-black uppercase">{lt(lang, 705)}</span>
                  </button>
                </>
              )}

              {/* Divider: Tools */}
              <div className="border-t border-black/10 pt-2">
                <span className="text-[9px] font-black uppercase text-black/40 tracking-[0.2em] px-2">
                  {lt(lang, 769)}
                </span>
              </div>

              {/* Contact */}
              <a
                href="https://www.facebook.com/messages/e2ee/t/7630276620403742/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-[#0084FF]/20 hover:bg-[#0084FF]/40 transition-all shadow-sm"
              >
                <MessageCircle size={18} className="text-[#0084FF]" />
                <span className="text-xs font-black text-black uppercase">
                  {lt(lang, 708)}
                </span>
              </a>

              {/* Theme */}
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 transition-all shadow-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-[#F59E0B] flex items-center justify-center shadow-md">
                  {isDark ? <Sun size={16} className="text-black" /> : <Moon size={16} className="text-black" />}
                </div>
                <span className="text-xs font-black text-black uppercase">
                  {lt(lang, 766)}
                </span>
                <span className="mr-auto text-[10px] font-bold text-black/50">
                  {isDark ? '☀️' : '🌙'}
                </span>
              </button>

              {/* Language */}
              <div className="rounded-xl border border-white/20 bg-white/10 overflow-hidden">
                <button
                  onClick={() => setMobileLangOpen(!mobileLangOpen)}
                  className="flex items-center gap-3 px-4 py-3 w-full hover:bg-white/10 transition-all"
                >
                  <Globe size={18} className="text-black" />
                  <span className="text-xs font-black text-black uppercase">
                    {lt(lang, 723)}
                  </span>
                  <span className="mr-auto text-[10px] font-bold text-[#F59E0B] uppercase bg-[#F59E0B]/20 px-2 py-0.5 rounded-full">
                    {lang.toUpperCase()}
                  </span>
                </button>
                {mobileLangOpen && (
                  <div className="border-t border-white/10">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => { onLangChange(l.code); setMobileLangOpen(false); }}
                        className={cn(
                          "w-full px-4 py-2.5 text-left text-xs font-bold transition-colors hover:bg-white/10",
                          lang === l.code ? "text-[#F59E0B] bg-[#F59E0B]/10" : "text-black/60"
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview - Developer */}
              {isDeveloper && onPreview && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/20 bg-white/10">
                  <span className="text-xs font-black text-black uppercase">
                    {lt(lang, 741)}
                  </span>
                  <div className="flex gap-1 ml-auto">
                    <button
                      onClick={() => { onPreview('phone'); setShowMobileMenu(false); }}
                      className="p-2 rounded-lg bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all shadow-md"
                    >
                      <Smartphone size={16} />
                    </button>
                    <button
                      onClick={() => { onPreview('tablet'); setShowMobileMenu(false); }}
                      className="p-2 rounded-lg bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all shadow-md"
                    >
                      <Tablet size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Divider: Account */}
              <div className="border-t border-black/10 pt-2">
                <span className="text-[9px] font-black uppercase text-black/40 tracking-[0.2em] px-2">
                  {lt(lang, 695)}
                </span>
              </div>

              {/* Profile / Login */}
              {user ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10">
                  <div className="w-10 h-10 rounded-full bg-[#F59E0B] border-2 border-black/20 flex items-center justify-center overflow-hidden shadow-lg">
                    {customAvatar ? (
                      <img src={customAvatar} alt="profile" className="w-full h-full object-cover" />
                    ) : user.photoURL ? (
                      <img src={user.photoURL} alt="profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-black/10 flex items-center justify-center text-black">
                        <span className="text-sm font-black">{user.email?.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-black text-black truncate">{user.displayName || user.email?.split('@')[0]}</span>
                    <span className="text-[10px] font-bold text-black/60 truncate">{user.email}</span>
                  </div>
                  <button
                    onClick={() => { setShowMobileMenu(false); setShowLogoutConfirm(true); }}
                    className="p-2 rounded-lg bg-red-500/20 text-red-600 hover:bg-red-500/40 transition-all"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setShowMobileMenu(false); onLogin(); }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#F59E0B] text-black font-black text-sm uppercase tracking-wider shadow-lg hover:bg-[#d97706] active:scale-95 transition-all"
                >
                  <LogIn size={18} />
                  {t.login}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Market Status Banner */}
      {isMarketClosedToday() && (
        <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.3em] py-1.5 flex items-center justify-center gap-2 px-4 text-center">
          <AlertTriangle size={12} className="animate-pulse" />
          {lt(lang, 781)}
          <AlertTriangle size={12} className="animate-pulse" />
        </div>
      )}

      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 shadow-2xl shadow-emerald-500/20 transition-all duration-300",
        compact ? 'h-[104px] md:h-[132px]' : 'h-[104px] md:h-[300px]'
      )}>
        {/* Trading Banner Background */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src="/trading-banner.png"
            alt="Joseph.Trading"
            className={cn(
              "w-full h-full object-cover transition-all duration-300",
              compact ? 'object-[center_30%] opacity-60' : 'object-[center_50%]'
            )}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.classList.add('bg-gradient-to-r', 'from-emerald-600', 'via-emerald-500', 'to-emerald-600');
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-black/60" />
        </div>

        {/* Content Overlay - top row: logo left, icons right | MOBILE: icons wrap below logo via flex-wrap, desktop unchanged via md: */}
        <div className={cn(
          "relative w-full h-full flex flex-wrap items-start transition-all duration-300",
          compact ? 'pt-2' : 'pt-3'
        )}>
          <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full">
            {/* Logo + Name - far left | MOBILE: full-width header row with hamburger top-right */}
            <div className="flex items-center gap-3 flex-shrink-0 w-full md:w-auto justify-between md:justify-start">
              <div className={cn(
                "bg-black rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl border-2 border-white/30 transition-all duration-300",
                compact ? 'w-[56px] h-[56px]' : 'w-[80px] h-[80px]'
              )}>
                <img src={customLogo || `${BASE_URL}logo.png`} alt="JT" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <span className={cn(
                  "font-display font-black tracking-tight text-white drop-shadow-2xl leading-none transition-all duration-300",
                  compact ? 'text-lg' : 'text-3xl'
                )}>
                  Joseph.<span className="text-sky-300 italic">Trading</span>
                </span>
                {!compact && (
                  <span className="text-[14px] font-black uppercase tracking-[0.15em] text-white/70 leading-tight mt-1 block">For Financial<br/>Market Analysis</span>
                )}
              </div>
              {/* Mobile hamburger — stays top-right on phones, hidden on desktop (desktop uses icon-row menu) */}
              <button
                onClick={() => setShowMobileMenu(true)}
                className="flex md:hidden p-3 rounded-xl bg-[#F59E0B] text-black hover:bg-[#d97706] transition-all shadow-md flex-shrink-0"
                title={lt(lang, 730)}
              >
                <Menu size={22} />
              </button>
            </div>

            {/* Icons - desktop only | MOBILE: all icons moved into sidebar menu */}
            {!isPWA && (
            <div className="hidden md:flex items-center gap-3 flex-1 min-w-0 justify-end">
              {/* Live Prices | client only, sits right before the store icon with the same gap as every other top-bar icon. Flashes for one minute when urgent market news appears. */}
              {!isDeveloper && (
                <button
                  onClick={() => onNavigatePage?.('prices')}
                  className={cn(
                    "hidden md:flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#4E342E] hover:bg-[#3E2723] text-white shadow-lg shadow-black/30 active:scale-95 transition-all border border-black/10 flex-shrink-0",
                    newsFlash && "animate-flash-fast"
                  )}
                  title={lt(lang, 724)}
                >
                  <BarChart3 size={24} className="flex-shrink-0" />
                  <span className="text-[18px] font-black uppercase tracking-wider whitespace-nowrap leading-none">
                    {lt(lang, 724)}
                  </span>
                </button>
              )}
              {/* Store | Client desktop only (developer uses sidebar item) — flashing "مجاني" inside the icon, widens horizontally */}
              {!isDeveloper && (
              <button
                onClick={() => onNavigatePage?.('store')}
                className="hidden md:flex items-center gap-2 px-5 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/30 active:scale-95 transition-all border border-black/10 flex-shrink-0"
                title={lt(lang, 705)}
              >
                <Store size={24} className="flex-shrink-0" />
                <span className="text-[18px] font-black uppercase tracking-wider whitespace-nowrap leading-none">
                  {lt(lang, 759)}
                </span>
                <span className={cn("px-2 py-0.5 rounded-lg bg-white text-sky-600 text-xs font-black uppercase tracking-wider whitespace-nowrap leading-none", !storeVisited && 'animate-flash-fast')}>
                  {lt(lang, 263)}
                </span>
              </button>
              )}

              {/* Trade Now | MOBILE: moved to sidebar (hidden md:flex) */}
              <button
                onClick={() => onNavigatePage?.('trade')}
                className="hidden md:flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#F59E0B] hover:bg-[#d97706] text-black shadow-lg shadow-[#F59E0B]/30 active:scale-95 transition-all border border-black/10 flex-shrink-0"
              >
                <TrendingUp size={24} className="flex-shrink-0" />
                <span className="text-[18px] font-black uppercase tracking-wider whitespace-nowrap leading-none">
                  {lt(lang, 573)}
                </span>
              </button>

              {/* Suggestions - developer only | MOBILE: moved to sidebar */}
              {isDeveloper && (
                <button
                  onClick={onNavigateSuggestions}
                  className="hidden md:flex relative p-3 rounded-xl bg-[#F59E0B] text-black hover:bg-[#d97706] transition-all shadow-md flex-shrink-0"
                >
                  <Bell size={22} />
                  {newSuggestionsCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1">
                      {newSuggestionsCount}
                    </span>
                  )}
                </button>
              )}

              {/* Payment notifications - developer only → opens Transactions page */}
              {isDeveloper && (
                <button
                  onClick={() => onNavigatePage?.('transactions')}
                  title={lt(lang, 747)}
                  className="hidden md:flex relative p-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 transition-all shadow-md flex-shrink-0"
                >
                  <Bell size={22} />
                  {paymentRequestsCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1">
                      {paymentRequestsCount}
                    </span>
                  )}
                </button>
              )}

              {/* Contact | MOBILE: moved to sidebar (hidden md:flex) */}
              <a
                href="https://www.facebook.com/messages/e2ee/t/7630276620403742/"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:flex p-3 rounded-xl bg-[#0084FF] text-white hover:bg-[#006ADB] transition-all shadow-md flex-shrink-0"
              >
                <MessageCircle size={22} />
              </a>

              {/* Auto Analysis + Sync Status + Timeframe Indicator */}
              {isDeveloper ? (
            <div className="relative flex-shrink-0">
            <button
              onClick={() => {
                initAudio();
                onAutoSettingsChange({ ...autoSettings, isEnabled: !autoSettings.isEnabled });
              }}
              className={cn(
                "flex items-center gap-2.5 px-5 py-3 rounded-2xl border shadow-md transition-all backdrop-blur-sm flex-shrink-0 active:scale-95",
                liveAnalysisActive
                  ? 'bg-emerald-600 border-emerald-700 text-white animate-pulse'
                  : autoSettings.isEnabled
                    ? 'bg-emerald-600 border-emerald-700 text-white'
                    : 'bg-red-700 border-red-800 text-white'
              )}
            >
                  <div className="relative flex-shrink-0">
                    {liveAnalysisActive ? (
                      <div className="w-[28px] h-[28px] rounded-full bg-white animate-bounce" />
                    ) : autoSettings.isEnabled && lastSyncStatus ? (
                      <span className="text-[24px] font-black leading-none">{lastSyncStatus.ok ? '✓' : '✗'}</span>
                    ) : (
                      <Zap size={24} fill={autoSettings.isEnabled ? "currentColor" : "none"} className="text-white" />
                    )}
                  </div>
                  <span className="text-[18px] font-black uppercase tracking-wider whitespace-nowrap leading-none">
                    {liveAnalysisActive
                      ? `${analysisProgress.index + 1}/${analysisProgress.total}`
                      : autoSettings.isEnabled && lastSyncStatus
                        ? (lastSyncStatus.ok ? 'SYNCED' : 'FAIL')
                        : autoSettings.isEnabled ? (isWaiting ? 'WAIT' : 'ON') : 'OFF'
                    }
                  </span>
                  {autoSettings.isEnabled && lastSyncStatus?.count !== undefined && (
                    <span className="text-[16px] font-black text-yellow-300 leading-none">{lastSyncStatus.count}</span>
                  )}
                  {liveAnalysisActive && (() => {
                    if (analysisProgress.exchange) {
                      return (
                        <span className="text-[16px] font-black text-yellow-300 whitespace-nowrap leading-none">
                          {analysisProgress.exchange}
                        </span>
                      );
                    }
                    const { cfg } = detectProgressCategory(analysisProgress.current);
                    return (
                      <span className="text-[16px] font-black text-yellow-300 whitespace-nowrap leading-none">
                        {cfg ? `${cfg.emoji} ${pkick(lang, cfg, 'label')}` : analysisProgress.current}
                      </span>
                    );
                  })()}
                </button>
                {!isPWA && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50">
                    <div className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-[#002395] border border-[#001A6B] text-white shadow-md flex-shrink-0 whitespace-nowrap">
                      <CalendarDays size={24} className="flex-shrink-0" />
                      <span className="text-[18px] font-black uppercase tracking-wider whitespace-nowrap leading-none">
                        {pick(lang, analysisLabel)}
                      </span>
                    </div>
                  </div>
                )}
            </div>
              ) : (
            <div className="relative flex-shrink-0">
                <div className={cn(
                  "flex items-center gap-2 px-4 py-3 rounded-xl border shadow-md backdrop-blur-sm flex-shrink-0",
                  clientRadarRunning
                    ? 'bg-red-600 border-red-700 text-white animate-pulse'
                    : showRadarComplete
                      ? 'bg-emerald-600 border-emerald-700 text-white'
                      : 'bg-emerald-500/30 border-emerald-500/50 text-white'
                )}>
                  <Zap size={20} className="text-white" fill="currentColor" />
                  <span className="text-[16px] font-black uppercase tracking-wider">
                    {clientRadarRunning ? 'SCANNING' : showRadarComplete ? 'DONE' : 'ACTIVE'}
                  </span>
                </div>
                {!isPWA && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50">
                    <div className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-[#002395] border border-[#001A6B] text-white shadow-md flex-shrink-0 whitespace-nowrap">
                      <CalendarDays size={24} className="flex-shrink-0" />
                      <span className="text-[18px] font-black uppercase tracking-wider whitespace-nowrap leading-none">
                        {pick(lang, analysisLabel)}
                      </span>
                    </div>
                  </div>
                )}
            </div>
              )}

              {/* Manual Analysis - developer only | MOBILE: moved to sidebar */}
              {isDeveloper && (
                <button
                  onClick={() => onNavigatePage?.('manualAnalysis')}
                  className="hidden md:flex items-center gap-2 px-5 py-3 rounded-2xl border shadow-md transition-all backdrop-blur-sm bg-red-700 border-red-800 text-white hover:bg-red-600 active:scale-95 flex-shrink-0"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span className="text-[18px] font-black uppercase tracking-wider whitespace-nowrap leading-none">
                    {lt(lang, 727)}
                  </span>
                </button>
              )}

              {/* Theme */}
              <button 
                onClick={toggleTheme}
                className="p-3 rounded-xl bg-[#F59E0B] text-black hover:bg-[#d97706] transition-all shadow-md flex-shrink-0"
              >
                {isDark ? <Sun size={22} /> : <Moon size={22} />}
              </button>

              {/* Language */}
              <div className="relative flex-shrink-0">
                <button 
                  ref={langButtonRef}
                  onClick={() => {
                    if (showLangMenu) { setShowLangMenu(false); return; }
                    const rect = langButtonRef.current?.getBoundingClientRect();
                    if (rect) {
                      setLangMenuPos({ top: rect.bottom + 8, left: lang === 'ar' ? rect.left : rect.right - 160 });
                    }
                    setShowLangMenu(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#F59E0B] text-black hover:bg-[#d97706] transition-all shadow-md"
                >
                  <Globe size={22} />
                  <span className="text-[14px] font-black uppercase">{lang}</span>
                </button>
                {showLangMenu && langMenuPos && (
                  <div ref={langMenuRef} className="fixed w-40 bg-brand-alt border border-brand-text/10 rounded-xl shadow-2xl z-[60] overflow-hidden" style={{ top: langMenuPos.top, left: langMenuPos.left }}>
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => { onLangChange(l.code); setShowLangMenu(false); }}
                        className={cn(
                          "w-full px-4 py-3 text-left text-sm font-bold transition-colors hover:bg-primary/10",
                          lang === l.code ? "text-primary bg-primary/5" : "text-brand-text/60"
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Profile / Logout | MOBILE: moved to sidebar (hidden md:flex) */}
              {user ? (
                <div className="relative flex-shrink-0 hidden md:flex" ref={profileMenuRef}>
                  <button 
                    ref={profileButtonRef}
                    onClick={() => setShowLogoutConfirm(!showLogoutConfirm)}
                    className="w-[48px] h-[48px] rounded-full bg-[#F59E0B] border-2 border-white/30 flex items-center justify-center overflow-hidden shadow-lg hover:scale-105 transition-all"
                  >
                    {customAvatar ? (
                      <img src={customAvatar} alt="profile" className="w-full h-full object-cover" />
                    ) : user.photoURL ? (
                      <img src={user.photoURL} alt="profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-black text-black">{user.email?.charAt(0).toUpperCase()}</span>
                    )}
                  </button>
                </div>
              ) : (
                <button 
                  onClick={onLogin}
                  className="hidden md:flex items-center gap-1.5 bg-[#F59E0B] text-black px-4 py-2.5 rounded-xl font-black text-sm uppercase shadow-md hover:bg-[#d97706] active:scale-95 transition-all flex-shrink-0"
                >
                  <LogIn size={22} />
                </button>
              )}

              {/* Menu toggle — desktop only (mobile uses top-row hamburger) */}
              {!isPWA && (
                <button
                  onMouseDown={(e) => { e.stopPropagation(); onToggleSidebar(); }}
                  className="hidden md:flex p-3 rounded-xl bg-[#F59E0B] text-black hover:bg-[#d97706] transition-all shadow-md flex-shrink-0 items-center justify-center"
                  title={lt(lang, 730)}
                >
                  <Menu size={24} />
                </button>
              )}
            </div>
            )}

            {/* PWA: hamburger only — desktop only (mobile uses top-row hamburger) */}
            {isPWA && (
              <button
                onClick={() => setShowMobileMenu(true)}
                className="hidden md:flex p-2 rounded-lg bg-[#F59E0B] text-black hover:bg-[#d97706] transition-all shadow-md flex-shrink-0 items-center justify-center"
              >
                <Menu size={22} />
              </button>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}
