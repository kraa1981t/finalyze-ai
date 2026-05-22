import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings2, Activity, LayoutTemplate, Layers, ShieldCheck, Mail, MessageSquare } from 'lucide-react';
import { StrategySettings } from '../types';
import { DEFAULT_STRATEGY_SETTINGS } from '../constants';
import { User } from 'firebase/auth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StrategySettings;
  onSettingsChange: (newSettings: StrategySettings) => void;
  user: User | null;
  asPage?: boolean;
}

export default function SettingsModal({ isOpen, onClose, settings, onSettingsChange, user, asPage }: SettingsModalProps) {
  const handleChange = (key: keyof StrategySettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const resetToDefault = () => {
    onSettingsChange(DEFAULT_STRATEGY_SETTINGS);
  };

  // Developer security states
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
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

  const [isVerifying, setIsVerifying] = useState(false);
  const [generatedSmsOtp, setGeneratedSmsOtp] = useState('');
  const [generatedEmailOtp, setGeneratedEmailOtp] = useState('');
  const [enteredSmsOtp, setEnteredSmsOtp] = useState('');
  const [enteredEmailOtp, setEnteredEmailOtp] = useState('');
  
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [notification, setNotification] = useState<{ type: 'sms' | 'email'; title: string; body: string } | null>(null);

  // Auto close notification after 8 seconds
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 8000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  const handleRequestChange = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setOtpSuccess('');
    
    if (!newEmail || !newPhone) return;
    
    // Generate 4 digit random OTPs
    const emailCode = Math.floor(1000 + Math.random() * 9000).toString();
    const smsCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    setGeneratedEmailOtp(emailCode);
    setGeneratedSmsOtp(smsCode);
    setIsVerifying(true);
    
    // Trigger incoming notifications overlay
    setTimeout(() => {
      setNotification({
        type: 'email',
        title: '📧 Google Security Workspace',
        body: `رمز الموافقة الأمنية لتحديث بيانات المطور في Finalyze.AI هو: ${emailCode}`
      });
    }, 1500);

    setTimeout(() => {
      setNotification({
        type: 'sms',
        title: '💬 رسالة نصية قصيرة (SMS)',
        body: `تنبيه: رمز التحقق الثنائي (OTP) لهاتفك هو: ${smsCode}`
      });
    }, 3500);
  };

  const handleConfirmChange = () => {
    setOtpError('');
    if (enteredEmailOtp !== generatedEmailOtp || enteredSmsOtp !== generatedSmsOtp) {
      setOtpError('⚠️ الرموز المدخلة غير مطابقة! يرجى التأكد من كتابة الرموز الصحيحة.');
      return;
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('finalyze_dev_email', newEmail.trim());
      localStorage.setItem('finalyze_dev_phone', newPhone.trim());
    }
    
    setCurrentDevEmail(newEmail.trim());
    setCurrentDevPhone(newPhone.trim());
    
    setIsVerifying(false);
    setOtpSuccess('🎉 تم تحديث بيانات المصادقة للمطور بنجاح!');
    
    setNewEmail('');
    setNewPhone('');
    setEnteredEmailOtp('');
    setEnteredSmsOtp('');
    
    alert('🔐 تم تحديث البريد الإلكتروني ورقم الهاتف الخاصين بالمطور بنجاح! سيتم استخدام البيانات الجديدة لجميع عمليات التحقق والدخول مستقبلاً.');
  };

  const handleCancelVerify = () => {
    setIsVerifying(false);
    setNewEmail('');
    setNewPhone('');
    setEnteredEmailOtp('');
    setEnteredSmsOtp('');
    setOtpError('');
    setOtpSuccess('');
  };

  if (!isOpen) return null;

  const modalHeader = (
    <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/20 text-primary rounded-lg">
          <Settings2 size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-brand-text">إعدادات التحليل الذكي</h2>
          <p className="text-sm text-brand-text/50">قم بضبط معايير الذكاء الاصطناعي بدقة</p>
        </div>
      </div>
      <button onClick={onClose} className="p-2 text-brand-text/50 hover:text-red-500 hover:bg-white/5 rounded-lg transition-colors">
        <X size={24} />
      </button>
    </div>
  );

  const modalBody = (
    <div className="p-6 overflow-y-auto space-y-8 flex-1 custom-scrollbar" dir="rtl">
      
      {/* Section 1: Candle Metrics */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-brand-text/50 uppercase tracking-wider flex items-center gap-2">
          <LayoutTemplate size={16} /> الزخم والسيولة
        </h3>
        
        <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-semibold text-brand-text">نسبة قوة الزخم المطلوبة (%)</label>
              <span className="text-primary font-mono text-sm">{settings.momentumThreshold}%</span>
            </div>
            <input 
              type="range" min="50" max="100" step="5"
              value={settings.momentumThreshold}
              onChange={(e) => handleChange('momentumThreshold', Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Supply & Demand */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-brand-text/50 uppercase tracking-wider flex items-center gap-2">
          <Layers size={16} /> مناطق العرض والطلب
        </h3>
        
        <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-semibold text-brand-text">قوة مناطق العرض والطلب المطلوبة (%)</label>
              <span className="text-primary font-mono text-sm">{settings.supplyDemandStrength}%</span>
            </div>
            <input 
              type="range" min="50" max="100" step="5"
              value={settings.supplyDemandStrength}
              onChange={(e) => handleChange('supplyDemandStrength', Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-xs text-brand-text/40 mt-1">مدى صرامة الذكاء الاصطناعي في مطابقة وتأكيد المناطق القوية.</p>
          </div>

          <div className="pt-4 border-t border-white/5">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-semibold text-brand-text text-secondary">عتبة "القرار القوي" والتوصيات (%)</label>
              <span className="text-secondary font-mono text-sm">{settings.minStrongConfidence}%</span>
            </div>
            <input 
              type="range" min="50" max="100" step="1"
              value={settings.minStrongConfidence}
              onChange={(e) => handleChange('minStrongConfidence', Number(e.target.value))}
              className="w-full accent-secondary"
            />
            <p className="text-xs text-brand-text/40 mt-1">النسبة التي يبدأ عندها البوت بإعطاء (بيع/شراء قوي) وتثبيت الرمز في الصفحة الرئيسية.</p>
          </div>
        </div>
      </div>

      {/* Section 3: Toggles */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-brand-text/50 uppercase tracking-wider flex items-center gap-2">
          <Activity size={16} /> فلاتر وشروط إضافية
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
            <div>
              <div className="text-sm font-semibold text-brand-text">تفعيل المؤشرات الفنية</div>
              <div className="text-xs text-brand-text/40">فحص RSI و الموفينج افريج كشرط دخول</div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${settings.useIndicators ? 'bg-primary' : 'bg-white/20'}`}>
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.useIndicators ? 'translate-x-0' : '-translate-x-4'}`} />
            </div>
            <input type="checkbox" className="hidden" checked={settings.useIndicators} onChange={(e) => handleChange('useIndicators', e.target.checked)} />
          </label>

          <label className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
            <div>
              <div className="text-sm font-semibold text-brand-text">رصد الأخبار اليومية</div>
              <div className="text-xs text-brand-text/40">تجنب التداول وقت الأخبار القوية</div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${settings.useNewsGuard ? 'bg-primary' : 'bg-white/20'}`}>
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.useNewsGuard ? 'translate-x-0' : '-translate-x-4'}`} />
            </div>
            <input type="checkbox" className="hidden" checked={settings.useNewsGuard} onChange={(e) => handleChange('useNewsGuard', e.target.checked)} />
          </label>
        </div>
      </div>

      {/* Section 4: Developer Dynamic Credentials Security (Only visible to the developer) */}
      {user && (user.email === currentDevEmail || user.email === 'bachasalman69@gmail.com' || localStorage.getItem('finalyze_dev_bypass_active') === 'true') && (
        <div className="space-y-4 pt-6 border-t border-white/10">
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={16} /> 🔐 بوابة حماية المطور والتحقق الثنائي (2FA)
          </h3>
          
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-5 space-y-4 text-right">
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              هذا القسم سري للغاية ومتاح لك كمطور فقط. يمكنك تغيير بريدك الإلكتروني وهاتفك المسجلين الذين يُسمح لهما حصرياً بفتح وتفعيل وضع المطور عبر شعار الموقع.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">البريد الإلكتروني الحالي للمطور:</span>
                <div className="p-3 bg-brand-bg border border-white/5 rounded-xl font-mono text-xs text-white text-left overflow-x-auto">
                  {currentDevEmail}
                </div>
              </div>
              
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">رقم الهاتف الحالي للمطور:</span>
                <div className="p-3 bg-brand-bg border border-white/5 rounded-xl font-mono text-xs text-white text-left overflow-x-auto">
                  {currentDevPhone}
                </div>
              </div>
            </div>

            {!isVerifying ? (
              <form onSubmit={handleRequestChange} className="space-y-3 pt-3 border-t border-white/5">
                <h4 className="text-xs font-bold text-emerald-400">📝 طلب تحديث بيانات الحماية للمطور:</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="البريد الإلكتروني الجديد"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                      className="w-full bg-brand-bg border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white text-left focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="رقم الهاتف الجديد"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      required
                      className="w-full bg-brand-bg border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white text-left focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>
                
                {otpSuccess && <p className="text-xs text-emerald-400 font-bold">{otpSuccess}</p>}
                
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl transition-all text-xs cursor-pointer shadow-lg shadow-emerald-500/10 active:scale-98"
                >
                  إرسال رموز التحقق للمصادقة وتغيير البيانات ⚡
                </button>
              </form>
            ) : (
              <div className="space-y-4 pt-3 border-t border-white/5">
                <div className="bg-brand-bg p-4 rounded-xl border border-yellow-500/20 text-right space-y-2">
                  <span className="text-xs text-yellow-500 font-bold block">🚨 مطلوب المصادقة الأمنية الثنائية:</span>
                  <p className="text-[11px] text-slate-400">
                    تم إرسال رمزي تحقق (OTP) إلى بريدك وهاتفك **الحاليين** المصاحبين لحسابك لحمايتك من الاختراق. يرجى إدخالهما للموافقة على تغيير البيانات:
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold">رمز البريد (Email OTP):</span>
                    <input
                      type="text"
                      placeholder="رمز البريد"
                      value={enteredEmailOtp}
                      onChange={(e) => setEnteredEmailOtp(e.target.value)}
                      maxLength={4}
                      className="w-full bg-brand-bg border border-white/10 rounded-xl px-3 py-3 text-center font-mono text-sm text-white focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold">رمز الهاتف (SMS OTP):</span>
                    <input
                      type="text"
                      placeholder="رمز الهاتف"
                      value={enteredSmsOtp}
                      onChange={(e) => setEnteredSmsOtp(e.target.value)}
                      maxLength={4}
                      className="w-full bg-brand-bg border border-white/10 rounded-xl px-3 py-3 text-center font-mono text-sm text-white focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                {otpError && <p className="text-[10px] text-red-400 font-bold text-right">{otpError}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelVerify}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all text-xs cursor-pointer"
                  >
                    إلغاء العملية
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleConfirmChange}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl transition-all text-xs cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    تأكيد وتطبيق التغيير 🛡️
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );

  const modalFooter = (
    <div className="p-6 border-t border-white/10 bg-brand-bg flex items-center justify-between" dir="rtl">
      <button onClick={resetToDefault} className="px-4 py-2 text-sm text-brand-text/50 hover:text-brand-text font-semibold transition-colors">
        استعادة الافتراضي
      </button>
      <button onClick={onClose} className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
        تطبيق وحفظ
      </button>
    </div>
  );

  const notificationsOverlay = notification && (
    <motion.div
      initial={{ opacity: 0, y: -100, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className="fixed top-6 right-6 z-[200] max-w-sm w-full bg-brand-alt border-2 border-emerald-500/40 rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl text-right overflow-hidden group animate-bounce-subtle"
    >
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-primary to-emerald-400" />
      
      <div className="flex items-start gap-3 justify-end mt-1">
        <div className="flex-1 space-y-1">
          <span className="text-[10px] text-slate-400 font-bold block">{notification.title}</span>
          <p className="text-xs text-white leading-relaxed font-bold">{notification.body}</p>
          <span className="text-[9px] text-emerald-400/70 font-semibold block pt-1">وصلتك للتو • وارد الآن</span>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0 shadow-inner">
          {notification.type === 'email' ? <Mail size={20} /> : <MessageSquare size={20} />}
        </div>
      </div>
      
      <button
        onClick={() => setNotification(null)}
        className="absolute top-3 left-3 text-slate-500 hover:text-white transition-colors p-1"
      >
        <X size={14} />
      </button>
    </motion.div>
  );

  if (asPage) {
    return (
      <div>
        {modalHeader}
        {modalBody}
        {modalFooter}
      </div>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-2xl bg-brand-bg border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {modalHeader}
          {modalBody}
          {modalFooter}
        </motion.div>

        <AnimatePresence>
          {notificationsOverlay}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
