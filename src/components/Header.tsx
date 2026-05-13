import React from 'react';
import { User } from 'firebase/auth';
import { TrendingUp, LogIn, LogOut, Moon, Sun, Globe, Settings as SettingsIcon, ArrowLeft, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { Language, translations } from '../lib/i18n';

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
  // Radar Props
  isAutoEnabled: boolean;
  onToggleAuto: () => void;
  autoCategory: string;
  onCategoryChange: (c: any) => void;
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
  isAutoEnabled,
  onToggleAuto,
  autoCategory,
  onCategoryChange
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

        <div className="flex items-center gap-3 md:gap-6">
          {/* RADAR CONTROL QUICK ACCESS */}
          <div className={`flex items-center gap-1 border rounded-full px-3 py-1.5 transition-all ${isAutoEnabled ? 'bg-secondary/10 border-secondary/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-white/5 border-white/10'}`}>
            <button 
              onClick={onToggleAuto}
              className={`flex items-center gap-2 transition-all ${isAutoEnabled ? 'text-secondary animate-pulse' : 'text-brand-text/30'}`}
              title="تفعيل/تعطيل الرادار الآلي"
            >
              <Zap size={16} fill={isAutoEnabled ? "currentColor" : "none"} />
              <span className="text-[10px] font-black tracking-tighter">RADAR</span>
            </button>
            
            {isAutoEnabled && (
              <select 
                value={autoCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="bg-transparent border-none text-[10px] font-bold text-secondary outline-none cursor-pointer pl-1 border-l border-white/10 ml-1"
              >
                <option value="all">ALL</option>
                <option value="forex">FRX</option>
                <option value="crypto">CRP</option>
                <option value="stocks">STK</option>
              </select>
            )}
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
            <div className="hidden md:flex items-center gap-3 pl-6 border-l border-brand-alt/50">
              <div className="text-right">
                <p className="text-sm font-bold text-brand-text leading-none">{user.displayName || 'Trader'}</p>
                <p className="text-[10px] text-brand-text/40 font-medium">Institutional Account</p>
              </div>
              <button 
                onClick={onLogout}
                className="w-10 h-10 rounded-xl bg-brand-alt border border-brand-text/10 flex items-center justify-center text-brand-text/70 hover:text-red-500 hover:border-red-500/30 transition-all"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button 
              onClick={onLogin}
              className="hidden md:flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
            >
              <LogIn size={18} />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
