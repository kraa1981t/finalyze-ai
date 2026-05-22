import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Key, DollarSign, X } from 'lucide-react';
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
  const panelRef = useRef<HTMLDivElement>(null);
  const isRTL = lang === 'ar';

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const items = [
    { icon: Settings, label: lang === 'ar' ? 'الاستراتيجية' : 'Strategy', action: () => { onOpenSettings(); onClose(); } },
    { icon: Key, label: lang === 'ar' ? 'المفتاح' : 'API Key', action: () => { onOpenApiKey(); onClose(); } },
    { icon: DollarSign, label: lang === 'ar' ? 'الخطط' : 'Plans', action: () => { onOpenSubscription(); onClose(); } },
  ];

  return (
    <div
      ref={panelRef}
      className="relative z-40"
      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden bg-white/95 border-b border-black/10 shadow-lg"
          >
            <div className="max-w-7xl mx-auto px-6 py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black uppercase tracking-widest text-black/60">
                  {lang === 'ar' ? 'لوحة القيادة' : 'Dashboard'}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-black/5 border border-black/10 text-black/60 hover:text-black hover:bg-black/10 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-wrap gap-4">
                {items.map((item, i) => (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={item.action}
                    className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-black/5 border border-black/10 hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/30 transition-all group min-w-[180px]"
                  >
                    <div className="p-2.5 rounded-xl bg-[#F59E0B] border border-black/10 text-black shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all">
                      <item.icon size={20} />
                    </div>
                    <span className="text-sm font-black text-black/80 group-hover:text-black transition-colors">
                      {item.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
