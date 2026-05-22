import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Key, DollarSign, X, Menu } from 'lucide-react';
import { Language, translations } from '../lib/i18n';

interface DashboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onOpenSettings: () => void;
  onOpenApiKey: () => void;
  onOpenSubscription: () => void;
}

export default function DashboardPanel({ isOpen, onClose, lang, onOpenSettings, onOpenApiKey, onOpenSubscription }: DashboardPanelProps) {
  const isRTL = lang === 'ar';
  const t = translations[lang];

  const items = [
    { icon: Settings, label: lang === 'ar' ? 'الاستراتيجية' : 'Strategy', action: () => { onOpenSettings(); onClose(); } },
    { icon: Key, label: lang === 'ar' ? 'المفتاح' : 'API Key', action: () => { onOpenApiKey(); onClose(); } },
    { icon: DollarSign, label: lang === 'ar' ? 'الخطط' : 'Plans', action: () => { onOpenSubscription(); onClose(); } },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: isRTL ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: isRTL ? '100%' : '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed top-0 ${isRTL ? 'right-0' : 'left-0'} h-full w-72 z-[110] bg-brand-alt border-r border-white/10 shadow-2xl overflow-y-auto`}
            style={{ direction: isRTL ? 'rtl' : 'ltr' }}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-sm font-black uppercase tracking-widest text-brand-text/60">
                  {lang === 'ar' ? 'لوحة القيادة' : 'Dashboard'}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 text-brand-muted hover:text-white hover:bg-white/10 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Items */}
              <div className="space-y-3">
                {items.map((item, i) => (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={item.action}
                    className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/30 transition-all group"
                  >
                    <div className="p-2.5 rounded-xl bg-[#F59E0B] border border-black/10 text-black shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all">
                      <item.icon size={20} />
                    </div>
                    <span className="text-sm font-black text-brand-text/80 group-hover:text-brand-text transition-colors">
                      {item.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
