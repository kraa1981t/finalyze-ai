import { db } from './firebase';
import { collection, addDoc, increment, updateDoc, doc, getDoc, setDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';

// ═══════════════════════════════════════════════════
// Google Analytics helpers
// ═══════════════════════════════════════════════════

declare global { interface Window { gtag?: (...args: any[]) => void } }

function gaEvent(eventName: string, params?: Record<string, any>) {
  try { window.gtag?.('event', eventName, params); } catch {}
}

// ═══════════════════════════════════════════════════
// نظام تتبع المشاهدات والنقرات
// ═══════════════════════════════════════════════════

export interface SiteStats {
  totalViews: number;
  todayViews: number;
  totalClicks: number;
  todayClicks: number;
  uniqueVisitors: number;
  todayUniqueVisitors: number;
  topPages: { page: string; views: number }[];
  topClicks: { element: string; clicks: number }[];
  topCountries: { country: string; views: number }[];
  topSources: { source: string; views: number }[];
  lastUpdated: string;
}

// Session ID to track unique visitors (persists per browser tab)
function getSessionId(): string {
  let sid = sessionStorage.getItem('finalyze_tracking_sid');
  if (!sid) {
    sid = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    sessionStorage.setItem('finalyze_tracking_sid', sid);
  }
  return sid;
}

// Get today's date string (YYYY-MM-DD)
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

// ═══════════════════════════════════════════════════
// كشف مصدر الزيارة من Referrer
// ═══════════════════════════════════════════════════

function detectSource(): string {
  const ref = document.referrer?.toLowerCase() || '';
  const url = window.location.href;

  // Check UTM parameters first
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  if (utmSource) return utmSource;

  // Check URL hash for source hints
  if (url.includes('utm_source=')) {
    try {
      const hashParams = new URLSearchParams(url.split('#')[1] || '');
      const hs = hashParams.get('utm_source');
      if (hs) return hs;
    } catch {}
  }

  if (!ref || ref.includes(new URL(window.location.href).hostname)) return 'direct';

  if (ref.includes('google')) return 'Google Search';
  if (ref.includes('bing')) return 'Bing Search';
  if (ref.includes('yahoo')) return 'Yahoo Search';
  if (ref.includes('duckduckgo')) return 'DuckDuckGo';
  if (ref.includes('baidu')) return 'Baidu';
  if (ref.includes('yandex')) return 'Yandex';
  if (ref.includes('facebook') || ref.includes('fb.com') || ref.includes('fb.me')) return 'Facebook';
  if (ref.includes('twitter') || ref.includes('x.com') || ref.includes('t.co')) return 'Twitter/X';
  if (ref.includes('instagram')) return 'Instagram';
  if (ref.includes('youtube')) return 'YouTube';
  if (ref.includes('tiktok')) return 'TikTok';
  if (ref.includes('linkedin')) return 'LinkedIn';
  if (ref.includes('reddit')) return 'Reddit';
  if (ref.includes('pinterest')) return 'Pinterest';
  if (ref.includes('whatsapp') || ref.includes('wa.me')) return 'WhatsApp';
  if (ref.includes('telegram')) return 'Telegram';
  if (ref.includes('discord')) return 'Discord';
  if (ref.includes('github')) return 'GitHub';

  // Extract domain name as fallback
  try {
    const domain = new URL(ref).hostname.replace('www.', '');
    return domain;
  } catch {
    return 'other';
  }
}

// ═══════════════════════════════════════════════════
// جلب الدولة من IP (مجاني، بدون مفتاح)
// ═══════════════════════════════════════════════════

interface GeoData {
  country: string;
  city: string;
}

let cachedGeo: GeoData | null = null;

async function getGeoLocation(): Promise<GeoData> {
  if (cachedGeo && cachedGeo.country !== 'Unknown') return cachedGeo;

  // Check sessionStorage cache (skip if it was "Unknown" before)
  const cached = sessionStorage.getItem('finalyze_geo');
  if (cached) {
    const parsed = JSON.parse(cached);
    if (parsed.country && parsed.country !== 'Unknown') {
      cachedGeo = parsed;
      return parsed;
    }
    sessionStorage.removeItem('finalyze_geo');
  }

  // Try multiple free HTTPS geo APIs
  const apis = [
    { url: 'https://ipwho.is/', parse: (d: any) => ({ country: d.country || 'Unknown', city: d.city || 'Unknown' }) },
    { url: 'https://freeipapi.com/api/json', parse: (d: any) => ({ country: d.countryName || 'Unknown', city: d.cityName || 'Unknown' }) },
  ];

  for (const api of apis) {
    try {
      const res = await fetch(api.url, { signal: AbortSignal.timeout(4000), mode: 'cors' });
      if (res.ok) {
        const data = await res.json();
        const geo = api.parse(data);
        if (geo.country && geo.country !== 'Unknown') {
          cachedGeo = geo;
          sessionStorage.setItem('finalyze_geo', JSON.stringify(geo));
          return geo;
        }
      }
    } catch {}
  }

  // Fallback: detect country from timezone
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzCountry = getTimezoneCountry(tz);
    if (tzCountry) {
      const geo: GeoData = { country: tzCountry, city: tz.split('/').pop()?.replace(/_/g, ' ') || 'Unknown' };
      cachedGeo = geo;
      sessionStorage.setItem('finalyze_geo', JSON.stringify(geo));
      return geo;
    }
  } catch {}

  const fallback: GeoData = { country: 'Unknown', city: 'Unknown' };
  cachedGeo = fallback;
  sessionStorage.setItem('finalyze_geo', JSON.stringify(fallback));
  return fallback;
}

function getTimezoneCountry(tz: string): string | null {
  const map: Record<string, string> = {
    'Africa/Algiers': 'Algeria', 'Africa/Cairo': 'Egypt', 'Africa/Casablanca': 'Morocco',
    'Africa/Tunis': 'Tunisia', 'Africa/Lagos': 'Nigeria', 'Africa/Nairobi': 'Kenya',
    'Africa/Johannesburg': 'South Africa', 'Africa/Accra': 'Ghana',
    'Asia/Riyadh': 'Saudi Arabia', 'Asia/Dubai': 'UAE', 'Asia/Qatar': 'Qatar',
    'Asia/Kuwait': 'Kuwait', 'Asia/Bahrain': 'Bahrain', 'Asia/Muscat': 'Oman',
    'Asia/Baghdad': 'Iraq', 'Asia/Beirut': 'Lebanon', 'Asia/Damascus': 'Syria',
    'Asia/Amman': 'Jordan', 'Asia/Jerusalem': 'Palestine', 'Asia/Tehran': 'Iran',
    'Asia/Istanbul': 'Turkey', 'Asia/Almaty': 'Kazakhstan', 'Asia/Tashkent': 'Uzbekistan',
    'Asia/Karachi': 'Pakistan', 'Asia/Kolkata': 'India', 'Asia/Dhaka': 'Bangladesh',
    'Asia/Bangkok': 'Thailand', 'Asia/Jakarta': 'Indonesia', 'Asia/Manila': 'Philippines',
    'Asia/Ho_Chi_Minh': 'Vietnam', 'Asia/Kuala_Lumpur': 'Malaysia', 'Asia/Singapore': 'Singapore',
    'Asia/Tokyo': 'Japan', 'Asia/Seoul': 'South Korea', 'Asia/Shanghai': 'China',
    'Asia/Hong_Kong': 'Hong Kong', 'Asia/Taipei': 'Taiwan',
    'Europe/London': 'United Kingdom', 'Europe/Paris': 'France', 'Europe/Berlin': 'Germany',
    'Europe/Madrid': 'Spain', 'Europe/Rome': 'Italy', 'Europe/Amsterdam': 'Netherlands',
    'Europe/Brussels': 'Belgium', 'Europe/Zurich': 'Switzerland', 'Europe/Vienna': 'Austria',
    'Europe/Warsaw': 'Poland', 'Europe/Prague': 'Czech Republic', 'Europe/Budapest': 'Hungary',
    'Europe/Bucharest': 'Romania', 'Europe/Sofia': 'Bulgaria', 'Europe/Athens': 'Greece',
    'Europe/Lisbon': 'Portugal', 'Europe/Dublin': 'Ireland', 'Europe/Copenhagen': 'Denmark',
    'Europe/Stockholm': 'Sweden', 'Europe/Oslo': 'Norway', 'Europe/Helsinki': 'Finland',
    'Europe/Moscow': 'Russia', 'Europe/Kiev': 'Ukraine',
    'America/New_York': 'United States', 'America/Chicago': 'United States',
    'America/Denver': 'United States', 'America/Los_Angeles': 'United States',
    'America/Toronto': 'Canada', 'America/Vancouver': 'Canada',
    'America/Sao_Paulo': 'Brazil', 'America/Mexico_City': 'Mexico',
    'America/Buenos_Aires': 'Argentina', 'America/Bogota': 'Colombia',
    'America/Lima': 'Peru', 'America/Santiago': 'Chile',
    'Australia/Sydney': 'Australia', 'Australia/Melbourne': 'Australia',
    'Pacific/Auckland': 'New Zealand',
  };
  return map[tz] || null;
}

// ═══════════════════════════════════════════════════
// Helper: update counter doc safely (no race condition)
// ═══════════════════════════════════════════════════

async function incrementCounter(
  docId: string,
  field: string,
  elementName: string,
  sessionId: string,
  extra?: Record<string, string>
): Promise<void> {
  const counterRef = doc(db, 'analytics_counters', docId);
  const extraFields: Record<string, any> = {};
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      extraFields[`${k}.${v}`] = increment(1);
    }
  }

  try {
    await updateDoc(counterRef, {
      total: increment(1),
      [`${field}.${elementName}`]: increment(1),
      [`sessions.${sessionId}`]: increment(1),
      ...extraFields,
      lastUpdated: new Date().toISOString(),
    });
  } catch (e: any) {
    if (e?.code === 'not-found' || e?.message?.includes('not found')) {
      const nestedExtra: Record<string, any> = {};
      if (extra) {
        for (const [k, v] of Object.entries(extra)) {
          nestedExtra[k] = { [v]: 1 };
        }
      }
      await setDoc(counterRef, {
        total: 1,
        [field]: { [elementName]: 1 },
        sessions: { [sessionId]: 1 },
        ...nestedExtra,
        date: docId.replace(/^(views|clicks)_/, ''),
        lastUpdated: new Date().toISOString(),
      });
    } else {
      throw e;
    }
  }
}

// ═══════════════════════════════════════════════════
// تسجيل مشاهدة صفحة
// ═══════════════════════════════════════════════════

export async function trackPageView(page: string): Promise<void> {
  try {
    const today = getToday();
    const sessionId = getSessionId();
    const [source, geo] = await Promise.all([detectSource(), getGeoLocation()]);

    // Send to Google Analytics
    gaEvent('page_view', { page_title: page, page_location: window.location.href });

    // Record individual view (fire-and-forget)
    addDoc(collection(db, 'analytics_views'), {
      page,
      timestamp: new Date().toISOString(),
      sessionId,
      date: today,
      source,
      country: geo.country,
      city: geo.city,
    }).catch(() => {});

    // Update daily counter
    await incrementCounter(`views_${today}`, 'pages', page, sessionId, {
      countries: geo.country,
      sources: source,
    });

    // Update all-time counter
    await incrementCounter('views_alltime', 'pages', page, sessionId, {
      countries: geo.country,
      sources: source,
    });
  } catch (e) {
    console.warn('[Tracking] Failed to track page view:', e);
  }
}

// ═══════════════════════════════════════════════════
// تسجيل نقرة
// ═══════════════════════════════════════════════════

export async function trackClick(element: string, page: string): Promise<void> {
  try {
    const today = getToday();
    const sessionId = getSessionId();

    // Send to Google Analytics
    gaEvent('click', { element_name: element, page_name: page });

    // Record individual click (fire-and-forget)
    addDoc(collection(db, 'analytics_clicks'), {
      element,
      page,
      timestamp: new Date().toISOString(),
      sessionId,
      date: today,
    }).catch(() => {});

    // Update daily counter
    await incrementCounter(`clicks_${today}`, 'elements', element, sessionId);

    // Update all-time counter
    await incrementCounter('clicks_alltime', 'elements', element, sessionId);
  } catch (e) {
    console.warn('[Tracking] Failed to track click:', e);
  }
}

// ═══════════════════════════════════════════════════
// جلب الإحصائيات الشاملة
// ═══════════════════════════════════════════════════

export async function getSiteStats(): Promise<SiteStats> {
  const today = getToday();
  const defaultStats: SiteStats = {
    totalViews: 0, todayViews: 0,
    totalClicks: 0, todayClicks: 0,
    uniqueVisitors: 0, todayUniqueVisitors: 0,
    topPages: [], topClicks: [],
    topCountries: [], topSources: [],
    lastUpdated: new Date().toISOString(),
  };

  try {
    const [todayViewsSnap, allTimeViewsSnap, todayClicksSnap, allTimeClicksSnap] = await Promise.all([
      getDoc(doc(db, 'analytics_counters', `views_${today}`)),
      getDoc(doc(db, 'analytics_counters', 'views_alltime')),
      getDoc(doc(db, 'analytics_counters', `clicks_${today}`)),
      getDoc(doc(db, 'analytics_counters', 'clicks_alltime')),
    ]);

    const todayViewsData = todayViewsSnap.exists() ? todayViewsSnap.data() : null;
    const allTimeViewsData = allTimeViewsSnap.exists() ? allTimeViewsSnap.data() : null;
    const todayClicksData = todayClicksSnap.exists() ? todayClicksSnap.data() : null;
    const allTimeClicksData = allTimeClicksSnap.exists() ? allTimeClicksSnap.data() : null;

    const todayViews = todayViewsData?.total || 0;
    const totalViews = allTimeViewsData?.total || 0;
    const todayClicks = todayClicksData?.total || 0;
    const totalClicks = allTimeClicksData?.total || 0;

    const todaySessions = todayViewsData?.sessions ? Object.keys(todayViewsData.sessions).length : 0;
    const totalSessions = allTimeViewsData?.sessions ? Object.keys(allTimeViewsData.sessions).length : 0;

    const allPages = allTimeViewsData?.pages || {};
    const allElements = allTimeClicksData?.elements || {};
    const allCountries = allTimeViewsData?.countries || {};
    const allSources = allTimeViewsData?.sources || {};

    // Filter out non-primitive values (like 'sessions' nested objects)
    const isPrimitive = (v: any): boolean => typeof v === 'number' || typeof v === 'string';

    // Top pages (sorted by views, top 5)
    const topPages = Object.entries(allPages)
      .filter(([, v]) => isPrimitive(v))
      .map(([page, views]) => ({ page, views: Number(views) || 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    // Top clicks (sorted by clicks, top 5)
    const topClicks = Object.entries(allElements)
      .filter(([, v]) => isPrimitive(v))
      .map(([element, clicks]) => ({ element, clicks: Number(clicks) || 0 }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);

    // Top countries (sorted by views, top 10)
    const topCountries = Object.entries(allCountries)
      .filter(([, v]) => isPrimitive(v))
      .map(([country, views]) => ({ country: String(country), views: Number(views) || 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // Top sources (sorted by views, top 10)
    const topSources = Object.entries(allSources)
      .filter(([, v]) => isPrimitive(v))
      .map(([source, views]) => ({ source: String(source), views: Number(views) || 0 }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    return {
      totalViews,
      todayViews,
      totalClicks,
      todayClicks,
      uniqueVisitors: totalSessions,
      todayUniqueVisitors: todaySessions,
      topPages,
      topClicks,
      topCountries,
      topSources,
      lastUpdated: new Date().toISOString(),
    };
  } catch (e) {
    console.warn('[Tracking] Failed to get stats:', e);
    return defaultStats;
  }
}

// ═══════════════════════════════════════════════════
// جلب إحصائيات آخر N أيام
// ═══════════════════════════════════════════════════

export async function getDailyStats(days: number = 7): Promise<{ date: string; views: number; clicks: number }[]> {
  const results: { date: string; views: number; clicks: number }[] = [];

  try {
    const dateStrs: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dateStrs.push(d.toISOString().split('T')[0]);
    }

    const snaps = await Promise.all(
      dateStrs.flatMap(dateStr => [
        getDoc(doc(db, 'analytics_counters', `views_${dateStr}`)),
        getDoc(doc(db, 'analytics_counters', `clicks_${dateStr}`)),
      ])
    );

    for (let i = 0; i < dateStrs.length; i++) {
      const viewsSnap = snaps[i * 2];
      const clicksSnap = snaps[i * 2 + 1];
      results.push({
        date: dateStrs[i],
        views: viewsSnap.exists() ? (viewsSnap.data().total || 0) : 0,
        clicks: clicksSnap.exists() ? (clicksSnap.data().total || 0) : 0,
      });
    }
  } catch (e) {
    console.warn('[Tracking] Failed to get daily stats:', e);
  }

  return results;
}

// ═══════════════════════════════════════════════════
// مسح جميع الإحصائيات
// ═══════════════════════════════════════════════════

async function deleteCollection(collectionName: string): Promise<number> {
  let total = 0;
  const snapshot = await getDocs(collection(db, collectionName));
  const BATCH_SIZE = 500;

  for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = snapshot.docs.slice(i, i + BATCH_SIZE);
    chunk.forEach(d => {
      batch.delete(d.ref);
      total++;
    });
    await batch.commit();
  }

  return total;
}

export async function resetAllStats(): Promise<{ counters: number; views: number; clicks: number }> {
  const [counters, views, clicks] = await Promise.all([
    deleteCollection('analytics_counters'),
    deleteCollection('analytics_views'),
    deleteCollection('analytics_clicks'),
  ]);
  return { counters, views, clicks };
}
