import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings2, Activity, LayoutTemplate, Layers, ShieldCheck, Mail, MessageSquare, CheckCircle, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { StrategySettings } from '../types';
import { DEFAULT_STRATEGY_SETTINGS } from '../constants';
import { User } from 'firebase/auth';
import { Language } from '../lib/i18n';
import { lt, ltp, pick, pkick, loc } from '../lib/i18nUI';

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
        body: ltp(lang, 653, emailCode)
      });
    }, 1500);

    setTimeout(() => {
      setNotification({
        type: 'sms',
        title: lt(lang, 26),
        body: ltp(lang, 654, smsCode)
      });
    }, 3500);
  };

  const handleConfirmChange = () => {
    setOtpError('');
    if (enteredEmailOtp !== generatedEmailOtp || enteredSmsOtp !== generatedSmsOtp) {
      setOtpError(lt(lang, 10));
      return;
    }
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('finalyze_dev_email', newEmail.trim());
      localStorage.setItem('finalyze_dev_phone', newPhone.trim());
    }
    
    setCurrentDevEmail(newEmail.trim());
    setCurrentDevPhone(newPhone.trim());
    
    setIsVerifying(false);
    setOtpSuccess(lt(lang, 22));
    
    setNewEmail('');
    setNewPhone('');
    setEnteredEmailOtp('');
    setEnteredSmsOtp('');
    
    alert(lt(lang, 31));
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
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/20 text-primary rounded-xl">
          <Settings2 size={42} />
        </div>
        <div>
          <h2 className="text-3xl md:text-[38px] font-black text-brand-text leading-tight">{lt(lang, 522)}</h2>
          <p className="text-lg md:text-[22px] text-brand-text/50 leading-snug mt-1">{lt(lang, 257)}</p>
        </div>
      </div>
      <button onClick={onClose} className="p-3 text-brand-text/50 hover:text-red-500 hover:bg-white/5 rounded-xl transition-colors">
        <X size={36} />
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
      <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0 gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-xl md:text-[24px] font-black text-brand-text leading-tight">{label}</div>
          {desc && <div className="text-sm md:text-[17px] text-brand-text/45 mt-1.5 leading-snug">{desc}</div>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <input type="text" inputMode="decimal" translate="no" dir="ltr" lang="en"
            value={focused ? draft : draft}
            onFocus={() => { setFocused(true); setDraft(String(value)); }}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(value)); setFocused(false); } }}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9.\-]/g, ''))}
            className={`w-24 md:w-28 text-center text-lg md:text-[22px] font-black font-mono notranslate ${color} bg-transparent border-2 border-white/10 rounded-xl py-2 focus:border-primary outline-none`} />
          {suffix && <span className="text-base md:text-[19px] text-[#F59E0B] font-black whitespace-nowrap">{suffix}</span>}
        </div>
      </div>
    );
  };

  const modalBody = (
    <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar" dir="rtl">
      
      {/* Section 1: Confidence Thresholds */}
      <div className="space-y-4">
        <h3 className="text-xl md:text-[26px] font-black text-brand-text/70 uppercase tracking-widest flex items-center gap-3 leading-tight">
          <span className="text-[#F59E0B] text-2xl">◆</span> {lt(lang, 160)}
        </h3>
        <div className="bg-white/5 border border-white/5 rounded-2xl p-5 md:p-6">
          <NumberInput label={lt(lang, 534)} value={settings.strongThreshold} onChange={(v) => handleChange('strongThreshold', v)} color="text-[#F59E0B]" desc={lt(lang, 159)} />
          <NumberInput label={lt(lang, 335)} value={settings.minStrongSupport} onChange={(v) => handleChange('minStrongSupport', v)} color="text-[#F59E0B]" desc={lt(lang, 539)} />
          <NumberInput label={lt(lang, 119)} value={settings.buyThreshold} onChange={(v) => handleChange('buyThreshold', v)} color="text-primary" desc={lt(lang, 158)} />
          <NumberInput label={lt(lang, 102)} value={settings.baseConfidence} onChange={(v) => handleChange('baseConfidence', v)} color="text-emerald-400" desc={lt(lang, 258)} />
        </div>
      </div>

      {/* Section 2: Primary Conditions (Entry Gates) */}
      <div className="space-y-4">
        <h3 className="text-xl md:text-[26px] font-black text-brand-text/70 uppercase tracking-widest flex items-center gap-3 leading-tight">
          <span className="text-[#F59E0B] text-2xl">◆</span> {lt(lang, 432)}
          <span className="text-base md:text-[22px] text-brand-text/35 font-mono mr-auto">{lt(lang, 325)}</span>
        </h3>
        <div className="bg-white/5 border border-white/5 rounded-2xl p-5 md:p-6">
          <NumberInput label={lt(lang, 39)} value={settings.primaryBBWeight} onChange={(v) => handleChange('primaryBBWeight', v)} color="text-[#F59E0B]" desc={lt(lang, 43)} />
          <NumberInput label={lt(lang, 41)} value={settings.primarySDWeight} onChange={(v) => handleChange('primarySDWeight', v)} color="text-[#F59E0B]" desc={lt(lang, 201)} />
          <NumberInput label={lt(lang, 42)} value={settings.primaryAgeWeight} onChange={(v) => handleChange('primaryAgeWeight', v)} color="text-[#F59E0B]" desc={lt(lang, 321)} />
          <NumberInput label={lt(lang, 44)} value={settings.primaryPrePullbackAgeWeight} onChange={(v) => handleChange('primaryPrePullbackAgeWeight', v)} color="text-[#F59E0B]" desc={lt(lang, 40)} />
          <NumberInput label={lt(lang, 45)} value={settings.primaryNewsWeight} onChange={(v) => handleChange('primaryNewsWeight', v)} color="text-[#F59E0B]" desc={lt(lang, 344)} />
        </div>
      </div>

      {/* Section 3: Supporting Conditions (Signal Boost) */}
      <div className="space-y-4">
        <h3 className="text-xl md:text-[26px] font-black text-brand-text/70 uppercase tracking-widest flex items-center gap-3 leading-tight">
          <span className="text-[#F59E0B] text-2xl">◆</span> {lt(lang, 542)}
          <span className="text-base md:text-[22px] text-brand-text/35 font-mono mr-auto">{lt(lang, 324)}</span>
        </h3>
        <div className="bg-white/5 border border-white/5 rounded-2xl p-5 md:p-6">
          <NumberInput label={lt(lang, 479)} value={settings.supportRSIWeight} onChange={(v) => handleChange('supportRSIWeight', v)} color="text-primary" desc={lt(lang, 401)} />
          <NumberInput label={lt(lang, 220)} value={settings.supportEMAWeight} onChange={(v) => handleChange('supportEMAWeight', v)} color="text-primary" desc={lt(lang, 115)} />
          <NumberInput label={lt(lang, 581)} value={settings.supportDirWeight} onChange={(v) => handleChange('supportDirWeight', v)} color="text-primary" desc={lt(lang, 594)} />
          <NumberInput label={lt(lang, 610)} value={settings.supportVolWeight} onChange={(v) => handleChange('supportVolWeight', v)} color="text-primary" desc={lt(lang, 611)} />
          <NumberInput label={lt(lang, 328)} value={settings.supportMicroBBWeight} onChange={(v) => handleChange('supportMicroBBWeight', v)} color="text-primary" desc={lt(lang, 329)} />
          <NumberInput label={lt(lang, 330)} value={settings.supportMicroAlignWeight} onChange={(v) => handleChange('supportMicroAlignWeight', v)} color="text-primary" desc={lt(lang, 306)} />
        </div>
      </div>

      {/* Section 4: Toggles */}
      <div className="space-y-4">
        <h3 className="text-xl md:text-[26px] font-black text-brand-text/70 uppercase tracking-widest flex items-center gap-3 leading-tight">
          <span className="text-[#F59E0B] text-2xl">◆</span> {lt(lang, 253)}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'useIndicators', label: lt(lang, 550), desc: lt(lang, 480) },
            { key: 'useNewsGuard', label: lt(lang, 619), desc: lt(lang, 107) },
            { key: 'useHigherTimeframe', label: lt(lang, 276), desc: lt(lang, 165) },
            { key: 'useVolumeAnalysis', label: lt(lang, 607), desc: lt(lang, 612) },
            { key: 'useVolumeGuard', label: lt(lang, 608), desc: lt(lang, 46) },
            { key: 'useFilterSideways', label: lt(lang, 512), desc: lt(lang, 110) },
            { key: 'useCandleMatch', label: lt(lang, 475), desc: lt(lang, 230) },
            { key: 'candleDirectionFilter', label: lt(lang, 476), desc: lt(lang, 109) },
          ].map((item) => (
            <button key={item.key} onClick={() => {
              const next = !(settings as any)[item.key];
              const applied: any = { ...settings, [item.key]: next };
              if ((item.key === 'candleDirectionFilter') && next) {
                applied.useCandleMatch = true;
              }
              onSettingsChange(applied);
            }}
              className={`flex items-center justify-between p-5 md:p-6 rounded-2xl border-2 transition-all text-right gap-4 ${
                (settings as any)[item.key]
                  ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#F59E0B]'
                  : 'bg-white/5 border-white/5 text-brand-muted'
              }`}>
              <div className="flex-1 min-w-0">
                <div className="text-xl md:text-[26px] font-black leading-tight">{item.label}</div>
                <div className="text-base md:text-[20px] opacity-70 mt-1.5 leading-snug">{item.desc}</div>
              </div>
              <div className={`w-16 h-9 rounded-full transition-colors flex items-center px-1 shrink-0 ${
                (settings as any)[item.key] ? 'bg-[#F59E0B]' : 'bg-white/20'
              }`}>
                <div className={`w-7 h-7 bg-white rounded-full transition-transform shadow ${
                  (settings as any)[item.key] ? 'translate-x-7' : 'translate-x-0'
                }`} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Volume Guard Threshold (Pro) */}
      {settings?.useVolumeGuard !== false && (
        <div className="space-y-2 pt-6 border-t border-white/10">
          <h3 className="text-2xl md:text-[28px] font-black text-amber-400/60 uppercase tracking-widest">
            {lt(lang, 609)}
          </h3>
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6">
            <NumberInput
              label={lt(lang, 166)}
              desc={lt(lang, 6)}
              value={settings?.volumeGuardThreshold ?? 45}
              onChange={(v) => handleChange('volumeGuardThreshold', v)}
              min={20}
              max={70}
              suffix=""
              color='text-amber-400'
            />
            <NumberInput
              label={lt(lang, 146)}
              desc={lt(lang, 326)}
              value={settings?.volumeGuardMaxThreshold ?? 85}
              onChange={(v) => handleChange('volumeGuardMaxThreshold', v)}
              min={71}
              max={100}
              suffix=""
              color='text-amber-400'
            />
          </div>
        </div>
      )}


      {/* Section 5: Developer Trend Age Zones */}
      {user && (user.email === 'taybekraa@gmail.com' || user.email === 'kraakraa109@gmail.com' || user.email === 'bachasalman69@gmail.com') && (
        <div className="space-y-4 pt-6 border-t border-white/10">
          <h3 className="text-2xl md:text-[28px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-3">
            <span className="text-amber-400 text-3xl">◆</span> {lt(lang, 35)}
          </h3>
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6 space-y-6">

            {/* Zone Visualization */}
            <div className="bg-black/30 rounded-xl p-4">
              <div className="text-base md:text-[20px] text-brand-text/40 font-mono mb-3 text-center">
                {lt(lang, 580)}
              </div>
              <div className="flex h-10 rounded-xl overflow-hidden text-base md:text-[18px] font-black">
                <div className="flex-1 bg-red-500/30 border-r border-black/30 flex items-center justify-center text-red-300">
                  {lt(lang, 284)}
                </div>
                <div className="flex-1 bg-amber-500/30 border-r border-black/30 flex items-center justify-center text-amber-300">
                  {lt(lang, 636)}
                </div>
                <div className="flex-1 bg-emerald-500/30 border-r border-black/30 flex items-center justify-center text-emerald-300">
                  {lt(lang, 322)}
                </div>
                <div className="flex-1 bg-red-500/30 flex items-center justify-center text-red-300">
                  {lt(lang, 72)}
                </div>
              </div>
              <div className="flex justify-between mt-2 text-sm md:text-[16px] text-brand-text/30 font-mono px-1">
                <span>0</span>
                <span>{settings.minInfantAge}</span>
                <span>{settings.minMatureAge}</span>
                <span>{settings.maxMatureAge}</span>
              </div>
            </div>

            {/* Min Consecutive Momentum (Age) */}
            <NumberInput label={lt(lang, 331)} value={settings.minTrendAge} onChange={(v) => handleChange('minTrendAge', v)} color="text-amber-400" desc={lt(lang, 465)} suffix="" min={1} max={10} />

            {/* Infant Age Threshold */}
            <NumberInput label={lt(lang, 285)} value={settings.minInfantAge} onChange={(v) => handleChange('minInfantAge', v)} color="text-red-400" desc={lt(lang, 105)} suffix="" min={3} max={99} />

            {/* Mature Age Start */}
            <NumberInput label={lt(lang, 323)} value={settings.minMatureAge} onChange={(v) => handleChange('minMatureAge', v)} color="text-emerald-400" desc={lt(lang, 268)} suffix="" min={5} max={99} />

            {/* Old Age Threshold */}
            <NumberInput label={lt(lang, 73)} value={settings.maxMatureAge} onChange={(v) => handleChange('maxMatureAge', v)} color="text-red-400" desc={lt(lang, 47)} suffix="" min={10} max={200} />

            {/* Pre-Pullback Age — Min */}
            <NumberInput label={lt(lang, 333)} value={settings.minPrePullbackAge} onChange={(v) => handleChange('minPrePullbackAge', v)} color="text-cyan-400" desc={lt(lang, 106)} suffix="" min={1} max={200} />

            {/* Pre-Pullback Age — Max */}
            <NumberInput label={lt(lang, 327)} value={settings.maxPrePullbackAge} onChange={(v) => handleChange('maxPrePullbackAge', v)} color="text-cyan-400" desc={lt(lang, 48)} suffix="" min={1} max={200} />

            {/* Min Pullback Candles */}
            <NumberInput label={lt(lang, 334)} value={settings.minPullbackCandles || 2} onChange={(v) => handleChange('minPullbackCandles', v)} color="text-cyan-400" desc={lt(lang, 332)} suffix="" min={1} max={10} />

            {/* Pullback Volume Confirm */}
            <div className="pt-3 border-t border-white/5">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xl md:text-[24px] font-black text-cyan-400 leading-tight">{lt(lang, 438)}</label>
                <button onClick={() => handleChange('pullbackVolConfirm', !settings.pullbackVolConfirm)}
                  className={`w-16 h-9 rounded-full transition-all shrink-0 ${settings.pullbackVolConfirm ? 'bg-cyan-500' : 'bg-white/10'}`}>
                  <div className={`w-7 h-7 rounded-full bg-white shadow transition-transform ${settings.pullbackVolConfirm ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
              <p className="text-base md:text-[20px] text-brand-text/40 mt-2 leading-snug">{lt(lang, 463)}</p>
            </div>

            {/* Pullback Candle Confirm */}
            <div className="pt-3 border-t border-white/5">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xl md:text-[24px] font-black text-cyan-400 leading-tight">{lt(lang, 437)}</label>
                <button onClick={() => handleChange('pullbackCandleConfirm', !settings.pullbackCandleConfirm)}
                  className={`w-16 h-9 rounded-full transition-all shrink-0 ${settings.pullbackCandleConfirm ? 'bg-cyan-500' : 'bg-white/10'}`}>
                  <div className={`w-7 h-7 rounded-full bg-white shadow transition-transform ${settings.pullbackCandleConfirm ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
              <p className="text-base md:text-[20px] text-brand-text/40 mt-2 leading-snug">{lt(lang, 464)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Section 5: Developer Dynamic Credentials Security (Only visible to the developer) */}
      {user && (user.email === 'taybekraa@gmail.com' || user.email === 'kraakraa109@gmail.com' || user.email === 'bachasalman69@gmail.com') && (
        <div className="space-y-4 pt-6 border-t border-white/10">
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={16} /> {lt(lang, 32)}
          </h3>
          
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-5 space-y-4 text-right">
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              {lt(lang, 559)}
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">{lt(lang, 185)}</span>
                <div className="p-3 bg-brand-bg border border-white/5 rounded-xl font-mono text-xs text-white text-left overflow-x-auto">
                  {currentDevEmail}
                </div>
              </div>
              
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-bold">{lt(lang, 186)}</span>
                <div className="p-3 bg-brand-bg border border-white/5 rounded-xl font-mono text-xs text-white text-left overflow-x-auto">
                  {currentDevPhone}
                </div>
              </div>
            </div>

            {!isVerifying ? (
              <form onSubmit={handleRequestChange} className="space-y-3 pt-3 border-t border-white/5">
                <h4 className="text-xs font-bold text-emerald-400">{lt(lang, 27)}</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="email"
                      placeholder={lt(lang, 351)}
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                      className="w-full bg-brand-bg border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white text-left focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={lt(lang, 352)}
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
                  {lt(lang, 499)}
                </button>
              </form>
            ) : (
              <div className="space-y-4 pt-3 border-t border-white/5">
                <div className="bg-brand-bg p-4 rounded-xl border border-yellow-500/20 text-right space-y-2">
                  <span className="text-xs text-yellow-500 font-bold block">{lt(lang, 37)}</span>
                  <p className="text-[11px] text-slate-400">
                    {lt(lang, 582)}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold">{lt(lang, 223)}</span>
                    <input
                      type="text"
                      placeholder={lt(lang, 222)}
                      value={enteredEmailOtp}
                      onChange={(e) => setEnteredEmailOtp(e.target.value)}
                      maxLength={4}
                      className="w-full bg-brand-bg border border-white/10 rounded-xl px-3 py-3 text-center font-mono text-sm text-white focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 font-bold">{lt(lang, 420)}</span>
                    <input
                      type="text"
                      placeholder={lt(lang, 419)}
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
                    {lt(lang, 122)}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleConfirmChange}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl transition-all text-xs cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    {lt(lang, 163)}
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
          <RotateCcw size={16} /> {lt(lang, 36)}
        </h3>
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black text-white/80 bg-white/10 px-2 py-0.5 rounded-full">{stableVersion?.version || 'v3.12.0-stable - 23 يوليو 2026'}</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-semibold">
            {ltp(lang, 655, stableVersion?.version || 'v3.12.0-stable')}
          </p>

          <button
            onClick={() => setShowFactoryReset(true)}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-3 rounded-xl transition-all text-xs cursor-pointer shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            {ltp(lang, 656, stableVersion?.version || 'v3.12.0-stable')}
          </button>
        </div>
      </div>

    </div>
  );

  const modalFooter = (
    <div className="p-6 border-t border-white/10 bg-brand-bg flex items-center justify-between" dir="rtl">
      <button onClick={resetToDefault} className="px-6 py-3 text-xl md:text-[24px] text-brand-text/50 hover:text-brand-text font-black transition-colors">
        {lt(lang, 470)}
      </button>
      <button onClick={handleSave} className="px-8 py-3 bg-primary text-white rounded-2xl text-xl md:text-[24px] font-black shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center gap-3">
        {saved ? (
          <>
            <CheckCircle size={28} />
            {lt(lang, 487)}
          </>
        ) : (
          lt(lang, 85)
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
          <span className="text-[9px] text-emerald-400/70 font-semibold block pt-1">{lt(lang, 287)}</span>
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
              {lt(lang, 13)}
            </h3>
            <p className="text-sm text-slate-300 font-semibold">
              {lt(lang, 555)}
            </p>
          </>
        ) : factoryResetRedirectUrl ? (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle size={36} className="text-amber-400" />
            </div>
            <h3 className="text-lg font-black text-amber-400">
              {lt(lang, 30)}
            </h3>
            <p className="text-sm text-slate-300 font-semibold">
              {lt(lang, 137)}
            </p>
            <a
              href={factoryResetRedirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-3 rounded-xl transition-all text-xs cursor-pointer shadow-lg shadow-amber-500/20"
            >
              {lt(lang, 392)}
            </a>
            <button
              onClick={() => setShowFactoryReset(false)}
              className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-2 rounded-xl transition-all text-xs cursor-pointer"
            >
              {lt(lang, 147)}
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle size={36} className="text-red-400" />
            </div>
            <h3 className="text-lg font-black text-red-400">
              {lt(lang, 9)}
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              {ltp(lang, 657, stableVersion?.version || 'v3.12.0-stable')}
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
                {lt(lang, 120)}
              </button>
              <button
                onClick={handleFactoryReset}
                disabled={factoryResetLoading}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-3 rounded-xl transition-all text-xs cursor-pointer shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
              >
                {factoryResetLoading ? (
                  <><Loader2 size={16} className="animate-spin" /> {lt(lang, 469)}</>
                ) : (
                  <>{lt(lang, 161)} <RotateCcw size={16} /></>
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
