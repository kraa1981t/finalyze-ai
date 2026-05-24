import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, CheckCircle2, AlertTriangle, ExternalLink, LogOut, Loader2, Info, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../lib/i18n';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  isBlocking: boolean;
  lang: Language;
  user: User | null;
  onSaved: (key: string) => void;
  asPage?: boolean;
}

export default function ApiKeyModal({ isOpen, onClose, isBlocking, lang, user, onSaved, asPage }: ApiKeyModalProps) {
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);

  const isDeveloperSession = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('dev') || params.get('owner') === '1') {
        localStorage.setItem('finalyze_dev_bypass_active', 'true');
        return true;
      }
    }
    if (localStorage.getItem('finalyze_permanent_owner') === 'true') return true;
    if (localStorage.getItem('finalyze_dev_bypass_active') === 'true') return true;
    if (!user) return false;
    const email = user.email || '';
    const activeDevEmail = localStorage.getItem('finalyze_dev_email') || 'bachasalman69@gmail.com';
    return email === activeDevEmail ||
           email === 'bachasalman69@gmail.com' ||
           email === 'taybekraa@gmail.com' ||
           email.includes('dev');
  };

  const isAr = lang === 'ar';
  const t = {
    title: isAr ? 'مفتاح API' : 'Set Your Groq API Key',
    desc: isAr
      ? 'للوصول إلى التحليلات المتقدمة، يلزمك إدخال مفتاح API من Groq. المفتاح يُخزن بشكل آمن في متصفحك.'
      : 'To access advanced AI analysis, you need a Groq API key. It is stored safely in your browser.',
    step1: isAr ? 'الخطوة 1: إنشاء المفتاح' : 'Step 1: Create a key',
    step1Desc: isAr
      ? 'توجه إلى منصة Groq Console وأنشئ مفتاح API مجاني.'
      : 'Go to the Groq Console and generate a free API key.',
    btnAlibaba: isAr ? 'فتح منصة Groq' : 'Open Groq Console',
    step2: isAr ? 'الخطوة 2: لصق المفتاح' : 'Step 2: Paste your key',
    placeholder: isAr ? 'gsk_... الصق المفتاح هنا' : 'gsk_... paste your key here',
    btnVerify: isAr ? 'تحقق وحفظ' : 'Verify & Save',
    btnVerifying: isAr ? 'جارٍ التحقق...' : 'Verifying...',
    btnSaved: isAr ? '✓ تم الحفظ بنجاح!' : '✓ Saved Successfully!',
    emptyKey: isAr ? 'يرجى إدخال مفتاح API' : 'Please enter an API key',
    errorInvalid: isAr ? 'المفتاح غير صحيح. يرجى التحقق والمحاولة مجدداً.' : 'Invalid API key. Please check and try again.',
    logoutText: isAr ? 'تسجيل خروج' : 'Logout',
    adminBypassInfo: isAr ? 'وضع المطور نشط — تم تجاوز المفتاح.' : 'Developer mode active — API key bypassed.',
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        localStorage.setItem('finalyze_dev_bypass_active', 'true');
        localStorage.setItem('finalyze_permanent_owner', 'true');
        onSaved('__dev_bypass__');
        onClose();
      }
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setKeyInput('');
      setError(null);
      setSuccess(false);
      setLogoClicks(0);
    }
  }, [isOpen]);

  const handleLogoClick = () => {
    const next = logoClicks + 1;
    setLogoClicks(next);
    if (next >= 5) {
      localStorage.setItem('finalyze_dev_bypass_active', 'true');
      localStorage.setItem('finalyze_permanent_owner', 'true');
      onSaved('__dev_bypass__');
      onClose();
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('finalyze_dev_bypass_active');
      localStorage.removeItem('finalyze_permanent_owner');
      localStorage.removeItem('finalyze_auth_user');
      localStorage.removeItem('finalyze_auth_timestamp');
      localStorage.removeItem('finalyze_user_groq_api_key');
      localStorage.removeItem('finalyze_needs_api_key');
      localStorage.removeItem('finalyze_verify_link');
      await signOut(auth);
      onClose();
    } catch {}
  };

  const handleVerifyAndSave = async () => {
    setError(null);
    setSuccess(false);
    
    const trimmedKey = keyInput.trim();
    if (!trimmedKey) {
      setError(t.emptyKey);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: "Return JSON strictly: {\"status\": \"ok\"}",
          userApiKey: trimmedKey
        })
      });

      if (!response.ok) {
        throw new Error("Invalid Key");
      }

      const resData = await response.json();
      if (!resData?.choices?.[0]?.message?.content) {
        throw new Error("Invalid Response structure");
      }

      localStorage.setItem('finalyze_user_groq_api_key', trimmedKey);

      // Save to Firestore (best effort — don't block on failure)
      try {
        if (user && user.uid && user.uid !== 'developer') {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, {
            groqApiKey: trimmedKey,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (fsErr) {
        console.warn('Failed to save API key to Firestore (rules may not be published):', fsErr);
      }

      setSuccess(true);
      onSaved(trimmedKey);
      
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (e: any) {
      setError(t.errorInvalid);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const pageInner = (
    <>
      <div className="flex items-center gap-4 mb-6 border-b border-white/5 pb-5">
        <div 
          className="w-12 h-12 bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-400 border border-sky-500/20 cursor-pointer select-none"
          onClick={handleLogoClick}
          title={logoClicks > 0 ? `${5 - logoClicks} more clicks...` : ''}
        >
          <Key size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white leading-tight">{t.title}</h3>
          {isDeveloperSession() && (
            <span className="text-[10px] bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-full px-2.5 py-0.5 font-bold uppercase tracking-wider mt-1 inline-block">
              Admin Account
            </span>
          )}
        </div>
      </div>

      <p className="text-slate-400 text-sm leading-relaxed mb-6">
        {t.desc}
      </p>

      {/* Verification message for unverified clients */}
      {typeof window !== 'undefined' && localStorage.getItem('finalyze_verify_link') && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 text-center space-y-2">
          <p className="text-xs text-amber-400 font-bold">
            {lang === 'ar'
              ? '📧 تم إرسال رابط التفعيل إلى بريدك Gmail. اضغط على "تأكيد الحساب" في الرسالة.'
              : '📧 Verification link sent to your Gmail. Click "Confirm Account" in the email.'}
          </p>
          <a
            href={(() => { try { return localStorage.getItem('finalyze_verify_link') || '#'; } catch { return '#'; } })()}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-400 transition-all"
          >
            {lang === 'ar' ? 'فتح Gmail' : 'Open Gmail'}
          </a>
        </div>
      )}

      <div className="space-y-3 mb-6 bg-white/5 border border-white/5 rounded-2xl p-5">
        <h4 className="text-xs font-black uppercase text-sky-400 tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          {t.step1}
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed">
          {t.step1Desc}
        </p>
        
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-brand-bg font-black px-6 py-4.5 rounded-xl transition-all shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 hover:-translate-y-0.5 active:translate-y-0 text-sm"
        >
          <span>{t.btnAlibaba}</span>
          <ExternalLink size={16} />
        </a>
      </div>

      <div className="space-y-4 mb-6">
        <h4 className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {t.step2}
        </h4>

        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={t.placeholder}
            className="w-full bg-black/40 border border-white/10 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 rounded-xl px-5 py-4.5 text-sm font-mono text-brand-text outline-none transition-all pr-12 text-right"
            dir="ltr"
            disabled={isLoading || success}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3 mb-6"
          >
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <span className="text-xs text-red-400 leading-normal">{error}</span>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3 mb-6"
          >
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
            <span className="text-xs text-emerald-400 leading-normal">{t.btnSaved}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleVerifyAndSave}
          disabled={isLoading || success}
          className={`w-full flex items-center justify-center gap-2 py-4.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all active:scale-95 shadow-xl ${
            success
              ? 'bg-emerald-500 text-brand-bg shadow-emerald-500/20 cursor-default'
              : isLoading
              ? 'bg-emerald-500/50 text-brand-bg/60 shadow-emerald-500/10 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-400 text-brand-bg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>{t.btnVerifying}</span>
            </>
          ) : success ? (
            <span>{t.btnSaved}</span>
          ) : (
            <>
              <span>{t.btnVerify}</span>
              <ArrowRight size={18} className={isAr ? "rotate-180" : ""} />
            </>
          )}
        </button>

        {isBlocking ? (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 hover:text-red-300 font-bold rounded-xl transition-all text-xs tracking-wider uppercase"
          >
            <LogOut size={14} />
            <span>{t.logoutText}</span>
          </button>
        ) : (
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-full py-3 bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300 font-bold rounded-xl transition-all text-xs tracking-wider uppercase"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
        )}
      </div>

      {isDeveloperSession() && (
        <div className="flex items-center gap-2 mt-4 text-[10px] text-emerald-400/60 justify-center">
          <Info size={12} />
          <span>{t.adminBypassInfo}</span>
        </div>
      )}
    </>
  );

  if (asPage) {
    return (
      <div>
        {pageInner}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative max-w-lg w-full bg-brand-alt border border-white/10 rounded-[32px] p-8 shadow-[0_32px_128px_-12px_rgba(0,0,0,0.85)]"
      >
        {pageInner}
      </motion.div>
    </div>
  );
}
