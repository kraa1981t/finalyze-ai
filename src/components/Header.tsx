import React from 'react';
import { User } from 'firebase/auth';
import { TrendingUp, LogIn, LogOut, Moon, Sun, Globe, Settings as SettingsIcon, ArrowLeft } from 'lucide-react';
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
  onBack 
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
