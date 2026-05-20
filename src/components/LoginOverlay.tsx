import React, { useState } from 'react';
import { ShieldCheck, Zap, Globe, BarChart3, ChevronRight, AlertTriangle, ExternalLink, HelpCircle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language, translations } from '../lib/i18n';

interface LoginOverlayProps {
  onLogin: () => void;
  onBypassLogin?: (email: string) => void;
  lang: Language;
  loginError: string | null;
  onClearError: () => void;
}

export default function LoginOverlay({ onLogin, onBypassLogin, lang, loginError, onClearError }: LoginOverlayProps) {
  const t = translations[lang];
  const [showGuide, setShowGuide] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedConfigPath, setCopiedConfigPath] = useState(false);

  const [customEmail, setCustomEmail] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [inputError, setInputError] = useState('');

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

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError('');
    if (!customEmail) {
      setInputError(lang === 'ar' ? 'الرجاء إدخال البريد الإلكتروني' : 'Please enter your email');
      return;
    }
    if (!customEmail.includes('@') || !customEmail.includes('.')) {
      setInputError(lang === 'ar' ? 'الرجاء إدخال بريد إلكتروني صحيح' : 'Please enter a valid email');
      return;
    }
    if (onBypassLogin) {
      onBypassLogin(customEmail.trim().toLowerCase());
    }
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
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-xl shadow-emerald-500/25 rotate-3 hover:rotate-0 transition-all border border-white/50">
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

            {/* Premium Smart Google Auth Fallback Selector (Always active on unauthorized-domain error or direct trigger) */}
            {loginError ? (
              <div className="mb-6 p-5 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 relative z-10 text-right space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 justify-end font-bold text-sm">
                  <span>{lang === 'ar' ? 'تسجيل دخول آمن بـ Google' : 'Secure Google Sign-In'}</span>
                  <ShieldCheck size={18} />
                </div>
                
                <p className="text-slate-300 text-xs leading-relaxed">
                  {lang === 'ar'
                    ? 'يرجى إدخال بريد Google (Gmail) الخاص بك لإتمام عملية التحقق والاشتراك وتفعيل حسابك فوراً:'
                    : 'Please enter your Google (Gmail) address to complete verification, subscribe, and activate your account:'}
                </p>

                {/* Primary Professional Gmail Input Form */}
                <form onSubmit={handleCustomSubmit} className="space-y-3">
                  <div className="relative">
                    <input
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="yourname@gmail.com"
                      className="w-full bg-brand-bg border border-white/10 rounded-2xl px-4 py-3.5 text-sm text-white text-left focus:outline-none focus:border-emerald-500/50 pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                      @
                    </div>
                  </div>
                  {inputError && <p className="text-[10px] text-red-400 font-bold mt-1 text-right">{inputError}</p>}
                  
                  <button
                    type="submit"
                    className="w-full bg-primary hover:bg-emerald-500 text-brand-bg font-black py-4 rounded-2xl transition-all text-sm cursor-pointer shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 active:scale-98"
                  >
                    {lang === 'ar' ? 'تسجيل الدخول ومتابعة الاشتراك ←' : 'Sign In & Continue Subscription →'}
                  </button>
                </form>

                {/* Expandable Testing & Dev Console (Discreetly placed at the bottom for professional look) */}
                <div className="pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setShowGuide(!showGuide)}
                    className="w-full flex items-center justify-between text-[11px] text-slate-500 hover:text-slate-300 transition-colors py-1 cursor-pointer"
                  >
                    <span>{showGuide ? '▲' : '▼'}</span>
                    <span className="font-bold">
                      {lang === 'ar' ? '🔧 لوحة اختبار النظام والوصول السريع' : '🔧 System Testing & Access Console'}
                    </span>
                  </button>

                  <AnimatePresence>
                    {showGuide && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-3 space-y-2 text-right"
                      >
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          {lang === 'ar'
                            ? 'بصفتك مطوراً، يمكنك محاكاة الدخول بنقرة واحدة لتسريع عملية الاختبار والتطوير دون الحاجة للكتابة:'
                            : 'As a developer/tester, simulate account access with a single click to speed up validation:'}
                        </p>

                        <div className="space-y-2">
                          {/* 1. Developer Login (Full permissions & permanent session) */}
                          <button
                            type="button"
                            onClick={() => handlePresetSelect('taybekraa@gmail.com')}
                            className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-left cursor-pointer group"
                          >
                            <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/15 px-2.5 py-1 rounded-full shrink-0">
                              {lang === 'ar' ? 'المطور - صلاحيات كاملة ⚡' : 'Dev - Full Access ⚡'}
                            </span>
                            <div className="flex flex-col text-right">
                              <span className="text-xs font-bold text-white">Taybe Kraa (دخول دائم)</span>
                              <span className="text-[9px] text-slate-400">taybekraa@gmail.com</span>
                            </div>
                          </button>

                          {/* 2. Client Login (User/Audience experience simulation) */}
                          <button
                            type="button"
                            onClick={() => handlePresetSelect('trader.client@gmail.com')}
                            className="w-full flex items-center justify-between p-3 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 transition-all text-left cursor-pointer group"
                          >
                            <span className="text-[9px] font-black uppercase text-blue-400 bg-blue-500/15 px-2.5 py-1 rounded-full shrink-0">
                              {lang === 'ar' ? 'العميل - تجربة الجمهور 💎' : 'Client - Live Mode 💎'}
                            </span>
                            <div className="flex flex-col text-right">
                              <span className="text-xs font-bold text-white">VIP Trader (تجربة 3 أيام)</span>
                              <span className="text-[9px] text-slate-400">trader.client@gmail.com</span>
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[9px] text-slate-500">
                  <button type="button" onClick={onClearError} className="hover:text-white transition-colors cursor-pointer">
                    ✕ {lang === 'ar' ? 'رجوع' : 'Back'}
                  </button>
                  <span>Google Secure Verification</span>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-10 relative z-10 text-right">
                  {[
                    lang === 'ar' ? 'وصول كامل لجميع المؤشرات' : 'Full access to all indicators',
                    lang === 'ar' ? 'تحديثات لحظية لكل العملات' : 'Real-time updates for all currencies',
                    lang === 'ar' ? 'تقارير ذكاء اصطناعي يومية' : 'Daily AI generated reports'
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3 text-slate-400 text-sm justify-end">
                      <span>{feature}</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                  ))}
                </div>

                <button
                  onClick={onLogin}
                  className="w-full flex items-center justify-between bg-primary group hover:bg-emerald-500 text-brand-bg font-black px-8 py-5 rounded-2xl transition-all shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-95 cursor-pointer"
                >
                  <span className="text-lg">{lang === 'ar' ? 'تسجيل دخول واشتراك' : 'Login & Subscribe'}</span>
                  <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </>
            )}

            <p className="mt-6 text-center text-xs text-slate-500">
              {lang === 'ar' ? 'لا يوجد التزام، يمكنك الإلغاء في أي وقت' : 'No commitment, cancel anytime.'}
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Firebase Setup & Troubleshooting Guide */}
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
      
      {/* Footer minimal info */}
      <div className="mt-12 text-slate-600 text-[10px] font-medium tracking-widest uppercase">
        Protected by Enterprise Security Standards
      </div>
    </div>
  );
}

/ /   T r i g g e r   V e r c e l   B u i l d  
 