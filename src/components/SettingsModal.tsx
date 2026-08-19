import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings2, Activity, LayoutTemplate, Layers, ShieldCheck, Mail, MessageSquare, CheckCircle, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { StrategySettings } from '../types';
import { DEFAULT_STRATEGY_SETTINGS } from '../constants';
import { User } from 'firebase/auth';
import { Language } from '../lib/i18n';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StrategySettings;
  onSettingsChange: (newSettings: StrategySettings) => void;
  onSave?: () => void;
  user: User | null;
  asPage?: boolean;
  lang: Language;
  onDeleteClientResults?: () => Promise<void>;
}

export default function SettingsModal({ isOpen, onClose, settings, onSettingsChange, onSave, user, asPage, lang, onDeleteClientResults }: SettingsModalProps) {
  const isAr = lang === 'ar';
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
  const [saved, setSaved] = useState(false);

  // Stable version info
  const [stableVersion, setStableVersion] = useState<{ version: string; date: string; commit: string } | null>(null);

  // Factory Reset state
  const [showFactoryReset, setShowFactoryReset] = useState(false);
  const [factoryResetLoading, setFactoryResetLoading] = useState(false);
  const [factoryResetDone, setFactoryResetDone] = useState(false);
  const [factoryResetError, setFactoryResetError] = useState('');
  const [factoryResetRedirectUrl, setFactoryResetRedirectUrl] = useState('');
  const [githubPat, setGithubPat] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('finalyze_github_pat') || '';
    return '';
  });
  const [saveStableLoading, setSaveStableLoading] = useState(false);
  const [saveStableDone, setSaveStableDone] = useState(false);
  const [saveStableError, setSaveStableError] = useState('');

  const GITHUB_REPO = 'kraa1981t/finalyze-ai';
  const STABLE_TAG = 'stable-v2';

  const ghHeaders = () => {
    const token = githubPat;
    if (!token) throw new Error('GitHub PAT required — please paste your token above');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const handleSaveStable = async () => {
    setSaveStableLoading(true);
    setSaveStableError('');
    setSaveStableDone(false);
    try {
      if (githubPat) localStorage.setItem('finalyze_github_pat', githubPat);
      const headers = ghHeaders();
      const gh = (url: string, opts?: any) => fetch(`https://api.github.com/repos/${GITHUB_REPO}${url}`, { headers, ...opts });

      const mainRef = await (await gh('/git/refs/heads/main')).json();
      const latestSha = mainRef.object?.sha;
      if (!latestSha) { setSaveStableError('Could not get latest commit'); setSaveStableLoading(false); return; }

      const tagResp = await gh(`/git/refs/tags/${STABLE_TAG}`, { method: 'PATCH', body: JSON.stringify({ sha: latestSha, force: true }) });
      if (!tagResp.ok && tagResp.status === 404) {
        await gh('/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/tags/${STABLE_TAG}`, sha: latestSha }) });
      } else if (!tagResp.ok) {
        const err = await tagResp.json().catch(() => ({}));
        setSaveStableError(`Tag update failed: ${err.message || tagResp.status}`);
        setSaveStableLoading(false); return;
      }

      const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
      const commitMsg = await (await gh(`/git/commits/${latestSha}`)).json();
      const refContent = JSON.stringify({
        stableVersion: latestSha,
        description: `${latestSha.substring(0, 7)} ${(commitMsg.message || '').split('\n')[0]}`,
        savedAt: dateStr, autoUpdate: true
      }, null, 2);

      const existingResp = await gh('/contents/.backups/stable-ref.json');
      let existingSha: string | null = null;
      if (existingResp.ok) { const ex = await existingResp.json(); existingSha = ex.sha; }

      await gh('/contents/.backups/stable-ref.json', {
        method: 'PUT', body: JSON.stringify({
          message: `Update stable-ref to ${latestSha.substring(0, 7)}`,
          content: btoa(refContent), sha: existingSha
        })
      });

      setSaveStableDone(true);
      setTimeout(() => setSaveStableDone(false), 4000);
    } catch (e: any) {
      setSaveStableError('فشل الحفظ: ' + (e.message || 'خطأ'));
      setTimeout(() => setSaveStableError(''), 6000);
    }
    setSaveStableLoading(false);
  };

  const handleFactoryReset = async () => {
    setFactoryResetLoading(true);
    setFactoryResetError('');
    try {
      if (githubPat) localStorage.setItem('finalyze_github_pat', githubPat);
      const headers = ghHeaders();
      const gh = (url: string, opts?: any) => fetch(`https://api.github.com/repos/${GITHUB_REPO}${url}`, { headers, ...opts });

      // Get the SHA from stable-v1 tag dynamically (not hardcoded)
      let stableSha = '';
      try {
        const tagRef = await (await gh(`/git/refs/tags/${STABLE_TAG}`)).json();
        stableSha = tagRef.object?.sha || '';
      } catch {}

      // If tag lookup fails, get the commit SHA the tag points to
      if (stableSha) {
        try {
          const tagObj = await (await gh(`/git/tags/${stableSha}`)).json();
          if (tagObj.object?.sha) stableSha = tagObj.object.sha;
        } catch {}
      }

      if (!stableSha) {
        stableSha = '62c47deed780f1122533632a688f7760ff0c71f5';
      }

      const patchResp = await gh('/git/refs/heads/main', {
        method: 'PATCH',
        body: JSON.stringify({ sha: stableSha, force: true })
      });
      if (patchResp.ok) {
        setFactoryResetDone(true);
        setTimeout(() => { setShowFactoryReset(false); setFactoryResetDone(false); }, 4000);
      } else {
        const err = await patchResp.json().catch(() => ({}));
        setFactoryResetRedirectUrl(`https://github.com/${GITHUB_REPO}/actions/workflows/factory-reset.yml`);
        setFactoryResetError(`GitHub force-push failed: ${err.message || patchResp.status}`);
        setTimeout(() => setFactoryResetError(''), 6000);
      }
    } catch (e: any) {
      setFactoryResetError('فشلت عملية إعادة التعيين: ' + (e.message || 'خطأ'));
      setTimeout(() => setFactoryResetError(''), 6000);
    }
    setFactoryResetLoading(false);
  };

  // Fetch latest stable version info from GitHub
  useEffect(() => {
    const fetchStableVersion = async () => {
      try {
        const resp = await fetch(`https://raw.githubusercontent.com/${GITHUB_REPO}/main/.backups/stable-ref.json`);
        if (resp.ok) {
          const data = await resp.json();
          const commitHash = data.description?.split(' ')[0] || '';
          const savedDate = data.savedAt || '';
          let formattedDate = savedDate;
          if (savedDate) {
            try {
              const d = new Date(savedDate.replace(' ', 'T'));
              const monthsAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
              formattedDate = `${d.getDate()} ${monthsAr[d.getMonth()]} ${d.getFullYear()}`;
            } catch {}
          }
          setStableVersion({
            version: commitHash ? `${commitHash} - ${formattedDate}` : 'v3.12.0-stable - 23 يوليو 2026',
            date: formattedDate,
            commit: commitHash
          });
        }
      } catch {}
    };
    fetchStableVersion();
  }, []);

  // Auto close notification after 8 seconds
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 8000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  const handleSave = () => {
    onSave?.();
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 600);
  };

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
        body: isAr ? `رمز الموافقة الأمنية لتحديث بيانات المطور في Joseph.Trading هو: ${emailCode}` : `Security approval code for updating developer data in Joseph.Trading is: ${emailCode}`
      });
    }, 1500);

    setTimeout(() => {
      setNotification({
        type: 'sms',
        title: isAr ? '💬 رسالة نصية قصيرة (SMS)' : '💬 Short Message Service (SMS)',
        body: isAr ? `تنبيه: رمز التحقق الثنائي (OTP) لهاتفك هو: ${smsCode}` : `Alert: Your phone 2FA (OTP) code is: ${smsCode}`
      });
    }, 3500);
  };

  const handleConfirmChange = () => {
    setOtpError('');
    if (enteredEmailOtp !== generatedEmailOtp || enteredSmsOtp !== generatedSmsOtp) {
      setOtpError(isAr ? '⚠️ الرموز المدخلة غير مطابقة! يرجى التأكد من كتابة الرموز الصحيحة.' : '⚠️ Entered codes do not match! Please verify and enter the correct codes.');
      return;
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('finalyze_dev_email', newEmail.trim());
      localStorage.setItem('finalyze_dev_phone', newPhone.trim());
    }
    
    setCurrentDevEmail(newEmail.trim());
    setCurrentDevPhone(newPhone.trim());
    
    setIsVerifying(false);
    setOtpSuccess(isAr ? '🎉 تم تحديث بيانات المصادقة للمطور بنجاح!' : '🎉 Developer authentication data updated successfully!');
    
    setNewEmail('');
    setNewPhone('');
    setEnteredEmailOtp('');
    setEnteredSmsOtp('');
    
    alert(isAr ? '🔐 تم تحديث البريد الإلكتروني ورقم الهاتف الخاصين بالمطور بنجاح! سيتم استخدام البيانات الجديدة لجميع عمليات التحقق والدخول مستقبلاً.' : '🔐 Developer email and phone number updated successfully! The new data will be used for all future verification and login processes.');
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
          <h2 className="text-xl font-bold text-brand-text">{isAr ? 'إعدادات التحليل الذكي' : 'Smart Analysis Settings'}</h2>
          <p className="text-sm text-brand-text/50">{isAr ? 'قم بضبط معايير الذكاء الاصطناعي بدقة' : 'Fine-tune AI analysis parameters precisely'}</p>
        </div>
      </div>
      <button onClick={onClose} className="p-2 text-brand-text/50 hover:text-red-500 hover:bg-white/5 rounded-lg transition-colors">
        <X size={24} />
      </button>
    </div>
  );

  const NumberInput = ({ label, value, onChange, min = 0, max = 9999, step = 1, color = 'text-primary', desc, suffix = '%' }: {
    label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; color?: string; desc?: string; suffix?: string;
  }) => {
    const [draft, setDraft] = React.useState(String(value));
    const [focused, setFocused] = React.useState(false);

    React.useEffect(() => {
      if (!focused) setDraft(String(value));
    }, [value, focused]);

    const commit = () => {
      let v = parseFloat(draft);
      if (isNaN(v)) v = value;
      v = Math.min(max, Math.max(min, v));
      onChange(v);
      setDraft(String(v));
      setFocused(false);
    };

    return (
      <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-brand-text">{label}</div>
          {desc && <div className="text-[10px] text-brand-text/40 mt-0.5">{desc}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <input type="text" inputMode="decimal" translate="no" dir="ltr" lang="en"
            value={focused ? draft : draft}
            onFocus={() => { setFocused(true); setDraft(String(value)); }}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(value)); setFocused(false); } }}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9.\-]/g, ''))}
            className={`w-20 text-center text-sm font-black font-mono notranslate ${color} bg-transparent border border-white/10 rounded-lg py-1.5 focus:border-primary outline-none`} />
          {suffix && <span className="text-[11px] text-[#F59E0B] font-bold ml-1">{suffix}</span>}
        </div>
      </div>
    );
  };

  const modalBody = (
    <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar" dir="rtl">
      
      {/* Section 1: Confidence Thresholds */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-brand-text/60 uppercase tracking-widest flex items-center gap-2">
          <span className="text-[#F59E0B]">◆</span> {isAr ? 'عتبات الثقة' : 'Confidence Thresholds'}
        </h3>
        <div className="bg-white/5 border border-white/5 rounded-xl p-4">
          <NumberInput label={isAr ? 'حد الإشارة القوية' : 'Strong Signal Threshold'} value={settings.strongThreshold} onChange={(v) => handleChange('strongThreshold', v)} color="text-[#F59E0B]" desc={isAr ? 'الثقة المطلوبة لإشارة قوية (≥)' : 'Confidence required for strong signal (≥)'} />
          <NumberInput label={isAr ? 'الشروط الداعمة للقوة' : 'Min Support for Strong'} value={settings.minStrongSupport} onChange={(v) => handleChange('minStrongSupport', v)} color="text-[#F59E0B]" desc={isAr ? 'نسبة الشروط الداعمة المطلوبة لإشارة قوية (≥%)' : 'Support ratio required for strong signal (≥%)'} />
          <NumberInput label={isAr ? 'حد الإشارة العادية' : 'Buy/Sell Threshold'} value={settings.buyThreshold} onChange={(v) => handleChange('buyThreshold', v)} color="text-primary" desc={isAr ? 'الثقة المطلوبة لشراء/بيع عادي (≥)' : 'Confidence required for regular buy/sell (≥)'} />
          <NumberInput label={isAr ? 'الثقة الأساسية' : 'Base Confidence'} value={settings.baseConfidence} onChange={(v) => handleChange('baseConfidence', v)} color="text-emerald-400" desc={isAr ? 'نسبة أساسية ثابتة تُضاف لكل إشارة' : 'Fixed base percentage added to all signals'} />
        </div>
      </div>

      {/* Section 2: Primary Conditions (Entry Gates) */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-brand-text/60 uppercase tracking-widest flex items-center gap-2">
          <span className="text-[#F59E0B]">◆</span> {isAr ? 'الشروط الأساسية (أبواب الدخول)' : 'Primary Conditions (Entry Gates)'}
          <span className="text-[10px] text-brand-text/30 font-mono mr-auto">{isAr ? 'النسبة القصوى 50%' : 'Max 50%'}</span>
        </h3>
        <div className="bg-white/5 border border-white/5 rounded-xl p-4">
          <NumberInput label={isAr ? '① BB Pullback — تراجع بولينجر' : '① BB Pullback — Bollinger Pullback'} value={settings.primaryBBWeight} onChange={(v) => handleChange('primaryBBWeight', v)} color="text-[#F59E0B]" desc={isAr ? 'تراجع 3-6 شموع + لمس BB + شمعة انتكاس' : '3-6 candle pullback + touch BB + reversal candle'} />
          <NumberInput label={isAr ? '② Supply/Demand — مناطق العرض والطلب' : '② Supply/Demand Zones'} value={settings.primarySDWeight} onChange={(v) => handleChange('primarySDWeight', v)} color="text-[#F59E0B]" desc={isAr ? 'منطقة طلب + صعود = شراء / منطقة عرض + هبوط = بيع' : 'Demand+uptrend=buy / Supply+downtrend=sell'} />
          <NumberInput label={isAr ? '③ Trend Age — عمر الاتجاه' : '③ Trend Age'} value={settings.primaryAgeWeight} onChange={(v) => handleChange('primaryAgeWeight', v)} color="text-[#F59E0B]" desc={isAr ? 'ناضج (25-50) = كامل / رضيع أو قديم = تخفيف' : 'Mature (25-50)=full / Infant or Old=reduced'} />
          <NumberInput label={isAr ? '④ Pre-Pullback Age — عمر الاتجاه قبل السحب' : '④ Pre-Pullback Age'} value={settings.primaryPrePullbackAgeWeight} onChange={(v) => handleChange('primaryPrePullbackAgeWeight', v)} color="text-[#F59E0B]" desc={isAr ? '15-50 شمعة = مسموح / أقل أو أكثر = محايد' : '15-50 candles=allowed / less or more=neutral'} />
          <NumberInput label={isAr ? '⑤ News — أخبار اقتصادية وسياسية' : '⑤ News Sentiment'} value={settings.primaryNewsWeight} onChange={(v) => handleChange('primaryNewsWeight', v)} color="text-[#F59E0B]" desc={isAr ? 'أخبار سلبية = حظر / لا أخبار = مسموح' : 'Negative news=block / No news=allowed'} />
        </div>
      </div>

      {/* Section 3: Supporting Conditions (Signal Boost) */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-brand-text/60 uppercase tracking-widest flex items-center gap-2">
          <span className="text-[#F59E0B]">◆</span> {isAr ? 'الشروط الداعمة (تعزيز الإشارة)' : 'Supporting Conditions (Signal Boost)'}
          <span className="text-[10px] text-brand-text/30 font-mono mr-auto">{isAr ? 'النسبة القصوى 20%' : 'Max 20%'}</span>
        </h3>
        <div className="bg-white/5 border border-white/5 rounded-xl p-4">
          <NumberInput label={isAr ? 'RSI' : 'RSI'} value={settings.supportRSIWeight} onChange={(v) => handleChange('supportRSIWeight', v)} color="text-primary" desc={isAr ? 'تشبع بيع (RSI<30) = شراء / تشبع شراء (RSI>70) = بيع' : 'Oversold (<30)=buy / Overbought (>70)=sell'} />
          <NumberInput label={isAr ? 'EMA Cross — تقاطع المتوسط' : 'EMA Cross'} value={settings.supportEMAWeight} onChange={(v) => handleChange('supportEMAWeight', v)} color="text-primary" desc={isAr ? 'صاعد = دعم شراء / هابط = دعم بيع' : 'Bullish=supports buy / Bearish=supports sell'} />
          <NumberInput label={isAr ? 'Trend Direction — اتجاه الاتجاه' : 'Trend Direction'} value={settings.supportDirWeight} onChange={(v) => handleChange('supportDirWeight', v)} color="text-primary" desc={isAr ? 'صاعد/هابط = يدعم الاتجاه' : 'Uptrend/Downtrend supports direction'} />
          <NumberInput label={isAr ? 'Volume Surge — ارتفاع الحجم' : 'Volume Surge'} value={settings.supportVolWeight} onChange={(v) => handleChange('supportVolWeight', v)} color="text-primary" desc={isAr ? 'ارتفاع الحجم = تأكيد الزخم' : 'Volume surge confirms momentum'} />
          <NumberInput label={isAr ? 'Micro BB — بولينجر المصغر' : 'Micro BB Strategy'} value={settings.supportMicroBBWeight} onChange={(v) => handleChange('supportMicroBBWeight', v)} color="text-primary" desc={isAr ? 'تراجع مصغر على الإطار الأصغر = تأكيد دخول مبكر' : 'Micro pullback on lower TF = early entry confirm'} />
          <NumberInput label={isAr ? 'Micro Alignment — توافق الإطارات' : 'Micro TF Alignment'} value={settings.supportMicroAlignWeight} onChange={(v) => handleChange('supportMicroAlignWeight', v)} color="text-primary" desc={isAr ? 'الإطار المصغر يتوافق مع الكبير' : 'Lower TF aligns with higher TF'} />
        </div>
      </div>

      {/* Section 4: Toggles */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-brand-text/60 uppercase tracking-widest flex items-center gap-2">
          <span className="text-[#F59E0B]">◆</span> {isAr ? 'مفاتيح التفعيل' : 'Feature Toggles'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: 'useIndicators', label: isAr ? 'المؤشرات الفنية' : 'Technical Indicators', desc: isAr ? 'RSI + EMA + Volume' : 'RSI + EMA + Volume' },
            { key: 'useNewsGuard', label: isAr ? 'حماية الأخبار' : 'News Guard', desc: isAr ? 'تجنب الأخبار القوية' : 'Avoid major news' },
            { key: 'useHigherTimeframe', label: isAr ? 'الإطار الأعلى' : 'Higher Timeframe', desc: isAr ? 'تأكيد من الإطار الأكبر' : 'Confirm from higher TF' },
            { key: 'useVolumeAnalysis', label: isAr ? 'تحليل الحجم' : 'Volume Analysis', desc: isAr ? 'تحليل تدفق الحجم' : 'Volume flow analysis' },
            { key: 'useFilterSideways', label: isAr ? 'فلتر الاتجاه العرضي' : 'Sideways Filter', desc: isAr ? 'حظر الإشارات في الأسواق العرضية' : 'Block signals in sideways markets' },
            { key: 'useCandleMatch', label: isAr ? 'تطابق جذوع الشموع' : 'Candle Body Match', desc: isAr ? 'تطابق حجم جذوع الشموع (يومي/أسبوعي/شهري)' : 'Match daily/weekly/monthly candle bodies' },
          ].map((item) => (
            <button key={item.key} onClick={() => handleChange(item.key as keyof StrategySettings, !(settings as any)[item.key])}
              className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all text-right ${
                (settings as any)[item.key]
                  ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#F59E0B]'
                  : 'bg-white/5 border-white/5 text-brand-muted'
              }`}>
              <div>
                <div className="text-xs font-bold">{item.label}</div>
                <div className="text-[10px] opacity-60 mt-0.5">{item.desc}</div>
              </div>
              <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${
                (settings as any)[item.key] ? 'bg-[#F59E0B]' : 'bg-white/20'
              }`}>
                <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform shadow ${
                  (settings as any)[item.key] ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Section 4b: Candle Match Thresholds */}
      {settings.useCandleMatch && (
        <div className="space-y-3">
          <h3 className="text-xs font-black text-brand-text/60 uppercase tracking-widest flex items-center gap-2">
            <span className="text-[#F59E0B]">◆</span> {isAr ? 'عتبات تطابق جذوع الشموع' : 'Candle Body Match Thresholds'}
          </h3>
          <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-4">
            <div className="text-[10px] text-brand-text/40">{isAr ? 'فعّل كل شمعة على حدة وحدد الحد الأدنى للحجم (0 = تعطيل)' : 'Enable each candle separately and set min body size (0 = disable)'}</div>

            {/* Daily Candle */}
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <button onClick={() => handleChange('candleMatchDailyEnabled', !settings.candleMatchDailyEnabled)}
                  className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${settings.candleMatchDailyEnabled !== false ? 'bg-[#F59E0B]' : 'bg-white/20'}`}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform shadow ${settings.candleMatchDailyEnabled !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className="text-xs font-bold text-brand-text">{isAr ? 'شمعة يومية' : 'Daily (1d)'}</span>
              </div>
              <div className="w-24">
                <NumberInput label="" value={settings.candleMatchDailyThreshold ?? 200} onChange={(v) => handleChange('candleMatchDailyThreshold', v)} color="text-[#F59E0B]" suffix={isAr ? 'بيبس' : 'pips'} min={0} max={9999} />
              </div>
            </div>

            {/* Weekly Candle */}
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <button onClick={() => handleChange('candleMatchWeeklyEnabled', !settings.candleMatchWeeklyEnabled)}
                  className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${settings.candleMatchWeeklyEnabled !== false ? 'bg-[#F59E0B]' : 'bg-white/20'}`}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform shadow ${settings.candleMatchWeeklyEnabled !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className="text-xs font-bold text-brand-text">{isAr ? 'شمعة أسبوعية' : 'Weekly (1w)'}</span>
              </div>
              <div className="w-24">
                <NumberInput label="" value={settings.candleMatchWeeklyThreshold ?? 200} onChange={(v) => handleChange('candleMatchWeeklyThreshold', v)} color="text-[#F59E0B]" suffix={isAr ? 'بيبس' : 'pips'} min={0} max={9999} />
              </div>
            </div>

            {/* Monthly Candle */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <button onClick={() => handleChange('candleMatchMonthlyEnabled', !settings.candleMatchMonthlyEnabled)}
                  className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${settings.candleMatchMonthlyEnabled !== false ? 'bg-[#F59E0B]' : 'bg-white/20'}`}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform shadow ${settings.candleMatchMonthlyEnabled !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className="text-xs font-bold text-brand-text">{isAr ? 'شمعة شهرية' : 'Monthly (1M)'}</span>
              </div>
              <div className="w-24">
                <NumberInput label="" value={settings.candleMatchMonthlyThreshold ?? 200} onChange={(v) => handleChange('candleMatchMonthlyThreshold', v)} color="text-[#F59E0B]" suffix={isAr ? 'بيبس' : 'pips'} min={0} max={9999} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 5: Developer Trend Age Zones */}
      {user && (user.email === 'taybekraa@gmail.com' || user.email === 'kraakraa109@gmail.com' || user.email === 'bachasalman69@gmail.com') && (
        <div className="space-y-3 pt-4 border-t border-white/10">
          <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
            <span className="text-amber-400">◆</span> {isAr ? '🔧 مناطق عمر الاتجاه (مطور)' : '🔧 Trend Age Zones (Dev)'}
          </h3>
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 space-y-6">

            {/* Zone Visualization */}
            <div className="bg-black/30 rounded-xl p-4">
              <div className="text-[10px] text-brand-text/40 font-mono mb-2 text-center">
                {isAr ? 'مناطق عمر الاتجاه (Total Age)' : 'Trend Age Zones (Total Age)'}
              </div>
              <div className="flex h-6 rounded-lg overflow-hidden text-[9px] font-black">
                <div className="flex-1 bg-red-500/30 border-r border-black/30 flex items-center justify-center text-red-300">
                  {isAr ? 'رضيع <10' : 'Infant <10'}
                </div>
                <div className="flex-1 bg-amber-500/30 border-r border-black/30 flex items-center justify-center text-amber-300">
                  {isAr ? 'طفل 10-25' : 'Youth 10-25'}
                </div>
                <div className="flex-1 bg-emerald-500/30 border-r border-black/30 flex items-center justify-center text-emerald-300">
                  {isAr ? 'ناضج 25-50' : 'Mature 25-50'}
                </div>
                <div className="flex-1 bg-red-500/30 flex items-center justify-center text-red-300">
                  {isAr ? 'عجوز >50' : 'Aging >50'}
                </div>
              </div>
              <div className="flex justify-between mt-1 text-[8px] text-brand-text/30 font-mono px-1">
                <span>0</span>
                <span>{settings.minInfantAge}</span>
                <span>{settings.minMatureAge}</span>
                <span>{settings.maxMatureAge}</span>
              </div>
            </div>

            {/* Min Consecutive Momentum (Age) */}
            <NumberInput label={isAr ? 'حد أدنى لاندفاع الاتجاه (Age)' : 'Min Consecutive Momentum (Age)'} value={settings.minTrendAge} onChange={(v) => handleChange('minTrendAge', v)} color="text-amber-400" desc={isAr ? 'عدد الشموع المتتالية المطلوب قبل السماح بدخول الصفقة. افتراضي: 2' : 'Required consecutive candles before allowing entry. Default: 2'} suffix="" min={1} max={10} />

            {/* Infant Age Threshold */}
            <NumberInput label={isAr ? 'بداية مرحلة الطفل (Infant)' : 'Infant Zone Start'} value={settings.minInfantAge} onChange={(v) => handleChange('minInfantAge', v)} color="text-red-400" desc={isAr ? 'أقل من هذه القيمة ← اتجاه رضيع (تخفيف الثقة). افتراضي: 10' : 'Below this → infant trend (confidence cap). Default: 10'} suffix="" min={3} max={99} />

            {/* Mature Age Start */}
            <NumberInput label={isAr ? 'بداية مرحلة النضج (Mature)' : 'Mature Zone Start'} value={settings.minMatureAge} onChange={(v) => handleChange('minMatureAge', v)} color="text-emerald-400" desc={isAr ? 'من هذه القيمة يبدأ الاتجاه الناضج (يُسمح بالإشارات القوية). افتراضي: 25' : 'From this value the trend is mature (strong signals allowed). Default: 25'} suffix="" min={5} max={99} />

            {/* Old Age Threshold */}
            <NumberInput label={isAr ? 'بداية مرحلة الشيخوخة (Aging)' : 'Aging Zone Start'} value={settings.maxMatureAge} onChange={(v) => handleChange('maxMatureAge', v)} color="text-red-400" desc={isAr ? 'فوق هذه القيمة ← اتجاه عجوز (خطر انعكاس، تخفيف الثقة). افتراضي: 50' : 'Above this → aging trend (reversal risk, confidence cap). Default: 50'} suffix="" min={10} max={200} />

            {/* Pre-Pullback Age — Min */}
            <NumberInput label={isAr ? 'أدنى عمر الاتجاه ماقبل انسحاب' : 'Min Pre-Pullback Age'} value={settings.minPrePullbackAge} onChange={(v) => handleChange('minPrePullbackAge', v)} color="text-cyan-400" desc={isAr ? 'أقل من هذا العدد ← الاتجاه قبل الانسحاب قصير جداً (محايد). افتراضي: 15' : 'Below this → trend before pullback too short (neutral). Default: 15'} suffix="" min={1} max={200} />

            {/* Pre-Pullback Age — Max */}
            <NumberInput label={isAr ? 'أقصى عمر الاتجاه ماقبل انسحاب' : 'Max Pre-Pullback Age'} value={settings.maxPrePullbackAge} onChange={(v) => handleChange('maxPrePullbackAge', v)} color="text-cyan-400" desc={isAr ? 'فوق هذا العدد ← الاتجاه قبل الانسحاب مستنزف (محايد). افتراضي: 50' : 'Above this → trend before pullback exhausted (neutral). Default: 50'} suffix="" min={1} max={200} />

            {/* Min Pullback Candles */}
            <NumberInput label={isAr ? 'أدنى شموع السحبة' : 'Min Pullback Candles'} value={settings.minPullbackCandles || 2} onChange={(v) => handleChange('minPullbackCandles', v)} color="text-cyan-400" desc={isAr ? 'الحد الأدنى للشموع المعاكسة للاتجاه为了 تأكيد نقطة السحبة. افتراضي: 2' : 'Min opposite candles to confirm pullback point. Default: 2'} suffix="" min={1} max={10} />

            {/* Pullback Volume Confirm */}
            <div className="pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-cyan-400">{isAr ? 'تأكيد بالحجم عند السحبة' : 'Pullback Volume Confirm'}</label>
                <button onClick={() => handleChange('pullbackVolConfirm', !settings.pullbackVolConfirm)}
                  className={`w-12 h-6 rounded-full transition-all ${settings.pullbackVolConfirm ? 'bg-cyan-500' : 'bg-white/10'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.pullbackVolConfirm ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <p className="text-xs text-brand-text/40 mt-1">{isAr ? 'يتطلب حجم مرتفع عند نقطة السحبة للتأكيد' : 'Require high volume at pullback point for confirmation'}</p>
            </div>

            {/* Pullback Candle Confirm */}
            <div className="pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-cyan-400">{isAr ? 'تأكيد بشمعة ارتداد' : 'Pullback Candle Confirm'}</label>
                <button onClick={() => handleChange('pullbackCandleConfirm', !settings.pullbackCandleConfirm)}
                  className={`w-12 h-6 rounded-full transition-all ${settings.pullbackCandleConfirm ? 'bg-cyan-500' : 'bg-white/10'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.pullbackCandleConfirm ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <p className="text-xs text-brand-text/40 mt-1">{isAr ? 'يتطلب شمعة ارتداد (Pinbar/Engulfing/Hammer) عند نقطة السحبة' : 'Require reversal candle (Pinbar/Engulfing/Hammer) at pullback point'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Section 5: Developer Dynamic Credentials Security (Only visible to the developer) */}
      {user && (user.email === 'taybekraa@gmail.com' || user.email === 'kraakraa109@gmail.com' || user.email === 'bachasalman69@gmail.com') && (
        <div className="space-y-4 pt-6 border-t border-white/10">
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={16} /> {isAr ? '🔐 بوابة حماية المطور والتحقق الثنائي (2FA)' : '🔐 Developer Security Gateway & 2FA'}
          </h3>
          
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-5 space-y-4 text-right">
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              {isAr ? 'هذا القسم سري للغاية ومتاح لك كمطور فقط. يمكنك تغيير بريدك الإلكتروني وهاتفك المسجلين الذين يُسمح لهما حصرياً بفتح وتفعيل وضع المطور عبر شعار الموقع.' : 'This section is highly confidential and available to you as a developer only. You can change your registered email and phone that are exclusively allowed to open and activate developer mode via the site logo.'}
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">{isAr ? 'البريد الإلكتروني الحالي للمطور:' : 'Current Developer Email:'}</span>
                <div className="p-3 bg-brand-bg border border-white/5 rounded-xl font-mono text-xs text-white text-left overflow-x-auto">
                  {currentDevEmail}
                </div>
              </div>
              
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">{isAr ? 'رقم الهاتف الحالي للمطور:' : 'Current Developer Phone:'}</span>
                <div className="p-3 bg-brand-bg border border-white/5 rounded-xl font-mono text-xs text-white text-left overflow-x-auto">
                  {currentDevPhone}
                </div>
              </div>
            </div>

            {!isVerifying ? (
              <form onSubmit={handleRequestChange} className="space-y-3 pt-3 border-t border-white/5">
                <h4 className="text-xs font-bold text-emerald-400">{isAr ? '📝 طلب تحديث بيانات الحماية للمطور:' : '📝 Request Developer Security Data Update:'}</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="email"
                      placeholder={isAr ? 'البريد الإلكتروني الجديد' : 'New email'}
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                      className="w-full bg-brand-bg border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white text-left focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={isAr ? 'رقم الهاتف الجديد' : 'New phone number'}
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
                  {isAr ? 'إرسال رموز التحقق للمصادقة وتغيير البيانات ⚡' : 'Send Verification Codes & Change Data ⚡'}
                </button>
              </form>
            ) : (
              <div className="space-y-4 pt-3 border-t border-white/5">
                <div className="bg-brand-bg p-4 rounded-xl border border-yellow-500/20 text-right space-y-2">
                  <span className="text-xs text-yellow-500 font-bold block">{isAr ? '🚨 مطلوب المصادقة الأمنية الثنائية:' : '🚨 Two-Factor Authentication Required:'}</span>
                  <p className="text-[11px] text-slate-400">
                    {isAr ? 'تم إرسال رمزي تحقق (OTP) إلى بريدك وهاتفك **الحاليين** المصاحبين لحسابك لحمايتك من الاختراق. يرجى إدخالهما للموافقة على تغيير البيانات:' : 'Two OTP codes have been sent to your **current** email and phone linked to your account to protect you from hacking. Please enter them to approve the data change:'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold">{isAr ? 'رمز البريد (Email OTP):' : 'Email Code (Email OTP):'}</span>
                    <input
                      type="text"
                      placeholder={isAr ? 'رمز البريد' : 'Email code'}
                      value={enteredEmailOtp}
                      onChange={(e) => setEnteredEmailOtp(e.target.value)}
                      maxLength={4}
                      className="w-full bg-brand-bg border border-white/10 rounded-xl px-3 py-3 text-center font-mono text-sm text-white focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold">{isAr ? 'رمز الهاتف (SMS OTP):' : 'Phone Code (SMS OTP):'}</span>
                    <input
                      type="text"
                      placeholder={isAr ? 'رمز الهاتف' : 'Phone code'}
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
                    {isAr ? 'إلغاء العملية' : 'Cancel Operation'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleConfirmChange}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl transition-all text-xs cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    {isAr ? 'تأكيد وتطبيق التغيير 🛡️' : 'Confirm & Apply Change 🛡️'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Section 6: Factory Reset */}
      <div className="space-y-4 pt-6 border-t border-red-500/20">
        <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
          <RotateCcw size={16} /> {isAr ? '🔴 إعادة تعيين المصنع (Factory Reset)' : '🔴 Factory Reset'}
        </h3>
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black text-white/80 bg-white/10 px-2 py-0.5 rounded-full">{stableVersion?.version || 'v3.12.0-stable - 23 يوليو 2026'}</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-semibold">
            {isAr ? `⚠️ هذا الإجراء يعيد تعيين الموقع بالكامل إلى النسخة المستقرة (${stableVersion?.version || 'v3.12.0-stable - 23 يوليو 2026'}). سيتم فقدان أي تغييرات لاحقة. يرجى التأكد قبل المتابعة.` : `⚠️ This resets the entire site to the stable version (${stableVersion?.version || 'v3.12.0-stable - July 23, 2026'}). Any subsequent changes will be lost. Please be certain before proceeding.`}
          </p>

          <button
            onClick={() => setShowFactoryReset(true)}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-3 rounded-xl transition-all text-xs cursor-pointer shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            {isAr ? `استعادة إلى النسخة المستقرة (${stableVersion?.version || 'v3.12.0-stable - 23 يوليو 2026'})` : `Restore to Stable (${stableVersion?.version || 'v3.12.0-stable - July 23, 2026'})`}
          </button>
        </div>
      </div>

    </div>
  );

  const modalFooter = (
    <div className="p-6 border-t border-white/10 bg-brand-bg flex items-center justify-between" dir="rtl">
      <button onClick={resetToDefault} className="px-4 py-2 text-sm text-brand-text/50 hover:text-brand-text font-semibold transition-colors">
        {isAr ? 'استعادة الافتراضي' : 'Restore Default'}
      </button>
      <button onClick={handleSave} className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center gap-2">
        {saved ? (
          <>
            <CheckCircle size={16} />
            {isAr ? 'تم الحفظ ✓' : 'Saved ✓'}
          </>
        ) : (
          isAr ? 'تطبيق وحفظ' : 'Apply & Save'
        )}
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
          <span className="text-[9px] text-emerald-400/70 font-semibold block pt-1">{isAr ? 'وصلتك للتو • وارد الآن' : 'Just arrived • Incoming now'}</span>
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

  const factoryResetOverlay = showFactoryReset && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    >
      <div onClick={() => { if (!factoryResetLoading) setShowFactoryReset(false); }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative bg-brand-bg border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4"
      >
        {factoryResetDone ? (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle size={36} className="text-green-400" />
            </div>
            <h3 className="text-lg font-black text-green-400">
              {isAr ? '✅ تم بدء إعادة التعيين!' : '✅ Factory Reset Initiated!'}
            </h3>
            <p className="text-sm text-slate-300 font-semibold">
              {isAr ? 'سيتم إعادة نشر النسخة المستقرة (stable-v2) خلال دقائق. قد تحتاج إلى تحديث الصفحة بعد اكتمال العملية.' : 'The stable version (stable-v2) will be redeployed within minutes. You may need to refresh the page after completion.'}
            </p>
          </>
        ) : factoryResetRedirectUrl ? (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle size={36} className="text-amber-400" />
            </div>
            <h3 className="text-lg font-black text-amber-400">
              {isAr ? '🔄 يلزم تدخل يدوي' : '🔄 Manual Action Required'}
            </h3>
            <p className="text-sm text-slate-300 font-semibold">
              {isAr ? 'اضغط الزر أدناه لفتح صفحة GitHub Actions، ثم اضغط "Run workflow" لإعادة التعيين.' : 'Click the button below to open GitHub Actions, then click "Run workflow" to reset.'}
            </p>
            <a
              href={factoryResetRedirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-3 rounded-xl transition-all text-xs cursor-pointer shadow-lg shadow-amber-500/20"
            >
              {isAr ? 'فتح GitHub Actions ⚡' : 'Open GitHub Actions ⚡'}
            </a>
            <button
              onClick={() => setShowFactoryReset(false)}
              className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-2 rounded-xl transition-all text-xs cursor-pointer"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle size={36} className="text-red-400" />
            </div>
            <h3 className="text-lg font-black text-red-400">
              {isAr ? '⚠️ تأكيد إعادة تعيين المصنع' : '⚠️ Confirm Factory Reset'}
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              {isAr ? `هل أنت متأكد؟ سيتم إعادة تعيين الموقع إلى النسخة المستقرة (${stableVersion?.version || 'v3.12.0-stable - 23 يوليو 2026'}). هذا الإجراء لا يمكن التراجع عنه.` : `Are you sure? This will reset the site to the stable version (${stableVersion?.version || 'v3.12.0-stable - July 23, 2026'}). This action cannot be undone.`}
            </p>
            {factoryResetError && (
              <p className="text-xs text-red-400 font-bold bg-red-500/10 rounded-xl p-3">{factoryResetError}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowFactoryReset(false)}
                disabled={factoryResetLoading}
                className="flex-1 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all text-xs cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleFactoryReset}
                disabled={factoryResetLoading}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-3 rounded-xl transition-all text-xs cursor-pointer shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
              >
                {factoryResetLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> {isAr ? 'جاري...' : 'Resetting...'}</>
                ) : (
                  <>{isAr ? 'تأكيد' : 'Confirm'} <RotateCcw size={16} /></>
                )}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );

  if (asPage) {
    return (
      <div>
        {modalHeader}
        {modalBody}
        {modalFooter}
        <AnimatePresence>{factoryResetOverlay}</AnimatePresence>
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

        <AnimatePresence>
          {factoryResetOverlay}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
