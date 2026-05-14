import React from 'react';
import { User } from 'firebase/auth';
import { TrendingUp, LogIn, LogOut, Moon, Sun, Globe, ArrowLeft, Zap, ChevronDown, Clock, Layers, Volume2, ListFilter, Upload, Music } from 'lucide-react';
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
  isWaiting
}: HeaderProps) {
  const t = translations[lang];
  const [isAutoMenuOpen, setIsAutoMenuOpen] = React.useState(false);
  const successFileRef = React.useRef<HTMLInputElement>(null);
  const failFileRef = React.useRef<HTMLInputElement>(null);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'success' | 'fail') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        onAutoSettingsChange({
          ...autoSettings,
          [type === 'success' ? 'successSound' : 'failSound']: base64
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Close menu on click outside
  React.useEffect(() => {
    if (!isAutoMenuOpen) return;
    const handleClickOutside = () => setIsAutoMenuOpen(false);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isAutoMenuOpen]);

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
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setIsAutoMenuOpen(!isAutoMenuOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border",
                autoSettings.isEnabled 
                  ? (isWaiting 
                    ? 'bg-red-500/10 border-red-500 text-red-500 shadow-lg shadow-red-500/20' 
                    : 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/20')
                  : 'bg-brand-alt border-brand-text/10 text-brand-text/60 hover:text-brand-text'
              )}
            >
              <div className="relative">
                <Zap size={16} fill={autoSettings.isEnabled ? "currentColor" : "none"} />
                {autoSettings.isEnabled && !isWaiting && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping" />
                )}
                {autoSettings.isEnabled && isWaiting && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">
                {autoSettings.isEnabled ? t.autoAnalysis : t.autoScan}
              </span>
              <ChevronDown size={12} className={cn("transition-transform duration-300", isAutoMenuOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isAutoMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-80 bg-brand-alt border border-brand-text/10 rounded-2xl shadow-2xl z-50 p-6 space-y-6 overflow-hidden"
                >
                  {/* Header & Toggle */}
                  <div className="flex items-center justify-between pb-4 border-b border-brand-text/5">
                    <span className="text-xs font-black uppercase tracking-widest text-brand-text/40">{t.autoSettings}</span>
                    <button 
                      onClick={() => onAutoSettingsChange({ ...autoSettings, isEnabled: !autoSettings.isEnabled })}
                      className={cn(
                        "relative w-12 h-6 rounded-full transition-all",
                        autoSettings.isEnabled ? "bg-primary" : "bg-brand-text/20"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md",
                        autoSettings.isEnabled ? "right-1" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="space-y-5 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
                    {/* All Signals Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ListFilter size={16} className="text-primary" />
                        <span className="text-xs font-black uppercase tracking-tight text-brand-text/80">Show All Signals</span>
                      </div>
                      <button 
                        onClick={() => onAutoSettingsChange({ ...autoSettings, showAllSignals: !autoSettings.showAllSignals })}
                        className={cn(
                          "relative w-10 h-5 rounded-full transition-all",
                          autoSettings.showAllSignals ? "bg-primary" : "bg-brand-text/20"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                          autoSettings.showAllSignals ? "right-1" : "left-1"
                        )} />
                      </button>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-brand-text/5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-brand-text/50">
                          <div className="flex items-center gap-2">
                            <Music size={14} className="text-primary" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{t.successSound}</span>
                          </div>
                          <button onClick={() => successFileRef.current?.click()} className="text-primary hover:text-primary/80 transition-colors">
                            <Upload size={14} />
                          </button>
                          <input type="file" ref={successFileRef} onChange={(e) => handleAudioUpload(e, 'success')} accept="audio/*" className="hidden" />
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                          {DEFAULT_SUCCESS_SOUNDS.map(s => (
                            <button
                              key={s.id}
                              onClick={() => onAutoSettingsChange({ ...autoSettings, successSound: s.url })}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold border transition-all",
                                (autoSettings.successSound || DEFAULT_SUCCESS_SOUNDS[0].url) === s.url 
                                  ? 'bg-primary/20 border-primary text-primary shadow-lg' 
                                  : 'bg-brand-bg border-brand-text/5 text-brand-text/40 hover:border-primary/30'
                              )}
                            >
                              <div className={cn("w-1.5 h-1.5 rounded-full", (autoSettings.successSound || DEFAULT_SUCCESS_SOUNDS[0].url) === s.url ? "bg-primary" : "bg-brand-text/20")} />
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-brand-text/50">
                          <div className="flex items-center gap-2">
                            <Music size={14} className="text-secondary" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{t.failSound}</span>
                          </div>
                          <button onClick={() => failFileRef.current?.click()} className="text-secondary hover:text-secondary/80 transition-colors">
                            <Upload size={14} />
                          </button>
                          <input type="file" ref={failFileRef} onChange={(e) => handleAudioUpload(e, 'fail')} accept="audio/*" className="hidden" />
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                          {DEFAULT_FAIL_SOUNDS.map(s => (
                            <button
                              key={s.id}
                              onClick={() => onAutoSettingsChange({ ...autoSettings, failSound: s.url })}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold border transition-all",
                                (autoSettings.failSound || DEFAULT_FAIL_SOUNDS[0].url) === s.url 
                                  ? 'bg-secondary/20 border-secondary text-secondary shadow-lg' 
                                  : 'bg-brand-bg border-brand-text/5 text-brand-text/40 hover:border-secondary/30'
                              )}
                            >
                              <div className={cn("w-1.5 h-1.5 rounded-full", (autoSettings.failSound || DEFAULT_FAIL_SOUNDS[0].url) === s.url ? "bg-secondary" : "bg-brand-text/20")} />
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Market Category */}
                    <div className="space-y-2 pt-4 border-t border-brand-text/5">
                      <div className="flex items-center gap-2 text-brand-text/50">
                        <Layers size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t.selectMarket}</span>
                      </div>
                      <select 
                        value={autoSettings.category}
                        onChange={(e) => onAutoSettingsChange({ ...autoSettings, category: e.target.value as any })}
                        className="w-full bg-brand-bg border border-brand-text/10 rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:border-primary outline-none appearance-none cursor-pointer"
                      >
                        <option value="all">{t.allCategories}</option>
                        <option value="forex">{t.forex}</option>
                        <option value="crypto">{t.crypto}</option>
                        <option value="stocks">{t.stocks}</option>
                        <option value="metals">{t.metals}</option>
                      </select>
                    </div>

                    {/* Trading Style */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-brand-text/50">
                        <TrendingUp size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t.tradingStyle}</span>
                      </div>
                      <select 
                        value={autoSettings.tradingStyle}
                        onChange={(e) => onAutoSettingsChange({ ...autoSettings, tradingStyle: e.target.value as any })}
                        className="w-full bg-brand-bg border border-brand-text/10 rounded-xl px-4 py-3 text-sm font-bold text-brand-text focus:border-primary outline-none appearance-none cursor-pointer"
                      >
                        {TRADING_STYLES.map(style => (
                          <option key={style.id} value={style.id}>{t[style.label as keyof typeof t]}</option>
                        ))}
                      </select>
                    </div>

                    {/* Timeframe */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-brand-text/50">
                        <Clock size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t.timeframe}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {['15m', '1h', '4h', '1d', '1w', '1M', '1Y'].map((tf) => (
                          <button
                            key={tf}
                            onClick={() => onAutoSettingsChange({ ...autoSettings, timeframe: tf })}
                            className={cn(
                              "py-2.5 text-[10px] font-black rounded-lg border transition-all",
                              autoSettings.timeframe === tf 
                                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                                : 'bg-brand-bg border-brand-text/5 text-brand-text/40 hover:border-primary/30'
                            )}
                          >
                            {tf}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Interval */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-brand-text/50">
                        <Zap size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t.autoScan} ({t.every})</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1, 5, 15, 60, 240, 1440].map((min) => (
                          <button
                            key={min}
                            onClick={() => onAutoSettingsChange({ ...autoSettings, interval: min })}
                            className={cn(
                              "py-2 text-[9px] font-black rounded-lg border transition-all",
                              autoSettings.interval === min 
                                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                                : 'bg-brand-bg border-brand-text/5 text-brand-text/40 hover:border-primary/30'
                            )}
                          >
                            {min < 60 ? `${min}m` : min === 60 ? '1h' : min === 240 ? '4h' : '1d'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Volume */}
                    <div className="space-y-2 pt-2 border-t border-brand-text/5">
                      <div className="flex items-center justify-between text-brand-text/50">
                        <div className="flex items-center gap-2">
                          <Volume2 size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Alert Volume</span>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-primary">{Math.round(autoSettings.volume * 100)}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={autoSettings.volume}
                        onChange={(e) => onAutoSettingsChange({ ...autoSettings, volume: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-brand-bg rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-brand-alt border border-brand-text/5 text-brand-text/70 hover:text-primary transition-all hover:shadow-lg"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-alt border border-brand-text/5 text-brand-text/70 hover:text-primary transition-all">
              <Globe size={18} />
              <span className="text-xs font-black uppercase tracking-widest hidden md:inline">{lang}</span>
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

          {user ? (
            <div className="flex items-center gap-3 pl-2 border-l border-brand-text/10">
              <div className="w-9 h-9 rounded-xl bg-brand-alt border border-brand-text/5 flex items-center justify-center overflow-hidden shadow-inner">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="profile" className="w-full h-full object-cover" />
                ) : (
                  <TrendingUp size={18} className="text-primary" />
                )}
              </div>
              <button 
                onClick={onLogout}
                className="p-2.5 rounded-xl bg-brand-alt border border-brand-text/5 text-brand-text/70 hover:text-red-500 transition-all hover:bg-red-500/10"
              >
                <LogOut size={20} />
              </button>
            </div>
          ) : (
            <button 
              onClick={onLogin}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
            >
              <LogIn size={18} />
              <span className="hidden sm:inline">{t.login}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
