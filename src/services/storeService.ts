import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, query, orderBy } from 'firebase/firestore';

export interface StoreBot {
  id?: string;
  name: string;
  description: string;
  price: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string;
  imageData?: string;
  createdAt: number;
}

const BOTS_COLLECTION = 'store_bots';
const PURCHASES_COLLECTION = 'store_purchases';

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
    fileName: bot.fileName,
    fileType: bot.fileType,
    fileSize: bot.fileSize,
    fileData: bot.fileData,
    imageData: bot.imageData || '',
    createdAt: Date.now(),
  });
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