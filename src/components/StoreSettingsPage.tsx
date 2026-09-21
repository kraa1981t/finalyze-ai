import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Trash2, Check, Upload, FileText, X, ImagePlus, Pencil, Wallet, Copy } from 'lucide-react';
import { StoreBot, StoreCategory, STORE_CATEGORIES, fetchStoreBots, addStoreBot, updateStoreBot, deleteStoreBot, formatFileSize, resizeImageToStandard } from '../services/storeService';
import { loadPaymentSettings, savePaymentSettings, PaymentAddress, PAYMENT_METHODS } from '../services/paymentSettings';

interface StoreSettingsPageProps {
  lang: 'ar' | 'en';
  onBack: () => void;
}

const MAX_FILE_BYTES = 300 * 1024;
const MAX_DOC_BYTES = 900 * 1024;

export default function StoreSettingsPage({ lang, onBack }: StoreSettingsPageProps) {
  const isAr = lang === 'ar';
  const [bots, setBots] = useState<StoreBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<StoreCategory>('bot');
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

  const refresh = () => {
    fetchStoreBots().then((list) => { setBots(list); setLoading(false); });
  };

  useEffect(() => { refresh(); }, []);

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
          price: cents,
          category,
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
          price: cents,
          category,
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
    setDescription(bot.description);
    setCategory(bot.category || 'bot');
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

  const formatPrice = (price: number) => (price <= 0 ? 'مجاني' : `$${(price / 100).toFixed(2)}`);

  return (
    <div className="max-w-4xl mx-auto px-4 pb-16">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-[30px] font-black text-white">{isAr ? 'إعدادات المتجر' : 'Store Settings'}</h2>
      </div>

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
            <label className="text-[15px] font-black text-slate-400 mb-1.5 block">{isAr ? 'وصف قصير' : 'Short Description'}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={isAr ? 'وصف مختصر لما يقدمه البوت...' : 'Short description of what the bot does...'}
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
                  onClick={() => setCategory(c.key)}
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
            <p className="text-[13px] text-slate-500 mt-1.5">{isAr ? 'يظهر المنتج في هذا القسم داخل المتجر، مع صفين: مجاني (سعر 0) أعلى ثم مدفوع.' : 'The product appears under this section in the store, with two rows: free (price 0) on top then paid.'}</p>
          </div>

          <div>
            <label className="text-[15px] font-black text-slate-400 mb-1.5 block">{isAr ? 'السعر (اضبط 0 للمجاني)' : 'Price (0 = Free)'}</label>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-white">$</span>
              <input
                type="number"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-40 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-2xl text-white outline-none focus:border-amber-500"
              />
              <span className="text-[15px] text-slate-500">{isAr ? 'أدنى سعر 1 سنت' : 'Minimum price 1 cent'}</span>
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
              {!image && <span className="text-[15px] text-slate-500">{isAr ? 'جميع الصور تُحجَّم تلقائياً لحجم موحّد بأبعاد أفقية أنيقة' : 'All images are auto-resized to one elegant horizontal size'}</span>}
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
                : (isAr ? 'إضافة البوت' : 'Add Bot')}
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
        {isAr ? `المنتجات في المتجر (${bots.length})` : `Products in store (${bots.length})`}
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
                {bot.description && <p className="text-[15px] text-slate-400 mt-3 leading-relaxed">{bot.description}</p>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}