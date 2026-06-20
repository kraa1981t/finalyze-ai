import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { TrendingUp, LogIn, LogOut, Moon, Sun, Globe, ArrowLeft, Menu, Zap, AlertTriangle, MessageCircle, Upload, Download, FileAudio, Bell } from 'lucide-react';
import { Language, translations } from '../lib/i18n';
import { AutoAnalysisSettings } from '../types';
import { initAudio } from '../lib/audioEngine';
import { BASE_URL } from '../lib/firebase';

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

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
  isDeveloper?: boolean;
  lastSyncStatus?: { ok: boolean; count?: number; error?: string; time: number } | null;
  analysisProgress?: { current: string; total: number; index: number; failed?: number } | null;
  isAnalyzing?: boolean;
  newSuggestionsCount?: number;
  onNavigateSuggestions?: () => void;
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
  onNavigateSuggestions
}: HeaderProps) {
  const t = translations[lang];
  const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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
    return day === 0 || day === 6; // Sunday or Saturday
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

      {/* Market Status Banner */}
      {isMarketClosedToday() && (
        <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.3em] py-1.5 flex items-center justify-center gap-2 px-4 text-center">
          <AlertTriangle size={12} className="animate-pulse" />
          {lang === 'ar' ? '⚠️ تنبيه: الأسواق العالمية (فوركس/أسهم) مغلقة اليوم - الرادار يعمل على العملات الرقمية فقط' : '⚠️ ALERT: GLOBAL MARKETS (FOREX/STOCKS) ARE CLOSED TODAY - RADAR ACTIVE ON CRYPTO ONLY'}
          <AlertTriangle size={12} className="animate-pulse" />
        </div>
      )}

      <header className="fixed top-0 left-0 right-0 z-50 bg-[#D1FAE5]/95 backdrop-blur-xl border-b border-black/10 shadow-2xl shadow-emerald-500/10 h-20">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between pt-2">
          <div className="flex items-center gap-4 mb-2">
            {showBack && (
              <button 
                onClick={onBack}
                className="p-2 -ml-1 text-black/70 hover:text-black transition-colors flex items-center justify-center"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div className="flex items-center gap-3">
              {/* Menu Toggle - next to logo */}
              <button
                onMouseDown={(e) => { e.stopPropagation(); onToggleSidebar(); }}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 bg-white/10 rounded-xl border border-white/20 shadow-sm hover:bg-white/20 transition-all"
                title={lang === 'ar' ? 'القائمة' : 'Menu'}
              >
                <span className="text-[9px] font-black uppercase text-black tracking-[0.2em] leading-none">
                  {lang === 'ar' ? 'القائمة' : 'Menu'}
                </span>
                <div className="p-2 rounded-lg bg-[#F59E0B] border border-black/10 text-black shadow-md">
                  <Menu size={18} />
                </div>
              </button>
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl shadow-sky-500/40 rotate-3 hover:rotate-0 transition-all cursor-pointer border-2 border-white/50">
                <img src={customLogo || `${BASE_URL}logo.png`} alt="Joseph Trading" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-display font-black tracking-tighter text-black drop-shadow-sm leading-none">
                  Joseph.<span className="text-sky-800 italic">Trading</span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-black/60 ml-1 mt-0.5">Institutional Engine</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            {/* Suggestions Notifications - developer only */}
            {isDeveloper && (
              <button
                onClick={onNavigateSuggestions}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 bg-white/10 rounded-xl border border-white/20 shadow-sm hover:bg-white/20 transition-all relative"
              >
                <span className="text-[9px] font-black uppercase text-black tracking-[0.2em] leading-none">{lang === 'ar' ? 'مقترحات' : 'Suggestions'}</span>
                <div className="relative p-1.5 rounded-lg bg-[#F59E0B] border border-black/10 text-black shadow-md">
                  <Bell size={15} />
                  {newSuggestionsCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-lg">
                      {newSuggestionsCount}
                    </span>
                  )}
                </div>
              </button>
            )}

            {/* Contact Us - Messenger */}
            <div className="flex flex-col items-center gap-0.5 px-2 py-1.5 bg-white/10 rounded-xl border border-white/20 shadow-sm">
              <span className="text-[9px] font-black uppercase text-black tracking-[0.2em] leading-none">{lang === 'ar' ? 'تواصل معنا' : 'Contact'}</span>
              <a
                href="https://www.facebook.com/messages/e2ee/t/7630276620403742/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-[#0084FF] border border-black/10 text-white hover:bg-[#006ADB] transition-all shadow-md"
              >
                <MessageCircle size={15} />
              </a>
            </div>

            {/* Auto Analysis - toggle for dev, status for clients */}
            <div className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 bg-white/10 rounded-xl border border-white/20 shadow-sm hover:shadow-md transition-shadow">
              <span className="text-[9px] font-black uppercase text-black tracking-[0.2em] leading-none">
                {lang === 'ar' ? 'التحليل التلقائي' : 'Auto Analysis'}
              </span>
              {isDeveloper ? (
                <button
                  onClick={() => {
                    initAudio();
                    onAutoSettingsChange({ ...autoSettings, isEnabled: !autoSettings.isEnabled });
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all border shadow-md",
                    autoSettings.isEnabled
                      ? (isWaiting
                        ? 'bg-yellow-500 border-yellow-600 text-white shadow-yellow-500/40'
                        : 'bg-emerald-500 border-emerald-600 text-white shadow-emerald-500/40')
                      : 'bg-[#F59E0B] border-black/10 text-black hover:bg-[#d97706]'
                  )}
                >
                  <div className="relative">
                    <Zap size={15} fill={autoSettings.isEnabled ? "currentColor" : "none"} />
                    {autoSettings.isEnabled && !isWaiting && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full animate-ping shadow-[0_0_12px_white]" />
                    )}
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-wider hidden md:inline">
                    {autoSettings.isEnabled ? (isWaiting ? 'Waiting' : 'Scanning') : 'OFF'}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40">
                  <div className="relative">
                    <Zap size={15} className="text-emerald-400" fill="currentColor" />
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-ping shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
                  </div>
                  <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider hidden md:inline">
                    {lang === 'ar' ? 'نشط' : 'Active'}
                  </span>
                </div>
              )}
            </div>

            {/* Analysis Progress & Sync Status (Developer only) */}
            {isDeveloper && (
              <div className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl border transition-all min-w-[100px]"
                style={{
                  background: analysisProgress ? 'rgba(59,130,246,0.15)' : lastSyncStatus?.ok ? 'rgba(16,185,129,0.15)' : lastSyncStatus ? 'rgba(239,68,68,0.15)' : 'rgba(100,100,100,0.1)',
                  borderColor: analysisProgress ? 'rgba(59,130,246,0.5)' : lastSyncStatus?.ok ? 'rgba(16,185,129,0.4)' : lastSyncStatus ? 'rgba(239,68,68,0.4)' : 'rgba(100,100,100,0.2)'
                }}
              >
                {analysisProgress ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-xs font-black text-black uppercase tracking-wider">
                        {analysisProgress.index + 1}/{analysisProgress.total}
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-black text-center leading-tight max-w-[100px] truncate">
                      {analysisProgress.current}
                    </span>
                    {analysisProgress.failed !== undefined && analysisProgress.failed > 0 && (
                      <span className="text-[9px] font-black text-red-600">
                        {lang === 'ar' ? `فشل ${analysisProgress.failed}` : `${analysisProgress.failed} failed`}
                      </span>
                    )}
                  </>
                ) : lastSyncStatus ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      {lastSyncStatus.ok ? (
                        <span className="text-sm">✓</span>
                      ) : (
                        <span className="text-sm">✗</span>
                      )}
                      <span className="text-[10px] font-black uppercase tracking-wider text-black">
                        {lastSyncStatus.ok ? 'SYNCED' : 'FAILED'}
                      </span>
                    </div>
                    {lastSyncStatus.count !== undefined && (
                      <span className="text-[10px] font-black text-black">
                        {lastSyncStatus.count} {lang === 'ar' ? 'إشارة' : 'signals'}
                      </span>
                    )}
                    {lastSyncStatus.error && (
                      <span className="text-[9px] font-mono text-red-400 text-center leading-tight max-w-[100px] truncate">
                        {lastSyncStatus.error.slice(0,30)}
                      </span>
                    )}
                  </>
                ) : null}
              </div>
            )}

            <div className="flex flex-col items-center gap-0.5 px-2 py-1.5 bg-white/10 rounded-xl border border-white/20 shadow-sm">
              <span className="text-[9px] font-black uppercase text-black tracking-[0.2em] leading-none">Theme</span>
              <button 
                onClick={toggleTheme}
                className="p-1.5 rounded-lg bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all shadow-md"
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>

            <div className="flex flex-col items-center gap-0.5 px-2 py-1.5 bg-white/10 rounded-xl border border-white/20 shadow-sm">
              <span className="text-[9px] font-black uppercase text-black tracking-[0.2em] leading-none">Language</span>
              <div className="relative group">
                <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all shadow-md">
                  <Globe size={15} />
                  <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">{lang}</span>
                </button>
                <div className="absolute right-0 top-full mt-2 w-40 bg-brand-alt border border-brand-text/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => onLangChange(l.code)}
                      className={cn(
                        "w-full px-4 py-3 text-left text-xs font-bold transition-colors hover:bg-primary/10",
                        lang === l.code ? "text-primary bg-primary/5" : "text-brand-text/60"
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {user ? (
              <div className="flex flex-col items-center gap-0.5 pl-2 border-l border-black/10 relative" ref={profileMenuRef}>
                <span className="text-[9px] font-black uppercase text-black tracking-[0.2em] leading-none">Profile</span>
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="w-9 h-9 rounded-full bg-[#F59E0B] border-2 border-black/20 flex items-center justify-center overflow-hidden shadow-lg hover:scale-105 transition-all"
                >
                  {customAvatar ? (
                    <img src={customAvatar} alt="profile" className="w-full h-full object-cover" />
                  ) : user.photoURL ? (
                    <img src={user.photoURL} alt="profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-black/10 flex items-center justify-center text-black">
                      <span className="text-sm font-black">{user.email?.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </button>
                {showProfileMenu && (
                  <div className={`absolute top-full mt-2 w-56 bg-[#F59E0B] rounded-2xl shadow-2xl border-2 border-black/20 overflow-hidden z-[60] ${lang === 'ar' ? 'left-0' : 'right-0'}`}>
                    <div className="px-4 py-3 border-b-2 border-black/10">
                      <p className="text-sm font-black text-black truncate">{user.displayName || user.email?.split('@')[0]}</p>
                      <p className="text-[11px] font-bold text-black/70 truncate mt-0.5">{user.email}</p>
                    </div>
                    <button 
                      onClick={() => { setShowProfileMenu(false); setShowLogoutConfirm(true); }}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-red-600 hover:bg-red-500/20 transition-colors"
                    >
                      <LogOut size={16} className="text-red-600" />
                      <span className="text-xs font-black text-red-600">{lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5 pl-2 border-l border-black/10">
                <span className="text-[9px] font-black uppercase text-black tracking-[0.2em] leading-none">Account</span>
                <button 
                  onClick={onLogin}
                  className="flex items-center gap-1.5 bg-[#F59E0B] text-black px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-md hover:bg-[#d97706] active:scale-95 transition-all"
                >
                  <LogIn size={15} />
                  <span className="hidden sm:inline">{t.login}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </div>
  );
}
