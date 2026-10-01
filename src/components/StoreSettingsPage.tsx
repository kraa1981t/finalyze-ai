import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Trash2, Check, Upload, FileText, X, ImagePlus, Pencil, Wallet, Copy, Crown, Shield, ShieldOff, Timer } from 'lucide-react';
import { StoreBot, StoreCategory, STORE_CATEGORIES, typesForCategory, fetchStoreBots, addStoreBot, updateStoreBot, deleteStoreBot, formatFileSize, resizeImageToStandard } from '../services/storeService';
import { loadPaymentSettings, savePaymentSettings, PaymentAddress, PAYMENT_METHODS } from '../services/paymentSettings';
import { StorePlan, fallbackPlans, fetchPlans, addStorePlan, updateStorePlan, deleteStorePlan, planLabel, toWesternDigits } from '../services/storePlans';

interface StoreSettingsPageProps {
  lang: 'ar' | 'en';
  onBack: () => void;
  freemiumDisabled?: boolean;
  onFreemiumToggle?: (v: boolean) => void;
}

const MAX_FILE_BYTES = 300 * 1024;
const MAX_DOC_BYTES = 900 * 1024;
const DEFAULT_PRICES = { weekly: 2, monthly: 6, yearly: 60 };
const SUBSCRIPTION_STORAGE_KEY = 'subscription_prices';
const TIMER_STORAGE_KEY = 'payment_timer_minutes';

export default function StoreSettingsPage({ lang, onBack, freemiumDisabled: externalFreemium, onFreemiumToggle }: StoreSettingsPageProps) {
  const isAr = lang === 'ar';
  const [freemiumDisabled, setFreemiumDisabled] = useState(externalFreemium ?? localStorage.getItem('finalyze_freemium_disabled') === 'true');
  const [editSubPrices, setEditSubPrices] = useState(() => {
    try { const s = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY); return s ? JSON.parse(toWesternDigits(s)) : DEFAULT_PRICES; }
    catch { return DEFAULT_PRICES; }
  });
  const [editTimer, setEditTimer] = useState(() => {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY);
    return saved ? parseInt(toWesternDigits(saved)) : 30;
  });
  const [bots, setBots] = useState<StoreBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [category, setCategory] = useState<StoreCategory>('bot');
  const [type, setType] = useState<string>('');
  const [priceInput, setPriceInput] = useState('');
  const [file, setFile] = useState<{ fileName: string; fileType: string; fileSize: number; fileData: string } | null>(null);
  const [image, setImage] = useState<{ fileName: string; fileData: string } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingBot, setEditingBot] = useState<StoreBot | null>(null);
  const [addresses, setAddresses] = useState<PaymentAddress[]>([]);
  const [editingMethod, setEditingMethod] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState('');
  const [copiedMethod, setCopiedMethod] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [plans, setPlans] = useState<StorePlan[]>(fallbackPlans());
  const [planMsg, setPlanMsg] = useState('');

  const refresh = () => {
    fetchStoreBots().then((list) => { setBots(list); setLoading(false); });
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    fetchPlans().then((list) => { try { setPlans(list); } catch {} });
  }, []);

  const patchPlan = (id: string | undefined, patch: Partial<Omit<StorePlan, 'id'>>) => {
    const sanitizedPatch: any = { ...patch };
    if (patch.priceUsd !== undefined) sanitizedPatch.priceUsd = Number(toWesternDigits(patch.priceUsd)) || 0;
    if (patch.durationDays !== undefined) sanitizedPatch.durationDays = Math.max(1, Math.round(Number(toWesternDigits(patch.durationDays)) || 1));
    if (patch.labelAr !== undefined) sanitizedPatch.labelAr = toWesternDigits(patch.labelAr);
    if (patch.labelEn !== undefined) sanitizedPatch.labelEn = toWesternDigits(patch.labelEn);
    if (patch.badgeAr !== undefined) sanitizedPatch.badgeAr = toWesternDigits(patch.badgeAr);
    if (patch.badgeEn !== undefined) sanitizedPatch.badgeEn = toWesternDigits(patch.badgeEn);
    if (patch.featuresAr !== undefined) sanitizedPatch.featuresAr = toWesternDigits(patch.featuresAr);
    if (patch.featuresEn !== undefined) sanitizedPatch.featuresEn = toWesternDigits(patch.featuresEn);
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...sanitizedPatch } : p)));
  };

  const addEmptyPlan = () => {
    const key = 'custom_' + Date.now();
    setPlans((prev) => [...prev, { key, labelAr: '', labelEn: '', durationDays: 30, priceUsd: 5, badgeAr: '', badgeEn: '', featuresAr: '', featuresEn: '', active: true, sortOrder: prev.length + 1, createdAt: Date.now() }]);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const savePlan = async (plan: StorePlan) => {
    if (!plan.labelAr.trim() && !plan.labelEn.trim()) {
      setPlanMsg(isAr ? 'أدخل اسم الخطة على الأقل (عربي أو إنجليزي)' : 'Enter at least a plan name (AR or EN)');
      return;
    }
    try {
      const data: Omit<StorePlan, 'id'> = {
        key: plan.key,
        labelAr: toWesternDigits(plan.labelAr.trim()),
        labelEn: toWesternDigits(plan.labelEn.trim()),
        durationDays: Math.max(1, Math.round(Number(toWesternDigits(plan.durationDays)) || 30)),
        priceUsd: Math.max(0, Number(toWesternDigits(plan.priceUsd)) || 0),
        badgeAr: toWesternDigits(plan.badgeAr || ''),
        badgeEn: toWesternDigits(plan.badgeEn || ''),
        featuresAr: toWesternDigits(plan.featuresAr),
        featuresEn: toWesternDigits(plan.featuresEn),
        active: plan.active,
        sortOrder: plan.sortOrder,
        createdAt: plan.createdAt || Date.now(),
      };
      const realId = !plan.id?.startsWith('default_') ? plan.id : undefined;
      if (realId) {
        await updateStorePlan(realId, data);
        setPlans((prev) => prev.map((p) => (p.id === realId ? { ...p, ...data } : p)));
      } else {
        const newId = await addStorePlan(data);
        setPlans((prev) => prev.map((p) => (p.id === plan.id ? { ...p, id: newId, ...data } : p)));
      }
      setPlanMsg(isAr ? '✅ تم حفظ الخطة' : '✅ Plan saved');
      setTimeout(() => setPlanMsg(''), 3000);
    } catch (err: any) {
      setPlanMsg(isAr ? '❌ فشل الحفظ: ' + (err?.message || '') : '❌ Save failed: ' + (err?.message || ''));
    }
  };

  const removePlan = async (plan: StorePlan) => {
    if (plan.id?.startsWith('default_')) {
      setPlanMsg(isAr ? 'لا يمكن حذف خطة افتراضية — عطّلها بدلاً من ذلك' : 'Default plans cannot be deleted — deactivate them instead');
      return;
    }
    try {
      if (plan.id) await deleteStorePlan(plan.id);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    } catch {}
  };

  useEffect(() => {
    loadPaymentSettings().then(data => {
      if (data?.addresses && data.addresses.length) {
        setAddresses(data.addresses);
      }
    });
  }, []);

  const handleFile = (f: File) => {
    if (f.size > MAX_FILE_BYTES) {
      setError(isAr ? 'الملف أكبر من 400 كيلوبايت. يرجى اختيار ملف أصغر.' : 'File exceeds 400 KB. Please choose a smaller file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFile({ fileName: f.name, fileType: f.type || 'application/octet-stream', fileSize: f.size, fileData: reader.result as string });
      setError('');
    };
    reader.readAsDataURL(f);
  };

  const handleImage = async (f: File) => {
    if (!f.type.startsWith('image/')) {
      setError(isAr ? 'الملف المختار ليس صورة. اختر صورة صالحة.' : 'Selected file is not an image. Choose a valid image.');
      return;
    }
    setSuccess('');
    try {
      const dataUrl = await resizeImageToStandard(f);
      setImage({ fileName: f.name, fileData: dataUrl });
      setError('');
    } catch {
      setError(isAr ? 'تعذر قراءة الصورة. اختر صورة صالحة.' : 'Could not read the image. Choose a valid image.');
    }
  };

  const handleAdd = async () => {
    if (!name.trim()) { setError(isAr ? 'أدخل اسم المنتج' : 'Enter the product name'); return; }
    if (!file) { setError(isAr ? 'اختر ملف المنتج (أي نوع)' : 'Choose the product file (any type)'); return; }
    const cents = Math.max(0, Math.round((parseFloat(priceInput) || 0) * 100));
    setAdding(true);
    try {
      if (new Blob([file.fileData, image?.fileData || '']).size > MAX_DOC_BYTES) {
        setError(isAr ? 'حجم الملف مع الصورة كبير جداً. اختر ملف أصغر أو صورة أخف.' : 'File + image total is too large. Choose a smaller file or lighter image.');
        setAdding(false);
        return;
      }
      if (editingBot) {
        await updateStoreBot(editingBot.id!, {
          name: name.trim(),
          description: description.trim(),
          descriptionAr: description.trim(),
          descriptionEn: descriptionEn.trim(),
          price: cents,
          category,
          type,
          fileName: file.fileName,
          fileType: file.fileType,
          fileSize: file.fileSize,
          fileData: file.fileData,
          imageData: image?.fileData || '',
        });
        setSuccess(isAr ? '✅ تم تحديث المنتج بنجاح' : '✅ Product updated successfully');
      } else {
        await addStoreBot({
          name: name.trim(),
          description: description.trim(),
          descriptionAr: description.trim(),
          descriptionEn: descriptionEn.trim(),
          price: cents,
          category,
          type,
          fileName: file.fileName,
          fileType: file.fileType,
          fileSize: file.fileSize,
          fileData: file.fileData,
          imageData: image?.fileData || '',
          createdAt: Date.now(),
        });
        setSuccess(isAr ? '✅ تمت إضافة المنتج بنجاح' : '✅ Product added successfully');
      }
      resetForm();
      refresh();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      const msg = err?.message || '';
      setError(isAr ? 'فشل الإضافة: ' + msg : 'Failed to add: ' + msg);
    }
    setAdding(false);
  };

  const handleEdit = (bot: StoreBot) => {
    setEditingBot(bot);
    setName(bot.name);
    setDescription(bot.descriptionAr || bot.description);
    setDescriptionEn(bot.descriptionEn || (bot.descriptionAr ? '' : bot.description));
    setCategory(bot.category || 'bot');
    setType(bot.type || '');
    setPriceInput(bot.price > 0 ? (bot.price / 100).toString() : '');
    setFile({ fileName: bot.fileName, fileType: bot.fileType, fileSize: bot.fileSize, fileData: bot.fileData });
    setImage(bot.imageData ? { fileName: bot.fileName, fileData: bot.imageData } : null);
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setDescriptionEn('');
    setCategory('bot');
    setPriceInput('');
    setFile(null);
    setImage(null);
    setEditingBot(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleDelete = async (id: string) => {
    if (confirmId !== id) { setConfirmId(id); setTimeout(() => setConfirmId(null), 3000); return; }
    try {
      await deleteStoreBot(id);
      setBots((prev) => prev.filter((b) => b.id !== id));
      setConfirmId(null);
    } catch {}
  };

  const handleSaveAddress = async (method: string) => {
    const def = PAYMENT_METHODS.find(m => m.method === method);
    if (!def) return;
    const updated = addresses.map(a => a.method === method ? { ...a, address: editingAddress } : a);
    if (!updated.find(a => a.method === method)) {
      updated.push({ method, label: def.label, symbol: def.symbol, stable: def.stable, address: editingAddress });
    }
    setAddresses(updated);
    await savePaymentSettings({ addresses: updated });
    setEditingMethod(null);
    setEditingAddress('');
  };

  const handleDeleteAddress = async (method: string) => {
    const updated = addresses.filter(a => a.method !== method);
    setAddresses(updated);
    await savePaymentSettings({ addresses: updated });
  };

  const copyAddress = async (addr: string, method: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedMethod(method);
      setTimeout(() => setCopiedMethod(null), 2000);
    } catch {}
  };

  const formatPrice = (price: number) => (price <= 0 ? (isAr ? 'مجاني' : 'Free') : `$${toWesternDigits((price / 100).toFixed(2))}`);

  const saveSubPrices = () => {
    const clean = {
      weekly: Math.max(0.01, Number(toWesternDigits(editSubPrices.weekly)) || DEFAULT_PRICES.weekly),
      monthly: Math.max(0.01, Number(toWesternDigits(editSubPrices.monthly)) || DEFAULT_PRICES.monthly),
      yearly: Math.max(0.01, Number(toWesternDigits(editSubPrices.yearly)) || DEFAULT_PRICES.yearly),
    };
    setEditSubPrices(clean);
    localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(clean));
    setSuccess(isAr ? '✅ تم حفظ أسعار الخطط' : '✅ Plan prices saved');
    setTimeout(() => setSuccess(''), 3000);
  };

  const saveTimer = () => {
    const mins = Math.max(1, Number(toWesternDigits(editTimer)) || 30);
    setEditTimer(mins);
    localStorage.setItem(TIMER_STORAGE_KEY, String(mins));
    setSuccess(isAr ? `✅ تم حفظ مدة المهلة: ${mins} دقيقة` : `✅ Wait period saved: ${mins} minutes`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const toggleFreemium = () => {
    const newVal = !freemiumDisabled;
    setFreemiumDisabled(newVal);
    localStorage.setItem('finalyze_freemium_disabled', newVal ? 'true' : 'false');
    localStorage.setItem('finalyze_hide_plans', newVal ? 'true' : 'false');
    window.dispatchEvent(new Event('freemium-toggle'));
    onFreemiumToggle?.(newVal);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-16">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-[30px] font-black text-white">{isAr ? 'إعدادات المتجر' : 'Store Settings'}</h2>
      </div>

      {/* Plans & Payment — managed entirely from Store Settings */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8"
      >
        <h3 className="text-2xl font-black uppercase text-amber-400 tracking-widest mb-1 flex items-center gap-3">
          <Crown size={24} />
          {isAr ? 'الدفع والخطط' : 'Payments & Plans'}
        </h3>
        <p className="text-sm text-slate-400 mb-6">
          {isAr
            ? 'كل ما يخص البيع والدفع هنا: أسعار الخطط، تفعيل/تعطيل الخطط للعملاء، ومدة مهلة الدفع.'
            : 'Everything about selling and payments lives here: plan prices, enabling/disabling plans for clients, and the payment wait period.'}
        </p>

        {/* Enable / disable plans for clients */}
        <div className="bg-black/20 border border-white/10 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h5 className="text-lg font-black text-white">
                {isAr ? 'تفعيل / تعطيل الخطط للعملاء' : 'Enable / Disable Plans for Clients'}
              </h5>
              <p className="text-sm text-slate-400 mt-1">
                {freemiumDisabled
                  ? (isAr ? 'المفعّل الآن: جميع المنتجات مجانية ولا تظهر خطط للعملاء.' : 'Currently ON: all products free and plans are hidden from clients.')
                  : (isAr ? 'المعطّل الآن: الخطط مرئية والقيود مفعلة للعملاء.' : 'Currently OFF: plans are visible and restrictions are active for clients.')}
              </p>
            </div>
            <button
              onClick={toggleFreemium}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg ${
                freemiumDisabled
                  ? 'bg-emerald-500 text-white shadow-emerald-500/40'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}
            >
              {freemiumDisabled ? <Shield size={18} /> : <ShieldOff size={18} />}
              {freemiumDisabled
                ? (isAr ? 'مفعّل: وصول كامل' : 'ON: Full Access')
                : (isAr ? 'معطّل: قيود مفعلة' : 'OFF: Restricted')}
            </button>
          </div>
        </div>

        {/* Plan prices */}
        <div className="bg-black/20 border border-white/10 rounded-xl p-4 mb-4">
          <h5 className="text-lg font-black text-white mb-3">{isAr ? 'أسعار الخطط' : 'Plan Prices'}</h5>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['weekly', 'monthly', 'yearly'] as const).map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-base font-black text-slate-300 uppercase w-24">
                  {isAr ? (key === 'weekly' ? 'أسبوعي' : key === 'monthly' ? 'شهري' : 'سنوي') : (key === 'weekly' ? 'Weekly' : key === 'monthly' ? 'Monthly' : 'Yearly')}
                </span>
                <div className="flex items-center gap-1" dir="ltr">
                  <span className="text-lg font-black text-white">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    dir="ltr"
                    value={toWesternDigits(editSubPrices[key])}
                    onChange={(e) => setEditSubPrices({ ...editSubPrices, [key]: toWesternDigits(e.target.value) })}
                    className="w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-lg font-bold font-mono tabular-nums text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={saveSubPrices}
            className="mt-4 flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-base font-black"
          >
            <Check size={16} /> {isAr ? 'حفظ أسعار الخطط' : 'Save Plan Prices'}
          </button>
        </div>

        {/* Payment wait period */}
        <div className="bg-black/20 border border-white/10 rounded-xl p-4">
          <h5 className="text-lg font-black text-white mb-3 flex items-center gap-2">
            <Timer size={18} className="text-emerald-400" />
            {isAr ? 'مدة مهلة الدفع' : 'Payment Wait Period'}
          </h5>
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="numeric"
              dir="ltr"
              value={toWesternDigits(editTimer)}
              onChange={(e) => setEditTimer(toWesternDigits(e.target.value) as any)}
              className="w-24 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-lg font-bold font-mono tabular-nums text-white outline-none focus:border-emerald-500"
            />
            <span className="text-base text-slate-400">{isAr ? 'دقيقة' : 'minutes'}</span>
            <button
              onClick={saveTimer}
              className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-base font-black"
            >
              {isAr ? 'حفظ' : 'Save'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Payment Addresses */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8"
      >
        <h3 className="text-2xl font-black uppercase text-emerald-400 tracking-widest mb-4 flex items-center gap-3">
          <Wallet size={24} />
          {isAr ? 'عناوين الدفع' : 'Payment Addresses'}
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          {isAr
            ? 'أضف عنواناً لكل شبكة USDT (العملات المستقرة فقط). ثابتة بسعر 1 USDT = $1 فلا حاجة لتحويل الأسعار. تأكيد الدفع يدوي بالكامل من طرفك.'
            : 'Add a wallet address for each USDT network (stable coins only). Pegged at 1 USDT = $1, no price conversion is needed. Payment confirmation is fully manual on your side.'}
        </p>

        <div className="space-y-3">
          {PAYMENT_METHODS.map(def => {
            const saved = addresses.find(a => a.method === def.method);
            const isEditing = editingMethod === def.method;

            return (
              <div key={def.method} className="bg-black/20 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">{def.label}</span>
                    {!def.stable && (
                      <span className="text-[10px] font-black uppercase bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full px-2 py-0.5">
                        {isAr ? 'سعر متحرك' : 'Volatile'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing && (
                      saved ? (
                        <>
                          <button
                            onClick={() => copyAddress(saved.address, def.method)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-black"
                          >
                            <Copy size={12} />
                            {copiedMethod === def.method ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}
                          </button>
                          <button
                            onClick={() => { setEditingMethod(def.method); setEditingAddress(saved.address); }}
                            className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteAddress(def.method)}
                            className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => { setEditingMethod(def.method); setEditingAddress(''); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-black"
                        >
                          <Plus size={12} />
                          {isAr ? 'إضافة عنوان' : 'Add Address'}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingAddress}
                      onChange={(e) => setEditingAddress(e.target.value)}
                      placeholder={isAr ? 'أدخل عنوان المحفظة' : 'Enter wallet address'}
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => handleSaveAddress(def.method)}
                      disabled={!editingAddress.trim()}
                      className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-black text-xs uppercase hover:bg-emerald-400 transition-all disabled:opacity-50"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => { setEditingMethod(null); setEditingAddress(''); }}
                      className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 font-black text-xs uppercase hover:bg-white/10 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-slate-400 bg-black/30 rounded-lg px-3 py-2 break-all">
                    {saved ? saved.address : <span className="text-red-400">{isAr ? 'لم يتم الإعداد بعد' : 'Not configured yet'}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Subscription plans (customer plans) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <h3 className="text-2xl font-black uppercase text-sky-400 tracking-widest flex items-center gap-3">
            <Crown size={24} />
            {isAr ? 'خطط الاشتراك للعملاء' : 'Customer Subscription Plans'}
          </h3>
          <button
            onClick={addEmptyPlan}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-all text-[15px] font-black"
          >
            <Plus size={16} /> {isAr ? 'إضافة خطة' : 'Add Plan'}
          </button>
        </div>
        <p className="text-sm text-slate-400 mb-5">
          {isAr
            ? 'تظهر هذه الخطط للعملاء في المتجر تحت قسم "الخطط" مع صندوق مميزات قبل الشراء. الحذف متاح للخطط المخصصة فقط.'
            : 'These plans appear to clients in the store under "Plans" with a features box before purchase. Deletion is available for custom plans only.'}
        </p>
        {planMsg && (
          <div className="bg-sky-500/10 border border-sky-500/30 text-sky-200 text-lg rounded-xl px-4 py-2.5 mb-4">{planMsg}</div>
        )}

        <div className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.id || plan.key} className="bg-black/20 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-white uppercase">{planLabel(plan, isAr)}</span>
                  <button
                    onClick={() => patchPlan(plan.id, { active: !plan.active })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase border transition-all ${
                      plan.active ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-white/5 border-white/15 text-slate-500'
                    }`}
                  >
                    {plan.active ? (isAr ? 'نشطة' : 'Active') : (isAr ? 'معطلة' : 'Off')}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => savePlan(plan)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-black"
                  >
                    <Check size={14} /> {isAr ? 'حفظ' : 'Save'}
                  </button>
                  <button onClick={() => removePlan(plan)} className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 block mb-1">{isAr ? 'الاسم (عربي)' : 'Name (AR)'}</label>
                  <input type="text" value={plan.labelAr} onChange={(e) => patchPlan(plan.id, { labelAr: e.target.value })} placeholder={isAr ? 'شهري' : 'Monthly (Arabic)'} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 block mb-1">Name (EN)</label>
                  <input type="text" value={plan.labelEn} onChange={(e) => patchPlan(plan.id, { labelEn: e.target.value })} placeholder="Monthly" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 block mb-1">{isAr ? 'السعر ($)' : 'Price ($)'}</label>
                  <input type="text" inputMode="decimal" value={toWesternDigits(plan.priceUsd)} dir="ltr" onChange={(e) => patchPlan(plan.id, { priceUsd: Number(toWesternDigits(e.target.value)) })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold font-mono tabular-nums text-white outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 block mb-1">{isAr ? 'المدة (يوم)' : 'Duration (days)'}</label>
                  <input type="text" inputMode="numeric" value={toWesternDigits(plan.durationDays)} dir="ltr" onChange={(e) => patchPlan(plan.id, { durationDays: Number(toWesternDigits(e.target.value)) })} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold font-mono tabular-nums text-white outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 block mb-1">{isAr ? 'شارة (عربي)' : 'Badge (AR)'}</label>
                  <input type="text" value={plan.badgeAr || ''} onChange={(e) => patchPlan(plan.id, { badgeAr: e.target.value })} placeholder={isAr ? 'الأكثر شعبية' : 'Popular (Arabic)'} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-sky-500" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 block mb-1">Badge (EN)</label>
                  <input type="text" value={plan.badgeEn || ''} onChange={(e) => patchPlan(plan.id, { badgeEn: e.target.value })} placeholder="Popular" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold text-white outline-none focus:border-sky-500" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 block mb-1">{isAr ? 'المميزات (عربي) — ميزة في كل سطر' : 'Features (AR) — one per line'}</label>
                  <textarea rows={4} value={plan.featuresAr} onChange={(e) => patchPlan(plan.id, { featuresAr: e.target.value })} dir="rtl" placeholder={isAr ? "تحليل احترافي\nإشارات فورية" : "Professional analysis (Arabic)\nInstant alerts (Arabic)"} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 resize-none" />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-slate-500 block mb-1">Features (EN) — one per line</label>
                  <textarea rows={4} value={plan.featuresEn} onChange={(e) => patchPlan(plan.id, { featuresEn: e.target.value })} placeholder="Professional analysis&#10;Instant alerts" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 resize-none" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Add form */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8"
      >
        <h3 className="text-2xl font-black uppercase text-amber-400 tracking-widest mb-4">{editingBot ? (isAr ? 'تعديل منتج' : 'Edit Product') : (isAr ? 'إضافة منتج جديد' : 'Add New Product')}</h3>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-2xl rounded-xl px-4 py-3 mb-4">{error}</div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-2xl rounded-xl px-4 py-3 mb-4">{success}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-[15px] font-black text-slate-400 mb-1.5 block">{isAr ? 'اسم المنتج' : 'Product Name'}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isAr ? 'مثال: بوت الاتجاه الذكي' : 'e.g. Smart Trend Bot'}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-2xl text-white outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-[15px] font-black text-slate-400 mb-1.5 block">{isAr ? 'الوصف (بالعربية)' : 'Description (Arabic)'}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              dir="rtl"
              placeholder={isAr ? 'وصف مختصر لما يقدمه البوت...' : 'Short description of what the bot does...'}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-2xl text-white outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div>
            <label className="text-[15px] font-black text-slate-400 mb-1.5 block">{isAr ? 'الوصف (بالإنجليزية)' : 'Description (English)'}</label>
            <textarea
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              rows={2}
              placeholder={isAr ? 'وصف مختصر بالإنجليزية...' : 'A concise description of what the bot does...'}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-2xl text-white outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div>
            <label className="text-[15px] font-black text-slate-400 mb-1.5 block">{isAr ? 'القسم (التصنيف)' : 'Section (Category)'}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STORE_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => { setCategory(c.key); setType(''); }}
                  className={`px-3 py-2.5 rounded-xl border-2 text-[15px] font-black transition-all ${
                    category === c.key
                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/25'
                  }`}
                >
                  {isAr ? c.labelAr : c.labelEn}
                </button>
              ))}
            </div>

          {typesForCategory(category).length > 0 && (
            <div className="mt-3">
              <label className="text-[15px] font-black text-slate-400 mb-1.5 block">{isAr ? 'نوع المنتج' : 'Product Type'}</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {typesForCategory(category).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setType(type === t.key ? '' : t.key)}
                    className={`px-3 py-2.5 rounded-xl border-2 text-[15px] font-black transition-all ${
                      type === t.key
                        ? 'border-sky-500 bg-sky-500/15 text-sky-400'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/25'
                    }`}
                  >
                    {isAr
                      ? (category === 'bot' ? `بوت ${t.labelAr}` : category === 'indicator' ? `مؤشر ${t.labelAr}` : t.labelAr)
                      : (category === 'bot' ? `Bot ${t.labelEn}` : category === 'indicator' ? `Indicator ${t.labelEn}` : t.labelEn)}
                  </button>
                ))}
              </div>
            </div>
          )}
            <p className="text-[13px] text-slate-500 mt-1.5">{isAr ? 'يظهر المنتج في هذا القسم داخل المتجر، مع صفين: مجاني (سعر $0) أعلى ثم مدفوع.' : 'The product appears under this section in the store, with two rows: free (price $0) on top then paid.'}</p>
          </div>

          <div>
            <label className="text-[15px] font-black text-slate-400 mb-1.5 block">{isAr ? 'السعر (اضبط 0 للمجاني)' : 'Price (0 = Free)'}</label>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-white">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={toWesternDigits(priceInput)}
                onChange={(e) => setPriceInput(toWesternDigits(e.target.value))}
                placeholder="0.00"
                dir="ltr"
                className="w-40 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-2xl font-mono tabular-nums text-white outline-none focus:border-amber-500"
              />
              <span className="text-[15px] text-slate-500">{isAr ? 'أدنى سعر $0.01' : 'Minimum price $0.01'}</span>
            </div>
          </div>

          <div>
            <label className="text-[15px] font-black text-slate-400 mb-1.5 block">{isAr ? 'ملف المنتج (أي نوع ملف)' : 'Product File (any file type)'}</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all text-[15px] font-black"
              >
                <Upload size={16} />
                {isAr ? 'اختر ملف' : 'Choose File'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {file && (
                <span className="flex items-center gap-2 text-[15px] text-slate-300 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                  <FileText size={14} className="text-emerald-400" />
                  <span className="font-bold truncate max-w-[180px]">{file.fileName}</span>
                  <span className="text-slate-500">({formatFileSize(file.fileSize)})</span>
                  <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-slate-500 hover:text-red-400">
                    <X size={14} />
                  </button>
                </span>
              )}
              {!file && <span className="text-[15px] text-slate-500">{isAr ? 'حتى 300 كيلوبايت' : 'Up to 300 KB'}</span>}
            </div>
          </div>

          <div>
            <label className="text-[15px] font-black text-slate-400 mb-1.5 block">{isAr ? 'صورة تعكس آلية عمل البوت (اختياري)' : 'Image showing how the bot works (optional)'}</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-all text-[15px] font-black"
              >
                <ImagePlus size={16} />
                {isAr ? 'اختر صورة' : 'Choose Image'}
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }}
              />
              {image && (
                <div className="flex items-center gap-2">
                  <img src={image.fileData} alt="preview" className="w-28 h-16 object-cover rounded-xl border border-white/10" />
                  <button
                    onClick={() => { setImage(null); if (imageInputRef.current) imageInputRef.current.value = ''; }}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-red-400 transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {!image && <span className="text-[15px] text-slate-500">{isAr ? 'جميع الصور تُحجَّم تلقائياً لحجم موحّد بأبعاد أفقية أنيقة' : 'All images are auto-resized to standard 16:9 ratio'}</span>}
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#F59E0B] text-black font-black text-2xl uppercase tracking-wider shadow-lg shadow-[#F59E0B]/30 hover:bg-[#d97706] active:scale-95 transition-all disabled:opacity-50"
          >
            {editingBot ? <Check size={18} /> : <Plus size={18} />}
            {adding
              ? (isAr ? 'جاري الحفظ...' : 'Saving...')
              : editingBot
                ? (isAr ? 'حفظ التعديلات' : 'Save Changes')
                : (isAr ? 'إضافة المنتج' : 'Add Product')}
          </button>
          {editingBot && (
            <button
              onClick={resetForm}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-black text-xl uppercase tracking-wider hover:bg-white/10 hover:text-white active:scale-95 transition-all"
            >
              <X size={16} />
              {isAr ? 'إلغاء التعديل' : 'Cancel Edit'}
            </button>
          )}
        </div>
      </motion.div>

      {/* Existing bots */}
      <h3 className="text-2xl font-black uppercase text-slate-400 tracking-widest mb-4">
        {isAr ? `المنتجات في المتجر (${toWesternDigits(bots.length)})` : `Products in store (${toWesternDigits(bots.length)})`}
      </h3>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 rounded-full border-4 border-amber-500/30 border-t-amber-500 animate-spin" />
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-2xl">
          {isAr ? 'لا توجد منتجات بعد. أضف أول منتج من الأعلى.' : 'No products yet. Add the first one above.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AnimatePresence>
            {bots.map((bot) => (
              <motion.div
                key={bot.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-[26px] font-black text-white truncate">{bot.name}</h4>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[15px] font-black uppercase border ${bot.price <= 0 ? 'text-emerald-400 border-emerald-400/50 bg-emerald-500/10' : 'text-amber-400 border-amber-400/50 bg-amber-500/10'}`}>
                        {formatPrice(bot.price)}
                      </span>
                      <span className="inline-block px-2.5 py-0.5 rounded-lg text-[13px] font-black uppercase border border-sky-400/50 bg-sky-500/10 text-sky-400">
                        {isAr ? (STORE_CATEGORIES.find(c => c.key === (bot.category || 'bot'))?.labelAr || 'بوتات') : (STORE_CATEGORIES.find(c => c.key === (bot.category || 'bot'))?.labelEn || 'Bots')}
                      </span>
                    </div>
                    {bot.fileName && (
                      <span className="flex items-center gap-1.5 text-[15px] text-slate-400 mt-2">
                        <FileText size={10} /> {bot.fileName} {bot.fileSize ? `(${formatFileSize(bot.fileSize)})` : ''}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleEdit(bot)}
                    className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-[15px] font-black uppercase transition-all bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                  >
                    <Pencil size={14} />
                    {isAr ? 'تعديل' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleDelete(bot.id!)}
                    className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-[15px] font-black uppercase transition-all ${confirmId === bot.id ? 'bg-red-500 text-white' : 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'}`}
                  >
                    {confirmId === bot.id ? (<><Check size={12} /> {isAr ? 'تأكيد' : 'Confirm'}</>) : (<><Trash2 size={12} /> {isAr ? 'حذف' : 'Delete'}</>)}
                  </button>
                </div>
                {bot.imageData && (
                  <img src={bot.imageData} alt={bot.name} className="w-full h-24 object-cover rounded-xl border border-white/10 mt-3" />
                )}
                {bot.description && <p className="text-[15px] text-slate-400 mt-3 leading-relaxed">{isAr ? (bot.descriptionAr || bot.description) : (bot.descriptionEn || bot.description)}</p>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}