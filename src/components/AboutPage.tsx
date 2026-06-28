import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Cpu, BarChart2, Brain, Shield, Zap, Target, TrendingUp, Lightbulb, ChevronRight } from 'lucide-react';
import { Language } from '../lib/i18n';

interface AboutPageProps {
  lang: Language;
  onBack: () => void;
  onGoToSuggestions: () => void;
}

const steps = [
  {
    icon: Cpu,
    titleAr: 'جمع البيانات من الأسواق الحية',
    titleEn: 'Live Market Data Collection',
    descAr: 'نقوم بجمع بيانات الأسعار الحية من أسواق الفوركس والعملات الرقمية والسلع وال Indices. نحصل على بيانات الـ OHLCV (الافتتاح، الأعلى، الأدنى، الإغلاق، الحجم) بدقة عالية وفي الوقت الفعلي.',
    descEn: 'We collect live price data from forex, crypto, commodities, and indices markets. We obtain OHLCV data (Open, High, Low, Close, Volume) with high precision and in real-time.'
  },
  {
    icon: BarChart2,
    titleAr: 'التحليل الفني المتعدد المؤشرات',
    titleEn: 'Multi-Indicator Technical Analysis',
    descAr: 'نحلل كل رمز بأكثر من 12 مؤشر فني: RSI، EMA (9/21)، MACD، Bollinger Bands، ATR، Support/Resistance، Volume Profile، VWAP، Fibonacci، Ichimoku، ADX، Stochastic. كل مؤشر يحصل على وزن مخصص حسب أهميته.',
    descEn: 'We analyze each symbol with over 12 technical indicators: RSI, EMA (9/21), MACD, Bollinger Bands, ATR, Support/Resistance, Volume Profile, VWAP, Fibonacci, Ichimoku, ADX, Stochastic. Each indicator gets a specialized weight based on its importance.'
  },
  {
    icon: Brain,
    titleAr: 'الذكاء الاصطناعي Gemini',
    titleEn: 'Gemini AI Integration',
    descAr: 'نستخدم نماذج الذكاء الاصطناعي المتقدمة Gemini لدمج جميع نتائج التحليل الفني مع ظروف السوق الحالية والسياق الجيوسياسي. الذكاء الاصطناعي يتخذ القرار النهائي بناءً على مئات النقاط من البيانات.',
    descEn: 'We use advanced Gemini AI models to combine all technical analysis results with current market conditions and geopolitical context. AI makes the final decision based on hundreds of data points.'
  },
  {
    icon: Target,
    titleAr: 'نظام النقاط والتصنيف',
    titleEn: 'Scoring & Classification System',
    descAr: 'كل مؤشر يساهم ب pontos محددة في القرار النهائي: RSI (±2)، EMA (±1.5)، Bollinger Bands (±3)، Volume (±0.5)، Support/Resistance (±0.5). النتيجة النهائية تحدد: شراء قوي، شراء، بيع، بيع قوي.',
    descEn: 'Each indicator contributes specific points to the final decision: RSI (±2), EMA (±1.5), Bollinger Bands (±3), Volume (±0.5), Support/Resistance (±0.5). Final score determines: Strong Buy, Buy, Sell, Strong Sell.'
  },
  {
    icon: Shield,
    titleAr: 'إدارة المخاطر المتقدمة',
    titleEn: 'Advanced Risk Management',
    descAr: 'نحسب Stop Loss و Take Profit تلقائياً بناءً على ATR ومستويات الدعم والمقاومة. نحدد حجم الصفقة المثالي لكل رمز ونراقب المخاطر المتبادلة بين العملات المتشابهة.',
    descEn: 'We calculate Stop Loss and Take Profit automatically based on ATR and support/resistance levels. We determine the optimal lot size for each symbol and monitor cross-asset risks between correlated currencies.'
  },
  {
    icon: Zap,
    titleAr: 'التحليل التلقائي المستمر',
    titleEn: 'Continuous Auto Analysis',
    descAr: 'يقوم الموقع بتحليل جميع الأزواج تلقائياً كل ساعة. يخزّن النتائج في Firestore ويعرض فقط الفرص القوية جداً (ثقة 80%+). يمكنك تفعيل أو تعطيل التحليل التلقائي من الإعدادات.',
    descEn: 'The site automatically analyzes all pairs every hour. Results are stored in Firestore and only very strong opportunities (80%+ confidence) are displayed. You can enable or disable auto analysis from settings.'
  },
  {
    icon: TrendingUp,
    titleAr: 'الإشعارات والتنبيهات الفورية',
    titleEn: 'Real-time Notifications & Alerts',
    descAr: 'عند ظهور فرصة جديدة، يُصدر الموقع صوت تنبيه فوري. يمكنك também تفعيل الإشعارات الصوتية عند أول تحميل للصفحة وعند ظهور أزواج جديدة.',
    descEn: 'When a new opportunity appears, the site plays an immediate alert sound. You can also enable sound notifications on first page load and when new symbols appear.'
  },
  {
    icon: Shield,
    titleAr: 'تشفير البيانات والخصوصية',
    titleEn: 'Data Encryption & Privacy',
    descAr: 'جميع بياناتك مشفرة ومحمية. لا نشارك أي بيانات شخصية مع أطراف ثالثة. نستخدم Firebase Authentication لتشفير جميع المعاملات.',
    descEn: 'All your data is encrypted and protected. We do not share any personal data with third parties. We use Firebase Authentication to encrypt all transactions.'
  }
];

export default function AboutPage({ lang, onBack, onGoToSuggestions }: AboutPageProps) {
  const isAr = lang === 'ar';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
      >
        <ArrowLeft size={20} className={`group-hover:-translate-x-1 transition-transform ${isAr ? 'rotate-180' : ''}`} />
        <span className="text-sm font-bold">{isAr ? 'رجوع' : 'Back'}</span>
      </button>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="w-20 h-20 mx-auto bg-[#F59E0B]/20 rounded-3xl flex items-center justify-center border border-[#F59E0B]/30">
          <Brain size={40} className="text-[#F59E0B]" />
        </div>
        <h1 className="text-3xl font-black text-white">
          {isAr ? 'كيف يعمل الموقع' : 'How the Site Works'}
        </h1>
        <p className="text-white/60 text-sm max-w-2xl mx-auto">
          {isAr
            ? ' Finalyze AI يستخدم الذكاء الاصطناعي والتحليل الفني المتقدم لتحديد أفضل فرص التداول في الأسواق المالية'
            : 'Finalyze AI uses AI and advanced technical analysis to identify the best trading opportunities in financial markets'}
        </p>
      </motion.div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: isAr ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-brand-alt rounded-2xl border border-white/10 p-6 flex gap-4"
            >
              <div className="shrink-0 w-12 h-12 bg-[#F59E0B]/20 rounded-xl flex items-center justify-center border border-[#F59E0B]/30">
                <Icon size={24} className="text-[#F59E0B]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white">
                  {isAr ? step.titleAr : step.titleEn}
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  {isAr ? step.descAr : step.descEn}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Suggestions CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-gradient-to-br from-[#F59E0B]/10 to-[#F59E0B]/5 rounded-2xl border border-[#F59E0B]/30 p-6 text-center space-y-4"
      >
        <Lightbulb size={32} className="text-[#F59E0B] mx-auto" />
        <h3 className="text-xl font-black text-white">
          {isAr ? 'لديك اقتراح لتطوير الموقع؟' : 'Have a suggestion to improve the site?'}
        </h3>
        <p className="text-sm text-white/60 max-w-md mx-auto">
          {isAr
            ? 'شاركنا أفكارك واقتراحاتك لتحسين تجربة التداول. إذا حصل اقتراحك على أكثر من 50% من أصوات المجتمع، سنقوم بتطبيقه!'
            : 'Share your ideas and suggestions to improve the trading experience. If your suggestion gets more than 50% of community votes, we will implement it!'}
        </p>
        <button
          onClick={onGoToSuggestions}
          className="inline-flex items-center gap-2 bg-[#F59E0B] text-black px-6 py-3 rounded-xl font-black text-sm hover:bg-[#d97706] transition-all shadow-lg hover:shadow-xl active:scale-95"
        >
          <Lightbulb size={18} />
          {isAr ? 'اقتراحاتك' : 'Your Suggestions'}
          <ChevronRight size={18} className={isAr ? 'rotate-180' : ''} />
        </button>
      </motion.div>
    </div>
  );
}
