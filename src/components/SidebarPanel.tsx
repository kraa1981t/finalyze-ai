import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Key, DollarSign, Wallet, Users, Zap, User, Crown, Info, Lightbulb, Monitor, BarChart3, Smartphone, Tablet, TrendingUp, MessageCircle, LogIn, LogOut } from 'lucide-react';
import { Language } from '../lib/i18n';
import { User as FirebaseUser } from 'firebase/auth';

interface SidebarPanelProps {
  lang: Language;
  onClose: () => void;
  onNavigate: (page: 'settings' | 'apiKey' | 'plans' | 'radar' | 'paymentSettings' | 'clientMonitor' | 'profile' | 'about' | 'suggestions' | 'ads' | 'siteStats' | 'trade' | 'manualAnalysis') => void;
  isDeveloper?: boolean;
  freemiumDisabled?: boolean;
  onPreview?: (device: 'phone' | 'tablet') => void;
  user?: FirebaseUser | null;
  customAvatar?: string | null;
  onLogin?: () => void;
  onLogout?: () => void;
}

export default function SidebarPanel({ lang, onClose, onNavigate, isDeveloper, freemiumDisabled, onPreview, user, customAvatar, onLogin, onLogout }: SidebarPanelProps) {
  const isRTL = lang === 'ar';
  const panelRef = useRef<HTMLDivElement>(null);

  const items = isDeveloper ? [
    { icon: Zap, label: lang === 'ar' ? 'إعدادات التحليل التلقائي' : 'Auto Analysis Settings', page: 'radar' as const, color: 'from-amber-400 to-amber-600' },
    { icon: Key, label: lang === 'ar' ? 'مفتاح API' : 'API Key', page: 'apiKey' as const, color: 'from-amber-400 to-amber-600' },
    { icon: User, label: lang === 'ar' ? 'الملف الشخصي' : 'Profile', page: 'profile' as const, color: 'from-amber-400 to-amber-600' },
    { icon: Settings, label: lang === 'ar' ? 'الإعدادات' : 'Settings', page: 'settings' as const, color: 'from-amber-400 to-amber-600' },
    ...(!freemiumDisabled ? [
      { icon: DollarSign, label: lang === 'ar' ? 'الخطط' : 'Plans', page: 'plans' as const, color: 'from-amber-400 to-amber-600' },
    ] : []),
    { icon: Wallet, label: lang === 'ar' ? 'عناوين الدفع' : 'Payment Addresses', page: 'paymentSettings' as const, color: 'from-amber-400 to-amber-600' },
    { icon: Users, label: lang === 'ar' ? 'مراقبة العملاء' : 'Client Monitor', page: 'clientMonitor' as const, color: 'from-amber-400 to-amber-600' },
    { icon: BarChart3, label: lang === 'ar' ? 'إحصائيات الموقع' : 'Site Statistics', page: 'siteStats' as const, color: 'from-emerald-400 to-emerald-600' },
    { icon: Monitor, label: lang === 'ar' ? 'إعلاناتي' : 'My Ads', page: 'ads' as const, color: 'from-purple-400 to-purple-600' },
  ] : [
    { icon: User, label: lang === 'ar' ? 'الملف الشخصي' : 'Profile', page: 'profile' as const, color: 'from-amber-400 to-amber-600' },
    { icon: Info, label: lang === 'ar' ? 'نبذة عنا' : 'About Us', page: 'about' as const, color: 'from-amber-400 to-amber-600' },
    { icon: Lightbulb, label: lang === 'ar' ? 'اقتراحاتكم' : 'Your Suggestions', page: 'suggestions' as const, color: 'from-amber-400 to-amber-600' },
    ...(!freemiumDisabled ? [
      { icon: Crown, label: lang === 'ar' ? 'شراء خطة' : 'Buy Plan', page: 'plans' as const, color: 'from-emerald-400 to-emerald-600' },
    ] : []),
  ];

  return (
    <motion.div
      ref={panelRef}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`fixed top-[72px] w-64 z-[60] bg-[#D1FAE5]/95 backdrop-blur-xl border border-black/10 shadow-2xl flex flex-col overflow-hidden rounded-2xl ${isRTL ? 'left-4' : 'right-4'}`}
      style={{ direction: isRTL ? 'rtl' : 'ltr', maxHeight: 'calc(100vh - 100px)' }}
    >
      <div className="px-5 py-4 border-b border-black/5">
        <h3 className="text-xs font-black uppercase tracking-widest text-black/50">
          {lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 p-4">
        {/* Mobile-only quick actions (hidden on desktop) */}
        <button
          onClick={() => onNavigate('trade')}
          className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all group shadow-md md:hidden"
        >
          <div className="shrink-0 p-2.5 rounded-xl bg-black text-[#F59E0B] border border-black/10 shadow-md group-hover:scale-105 transition-all">
            <TrendingUp size={20} />
          </div>
          <span className="text-sm font-black text-black min-w-0 leading-snug">
            {lang === 'ar' ? 'التداول' : 'Trade'}
          </span>
        </button>
        <a
          href="https://www.facebook.com/messages/e2ee/t/7630276620403742/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-[#0084FF] border border-black/10 text-white hover:bg-[#006ADB] transition-all group shadow-md md:hidden"
        >
          <div className="shrink-0 p-2.5 rounded-xl bg-black/30 text-white border border-black/10 shadow-md group-hover:scale-105 transition-all">
            <MessageCircle size={20} />
          </div>
          <span className="text-sm font-black text-white min-w-0 leading-snug">
            {lang === 'ar' ? 'تواصل معنا' : 'Contact Us'}
          </span>
        </a>
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.page}
              initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => onNavigate(item.page)}
              className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/10 border border-black/10 hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/30 transition-all group shadow-sm hover:shadow-md"
            >
              <div className={`shrink-0 p-2.5 rounded-xl bg-gradient-to-br ${item.color} border border-black/10 text-black shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all`}>
                <Icon size={20} />
              </div>
              <span className="text-sm font-bold text-black/80 group-hover:text-black transition-colors min-w-0 leading-snug">
                {item.label}
              </span>
            </motion.button>
          );
        })}

        {/* Login / Logout - mobile only */}
        <div className="border-t border-black/10 my-1 md:hidden" />
        {user ? (
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/10 border border-black/10 shadow-sm md:hidden">
            <div className="w-10 h-10 rounded-full bg-[#F59E0B] border-2 border-black/20 flex items-center justify-center overflow-hidden shadow-lg shrink-0">
              {customAvatar ? (
                <img src={customAvatar} alt="profile" className="w-full h-full object-cover" />
              ) : user.photoURL ? (
                <img src={user.photoURL} alt="profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-black text-black">{user.email?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-black text-black truncate">{user.displayName || user.email?.split('@')[0]}</span>
              <span className="text-[10px] font-bold text-black/60 truncate">{user.email}</span>
            </div>
            {onLogout && (
              <button
                onClick={() => { onClose(); onLogout(); }}
                className="p-2 rounded-lg bg-red-500/20 text-red-600 hover:bg-red-500/40 transition-all"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        ) : (
          onLogin && (
            <button
              onClick={() => { onClose(); onLogin(); }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#F59E0B] text-black font-black text-sm uppercase tracking-wider shadow-lg hover:bg-[#d97706] active:scale-95 transition-all md:hidden"
            >
              <LogIn size={18} />
              {lang === 'ar' ? 'تسجيل الدخول' : 'Login'}
            </button>
          )
        )}
      </div>

      {isDeveloper && onPreview && (
        <div className="px-4 py-3 border-t border-black/5">
          <div className="text-[9px] font-black uppercase text-black/40 tracking-[0.2em] mb-2 px-1">
            {lang === 'ar' ? 'معاينة' : 'Preview'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { onPreview('phone'); onClose(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all shadow-md"
            >
              <Smartphone size={16} />
              <span className="text-xs font-black">{lang === 'ar' ? 'هاتف' : 'Phone'}</span>
            </button>
            <button
              onClick={() => { onPreview('tablet'); onClose(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#F59E0B] border border-black/10 text-black hover:bg-[#d97706] transition-all shadow-md"
            >
              <Tablet size={16} />
              <span className="text-xs font-black">{lang === 'ar' ? 'لوحي' : 'Tablet'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="px-5 py-3 border-t border-black/5">
        <p className="text-[9px] text-black/30 font-black uppercase tracking-widest text-center">
          Joseph.Trading
        </p>
      </div>
    </motion.div>
  );
}