import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings2, Activity, LayoutTemplate, Layers } from 'lucide-react';
import { StrategySettings } from '../types';
import { DEFAULT_STRATEGY_SETTINGS } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StrategySettings;
  onSettingsChange: (newSettings: StrategySettings) => void;
}

export default function SettingsModal({ isOpen, onClose, settings, onSettingsChange }: SettingsModalProps) {
  const handleChange = (key: keyof StrategySettings, value: any) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const resetToDefault = () => {
    onSettingsChange(DEFAULT_STRATEGY_SETTINGS);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-2xl bg-brand-bg border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5" dir="rtl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 text-primary rounded-lg">
                <Settings2 size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-brand-text">إعدادات التحليل الذكي</h2>
                <p className="text-sm text-brand-text/50">قم بضبط معايير الذكاء الاصطناعي بدقة</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-brand-text/50 hover:text-red-500 hover:bg-white/5 rounded-lg transition-colors">
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-8 flex-1 custom-scrollbar" dir="rtl">
            
            {/* Section 1: Candle Metrics */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-brand-text/50 uppercase tracking-wider flex items-center gap-2">
                <LayoutTemplate size={16} /> الشموع والزخم
              </h3>
              
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-brand-text">حجم الشمعة الأدنى (بكسل)</label>
                    <span className="text-primary font-mono text-sm">{settings.minCandleSizePx}px</span>
                  </div>
                  <input 
                    type="range" min="50" max="500" step="10"
                    value={settings.minCandleSizePx}
                    onChange={(e) => handleChange('minCandleSizePx', Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <p className="text-xs text-brand-text/40 mt-1">يحدد متى يتم اعتبار الشمعة ذات سيولة ضخمة.</p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-brand-text">عدد الشموع المتتالية المطلوبة</label>
                    <span className="text-primary font-mono text-sm">{settings.consecutiveCandles} شموع</span>
                  </div>
                  <input 
                    type="range" min="1" max="5" step="1"
                    value={settings.consecutiveCandles}
                    onChange={(e) => handleChange('consecutiveCandles', Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-brand-text">نسبة قوة الزخم المطلوبة (%)</label>
                    <span className="text-primary font-mono text-sm">{settings.momentumThreshold}%</span>
                  </div>
                  <input 
                    type="range" min="50" max="100" step="5"
                    value={settings.momentumThreshold}
                    onChange={(e) => handleChange('momentumThreshold', Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Supply & Demand */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-brand-text/50 uppercase tracking-wider flex items-center gap-2">
                <Layers size={16} /> مناطق العرض والطلب
              </h3>
              
              <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-brand-text">قوة مناطق العرض والطلب المطلوبة (%)</label>
                    <span className="text-primary font-mono text-sm">{settings.supplyDemandStrength}%</span>
                  </div>
                  <input 
                    type="range" min="50" max="100" step="5"
                    value={settings.supplyDemandStrength}
                    onChange={(e) => handleChange('supplyDemandStrength', Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <p className="text-xs text-brand-text/40 mt-1">مدى صرامة الذكاء الاصطناعي في مطابقة وتأكيد المناطق القوية.</p>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-brand-text text-secondary">عتبة "القرار القوي" والتوصيات (%)</label>
                    <span className="text-secondary font-mono text-sm">{settings.minStrongConfidence}%</span>
                  </div>
                  <input 
                    type="range" min="70" max="95" step="1"
                    value={settings.minStrongConfidence}
                    onChange={(e) => handleChange('minStrongConfidence', Number(e.target.value))}
                    className="w-full accent-secondary"
                  />
                  <p className="text-xs text-brand-text/40 mt-1">النسبة التي يبدأ عندها البوت بإعطاء (بيع/شراء قوي) وتثبيت الرمز في الصفحة الرئيسية.</p>
                </div>
              </div>
            </div>

            {/* Section 3: Toggles */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-brand-text/50 uppercase tracking-wider flex items-center gap-2">
                <Activity size={16} /> فلاتر وشروط إضافية
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-brand-text">تفعيل المؤشرات الفنية</div>
                    <div className="text-xs text-brand-text/40">فحص RSI و الموفينج افريج كشرط دخول</div>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${settings.useIndicators ? 'bg-primary' : 'bg-white/20'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.useIndicators ? 'translate-x-0' : '-translate-x-4'}`} />
                  </div>
                  <input type="checkbox" className="hidden" checked={settings.useIndicators} onChange={(e) => handleChange('useIndicators', e.target.checked)} />
                </label>

                <label className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <div>
                    <div className="text-sm font-semibold text-brand-text">رصد الأخبار اليومية</div>
                    <div className="text-xs text-brand-text/40">تجنب التداول وقت الأخبار القوية</div>
                  </div>
                  <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${settings.useNewsGuard ? 'bg-primary' : 'bg-white/20'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.useNewsGuard ? 'translate-x-0' : '-translate-x-4'}`} />
                  </div>
                  <input type="checkbox" className="hidden" checked={settings.useNewsGuard} onChange={(e) => handleChange('useNewsGuard', e.target.checked)} />
                </label>
              </div>
            </div>

            {/* Section 4: Auto Analysis (RADAR) */}
            <div className="space-y-4 pt-6 border-t border-white/10">
              <h3 className="text-sm font-bold text-secondary uppercase tracking-wider flex items-center gap-2">
                <Zap size={16} /> رادار المسح والتحليل التلقائي
              </h3>
              
              <div className="p-4 bg-secondary/5 border border-secondary/20 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-brand-text">تفعيل الرادار الآلي</div>
                    <p className="text-xs text-brand-text/40 mt-0.5">سيقوم البوت بمسح السوق في الخلفية واصطياد الفرص القوية.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={settings.isAutoAnalysisEnabled} onChange={(e) => handleChange('isAutoAnalysisEnabled', e.target.checked)} />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
                  </label>
                </div>

                {settings.isAutoAnalysisEnabled && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div>
                      <label className="block text-[10px] font-bold text-brand-text/60 mb-1.5 uppercase tracking-widest">الفئة المستهدفة للمسح</label>
                      <select 
                        value={settings.autoAnalysisCategory}
                        onChange={(e) => handleChange('autoAnalysisCategory', e.target.value as any)}
                        className="w-full bg-brand-bg/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text outline-none focus:border-secondary transition-colors cursor-pointer"
                      >
                        <option value="all">جميع فئات السوق (Forex, Crypto, Stocks)</option>
                        <option value="forex">سوق العملات الأجنبية (Forex)</option>
                        <option value="crypto">سوق العملات الرقمية (Crypto)</option>
                        <option value="stocks">سوق الأسهم العالمية (Stocks)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/10 bg-brand-bg flex items-center justify-between" dir="rtl">
            <button onClick={resetToDefault} className="px-4 py-2 text-sm text-brand-text/50 hover:text-brand-text font-semibold transition-colors">
              استعادة الافتراضي
            </button>
            <button onClick={onClose} className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
              تطبيق وحفظ
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
