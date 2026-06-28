import React from 'react';
import { motion } from 'motion/react';
import { Zap, Shield, BarChart3, Globe } from 'lucide-react';
import { Language, translations } from '../lib/i18n';

interface HeroProps {
  onStartAnalysis: () => void;
  lang: Language;
}

export default function Hero({ onStartAnalysis, lang }: HeroProps) {
  const t = translations[lang];
  return (
    <div className="relative overflow-hidden bg-brand-bg pt-16 pb-8 md:pt-24 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            <Zap size={14} />
            <span>AI ADVANCED ENGINE</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-brand-text leading-[1.1]">
            {t.subtitle} <br />
            <span className="text-primary italic">Finalyze AI</span> 
          </h1>
          
          <div className="mt-12 relative max-w-5xl mx-auto group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            
            <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border-4 border-brand-text/5 bg-brand-alt group">
              <img 
                src="https://images.unsplash.com/photo-1611974714658-04878a1c86e0?q=80&w=2070&auto=format&fit=crop" 
                alt="AI Advanced Financial Analysis"
                className="w-full h-[300px] md:h-[500px] object-cover transition-transform duration-700 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-brand-bg via-transparent to-transparent flex flex-col justify-end p-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-brand-text/10 backdrop-blur-md rounded-2xl border border-brand-text/20">
                    <BarChart3 className="text-secondary" size={24} />
                  </div>
                  <div className="text-left">
                    <h4 className="text-brand-text font-bold text-xl">{t.title}</h4>
                    <p className="text-brand-text/60 text-sm">{t.subtitle}</p>
                  </div>
                </div>
              </div>

              <div className="absolute top-6 left-6 p-1.5 px-4 bg-brand-text/20 backdrop-blur-xl rounded-full border border-brand-text/30 text-brand-text text-[10px] font-black uppercase tracking-[0.2em]">
                Live AI Engine Active
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
