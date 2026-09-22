import { StoreBot, categoryOf, typeOf, typeLabelForCat, isFree } from './storeService';

type Motif =
  | 'momentum'
  | 'upgrade'
  | 'breakoutReversal'
  | 'breakout'
  | 'reversal'
  | 'trend'
  | 'range'
  | 'orderblocks'
  | 'grid'
  | 'scalping'
  | 'oscillator'
  | 'default';

interface StrategyProfile {
  motif: Motif;
  accent: string;
  badge: string;
  taglineAr: string;
  taglineEn: string;
}

const TOP_SHADES: Record<Motif, string> = {
  momentum: '#3b0764',
  upgrade: '#082f49',
  breakoutReversal: '#7f1d1d',
  breakout: '#78350f',
  reversal: '#9f1239',
  trend: '#134e4a',
  range: '#164e63',
  orderblocks: '#431407',
  grid: '#082f49',
  scalping: '#7c2d12',
  oscillator: '#0c4a6e',
  default: '#064e3b',
};

function detectStrategy(bot: StoreBot): StrategyProfile {
  const baked = `${bot.name} ${bot.description}`;
  const text = baked.toLowerCase();
  const has = (words: string[]) => words.some((w) => text.includes(w) || baked.includes(w));

  if (!isFree(bot) && has(['plus', 'upgrad', 'improved performance'])) {
    return {
      motif: 'upgrade',
      accent: '#38bdf8',
      badge: 'PRO UPGRADED',
      taglineAr: 'نسخة مطوّرة بجودة وأداء أعلى',
      taglineEn: 'Upgraded performance & reliability',
    };
  }
  if (has(['momentum', 'زخم'])) {
    return {
      motif: 'momentum',
      accent: '#a78bfa',
      badge: 'MOMENTUM',
      taglineAr: 'تحليل قوة الزخم واقتناص الحركات القوية',
      taglineEn: 'Momentum strength engine',
    };
  }
  if (has(['order block', 'supply', 'demand', 'عرض وطلب', 'منطق'])) {
    return {
      motif: 'orderblocks',
      accent: '#f97316',
      badge: 'ORDER BLOCKS',
      taglineAr: 'مناطق عرض وطلب على فريمات مجتمعة',
      taglineEn: 'Supply & demand zone entries',
    };
  }
  if (has(['rringe', 'range', 'رينج', 'عرضي'])) {
    return {
      motif: 'range',
      accent: '#22d3ee',
      badge: 'RANGE',
      taglineAr: 'تداول احترافي في الاتجاه العرضي',
      taglineEn: 'Range trading engine',
    };
  }
  if (has(['counter-trend', 'counter trend', 'reversal', 'opposite direction', 'انعكاس', 'عكس الاتجاه', 'عكس اتجاه'])) {
    if (has(['breakout', 'break out', 'اختراق', 'كسر'])) {
      return {
        motif: 'breakoutReversal',
        accent: '#fb7185',
        badge: 'BREAKOUT REVERSAL',
        taglineAr: 'ينتظر اختراق الاتجاه ثم يدخل بعكس الاتجاه',
        taglineEn: 'Breakout then counter-trend reversal',
      };
    }
    return {
      motif: 'reversal',
      accent: '#f43f5e',
      badge: 'REVERSAL',
      taglineAr: 'التداول العكسي بعد الإشارات الصحيحة',
      taglineEn: 'Reversal opportunities',
    };
  }
  if (has(['breakout', 'break out', 'اختراق', 'كسر'])) {
    return {
      motif: 'breakout',
      accent: '#f59e0b',
      badge: 'BREAKOUT',
      taglineAr: 'كشف الاختراقات الصحيحة ثم الدخول',
      taglineEn: 'Valid breakout detection',
    };
  }
  if (has(['grid', 'شبكة'])) {
    return {
      motif: 'grid',
      accent: '#38bdf8',
      badge: 'GRID',
      taglineAr: 'تداول شبكي منظم عند المستويات',
      taglineEn: 'Grid trading engine',
    };
  }
  if (has(['scalp', 'سكالب', 'سكالبينج'])) {
    return {
      motif: 'scalping',
      accent: '#fb923c',
      badge: 'SCALPING',
      taglineAr: 'صفقات سريعة على التحركات اللحظية',
      taglineEn: 'Fast scalping entries',
    };
  }
  if (has(['rsi', 'indicator', 'indicators', 'average', 'average', 'smc', 'تحليل', 'عوامل', 'متوسط', 'مؤشر'])) {
    return {
      motif: 'oscillator',
      accent: '#0ea5e9',
      badge: 'SMART SIGNALS',
      taglineAr: 'إشارات المؤشرات الذكية المسيطر عليها',
      taglineEn: 'Smart indicator signals',
    };
  }
  if (has(['trend', 'اتجاه', 'ترند'])) {
    return {
      motif: 'trend',
      accent: '#14b8a6',
      badge: 'TREND',
      taglineAr: 'ملاحقة الاتجاه الرئيسي للحركة',
      taglineEn: 'Trend follower',
    };
  }
  return {
    motif: 'default',
    accent: '#10b981',
    badge: 'SMART BOT',
    taglineAr: 'تداول ذكي وموثوق',
    taglineEn: 'Smart reliable bot',
  };
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const GRID_BG = `
  <g stroke="#94a3b8" stroke-opacity="0.10" stroke-width="1">
    <line x1="0" y1="72" x2="640" y2="72"/><line x1="0" y1="144" x2="640" y2="144"/>
    <line x1="0" y1="216" x2="640" y2="216"/><line x1="0" y1="288" x2="640" y2="288"/>
    <line x1="80" y1="0" x2="80" y2="360"/><line x1="160" y1="0" x2="160" y2="360"/>
    <line x1="240" y1="0" x2="240" y2="360"/><line x1="320" y1="0" x2="320" y2="360"/>
    <line x1="400" y1="0" x2="400" y2="360"/><line x1="480" y1="0" x2="480" y2="360"/>
    <line x1="560" y1="0" x2="560" y2="360"/>
  </g>`;

function motifGraphic(st: StrategyProfile): string {
  const a = st.accent;
  const path = (pts: string, w = 3.5, op = 0.25) => `
    <g fill="none" stroke="${a}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}">
      <polyline points="${pts}"/>
    </g>`;
  switch (st.motif) {
    case 'upgrade':
      return `
        <path d="M436 288 L522 288 L548 252 L476 132 L404 252 Z" fill="none" stroke="${a}" stroke-width="2.5" stroke-opacity="0.35"/>
        <path d="M476 132 L548 252 L522 288 L436 288 Z" fill="${a}" fill-opacity="0.12"/>
        <path d="M476 252 l-20 -38 12 0 -14 -26 26 44 -12 0 z" fill="#e0f2fe"/>
        <g fill="none" stroke="${a}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="320,260 380,236 440,240 500,196 560,200 620,158"/>
        </g>
        <g fill="none" stroke="${a}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.18">
          <polyline points="320,260 380,236 440,240 500,196 560,200 620,158"/>
        </g>`;
    case 'momentum':
      return `
        ${path('320,266 380,248 420,254 460,218 500,226 540,180 580,188 620,148', 4.5, 0.2)}
        ${path('320,266 380,248 420,254 460,218 500,226 540,180 580,188 620,148', 10, 0.15)}
        <g fill="#c4b5fd" opacity="0.9">
          <rect x="356" y="262" width="12" height="18" rx="2"/>
          <rect x="414" y="232" width="12" height="38" rx="2"/>
          <rect x="476" y="206" width="12" height="54" rx="2"/>
          <rect x="538" y="180" width="12" height="70" rx="2"/>
          <rect x="598" y="152" width="12" height="88" rx="2"/>
        </g>
        <path d="M548 112 l-20 44 h17 l-17 44 40 -60 h-19 z" fill="#fde68a"/>`;
    case 'breakoutReversal':
      return `
        <line x1="310" y1="210" x2="622" y2="210" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.8"/>
        <g fill="none" stroke="${a}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="310,262 360,248 404,226 452,202 468,192"/>
          <polyline points="468,192 524,272 556,246 602,286"/>
        </g>
        <g fill="none" stroke="${a}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" opacity="0.16">
          <polyline points="310,262 360,248 404,226 452,202 468,192 524,272 556,246 602,286"/>
        </g>
        <circle cx="468" cy="192" r="6" fill="none" stroke="#ffffff" stroke-width="2.5"/>
        <path d="M602 286 l12 -18 h-24 z" fill="${a}"/>
        <text x="588" y="176" text-anchor="end" font-family="Arial" font-weight="800" font-size="14" fill="#fecdd3">enters opposite</text>`;
    case 'breakout':
      return `
        <line x1="320" y1="212" x2="622" y2="212" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.75"/>
        <g fill="none" stroke="${a}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="320,246 360,236 404,206 452,192 496,196 540,168 582,176 620,144"/>
        </g>
        <g stroke="${a}" stroke-width="8" opacity="0.18" stroke-linecap="round" stroke-linejoin="round" fill="none">
          <polyline points="320,246 360,236 404,206 452,192 496,196 540,168 582,176 620,144"/>
        </g>
        <rect x="486" y="170" width="14" height="58" rx="3" fill="#fcd34d"/>`;
    case 'reversal':
      return `
        ${path('320,238 380,282 440,300 486,296 536,258 578,220 620,194', 3.5, 0.2)}
        ${path('320,238 380,282 440,300 486,296 536,258 578,220 620,194', 7, 0.18)}
        <path d="M560 214 l-16 12 18 -4 z" fill="${a}"/>`;
    case 'range':
      return `
        <line x1="310" y1="182" x2="622" y2="182" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.8"/>
        <line x1="310" y1="284" x2="622" y2="284" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.8"/>
        <g fill="none" stroke="${a}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="320,288 352,258 384,292 416,262 448,290 480,258 512,292 544,262 576,290 620,268"/>
        </g>
        <g fill="none" stroke="${a}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.16">
          <polyline points="320,288 352,258 384,292 416,262 448,290 480,258 512,292 544,262 576,290 620,268"/>
        </g>
        <path d="M352 172 l10 -18 h-20 z" fill="${a}"/><path d="M556 296 l12 -16 h-24 z" fill="${a}"/>`;
    case 'orderblocks':
      return `
        <rect x="310" y="136" width="310" height="40" rx="6" fill="${a}" opacity="0.30"/>
        <rect x="310" y="240" width="310" height="40" rx="6" fill="${a}" opacity="0.18"/>
        <line x1="310" y1="136" x2="620" y2="136" stroke="${a}" stroke-width="2" stroke-opacity="0.8"/>
        <line x1="310" y1="176" x2="620" y2="176" stroke="${a}" stroke-width="2" stroke-opacity="0.8"/>
        <line x1="310" y1="240" x2="620" y2="240" stroke="${a}" stroke-width="2" stroke-opacity="0.6"/>
        <line x1="310" y1="280" x2="620" y2="280" stroke="${a}" stroke-width="2" stroke-opacity="0.6"/>
        <g fill="none" stroke="${a}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="320,184 350,176 388,180 424,170 462,174 500,262 540,258 580,266 620,262"/>
          <polyline points="500,262 500,300"/>
        </g>
        <circle cx="500" cy="262" r="5" fill="${a}"/>
        <text x="466" y="312" text-anchor="middle" font-family="Arial" font-weight="800" font-size="12" fill="#fdba74">support</text>
        <text x="560" y="326" text-anchor="middle" font-family="Arial" font-weight="800" font-size="12" fill="#fdba74">demand zone</text>`;
    case 'trend':
      return `
        <line x1="320" y1="260" x2="620" y2="168" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/>
        <line x1="336" y1="240" x2="636" y2="148" stroke="${a}" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.3"/>
        <line x1="304" y1="280" x2="604" y2="188" stroke="${a}" stroke-width="1.5" stroke-dasharray="5 5" opacity="0.3"/>
        <path d="M620 168 l-10 -18 h20 z" fill="${a}"/>`;
    case 'grid':
      return `
        <rect x="320" y="150" width="300" height="34" rx="6" fill="${a}" opacity="0.18"/>
        <rect x="320" y="196" width="300" height="34" rx="6" fill="${a}" opacity="0.30"/>
        <rect x="320" y="242" width="300" height="34" rx="6" fill="${a}" opacity="0.18"/>
        <line x1="470" y1="150" x2="470" y2="276" stroke="${a}" stroke-width="1.5" stroke-dasharray="4 5" opacity="0.6"/>
        <path d="M352 200 l-10 14 20 0 z" fill="${a}"/>`;
    case 'scalping':
      return `
        <g fill="none" stroke="${a}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="320,226 336,258 352,222 368,256 384,224 400,258 416,222 432,256 448,224 464,258 480,222 496,254 512,224 528,256 544,222 560,252 576,224 592,254 620,228"/>
        </g>
        <g stroke="${a}" stroke-width="6" opacity="0.15" fill="none" stroke-linecap="round">
          <polyline points="320,226 352,222 384,224 416,222 448,224 480,222 512,224 544,222 576,224 620,228"/>
        </g>`;
    case 'oscillator':
      return `
        <line x1="320" y1="236" x2="620" y2="236" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.5"/>
        <g fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round">
          <polyline points="320,238 350,214 384,258 420,218 456,256 492,214 528,252 564,216 620,230"/>
        </g>
        <g stroke="${a}" stroke-width="7" opacity="0.15" fill="none" stroke-linecap="round">
          <polyline points="320,238 350,214 384,258 420,218 456,256 492,214 528,252 564,216 620,230"/>
        </g>`;
    default:
      return `
        <g stroke="#64748b" stroke-width="1.5" stroke-linecap="round">
          <line x1="366" y1="252" x2="366" y2="286"/><line x1="416" y1="230" x2="416" y2="286"/>
          <line x1="466" y1="244" x2="466" y2="290"/><line x1="516" y1="220" x2="516" y2="286"/>
        </g>
        <g>
          <rect x="360" y="262" width="12" height="40" rx="2" fill="#34d399"/>
          <rect x="410" y="240" width="12" height="50" rx="2" fill="#34d399"/>
          <rect x="460" y="256" width="12" height="34" rx="2" fill="#fb7185"/>
          <rect x="510" y="230" width="12" height="56" rx="2" fill="#34d399"/>
          <rect x="558" y="244" width="12" height="42" rx="2" fill="#34d399"/>
        </g>
        ${path('344,286 396,268 448,274 500,244 552,252 620,224', 3.5, 0.2)}
        <path d="M620 224 l-8 -16 h16 z" fill="${a}"/>`;
  }
}

export function generateBotBanner(bot: StoreBot): string {
  const st = detectStrategy(bot);
  const name = esc((bot.name || 'Trading Bot').slice(0, 30));
  const typeTxt = esc(typeLabelForCat(categoryOf(bot), typeOf(bot), true));
  const badge = esc(isFree(bot) ? 'FREE' : (bot.name || '').toLowerCase().includes('plus') ? 'PRO / UPGRADED' : st.badge);
  const tagAr = esc(st.taglineAr);
  const tagEn = esc(st.taglineEn);
  const a = st.accent;
  const top = TOP_SHADES[st.motif];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/>
      <stop offset="1" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="${a}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.85" cy="0.12" r="0.8">
      <stop offset="0" stop-color="${a}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${a}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <rect width="640" height="360" fill="url(#glow)"/>
  ${GRID_BG}
  ${motifGraphic(st)}
  <text x="32" y="48" font-family="Arial, sans-serif" font-weight="800" font-size="17" letter-spacing="4" fill="${a}">JOSEPH.TRADING</text>
  <text x="32" y="150" font-family="Arial, sans-serif" font-weight="900" font-size="27" fill="#ffffff">${name}</text>
  <text x="608" y="190" direction="rtl" text-anchor="end" font-family="Arial, sans-serif" font-weight="600" font-size="17" fill="#e2e8f0" opacity="0.95">${tagAr}</text>
  <text x="32" y="214" font-family="Arial, sans-serif" font-weight="700" font-size="15" fill="${a}" opacity="0.95">${tagEn}</text>
  <rect x="32" y="224" rx="10" width="200" height="34" fill="url(#acc)"/>
  <text x="132" y="247" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="14" fill="#020617">${typeTxt}</text>
  <rect x="438" y="288" rx="12" width="170" height="44" fill="#ffffff" opacity="0.08" stroke="${a}" stroke-opacity="0.6"/>
  <text x="523" y="317" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="18" letter-spacing="2" fill="${a}">${badge}</text>
</svg>`;

  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}