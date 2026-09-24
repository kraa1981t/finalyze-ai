import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Cpu, BarChart2, Brain, Shield, Zap, Target, TrendingUp, Lightbulb, ChevronRight } from 'lucide-react';
import { Language } from '../lib/i18n';
import { lt, ltp, pick, pkick, loc } from '../lib/i18nUI';

interface AboutPageProps {
  lang: Language;
  onBack: () => void;
  onGoToSuggestions: () => void;
}

const steps = [
  {
    icon: Cpu,
    titleEn: 'Live Market Data Collection',
    titleAr: 'جمع البيانات من الأسواق الحية',
    titleEs: 'Recopilación de datos de mercado en vivo',
    titleRu: 'Сбор рыночных данных в реальном времени',
    titleFr: 'Collecte de données de marché en direct',
    descEn: 'We collect live price data from forex, crypto, commodities, and indices markets. We obtain OHLCV data (Open, High, Low, Close, Volume) with high precision and in real-time.',
    descAr: 'نقوم بجمع بيانات الأسعار الحية من أسواق الفوركس والعملات الرقمية والسلع والمؤشرات. نحصل على بيانات الـ OHLCV (الافتتاح، الأعلى، الأدنى، الإغلاق، الحجم) بدقة عالية وفي الوقت الفعلي.',
    descEs: 'Recopilamos datos de precios en tiempo real de los mercados de forex, cripto, materias primas e índices. Obtenemos datos OHLCV (Apertura, Máximo, Mínimo, Cierre, Volumen) con alta precisión y en tiempo real.',
    descRu: 'Мы собираем цены в реальном времени с рынков форекс, крипто, товарных и индексных. Получаем данные OHLCV (Открытие, Максимум, Минимум, Закрытие, Объём) с высокой точностью и в реальном времени.',
    descFr: 'Nous collectons les prix en direct sur les marchés forex, crypto, matières premières et indices. Nous obtenons les données OHLCV (Ouverture, Haut, Bas, Clôture, Volume) avec une grande précision et en temps réel.'
  },
  {
    icon: BarChart2,
    titleEn: 'Multi-Indicator Technical Analysis',
    titleAr: 'التحليل الفني المتعدد المؤشرات',
    titleEs: 'Análisis técnico multi-indicador',
    titleRu: 'Мультииндикаторный технический анализ',
    titleFr: 'Analyse technique multi-indicateurs',
    descEn: 'We analyze each symbol with over 12 technical indicators: RSI, EMA (9/21), MACD, Bollinger Bands, ATR, Support/Resistance, Volume Profile, VWAP, Fibonacci, Ichimoku, ADX, Stochastic. Each indicator gets a specialized weight based on its importance.',
    descAr: 'نحلل كل رمز بأكثر من 12 مؤشر فني: RSI، EMA (9/21)، MACD، Bollinger Bands، ATR، Support/Resistance، Volume Profile، VWAP، Fibonacci، Ichimoku، ADX، Stochastic. كل مؤشر يحصل على وزن مخصص حسب أهميته.',
    descEs: 'Analizamos cada símbolo con más de 12 indicadores técnicos: RSI, EMA (9/21), MACD, Bandas de Bollinger, ATR, Soporte/Resistencia, Perfil de Volumen, VWAP, Fibonacci, Ichimoku, ADX, Stochastic. Cada indicador recibe un peso específico según su importancia.',
    descRu: 'Мы анализируем каждый символ по более чем 12 техническим индикаторам: RSI, EMA (9/21), MACD, полосы Боллинджера, ATR, Уровни, VWAP, Фибоначчи, Ишимоку, ADX, Стохастик. Каждый индикатор получает свой вес в зависимости от важности.',
    descFr: 'Nous analysons chaque symbole avec plus de 12 indicateurs techniques : RSI, EMA (9/21), MACD, bandes de Bollinger, ATR, supports/résistances, profil de volume, VWAP, Fibonacci, Ichimoku, ADX, Stochastic. Chaque indicateur reçoit un poids spécifique selon son importance.'
  },
  {
    icon: Brain,
    titleEn: 'Gemini AI Integration',
    titleAr: 'الذكاء الاصطناعي Gemini',
    titleEs: 'Integración de IA Gemini',
    titleRu: 'Интеграция ИИ Gemini',
    titleFr: "Intégration de l'IA Gemini",
    descEn: 'We use advanced Gemini AI models to combine all technical analysis results with current market conditions and geopolitical context. AI makes the final decision based on hundreds of data points.',
    descAr: 'نستخدم نماذج الذكاء الاصطناعي المتقدمة Gemini لدمج جميع نتائج التحليل الفني مع ظروف السوق الحالية والسياق الجيوسياسي. الذكاء الاصطناعي يتخذ القرار النهائي بناءً على مئات النقاط من البيانات.',
    descEs: 'Usamos los modelos avanzados de IA Gemini para combinar todos los resultados del análisis técnico con las condiciones actuales del mercado y el contexto geopolítico. La IA toma la decisión final basándose en cientos de puntos de datos.',
    descRu: 'Мы используем передовые модели ИИ Gemini, чтобы объединить все результаты технического анализа с текущими рыночными условиями и геополитическим контекстом. ИИ принимает окончательное решение на основе сотен точек данных.',
    descFr: "Nous utilisons les modèles avancés d'IA Gemini pour combiner tous les résultats de l'analyse technique avec les conditions actuelles du marché et le contexte géopolitique. L'IA prend la décision finale sur la base de centaines de points de données."
  },
  {
    icon: Target,
    titleEn: 'Scoring & Classification System',
    titleAr: 'نظام النقاط والتصنيف',
    titleEs: 'Sistema de puntuación y clasificación',
    titleRu: 'Система оценки и классификации',
    titleFr: 'Système de notation et de classification',
    descEn: 'Each indicator contributes specific points to the final decision: RSI (±2), EMA (±1.5), Bollinger Bands (±3), Volume (±0.5), Support/Resistance (±0.5). Final score determines: Strong Buy, Buy, Sell, Strong Sell.',
    descAr: 'كل مؤشر يساهم بنقاط محددة في القرار النهائي: RSI (±2)، EMA (±1.5)، Bollinger Bands (±3)، Volume (±0.5)، Support/Resistance (±0.5). النتيجة النهائية تحدد: شراء قوي، شراء، بيع، بيع قوي.',
    descEs: 'Cada indicador aporta puntos específicos a la decisión final: RSI (±2), EMA (±1.5), Bandas de Bollinger (±3), Volumen (±0.5), Soporte/Resistencia (±0.5). La puntuación final determina: Compra Fuerte, Compra, Venta, Venta Fuerte.',
    descRu: 'Каждый индикатор вносит определённый балл в итоговое решение: RSI (±2), EMA (±1,5), полосы Боллинджера (±3), объём (±0,5), поддержка/сопротивление (±0,5). Итоговая оценка определяет: сильная покупка, покупка, продажа, сильная продажа.',
    descFr: "Chaque indicateur contribue des points spécifiques à la décision finale : RSI (±2), EMA (±1,5), bandes de Bollinger (±3), volume (±0,5), support/résistance (±0,5). Le score final détermine : Achat fort, Achat, Vente, Vente forte."
  },
  {
    icon: Shield,
    titleEn: 'Advanced Risk Management',
    titleAr: 'إدارة المخاطر المتقدمة',
    titleEs: 'Gestión avanzada del riesgo',
    titleRu: 'Расширенное управление рисками',
    titleFr: 'Gestion avancée des risques',
    descEn: 'We calculate Stop Loss and Take Profit automatically based on ATR and support/resistance levels. We determine the optimal lot size for each symbol and monitor cross-asset risks between correlated currencies.',
    descAr: 'نحسب Stop Loss و Take Profit تلقائياً بناءً على ATR ومستويات الدعم والمقاومة. نحدد حجم الصفقة المثالي لكل رمز ونراقب المخاطر المتبادلة بين العملات المتشابهة.',
    descEs: 'Calculamos Stop Loss y Take Profit automáticamente basándonos en ATR y niveles de soporte/resistencia. Determinamos el tamaño de lote óptimo para cada símbolo y monitoreamos los riesgos cruzados entre monedas correlacionadas.',
    descRu: 'Мы автоматически рассчитываем стоп-лосс и тейк-профит на основе ATR и уровней поддержки/сопротивления. Определяем оптимальный размер лота для каждого символа и отслеживаем перекрёстные риски между коррелированными валютами.',
    descFr: "Nous calculons automatiquement le stop loss et le take profit sur la base de l'ATR et des niveaux de support/résistance. Nous déterminons la taille de lot optimale pour chaque symbole et surveillons les risques croisés entre devises corrélées."
  },
  {
    icon: Zap,
    titleEn: 'Continuous Auto Analysis',
    titleAr: 'التحليل التلقائي المستمر',
    titleEs: 'Análisis automático continuo',
    titleRu: 'Непрерывный автоматический анализ',
    titleFr: 'Analyse automatique continue',
    descEn: 'The site automatically analyzes all pairs every hour. Results are stored in Firestore and only very strong opportunities (80%+ confidence) are displayed. You can enable or disable auto analysis from settings.',
    descAr: 'يقوم الموقع بتحليل جميع الأزواج تلقائياً كل ساعة. يخزّن النتائج في Firestore ويعرض فقط الفرص القوية جداً (ثقة 80%+). يمكنك تفعيل أو تعطيل التحليل التلقائي من الإعدادات.',
    descEs: 'El sitio analiza todos los pares automáticamente cada hora. Los resultados se guardan en Firestore y solo se muestran las oportunidades muy fuertes (confianza del 80%+). Puedes activar o desactivar el análisis automático desde los ajustes.',
    descRu: 'Сайт автоматически анализирует все пары каждый час. Результаты сохраняются в Firestore, показываются только очень сильные возможности (уверенность 80%+). Вы можете включить или отключить автозапуск анализа в настройках.',
    descFr: "Le site analyse automatiquement toutes les paires chaque heure. Les résultats sont stockés dans Firestore et seules les opportunités les plus fortes (confiance 80%+) sont affichées. Vous pouvez activer ou désactiver l'analyse automatique dans les paramètres."
  },
  {
    icon: TrendingUp,
    titleEn: 'Real-time Notifications & Alerts',
    titleAr: 'الإشعارات والتنبيهات الفورية',
    titleEs: 'Notificaciones y alertas en tiempo real',
    titleRu: 'Уведомления и оповещения в реальном времени',
    titleFr: 'Notifications et alertes en temps réel',
    descEn: 'When a new opportunity appears, the site plays an immediate alert sound. You can also enable sound notifications on first page load and when new symbols appear.',
    descAr: 'عند ظهور فرصة جديدة، يُصدر الموقع صوت تنبيه فوري. يمكنك أيضاً تفعيل الإشعارات الصوتية عند أول تحميل للصفحة وعند ظهور أزواج جديدة.',
    descEs: 'Cuando aparece una nueva oportunidad, el sitio reproduce un sonido de alerta inmediato. También puedes activar las notificaciones sonoras al cargar la página y al aparecer nuevos símbolos.',
    descRu: 'Когда появляется новая возможность, сайт сразу воспроизводит звуковой сигнал. Вы также можете включить звуковые уведомления при первой загрузке страницы и при появлении новых символов.',
    descFr: "Lorsqu'une nouvelle opportunité apparaît, le site joue immédiatement un son d'alerte. Vous pouvez également activer les notifications sonores au premier chargement de la page et lorsque de nouveaux symboles apparaissent."
  },
  {
    icon: Shield,
    titleEn: 'Data Encryption & Privacy',
    titleAr: 'تشفير البيانات والخصوصية',
    titleEs: 'Cifrado de datos y privacidad',
    titleRu: 'Шифрование данных и конфиденциальность',
    titleFr: 'Chiffrement des données et confidentialité',
    descEn: 'All your data is encrypted and protected. We do not share any personal data with third parties. We use Firebase Authentication to encrypt all transactions.',
    descAr: 'جميع بياناتك مشفرة ومحمية. لا نشارك أي بيانات شخصية مع أطراف ثالثة. نستخدم Firebase Authentication لتشفير جميع المعاملات.',
    descEs: 'Todos tus datos están cifrados y protegidos. No compartimos información personal con terceros. Usamos Firebase Authentication para cifrar todas las transacciones.',
    descRu: 'Все ваши данные зашифрованы и защищены. Мы не передаём личные данные третьим лицам. Используем Firebase Authentication для шифрования всех транзакций.',
    descFr: "Toutes vos données sont chiffrées et protégées. Nous ne partageons aucune donnée personnelle avec des tiers. Nous utilisons Firebase Authentication pour chiffrer toutes les transactions."
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
        <span className="text-sm font-bold">{lt(lang, 97)}</span>
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
          {lt(lang, 279)}
        </h1>
        <p className="text-white/60 text-sm max-w-2xl mx-auto">
          {lt(lang, 286)}
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
                  {pkick(lang, step, 'title')}
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  {pkick(lang, step, 'desc')}
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
          {lt(lang, 274)}
        </h3>
        <p className="text-sm text-white/60 max-w-md mx-auto">
          {lt(lang, 505)}
        </p>
        <button
          onClick={onGoToSuggestions}
          className="inline-flex items-center gap-2 bg-[#F59E0B] text-black px-6 py-3 rounded-xl font-black text-sm hover:bg-[#d97706] transition-all shadow-lg hover:shadow-xl active:scale-95"
        >
          <Lightbulb size={18} />
          {lt(lang, 633)}
          <ChevronRight size={18} className={isAr ? 'rotate-180' : ''} />
        </button>
      </motion.div>
    </div>
  );
}
