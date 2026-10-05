import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Lightbulb, Plus, Check, User, ThumbsUp, Trophy, X, Trash2, AlertTriangle, EyeOff, Bell } from 'lucide-react';
import { Language } from '../lib/i18n';
import { db } from '../lib/firebase';
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, getDoc, setDoc, increment, serverTimestamp, query, where
} from 'firebase/firestore';

interface Suggestion {
  id: string;
  name: string;
  text: string;
  votes: number;
  voters: string[];
  createdAt: any;
  _type?: string;
  ownerUid?: string;
  ownerEmail?: string;
}

interface SuggestionsPageProps {
  lang: Language;
  onBack: () => void;
  userName?: string;
  isDeveloper?: boolean;
  onClearCount?: () => void;
  onHideCount?: (n: number) => void;
  userUid?: string;
  userEmail?: string;
}

const DEV_HIDDEN_DOC = 'dev_hidden_suggestions';
const USER_PREFS = 'userPreferences';

export default function SuggestionsPage({
  lang, onBack, userName, isDeveloper = false,
  onClearCount, onHideCount, userUid, userEmail,
}: SuggestionsPageProps) {
  const isAr = lang === 'ar';
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [devHiddenIds, setDevHiddenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(userName || '');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const myUid = (userUid || '').trim();
  const myEmail = (userEmail || '').trim().toLowerCase();
  const isMine = (s: Suggestion) =>
    (!!myUid && !!s.ownerUid && s.ownerUid === myUid) ||
    (!!myEmail && !!s.ownerEmail && String(s.ownerEmail).toLowerCase() === myEmail);

  // ── Load dev hidden IDs from Firestore ─────────────────────────────────────
  const loadDevHidden = useCallback(async () => {
    if (!isDeveloper) return;
    try {
      const snap = await getDoc(doc(db, USER_PREFS, DEV_HIDDEN_DOC));
      if (snap.exists()) {
        const ids: string[] = snap.data().hiddenIds || [];
        setDevHiddenIds(new Set(ids));
      }
    } catch {}
  }, [isDeveloper]);

  const saveDevHidden = async (ids: Set<string>) => {
    try {
      await setDoc(doc(db, USER_PREFS, DEV_HIDDEN_DOC), { hiddenIds: [...ids], updatedAt: Date.now() });
    } catch {}
  };

  // ── Fetch all suggestions ───────────────────────────────────────────────────
  const fetchSuggestions = async () => {
    try {
      const q = query(collection(db, 'analysisResults'), where('_type', '==', 'suggestion'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => {
        const raw = d.data();
        return {
          id: d.id,
          name: raw.name || '',
          text: raw.text || '',
          votes: raw.votes || 0,
          voters: raw.voters || [],
          createdAt: raw.createdAt,
          _type: raw._type,
          ownerUid: raw.ownerUid || '',
          ownerEmail: raw.ownerEmail || '',
        } as Suggestion;
      }).sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
      setSuggestions(data);
    } catch (err: any) {
      console.error('Failed to fetch suggestions:', err);
      setError(isAr ? 'فشل تحميل الاقتراحات' : 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
    loadDevHidden();
    if (isDeveloper && onClearCount) onClearCount();
  }, []);

  // ── What the current user sees ──────────────────────────────────────────────
  // المطور: يرى كل الاقتراحات ماعدا التي أخفاها هو من طرفه فقط
  // العميل: يرى كل الاقتراحات (لكنه يحذف اقتراحاته فقط)
  const visibleSuggestions = isDeveloper
    ? suggestions.filter(s => !devHiddenIds.has(s.id))
    : suggestions;

  const totalVotes = visibleSuggestions.reduce((sum, s) => sum + s.votes, 0);
  // عدد المقترحات التي لم يراها المطور بعد (الظاهرة حالياً)
  const newCount = isDeveloper ? visibleSuggestions.length : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(db, 'analysisResults'), {
        _type: 'suggestion',
        name: name.trim(),
        text: text.trim(),
        votes: 0,
        voters: [],
        ownerUid: myUid,
        ownerEmail: myEmail,
        createdAt: serverTimestamp(),
      });
      setText('');
      setShowForm(false);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      await fetchSuggestions();
    } catch (err: any) {
      setError(isAr ? 'فشل إرسال الاقتراح' : 'Failed to submit suggestion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (suggestion: Suggestion) => {
    const voterId = myUid || myEmail || 'anonymous';
    if (suggestion.voters?.includes(voterId)) return;
    try {
      const ref = doc(db, 'analysisResults', suggestion.id);
      await updateDoc(ref, {
        votes: increment(1),
        voters: [...(suggestion.voters || []), voterId],
      });
      await fetchSuggestions();
    } catch {}
  };

  // ── حذف المطور: إخفاء من طرفه فقط — لا يُحذف من Firestore ─────────────────
  const handleDevHideOne = async (id: string) => {
    setDeleting(id);
    const newHidden = new Set(devHiddenIds);
    newHidden.add(id);
    setDevHiddenIds(newHidden);
    await saveDevHidden(newHidden);
    if (onHideCount) onHideCount(1);
    setDeleting(null);
  };

  const handleDevHideAll = async () => {
    setDeleting('all');
    const newHidden = new Set(devHiddenIds);
    visibleSuggestions.forEach(s => newHidden.add(s.id));
    setDevHiddenIds(newHidden);
    await saveDevHidden(newHidden);
    if (onHideCount) onHideCount(visibleSuggestions.length);
    setConfirmDeleteAll(false);
    setDeleting(null);
  };

  // ── حذف العميل: يحذف اقتراحاته هو فقط نهائياً من Firestore ─────────────────
  const handleClientDeleteOne = async (id: string) => {
    const suggestion = suggestions.find(s => s.id === id);
    if (!suggestion || !isMine(suggestion)) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'analysisResults', id));
      setSuggestions(prev => prev.filter(s => s.id !== id));
    } catch {
      setError(isAr ? 'فشل الحذف' : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const handleClientDeleteAll = async () => {
    setDeleting('all');
    try {
      const targets = suggestions.filter(isMine);
      const results = await Promise.allSettled(
        targets.map(s => deleteDoc(doc(db, 'analysisResults', s.id)))
      );
      const gone = new Set(
        targets.filter((_, i) => results[i].status === 'fulfilled').map(s => s.id)
      );
      setSuggestions(prev => prev.filter(s => !gone.has(s.id)));
      setConfirmDeleteAll(false);
      if (results.some(r => r.status === 'rejected')) {
        setError(isAr ? 'تم حذف بعضها، وتعذّر حذف الباقي' : 'Some deleted, others failed');
      }
    } catch {
      setError(isAr ? 'فشل حذف الكل' : 'Failed to delete all');
    } finally {
      setDeleting(null);
    }
  };

  const getPercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const isImplementable = (votes: number) => totalVotes > 0 && getPercentage(votes) >= 50;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
      >
        <ArrowLeft size={20} className={`group-hover:-translate-x-1 transition-transform ${isAr ? 'rotate-180' : ''}`} />
        <span className="text-sm font-bold">{isAr ? 'رجوع' : 'Back'}</span>
      </button>

      {/* ── بانر أحمر للمطور عند وجود مقترحات جديدة ── */}
      {isDeveloper && newCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 bg-red-500/15 border border-red-500/40 rounded-2xl px-5 py-3"
        >
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <Bell size={18} className="text-red-400 shrink-0" />
          <p className="text-sm font-black text-red-300 flex-1">
            {isAr
              ? `لديك ${newCount} مقترح${newCount > 1 ? 'ات' : ''} من العملاء بانتظار المراجعة`
              : `You have ${newCount} client suggestion${newCount > 1 ? 's' : ''} awaiting review`}
          </p>
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto bg-[#F59E0B]/20 rounded-3xl flex items-center justify-center border border-[#F59E0B]/30">
          <Lightbulb size={40} className="text-[#F59E0B]" />
        </div>
        <h1 className="text-3xl font-black text-white">
          {isDeveloper
            ? (isAr ? 'مقترحات العملاء' : 'Client Suggestions')
            : (isAr ? 'اقتراحاتك' : 'Your Suggestions')}
        </h1>
        <p className="text-white/60 text-sm max-w-2xl mx-auto">
          {isDeveloper
            ? (isAr
              ? 'عرض مقترحات العملاء — الإخفاء يخفيها من هنا فقط ولا يحذفها من حساب العميل'
              : 'View client suggestions — hiding removes them from your view only, not from the client\'s account')
            : (isAr
              ? 'شاركنا أفكارك لتطوير الموقع. إذا حصل اقتراحك على أكثر من 50% من مجموع الأصوات، سنقوم بتطبيقه!'
              : 'Share your ideas. If your suggestion gets more than 50% of total votes, we will implement it!')}
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-brand-alt rounded-2xl border border-white/10 p-4 text-center">
          <div className="text-2xl font-black text-[#F59E0B]">{visibleSuggestions.length}</div>
          <div className="text-xs text-white/40 font-bold">{isAr ? 'إجمالي الاقتراحات' : 'Total Suggestions'}</div>
        </div>
        <div className="bg-brand-alt rounded-2xl border border-white/10 p-4 text-center">
          <div className="text-2xl font-black text-[#F59E0B]">{totalVotes}</div>
          <div className="text-xs text-white/40 font-bold">{isAr ? 'إجمالي الأصوات' : 'Total Votes'}</div>
        </div>
        <div className="bg-brand-alt rounded-2xl border border-white/10 p-4 text-center">
          <div className="text-2xl font-black text-[#F59E0B]">
            {visibleSuggestions.filter(s => isImplementable(s.votes)).length}
          </div>
          <div className="text-xs text-white/40 font-bold">{isAr ? 'تم تطبيقها' : 'Implemented'}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center gap-3 flex-wrap">
        {/* إضافة — للعميل فقط */}
        {!isDeveloper && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-[#F59E0B] text-black px-6 py-3 rounded-xl font-black text-sm hover:bg-[#d97706] transition-all shadow-lg active:scale-95"
          >
            <Plus size={18} />
            {isAr ? 'أضف اقتراح' : 'Add Suggestion'}
          </button>
        )}

        {/* إخفاء كل المرئي — للمطور فقط (لا يحذف) */}
        {isDeveloper && visibleSuggestions.length > 0 && (
          <>
            {confirmDeleteAll ? (
              <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 rounded-xl px-4 py-3">
                <AlertTriangle size={18} className="text-amber-400" />
                <span className="text-sm font-bold text-amber-400">
                  {isAr ? 'إخفاء كل المقترحات من طرفك؟' : 'Hide all suggestions from your view?'}
                </span>
                <button
                  onClick={handleDevHideAll}
                  disabled={deleting === 'all'}
                  className="bg-amber-500 text-black px-4 py-1.5 rounded-lg text-xs font-black hover:bg-amber-400 transition-all"
                >
                  {deleting === 'all' ? (isAr ? 'جاري...' : 'Hiding...') : (isAr ? 'نعم' : 'Yes')}
                </button>
                <button onClick={() => setConfirmDeleteAll(false)} className="bg-white/10 text-white px-4 py-1.5 rounded-lg text-xs font-black hover:bg-white/20 transition-all">
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 px-6 py-3 rounded-xl font-black text-sm hover:bg-amber-500/30 transition-all"
              >
                <EyeOff size={18} />
                {isAr ? 'إخفاء الكل من طرفي' : 'Hide all from my view'}
              </button>
            )}
          </>
        )}

        {/* مسح اقتراحاتي — للعميل فقط */}
        {!isDeveloper && visibleSuggestions.some(isMine) && (
          <>
            {confirmDeleteAll ? (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-3">
                <AlertTriangle size={18} className="text-red-400" />
                <span className="text-sm font-bold text-red-400">
                  {isAr ? 'حذف اقتراحاتك نهائياً؟' : 'Delete your suggestions permanently?'}
                </span>
                <button
                  onClick={handleClientDeleteAll}
                  disabled={deleting === 'all'}
                  className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-xs font-black hover:bg-red-600 transition-all"
                >
                  {deleting === 'all' ? (isAr ? 'جاري الحذف...' : 'Deleting...') : (isAr ? 'نعم' : 'Yes')}
                </button>
                <button onClick={() => setConfirmDeleteAll(false)} className="bg-white/10 text-white px-4 py-1.5 rounded-lg text-xs font-black hover:bg-white/20 transition-all">
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/40 text-red-400 px-6 py-3 rounded-xl font-black text-sm hover:bg-red-500/30 transition-all"
              >
                <Trash2 size={18} />
                {isAr ? 'مسح اقتراحاتي' : 'Clear my suggestions'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Success */}
      <AnimatePresence>
        {submitted && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-3 flex items-center justify-center gap-3">
            <Check size={20} className="text-emerald-400" />
            <span className="text-sm font-black text-emerald-400">
              {isAr ? 'تم إضافة اقتراحك بنجاح!' : 'Your suggestion has been added!'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3 flex items-center justify-center gap-3">
            <X size={20} className="text-red-400" />
            <span className="text-sm font-black text-red-400">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-brand-alt rounded-3xl border border-white/10 p-6 w-full max-w-md space-y-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white">{isAr ? 'اقتراح جديد' : 'New Suggestion'}</h3>
                <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-white/60 block mb-1.5">{isAr ? 'اسمك' : 'Your Name'}</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder={isAr ? 'أدخل اسمك' : 'Enter your name'} required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/50" />
                </div>
                <div>
                  <label className="text-xs font-bold text-white/60 block mb-1.5">{isAr ? 'اقتراحك' : 'Your Suggestion'}</label>
                  <textarea value={text} onChange={e => setText(e.target.value)}
                    placeholder={isAr ? 'اكتب اقتراحك هنا...' : 'Write your suggestion here...'} required rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/50 resize-none" />
                </div>
                <button type="submit" disabled={submitting || !name.trim() || !text.trim()}
                  className="w-full bg-[#F59E0B] text-black py-3 rounded-xl font-black text-sm hover:bg-[#d97706] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'إرسال' : 'Submit')}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suggestions list */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-b-2 border-[#F59E0B] rounded-full animate-spin mx-auto" />
          <p className="text-white/40 text-sm mt-3">{isAr ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      ) : visibleSuggestions.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Lightbulb size={40} className="text-white/20 mx-auto" />
          <p className="text-white/40 text-sm">
            {isDeveloper
              ? (isAr ? 'لا توجد مقترحات جديدة بعد.' : 'No new suggestions yet.')
              : (isAr ? 'لا توجد اقتراحات بعد.' : 'No suggestions yet.')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleSuggestions.map((s, i) => {
            const pct = getPercentage(s.votes);
            const implementable = isImplementable(s.votes);
            const voterId = myUid || myEmail || 'anonymous';
            const hasVoted = s.voters?.includes(voterId);
            const isOwn = isMine(s);
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-brand-alt rounded-2xl border p-4 space-y-3 ${
                  implementable ? 'border-[#F59E0B]/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                        <User size={12} className="text-white/60" />
                      </div>
                      <span className="text-xs font-bold text-white/60">{s.name}</span>
                      {implementable && (
                        <span className="flex items-center gap-1 bg-[#F59E0B]/20 text-[#F59E0B] text-[10px] font-black px-2 py-0.5 rounded-full">
                          <Trophy size={10} />
                          {isAr ? 'تم التطبيق' : 'Implemented'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed">{s.text}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isOwn && !isDeveloper && (
                      <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-white/5 text-white/40 border border-white/10">
                        {isAr ? 'اقتراحك' : 'Yours'}
                      </span>
                    )}

                    {/* المطور: زر إخفاء (من طرفه فقط) */}
                    {isDeveloper && (
                      <button
                        onClick={() => handleDevHideOne(s.id)}
                        disabled={deleting === s.id}
                        className="p-2 rounded-xl bg-amber-500/10 text-amber-400/60 hover:bg-amber-500/20 hover:text-amber-400 transition-all"
                        title={isAr ? 'إخفاء من طرفي فقط' : 'Hide from my view only'}
                      >
                        {deleting === s.id ? (
                          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <EyeOff size={14} />
                        )}
                      </button>
                    )}

                    {/* العميل: زر حذف فقط على اقتراحاته */}
                    {!isDeveloper && isOwn && (
                      <button
                        onClick={() => handleClientDeleteOne(s.id)}
                        disabled={deleting === s.id}
                        className="p-2 rounded-xl bg-red-500/10 text-red-400/60 hover:bg-red-500/20 hover:text-red-400 transition-all"
                        title={isAr ? 'حذف' : 'Delete'}
                      >
                        {deleting === s.id ? (
                          <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    )}

                    {/* تصويت */}
                    <button
                      onClick={() => handleVote(s)}
                      disabled={hasVoted}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                        hasVoted
                          ? 'bg-[#F59E0B]/20 text-[#F59E0B] cursor-default'
                          : 'bg-white/5 text-white/40 hover:bg-[#F59E0B]/10 hover:text-[#F59E0B]'
                      }`}
                    >
                      <ThumbsUp size={16} />
                      <span className="text-xs font-black">{s.votes}</span>
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${implementable ? 'bg-[#F59E0B]' : 'bg-white/20'}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-white/30 font-bold">
                    <span>{pct}% {isAr ? 'من الأصوات' : 'of votes'}</span>
                    {implementable && <span>{isAr ? '✓ سيُطبق' : '✓ Will be implemented'}</span>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
