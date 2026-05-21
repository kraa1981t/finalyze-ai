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
}

export default function ApiKeyModal({ isOpen, onClose, isBlocking, lang, user, onSaved }: ApiKeyModalProps) {
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);

  const isDeveloperSession = () => {
    // 1. URL param bypass
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('dev') || params.get('owner') === '1') {
        localStorage.setItem('finalyze_dev_bypass_active', 'true');
        return true;
      }
    }
    // 2. Permanent owner flag
    if (localStorage.getItem('finalyze_permanent_owner') === 'true') return true;
    // 3. Standard bypass active flag
    if (localStorage.getItem('finalyze_dev_bypass_active') === 'true') return true;
    // 4. Email checks
    if (!user) return false;
    const email = user.email || '';
    const activeDevEmail = localStorage.getItem('finalyze_dev_email') || 'bachasalman69@gmail.com';
    return email === activeDevEmail ||
           email === 'bachasalman69@gmail.com' ||
           email === 'taybekraa@gmail.com' ||
           email.includes('dev');
  };

  // Keyboard shortcut: Ctrl+Shift+D → instant developer bypass
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
      const savedKey = localStorage.getItem('finalyze_user_qwen_api_key') || '';
      setKeyInput(savedKey);
      setError(null);
      setSuccess(false);
      setLogoClicks(0);
    }
  }, [isOpen]);

  // 5-click on key icon → developer bypass
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

  if (!isOpen) return null;

  const isAr = lang === 'ar';

  const t = {
    title: isAr ? 'إعداد مفتاح Qwen API الخاص بك' : 'Configure Your Qwen API Key',
    desc: isAr 
      ? 'لكي تتمكن من استخدام خدمات التحليل الفني والذكاء الاصطناعي دون انقطاع، يرجى وضع مفتاح Qwen API الخاص بك من منصة Alibaba Cloud. هذا المفتاح سيحفظ بأمان تام في حسابك ولن يستعمله أحد غيرك.'
      : 'To continue using our institutional AI analysis services, please link your personal Qwen API key from Alibaba Cloud. This key is stored securely in your private account and is only visible to you.',
    step1: isAr ? '1. تسجيل حساب وإنشاء مفتاح على علي بابا' : '1. Sign up & Create Key on Alibaba Cloud',
    step1Desc: isAr
      ? 'اضغط على الزر أدناه لفتح الصفحة الرسمية لعلي بابا، قم بالتسجيل بنفس البريد الإلكتروني الخاص بك، ثم قم بإنشاء مفتاح API جديد ونسخه.'
      : 'Click the button below to open the official Alibaba Cloud page. Sign up with your Gmail, create a new API Key and copy it.',
    btnAlibaba: isAr ? 'الحصول على مفتاح Qwen لـ Finalyze AI' : 'Get Qwen Key for Finalyze AI',
    step2: isAr ? '2. ضع المفتاح في الأسفل للتحقق منه' : '2. Paste Your API Key Below to Verify',
    placeholder: isAr ? 'ضع مفتاح الـ API الخاص بك هنا (sk-...)' : 'Paste your API key here (sk-...)',
    btnVerify: isAr ? 'التحقق والحفظ والبدء' : 'Verify, Save & Start',
    btnVerifying: isAr ? 'جاري التحقق من المفتاح...' : 'Verifying Key...',
    btnSaved: isAr ? 'تم التحقق والحفظ بنجاح!' : 'Successfully Verified & Saved!',
    errorInvalid: isAr 
      ? 'المفتاح غير صالح أو غير نشط. يرجى التأكد من نسخه بالكامل من علي بابا والمحاولة مجدداً.' 
      : 'API key is invalid or inactive. Please make sure you copied it correctly from Alibaba and try again.',
    emptyKey: isAr ? 'الرجاء إدخال المفتاح أولاً.' : 'Please enter your key first.',
    logoutText: isAr ? 'تسجيل الخروج من الحساب' : 'Log Out from Account',
    adminBypassInfo: isAr
      ? 'ملاحظة: حساب المشرف يقوم باستخدام المفتاح الافتراضي للموقع تلقائياً.'
      : 'Note: Admin accounts use the default platform key automatically.'
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onClose();
    } catch (e) {
      console.error("Logout failed:", e);
    }
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
      // Direct Live Verification: Send a short request to Qwen API using this key
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

      // Valid API key! Now store it.
      // 1. Store in localStorage for instant access
      localStorage.setItem('finalyze_user_qwen_api_key', trimmedKey);

      // 2. Store in Firestore if a real user is logged in
      if (user && user.uid && user.uid !== 'developer') {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          qwenApiKey: trimmedKey,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      setSuccess(true);
      onSaved(trimmedKey);
      
      // Delay closing to show success checkmark
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (e: any) {
      console.error("API Key Verification Failed:", e);
      setError(t.errorInvalid);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative max-w-lg w-full bg-brand-alt border border-white/10 rounded-[32px] p-8 shadow-[0_32px_128px_-12px_rgba(0,0,0,0.85)]"
      >
        {/* Header */}
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

        {/* Description */}
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          {t.desc}
        </p>

        {/* Step 1 */}
        <div className="space-y-3 mb-6 bg-white/5 border border-white/5 rounded-2xl p-5">
          <h4 className="text-xs font-black uppercase text-sky-400 tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            {t.step1}
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            {t.step1Desc}
          </p>
          
          <a
            href="https://modelstudio.console.alibabacloud.com/eu-central-1?tab=globalset&source=finalyze-ai&ref=finalyze-ai#/efm/api_key"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-brand-bg font-black px-6 py-4.5 rounded-xl transition-all shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 hover:-translate-y-0.5 active:translate-y-0 text-sm"
          >
            <span>{t.btnAlibaba}</span>
            <ExternalLink size={16} />
          </a>
        </div>

        {/* Step 2 */}
        <div className="space-y-4 mb-6">
          <h4 className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {t.step2}
          </h4>

          {/* Input field */}
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

        {/* Status / Error alerts */}
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

        {/* Buttons */}
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

          {/* Close or Logout options */}
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

        {/* Small admin notice if relevant */}
        {isDeveloperSession() && (
          <div className="flex items-center gap-2 mt-4 text-[10px] text-emerald-400/60 justify-center">
            <Info size={12} />
            <span>{t.adminBypassInfo}</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
