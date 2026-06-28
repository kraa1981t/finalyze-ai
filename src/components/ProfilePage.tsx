import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Camera, Upload, Trash2, Image, ArrowLeft, Save, Check } from 'lucide-react';
import { Language } from '../lib/i18n';
import { BASE_URL } from '../lib/firebase';

interface ProfilePageProps {
  user: User | null;
  lang: Language;
  onBack: () => void;
  onAvatarChange?: (dataUrl: string | null) => void;
  onLogoChange?: (dataUrl: string | null) => void;
  isDeveloper?: boolean;
}

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage({ user, lang, onBack, onAvatarChange, onLogoChange, isDeveloper = false }: ProfilePageProps) {
  const [avatar, setAvatar] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [saved, setSaved] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedAvatar = localStorage.getItem('finalyze_custom_avatar');
    const savedLogo = localStorage.getItem('finalyze_custom_logo');
    const savedName = localStorage.getItem('finalyze_custom_name');
    if (savedAvatar) setAvatar(savedAvatar);
    if (savedLogo) setLogo(savedLogo);
    if (savedName) setDisplayName(savedName);
    else if (user?.displayName) setDisplayName(user.displayName);
    else if (user?.email) setDisplayName(user.email.split('@')[0]);
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(lang === 'ar' ? 'حجم الصورة يجب أن يكون أقل من 2 ميجا' : 'Image must be under 2MB');
      return;
    }
    const dataUrl = await readFileAsDataURL(file);
    setAvatar(dataUrl);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert(lang === 'ar' ? 'حجم الشعار يجب أن يكون أقل من 3 ميجا' : 'Logo must be under 3MB');
      return;
    }
    const dataUrl = await readFileAsDataURL(file);
    setLogo(dataUrl);
  };

  const handleSave = () => {
    if (avatar) localStorage.setItem('finalyze_custom_avatar', avatar);
    else localStorage.removeItem('finalyze_custom_avatar');

    if (logo) localStorage.setItem('finalyze_custom_logo', logo);
    else localStorage.removeItem('finalyze_custom_logo');

    localStorage.setItem('finalyze_custom_name', displayName);

    onAvatarChange?.(avatar);
    onLogoChange?.(logo);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRemoveAvatar = () => {
    setAvatar(null);
    localStorage.removeItem('finalyze_custom_avatar');
    onAvatarChange?.(null);
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    localStorage.removeItem('finalyze_custom_logo');
    onLogoChange?.(null);
  };

  return (
    <div className="bg-brand-alt border border-white/10 rounded-[32px] p-6 md:p-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 -ml-2 text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={22} />
        </button>
        <h2 className="text-xl font-black text-white">{lang === 'ar' ? 'الملف الشخصي' : 'Profile'}</h2>
      </div>

      {/* Avatar Section */}
      <div className="mb-8">
        <label className="text-xs font-black uppercase tracking-wider text-white/50 mb-3 block">
          {lang === 'ar' ? 'صورة البروفيل' : 'Profile Picture'}
        </label>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/20 bg-white/5 flex items-center justify-center">
              {avatar ? (
                <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
              ) : user?.photoURL ? (
                <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-black text-white/30">{user?.email?.charAt(0).toUpperCase() || '?'}</span>
              )}
            </div>
            {avatar && (
              <button
                onClick={handleRemoveAvatar}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={12} className="text-white" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F59E0B] text-black rounded-xl font-black text-xs uppercase tracking-wider hover:bg-[#d97706] transition-all shadow-md"
            >
              <Camera size={16} />
              {lang === 'ar' ? 'رفع صورة' : 'Upload Photo'}
            </button>
            <span className="text-[10px] text-white/30">{lang === 'ar' ? ' JPG/PNG - أقل من 2MB' : 'JPG/PNG - under 2MB'}</span>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Logo Section - Developer Only */}
      {isDeveloper && (
        <div className="mb-8">
          <label className="text-xs font-black uppercase tracking-wider text-white/50 mb-3 block">
            {lang === 'ar' ? 'شعار التطبيق' : 'App Logo'}
          </label>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/20 bg-black flex items-center justify-center">
                {logo ? (
                  <img src={logo} alt="logo" className="w-full h-full object-cover" />
                ) : (
                  <img src={`${BASE_URL}logo.png`} alt="logo" className="w-full h-full object-cover" />
                )}
              </div>
              {logo && (
                <button
                  onClick={handleRemoveLogo}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={12} className="text-white" />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => logoInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#F59E0B] text-black rounded-xl font-black text-xs uppercase tracking-wider hover:bg-[#d97706] transition-all shadow-md"
              >
                <Image size={16} />
                {lang === 'ar' ? 'رفع شعار' : 'Upload Logo'}
              </button>
              <span className="text-[10px] text-white/30">{lang === 'ar' ? 'SVG/PNG/JPG - أقل من 3MB' : 'SVG/PNG/JPG - under 3MB'}</span>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/svg+xml,image/png,image/jpeg,image/webp"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Display Name */}
      <div className="mb-8">
        <label className="text-xs font-black uppercase tracking-wider text-white/50 mb-3 block">
          {lang === 'ar' ? 'الاسم' : 'Display Name'}
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={lang === 'ar' ? 'اسمك' : 'Your name'}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm placeholder-white/30 focus:outline-none focus:border-[#F59E0B] transition-colors"
        />
      </div>

      {/* User Info (read-only) */}
      <div className="space-y-3 mb-8">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <span className="text-xs text-slate-500 font-bold block mb-1">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</span>
          <span className="text-sm font-bold text-white">{user?.email || (lang === 'ar' ? 'غير مسجل' : 'Not logged in')}</span>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
          <span className="text-xs text-slate-500 font-bold block mb-1">{lang === 'ar' ? 'المعرف' : 'User ID'}</span>
          <span className="text-sm font-mono text-white/70 break-all">{user?.uid || '—'}</span>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className={cn(
          "w-full py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2",
          saved
            ? "bg-emerald-500 text-white"
            : "bg-[#F59E0B] text-black hover:bg-[#d97706] shadow-md"
        )}
      >
        {saved ? (
          <>
            <Check size={18} />
            {lang === 'ar' ? 'تم الحفظ!' : 'Saved!'}
          </>
        ) : (
          <>
            <Save size={18} />
            {lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
          </>
        )}
      </button>
    </div>
  );
}
