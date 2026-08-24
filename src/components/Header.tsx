import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { TrendingUp, LogIn, LogOut, Moon, Sun, Globe, ArrowLeft, Menu, Zap, AlertTriangle, MessageCircle, Upload, Download, FileAudio, Bell, ExternalLink, Smartphone, Tablet, X, Settings, Key, DollarSign, Wallet, Users, User, Crown, Info, Lightbulb, Monitor } from 'lucide-react';
import { Language, translations } from '../lib/i18n';
import { AutoAnalysisSettings } from '../types';
import { initAudio } from '../lib/audioEngine';
import { BASE_URL } from '../lib/firebase';
import { SYMBOL_CATEGORIES, ALL_SYMBOLS_DB } from '../constants';

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

const PROGRESS_CATEGORY_CONFIG: Record<string, { emoji: string; labelAr: string; labelEn: string }> = {
  forex: { emoji: '\uD83D\uDCB1', labelAr: 'فوركس', labelEn: 'Forex' },
  crypto: { emoji: '\uD83E\uDDF1', labelAr: 'كريبتو', labelEn: 'Crypto' },
  stocks: { emoji: '\uD83D\uDCC8', labelAr: 'أسهم', labelEn: 'Stocks' },
  metals: { emoji: '\uD83D\uDC8E', labelAr: 'معادن', labelEn: 'Metals' },
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
  return { key: '', cfg: undefined };
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
  analysisProgress?: { current: string; total: number; index: number; failed?: number } | null;
  isAnalyzing?: boolean;
  newSuggestionsCount?: number;
  onNavigateSuggestions?: () => void;
  clientRadarRunning?: boolean;
  showRadarComplete?: boolean;
  onPreview?: (device: 'phone' | 'tablet') => void;
  isPWA?: boolean;
  onNavigatePage?: (page: 'settings' | 'apiKey' | 'plans' | 'radar' | 'paymentSettings' | 'clientMonitor' | 'profile' | 'about' | 'suggestions' | 'ads' | 'siteStats' | 'trade' | 'manualAnalysis') => void;
  freemiumDisabled?: boolean;
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
  clientRadarRunning = false,
  showRadarComplete = false,
  onPreview,
  isPWA: isPWAMode = false,
  onNavigatePage,
  freemiumDisabled = false,
  compact = false,
}: HeaderProps) {
  const t = translations[lang];
  const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const isPWA = isPWAMode;
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [mobileLangOpen, setMobileLangOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

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
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isMarketClosedToday = () => {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  };

  return (
    <div className="flex flex-col">
      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <LogOut size={20} className="text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">
                {lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              {lang === 'ar' ? 'هل أنت متأكد من تسجيل الخروج؟' : 'Are you sure you want to logout?'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => { setShowLogoutConfirm(false); onLogout(); }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors"
              >
                {lang === 'ar' ? 'تأكيد' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Mobile Menu Overlay - only in standalone mode */}
      {isPWA && showMobileMenu && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-[85%] max-w-[340px] bg-[#D1FAE5] shadow-2xl overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between px-4 py-4 border-b border-black/10">
              <span className="text-sm font-black text-black uppercase tracking-wider">
                {lang === 'ar' ? 'القائمة' : 'Menu'}
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
              {!isDeveloper && (
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
                      {lang === 'ar' ? 'التحليل التلقائي' : 'Auto Analysis'}
                    </span>
                    <span className={cn(
                      "text-[12px] font-black uppercase tracking-wider leading-tight",
                      clientRadarRunning || showRadarComplete ? 'text-white' : 'text-emerald-400'
                    )}>
                      {clientRadarRunning
                        ? (lang === 'ar' ? '⏳ انتظار...' : '⏳ Waiting...')
                        : showRadarComplete
                          ? (lang === 'ar' ? '✅ تم' : '✅ Done')
                          : (lang === 'ar' ? 'نشط' : 'Active')
                      }
                    </span>
                  </div>
                </div>
              )}

              {/* Auto Analysis Toggle - Developer */}
              {isDeveloper && (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/20 bg-white/10 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Zap size={18} className={autoSettings.isEnabled ? 'text-emerald-400' : 'text-black/50'} fill={autoSettings.isEnabled ? "currentColor" : "none"} />
                    <span className="text-xs font-black text-black uppercase">
                      {lang === 'ar' ? 'التحليل التلقائي' : 'Auto Analysis'}
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
              )}

              {/* Analysis Progress - Developer */}
              {isDeveloper && analysisProgress && (
                <div className="px-4 py-3 rounded-xl border border-blue-500/50 bg-blue-500/15 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-xs font-black text-black uppercase">
                      {lang === 'ar' ? 'جاري التحليل' : 'Analyzing'} {analysisProgress.index + 1}/{analysisProgress.total}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-black/70 mt-1 block truncate">{analysisProgress.current}</span>
                </div>
              )}

              {/* Divider: Navigation */}
              <div className="border-t border-black/10 pt-2">
                <span className="text-[9px] font-black uppercase text-black/40 tracking-[0.2em] px-2">
                  {lang === 'ar' ? 'التنقل' : 'Navigation'}
                </span>
              </div>

              {/* Sidebar Navigation Items */}
              {isDeveloper ? (
                <>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('radar'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Zap size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lang === 'ar' ? 'إعدادات التحليل التلقائي' : 'Auto Analysis Settings'}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('apiKey'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Key size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lang === 'ar' ? 'مفتاح API' : 'API Key'}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('profile'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <User size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lang === 'ar' ? 'الملف الشخصي' : 'Profile'}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('settings'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Settings size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lang === 'ar' ? 'الإعدادات' : 'Settings'}</span>
                  </button>
                  {!freemiumDisabled && (
                    <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('plans'); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                      <DollarSign size={18} className="text-[#F59E0B]" />
                      <span className="text-xs font-black text-black uppercase">{lang === 'ar' ? 'الخطط' : 'Plans'}</span>
                    </button>
                  )}
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('paymentSettings'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Wallet size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lang === 'ar' ? 'عناوين الدفع' : 'Payment Addresses'}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('clientMonitor'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Users size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lang === 'ar' ? 'مراقبة العملاء' : 'Client Monitor'}</span>
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
                    <span className="text-xs font-black text-black uppercase">{lang === 'ar' ? 'المقترحات' : 'Suggestions'}</span>
                    {newSuggestionsCount > 0 && (
                      <span className="mr-auto text-[10px] font-black text-[#F59E0B] bg-[#F59E0B]/20 px-2 py-0.5 rounded-full">
                        {newSuggestionsCount} {lang === 'ar' ? 'جديد' : 'new'}
                      </span>
                    )}
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('ads'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-[#F59E0B]/20 hover:bg-[#F59E0B]/40 transition-all shadow-sm">
                    <Monitor size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lang === 'ar' ? 'إعلاناتي' : 'My Ads'}</span>
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('profile'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <User size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lang === 'ar' ? 'الملف الشخصي' : 'Profile'}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('about'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Info size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lang === 'ar' ? 'نبذة عنا' : 'About Us'}</span>
                  </button>
                  <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('suggestions'); }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-white/10 hover:bg-[#F59E0B]/10 transition-all shadow-sm">
                    <Lightbulb size={18} className="text-[#F59E0B]" />
                    <span className="text-xs font-black text-black uppercase">{lang === 'ar' ? 'اقتراحاتكم' : 'Your Suggestions'}</span>
                  </button>
                  {!freemiumDisabled && (
                    <button onClick={() => { setShowMobileMenu(false); onNavigatePage?.('plans'); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/20 bg-emerald-500/20 hover:bg-emerald-500/40 transition-all shadow-sm">
                      <Crown size={18} className="text-emerald-500" />
                      <span className="text-xs font-black text-black uppercase">{lang === 'ar' ? 'شراء خطة' : 'Buy Plan'}</span>
                    </button>
                  )}
                </>
              )}

              {/* Divider: Tools */}
              <div className="border-t border-black/10 pt-2">
                <span className="text-[9px] font-black uppercase text-black/40 tracking-[0.2em] px-2">
                  {lang === 'ar' ? 'الأدوات' : 'Tools'}
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
                  {lang === 'ar' ? 'تواصل معنا' : 'Contact Us'}
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
                  {lang === 'ar' ? 'المظهر' : 'Theme'}
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
                    {lang === 'ar' ? 'اللغة' : 'Language'}
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
                    {lang === 'ar' ? 'معاينة' : 'Preview'}
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
                  {lang === 'ar' ? 'الحساب' : 'Account'}
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
          {lang === 'ar' ? '⚠️ تنبيه: الأسواق العالمية (فوركس/أسهم) مغلقة اليوم - الرادار يعمل على العملات الرقمية فقط' : '⚠️ ALERT: GLOBAL MARKETS (FOREX/STOCKS) ARE CLOSED TODAY - RADAR ACTIVE ON CRYPTO ONLY'}
          <AlertTriangle size={12} className="animate-pulse" />
        </div>
      )}

      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 overflow-hidden shadow-2xl shadow-emerald-500/20 transition-all duration-300",
        compact ? 'h-[100px]' : 'h-[300px]'
      )}>
        {/* Trading Banner Background */}
        <div className="absolute inset-0">
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

        {/* Content Overlay - left logo + right icons */}
        <div className={cn(
          "relative max-w-7xl mx-auto px-4 h-full flex items-center justify-between transition-all duration-300",
          compact ? 'pt-2' : 'pt-4'
        )}>
          {/* Left: Logo + Name (compact) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={cn(
              "bg-black rounded-xl flex items-center justify-center overflow-hidden shadow-lg border border-white/30 transition-all duration-300",
              compact ? 'w-[40px] h-[40px]' : 'w-[52px] h-[52px]'
            )}>
              <img src={customLogo || `${BASE_URL}logo.png`} alt="JT" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "font-display font-black tracking-tight text-white drop-shadow-2xl leading-none transition-all duration-300",
                compact ? 'text-sm' : 'text-xl'
              )}>
                Joseph.<span className="text-sky-300 italic">Trading</span>
              </span>
              {!compact && (
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/60 leading-none mt-0.5">For Financial Market Analysis</span>
              )}
            </div>
          </div>

          {/* Right: Compact icons row */}
          {!isPWA && (
          <div className="flex items-center gap-1.5">
            {/* Trade Now */}
            <button
              onClick={() => onNavigatePage?.('trade')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F59E0B] hover:bg-[#d97706] text-black shadow-lg shadow-[#F59E0B]/30 active:scale-95 transition-all border border-black/10"
            >
              <TrendingUp size={18} className="flex-shrink-0" />
              <span className="text-[13px] font-black uppercase tracking-wider whitespace-nowrap leading-none hidden sm:inline">
                {lang === 'ar' ? 'تداول' : 'Trade'}
              </span>
            </button>

            {/* Suggestions - developer only */}
            {isDeveloper && (
              <button
                onClick={onNavigateSuggestions}
                className="relative p-2 rounded-xl bg-[#F59E0B] text-black hover:bg-[#d97706] transition-all shadow-md"
              >
                <Bell size={16} />
                {newSuggestionsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5">
                    {newSuggestionsCount}
                  </span>
                )}
              </button>
            )}

            {/* Contact */}
            <a
              href="https://www.facebook.com/messages/e2ee/t/7630276620403742/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-[#0084FF] text-white hover:bg-[#006ADB] transition-all shadow-md"
            >
              <MessageCircle size={16} />
            </a>

            {/* Auto Analysis + Sync Status */}
            {isDeveloper ? (
              <button
                onClick={() => {
                  initAudio();
                  onAutoSettingsChange({ ...autoSettings, isEnabled: !autoSettings.isEnabled });
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border shadow-md transition-all backdrop-blur-sm",
                  analysisProgress
                    ? 'bg-emerald-600 border-emerald-700 text-white animate-pulse'
                    : lastSyncStatus?.ok
                      ? 'bg-emerald-600 border-emerald-700 text-white'
                      : lastSyncStatus
                        ? 'bg-red-700 border-red-800 text-white'
                        : autoSettings.isEnabled
                          ? 'bg-emerald-600 border-emerald-700 text-white'
                          : 'bg-red-700 border-red-800 text-white'
                )}
              >
                <div className="relative flex-shrink-0">
                  {analysisProgress ? (
                    <div className="w-[20px] h-[20px] rounded-full bg-white animate-bounce" />
                  ) : lastSyncStatus ? (
                    <span className="text-[18px] font-black leading-none">{lastSyncStatus.ok ? '✓' : '✗'}</span>
                  ) : (
                    <Zap size={18} fill={autoSettings.isEnabled ? "currentColor" : "none"} className="text-white" />
                  )}
                </div>
                <span className="text-[13px] font-black uppercase tracking-wider whitespace-nowrap leading-none">
                  {analysisProgress
                    ? `${analysisProgress.index + 1}/${analysisProgress.total}`
                    : lastSyncStatus
                      ? (lastSyncStatus.ok ? 'SYNCED' : 'FAIL')
                      : autoSettings.isEnabled ? (isWaiting ? 'WAIT' : 'ON') : 'OFF'
                  }
                </span>
                {lastSyncStatus?.count !== undefined && (
                  <span className="text-[12px] font-black text-yellow-300 leading-none">{lastSyncStatus.count}</span>
                )}
                {analysisProgress && (() => {
                  const { cfg } = detectProgressCategory(analysisProgress.current);
                  return (
                    <span className="text-[12px] font-black text-yellow-300 whitespace-nowrap leading-none">
                      {cfg ? (lang === 'ar' ? `${cfg.emoji} ${cfg.labelAr}` : `${cfg.emoji} ${cfg.labelEn}`) : analysisProgress.current}
                    </span>
                  );
                })()}
              </button>
            ) : (
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl border shadow-md backdrop-blur-sm",
                clientRadarRunning
                  ? 'bg-red-600 border-red-700 text-white animate-pulse'
                  : showRadarComplete
                    ? 'bg-emerald-600 border-emerald-700 text-white'
                    : 'bg-emerald-500/30 border-emerald-500/50 text-white'
              )}>
                <Zap size={14} className="text-white" fill="currentColor" />
                <span className="text-[12px] font-black uppercase tracking-wider">
                  {clientRadarRunning ? 'SCANNING' : showRadarComplete ? 'DONE' : 'ACTIVE'}
                </span>
              </div>
            )}

            {/* Manual Analysis - developer only */}
            {isDeveloper && (
              <button
                onClick={() => onNavigatePage?.('manualAnalysis')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border shadow-md transition-all backdrop-blur-sm bg-red-700 border-red-800 text-white hover:bg-red-600 active:scale-95"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span className="text-[13px] font-black uppercase tracking-wider whitespace-nowrap leading-none hidden sm:inline">
                  {lang === 'ar' ? 'يدوي' : 'MANUAL'}
                </span>
              </button>
            )}

            {/* Theme */}
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-[#F59E0B] text-black hover:bg-[#d97706] transition-all shadow-md"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Language */}
            <div className="relative group">
              <button className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-[#F59E0B] text-black hover:bg-[#d97706] transition-all shadow-md">
                <Globe size={16} />
                <span className="text-[11px] font-black uppercase">{lang}</span>
              </button>
              <div className="absolute right-0 top-full mt-2 w-40 bg-brand-alt border border-brand-text/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] overflow-hidden">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => onLangChange(l.code)}
                    className={cn(
                      "w-full px-4 py-3 text-left text-sm font-bold transition-colors hover:bg-primary/10",
                      lang === l.code ? "text-primary bg-primary/5" : "text-brand-text/60"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile */}
            {user ? (
              <div className="relative" ref={profileMenuRef}>
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="w-[36px] h-[36px] rounded-full bg-[#F59E0B] border-2 border-white/30 flex items-center justify-center overflow-hidden shadow-lg hover:scale-105 transition-all"
                >
                  {customAvatar ? (
                    <img src={customAvatar} alt="profile" className="w-full h-full object-cover" />
                  ) : user.photoURL ? (
                    <img src={user.photoURL} alt="profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-black text-black">{user.email?.charAt(0).toUpperCase()}</span>
                  )}
                </button>
                {showProfileMenu && (
                  <div className={`absolute top-full mt-2 w-56 bg-[#F59E0B] rounded-xl shadow-2xl border-2 border-black/20 overflow-hidden z-[60] ${lang === 'ar' ? 'left-0' : 'right-0'}`}>
                    <div className="px-4 py-3 border-b-2 border-black/10">
                      <p className="text-sm font-black text-black truncate">{user.displayName || user.email?.split('@')[0]}</p>
                      <p className="text-xs font-bold text-black/70 truncate">{user.email}</p>
                    </div>
                    <button 
                      onClick={() => { setShowProfileMenu(false); setShowLogoutConfirm(true); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-red-600 hover:bg-red-500/20 transition-colors"
                    >
                      <LogOut size={20} className="text-red-600" />
                      <span className="text-sm font-black text-red-600">{lang === 'ar' ? 'خروج' : 'Logout'}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={onLogin}
                className="flex items-center gap-1.5 bg-[#F59E0B] text-black px-3 py-2 rounded-lg font-black text-xs uppercase shadow-md hover:bg-[#d97706] active:scale-95 transition-all"
              >
                <LogIn size={18} />
              </button>
            )}

            {/* Menu toggle */}
            {!isPWA && (
              <button
                onMouseDown={(e) => { e.stopPropagation(); onToggleSidebar(); }}
                className="p-2 rounded-xl bg-[#F59E0B] text-black hover:bg-[#d97706] transition-all shadow-md"
                title={lang === 'ar' ? 'القائمة' : 'Menu'}
              >
                <Menu size={18} />
              </button>
            )}
          </div>
          )}

          {/* PWA: hamburger only */}
          {isPWA && (
            <button
              onClick={() => setShowMobileMenu(true)}
              className="p-1.5 rounded-md bg-[#F59E0B] text-black hover:bg-[#d97706] transition-all shadow-md"
            >
              <Menu size={16} />
            </button>
          )}
        </div>
      </header>
    </div>
  );
}
