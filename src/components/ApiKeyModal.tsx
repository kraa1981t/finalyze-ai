import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, CheckCircle2, AlertTriangle, LogOut, Loader2, Info } from 'lucide-react';
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
  onLogout?: () => void;
  asPage?: boolean;
}

function loadKey(): { value: string; enabled: boolean } {
  try {
    return {
      value: localStorage.getItem('finalyze_key1_value') || '',
      enabled: localStorage.getItem('finalyze_key1_enabled') !== 'false',
    };
  } catch {
    return { value: '', enabled: true };
  }
}

function saveKey(value: string) {
  localStorage.setItem('finalyze_key1_value', value);
  localStorage.setItem('finalyze_key1_enabled', 'true');
  try {
    sessionStorage.setItem('finalyze_key_mirror', value);
    document.cookie = `finalyze_api_key=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {}
}

export default function ApiKeyModal({ isOpen, onClose, isBlocking, lang, user, onSaved, onLogout, asPage }: ApiKeyModalProps) {
  const [keyValue, setKeyValue] = useState(() => loadKey().value);
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isAr = lang === 'ar';

  // Migrate old key on first mount
  useEffect(() => {
    const k = loadKey();
    if (!k.value) {
      const oldKey = localStorage.getItem('finalyze_user_groq_api_key');
      if (oldKey) setKeyValue(oldKey);
    }
  }, []);

  const DEV_EMAILS = ['taybekraa@gmail.com', 'kraakraa109@gmail.com', 'bachasalman69@gmail.com'];
  const isDeveloperSession = () => {
    if (!user) return false;
    const email = (user.email || '').toLowerCase().trim();
    return DEV_EMAILS.includes(email);
  };

  useEffect(() => {
    if (isOpen) {
      setKeyValue(loadKey().value);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      try { await signOut(auth); } catch {}
    }
    onClose();
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);

    const val = keyValue.trim();
    setIsLoading(true);

    if (!val) {
      // Clear key action
      try {
        localStorage.removeItem('finalyze_key1_value');
        localStorage.removeItem('finalyze_key1_enabled');
        localStorage.removeItem('finalyze_user_groq_api_key');
        localStorage.removeItem('finalyze_key2_value');
        localStorage.removeItem('finalyze_key2_provider');
        localStorage.removeItem('finalyze_key2_enabled');
        sessionStorage.removeItem('finalyze_key_mirror');
        document.cookie = "finalyze_api_key=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        
        if (user && user.uid && user.uid !== 'developer') {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, {
            groqApiKey: "",
            geminiApiKey: "",
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (e) {
        console.error("Error clearing key:", e);
      }

      setSuccess(true);
      onSaved("");
      setTimeout(() => onClose(), 1500);
      setIsLoading(false);
      return;
    }

    // Normal save key action
    saveKey(val);
    localStorage.removeItem('finalyze_user_groq_api_key');
    localStorage.removeItem('finalyze_key2_value');
    localStorage.removeItem('finalyze_key2_provider');
    localStorage.removeItem('finalyze_key2_enabled');

    try {
      if (user && user.uid && user.uid !== 'developer') {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          groqApiKey: val,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // Register client with API key when new user saves key
        const userEmail = user.email || '';
        const isGeminiKey = val.startsWith('AIzaSy');
        try {
          const response = await fetch('/api/register-client-with-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              uid: user.uid,
              apiKeyType: isGeminiKey ? 'gemini' : 'groq'
            })
          });
          if (response.ok) {
            console.log("Client registered successfully with API key");
          }
        } catch (e) {
          console.warn("Failed to register client:", e);
        }
      }
    } catch {}

    setSuccess(true);
    onSaved(val);
    setTimeout(() => onClose(), 1500);
    setIsLoading(false);
  };

  if (!isOpen) return null;

  const pageInner = (
    <>
      <div className="flex items-center gap-4 mb-6 border-b border-white/5 pb-5">
        <div
          className="w-12 h-12 bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-400 border border-sky-500/20 pointer-events-none"
        >
          <Key size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white leading-tight">
            {isAr ? 'مفتاح API' : 'API Key'}
          </h3>
          {isDeveloperSession() && (
            <span className="text-[10px] bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-full px-2.5 py-0.5 font-bold uppercase tracking-wider mt-1 inline-block">
              Admin Account
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-5 select-none">
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-3.5 text-sm text-sky-400 hover:text-sky-300 transition-all bg-sky-500/15 border-2 border-sky-500/50 hover:border-sky-400 hover:bg-sky-500/25 py-4.5 rounded-2xl font-black w-full shadow-[0_0_30px_rgba(14,165,233,0.3)] animate-pulse scale-[1.02] relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 to-blue-500/10 opacity-50" />
          <Key size={18} className="shrink-0 text-sky-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>{isAr ? 'أنشئ مفتاح Groq مجاني (موصى به للغاية وسريع)' : 'Create free Groq key (Highly Recommended)'}</span>
        </a>

        <a
          href="https://aistudio.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-slate-300 transition-all bg-white/5 border border-white/10 hover:bg-white/10 py-2.5 rounded-xl font-bold w-full"
        >
          <Info size={14} className="shrink-0" />
          {isAr ? 'أنشئ مفتاح Google Gemini مجاني' : 'Create free Google Gemini key'}
        </a>
      </div>

      <p className="text-slate-400 text-sm leading-relaxed mb-6">
        {isAr
          ? 'يرجى إدخال مفتاح Groq الخاص بك (موصى به لتجنب أي فشل في الاتصال وللحصول على تحليل مستقر وسريع) أو مفتاح Google البديل.'
          : 'Please enter your Groq API key (highly recommended to avoid connection failures and get stable analysis) or Google Gemini key.'}
      </p>

      {typeof window !== 'undefined' && localStorage.getItem('finalyze_verify_link') && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6 text-center space-y-2">
          <p className="text-xs text-amber-400 font-bold">
            {isAr ? '📧 تم إرسال رابط التفعيل إلى بريدك Gmail.' : '📧 Verification link sent to your Gmail.'}
          </p>
          <a
            href={(() => { try { return localStorage.getItem('finalyze_verify_link') || '#'; } catch { return '#'; } })()}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-400 transition-all"
          >
            {isAr ? 'فتح Gmail' : 'Open Gmail'}
          </a>
        </div>
      )}

      <div className="mb-6">
        <div className="space-y-3 p-5 rounded-2xl bg-white/5 border border-white/5">
          <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-sky-400">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            {isAr ? 'مفتاح API' : 'API Key'}
          </h4>

          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder={isAr ? 'الصق مفتاح API...' : 'Paste API key...'}
              autoComplete="off"
              className="w-full bg-black/40 border border-white/10 focus:border-sky-400 focus:ring-1 focus:ring-sky-400 rounded-xl px-5 py-4.5 text-sm font-mono text-brand-text outline-none transition-all pr-12 text-right"
              dir="ltr"
              disabled={isLoading || success}
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2">
              <button
                onClick={() => setShow(!show)}
                className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
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
            <span className="text-xs text-emerald-400 leading-normal">
              {isAr ? '✓ تم الحفظ بنجاح!' : '✓ Saved Successfully!'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-3">
        <button
          onClick={handleSave}
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
              <span>{isAr ? 'جارٍ الحفظ...' : 'Saving...'}</span>
            </>
          ) : success ? (
            <span>{isAr ? '✓ تم الحفظ!' : '✓ Saved!'}</span>
          ) : (
            <span>{isAr ? 'حفظ' : 'Save'}</span>
          )}
        </button>

        {isBlocking ? (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 hover:text-red-300 font-bold rounded-xl transition-all text-xs tracking-wider uppercase"
          >
            <LogOut size={14} />
            <span>{isAr ? 'تسجيل خروج' : 'Logout'}</span>
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
          <span>{isAr ? 'وضع المطور نشط — تم تجاوز المفتاح.' : 'Developer mode active — API key bypassed.'}</span>
        </div>
      )}
    </>
  );

  if (asPage) {
    return <div>{pageInner}</div>;
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
