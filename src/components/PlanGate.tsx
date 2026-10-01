import { useState } from 'react';
import { KeyRound, Lock, ExternalLink, ArrowLeft, Crown, Zap, RefreshCcw, Sparkles, Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';

interface PlanGateProps {
  lang: 'ar' | 'en';
  onSaveKey: (key: string) => Promise<string | null | undefined> | void | null | undefined;
  onReturnToFree: () => void;
  onDeletePlan?: () => void;
}

type KeyProvider = 'groq' | 'gemini';

export default function PlanGate({ lang, onSaveKey, onReturnToFree, onDeletePlan }: PlanGateProps) {
  const isAr = lang === 'ar';
  const [provider, setProvider] = useState<KeyProvider>('groq');
  const [key, setKey] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const submit = async () => {
    const k = key.trim();
    if (!k || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const err = await onSaveKey(k);
      if (err) setSaveError(err);
    } finally {
      setSaving(false);
    }
  };

  const providerMeta: Record<KeyProvider, {
    label: string;
    placeholder: string;
    hint: string;
    createUrl: string;
    createLabel: string;
    helpText: string;
  }> = {
    groq: {
      label: isAr ? 'مفتاح Groq' : 'Groq API Key',
      placeholder: 'gsk_...',
      hint: isAr ? 'موصى به — سريع ومستقر' : 'Recommended — fast & stable',
      createUrl: 'https://console.groq.com/keys',
      createLabel: isAr ? 'إنشاء مفتاح Groq جديد' : 'Create a Groq Key',
      helpText: isAr
        ? 'كيف تحصل على مفتاح بدون بريدك الشخصي: افتح البريد المؤقت لتستلم عنوانًا جاهزًا، ثم في صفحة Groq اختر "Sign up with email" وأدخل ذلك العنوان ليصلك رمز التحقق — لا حاجة لبريد جوجل مؤقت.'
        : 'How to get a key without your personal email: open the temp mail to grab a ready address, then on the Groq page choose "Sign up with email" and use that address to receive the verification code.',
    },
    gemini: {
      label: isAr ? 'مفتاح Google Gemini' : 'Google Gemini API Key',
      placeholder: 'AIzaSy...',
      hint: isAr ? 'مجاني أو مدفوع' : 'Free or paid',
      createUrl: 'https://aistudio.google.com/apikey',
      createLabel: isAr ? 'إنشاء مفتاح Gemini جديد' : 'Create a Gemini Key',
      helpText: isAr
        ? 'مفاتيح Gemini المجانية والمدفوعة تعمل مع المنصة بنفس المنطق. لإنشاء مفتاح: افتح AI Studio، اضغط "Get API key"، واختر الباقة المجانية أو المدفوعة. يمكنك استخدام البريد المؤقت لإنشاء حساب Google.'
        : 'Both free and paid Gemini keys work with the platform using the same logic. To create one: open AI Studio, click "Get API key", and pick the free or paid tier. You can use the temp mail to create a Google account.',
    },
  };

  const meta = providerMeta[provider];

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/95 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl shadow-[0_0_60px_rgba(245,158,11,0.15)] p-7 sm:p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg mb-4">
              <KeyRound size={30} className="text-black" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white text-center">
              {isAr ? 'مفتاحك الخاص مطلوب' : 'Your Private Key Required'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-3 text-center leading-relaxed max-w-md">
              {isAr
                ? 'خطتك مفعّلة بنجاح. لإطلاق التحليل التلقائي واليدوي، أدخل مفتاح Groq أو مفتاح Google Gemini الخاص بك (مجاني أو مدفوع). المفتاح يُحفظ على جهازك فقط، ومفتاح المطور محمي ولا يُشارك مع أي عميل أبدًا.'
                : 'Your plan is active. To launch auto & manual analysis, enter your own Groq key or Google Gemini key (free or paid). The key stays only on your device; the developer key is protected and never shared with any client.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setProvider('groq')}
              className={`flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all ${
                provider === 'groq'
                  ? 'bg-amber-500/15 border-amber-500/60 text-amber-400'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              <span className="text-xs font-black">{isAr ? 'Groq' : 'Groq'}</span>
              <span className="text-[9px] text-slate-500">{isAr ? 'سريع ومستقر' : 'fast & stable'}</span>
            </button>
            <button
              onClick={() => setProvider('gemini')}
              className={`flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all ${
                provider === 'gemini'
                  ? 'bg-sky-500/15 border-sky-500/60 text-sky-400'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
              }`}
            >
              <span className="text-xs font-black">{isAr ? 'Gemini' : 'Gemini'}</span>
              <span className="text-[9px] text-slate-500">{isAr ? 'مجاني أو مدفوع' : 'free or paid'}</span>
            </button>
          </div>

          <label className="block text-xs font-black uppercase tracking-widest text-amber-400 mb-2">
            {meta.label}
          </label>
          <div className="flex items-center gap-2 bg-slate-950/70 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-amber-500/60 mb-1">
            <Lock size={18} className="text-slate-500 shrink-0" />
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder={meta.placeholder}
              className="flex-1 bg-transparent outline-none text-white placeholder:text-slate-600 font-mono text-sm"
              dir="ltr"
            />
          </div>
          <p className="text-[10px] text-slate-500 mb-4">{meta.hint}</p>

          <button
            onClick={submit}
            disabled={saving}
            className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg bg-gradient-to-r from-amber-500 to-[#F59E0B] text-black hover:opacity-90 active:scale-95 mb-5 flex items-center justify-center gap-2 disabled:opacity-60 disabled:active:scale-100"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
            {saving ? (isAr ? 'جارٍ التحقق من المفتاح...' : 'Verifying key...') : (isAr ? 'حفظ وتفعيل التحليل' : 'Save & Activate Analysis')}
          </button>

          {saveError && (
            <div className="flex items-start gap-2 mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs font-bold leading-relaxed">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{isAr ? `المفتاح غير صالح: ${saveError}` : `Invalid key: ${saveError}`}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            <a
              href={meta.createUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-xs font-black hover:bg-white/10 transition-all"
            >
              <ExternalLink size={14} />
              {meta.createLabel}
            </a>
            <a
              href="https://temp-mail.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-xs font-black hover:bg-white/10 transition-all"
            >
              <ExternalLink size={14} />
              {isAr ? 'بريد مؤقت مجاني' : 'Free Temp Mail'}
            </a>
          </div>

          <p className="text-center text-[11px] text-slate-400 mb-5 leading-relaxed">
            {meta.helpText}
          </p>

          <button
            onClick={onReturnToFree}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-slate-400 hover:text-white text-xs font-black transition-all"
          >
            <RefreshCcw size={14} />
            {isAr ? 'الرجوع للخطة المجانية الحالية' : 'Return to Current Free Plan'}
          </button>

          {onDeletePlan && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15 hover:text-red-300 text-xs font-black transition-all"
            >
              <Trash2 size={14} />
              {isAr ? 'حذف الخطة / الإلغاء' : 'Delete / Cancel Plan'}
            </button>
          )}

          <p className="text-center text-[10px] text-slate-500 mt-4 leading-relaxed">
            {isAr
              ? 'موقع مُصمم لتحليل التداول — تُستضاف منصة جوزيف لتحليل السوق'
              : 'Trading analysis platform — Joseph Market Analysis'}
          </p>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-gray-900 border border-red-500/40 rounded-3xl shadow-2xl p-6">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center mb-3">
                <AlertTriangle size={26} className="text-red-400" />
              </div>
              <h3 className="text-lg font-black text-white">
                {isAr ? 'تأكيد حذف الخطة' : 'Confirm Plan Deletion'}
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {isAr
                  ? 'سيتم إلغاء خطتك المدفوعة نهائياً والعودة للمجاني. لا يمكن التراجع عن هذا الإجراء.'
                  : 'Your paid plan will be cancelled permanently and you will return to free. This cannot be undone.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-black transition-all"
              >
                <X size={14} />
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => { setConfirmDelete(false); onDeletePlan?.(); }}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 text-white text-xs font-black hover:bg-red-400 transition-all"
              >
                <Trash2 size={14} />
                {isAr ? 'حذف الخطة' : 'Delete Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}