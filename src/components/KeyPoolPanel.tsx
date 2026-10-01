import { useEffect, useState } from 'react';
import { KeyRound, Plus, Trash2, Power, PowerOff, ShieldCheck, Loader2, AlertTriangle, CheckCircle, Server, Lock } from 'lucide-react';
import { Language } from '../lib/i18n';
import { addPoolKey, fetchPoolKeys, removePoolKey, setPoolKeyEnabled, PoolKeySummary } from '../services/aiPool';
import { auth } from '../lib/firebase';

export default function KeyPoolPanel({ lang }: { lang: Language }) {
  const isAr = lang === 'ar';
  const [keys, setKeys] = useState<PoolKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = async () => {
    setLoading(true);
    setError('');
    const list = await fetchPoolKeys();
    if (list.error) setError(list.error);
    setKeys(list.items || []);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    const unsub = auth.onAuthStateChanged((u) => {
      if (u) reload();
    });
    return () => unsub();
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4000);
  };

  const add = async () => {
    const value = newKey.trim();
    if (!value) return;
    setBusy(true);
    setError('');
    const res = await addPoolKey(value);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNewKey('');
    flash(isAr ? 'تمت إضافة المفتاح وفحصه' : 'Key added and verified');
    reload();
  };

  const toggle = async (k: PoolKeySummary) => {
    setError('');
    const res = await setPoolKeyEnabled(k.id, !k.enabled);
    if (res.error) setError(res.error);
    else reload();
  };

  const remove = async (k: PoolKeySummary) => {
    if (!window.confirm(isAr ? 'حذف هذا المفتاح نهائياً من مجمع المفاتيح؟' : 'Permanently delete this key from the pool?')) return;
    setError('');
    const res = await removePoolKey(k.id);
    if (res.error) setError(res.error);
    else {
      flash(isAr ? 'تم حذف المفتاح' : 'Key deleted');
      reload();
    }
  };

  const active = keys.filter((k) => k.enabled).length;
  const gemini = keys.filter((k) => k.provider === 'gemini' && k.enabled).length;
  const groq = keys.filter((k) => k.provider === 'groq' && k.enabled).length;

  return (
    <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-xl md:text-[26px] font-black text-brand-text/70 uppercase tracking-widest flex items-center gap-3">
          <span className="text-[#F59E0B] text-2xl">◆</span>
          {isAr ? 'مجمع مفاتيح التحليل' : 'Analysis Key Pool'}
        </h3>
        <button
          onClick={reload}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-[11px] font-black transition-all"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Server size={13} />}
          {isAr ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3">
        <Lock size={18} className="text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-emerald-200 leading-relaxed font-bold">
          {isAr
            ? 'المفاتيح تُحفظ مشفّرة في قاعدة البيانات ولا تُعرض أبداً بعد إضافتها. التحليل يختار المفتاح الأقل استخداماً تلقائياً، ويحوّل للمفتاح التالي عند رفع حد الاستخدام.'
            : 'Keys are stored encrypted and never displayed again after saving. Analysis automatically picks the least-used key and rotates to the next one when a limit is hit.'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: isAr ? 'مفعّل' : 'Enabled', value: active, cls: 'text-emerald-400' },
          { label: 'Gemini', value: gemini, cls: 'text-sky-400' },
          { label: 'Groq', value: groq, cls: 'text-violet-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center">
            <p className={`text-2xl font-black ${s.cls}`}>{s.value}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/5 border border-white/5 rounded-2xl p-5 space-y-3">
        <label className="flex items-center gap-2 text-xs font-black text-slate-300">
          <KeyRound size={14} className="text-amber-400" />
          {isAr ? 'إضافة مفتاح جديد' : 'Add a new key'}
        </label>
        <div className="flex items-center gap-2 bg-slate-950/70 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-amber-500/60">
          <input
            type="password"
            autoComplete="off"
            value={newKey}
            onChange={(e) => { setNewKey(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder={isAr ? 'Gemini (AIza…) أو Groq (gsk_…)' : 'Gemini (AIza…) or Groq (gsk_…)'}
            className="flex-1 bg-transparent outline-none text-white placeholder:text-slate-600 font-mono text-sm"
            dir="ltr"
            disabled={busy}
          />
          <button
            onClick={add}
            disabled={busy || !newKey.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-black text-xs font-black hover:bg-amber-400 disabled:opacity-50 transition-all"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {isAr ? 'إضافة وفحص' : 'Add & verify'}
          </button>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          {isAr
            ? 'يتم إرسال المفتاح مرة واحدة إلى الخادم ويُحفظ مشفّراً، ويُفحص فعلياً عند المزوّد قبل الحفظ.'
            : 'The key is sent once to the server over TLS, encrypted at rest, and verified against the provider before it is stored.'}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs font-bold leading-relaxed">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
          <CheckCircle size={14} className="shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {keys.length === 0 ? (
        <div className="text-center py-10 rounded-2xl bg-white/5 border border-dashed border-white/10">
          <ShieldCheck size={28} className="mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400 font-bold">
            {loading ? (isAr ? 'جارٍ التحميل…' : 'Loading…') : isAr ? 'لا يوجد أي مفتاح في المجمع بعد.' : 'No keys in the pool yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className={`flex items-center gap-3 p-4 rounded-2xl border ${k.enabled ? 'bg-white/5 border-white/5' : 'bg-black/20 border-white/5 opacity-60'}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.provider === 'gemini' ? 'bg-sky-500/15 text-sky-400' : 'bg-violet-500/15 text-violet-400'}`}>
                <KeyRound size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white" dir="ltr">{k.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5" dir="ltr">
                  {k.provider === 'gemini' ? 'Google Gemini' : 'Groq'} · {k.useCount} {isAr ? 'استخدام' : 'uses'}
                  {k.lastUsedAt ? ` · ${isAr ? 'آخر' : 'last'} ${gmt(k.lastUsedAt)}` : ''}
                </p>
                {(k.cooling || k.lastError) && (
                  <p className="text-[10px] text-amber-400 mt-0.5">
                    {k.cooling
                      ? isAr ? `موقوف مؤقتاً حتى ${gmt(new Date(k.disabledUntil).toISOString())}` : `Cooling down until ${gmt(new Date(k.disabledUntil).toISOString())}`
                      : k.lastError}
                  </p>
                )}
              </div>
              <button
                onClick={() => toggle(k)}
                title={k.enabled ? (isAr ? 'تعطيل' : 'Disable') : (isAr ? 'تفعيل' : 'Enable')}
                className={`p-2 rounded-xl transition-all ${k.enabled ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/20'}`}
              >
                {k.enabled ? <Power size={14} /> : <PowerOff size={14} />}
              </button>
              <button
                onClick={() => remove(k)}
                title={isAr ? 'حذف' : 'Delete'}
                className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function gmt(iso: string | number) {
  const d = typeof iso === 'number' ? new Date(iso) : new Date(iso);
  if (!iso || !isFinite(d.getTime())) return '--';
  return d.toLocaleString('en-GB', { timeZone: 'GMT', hour12: false });
}
