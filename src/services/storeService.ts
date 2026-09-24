import { db } from '../lib/firebase';
import type { Language } from '../lib/i18n';
import { ltp, pkick } from '../lib/i18nUI';
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, query, orderBy, updateDoc, where, getDoc } from 'firebase/firestore';

export type StoreCategory = 'bot' | 'indicator' | 'plan' | 'other';

export interface StoreBot {
  id?: string;
  name: string;
  description: string;
  descriptionAr?: string;
  descriptionEn?: string;
  price: number;
  category?: StoreCategory;
  type?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string;
  imageData?: string;
  createdAt: number;
}

export type StoreCategoryLabel = { key: StoreCategory; labelEn: string; labelAr: string; labelEs: string; labelRu: string; labelFr: string; };
export const STORE_CATEGORIES: StoreCategoryLabel[] = [
  { key: 'bot', labelEn: 'Bots', labelAr: 'بوتات', labelEs: 'Bots', labelRu: 'Боты', labelFr: 'Bots' },
  { key: 'indicator', labelEn: 'Indicators', labelAr: 'مؤشرات', labelEs: 'Indicadores', labelRu: 'Индикаторы', labelFr: 'Indicateurs' },
  { key: 'plan', labelEn: 'Plans', labelAr: 'خطط', labelEs: 'Planes', labelRu: 'Планы', labelFr: 'Plans' },
  { key: 'other', labelEn: 'Other Products', labelAr: 'منتجات أخرى', labelEs: 'Otros productos', labelRu: 'Другие товары', labelFr: 'Autres produits' },
];

// Platform types shared by bots & indicators
export const PLATFORM_TYPES: { key: string; labelEn: string; labelAr: string; labelEs: string; labelRu: string; labelFr: string }[] = [
  { key: 'mt5', labelEn: 'MetaTrader 5', labelAr: 'ميتا تريدر 5', labelEs: 'MetaTrader 5', labelRu: 'MetaTrader 5', labelFr: 'MetaTrader 5' },
  { key: 'tradingview', labelEn: 'TradingView', labelAr: 'ترندنق فيو', labelEs: 'TradingView', labelRu: 'TradingView', labelFr: 'TradingView' },
  { key: 'ctrader', labelEn: 'cTrader', labelAr: 'سي تريدر', labelEs: 'cTrader', labelRu: 'cTrader', labelFr: 'cTrader' },
];

// Types for "other products"
export const OTHER_TYPES: { key: string; labelEn: string; labelAr: string; labelEs: string; labelRu: string; labelFr: string }[] = [
  { key: 'template', labelEn: 'Website Templates', labelAr: 'قوالب مواقع', labelEs: 'Plantillas web', labelRu: 'Шаблоны сайтов', labelFr: 'Modèles de sites' },
  { key: 'banner', labelEn: 'Banners', labelAr: 'بنرات إعلانية', labelEs: 'Banners', labelRu: 'Баннеры', labelFr: 'Bannières' },
  { key: 'logo', labelEn: 'Logos', labelAr: 'شعارات', labelEs: 'Logotipos', labelRu: 'Логотипы', labelFr: 'Logos' },
];

export function typesForCategory(cat: StoreCategory): { key: string; labelEn: string; labelAr: string; labelEs: string; labelRu: string; labelFr: string }[] {
  if (cat === 'other') return OTHER_TYPES;
  if (cat === 'bot' || cat === 'indicator') return PLATFORM_TYPES;
  return [];
}

export function typeOf(bot: StoreBot): string {
  return bot.type || '';
}

export function typeLabel(key: string, lang: Language): string {
  const t = [...PLATFORM_TYPES, ...OTHER_TYPES].find((x) => x.key === key);
  return pkick(lang, t, 'label');
}

export function typeLabelForCat(cat: StoreCategory, key: string, lang: Language | boolean): string {
  const l: Language = typeof lang === 'string' ? lang : 'en';
  const base = typeLabel(key, l);
  if (cat === 'bot') return ltp(l, 679, base);
  if (cat === 'indicator') return ltp(l, 680, base);
  return base;
}

export function categoryOf(bot: StoreBot): StoreCategory {
  return bot.category || 'bot';
}

export function isFree(bot: StoreBot): boolean {
  return (bot.price || 0) <= 0;
}

const BOTS_COLLECTION = 'store_bots';
const PURCHASES_COLLECTION = 'store_purchases';

const DOWNLOAD_GRANTS_KEY = 'store_download_grants';
const DOWNLOADED_KEY = 'store_downloaded_bots';

function readMap(key: string): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}

function writeMap(key: string, map: Record<string, number>): void {
  try { localStorage.setItem(key, JSON.stringify(map)); } catch {}
}

export const DOWNLOAD_GRANT_TTL_MS = 60 * 60 * 1000;

export function getDownloadGrant(botId: string): number | null {
  const grants = readMap(DOWNLOAD_GRANTS_KEY);
  const ts = grants[botId];
  if (!ts) return null;
  if (Date.now() - ts >= DOWNLOAD_GRANT_TTL_MS) {
    delete grants[botId];
    writeMap(DOWNLOAD_GRANTS_KEY, grants);
    return null;
  }
  return ts;
}

export function grantBotDownload(botId: string): void {
  const grants = readMap(DOWNLOAD_GRANTS_KEY);
  if (grants[botId]) return;
  grants[botId] = Date.now();
  writeMap(DOWNLOAD_GRANTS_KEY, grants);
}

export function consumeBotDownload(botId: string): void {
  const grants = readMap(DOWNLOAD_GRANTS_KEY);
  delete grants[botId];
  writeMap(DOWNLOAD_GRANTS_KEY, grants);
  const downloaded = readMap(DOWNLOADED_KEY);
  downloaded[botId] = Date.now();
  writeMap(DOWNLOADED_KEY, downloaded);
}

export function hasDownloadedBot(botId: string): boolean {
  return !!readMap(DOWNLOADED_KEY)[botId];
}

export async function fetchStoreBots(): Promise<StoreBot[]> {
  try {
    const q = query(collection(db, BOTS_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreBot));
  } catch {
    return [];
  }
}

export async function addStoreBot(bot: Omit<StoreBot, 'id'>): Promise<void> {
  await addDoc(collection(db, BOTS_COLLECTION), {
    name: bot.name,
    description: bot.description,
    descriptionAr: bot.descriptionAr || '',
    descriptionEn: bot.descriptionEn || '',
    price: bot.price,
    category: bot.category || 'bot',
    type: bot.type || '',
    fileName: bot.fileName,
    fileType: bot.fileType,
    fileSize: bot.fileSize,
    fileData: bot.fileData,
    imageData: bot.imageData || '',
    createdAt: Date.now(),
  });
}

export async function updateStoreBot(id: string, data: Partial<StoreBot>): Promise<void> {
  const ref = doc(db, BOTS_COLLECTION, id);
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.descriptionAr !== undefined) updateData.descriptionAr = data.descriptionAr;
  if (data.descriptionEn !== undefined) updateData.descriptionEn = data.descriptionEn;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.fileName !== undefined) updateData.fileName = data.fileName;
  if (data.fileType !== undefined) updateData.fileType = data.fileType;
  if (data.fileSize !== undefined) updateData.fileSize = data.fileSize;
  if (data.fileData !== undefined) updateData.fileData = data.fileData;
  if (data.imageData !== undefined) updateData.imageData = data.imageData;
  await updateDoc(ref, updateData);
}

export async function deleteStoreBot(id: string): Promise<void> {
  await deleteDoc(doc(db, BOTS_COLLECTION, id));
}

export async function recordBotPurchase(bot: StoreBot, email?: string): Promise<void> {
  try {
    await setDoc(doc(collection(db, PURCHASES_COLLECTION), Date.now().toString()), {
      botId: bot.id || '',
      botName: bot.name,
      price: bot.price,
      email: email || '',
      purchasedAt: Date.now(),
    });
  } catch {}
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',');
  const mime = meta?.match(/data:(.*?);/)?.[1] || 'application/octet-stream';
  const byteString = atob(base64 || '');
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function downloadBot(bot: StoreBot): void {
  if (!bot.fileData) return;
  try {
    const blob = dataUrlToBlob(bot.fileData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = bot.fileName || 'trading-bot';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  } catch {}
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Standard elegant horizontal rectangle used for all bot preview images (16:9)
const STORE_IMAGE_WIDTH = 640;
const STORE_IMAGE_HEIGHT = 360;

export function resizeImageToStandard(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const W = STORE_IMAGE_WIDTH;
        const H = STORE_IMAGE_HEIGHT;
        const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        const sx = (img.naturalWidth - W / scale) / 2;
        const sy = (img.naturalHeight - H / scale) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); reject(new Error('canvas')); return; }
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, sx, sy, W / scale, H / scale, 0, 0, W, H);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('invalid image')); };
    img.src = url;
  });
}