import React, { useState, useEffect } from 'react';
import { ShieldCheck, Zap, Globe, BarChart3, TrendingUp, Languages, Loader2, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { Language } from '../lib/i18n';
import { BASE_URL } from '../lib/firebase';

interface LoginOverlayProps {
  onLogin: () => void;
  lang: Language;
  onLangChange?: (l: Language) => void;
  loginError: string | null;
  onClearError: () => void;
  redirecting?: boolean;
  manualAuthUrl?: string | null;
}

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

export default function LoginOverlay({ onLogin, lang, onLangChange, loginError, onClearError, redirecting, manualAuthUrl }: LoginOverlayProps) {
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);

  useEffect(() => {
    setCustomLogo(localStorage.getItem('finalyze_custom_logo'));
    const handleStorage = () => setCustomLogo(localStorage.getItem('finalyze_custom_logo'));
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const isAr = lang === 'ar';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start p-4 bg-brand-bg overflow-y-auto pt-12 pb-8">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Language Picker - Top Right */}
      <div className="fixed top-4 left-4 z-[110]">
        <button
          onClick={() => setShowLangPicker(!showLangPicker)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-xs font-bold hover:bg-white/20 transition-all"
        >
          <Languages size={14} />
          <span>{LANGUAGES.find(l => l.code === lang)?.flag}</span>
          <span className="hidden sm:inline">{LANGUAGES.find(l => l.code === lang)?.label}</span>
        </button>
        {showLangPicker && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full mt-2 left-0 bg-brand-alt border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[160px]"
          >
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => { onLangChange?.(l.code); setShowLangPicker(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors ${lang === l.code ? 'bg-primary/20 text-primary' : 'text-white hover:bg-white/10'}`}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Brand Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-8 relative z-10"
      >
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-xl shadow-emerald-500/25 rotate-3 transition-all border border-white/50 pointer-events-none select-none">
          <img src={customLogo || `${BASE_URL}logo.png`} alt="Logo" className="w-full h-full object-cover scale-110" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-3xl font-display font-black tracking-tighter text-white drop-shadow-sm leading-none">
            Joseph.<span className="text-primary italic">Trading</span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mt-1">Institutional Engine</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-5xl w-full grid md:grid-cols-2 gap-8 items-center"
      >
        {/* Left Side: Value Proposition */}
        <div className="text-right px-4" dir="ltr" style={{ textAlign: 'right' }}>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full mb-6 border border-primary/20">
              <Zap size={10} fill="currentColor" />
              <span>AI Gen 4 Enabled</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-4 leading-tight">
              Analyze Markets with{' '}
              <span className="text-primary">Hyper-Intelligence</span>
            </h1>

            {/* Promotional Text for Clients */}
            <div className="bg-gradient-to-l from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} className="text-emerald-400" />
                <span className="text-emerald-400 text-sm font-black uppercase tracking-wider">Free Signal Access</span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                {isAr
                  ? 'سجل الآن واحصل على أفضل إشارة دخول قوية على جميع الأسواق وكل أنواع الرموز مجاناً!'
                  : 'Sign up now and get the best strong entry signals across all markets and all symbol types — completely free!'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { icon: <BarChart3 size={18} />, label: isAr ? 'تحليل لحظي' : 'Real-time Analysis' },
                { icon: <Globe size={18} />, label: isAr ? 'تغطية عالمية' : 'Global Coverage' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-slate-300 justify-end">
                  <span className="text-sm font-medium">{item.label}</span>
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-primary">
                    {item.icon}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Side: Sign-In Card */}
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-brand-alt p-8 md:p-12 rounded-[40px] border border-white/5 shadow-[0_32px_128px_-12px_rgba(0,0,0,0.8)] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8">
              <ShieldCheck size={48} className="text-primary/10" />
            </div>

            <div className="mb-6 p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 relative z-10 text-center space-y-5">
              <div className="flex items-center gap-2 text-emerald-400 justify-center font-bold text-sm">
                <ShieldCheck size={18} />
                <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
              </div>

              {/* Promotional line inside card */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-emerald-400 text-xs font-bold">
                  {isAr
                    ? '🎯 سجّل مجاناً واحصل على إشارات قوية لكل الأسواق'
                    : '🎯 Sign up free & get strong signals for all markets'}
                </p>
              </div>

              <p className="text-xs text-slate-400 text-center">
                {redirecting
                  ? (isAr ? 'جاري التوجيه...' : 'Redirecting...')
                  : (isAr ? 'سجل دخول بحساب Google' : 'Sign in with your Google account')}
              </p>

              <button
                onClick={onLogin}
                disabled={redirecting}
                className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-4 rounded-2xl transition-all text-sm shadow-lg active:scale-98 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {redirecting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Globe size={18} />
                )}
                {redirecting
                  ? (isAr ? 'جاري...' : 'Redirecting...')
                  : (isAr ? 'تسجيل دخول بـ Google' : 'Sign In with Google')}
              </button>

              {manualAuthUrl && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center space-y-2">
                  <p className="text-[11px] text-amber-400 font-bold">
                    {isAr ? '⚠️ فشل التوجيه التلقائي' : '⚠️ Auto-redirect failed'}
                  </p>
                  <a
                    href={manualAuthUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all"
                  >
                    {isAr ? '👆 اضغط هنا' : '👆 Click here to Sign In'}
                  </a>
                </div>
              )}
            </div>

            {loginError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                <p className="text-[11px] text-red-400 font-bold">{loginError}</p>
              </div>
            )}

            <div className="flex items-center justify-center pt-2 border-t border-white/5 text-[9px] text-slate-500">
              <span>Google Secure Verification</span>
            </div>

            <p className="mt-4 text-center text-xs text-slate-500">
              {isAr ? 'لا يوجد التزام، يمكنك الإلغاء في أي وقت' : 'No commitment, cancel anytime.'}
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Footer */}
      <div className="mt-12 text-slate-600 text-[10px] font-medium tracking-widest uppercase">
        Protected by Enterprise Security Standards
      </div>
    </div>
  );
}
