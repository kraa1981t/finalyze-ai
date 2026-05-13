import React from 'react';
import { User } from 'firebase/auth';
import { TrendingUp, LogIn, LogOut, Moon, Sun, Globe, Settings as SettingsIcon, ArrowLeft, Zap, ChevronDown, Clock, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language, translations } from '../lib/i18n';
import { AutoAnalysisSettings, TradingStyle } from '../types';
import { TRADING_STYLES } from '../constants';

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
  onAutoSettingsChange
}: HeaderProps) {
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-50 bg-brand-bg/80 backdrop-blur-md border-b border-brand-alt/50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBack && (
            <button 
              onClick={onBack}
              className="p-2 -ml-2 text-brand-text/70 hover:text-primary transition-colors flex items-center justify-center"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/40">
              <TrendingUp size={24} strokeWidth={3} />
            </div>
            <span className="text-2xl font-display font-black tracking-tight text-brand-text drop-shadow-sm">
              Finalyze<span className="text-primary italic">AI</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Auto Analysis Scanner */}
          <div className="relative group">
            <button 
              onClick={() => onAutoSettingsChange({ ...autoSettings, isEnabled: !autoSettings.isEnabled })}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border ${
                autoSettings.isEnabled 
                  ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/20' 
                  : 'bg-brand-alt border-brand-text/10 text-brand-text/60 hover:text-brand-text'
              }`}
            >
              <div className="relative">
                <Zap size={16} fill={autoSettings.isEnabled ? "currentColor" : "none"} />
                {autoSettings.isEnabled && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping" />
                )}
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">
                {autoSettings.isEnabled ? t.autoAnalysis : t.autoScan}
              </span>
              <ChevronDown size={12} className="opacity-40" />
            </button>

            {/* Auto Settings Dropdown */}
            <div className="absolute right-0 top-full mt-2 w-72 bg-brand-alt border border-brand-text/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black uppercase tracking-widest text-brand-text/40">{t.autoSettings}</span>
                <div 
                  className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${autoSettings.isEnabled ? 'bg-primary' : 'bg-brand-text/20'}`}
                  onClick={() => onAutoSettingsChange({ ...autoSettings, isEnabled: !autoSettings.isEnabled })}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${autoSettings.isEnabled ? 'left-5.5' : 'left-0.5'}`} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-brand-text/60 mb-1">
                    <Layers size={14} />
                    <span className="text-xs font-bold uppercase tracking-tighter">{t.selectMarket}</span>
                  </div>
                  <select 
                    value={autoSettings.category}
                    onChange={(e) => onAutoSettingsChange({ ...autoSettings, category: e.target.value as any })}
                    className="w-full bg-brand-bg border border-brand-text/10 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-text focus:border-primary outline-none transition-all"
                  >
                    <option value="all">{t.allCategories}</option>
                    <option value="forex">{t.forex}</option>
                    <option value="crypto">{t.crypto}</option>
                    <option value="stocks">{t.stocks}</option>
                    <option value="metals">{t.metals}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-brand-text/60 mb-1">
                    <TrendingUp size={14} />
                    <span className="text-xs font-bold uppercase tracking-tighter">{t.tradingStyle}</span>
                  </div>
                  <select 
                    value={autoSettings.tradingStyle}
                    onChange={(e) => onAutoSettingsChange({ ...autoSettings, tradingStyle: e.target.value as any })}
                    className="w-full bg-brand-bg border border-brand-text/10 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-text focus:border-primary outline-none transition-all"
                  >
                    {TRADING_STYLES.map(style => (
                      <option key={style.id} value={style.id}>{t[style.label as keyof typeof t]}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-brand-text/60 mb-1">
                    <Clock size={14} />
                    <span className="text-xs font-bold uppercase tracking-tighter">{t.timeframe}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {['15m', '1h', '4h', '1d', '1w', '1M', '1Y'].map((tf) => (
                      <button
                        key={tf}
                        onClick={() => onAutoSettingsChange({ ...autoSettings, timeframe: tf })}
                        className={`py-2 text-[10px] font-black rounded-lg border transition-all ${
                          autoSettings.timeframe === tf 
                            ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                            : 'border-brand-text/10 text-brand-text/60 hover:border-primary/40'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Language Selector */}
          <div className="relative group">
            <button className="flex items-center gap-1 p-2 text-brand-text/70 hover:text-primary transition-colors">
              <Globe size={18} />
              <span className="text-[10px] uppercase font-black font-mono hidden sm:inline">{lang}</span>
            </button>
            <div className="absolute right-0 top-full mt-2 w-32 bg-brand-alt border border-brand-text/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => onLangChange(l.code)}
                  className="w-full px-4 py-2 text-left text-xs font-semibold hover:bg-brand-text/5 text-brand-text transition-colors"
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Settings Toggle */}
          <button 
            onClick={onOpenSettings}
            className="p-2 text-brand-text/70 hover:text-primary transition-colors"
          >
            <SettingsIcon size={18} />
          </button>

          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 text-brand-text/70 hover:text-primary transition-colors"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-semibold text-brand-text">{user.displayName}</span>
                <span className="text-[10px] text-brand-text/50 uppercase tracking-widest font-mono">Trader</span>
              </div>
              <button 
                onClick={onLogout}
                className="p-2 text-brand-text/40 hover:text-red-500 transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onLogin}
              className="flex items-center gap-2 px-4 py-2 bg-brand-text text-brand-bg rounded-full text-sm font-semibold hover:bg-primary hover:text-white transition-colors"
            >
              <LogIn size={18} />
              <span className="hidden sm:inline">{t.login}</span>
            </motion.button>
          )}
        </div>
      </div>
      <div className="h-0.5 w-full gradient-line opacity-20" />
    </header>
  );
}
