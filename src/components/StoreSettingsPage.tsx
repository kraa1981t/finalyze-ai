import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Trash2, Check, Upload, FileText, X, ImagePlus, Pencil, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { StoreBot, fetchStoreBots, addStoreBot, updateStoreBot, deleteStoreBot, formatFileSize, resizeImageToStandard, PendingPayment, fetchPendingPayments, approvePendingPayment, rejectPendingPayment } from '../services/storeService';

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
  const [priceInput, setPriceInput] = useState('');
  const [file, setFile] = useState<{ fileName: string; fileType: string; fileSize: number; fileData: string } | null>(null);
  const [image, setImage] = useState<{ fileName: string; fileData: string } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingBot, setEditingBot] = useState<StoreBot | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    fetchStoreBots().then((list) => { setBots(list); setLoading(false); });
    fetchPendingPayments().then((list) => setPendingPayments(list));
  };

  useEffect(() => { refresh(); }, []);

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
    if (!name.trim()) { setError(isAr ? 'أدخل اسم البوت' : 'Enter the bot name'); return; }
    if (!file) { setError(isAr ? 'اختر ملف البوت (أي نوع)' : 'Choose the bot file (any type)'); return; }
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
          fileName: file.fileName,
          fileType: file.fileType,
          fileSize: file.fileSize,
          fileData: file.fileData,
          imageData: image?.fileData || '',
        });
        setSuccess(isAr ? '✅ تم تحديث البوت بنجاح' : '✅ Bot updated successfully');
      } else {
        await addStoreBot({
          name: name.trim(),
          description: description.trim(),
          price: cents,
          fileName: file.fileName,
          fileType: file.fileType,
          fileSize: file.fileSize,
          fileData: file.fileData,
          imageData: image?.fileData || '',
          createdAt: Date.now(),
        });
        setSuccess(isAr ? '✅ تمت إضافة البوت بنجاح' : '✅ Bot added successfully');
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

  const formatPrice = (price: number) => (price <= 0 ? 'مجاني' : `$${(price / 100).toFixed(2)}`);

  return (
    <div className="max-w-4xl mx-auto px-4 pb-16">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-[30px] font-black text-white">{isAr ? 'إعدادات متجر البوتات والمؤشرات' : 'Bots & Indicators Store Settings'}</h2>
      </div>

      {/* Pending payment approvals */}
      {pendingPayments.some((p) => p.status === 'pending') && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 mb-8"
        >
          <h3 className="text-2xl font-black uppercase text-amber-400 tracking-widest mb-4 flex items-center gap-2">
            <Clock size={20} />
            {isAr ? `طلبات انتظار الموافقة (${pendingPayments.filter((p) => p.status === 'pending').length})` : `Pending Approvals (${pendingPayments.filter((p) => p.status === 'pending').length})`}
          </h3>
          <div className="space-y-3">
            {pendingPayments.filter((p) => p.status === 'pending').map((p) => (
              <div key={p.id} className="bg-black/40 border border-amber-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[28px] font-black text-white truncate">{p.botName}</p>
                  <p className="text-[15px] text-slate-400">💰 ${(p.price / 100).toFixed(2)}</p>
                  <p className="text-[15px] text-slate-500">📧 {p.buyerEmail || '—'} · {new Date(p.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={async () => { await approvePendingPayment(p.id); refresh(); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-black font-black text-[15px] uppercase transition-all hover:bg-emerald-400 active:scale-95"
                  >
                    <CheckCircle2 size={16} />
                    {isAr ? 'موافقة' : 'Approve'}
                  </button>
                  <button
                    onClick={async () => { await rejectPendingPayment(p.id); refresh(); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/40 text-red-400 font-black text-[15px] uppercase transition-all hover:bg-red-500/20 active:scale-95"
                  >
                    <XCircle size={16} />
                    {isAr ? 'رفض' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Add form */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8"
      >
        <h3 className="text-2xl font-black uppercase text-amber-400 tracking-widest mb-4">{editingBot ? (isAr ? 'تعديل بوت' : 'Edit Bot') : (isAr ? 'إضافة بوت جديد' : 'Add New Bot')}</h3>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-2xl rounded-xl px-4 py-3 mb-4">{error}</div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-2xl rounded-xl px-4 py-3 mb-4">{success}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-[15px] font-black text-slate-400 mb-1.5 block">{isAr ? 'اسم البوت' : 'Bot Name'}</label>
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
            <label className="text-[15px] font-black text-slate-400 mb-1.5 block">{isAr ? 'ملف البوت (أي نوع ملف)' : 'Bot File (any file type)'}</label>
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
        {isAr ? `البوتات في المتجر (${bots.length})` : `Bots in store (${bots.length})`}
      </h3>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 rounded-full border-4 border-amber-500/30 border-t-amber-500 animate-spin" />
        </div>
      ) : bots.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-2xl">
          {isAr ? 'لا توجد بوتات بعد. أضف أول بوت من الأعلى.' : 'No bots yet. Add the first one above.'}
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
                    <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-lg text-[15px] font-black uppercase border ${bot.price <= 0 ? 'text-emerald-400 border-emerald-400/50 bg-emerald-500/10' : 'text-amber-400 border-amber-400/50 bg-amber-500/10'}`}>
                      {formatPrice(bot.price)}
                    </span>
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