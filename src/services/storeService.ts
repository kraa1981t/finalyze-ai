import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, query, orderBy, updateDoc, where, getDoc } from 'firebase/firestore';

export type StoreCategory = 'bot' | 'indicator' | 'plan' | 'other';

export interface StoreBot {
  id?: string;
  name: string;
  description: string;
  price: number;
  category?: StoreCategory;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string;
  imageData?: string;
  createdAt: number;
}

export const STORE_CATEGORIES: { key: StoreCategory; labelAr: string; labelEn: string }[] = [
  { key: 'bot', labelAr: 'بوتات', labelEn: 'Bots' },
  { key: 'indicator', labelAr: 'مؤشرات', labelEn: 'Indicators' },
  { key: 'plan', labelAr: 'خطط', labelEn: 'Plans' },
  { key: 'other', labelAr: 'منتجات أخرى', labelEn: 'Other Products' },
];

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

export function getDownloadGrant(botId: string): number | null {
  const grants = readMap(DOWNLOAD_GRANTS_KEY);
  return grants[botId] ?? null;
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
    price: bot.price,
    category: bot.category || 'bot',
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
  if (data.price !== undefined) updateData.price = data.price;
  if (data.category !== undefined) updateData.category = data.category;
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