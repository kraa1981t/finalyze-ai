export type Language = 'en' | 'ar';

export interface Translations {
  title: string;
  subtitle: string;
  startAnalysis: string;
  analyzing: string;
  analyzingSub: string;
  backToNew: string;
  forex: string;
  crypto: string;
  stocks: string;
  metals: string;
  login: string;
  logout: string;
  readMore: string;
  finalDecision: string;
  confidence: string;
  reasons: string;
  historicalMatch: string;
  goldOpportunity: string;
  confluenceProof: string;
  trendVitality: string;
  momentum: string;
  buy: string;
  sell: string;
  strong_buy: string;
  strong_sell: string;
  neutral: string;
  no_entry: string;
  allRightsReserved: string;
  privacyPolicy: string;
  termsOfUse: string;
  selectMarket: string;
  selectSymbols: string;
  tradingStyle: string;
  timeframe: string;
  scalping: string;
  day_trading: string;
  swing_trading: string;
  manualInput: string;
  selectAll: string;
  unselectAll: string;
  clear: string;
  loginRequired: string;
  selectAtLeastOne: string;
  eurPairs: string;
  usdPairs: string;
  gbpPairs: string;
  audNzdPairs: string;
  chfCadPairs: string;
  topCrypto: string;
  momentumCrypto: string;
  altCrypto: string;
  techStocks: string;
  energyStocks: string;
  bankStocks: string;
  preciousMetals: string;
  industrialMetals: string;
  settings: string;
  strategySettings: string;
  minCandleSize: string;
  consecutiveCandles: string;
  momentumThreshold: string;
  useHigherTimeframe: string;
  useVolumeAnalysis: string;
  useNewsGuard: string;
  usePsychologicalLevels: string;
  minConfidence: string;
  saveSettings: string;
  resetDefaults: string;
  settingsSaved: string;
  trendMaturity: string;
  infancy: string;
  youth: string;
  aging: string;
  unknown: string;
  candles: string;
  searchSymbol: string;
  addSymbol: string;
  popularSymbols: string;
  topSignals: string;
  signalExpired: string;
  delete: string;
  autoAnalysis: string;
  autoSettings: string;
  autoScan: string;
  allCategories: string;
  every: string;
  minutes: string;
  successSound: string;
  failSound: string;
  uploadCustom: string;
  startManualNow: string;
  clearAllResults: string;
  useCandleMatch: string;
  candleMatchDailyThreshold: string;
  candleMatchWeeklyThreshold: string;
  candleMatchMonthlyThreshold: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    title: "Joseph.Trading",
    subtitle: "Advanced Institutional Market Analysis",
    startAnalysis: "Start New Analysis",
    analyzing: "AI Engine Analyzing...",
    analyzingSub: "Sequential processing for highest accuracy and precision.",
    backToNew: "Back to New Analysis",
    forex: "Forex",
    crypto: "Crypto",
    stocks: "Stocks",
    metals: "Metals",
    login: "Login",
    logout: "Logout",
    readMore: "Read Details",
    finalDecision: "Final Decision",
    confidence: "Confidence",
    reasons: "Analysis Reasons",
    historicalMatch: "Historical Fractal Match",
    goldOpportunity: "Gold Opportunity",
    confluenceProof: "Confluence Proof",
    trendVitality: "Trend Vitality",
    momentum: "Momentum",
    buy: "Buy",
    sell: "Sell",
    strong_buy: "Strong Buy",
    strong_sell: "Strong Sell",
    neutral: "Neutral",
    no_entry: "No Entry",
    allRightsReserved: "All rights reserved",
    privacyPolicy: "Privacy Policy",
    termsOfUse: "Terms of Use",
    selectMarket: "1. Select Market",
    selectSymbols: "2. Select Symbols",
    tradingStyle: "3. Trading Strategy",
    timeframe: "4. Timeframe",
    scalping: "Scalping (Mins)",
    day_trading: "Day Trade (Hours)",
    swing_trading: "Swing (1-2 Days)",
    manualInput: "Manual Input (comma separated)",
    selectAll: "Select All",
    unselectAll: "Unselect All",
    clear: "Clear All",
    loginRequired: "Please login to start analysis",
    selectAtLeastOne: "Please select at least one symbol",
    eurPairs: "EUR Pairs",
    usdPairs: "USD Pairs",
    gbpPairs: "GBP Pairs",
    audNzdPairs: "AUD & NZD Pairs",
    chfCadPairs: "CHF & CAD Pairs",
    topCrypto: "Top Assets",
    momentumCrypto: "Momentum",
    altCrypto: "Altcoins",
    techStocks: "Tech Giants",
    energyStocks: "Energy & Oil",
    bankStocks: "Banking",
    preciousMetals: "Precious Metals",
    industrialMetals: "Industrial Metals",
    settings: "Settings",
    strategySettings: "Final Decision Strategy Rules",
    minCandleSize: "Minimum Candle Size (Expansion)",
    consecutiveCandles: "Required Consecutive Candles",
    momentumThreshold: "Momentum Threshold (%)",
    useHigherTimeframe: "Enable Multi-Timeframe Alignment",
    useVolumeAnalysis: "Enable Volume Confirmation",
    useNewsGuard: "Enable News & Volatility Guard",
    usePsychologicalLevels: "Check Supply/Demand & Round Numbers",
    minConfidence: "Minimum Confidence to Signal (%)",
    saveSettings: "Save Strategy Rules",
    resetDefaults: "Reset to Original Factory Rules",
    settingsSaved: "Strategy settings updated successfully!",
    trendMaturity: "Trend Maturity",
    infancy: "Infancy",
    youth: "Youth",
    aging: "Aging",
    unknown: "Unknown",
    candles: "candles",
    searchSymbol: "Search all symbols...",
    addSymbol: "Add Symbol",
    popularSymbols: "Popular Symbols",
    topSignals: "High-Confidence Signals",
    signalExpired: "Signal Expired",
    delete: "Delete",
    autoAnalysis: "Auto-Scanner",
    autoSettings: "Scanner Settings",
    autoScan: "Start Scan",
    allCategories: "All Markets",
    every: "Every",
    minutes: "min",
    successSound: "Success Alert",
    failSound: "Cycle End Alert",
    uploadCustom: "Upload Custom Audio",
    startManualNow: "Start Manual Analysis Now",
    clearAllResults: "Clear All Results",
    useCandleMatch: "Candle Body Match Filter (Daily/Weekly/Monthly)",
    candleMatchDailyThreshold: "Daily Candle Body Threshold (pips)",
    candleMatchWeeklyThreshold: "Weekly Candle Body Threshold (pips)",
    candleMatchMonthlyThreshold: "Monthly Candle Body Threshold (pips)",
  },
  ar: {
    title: "Joseph.Trading",
    subtitle: "محرك التحليل المؤسسي المتقدم",
    startAnalysis: "بدء تحليل جديد",
    analyzing: "محرك الذكاء الاصطناعي يقوم بالتحليل...",
    analyzingSub: "يتم الآن التحليل المتسلسل لكل الرموز لضمان أعلى دقة.",
    backToNew: "العودة للتحليل الجديد",
    forex: "الفوركس",
    crypto: "الكريبتو",
    stocks: "الأسهم",
    metals: "المعادن",
    login: "تسجيل الدخول",
    logout: "تسجيل الخروج",
    readMore: "المزيد من التفاصيل",
    finalDecision: "القرار النهائي",
    confidence: "نسبة الثقة",
    reasons: "أسباب التحليل",
    historicalMatch: "التطابق التاريخي (Fractal)",
    goldOpportunity: "فرصة ذهبية",
    confluenceProof: "برهان التقارب",
    trendVitality: "حيوية الاتجاه",
    momentum: "الزخم",
    buy: "شراء",
    sell: "بيع",
    strong_buy: "شراء قوي",
    strong_sell: "بيع قوي",
    neutral: "محايد",
    no_entry: "لا توجد فرصة",
    allRightsReserved: "جميع الحقوق محفوظة",
    privacyPolicy: "سياسة الخصوصية",
    termsOfUse: "شروط الاستخدام",
    selectMarket: "1. اختر السوق",
    selectSymbols: "2. اختر الأدوات المالية",
    tradingStyle: "3. استراتيجية التداول",
    timeframe: "4. الإطار الزمني",
    scalping: "سكالبينج (دقائق)",
    day_trading: "تداول يومي (ساعات)",
    swing_trading: "سوينج (1-2 يوم)",
    manualInput: "إدخال يدوي (مفصولة بفاصلة)",
    selectAll: "تحديد الكل",
    unselectAll: "إلغاء التحديد",
    clear: "مسح الكل",
    loginRequired: "يجب تسجيل الدخول لبدء التحليل",
    selectAtLeastOne: "يجب اختيار أداة مالية واحدة على الأقل",
    eurPairs: "أزواج اليورو (EUR)",
    usdPairs: "أزواج الدولار (USD)",
    gbpPairs: "أزواج الباوند (GBP)",
    audNzdPairs: "أزواج الأسترالي والنيوزلندي",
    chfCadPairs: "أزواج الفرنك السويسري والكندي",
    topCrypto: "أعلى العملات",
    momentumCrypto: "عملات الزخم",
    altCrypto: "العملات البديلة",
    techStocks: "أسهم التكنولوجيا",
    energyStocks: "أسهم الطاقة والنفط",
    bankStocks: "البنوك",
    preciousMetals: "المعادن الثمينة",
    industrialMetals: "المعادن الصناعية",
    settings: "الإعدادات",
    strategySettings: "قواعد استراتيجية القرار النهائي",
    minCandleSize: "الحد الأدنى لحجم الشمعة (التوسيع)",
    consecutiveCandles: "الشموع المتتالية المطلوبة",
    momentumThreshold: "عتبة الزخم (%)",
    useHigherTimeframe: "تفعيل توافق الأطر الزمنية المتعددة",
    useVolumeAnalysis: "تفعيل تأكيد الحجم",
    useNewsGuard: "تفعيل حارس الأخبار والتقلبات",
    usePsychologicalLevels: "فحص العرض والطلب والأرقام المنسوبة",
    minConfidence: "الحد الأدنى للثقة لإصدار إشارة (%)",
    saveSettings: "حفظ قواعد الاستراتيجية",
    resetDefaults: "إعادة تعيين للقواعد الأصلية",
    settingsSaved: "تم تحديث إعدادات الاستراتيجية بنجاح!",
    trendMaturity: "نضج الاتجاه",
    infancy: "المرحلة الأولى",
    youth: "مرحلة الشباب",
    aging: "مرحلة التقدم في العمر",
    unknown: "غير معروف",
    candles: "شموع",
    searchSymbol: "بحث في جميع الأدوات...",
    addSymbol: "إضافة أداة",
    popularSymbols: "الأدوات المالية الشائعة",
    topSignals: "إشارات عالية الثقة",
    signalExpired: "انتهت صلاحية الإشارة",
    delete: "حذف",
    autoAnalysis: "الماسح التلقائي",
    autoSettings: "إعدادات الماسح",
    autoScan: "بدء المسح",
    allCategories: "جميع الأسواق",
    every: "كل",
    minutes: "دقيقة",
    successSound: "تنبيه النجاح",
    failSound: "تنبيه نهاية الدورة",
    uploadCustom: "رفع صوت مخصص",
    startManualNow: "بدء التحليل اليدوي الآن",
    clearAllResults: "مسح جميع النتائج",
    useCandleMatch: "فلتر تطابق جذوع الشموع (يومي/أسبوعي/شهري)",
    candleMatchDailyThreshold: "عتبة جذع الشمعة اليومية (بيبس)",
    candleMatchWeeklyThreshold: "عتبة جذع الشمعة الأسبوعية (بيبس)",
    candleMatchMonthlyThreshold: "عتبة جذع الشمعة الشهرية (بيبس)",
  },
};
