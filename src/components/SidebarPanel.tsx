import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Key, DollarSign, Wallet, Users, Zap, User, Crown, Info, Lightbulb } from 'lucide-react';
import { Language } from '../lib/i18n';

interface SidebarPanelProps {
  lang: Language;
  onClose: () => void;
  onNavigate: (page: 'settings' | 'apiKey' | 'plans' | 'radar' | 'paymentSettings' | 'clientMonitor' | 'profile' | 'about' | 'suggestions') => void;
  isDeveloper?: boolean;
  freemiumDisabled?: boolean;
}

export default function SidebarPanel({ lang, onClose, onNavigate, isDeveloper, freemiumDisabled }: SidebarPanelProps) {
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
      initial={{ x: isRTL ? 100 : -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: isRTL ? 100 : -100, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`fixed top-24 bottom-0 w-56 z-40 bg-[#D1FAE5]/95 backdrop-blur-xl border-l border-black/10 shadow-2xl flex flex-col overflow-hidden ${isRTL ? 'right-0 border-l' : 'left-0 border-r'}`}
      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
    >
      <div className="px-5 py-4 border-b border-black/5">
        <h3 className="text-xs font-black uppercase tracking-widest text-black/50">
          {lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 p-4">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.page}
              initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => onNavigate(item.page)}
              className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/10 border border-black/10 hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/30 transition-all group shadow-sm hover:shadow-md"
            >
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${item.color} border border-black/10 text-black shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all`}>
                <Icon size={20} />
              </div>
              <span className="text-sm font-black text-black/80 group-hover:text-black transition-colors">
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-black/5">
        <p className="text-[9px] text-black/30 font-black uppercase tracking-widest text-center">
          Joseph.Trading
        </p>
      </div>
    </motion.div>
  );
}