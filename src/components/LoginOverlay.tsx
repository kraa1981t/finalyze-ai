import React, { useState, useEffect } from 'react';
import { ShieldCheck, Zap, Globe, BarChart3, ExternalLink, HelpCircle, ChevronDown, ChevronUp, Copy, Check, Lock, Mail, MessageSquare, X, Loader2, Key, AtSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../lib/i18n';
import { BASE_URL } from '../lib/firebase';

interface LoginOverlayProps {
  onLogin: () => void;
  lang: Language;
  loginError: string | null;
  onClearError: () => void;
  redirecting?: boolean;
  manualAuthUrl?: string | null;
}

export default function LoginOverlay({ onLogin, lang, loginError, onClearError, redirecting, manualAuthUrl }: LoginOverlayProps) {
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  useEffect(() => {
    setCustomLogo(localStorage.getItem('finalyze_custom_logo'));
    const handleStorage = () => setCustomLogo(localStorage.getItem('finalyze_custom_logo'));
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  const [showGuide, setShowGuide] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedConfigPath, setCopiedConfigPath] = useState(false);

  const [inputError, setInputError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Custom Customer Verification States
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [showSimulatedEmail, setShowSimulatedEmail] = useState(false);

  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';

  const copyToClipboard = async (text: string, isConfig: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isConfig) {
        setCopiedConfigPath(true);
        setTimeout(() => setCopiedConfigPath(false), 2000);
      } else {
        setCopiedDomain(true);
        setTimeout(() => setCopiedDomain(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start p-4 bg-brand-bg overflow-y-auto pt-12 pb-8">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Brand Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-10 relative z-10"
      >
        <div 
          className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-xl shadow-emerald-500/25 rotate-3 hover:rotate-0 transition-all border border-white/50 pointer-events-none select-none active:scale-95"
        >
          <img src={customLogo || `${BASE_URL}logo.png`} alt="Finalyze AI Logo" className="w-full h-full object-cover scale-110" />
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
        <div className="text-right px-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full mb-6 border border-primary/20">
              <Zap size={10} fill="currentColor" />
              <span>{lang === 'ar' ? 'الذكاء الاصطناعي الجيل الرابع' : 'AI Gen 4 Enabled'}</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 leading-tight">
              {lang === 'ar' ? 'حلل الأسواق بذكاء مفرط' : 'Analyze Markets with Hyper-Intelligence'}
            </h1>
            
            <div className="grid grid-cols-2 gap-4 mb-10">
              {[
                { icon: <BarChart3 size={18} />, label: lang === 'ar' ? 'تحليل لحظي' : 'Real-time Analysis' },
                { icon: <Globe size={18} />, label: lang === 'ar' ? 'تغطية عالمية' : 'Global Coverage' },
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

        {/* Right Side: Subscription Card / Action */}
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

            <div className="text-center mb-8 relative z-10">
            </div>

            {/* Client Sign-In - Google Only */}
            <div className="mb-6 p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 relative z-10 text-right space-y-5">
              <div className="flex items-center gap-2 text-emerald-400 justify-end font-bold text-sm">
                <span>{lang === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
                <ShieldCheck size={18} />
              </div>

              <p className="text-xs text-slate-400 text-center">
                {redirecting
                  ? (lang === 'ar' ? 'جاري التوجيه إلى Google...' : 'Redirecting to Google...')
                  : (lang === 'ar' ? 'سجل دخول بحساب Google الخاص بك' : 'Sign in with your Google account')}
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
                  ? (lang === 'ar' ? 'جاري...' : 'Redirecting...')
                  : (lang === 'ar' ? 'تسجيل دخول بـ Google' : 'Sign In with Google')}
              </button>
              {manualAuthUrl && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center space-y-2">
                  <p className="text-[11px] text-amber-400 font-bold">
                    {lang === 'ar' ? '⚠️ لم يتم التوجيه تلقائياً. استخدم الرابط أدناه:' : '⚠️ Auto-redirect failed. Use the link below:'}
                  </p>
                  <a
                    href={manualAuthUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all"
                  >
                    {lang === 'ar' ? '👆 اضغط هنا لتسجيل الدخول بـ Google' : '👆 Click here to Sign In with Google'}
                  </a>
                  <p className="text-[10px] text-slate-500">
                    {lang === 'ar' ? 'بعد تسجيل الدخول، ارجع لهذه الصفحة' : 'After signing in, return to this page'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center pt-2 border-t border-white/5 text-[9px] text-slate-500">
              <span>Google Secure Verification</span>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              {lang === 'ar' ? 'لا يوجد التزام، يمكنك الإلغاء في أي وقت' : 'No commitment, cancel anytime.'}
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Premium Simulated Email Modal */}
      <AnimatePresence>
        {showSimulatedEmail && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative max-w-lg w-full bg-white text-slate-800 rounded-[32px] p-0 shadow-[0_32px_128px_-12px_rgba(255,255,255,0.15)] overflow-hidden"
              dir="rtl"
            >
              {/* Email App Header */}
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="text-xs font-bold text-slate-400 font-mono">
                  {lang === 'ar' ? 'صندوق الوارد الآمن' : 'Secure Inbox'}
                </div>
                <button
                  onClick={() => setShowSimulatedEmail(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto max-h-[80vh]">
                {/* Mail Metadata */}
                <div className="border-b border-slate-100 pb-4 space-y-2 text-right">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{new Date().toLocaleTimeString()}</span>
                    <div>
                      <span className="font-bold text-slate-800">{lang === 'ar' ? 'من: ' : 'From: '}</span>
                      <span>Finalyze AI Security &lt;security@finalyze.ai&gt;</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 text-right">
                    <span className="font-bold text-slate-800">{lang === 'ar' ? 'إلى: ' : 'To: '}</span>
                    <span className="font-mono">{verificationEmail}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-800 pt-1">
                    {lang === 'ar' ? '📥 رمز التنشيط وتأكيد التحقق من حسابك في Finalyze.AI' : '📥 Finalyze.AI Account Activation & Verification'}
                  </div>
                </div>

                {/* Email Body */}
                <div className="space-y-6 text-right">
                  <div className="flex items-center gap-3 justify-end">
                    <div className="flex flex-col text-right">
                      <span className="text-lg font-black text-slate-900 tracking-tighter">
                        Finalyze.<span className="text-emerald-600 italic">AI</span>
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-black">Security Workspace</span>
                    </div>
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200">
                      <img src={customLogo || `${BASE_URL}logo.png`} alt="Finalyze AI Logo" className="w-full h-full object-cover scale-110" />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-base font-bold text-slate-950">
                      {lang === 'ar' ? 'مرحباً بك في منصة التحليل المالي الذكية!' : 'Welcome to the Smart Trading Analytics Platform!'}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {lang === 'ar'
                        ? 'لقد قمت بالتسجيل أو تسجيل الدخول باستخدام البريد الإلكتروني في موقعنا. كخطوة أمان إلزامية لحماية بياناتك والاشتراك الخاص بك، يرجى تأكيد صحة وملكيتك لهذا البريد الإلكتروني بالنقر على زر التنشيط أدناه:'
                        : 'You registered or signed in using your email on our website. As a security step to protect your account and subscription, please confirm ownership of this email address by clicking the activation button below:'}
                    </p>
                  </div>

                  {/* Green Button Verification */}
                  <div className="py-6 flex flex-col items-center justify-center bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                    <button
                      onClick={() => {
                        setShowSimulatedEmail(false);
                        setPendingVerification(false);
                      }}
                      className="inline-flex items-center gap-3 px-8 py-4 bg-[#10B981] hover:bg-[#0D9668] text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer text-base"
                    >
                      <Check size={20} className="stroke-[3] text-white" />
                      <span>{lang === 'ar' ? 'تأكيد التحقق' : 'Confirm Verification'}</span>
                    </button>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {lang === 'ar' ? 'تأكيد آمن بنقرة واحدة • Finalyze AI Secure Verification' : 'One-click Secure Verification'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    {lang === 'ar'
                      ? 'بمجرد الضغط على هذا الزر الأخضر، سيتم تنشيط حسابك ونقلك تلقائياً إلى لوحة التحكم الرئيسية لإدخال مفتاح تشغيل الذكاء الاصطناعي وبدء التحليل.'
                      : 'Once you click this green button, your account will be activated and you will be redirected to the main dashboard to configure your API key.'}
                  </p>
                </div>

                {/* Email Footer */}
                <div className="border-t border-slate-100 pt-5 text-center text-[10px] text-slate-400 space-y-1">
                  <p>© {new Date().getFullYear()} Finalyze.AI Inc. All Rights Reserved.</p>
                  <p>This is an automated security notification. Please do not reply directly to this email.</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer minimal info */}
      <div className="mt-12 text-slate-600 text-[10px] font-medium tracking-widest uppercase">
        Protected by Enterprise Security Standards
      </div>
    </div>
  );
}
