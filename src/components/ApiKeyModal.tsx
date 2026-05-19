import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Key, ExternalLink, Check, AlertCircle, Loader, X } from 'lucide-react';
import { Language, translations } from '../lib/i18n';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  lang: Language;
  onSaveSuccess: (key: string) => void;
}

export default function ApiKeyModal({ isOpen, onClose, userId, lang, onSaveSuccess }: ApiKeyModalProps) {
  const t = translations[lang];
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const isRTL = lang === 'ar';

  useEffect(() => {
    if (!userId || !isOpen) return;

    // Load key from localStorage first for speed
    const localKey = localStorage.getItem(`qwen_api_key_${userId}`);
    if (localKey) {
      setApiKey(localKey);
      return;
    }

    // Fallback: load from Firestore
    const fetchKey = async () => {
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists() && userDoc.data().qwenApiKey) {
          const key = userDoc.data().qwenApiKey;
          setApiKey(key);
          localStorage.setItem(`qwen_api_key_${userId}`, key);
        }
      } catch (err) {
        console.error('Failed to load API key from Firestore:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchKey();
  }, [userId, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setStatus('error');
      setErrorMessage(isRTL ? 'الرجاء إدخال مفتاح صالح' : 'Please enter a valid key');
      return;
    }

    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      // 1. Verify API Key with a lightweight backend check
      const response = await fetch('/api/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userApiKey: apiKey.trim() })
      });

      const verifyData = await response.json();

      if (!response.ok || !verifyData.valid) {
        throw new Error(verifyData.error || (isRTL ? 'مفتاح غير صالح أو منتهي الصلاحية' : 'Invalid or expired API key'));
      }

      // 2. Save key to local storage
      localStorage.setItem(`qwen_api_key_${userId}`, apiKey.trim());

      // 3. Save key to Firestore
      await setDoc(doc(db, 'users', userId), {
        qwenApiKey: apiKey.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setStatus('success');
      onSaveSuccess(apiKey.trim());
      
      setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || (isRTL ? 'فشل التحقق من المفتاح' : 'Failed to verify key'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-brand-bg/85 backdrop-blur-md"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ scale: 0.95, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 20, opacity: 0 }}
          className="relative w-full max-w-lg bg-brand-bg border border-brand-text/10 rounded-[2.5rem] overflow-hidden shadow-2xl p-8 md:p-10 text-brand-text"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full hover:bg-brand-text/5 text-brand-muted hover:text-brand-text transition-colors"
          >
            <X size={20} />
          </button>

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <Key size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black font-display uppercase tracking-tight">
                  {isRTL ? 'إعداد مفتاح API الخاص بك' : 'Set Your API Key'}
                </h3>
                <p className="text-sm text-brand-muted">
                  {isRTL ? 'استخدم مفتاح Qwen الخاص بك للتحليل' : 'Use your own Qwen key for analysis'}
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 space-y-3 text-sm leading-relaxed">
              <p className="text-brand-text font-medium">
                {isRTL 
                  ? 'يجب عليك الحصول على مفتاح API مجاني أو مدفوع من منصة Alibaba Cloud لتتمكن من تشغيل تحليلات الذكاء الاصطناعي.' 
                  : 'You must obtain a free or paid API key from Alibaba Cloud to run AI analyses.'}
              </p>
              <a
                href="https://modelstudio.console.alibabacloud.com/eu-central-1?tab=globalset#/efm/api_key"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary font-black hover:underline group cursor-pointer"
              >
                <span>{isRTL ? 'اضغط هنا لإنشاء مفتاحك على علي بابا' : 'Click here to create your key on Alibaba'}</span>
                <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-brand-muted uppercase tracking-wider block">
                  {isRTL ? 'مفتاح API الخاص بك (Qwen API Key)' : 'Your Qwen API Key'}
                </label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={loading}
                  className="w-full h-14 px-5 bg-brand-alt/50 border border-brand-text/10 rounded-2xl focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none text-base font-mono transition-all disabled:opacity-50"
                />
              </div>

              {/* Status Message */}
              {status === 'error' && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/5 p-4 rounded-xl border border-red-500/10">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {status === 'success' && (
                <div className="flex items-center gap-2 text-emerald-500 text-sm bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 animate-pulse">
                  <Check size={16} className="shrink-0" />
                  <span>{isRTL ? 'تم حفظ المفتاح والتحقق منه بنجاح!' : 'API Key saved and verified successfully!'}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || status === 'success'}
                className="w-full h-14 bg-brand-text text-brand-bg hover:bg-primary hover:text-brand-text font-black text-base rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader size={18} className="animate-spin" />
                    <span>{isRTL ? 'جاري التحقق...' : 'Verifying...'}</span>
                  </>
                ) : (
                  <span>{isRTL ? 'تحقق واحفظ المفتاح' : 'Verify & Save Key'}</span>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
