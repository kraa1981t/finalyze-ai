import React from 'react';
import { motion } from 'motion/react';
import { X, DollarSign, Star, Crown, Sparkles } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const DEFAULT_PRICES = { weekly: 2, monthly: 6, yearly: 60 };
const STORAGE_KEY = 'subscription_prices';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (amount: number, label: string, durationDays: number) => void;
  asPage?: boolean;
}

export default function SubscriptionModal({ isOpen, onClose, onSelectPlan, asPage }: SubscriptionModalProps) {
  const [prices, setPrices] = React.useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_PRICES;
    } catch { return DEFAULT_PRICES; }
  });

  // Sync prices from Firestore every 10 seconds
  React.useEffect(() => {
    const syncPrices = async () => {
      try {
        const snap = await getDoc(doc(db, 'shared_settings', 'prices'));
        if (snap.exists()) {
          const data = snap.data();
          const newPrices = {
            weekly: data.weekly ?? DEFAULT_PRICES.weekly,
            monthly: data.monthly ?? DEFAULT_PRICES.monthly,
            yearly: data.yearly ?? DEFAULT_PRICES.yearly,
          };
          setPrices(newPrices);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrices));
        }
      } catch {}
    };
    syncPrices();
    const interval = setInterval(syncPrices, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen) return null;

  const plans = [
    { key: 'weekly', label: 'Weekly', price: prices.weekly, icon: Sparkles, desc: '7 days of institutional analysis & radar alerts', color: 'from-sky-500 to-sky-600', border: 'border-sky-500/30', durationDays: 7 },
    { key: 'monthly', label: 'Monthly', price: prices.monthly, icon: Star, desc: 'Full market access & priority signals', color: 'from-emerald-500 to-emerald-600', border: 'border-emerald-500/30', popular: true, durationDays: 30 },
    { key: 'yearly', label: 'Yearly', price: prices.yearly, icon: Crown, desc: 'Best value - all features + VIP support', color: 'from-amber-500 to-orange-600', border: 'border-amber-500/30', best: true, durationDays: 365 },
  ];

  const pageInner = (
    <>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <DollarSign size={28} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">Subscription Plans</h3>
            <p className="text-sm text-slate-400">Unlock full institutional analysis</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
          <X size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = plan.icon;
          return (
            <div
              key={plan.key}
              className={`relative bg-white/5 border ${plan.border} rounded-3xl p-6 flex flex-col transition-all hover:-translate-y-1 hover:shadow-xl ${plan.popular ? 'ring-2 ring-emerald-500/50' : ''} ${plan.best ? 'ring-2 ring-amber-500/50' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-lg">
                  Popular
                </div>
              )}
              {plan.best && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-lg">
                  Best Value
                </div>
              )}

              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4 shadow-lg`}>
                <Icon size={22} className="text-white" />
              </div>

              <h4 className="text-lg font-black text-white uppercase tracking-wider mb-1">{plan.label}</h4>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">{plan.desc}</p>

              <div className="mb-6">
                <span className="text-4xl font-black text-white">${Number(plan.price).toFixed(2)}</span>
                <span className="text-sm text-slate-400 ml-1">/ {plan.key === 'yearly' ? 'yr' : plan.key === 'monthly' ? 'mo' : 'wk'}</span>
              </div>

              <button
                onClick={() => onSelectPlan(plan.price, plan.label, plan.durationDays)}
                className={`mt-auto w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg bg-gradient-to-r ${plan.color} text-white hover:opacity-90 active:scale-95`}
              >
                Subscribe ${Number(plan.price).toFixed(2)}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[10px] text-slate-500 mt-6">
        All plans auto-renew. Cancel anytime. Crypto payment only.
      </p>
    </>
  );

  if (asPage) {
    return (
      <div>
        {pageInner}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative max-w-4xl w-full bg-brand-alt border border-white/10 rounded-[32px] p-8 shadow-[0_32px_128px_-12px_rgba(0,0,0,0.85)]"
      >
        {pageInner}
      </motion.div>
    </div>
  );
}
