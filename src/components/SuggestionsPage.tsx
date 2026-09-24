import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Lightbulb, Plus, Check, User, ThumbsUp, Trophy, X, Trash2, AlertTriangle } from 'lucide-react';
import { Language } from '../lib/i18n';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, increment, serverTimestamp, query, where, setDoc } from 'firebase/firestore';
import { lt, ltp, pick, pkick, loc } from '../lib/i18nUI';

interface Suggestion {
  id: string;
  name: string;
  text: string;
  votes: number;
  voters: string[];
  createdAt: any;
  _type?: string;
}

interface SuggestionsPageProps {
  lang: Language;
  onBack: () => void;
  userName?: string;
  isDeveloper?: boolean;
  onClearCount?: () => void;
  onHideCount?: (n: number) => void;
}

export default function SuggestionsPage({ lang, onBack, userName, isDeveloper = false, onClearCount, onHideCount }: SuggestionsPageProps) {
  const isAr = lang === 'ar';
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(userName || '');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const hiddenDocId = isDeveloper ? 'dev_hidden_suggestions' : `hidden_${userName || 'anonymous'}`;

  const fetchHidden = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'userPreferences'), where('__name__', '==', hiddenDocId)));
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setHiddenIds(new Set(data.hiddenIds || []));
      }
    } catch {}
  };

  const saveHidden = async (ids: Set<string>) => {
    try {
      await setDoc(doc(db, 'userPreferences', hiddenDocId), { hiddenIds: [...ids] }, { merge: true });
    } catch {}
  };

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
        } as Suggestion;
      }).sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
      setSuggestions(data);
    } catch (err: any) {
      console.error('Failed to fetch suggestions:', err);
      setError(lt(lang, 251));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
    if (isDeveloper) {
      fetchHidden();
      if (onClearCount) onClearCount();
    }
  }, []);

  const visibleSuggestions = isDeveloper ? suggestions.filter(s => !hiddenIds.has(s.id)) : suggestions;
  const totalVotes = visibleSuggestions.reduce((sum, s) => sum + s.votes, 0);

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
        createdAt: serverTimestamp()
      });
      setText('');
      setShowForm(false);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      await fetchSuggestions();
    } catch (err: any) {
      console.error('Failed to submit suggestion:', err);
      setError(lt(lang, 252));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (suggestion: Suggestion) => {
    const voterId = userName || 'anonymous';
    if (suggestion.voters?.includes(voterId)) return;
    try {
      const ref = doc(db, 'analysisResults', suggestion.id);
      await updateDoc(ref, {
        votes: increment(1),
        voters: [...(suggestion.voters || []), voterId]
      });
      await fetchSuggestions();
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  const handleDeleteOne = async (id: string) => {
    setDeleting(id);
    try {
      if (isDeveloper) {
        const newHidden = new Set(hiddenIds);
        newHidden.add(id);
        setHiddenIds(newHidden);
        await saveHidden(newHidden);
        if (onHideCount) onHideCount(1);
      } else {
        await deleteDoc(doc(db, 'analysisResults', id));
        await fetchSuggestions();
      }
    } catch (err) {
      console.error('Failed to delete:', err);
      setError(lt(lang, 248));
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting('all');
    try {
      if (isDeveloper) {
        const newHidden = new Set(hiddenIds);
        const toHide = visibleSuggestions.length;
        visibleSuggestions.forEach(s => newHidden.add(s.id));
        setHiddenIds(newHidden);
        await saveHidden(newHidden);
        if (onHideCount) onHideCount(toHide);
      } else {
        const promises = suggestions.map(s => deleteDoc(doc(db, 'analysisResults', s.id)));
        await Promise.all(promises);
        await fetchSuggestions();
      }
      setConfirmDeleteAll(false);
    } catch (err) {
      console.error('Failed to delete all:', err);
      setError(lt(lang, 249));
    } finally {
      setDeleting(null);
    }
  };

  const canDelete = (s: Suggestion) => {
    if (isDeveloper) return true;
    return s.name === userName;
  };

  const getPercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const isImplementable = (votes: number) => {
    return totalVotes > 0 && getPercentage(votes) >= 50;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
      >
        <ArrowLeft size={20} className={`group-hover:-translate-x-1 transition-transform ${isAr ? 'rotate-180' : ''}`} />
        <span className="text-sm font-bold">{lt(lang, 97)}</span>
      </button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="w-20 h-20 mx-auto bg-[#F59E0B]/20 rounded-3xl flex items-center justify-center border border-[#F59E0B]/30">
          <Lightbulb size={40} className="text-[#F59E0B]" />
        </div>
        <h1 className="text-3xl font-black text-white">
          {isDeveloper
            ? (lt(lang, 142))
            : (lt(lang, 633))}
        </h1>
        <p className="text-white/60 text-sm max-w-2xl mx-auto">
          {isDeveloper
            ? (lt(lang, 309))
            : (lt(lang, 506))}
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-brand-alt rounded-2xl border border-white/10 p-4 text-center">
          <div className="text-2xl font-black text-[#F59E0B]">{visibleSuggestions.length}</div>
          <div className="text-xs text-white/40 font-bold">{lt(lang, 568)}</div>
        </div>
        <div className="bg-brand-alt rounded-2xl border border-white/10 p-4 text-center">
          <div className="text-2xl font-black text-[#F59E0B]">{totalVotes}</div>
          <div className="text-xs text-white/40 font-bold">{lt(lang, 570)}</div>
        </div>
        <div className="bg-brand-alt rounded-2xl border border-white/10 p-4 text-center">
          <div className="text-2xl font-black text-[#F59E0B]">
            {visibleSuggestions.filter(s => isImplementable(s.votes)).length}
          </div>
          <div className="text-xs text-white/40 font-bold">{lt(lang, 282)}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center gap-3">
        {!isDeveloper && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-[#F59E0B] text-black px-6 py-3 rounded-xl font-black text-sm hover:bg-[#d97706] transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            <Plus size={18} />
            {lt(lang, 65)}
          </button>
        )}
        {isDeveloper && visibleSuggestions.length > 0 && (
          <>
            {confirmDeleteAll ? (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-3">
                <AlertTriangle size={18} className="text-red-400" />
                <span className="text-sm font-bold text-red-400">
                  {lt(lang, 198)}
                </span>
                <button
                  onClick={handleDeleteAll}
                  disabled={deleting === 'all'}
                  className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-xs font-black hover:bg-red-600 transition-all"
                >
                  {deleting === 'all' ? (lt(lang, 200)) : (lt(lang, 625))}
                </button>
                <button
                  onClick={() => setConfirmDeleteAll(false)}
                  className="bg-white/10 text-white px-4 py-1.5 rounded-lg text-xs font-black hover:bg-white/20 transition-all"
                >
                  {lt(lang, 120)}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/40 text-red-400 px-6 py-3 rounded-xl font-black text-sm hover:bg-red-500/30 transition-all"
              >
                <Trash2 size={18} />
                {lt(lang, 197)}
              </button>
            )}
          </>
        )}
      </div>

      {/* Success message */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-5 py-3 flex items-center justify-center gap-3"
          >
            <Check size={20} className="text-emerald-400" />
            <span className="text-sm font-black text-emerald-400">
              {lt(lang, 632)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3 flex items-center justify-center gap-3"
          >
            <X size={20} className="text-red-400" />
            <span className="text-sm font-black text-red-400">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-brand-alt rounded-3xl border border-white/10 p-6 w-full max-w-md space-y-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white">
                  {lt(lang, 353)}
                </h3>
                <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-white/60 block mb-1.5">
                    {lt(lang, 628)}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={lt(lang, 239)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-white/60 block mb-1.5">
                    {lt(lang, 631)}
                  </label>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder={lt(lang, 623)}
                    required
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#F59E0B]/50 resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || !name.trim() || !text.trim()}
                  className="w-full bg-[#F59E0B] text-black py-3 rounded-xl font-black text-sm hover:bg-[#d97706] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? (lt(lang, 536))
                    : (lt(lang, 535))}
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
          <p className="text-white/40 text-sm mt-3">{lt(lang, 303)}</p>
        </div>
      ) : visibleSuggestions.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <Lightbulb size={40} className="text-white/20 mx-auto" />
          <p className="text-white/40 text-sm">
            {lt(lang, 372)}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.filter(s => isDeveloper ? !hiddenIds.has(s.id) : true).map((s, i) => {
            const pct = getPercentage(s.votes);
            const implementable = isImplementable(s.votes);
            const hasVoted = s.voters?.includes(userName || 'anonymous');
            const isOwn = canDelete(s);
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
                          {lt(lang, 283)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed">{s.text}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOwn && (
                      <button
                        onClick={() => handleDeleteOne(s.id)}
                        disabled={deleting === s.id}
                        className="p-2 rounded-xl bg-red-500/10 text-red-400/60 hover:bg-red-500/20 hover:text-red-400 transition-all"
                        title={lt(lang, 196)}
                      >
                        {deleting === s.id ? (
                          <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    )}
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
                      className={`h-full rounded-full transition-all duration-500 ${
                        implementable ? 'bg-[#F59E0B]' : 'bg-white/20'
                      }`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-white/30 font-bold">
                    <span>{pct}% {lt(lang, 381)}</span>
                    {implementable && <span>{lt(lang, 21)}</span>}
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
