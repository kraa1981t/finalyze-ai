import React from 'react';
import { User } from 'firebase/auth';
import { TrendingUp, LogIn, LogOut, Moon, Sun, Globe, ArrowLeft, Zap, Clock, Layers, Volume2, ListFilter, Upload, Music, Sparkles, Settings, Activity, Trash2, AlertTriangle, Key, DollarSign } from 'lucide-react';
import { saveAudioBlob, deleteAudioBlob } from '../lib/db';
import { motion, AnimatePresence } from 'motion/react';
import { Language, translations } from '../lib/i18n';
import { AutoAnalysisSettings } from '../types';
import { TRADING_STYLES, DEFAULT_SUCCESS_SOUNDS, DEFAULT_FAIL_SOUNDS } from '../constants';

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface HeaderProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  lang: Language;
  onLangChange: (l: Language) => void;
  onOpenSettings: () => void;
  showBack?: boolean;
  onBack?: () => void;
  autoSettings: AutoAnalysisSettings;
  onAutoSettingsChange: (s: AutoAnalysisSettings) => void;
  isWaiting?: boolean;
  isRadarUnlocked: boolean;
  onUnlockRadar: () => void;
  hasApiKey: boolean;
  onOpenApiKey: () => void;
  onOpenSubscription: () => void;
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
  onOpenSettings,
  showBack, 
  onBack,
  autoSettings,
  onAutoSettingsChange,
  isWaiting,
  isRadarUnlocked,
  onUnlockRadar,
  hasApiKey,
  onOpenApiKey,
  onOpenSubscription
}: HeaderProps) {
  const t = translations[lang];
  const [isAutoMenuOpen, setIsAutoMenuOpen] = React.useState(false);
  const successFileRef = React.useRef<HTMLInputElement>(null);
  const failFileRef = React.useRef<HTMLInputElement>(null);

  const isMarketClosedToday = () => {
    const day = new Date().getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'success' | 'fail') => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (file) {
      try {
        await saveAudioBlob(type === 'success' ? 'custom_success' : 'custom_fail', file);
        onAutoSettingsChange({
          ...autoSettings,
          [type === 'success' ? 'successSound' : 'failSound']: 'custom'
        });
        window.dispatchEvent(new CustomEvent('custom-audio-updated', { detail: { type } }));
      } catch (err) {
        console.error("Failed to save audio to DB", err);
      }
    }
  };

  const handleDeleteCustomAudio = async (type: 'success' | 'fail') => {
    try {
      await deleteAudioBlob(type === 'success' ? 'custom_success' : 'custom_fail');
      onAutoSettingsChange({
        ...autoSettings,
        [type === 'success' ? 'successSound' : 'failSound']: ''
      });
      window.dispatchEvent(new CustomEvent('custom-audio-updated', { detail: { type } }));
    } catch (err) {
      console.error("Failed to delete audio from DB", err);
    }
  };

  React.useEffect(() => {
    if (!isAutoMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const menu = document.getElementById('scanner-dropdown');
      if (menu && !menu.contains(e.target as Node)) {
        setIsAutoMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isAutoMenuOpen]);

  return (
    <div className="flex flex-col">
      {/* Market Status Banner */}
      {isMarketClosedToday() && (
        <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.3em] py-1.5 flex items-center justify-center gap-2 px-4 text-center">
          <AlertTriangle size={12} className="animate-pulse" />
          {lang === 'ar' ? '⚠️ تنبيه: الأسواق العالمية (فوركس/أسهم) مغلقة اليوم - الرادار يعمل على العملات الرقمية فقط' : '⚠️ ALERT: GLOBAL MARKETS (FOREX/STOCKS) ARE CLOSED TODAY - RADAR ACTIVE ON CRYPTO ONLY'}
          <AlertTriangle size={12} className="animate-pulse" />
        </div>
      )}

      <header className="fixed top-0 left-0 right-0 z-50 bg-[#87CEEB]/95 backdrop-blur-xl border-b border-black/10 shadow-2xl shadow-sky-500/10 h-24">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between pt-4">
          <div className="flex items-center gap-8 mb-2">
            {showBack && (
              <button 
                onClick={onBack}
                className="p-3 -ml-2 text-black/70 hover:text-black transition-colors flex items-center justify-center"
              >
                <ArrowLeft size={24} />
              </button>
            )}
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center overflow-hidden shadow-2xl shadow-sky-500/40 rotate-3 hover:rotate-0 transition-all cursor-pointer border-2 border-white/50">
                <img src="/logo.png" alt="Joseph Trading" className="w-full h-full object-cover scale-110" />
              </div>
              <div className="flex flex-col">
                <span className="text-4xl font-display font-black tracking-tighter text-black drop-shadow-sm leading-none">
                  Joseph.<span className="text-sky-800 italic">Trading</span>
                </span>
                <span className="text-[12px] font-black uppercase tracking-[0.5em] text-black/60 ml-1 mt-1">Institutional Engine</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-2">
            {/* Auto Analysis Scanner */}
            <div className="relative">
              <div className="flex flex-col items-center gap-1 px-3 py-2 bg-white/10 rounded-2xl border border-white/20 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-[10px] font-black uppercase text-black tracking-[0.25em] leading-none">Radar System</span>
                <div className="flex items-center gap-2.5">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (autoSettings.isEnabled) {
                        onAutoSettingsChange({ ...autoSettings, isEnabled: false });
                      } else {
                        onAutoSettingsChange({ ...autoSettings, isEnabled: true });
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl transition-all border-2 shadow-lg",
                      autoSettings.isEnabled 
                        ? (isWaiting 
                          ? 'bg-red-600 border-red-700 text-white shadow-red-500/40 hover:bg-red-700' 
                          : 'bg-emerald-500 border-emerald-600 text-white shadow-emerald-500/40')
                        : 'bg-[#F59E0B] border-black/10 text-black hover:bg-[#d97706]'
                    )}
                  >
                    <div className="relative">
                      <Zap size={18} fill={autoSettings.isEnabled ? "currentColor" : "none"} />
                      {autoSettings.isEnabled && !isWaiting && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full animate-ping shadow-[0_0_12px_white]" />
                      )}
                    </div>
                    <span className="text-[12px] font-black uppercase tracking-wider hidden md:inline">
                      {autoSettings.isEnabled ? (isWaiting ? 'Restart' : 'Radar ON') : 'Radar OFF'}
                    </span>
                  </button>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAutoMenuOpen(!isAutoMenuOpen);
                    }}
                    className="p-2 rounded-xl bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all shadow-md"
                    title="Scanner Settings"
                  >
                    <Activity size={18} className={cn(autoSettings.isEnabled && !isWaiting ? "animate-spin" : "")} />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {isAutoMenuOpen && (
                  <motion.div 
                    id="scanner-dropdown"
                    initial={{ opacity: 0, y: 15, x: 0, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                    className="absolute left-1/2 -translate-x-1/2 top-full mt-4 w-[450px] bg-brand-alt border border-brand-text/10 rounded-[2.5rem] shadow-2xl z-50 p-8 space-y-8 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-6 border-b border-brand-text/5">
                      <span className="text-sm font-black uppercase tracking-widest text-brand-text/40">{t.autoSettings}</span>
                      <button 
                        onClick={() => onAutoSettingsChange({ ...autoSettings, isEnabled: !autoSettings.isEnabled })}
                        className={cn(
                          "relative w-14 h-7 rounded-full transition-all",
                          autoSettings.isEnabled ? "bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]" : "bg-brand-text/20"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-xl",
                          autoSettings.isEnabled ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-8 max-h-[600px] overflow-y-auto custom-scrollbar pr-4">
                      {/* AUDIO SECTION */}
                      <div className="space-y-6">
                        {/* 1. NEW OPPORTUNITY SOUND */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-brand-text/50">
                            <div className="flex items-center gap-3">
                              <Music size={18} className="text-[#F59E0B]" />
                              <span className="text-[12px] font-black uppercase tracking-widest text-brand-text/90">
                                {lang === 'ar' ? 'تنبيه فرصة جديدة (عالية الثقة)' : 'New Signal Alert'}
                              </span>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); successFileRef.current?.click(); }} 
                              className="text-black hover:bg-[#d97706] transition-colors p-2 bg-[#F59E0B] rounded-xl shadow-md"
                            >
                              <Upload size={18} />
                            </button>
                            <input type="file" ref={successFileRef} onChange={(e) => handleAudioUpload(e, 'success')} onClick={(e) => e.stopPropagation()} accept="audio/*" className="hidden" />
                          </div>
                          
                          <div className="grid grid-cols-1 gap-2">
                            <button
                              onClick={() => {
                                if (autoSettings.successSound === 'custom') {
                                  onAutoSettingsChange({ ...autoSettings, successSound: '' });
                                } else {
                                  onAutoSettingsChange({ ...autoSettings, successSound: 'custom' });
                                }
                              }}
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black border-2 transition-all w-full text-left",
                                autoSettings.successSound === 'custom' 
                                  ? 'bg-[#F59E0B]/10 border-[#F59E0B] text-[#F59E0B] shadow-lg font-black' 
                                  : 'bg-brand-bg border-brand-text/5 text-brand-text/40 hover:border-[#F59E0B]/30'
                              )}
                            >
                              <div className={cn("w-2 h-2 rounded-full", autoSettings.successSound === 'custom' ? "bg-[#F59E0B]" : "bg-brand-text/20")} />
                              <span className="truncate max-w-[280px]">
                                {autoSettings.successSound === 'custom' 
                                  ? (lang === 'ar' ? '🔔 نغمة الفرصة المخصصة (نشطة)' : '🔔 Custom Opportunity Sound (Active)') 
                                  : (lang === 'ar' ? '🔔 نغمة الفرصة الافتراضية' : '🔔 Default Opportunity Sound')}
                              </span>
                              {autoSettings.successSound === 'custom' && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteCustomAudio('success'); }}
                                  className="ml-auto p-1.5 hover:bg-red-500/20 rounded-lg text-red-500 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* 2. ANALYSIS COMPLETED SOUND */}
                        <div className="space-y-4 pt-4 border-t border-brand-text/5">
                          <div className="flex items-center justify-between text-brand-text/50">
                            <div className="flex items-center gap-3">
                              <Music size={18} className="text-secondary" />
                              <span className="text-[12px] font-black uppercase tracking-widest text-brand-text/90">
                                {lang === 'ar' ? 'تنبيه إتمام التحليل (يدوي وتلقائي)' : 'Analysis Finished Alert'}
                              </span>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); failFileRef.current?.click(); }} 
                              className="text-white hover:bg-secondary/85 transition-colors p-2 bg-secondary rounded-xl shadow-md"
                            >
                              <Upload size={18} />
                            </button>
                            <input type="file" ref={failFileRef} onChange={(e) => handleAudioUpload(e, 'fail')} onClick={(e) => e.stopPropagation()} accept="audio/*" className="hidden" />
                          </div>
                          
                          <div className="grid grid-cols-1 gap-2">
                            <button
                              onClick={() => {
                                if (autoSettings.failSound === 'custom') {
                                  onAutoSettingsChange({ ...autoSettings, failSound: '' });
                                } else {
                                  onAutoSettingsChange({ ...autoSettings, failSound: 'custom' });
                                }
                              }}
                              className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black border-2 transition-all w-full text-left",
                                autoSettings.failSound === 'custom' 
                                  ? 'bg-secondary/10 border-secondary text-secondary shadow-lg font-black' 
                                  : 'bg-brand-bg border-brand-text/5 text-brand-text/40 hover:border-secondary/30'
                              )}
                            >
                              <div className={cn("w-2 h-2 rounded-full", autoSettings.failSound === 'custom' ? "bg-secondary" : "bg-brand-text/20")} />
                              <span className="truncate max-w-[280px]">
                                {autoSettings.failSound === 'custom' 
                                  ? (lang === 'ar' ? '🔔 نغمة الإتمام المخصصة (نشطة)' : '🔔 Custom Finished Sound (Active)') 
                                  : (lang === 'ar' ? '🔔 نغمة الإتمام الافتراضية' : '🔔 Default Finished Sound')}
                              </span>
                              {autoSettings.failSound === 'custom' && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteCustomAudio('fail'); }}
                                  className="ml-auto p-1.5 hover:bg-red-500/20 rounded-lg text-red-500 transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* VOLUME SLIDER */}
                        <div className="space-y-3 py-4 bg-brand-text/5 rounded-3xl px-6 border border-brand-text/5">
                          <div className="flex items-center justify-between text-brand-text/50">
                            <div className="flex items-center gap-3">
                              <Volume2 size={20} className="text-[#F59E0B]" />
                              <span className="text-[11px] font-black uppercase tracking-widest text-brand-text/90">
                                {lang === 'ar' ? 'مستوى الصوت' : 'Alert Volume'}
                              </span>
                            </div>
                            <span className="text-[12px] font-mono font-black text-[#F59E0B]">{Math.round(autoSettings.volume * 100)}%</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={autoSettings.volume}
                            onChange={(e) => onAutoSettingsChange({ ...autoSettings, volume: parseFloat(e.target.value) })}
                            className="w-full h-2 bg-brand-bg rounded-lg appearance-none cursor-pointer accent-[#F59E0B]"
                          />
                        </div>
                      </div>

                      {/* 1. SELECT MARKET (MULTI-SELECT) */}
                      <div className="space-y-3 pt-6 border-t border-brand-text/5">
                        <div className="flex items-center gap-3 text-brand-text/50">
                          <Layers size={18} className="text-[#F59E0B]" />
                          <span className="text-[12px] font-black uppercase tracking-widest text-brand-text/90">
                            {lang === 'ar' ? '1. اختر نوع السوق (فئة أو أكثر)' : '1. Select Market (One or More)'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { id: 'forex', label: lang === 'ar' ? 'فوركس (Forex)' : 'Forex' },
                            { id: 'crypto', label: lang === 'ar' ? 'كريبتو (Crypto)' : 'Crypto' },
                            { id: 'stocks', label: lang === 'ar' ? 'أسهم (Stocks)' : 'Stocks' },
                            { id: 'metals', label: lang === 'ar' ? 'معادن (Metals)' : 'Metals' }
                          ].map((cat) => {
                            const selectedList = autoSettings.category === 'all' 
                              ? ['forex', 'crypto', 'stocks', 'metals']
                              : (autoSettings.category || 'all').split(',');
                            
                            const isSelected = selectedList.includes(cat.id);

                            const handleToggle = () => {
                              let newList = [...selectedList];
                              if (isSelected) {
                                if (newList.length > 1) {
                                  newList = newList.filter(id => id !== cat.id);
                                }
                              } else {
                                newList.push(cat.id);
                              }
                              
                              const finalVal = newList.length === 4 ? 'all' : newList.join(',');
                              onAutoSettingsChange({ ...autoSettings, category: finalVal as any });
                            };

                            return (
                              <button
                                key={cat.id}
                                onClick={handleToggle}
                                className={cn(
                                  "flex items-center justify-between px-4 py-3.5 rounded-2xl text-[11px] font-black border-2 transition-all w-full",
                                  isSelected 
                                    ? 'bg-primary/10 border-primary text-primary shadow-lg' 
                                    : 'bg-brand-bg border-brand-text/5 text-brand-text/40 hover:border-primary/30'
                                )}
                              >
                                <span>{cat.label}</span>
                                <div className={cn(
                                  "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                                  isSelected ? "border-primary bg-primary text-white" : "border-brand-text/20 bg-brand-bg"
                                )}>
                                  {isSelected && <span className="text-[10px] leading-none font-bold">✓</span>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. SCAN EVERY & 3. TRADING STYLE */}
                      <div className="grid grid-cols-2 gap-6 pt-6 border-t border-brand-text/5">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-brand-text/50">
                            <Zap size={18} className="text-orange-500" />
                            <span className="text-[12px] font-black uppercase tracking-widest text-brand-text/90">
                              {lang === 'ar' ? '2. فحص كل' : '2. Scan Every'}
                            </span>
                          </div>
                          <select 
                            value={autoSettings.interval}
                            onChange={(e) => onAutoSettingsChange({ ...autoSettings, interval: parseInt(e.target.value) })}
                            className="w-full bg-brand-bg border-2 border-brand-text/10 rounded-2xl px-5 py-4 text-sm font-black text-brand-text focus:border-primary outline-none appearance-none cursor-pointer shadow-sm"
                          >
                            <option value="1">1 Minute</option>
                            <option value="5">5 Minutes</option>
                            <option value="15">15 Minutes</option>
                            <option value="60">1 Hour</option>
                            <option value="120">2 Hours</option>
                            <option value="240">4 Hours</option>
                            <option value="1440">1 Day</option>
                          </select>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-brand-text/50">
                            <Sparkles size={18} className="text-[#F59E0B]" />
                            <span className="text-[12px] font-black uppercase tracking-widest text-brand-text/90">
                              {lang === 'ar' ? '3. الاستراتيجية' : '3. Strategy'}
                            </span>
                          </div>
                          <select 
                            value={autoSettings.tradingStyle}
                            onChange={(e) => onAutoSettingsChange({ ...autoSettings, tradingStyle: e.target.value as any })}
                            className="w-full bg-brand-bg border-2 border-brand-text/10 rounded-2xl px-5 py-4 text-sm font-black text-brand-text focus:border-primary outline-none appearance-none cursor-pointer shadow-sm"
                          >
                            <option value="scalping">{lang === 'ar' ? 'سكالبينج (Scalping)' : 'Scalping'}</option>
                            <option value="day_trading">{lang === 'ar' ? 'تداول يومي (Day)' : 'Day Trading'}</option>
                            <option value="swing_trading">{lang === 'ar' ? 'سوينغ (Swing)' : 'Swing Trading'}</option>
                          </select>
                        </div>
                      </div>

                      {/* 4. TIMEFRAME */}
                      <div className="space-y-4 pt-6 border-t border-brand-text/5">
                        <div className="flex items-center gap-3 text-brand-text/50">
                          <Clock size={18} />
                          <span className="text-[12px] font-black uppercase tracking-widest text-brand-text/90">
                            {lang === 'ar' ? '4. الإطار الزمني' : '4. Timeframe'}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          {['15m', '1h', '4h', '1d', '1w', '1M', '1Y'].map((tf) => (
                            <button
                              key={tf}
                              onClick={() => onAutoSettingsChange({ ...autoSettings, timeframe: tf })}
                              className={cn(
                                "py-3 text-[12px] font-black rounded-2xl border-2 transition-all",
                                autoSettings.timeframe === tf 
                                  ? 'bg-primary border-primary text-white shadow-xl shadow-primary/30' 
                                  : 'bg-brand-bg border-brand-text/5 text-brand-text/40 hover:border-primary/30'
                              )}
                            >
                              {tf}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-col items-center gap-1 px-3 py-2 bg-white/10 rounded-2xl border border-white/20 shadow-sm relative">
              <span className="text-[10px] font-black uppercase text-black tracking-[0.25em] leading-none">
                {lang === 'ar' ? 'المفتاح' : 'API Key'}
              </span>
              <button 
                onClick={onOpenApiKey}
                className="p-2 rounded-xl bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all shadow-md relative flex items-center justify-center"
                title={lang === 'ar' ? 'إعداد مفتاح API الخاص بك' : 'Configure API Key'}
              >
                <Key size={18} />
                {!hasApiKey && user && 
                 user.email !== (localStorage.getItem('finalyze_dev_email') || 'bachasalman69@gmail.com') && 
                 user.email !== 'taybekraa@gmail.com' && 
                 !user.email?.includes('dev') && 
                 localStorage.getItem('finalyze_dev_bypass_active') !== 'true' && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-600 rounded-full border border-white animate-pulse" />
                )}
              </button>
            </div>

            <div className="flex flex-col items-center gap-1 px-3 py-2 bg-white/10 rounded-2xl border border-white/20 shadow-sm">
              <span className="text-[10px] font-black uppercase text-black tracking-[0.25em] leading-none">Plans</span>
              <button 
                onClick={onOpenSubscription}
                className="p-2 rounded-xl bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all shadow-md"
                title="Subscription Plans"
              >
                <DollarSign size={18} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-1 px-3 py-2 bg-white/10 rounded-2xl border border-white/20 shadow-sm">
              <span className="text-[10px] font-black uppercase text-black tracking-[0.25em] leading-none">Strategy</span>
              <button 
                onClick={onOpenSettings}
                className="p-2 rounded-xl bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all shadow-md"
              >
                <Settings size={18} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-1 px-3 py-2 bg-white/10 rounded-2xl border border-white/20 shadow-sm">
              <span className="text-[10px] font-black uppercase text-black tracking-[0.25em] leading-none">Theme</span>
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all shadow-md"
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>

            <div className="flex flex-col items-center gap-1 px-3 py-2 bg-white/10 rounded-2xl border border-white/20 shadow-sm">
              <span className="text-[10px] font-black uppercase text-black tracking-[0.25em] leading-none">Language</span>
              <div className="relative group">
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all shadow-md">
                  <Globe size={18} />
                  <span className="text-xs font-black uppercase tracking-widest hidden lg:inline">{lang}</span>
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
              <div className="flex flex-col items-center gap-1 pl-3 border-l border-black/10">
                <span className="text-[10px] font-black uppercase text-black tracking-[0.25em] leading-none">Profile</span>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-[#F59E0B] border border-black/10 flex items-center justify-center overflow-hidden shadow-md">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-black/5 flex items-center justify-center text-black">
                        <span className="text-sm font-black">{user.email?.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={onLogout}
                    className="p-2 rounded-xl bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all shadow-md"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 pl-3 border-l border-black/10">
                <span className="text-[10px] font-black uppercase text-black tracking-[0.25em] leading-none">Account</span>
                <button 
                  onClick={onLogin}
                  className="flex items-center gap-2 bg-[#F59E0B] text-black px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-md hover:bg-[#d97706] active:scale-95 transition-all"
                >
                  <LogIn size={18} />
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
