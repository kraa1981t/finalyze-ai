import React from 'react';
import { ShieldCheck, Zap, Globe, BarChart3, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Language, translations } from '../lib/i18n';

interface LoginOverlayProps {
  onLogin: () => void;
  lang: Language;
}

export default function LoginOverlay({ onLogin, lang }: LoginOverlayProps) {
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start p-4 bg-brand-bg overflow-y-auto pt-12 pb-8">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Brand Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-10 relative z-10"
      >
        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center overflow-hidden shadow-xl shadow-emerald-500/25 rotate-3 hover:rotate-0 transition-all border border-white/50">
          <img src="/logo.png" alt="Finalyze AI Logo" className="w-full h-full object-cover scale-110" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-3xl font-display font-black tracking-tighter text-white drop-shadow-sm leading-none">
            Finalyze.<span className="text-primary italic">AI</span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mt-1">Institutional Engine</span>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-5xl w-full grid md:grid-cols-2 gap-8 items-center"
      >
        {/* Left Side: Value Proposition */}
        <div className="text-right px-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full mb-6 border border-primary/20">
              <Zap size={10} fill="currentColor" />
              <span>{lang === 'ar' ? 'الذكاء الاصطناعي الجيل الرابع' : 'AI Gen 4 Enabled'}</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 leading-tight">
              {lang === 'ar' ? 'حلل الأسواق بذكاء مفرط' : 'Analyze Markets with Hyper-Intelligence'}
            </h1>
            
            <p className="text-slate-400 text-lg mb-10 max-w-lg ml-auto leading-relaxed">
              {lang === 'ar' 
                ? 'انضم لأكثر من 5000 متداول يستخدمون Finalyze AI للحصول على رؤى دقيقة وتوقعات لحظية للاتجاهات.'
                : 'Join over 5000+ traders using Finalyze AI to gain accurate insights and real-time trend predictions.'}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-10">
              {[
                { icon: <BarChart3 size={18} />, label: lang === 'ar' ? 'تحليل لحظي' : 'Real-time Analysis' },
                { icon: <Globe size={18} />, label: lang === 'ar' ? 'تغطية عالمية' : 'Global Coverage' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-slate-300">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-primary">
                    {item.icon}
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right Side: Subscription Card / Action */}
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-brand-alt p-8 md:p-12 rounded-[40px] border border-white/5 shadow-[0_32px_128px_-12px_rgba(0,0,0,0.8)] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8">
              <ShieldCheck size={48} className="text-primary/10" />
            </div>

            <div className="text-center mb-8 relative z-10">
              <div className="text-primary text-sm font-black mb-2 uppercase tracking-tighter">
                {lang === 'ar' ? 'ابدأ الآن' : 'Get Started'}
              </div>
              <h3 className="text-2xl font-bold text-white">
                {lang === 'ar' ? 'اشتراك شهري مرن' : 'Flexible Monthly Plan'}
              </h3>
            </div>

            <div className="space-y-4 mb-10 relative z-10">
              {[
                lang === 'ar' ? 'وصول كامل لجميع المؤشرات' : 'Full access to all indicators',
                lang === 'ar' ? 'تحديثات لحظية لكل العملات' : 'Real-time updates for all currencies',
                lang === 'ar' ? 'تقارير ذكاء اصطناعي يومية' : 'Daily AI generated reports'
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3 text-slate-400 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <button
              onClick={onLogin}
              className="w-full flex items-center justify-between bg-primary group hover:bg-emerald-500 text-brand-bg font-black px-8 py-5 rounded-2xl transition-all shadow-xl shadow-primary/20 hover:shadow-primary/40 active:scale-95"
            >
              <span className="text-lg">{lang === 'ar' ? 'تسجيل دخول واشتراك' : 'Login & Subscribe'}</span>
              <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
            </button>

            <p className="mt-6 text-center text-xs text-slate-500">
              {lang === 'ar' ? 'لا يوجد التزام، يمكنك الإلغاء في أي وقت' : 'No commitment, cancel anytime.'}
            </p>
          </motion.div>
        </div>
      </motion.div>
      
      {/* Footer minimal info */}
      <div className="mt-12 text-slate-600 text-[10px] font-medium tracking-widest uppercase">
        Protected by Enterprise Security Standards
      </div>
    </div>
  );
}
