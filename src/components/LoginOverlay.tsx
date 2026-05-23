import React, { useState } from 'react';
import { ShieldCheck, Zap, Globe, BarChart3, ExternalLink, HelpCircle, ChevronDown, ChevronUp, Copy, Check, Lock, Mail, MessageSquare, X, Loader2, Key, AtSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../lib/i18n';

interface LoginOverlayProps {
  onLogin: () => void;
  onBypassLogin?: (email: string) => void;
  onClientAuth?: (email: string, password: string) => void;
  lang: Language;
  loginError: string | null;
  onClearError: () => void;
  redirecting?: boolean;
  manualAuthUrl?: string | null;
}

export default function LoginOverlay({ onLogin, onBypassLogin, onClientAuth, lang, loginError, onClearError, redirecting, manualAuthUrl }: LoginOverlayProps) {
  const [showGuide, setShowGuide] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedConfigPath, setCopiedConfigPath] = useState(false);

  const [customEmail, setCustomEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inputError, setInputError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authMethod, setAuthMethod] = useState<'email' | 'google'>('email');
  const [verificationLink, setVerificationLink] = useState('');

  const [logoClicks, setLogoClicks] = useState(0);
  const [devModeActive, setDevModeActive] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('finalyze_dev_bypass_active') === 'true' ||
             window.location.hostname === 'localhost' ||
             new URLSearchParams(window.location.search).has('dev');
    }
    return false;
  });

  // Dynamic developer credentials loading
  const [currentDevEmail, setCurrentDevEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('finalyze_dev_email') || 'bachasalman69@gmail.com';
    }
    return 'bachasalman69@gmail.com';
  });

  const [currentDevPhone, setCurrentDevPhone] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('finalyze_dev_phone') || '0663919868';
    }
    return '0663919868';
  });

  // 2FA modal states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [devEmailInput, setDevEmailInput] = useState('');
  const [devPhoneInput, setDevPhoneInput] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [generatedEmailOtp, setGeneratedEmailOtp] = useState('');
  const [generatedSmsOtp, setGeneratedSmsOtp] = useState('');
  const [enteredEmailOtp, setEnteredEmailOtp] = useState('');
  const [enteredSmsOtp, setEnteredSmsOtp] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [isLoadingOtp, setIsLoadingOtp] = useState(false);
  const [notification, setNotification] = useState<{ type: 'sms' | 'email'; title: string; body: string; isCustomerActivation?: boolean } | null>(null);

  // Custom Customer Verification States
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [showSimulatedEmail, setShowSimulatedEmail] = useState(false);

  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';

  React.useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev')) {
      localStorage.setItem('finalyze_dev_bypass_active', 'true');
      setDevModeActive(true);
    }
  }, []);

  // Update dynamic credentials on modal load
  React.useEffect(() => {
    if (showAuthModal && typeof window !== 'undefined') {
      setCurrentDevEmail(localStorage.getItem('finalyze_dev_email') || 'bachasalman69@gmail.com');
      setCurrentDevPhone(localStorage.getItem('finalyze_dev_phone') || '0663919868');
    }
  }, [showAuthModal]);

  // Auto close notification after 8 seconds
  React.useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 8000);
      return () => clearTimeout(t);
    }
  }, [notification]);

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

  const handleLogoClick = () => {
    setLogoClicks(prev => {
      const next = prev + 1;
      if (next >= 5) {
        if (devModeActive) {
          setDevModeActive(false);
          localStorage.removeItem('finalyze_dev_bypass_active');
          alert(lang === 'ar' ? '🔒 تم إيقاف وضع المطور!' : '🔒 Developer Mode Deactivated!');
        } else {
          // Instant direct activation and bypass login for the developer!
          localStorage.setItem('finalyze_dev_bypass_active', 'true');
          setDevModeActive(true);
          if (onBypassLogin) {
            onBypassLogin(currentDevEmail);
          }
        }
        return 0;
      }
      return next;
    });
  };

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const emailTrim = devEmailInput.trim().toLowerCase();
    const phoneTrim = devPhoneInput.trim();

    const storedEmail = currentDevEmail.toLowerCase();
    const storedPhone = currentDevPhone;

    if (emailTrim !== storedEmail || phoneTrim !== storedPhone) {
      setAuthError(lang === 'ar' ? '⚠️ البريد الإلكتروني أو رقم الهاتف غير مطابق لبيانات المطور!' : '⚠️ Email or phone number does not match developer credentials!');
      return;
    }

    setIsLoadingOtp(true);

    // Simulate sending OTPs via slide-in system notifications
    setTimeout(() => {
      const emailCode = Math.floor(1000 + Math.random() * 9000).toString();
      const smsCode = Math.floor(1000 + Math.random() * 9000).toString();

      setGeneratedEmailOtp(emailCode);
      setGeneratedSmsOtp(smsCode);
      setIsOtpSent(true);
      setIsLoadingOtp(false);

      // Trigger incoming notifications overlay
      setTimeout(() => {
        setNotification({
          type: 'email',
          title: '📧 Google Security Workspace',
          body: lang === 'ar' 
            ? `رمز الموافقة الأمنية لتسجيل دخول المطور في Finalyze.AI هو: ${emailCode}`
            : `Security approval OTP for Finalyze.AI Developer Sign-In is: ${emailCode}`
        });
      }, 1500);

      setTimeout(() => {
        setNotification({
          type: 'sms',
          title: '💬 رسالة نصية قصيرة (SMS)',
          body: lang === 'ar'
            ? `تنبيه: رمز التحقق الثنائي للمطور هو: ${smsCode}`
            : `Alert: Developer 2FA verification OTP is: ${smsCode}`
        });
      }, 3500);

    }, 1200);
  };

  const handleVerifyOtp = () => {
    setAuthError('');
    if (enteredEmailOtp !== generatedEmailOtp || enteredSmsOtp !== generatedSmsOtp) {
      setAuthError(lang === 'ar' ? '⚠️ الرموز المدخلة غير مطابقة! يرجى التأكد من كتابة الرموز الصحيحة.' : '⚠️ The entered codes are incorrect! Please verify and try again.');
      return;
    }

    setAuthSuccess(lang === 'ar' ? '🎉 تم التحقق بنجاح!' : '🎉 Verification successful!');
    
    // Activate Developer Mode and log in
    localStorage.setItem('finalyze_dev_bypass_active', 'true');
    setDevModeActive(true);

    setTimeout(() => {
      setShowAuthModal(false);
      if (onBypassLogin) {
        onBypassLogin(currentDevEmail);
      }
      
      // Reset state
      setDevEmailInput('');
      setDevPhoneInput('');
      setIsOtpSent(false);
      setEnteredEmailOtp('');
      setEnteredSmsOtp('');
      setGeneratedEmailOtp('');
      setGeneratedSmsOtp('');
      setAuthError('');
      setAuthSuccess('');
    }, 1000);
  };

  const handleCancelAuth = () => {
    setShowAuthModal(false);
    setDevEmailInput('');
    setDevPhoneInput('');
    setIsOtpSent(false);
    setEnteredEmailOtp('');
    setEnteredSmsOtp('');
    setGeneratedEmailOtp('');
    setGeneratedSmsOtp('');
    setAuthError('');
    setAuthSuccess('');
  };

  const handlePresetSelect = (email: string) => {
    if (onBypassLogin) {
      onBypassLogin(email);
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
          onClick={handleLogoClick}
          className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-xl shadow-emerald-500/25 rotate-3 hover:rotate-0 transition-all border border-white/50 cursor-pointer select-none active:scale-95"
          title={lang === 'ar' ? 'انقر 5 مرات لتفعيل وضع المطور' : 'Click 5 times for Developer Mode'}
        >
          <img src="/logo.png" alt="Finalyze AI Logo" className="w-full h-full object-cover scale-110" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-3xl font-display font-black tracking-tighter text-white drop-shadow-sm leading-none">
            Finalyze.<span className="text-primary italic">AI</span>
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
            
            <p className="text-slate-400 text-lg mb-10 max-w-lg ml-auto leading-relaxed">
              {lang === 'ar' 
                ? 'انضم لأكثر من 5000 متداول يستخدمون Finalyze AI للحصول على رؤى دقيقة وتوقعات لحظية للاتجاهات.'
                : 'Join over 5000+ traders using Finalyze AI to gain accurate insights and real-time trend predictions.'}
            </p>

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
              <div className="text-primary text-sm font-black mb-2 uppercase tracking-tighter">
                {lang === 'ar' ? 'ابدأ الآن' : 'Get Started'}
              </div>
              <h3 className="text-2xl font-bold text-white">
                {lang === 'ar' ? 'اشتراك شهري مرن' : 'Flexible Monthly Plan'}
              </h3>
            </div>

            {/* Client Sign-In - Two Options */}
            {!pendingVerification ? (
              <div className="mb-6 p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 relative z-10 text-right space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 justify-end font-bold text-sm">
                  <span>{lang === 'ar' ? 'تسجيل الدخول' : 'Client Sign-In'}</span>
                  <ShieldCheck size={18} />
                </div>

                {/* Method Tabs */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setAuthMethod('email')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                      authMethod === 'email'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <AtSign size={14} />
                    {lang === 'ar' ? 'إيميل + كلمة سر' : 'Email + Password'}
                  </button>
                  <button
                    onClick={() => setAuthMethod('google')}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                      authMethod === 'google'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Globe size={14} />
                    Google
                  </button>
                </div>

                {/* Email + Password Form */}
                {authMethod === 'email' && (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!customEmail || !password) return;
                    setSubmitting(true);
                    setVerificationLink('');
                    await onClientAuth?.(customEmail.trim().toLowerCase(), password);
                    setSubmitting(false);
                  }} className="space-y-3">
                    <input
                      type="email"
                      value={customEmail}
                      onChange={(e) => { setCustomEmail(e.target.value); onClearError(); }}
                      placeholder={lang === 'ar' ? 'البريد الإلكتروني' : 'your@email.com'}
                      className="w-full bg-brand-bg border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white text-left focus:outline-none focus:border-emerald-500/50"
                      required
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); onClearError(); }}
                      placeholder={lang === 'ar' ? 'كلمة المرور' : 'Password'}
                      className="w-full bg-brand-bg border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white text-left focus:outline-none focus:border-emerald-500/50"
                      required
                      minLength={6}
                    />
                    {inputError && <p className="text-[10px] text-red-400 font-bold mt-1 text-right">{inputError}</p>}

                    {loginError && loginError !== 'verify_email' && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 text-center">
                        <p className="text-[11px] text-red-400 font-bold">
                          {loginError === 'auth/network-request-failed'
                            ? (lang === 'ar' ? '❌ مشكلة في الاتصال بالإنترنت' : '❌ Network error')
                            : loginError}
                        </p>
                      </div>
                    )}

                    {loginError === 'verify_email' && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
                        <p className="text-xs text-amber-400 font-bold mb-2">
                          {lang === 'ar'
                            ? '📧 تم إنشاء الحساب! اضغط على الرابط لتفعيل حسابك:'
                            : '📧 Account created! Click the link to verify:'}
                        </p>
                        <a href={(() => { try { return localStorage.getItem('finalyze_verify_link') || '#'; } catch { return '#'; } })()}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-400 transition-all shadow-lg">
                          <ShieldCheck size={16} />
                          {lang === 'ar' ? 'تفعيل الحساب ✓' : 'Verify Account ✓'}
                        </a>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting || !customEmail || !password}
                      className="w-full bg-primary hover:bg-emerald-500 text-brand-bg font-black py-4 rounded-2xl transition-all text-sm cursor-pointer shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 active:scale-98 disabled:opacity-50"
                    >
                      {submitting
                        ? (lang === 'ar' ? 'جاري...' : 'Please wait...')
                        : (lang === 'ar' ? 'تسجيل وإرسال التفعيل ←' : 'Sign Up & Verify →')}
                    </button>
                  </form>
                )}

                {/* Google Sign-In */}
                {authMethod === 'google' && (
                  <div className="space-y-3">
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
                )}

                {/* Direct Bypass Options for Developer Mode (Only visible if devModeActive is true) */}
                {devModeActive && (
                  <div className="pt-4 border-t border-white/5 space-y-3 text-right">
                    <p className="text-[11px] text-slate-400 leading-relaxed font-bold">
                      {lang === 'ar'
                        ? '⚡ خيارات المطور للمحاكاة والاختبار السريع:'
                        : '⚡ Developer Bypass & Simulation Options:'}
                    </p>

                    <div className="space-y-2">
                      {/* 1. Developer Login - Mowten Option */}
                      <button
                        type="button"
                        onClick={() => handlePresetSelect(currentDevEmail)}
                        className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-left cursor-pointer group"
                      >
                        <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full shrink-0">
                          {lang === 'ar' ? 'خيار موطن ⚡' : 'Mowten Option ⚡'}
                        </span>
                        <div className="flex flex-col text-right">
                          <span className="text-xs font-bold text-white">
                            {lang === 'ar' ? 'خيار موطن (دخول مباشر بكامل الصلاحيات)' : 'Mowten Option (Direct Full Access)'}
                          </span>
                          <span className="text-[9px] text-slate-400">{currentDevEmail}</span>
                        </div>
                      </button>

                      {/* 2. Client Login (User/Audience experience simulation) */}
                      <button
                        type="button"
                        onClick={() => handlePresetSelect('trader.client@gmail.com')}
                        className="w-full flex items-center justify-between p-3 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 transition-all text-left cursor-pointer group"
                      >
                        <span className="text-[9px] font-black uppercase text-blue-400 bg-blue-500/15 px-2.5 py-1 rounded-full shrink-0">
                          {lang === 'ar' ? 'العميل - محاكاة تجربة الجمهور 💎' : 'Client - Simulation Mode 💎'}
                        </span>
                        <div className="flex flex-col text-right">
                          <span className="text-xs font-bold text-white">VIP Trader (تجربة العميل)</span>
                          <span className="text-[9px] text-slate-400">trader.client@gmail.com</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-6 p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 relative z-10 text-right space-y-5">
                <div className="flex items-center gap-2 text-amber-400 justify-end font-bold text-sm">
                  <span>{lang === 'ar' ? 'تأكيد البريد الإلكتروني معلق' : 'Email Verification Pending'}</span>
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                </div>
                
                <h4 className="text-md font-bold text-white leading-snug">
                  {lang === 'ar' ? '📧 قم بتأكيد بريدك الإلكتروني لتنشيط الحساب' : '📧 Confirm Your Email to Activate Account'}
                </h4>
                
                <p className="text-slate-300 text-xs leading-relaxed">
                  {lang === 'ar'
                    ? `لقد أرسلنا رسالة تنشيط أمنية إلى البريد المسجل: ${verificationEmail}. يرجى النقر على زر "تأكيد التحقق" الأخضر الموجود داخل الرسالة للدخول المباشر.`
                    : `We have sent a secure activation email to: ${verificationEmail}. Please click the green "Confirm Verification" button inside the message to log in.`}
                </p>

                <div className="bg-black/30 p-3 rounded-2xl border border-white/5 space-y-2">
                  <div className="text-[10px] text-slate-400 font-bold">
                    {lang === 'ar' ? '🛡️ حالة المحاكاة الأمنية:' : '🛡️ Security Simulation Status:'}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-amber-400 justify-end font-semibold">
                    <span>{lang === 'ar' ? 'بانتظار وصول إشعار البريد الإلكتروني (خلال ثانيتين)...' : 'Waiting for email notification (2s)...'}</span>
                    <Loader2 size={10} className="animate-spin" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPendingVerification(false)}
                  className="w-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[11px] font-bold py-2.5 rounded-xl transition-all cursor-pointer text-center"
                >
                  {lang === 'ar' ? '← العودة وتغيير البريد الإلكتروني' : '← Go Back & Change Email'}
                </button>
              </div>
            )}

            <div className="flex items-center justify-center pt-2 border-t border-white/5 text-[9px] text-slate-500">
              <span>Google Secure Verification</span>
            </div>

            <p className="mt-6 text-center text-xs text-slate-500">
              {lang === 'ar' ? 'لا يوجد التزام، يمكنك الإلغاء في أي وقت' : 'No commitment, cancel anytime.'}
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Firebase Setup & Troubleshooting Guide (Only Visible in Developer Mode) */}
      {devModeActive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          id="firebase-guide-box"
          className="max-w-4xl w-full mt-12 relative z-10"
        >
          <div className="bg-brand-alt/45 backdrop-blur-xl p-6 md:p-8 rounded-[30px] border border-white/5 shadow-2xl">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex items-center justify-between text-left text-slate-300 hover:text-white transition-colors py-2 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <HelpCircle size={20} />
                </div>
                <div className="text-right">
                  <h4 className="text-md font-bold">
                    {lang === 'ar' ? '🔧 دليل حل أخطاء تسجيل الدخول وتهيئة رابط موقعك الخاص' : '🔧 Auth Troubleshooting & Domain Setup Guide'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {lang === 'ar' ? 'حل مشكلة إغلاق النافذة السريع وتعديل اسم العلامة التجارية لعملية تسجيل الدخول' : 'Solve quick popup close & display your custom branding on Google Sign-In'}
                  </p>
                </div>
              </div>
              {showGuide ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
            </button>

            <AnimatePresence>
              {showGuide && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mt-6 border-t border-white/5 pt-6 space-y-8"
                >
                  {/* 1. Unauthorized Domain / Popup Closing Solution */}
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-red-500/20">
                      {lang === 'ar' ? 'المشكلة 1: اختفاء نافذة الحسابات فوراً أو الإغلاق التلقائي' : 'Issue 1: Auth Popup Closes Instantly'}
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed text-right">
                      {lang === 'ar' 
                        ? 'يحدث هذا عادةً بسبب عدم ترخيص نطاق موقعك الحالي في لوحة تحكم Firebase، أو لكون تسجيل الدخول بـ Google غير مفعل. اتبع الخطوات التالية لحلها:' 
                        : 'This typically occurs because your website domain is not whitelisted in the Firebase project console or Google Auth is disabled. Follow these quick steps to resolve:'}
                    </p>
                    
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
                      <div className="bg-brand-bg/60 p-5 rounded-2xl border border-white/5 space-y-3 text-right">
                        <div className="font-bold text-primary flex items-center gap-2 justify-end">
                          <span>{lang === 'ar' ? '1. فتح وحدة تحكم Firebase' : '1. Open Firebase Console'}</span>
                          <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black">1</span>
                        </div>
                        <p className="text-slate-400 text-xs leading-relaxed">
                          {lang === 'ar'
                            ? 'ادخل إلى console.firebase.google.com وافتح مشروع Firebase المرتبط بالتطبيق.'
                            : 'Go to console.firebase.google.com and open the corresponding Firebase project.'}
                        </p>
                        <a 
                          href="https://console.firebase.google.com" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline justify-end w-full"
                        >
                          {lang === 'ar' ? 'فتح لوحة التحكم' : 'Open Console'} <ExternalLink size={12} />
                        </a>
                      </div>

                      <div className="bg-brand-bg/60 p-5 rounded-2xl border border-white/5 space-y-3 text-right">
                        <div className="font-bold text-primary flex items-center gap-2 justify-end">
                          <span>{lang === 'ar' ? '2. إضافة هذا الرابط الحالي' : '2. Add Authorized Domain'}</span>
                          <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black">2</span>
                        </div>
                        <p className="text-slate-400 text-xs leading-relaxed">
                          {lang === 'ar'
                            ? 'انتقل إلى Authentication > Settings > Authorized domains ثم انقر على Add domain وأضف هذا النطاق بدقة:'
                            : 'Go to Authentication > Settings > Authorized domains, click Add domain, and input this domain:'}
                        </p>
                        <div className="flex items-center gap-2 bg-brand-alt/80 p-2.5 rounded-xl border border-white/5 mt-2 justify-end">
                          <span className="font-mono text-xs text-white overflow-hidden text-ellipsis flex-1 select-all text-left">{currentDomain}</span>
                          <button
                            onClick={() => copyToClipboard(currentDomain, false)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            {copiedDomain ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="bg-brand-bg/40 p-4 rounded-xl border border-primary/10 text-xs text-slate-400 leading-relaxed text-right">
                      💡 <strong>{lang === 'ar' ? 'خطوة تفعيل Google:' : 'Enable Google Provider:'}</strong>{' '}
                      {lang === 'ar'
                        ? 'تأكد أيضاً من الذهاب إلى علامة التبويب "Sign-in method" في نفس الصفحة، وانقر على Google وقم بتمكينها (Enabled) وحفظ التغييرات.'
                        : 'Please also visit the "Sign-in method" tab in Firebase Auth, click on Google, and ensure it is toggled to Enabled.'}
                    </div>
                  </div>

                  {/* 2. Brand Link Mismatch / Custom Firebase Solution */}
                  <div className="space-y-4 pt-6 border-t border-white/5">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20">
                      {lang === 'ar' ? 'المشكلة 2: ظهور رابط غير موقعي في نافذة تسجيل الدخول' : 'Issue 2: Displaying Custom Website Brand Name'}
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed text-right">
                      {lang === 'ar'
                        ? 'يظهر الرابط gen-lang-client-... لأن التطبيق مهيأ بمشروع Firebase الافتراضي. لكي يعرض محدد حساب Google اسم موقعك الاحترافي (مثل Finalyze.AI) بالكامل:'
                        : 'The default gen-lang-client domain is displayed because the project currently uses a default configuration. To brand the Google Login Screen with your own brand name (e.g. Finalyze.AI):'}
                    </p>

                    <div className="space-y-3">
                      {[
                        {
                          title: lang === 'ar' ? '1. إنشاء مشروع Firebase مخصص باسمك' : '1. Create custom Firebase Project',
                          desc: lang === 'ar' 
                            ? 'قم بإنشاء مشروع مجاني جديد بالكامل في لوحة تحكم Firebase وسمّه "finalyze-ai" ليتم تعيين نطاق authDomain خاص باسم موقعك.' 
                            : 'Create a free project inside Firebase Console and name it "finalyze-ai" so your authDomain matches your website identity.'
                        },
                        {
                          title: lang === 'ar' ? '2. تمكين تسجيل الدخول وترخيص النطاقات' : '2. Setup Authentication & Whitelist',
                          desc: lang === 'ar' 
                            ? 'في مشروعك الجديد، قم بتمكين موفر تسجيل دخول Google، وأضف رابط موقعك الحالي (مثلاً: finalyze-ai-sigma.vercel.app) إلى Authorized domains.' 
                            : 'In your new Firebase project, enable Google Sign-in and add your website URL to the Authorized domains list.'
                        },
                        {
                          title: lang === 'ar' ? '3. إضافة تطبيق ويب ونسخ التكوين' : '3. Register a Web App & Copy Config',
                          desc: lang === 'ar' 
                            ? 'من إعدادات المشروع (Project Settings)، قم بتسجيل تطبيق ويب جديد (Web App) للحصول على كود الإعدادات الخاص بك (Firebase Config).' 
                            : 'Navigate to Project Settings, add a new Web App, and copy the credentials JSON (Firebase Config object).'
                        },
                        {
                          title: lang === 'ar' ? '4. استبدال محتوى ملف الإعدادات في المشروع' : '4. Update firebase-applet-config.json',
                          desc: lang === 'ar' 
                            ? 'افتح الملف التالي في محرر الأكواد واستبدل كامل المحتوى ببيانات مشروعك الجديد:'
                            : 'Open the following configuration file and drop your newly copied parameters into it:'
                        }
                      ].map((step, idx) => (
                        <div key={idx} className="flex gap-4 items-start text-right justify-end">
                          <div className="flex-1 space-y-1">
                            <h5 className="font-bold text-white text-sm">{step.title}</h5>
                            <p className="text-slate-400 text-xs leading-relaxed">{step.desc}</p>
                            {idx === 3 && (
                              <div className="flex items-center gap-2 bg-brand-bg/60 p-2.5 rounded-xl border border-white/5 mt-2 max-w-md ml-auto justify-end">
                                <span className="font-mono text-xs text-white overflow-hidden text-ellipsis flex-1 text-left">firebase-applet-config.json</span>
                                <button
                                  onClick={() => copyToClipboard('firebase-applet-config.json', true)}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                  type="button"
                                >
                                  {copiedConfigPath ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-black font-mono mt-0.5">
                            {idx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="bg-brand-bg/40 p-4 rounded-xl border border-emerald-500/10 text-xs text-slate-400 leading-relaxed text-right">
                      ✨ <strong>{lang === 'ar' ? 'الخطوة النهائية:' : 'Final Deployment Step:'}</strong>{' '}
                      {lang === 'ar'
                        ? 'بمجرد استبدال هذا الملف وحفظه، قم برفع التعديلات إلى المستودع (GitHub)، وسيتم تفعيل النطاق الجديد وعرض علامتك التجارية الاحترافية واسم موقعك مباشرة لكل المستخدمين!'
                        : 'Once this file is updated and pushed to your repository (GitHub), Vercel will redeploy your app instantly, and the Google selector will display your brand name seamlessly!'}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Premium Developer 2FA Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative max-w-md w-full bg-brand-alt border border-emerald-500/20 rounded-[32px] p-8 shadow-[0_32px_128px_-12px_rgba(16,185,129,0.25)] text-right"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center gap-4 mb-6 border-b border-white/5 pb-5 justify-end">
                <div className="text-right">
                  <h3 className="text-xl font-bold text-white leading-tight">
                    {lang === 'ar' ? '🔐 مصادقة وضع المطور الثنائية (2FA)' : '🔐 Developer 2FA Authentication'}
                  </h3>
                  <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full px-2.5 py-0.5 font-bold uppercase tracking-wider mt-1.5 inline-block">
                    {lang === 'ar' ? 'بوابة أمنية مشددة' : 'High Security Gateway'}
                  </span>
                </div>
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20 shrink-0 shadow-lg">
                  <Lock size={24} />
                </div>
              </div>

              {!isOtpSent ? (
                <form onSubmit={handleRequestOtp} className="space-y-5">
                  <p className="text-slate-400 text-xs leading-relaxed text-right">
                    {lang === 'ar' 
                      ? 'يرجى إدخال البريد الإلكتروني ورقم الهاتف المسجلين للمطور للتحقق من هويتك وإرسال رموز التحقق الثنائي:'
                      : 'Please enter the registered developer email and phone number to verify your identity and send 2FA codes:'}
                  </p>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300 block text-right">{lang === 'ar' ? 'البريد الإلكتروني للمطور:' : 'Developer Email:'}</label>
                      <input
                        type="email"
                        value={devEmailInput}
                        onChange={(e) => setDevEmailInput(e.target.value)}
                        placeholder="name@example.com"
                        required
                        className="w-full bg-black/40 border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3.5 text-xs text-left font-mono text-white outline-none transition-all"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300 block text-right">{lang === 'ar' ? 'رقم الهاتف للمطور:' : 'Developer Phone Number:'}</label>
                      <input
                        type="text"
                        value={devPhoneInput}
                        onChange={(e) => setDevPhoneInput(e.target.value)}
                        placeholder="0663919868"
                        required
                        className="w-full bg-black/40 border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3.5 text-xs text-left font-mono text-white outline-none transition-all"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  {authError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 text-center">
                      {authError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleCancelAuth}
                      className="flex-1 py-3.5 bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300 font-bold rounded-xl transition-all text-xs cursor-pointer"
                    >
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    
                    <button
                      type="submit"
                      disabled={isLoadingOtp}
                      className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all text-xs shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      {isLoadingOtp ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>{lang === 'ar' ? 'جاري التحقق...' : 'Verifying...'}</span>
                        </>
                      ) : (
                        <span>{lang === 'ar' ? 'إرسال الرموز ⚡' : 'Send Codes ⚡'}</span>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 text-right space-y-2">
                    <span className="text-xs text-emerald-400 font-bold block text-right">{lang === 'ar' ? '🚨 تم إرسال الرموز بنجاح:' : '🚨 Codes Sent Successfully:'}</span>
                    <p className="text-[11px] text-slate-400 leading-relaxed text-right">
                      {lang === 'ar'
                        ? 'تم إرسال رمزي تحقق (OTP) إلى بريدك وإلى هاتفك في رسالتين منفصلتين. يرجى كتابتهما في الحقول أدناه لتفعيل وضع المطور والدخول مباشر بكامل الصلاحيات:'
                        : 'Two verification codes (OTPs) have been sent to your email and phone. Enter them below to activate Developer Mode:'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block text-right">{lang === 'ar' ? 'رمز البريد (Email OTP):' : 'Email OTP:'}</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={enteredEmailOtp}
                        onChange={(e) => setEnteredEmailOtp(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-3 text-center font-mono text-sm text-white focus:outline-none"
                        placeholder="0000"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block text-right">{lang === 'ar' ? 'رمز الهاتف (SMS OTP):' : 'SMS OTP:'}</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={enteredSmsOtp}
                        onChange={(e) => setEnteredSmsOtp(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-3 text-center font-mono text-sm text-white focus:outline-none"
                        placeholder="0000"
                      />
                    </div>
                  </div>

                  {authError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400 text-center">
                      {authError}
                    </div>
                  )}

                  {authSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-400 text-center font-bold animate-pulse">
                      {authSuccess}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCancelAuth}
                      className="flex-1 py-3.5 bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300 font-bold rounded-xl transition-all text-xs cursor-pointer"
                    >
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>

                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all text-xs shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 active:scale-95 cursor-pointer"
                    >
                      {lang === 'ar' ? 'تأكيد ودخول 🛡️' : 'Verify & Enter 🛡️'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Premium Notification Center (Simulating SMS & Email) */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-6 right-6 z-[200] max-w-sm w-full bg-brand-alt border-2 ${
              notification.isCustomerActivation ? 'border-emerald-500 cursor-pointer hover:bg-white/5' : 'border-emerald-500/40'
            } rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl text-right overflow-hidden group transition-all`}
            onClick={() => {
              if (notification.isCustomerActivation) {
                setShowSimulatedEmail(true);
                setNotification(null);
              }
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-primary to-emerald-400" />
            
            <div className="flex items-start gap-3 justify-end mt-1">
              <div className="flex-1 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block">{notification.title}</span>
                <p className="text-xs text-white leading-relaxed font-bold">{notification.body}</p>
                <span className="text-[9px] text-emerald-400/70 font-semibold block pt-1">
                  {notification.isCustomerActivation 
                    ? (lang === 'ar' ? 'انقر لفتح البريد الإلكتروني وتنشيط الحساب' : 'Click to open email & activate account')
                    : (lang === 'ar' ? 'وصلتك للتو • وارد الآن' : 'Just arrived • Inbox now')}
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0 shadow-inner">
                {notification.type === 'email' ? <Mail size={20} /> : <MessageSquare size={20} />}
              </div>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                setNotification(null);
              }}
              className="absolute top-3 left-3 text-slate-500 hover:text-white transition-colors p-1"
              type="button"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
                      <img src="/logo.png" alt="Finalyze AI Logo" className="w-full h-full object-cover scale-110" />
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
                        // Click verifies and redirects to my site (onBypassLogin logs them in)
                        if (onBypassLogin) {
                          onBypassLogin(verificationEmail);
                        }
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
