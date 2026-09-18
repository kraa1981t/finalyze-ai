import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, Edit3, Trash2, Plus, Lock, Unlock, ArrowLeft, ExternalLink, ShieldOff, Shield, RefreshCw } from 'lucide-react';
import { fetchCryptoPricesDirect } from '../services/apiDirect';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { StoreBot, downloadBot, recordBotPurchase, getDownloadGrant, grantBotDownload, consumeBotDownload, hasDownloadedBot } from '../services/storeService';
import { loadPaymentSettings, savePaymentSettings, ConfirmMode, DEFAULT_CONFIRM_MODE, DEFAULT_BINANCE_EMAIL } from '../services/paymentSettings';
import { createPaymentRequest, checkUserGrant, consumeBotGrant } from '../services/paymentRequests';
import PaymentRequestsSection from './PaymentRequestsSection';

const DEFAULT_PRICES = { weekly: 2, monthly: 6, yearly: 60 };
const SUBSCRIPTION_STORAGE_KEY = 'subscription_prices';

const DEFAULT_ADDRESSES = [
  { id: 'btc', name: 'Bitcoin (BTC)', address: '1QFZMm37yh15jy3dKgMWqmPj2MNvNqnsHe' },
  { id: 'eth', name: 'Ethereum (ETH)', address: '0x5FF1292b76002E97877e8d05D8e8FA15fdD65318' },
  { id: 'ltc', name: 'Litecoin (LTC)', address: 'ltc1qflq2drpe3vc9e3hvq0es97l7922ax7k5fnt4gs' },
  { id: 'trx', name: 'TRON (TRX)', address: 'TDhhmgVHEj8c8qe7za4eMtbQmXeL1oJcDB' },
  { id: 'sol', name: 'Solana (SOL)', address: '4TivXCgxtWWWRjCNFRqwzYEJ2kBG9qDqhH9ECXmM7oFp' },
  { id: 'usdt', name: 'USDT (TRC20)', address: 'TDhhmgVHEj8c8qe7za4eMtbQmXeL1oJcDB' },
];

const COINGECKO_MAP: Record<string, string> = {
  btc: 'bitcoin', eth: 'ethereum', ltc: 'litecoin', trx: 'tron', sol: 'solana', usdt: 'tether',
};

const PRICE_ALIASES: Record<string, string> = {
  bitcoin: 'bitcoin', btc: 'bitcoin',
  ethereum: 'ethereum', eth: 'ethereum',
  litecoin: 'litecoin', ltc: 'litecoin',
  tron: 'tron', trx: 'tron',
  solana: 'solana', sol: 'solana',
  tether: 'tether', usdt: 'tether',
};

const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const SOL_RPC = 'https://api.mainnet-beta.solana.com';

const POPULAR_COINS = [
  'Bitcoin (BTC)', 'Ethereum (ETH)', 'Litecoin (LTC)', 'TRON (TRX)',
  'Solana (SOL)', 'USDT (TRC20)', 'USDC (ERC20)', 'BNB (BSC)',
  'Cardano (ADA)', 'XRP (Ripple)', 'Polkadot (DOT)', 'Dogecoin (DOGE)',
  'Avalanche (AVAX)', 'Polygon (MATIC)', 'Chainlink (LINK)',
];

const STORAGE_KEY = 'crypto_payment_addresses';

interface CryptoAddress {
  id: string;
  name: string;
  address: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planLabel: string;
  amount: number;
  asPage?: boolean;
  manageMode?: boolean;
  onConfirm?: () => void;
  lang?: 'en' | 'ar';
  freemiumDisabled?: boolean;
  onFreemiumToggle?: (v: boolean) => void;
  botPurchase?: StoreBot | null;
  sectionTab?: 'bot' | 'plan';
  onBotPaid?: (bot: StoreBot) => void;
  onGoToStore?: () => void;
  onGoToPlans?: () => void;
  buyerEmail?: string;
  buyerName?: string;
  planDurationDays?: number;
}

const TIMER_STORAGE_KEY = 'payment_timer_minutes';

const fetchWithTimeout = async (url: string, options?: RequestInit, ms = 10000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export default function PaymentModal({ isOpen, onClose, planLabel, amount, asPage, manageMode, onConfirm, lang, freemiumDisabled: externalFreemium, onFreemiumToggle, botPurchase, sectionTab = 'bot', onBotPaid, onGoToStore, onGoToPlans, buyerEmail, buyerName, planDurationDays }: PaymentModalProps) {
  const isAr = lang === 'ar';
  const [section, setSection] = useState<'bot' | 'plan'>(sectionTab || 'bot');
  const [addresses, setAddresses] = useState<CryptoAddress[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_ADDRESSES;
    } catch { return DEFAULT_ADDRESSES; }
  });
  const [prices, setPrices] = useState<Record<string, { usd: number }>>({
    bitcoin: { usd: 67000 }, ethereum: { usd: 3200 }, litecoin: { usd: 85 },
    tron: { usd: 0.12 }, solana: { usd: 150 }, tether: { usd: 1 },
  });
  const [editAddresses, setEditAddresses] = useState<CryptoAddress[]>([]);
  const [isAdmin, setIsAdmin] = useState(manageMode || false);
  const [newAddress, setNewAddress] = useState<CryptoAddress>({ id: '', name: '', address: '' });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [nextId, setNextId] = useState(100);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAmountId, setCopiedAmountId] = useState<string | null>(null);
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState(() => {
    const saved = localStorage.getItem(TIMER_STORAGE_KEY);
    return saved ? parseInt(saved) : 30;
  });
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [editTimer, setEditTimer] = useState(timerMinutes);
  const [requestNo, setRequestNo] = useState<number | null>(null);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected'>('idle');
  const [requestCreating, setRequestCreating] = useState(false);
  const [grantChecking, setGrantChecking] = useState(false);
  const [subPrices, setSubPrices] = useState(() => {
    try { const s = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY); return s ? JSON.parse(s) : DEFAULT_PRICES; }
    catch { return DEFAULT_PRICES; }
  });
  const [editSubPrices, setEditSubPrices] = useState({ ...subPrices });
  const [freemiumDisabled, setFreemiumDisabled] = useState(externalFreemium ?? localStorage.getItem('finalyze_freemium_disabled') === 'true');
  const [error, setError] = useState<string | null>(null);
  const [botGrantTs, setBotGrantTs] = useState<number | null>(null);
  const [botDownloaded, setBotDownloaded] = useState(false);
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(DEFAULT_CONFIRM_MODE);
  const [binanceEmail, setBinanceEmail] = useState(DEFAULT_BINANCE_EMAIL);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    fetchCryptoPricesDirect()
      .then(data => { if (data?.bitcoin?.usd) setPrices(data); })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSection(sectionTab || 'bot');
      setEditAddresses(JSON.parse(JSON.stringify(addresses)));
      setCopiedId(null);
      setNewAddress({ id: '', name: '', address: '' });
      setSelectedCoinId(null);
      setPaymentConfirmed(false);
      setRequestNo(null);
      setRequestStatus('idle');
      setContactName(buyerName || '');
      setContactEmail(buyerEmail || '');
      setTimerRunning(false);
      setTimerSeconds(0);
      if (!manageMode) setIsAdmin(false);
      setEditSubPrices({ ...subPrices });
      if (botPurchase?.id) {
        setBotGrantTs(getDownloadGrant(botPurchase.id));
        setBotDownloaded(hasDownloadedBot(botPurchase.id));
      } else {
        setBotGrantTs(null);
        setBotDownloaded(false);
      }
    }
  }, [isOpen]);

  // Each confirmed payment operation grants exactly ONE download for the bot
  useEffect(() => {
    if (paymentConfirmed && botPurchase?.id) {
      grantBotDownload(botPurchase.id);
      setBotGrantTs(getDownloadGrant(botPurchase.id));
    }
  }, [paymentConfirmed]);

  // Load shared payment settings from Firestore (crypto addresses only)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const sync = async () => {
      const data = await loadPaymentSettings();
      if (cancelled || !data) return;
      if (data.addresses && data.addresses.length) {
        setAddresses(data.addresses);
        setEditAddresses(JSON.parse(JSON.stringify(data.addresses)));
      }
      if (data.confirmMode) setConfirmMode(data.confirmMode);
      if (data.binanceNotifyEmail) setBinanceEmail(data.binanceNotifyEmail);
    };
    sync();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Countdown timer
  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimerSeconds(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds]);

  // Single shared grant — called after the developer releases the numbered request.
  const grantAccess = () => {
    setPaymentConfirmed(true);
    setRequestStatus('approved');
    setTimerRunning(false);
    if (!botPurchase?.id) { onConfirm?.(); return; }
    grantBotDownload(botPurchase.id);
    setBotGrantTs(getDownloadGrant(botPurchase.id));
  };

  const productLabel = botPurchase?.name || planLabel;
  const isBotProduct = section === 'bot' && !!botPurchase?.id;
  const buyerNameFinal = (buyerName || contactName).trim();
  const buyerEmailFinal = (buyerEmail || contactEmail).trim().toLowerCase();

  // Submit a numbered confirmation request. The developer reviews name + date +
  // product and releases manually (may take 1–24 hours).
  const requestManualConfirmation = async () => {
    if (!selectedCoinId) return;
    if (!buyerNameFinal) {
      setError(isAr ? 'أدخل اسمك الكامل أولاً' : 'Enter your full name first');
      return;
    }
    if (!buyerEmailFinal) {
      setError(isAr ? 'أدخل بريدك الإلكتروني أولاً' : 'Enter your email first');
      return;
    }
    const item = addresses.find(a => a.id === selectedCoinId);
    if (!item) return;
    setError(null);
    setRequestCreating(true);
    try {
      const req = await createPaymentRequest({
        kind: isBotProduct ? 'bot' : 'plan',
        botId: botPurchase?.id,
        botName: botPurchase?.name,
        planLabel: isBotProduct ? undefined : productLabel,
        durationDays: isBotProduct ? undefined : (planDurationDays || 30),
        amountUsd: amount,
        coinId: item.id,
        coinName: item.name,
        address: item.address,
        buyerName: buyerNameFinal,
        buyerEmail: buyerEmailFinal,
        method: confirmMode,
      });
      setRequestNo(req.requestNo);
      setRequestStatus('pending');
      setTimerRunning(false);
    } catch {
      setError(isAr ? 'تعذر إرسال طلب التأكيد. حاول مرة أخرى.' : 'Could not submit the confirmation request. Try again.');
    }
    setRequestCreating(false);
  };

  // On open, honor an already-approved grant (returning customer / other device).
  useEffect(() => {
    if (!isOpen || manageMode || !buyerEmailFinal) return;
    let stopped = false;
    checkUserGrant(buyerEmailFinal, isBotProduct ? 'bot' : 'plan', botPurchase?.id).then((g) => {
      if (!stopped && g) grantAccess();
    });
    return () => { stopped = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, buyerEmailFinal, isBotProduct, botPurchase?.id]);

  // Poll Firestore for the developer's manual release — works even if the site
  // was closed while the developer approved.
  useEffect(() => {
    if (!isOpen || requestStatus !== 'pending' || !buyerEmailFinal) return;
    let stopped = false;
    const check = async () => {
      const g = await checkUserGrant(buyerEmailFinal, isBotProduct ? 'bot' : 'plan', botPurchase?.id);
      if (!stopped && g) grantAccess();
    };
    const interval = setInterval(check, 15000);
    check();
    return () => { stopped = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, requestStatus, buyerEmailFinal, isBotProduct, botPurchase?.id]);

  const refreshGrantStatus = async () => {
    if (!buyerEmailFinal) return;
    setGrantChecking(true);
    const g = await checkUserGrant(buyerEmailFinal, isBotProduct ? 'bot' : 'plan', botPurchase?.id);
    if (g) grantAccess();
    else setError(isAr ? 'لم يتم الإفراج بعد. قد يستغرق التأكيد حتى 24 ساعة.' : 'Not released yet. Confirmation may take up to 24 hours.');
    setGrantChecking(false);
  };

  const startTimer = () => {
    setTimerSeconds(timerMinutes * 60);
    setTimerRunning(true);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const copyAddress = async (addr: string, id: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedId(id);
      setSelectedCoinId(id);
      setError(null);
      if (!timerRunning) startTimer();
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const copyAmount = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAmountId(id);
      setTimeout(() => setCopiedAmountId(null), 2000);
    } catch {}
  };

  const saveAddresses = () => {
    const clean = editAddresses.filter(a => a.name && a.address);
    setAddresses(clean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    savePaymentSettings({ addresses: clean });
    if (!manageMode) setIsAdmin(false);
  };

  const saveSubPrices = () => {
    const clean = {
      weekly: Math.max(0.01, Number(editSubPrices.weekly) || DEFAULT_PRICES.weekly),
      monthly: Math.max(0.01, Number(editSubPrices.monthly) || DEFAULT_PRICES.monthly),
      yearly: Math.max(0.01, Number(editSubPrices.yearly) || DEFAULT_PRICES.yearly),
    };
    setSubPrices(clean);
    localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(clean));
    setDoc(doc(db, 'shared_settings', 'prices'), { ...clean, updatedAt: Date.now() }).catch(console.warn);
  };

  const addNewAddress = () => {
    if (!newAddress.name || !newAddress.address) return;
    const id = 'custom_' + Date.now();
    setEditAddresses([...editAddresses, { id, name: newAddress.name, address: newAddress.address }]);
    setNewAddress({ id: '', name: '', address: '' });
  };

  const handleDownloadBot = () => {
    if (!botPurchase || !paymentConfirmed || !botGrantTs) return;
    downloadBot(botPurchase);
    consumeBotDownload(botPurchase.id || '');
    consumeBotGrant((buyerEmail || contactEmail).trim().toLowerCase(), botPurchase.id || '');
    setBotGrantTs(null);
    setBotDownloaded(true);
    recordBotPurchase(botPurchase, buyerEmail || '').then(() => onBotPaid?.(botPurchase));
  };

  const calcCryptoAmount = (coinId: string, coinName?: string): string => {
    // Try direct coin ID lookup first
    let coin = COINGECKO_MAP[coinId];
    // If not found, try extracting ticker from name (e.g., "Bitcoin (BTC)" → "btc")
    if (!coin && coinName) {
      const match = coinName.match(/\((\w+)\)/);
      if (match) {
        const ticker = match[1].toLowerCase();
        coin = COINGECKO_MAP[ticker] || PRICE_ALIASES[ticker];
      }
    }
    const usdPrice = coin ? prices[coin]?.usd : undefined;
    if (!usdPrice || usdPrice <= 0) return '...';
    return (amount / usdPrice).toFixed(coinId === 'trx' ? 2 : coinId === 'sol' ? 4 : 8);
  };

  if (!isOpen) return null;

  const isBotSection = section === 'bot' && !!botPurchase;
  const isPlanSection = section === 'plan' && !botPurchase;
  const showBotDummy = section === 'bot' && !botPurchase && !manageMode;
  const showPlanDummy = section === 'plan' && !!botPurchase;
  const showAddresses = !showBotDummy && !showPlanDummy;
  const currentLabel = isBotSection ? botPurchase!.name : planLabel;
  const botCopyLocked = !!botPurchase?.id && botDownloaded && !botGrantTs;

  const pageInner = (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h3 className="text-xl font-bold text-white">{isAr ? (manageMode ? 'إدارة عناوين الدفع' : 'إتمام الدفع') : (manageMode ? 'Payment Settings' : 'Complete Payment')}</h3>
            {!manageMode && <p className="text-sm text-slate-400">{isBotSection ? `${botPurchase!.name} - $${amount} USD` : `${currentLabel} Plan - $${amount} USD`}</p>}
          </div>
        </div>
      </div>

      {/* Section switcher — Bots (default) vs Plans */}
      {!manageMode && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={() => setSection('bot')}
            className={`flex items-center justify-center gap-2 py-3 rounded-2xl border-2 text-xs font-black uppercase tracking-wider transition-all ${
              section === 'bot'
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 shadow-[0_0_25px_-6px_rgba(16,185,129,0.7)]'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/25'
            }`}
          >
            🛒 {isAr ? 'بوتات التداول' : 'Trading Bots'}
          </button>
          <button
            onClick={() => setSection('plan')}
            className={`flex items-center justify-center gap-2 py-3 rounded-2xl border-2 text-xs font-black uppercase tracking-wider transition-all ${
              section === 'plan'
                ? 'border-amber-500 bg-amber-500/15 text-amber-400 shadow-[0_0_25px_-6px_rgba(245,158,11,0.7)]'
                : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/25'
            }`}
          >
            ⚡ {isAr ? 'الخطط' : 'Plans'}
          </button>
        </div>
      )}

      {/* Dummy panels when the section has no product selected */}
      {(showBotDummy || showPlanDummy) && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-lg mb-4">{showBotDummy ? '🛒' : '⚡'}</p>
          <p className="text-sm font-bold text-slate-300 mb-5">
            {showBotDummy
              ? (isAr ? 'هذه الصفحة لإتمام شراء البوتات. اختر بوتاً من المتجر أولاً.' : 'This page completes bot purchases. First pick a bot from the store.')
              : (isAr ? 'هذه الصفحة لشراء الخطط. اختر خطة من صفحة الخطط أولاً.' : 'This page is for plans. Pick a plan from the plans page first.')}
          </p>
          <button
            onClick={showBotDummy ? onGoToStore : onGoToPlans}
            className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-black transition-all active:scale-95 shadow-lg ${showBotDummy ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/30' : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/30'}`}
          >
            {showBotDummy ? (isAr ? 'الذهاب للمتجر' : 'Go to Store') : (isAr ? 'الذهاب للخطط' : 'Go to Plans')}
          </button>
        </div>
      )}

      {!manageMode && showAddresses && !selectedCoinId && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6">
          <p className="text-sm text-amber-400 font-bold text-center">
            {isAr ? 'اختر عملة وانسخ العنوان للدفع. سيظهر العداد والمبلغ بعد النسخ.' : 'Choose a coin and copy the address to pay. The timer and amount will appear after copying.'}
          </p>
        </div>
      )}

      {manageMode && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-6">
          <p className="text-sm text-emerald-400 font-bold text-center">
            {isAr ? 'أنت في وضع الإدارة. يمكنك إضافة وتعديل وحذف عناوين الدفع. التغييرات تحفظ تلقائياً في المتصفح.' : 'You are in admin mode. You can add, edit, and delete payment addresses. Changes are saved automatically.'}
          </p>
        </div>
      )}

      {showAddresses && (
      <div className="relative">
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-2xl p-4 mb-4">
            <p className="text-xs font-black text-red-400 text-center">{error}</p>
          </div>
        )}
        {botCopyLocked && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 mb-4 text-center">
            <p className="text-xs font-black text-rose-400">
              {isAr
                ? '🔒 حمّلت نسخة من هذا البوت مسبقاً. كل عملية دفع تتيح تحميل نسخة واحدة فقط.'
                : '🔒 You already downloaded a copy of this bot. Each payment allows downloading one copy only.'}
            </p>
            <p className="text-[10px] text-rose-300/60 mt-1">
              {isAr
                ? 'لتتمكن من التحميل مرة أخرى، يلزمك إتمام عملية دفع جديدة.'
                : 'To download again, a new payment is required.'}
            </p>
          </div>
        )}

                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
        {addresses.length === 0 && !isAdmin && (
          <p className="text-center text-slate-500 py-8">No payment addresses configured.</p>
        )}

        {(isAdmin ? editAddresses : addresses).map((item) => {
          const coin = COINGECKO_MAP[item.id];
          const usdPrice = coin ? prices[coin]?.usd : undefined;

          return (
            <div key={item.id} className={`bg-white/5 border rounded-2xl p-4 transition-all hover:border-white/20 ${selectedCoinId === item.id ? 'border-emerald-500/70 ring-2 ring-emerald-500/40' : 'border-white/10'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-black text-xs shadow-lg">
                    {item.name.split(' ').pop()?.replace(/[()]/g, '') || '?'}
                  </div>
                  <div>
                    <span className="text-sm font-black text-white">{item.name}</span>
                    {usdPrice && (
                      <span className="text-[10px] text-slate-400 block">1 {item.name.split(' ').pop()?.replace(/[()]/g, '')} = ${usdPrice.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isAdmin && (
                    <>
                      <button
                        onClick={() => copyAddress(item.address, item.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-black"
                      >
                        {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                        {copiedId === item.id ? 'Copied!' : 'Copy'}
                      </button>
                      <a
                        href={`https://live.blockcypher.com/${item.id === 'usdt' ? 'tron' : item.id}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setEditAddresses(prev => prev.filter(a => a.id !== item.id))}
                      className="p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {isAdmin ? (
                <input
                  type="text"
                  value={editAddresses.find(a => a.id === item.id)?.address || ''}
                  onChange={(e) => setEditAddresses(prev => prev.map(a => a.id === item.id ? { ...a, address: e.target.value } : a))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-white outline-none focus:border-emerald-500"
                />
                ) : (
                <div className="bg-black/40 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-mono text-slate-300 break-all select-all">{item.address}</code>
                    {calcCryptoAmount(item.id, item.name) !== '...' && (
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        <span className="text-[10px] font-bold text-emerald-400">≈ {calcCryptoAmount(item.id, item.name)} {item.name.split(' ').pop()?.replace(/[()]/g, '')}</span>
                        <button
                          onClick={() => copyAmount(`${calcCryptoAmount(item.id, item.name)} ${item.name.split(' ').pop()?.replace(/[()]/g, '')}`, 'amt_' + item.id)}
                          className="p-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                        >
                          {copiedAmountId === 'amt_' + item.id ? <Check size={10} /> : <Copy size={10} />}
                          </button>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        </div>

        {/* Payment confirmation OVERLAY — covers the selected address */}
        {!manageMode && selectedCoinId && (() => {
          const item = addresses.find(a => a.id === selectedCoinId);
          if (!item) return null;
          const ticker = item.name.split(' ').pop()?.replace(/[()]/g, '') || '';
          const cryptoAmount = calcCryptoAmount(item.id, item.name);
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-10 bg-brand-bg/95 backdrop-blur-xl rounded-2xl border-2 border-emerald-500/40 p-5 flex flex-col justify-center shadow-[0_0_60px_-12px_rgba(16,185,129,0.4)]"
            >
              <button
                onClick={() => { setSelectedCoinId(null); setTimerRunning(false); }}
                className="absolute top-3 right-3 p-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={16} />
              </button>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-black text-xs shadow-lg">
                    {ticker}
                  </div>
                  <div>
                    <span className="text-sm font-black text-white">{item.name}</span>
                    <span className="text-[10px] text-slate-400 block">{item.address.slice(0, 16)}...</span>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">{isBotSection ? botPurchase!.name : currentLabel}</span>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-3 py-2 mb-3">
                  <p className="text-[11px] font-black text-red-400 text-center">{error}</p>
                </div>
              )}

              <div className="bg-black/40 rounded-2xl px-5 py-4 text-center border border-emerald-500/20 mb-4">
                <div className="text-3xl font-black text-white font-mono">
                  {cryptoAmount === '...' ? '...' : cryptoAmount} {ticker}
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">≈ ${amount} USD</p>
                <button
                  onClick={() => copyAmount(`${cryptoAmount} ${ticker}`, 'confirm_amt')}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-black"
                >
                  {copiedAmountId === 'confirm_amt' ? <Check size={14} /> : <Copy size={14} />}
                  {copiedAmountId === 'confirm_amt' ? 'Copied!' : 'Copy Amount'}
                </button>
              </div>

              <div className="flex items-center justify-center mb-4">
                <div className="text-center">
                  <div className={`text-5xl font-black font-mono tabular-nums ${timerSeconds <= 60 ? 'text-red-400' : 'text-white'}`}>
                    {formatTime(timerSeconds)}
                  </div>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">{isAr ? 'الوقت المتبقي' : 'Time Remaining'}</p>
                </div>
              </div>

              {(!buyerNameFinal || !buyerEmailFinal) && (
                <div className="space-y-2 mb-3">
                  {!buyerNameFinal && (
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder={isAr ? 'اسمك الكامل' : 'Your full name'}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                    />
                  )}
                  {!buyerEmailFinal && (
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder={isAr ? 'بريدك الإلكتروني' : 'Your email'}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                    />
                  )}
                </div>
              )}

              {!paymentConfirmed && requestStatus === 'idle' && (
                <>
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl px-3 py-2.5 mb-3">
                    <p className="text-[11px] text-amber-300 text-center font-bold leading-relaxed">
                      {isAr
                        ? 'بعد إتمام التحويل، اضغط الزر أدناه لإرسال طلب تأكيد مرقّم. تتم المراجعة يدوياً خلال 1 إلى 24 ساعة.'
                        : 'After sending the amount, press below to submit a numbered confirmation request. Review is manual and takes 1 to 24 hours.'}
                    </p>
                  </div>
                  <button
                    onClick={requestManualConfirmation}
                    disabled={requestCreating || timerSeconds <= 0}
                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg disabled:opacity-50 ${
                      requestCreating
                        ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400 cursor-wait'
                        : 'bg-emerald-500 text-white hover:bg-emerald-400 cursor-pointer shadow-emerald-500/40'
                    }`}
                  >
                    {requestCreating
                      ? (isAr ? '⏳ جاري إرسال الطلب...' : '⏳ Submitting request...')
                      : (isAr ? '📨 أرسلت الدفع — اطلب تأكيد التحرير' : '📨 I have paid — request release')}
                  </button>
                </>
              )}

              {requestStatus === 'pending' && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center">
                  <div className="text-2xl font-black text-[#F59E0B] mb-1">
                    {isAr ? `طلبك رقم #${requestNo}` : `Request #${requestNo}`}
                  </div>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    {isAr
                      ? 'طلبك قيد المراجعة. سيتم التحقق من وصول المبلغ ومطابقة الاسم والتاريخ ثم يُفرَج التحميل. قد يستغرق ذلك من 1 إلى 24 ساعة.'
                      : 'Your request is under review. Once the amount is verified and matched by name and date, the release happens automatically. This may take 1 to 24 hours.'}
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[10px] text-amber-300 font-bold uppercase tracking-widest">
                      {isAr ? 'بانتظار إفراج المطور' : 'Awaiting developer release'}
                    </span>
                  </div>
                  <button
                    onClick={refreshGrantStatus}
                    disabled={grantChecking}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-all text-xs font-black disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={grantChecking ? 'animate-spin' : ''} />
                    {isAr ? 'تحديث الحالة' : 'Refresh status'}
                  </button>
                </div>
              )}

              {paymentConfirmed && (
                <button
                  onClick={() => {
                    if (section === 'bot' && botPurchase) {
                      handleDownloadBot();
                    } else {
                      onConfirm?.();
                    }
                  }}
                  disabled={isBotSection && !botGrantTs}
                  className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg ${
                    (!isBotSection || botGrantTs)
                      ? 'bg-emerald-500 text-white hover:bg-emerald-400 cursor-pointer shadow-emerald-500/40'
                      : 'bg-red-500/20 border border-red-500/40 text-red-400 cursor-not-allowed'
                  }`}
                >
                  {isBotSection
                    ? (botGrantTs ? (isAr ? '🟢 تحميل البوت الآن' : '🟢 Download Bot Now') : (isAr ? '🔒 نسخة هذه الدفعة مُستهلَكة' : '🔒 Copy for this payment is spent'))
                    : '🟢 Activate Plan'}
                </button>
              )}

              {timerSeconds <= 0 && requestStatus === 'idle' && !paymentConfirmed && (
                <div className="text-center mt-2">
                  <p className="text-[10px] text-red-400 mb-2">{isAr ? 'انتهت المهلة. يمكنك إعادة المحاولة.' : 'Time expired. You can try again.'}</p>
                  <button
                    onClick={() => { setSelectedCoinId(null); setTimerRunning(false); }}
                    className="text-xs text-slate-400 hover:text-white underline"
                  >
                    {isAr ? 'اختر عملة أخرى' : 'Choose another coin'}
                  </button>
                </div>
              )}
            </motion.div>
          );
        })()}

      </div>
      )}

        <AnimatePresence>
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-500/5 border border-dashed border-emerald-500/30 rounded-2xl p-4 space-y-3"
            >
              <h5 className="text-xs font-black uppercase text-emerald-400 tracking-widest">Add New Address</h5>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Coin name (e.g. Dogecoin DOGE)"
                  value={newAddress.name}
                  onChange={(e) => { setNewAddress({ ...newAddress, name: e.target.value }); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-500"
                />
                {showSuggestions && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-900 border border-white/10 rounded-xl max-h-48 overflow-y-auto shadow-2xl">
                    {POPULAR_COINS.filter(c => c.toLowerCase().includes(newAddress.name.toLowerCase())).map(coin => (
                      <button
                        key={coin}
                        onMouseDown={() => { setNewAddress({ ...newAddress, name: coin }); setShowSuggestions(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-emerald-500/20 hover:text-white transition-all font-medium"
                      >
                        {coin}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="text"
                placeholder="Wallet address"
                value={newAddress.address}
                onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-white outline-none focus:border-emerald-500"
              />
              <button
                onClick={addNewAddress}
                disabled={!newAddress.name || !newAddress.address}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-500 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all disabled:opacity-50"
              >
                <Plus size={14} /> Add Address
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      <AnimatePresence>
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-6 flex justify-center"
          >
            <button
              onClick={saveAddresses}
              className="flex items-center gap-2 bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg hover:bg-emerald-400 transition-all active:scale-95"
            >
              <Check size={18} /> Save All Addresses
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {manageMode && (<>
        <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-4">
          <h5 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3">{isAr ? 'أسعار الخطط' : 'Plan Prices'}</h5>
          <div className="space-y-4">
            {['weekly', 'monthly', 'yearly'].map((key) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs font-black text-slate-400 w-20 uppercase">{key}</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-black text-white">$</span>
                  <input
                    type="number"
                    value={editSubPrices[key]}
                    onChange={(e) => setEditSubPrices({ ...editSubPrices, [key]: e.target.value })}
                    className="w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-emerald-500"
                    min="0.01" step="0.01"
                  />
                </div>
              </div>
            ))}
            <button
              onClick={saveSubPrices}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-black"
            >
              <Check size={14} /> {isAr ? 'حفظ الأسعار' : 'Save Prices'}
            </button>
          </div>
        </div>

        <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-xs font-black uppercase text-slate-400 tracking-widest">{isAr ? 'نظام الخطط المجانية' : 'Freemium System'}</h5>
              <p className="text-[10px] text-slate-500 mt-1">{freemiumDisabled ? (isAr ? 'الكل وصول كامل - الخطط مخفية عن العملاء' : 'All full access - plans hidden from clients') : (isAr ? 'القيود مفعلة - الخطط مرئية للعملاء' : 'Restrictions active - plans visible to clients')}</p>
            </div>
            <button
              onClick={() => {
                const newVal = !freemiumDisabled;
                setFreemiumDisabled(newVal);
                localStorage.setItem('finalyze_freemium_disabled', newVal ? 'true' : 'false');
                localStorage.setItem('finalyze_hide_plans', newVal ? 'true' : 'false');
                onFreemiumToggle?.(newVal);
              }}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg ${
                freemiumDisabled
                  ? 'bg-emerald-500 text-white shadow-emerald-500/40'
                  : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              }`}
            >
              {freemiumDisabled ? <Shield size={16} /> : <ShieldOff size={16} />}
              {freemiumDisabled ? (isAr ? 'مفعل: وصول كامل' : 'ON: Full Access') : (isAr ? 'معطل: قيود مفعلة' : 'OFF: Restricted')}
            </button>
          </div>
        </div>

        <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-4">
          <h5 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3">Timer Duration</h5>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={editTimer}
              onChange={(e) => setEditTimer(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-500"
              min="1"
            />
            <span className="text-sm text-slate-400">minutes</span>
            <button
              onClick={() => { setTimerMinutes(editTimer); localStorage.setItem(TIMER_STORAGE_KEY, String(editTimer)); }}
              className="px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-black"
            >
              Save Timer
            </button>
          </div>
        </div>

        <div className="mt-4">
          <PaymentRequestsSection lang={isAr ? 'ar' : 'en'} />
        </div>

              </>)}

      {!manageMode && showAddresses && (
        <p className="text-center text-[10px] text-slate-500 mt-4">
          {isAr ? `بعد النسخ، أرسل المبلغ إلى العنوان. الوقت المتبقي: ${Math.floor(timerSeconds / 60)} دقيقة` : `After copying, send the amount to the address. Time remaining: ${Math.floor(timerSeconds / 60)} min`}
        </p>
      )}

    </>
  );

  if (asPage) {
    return (
      <div>
        {pageInner}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative max-w-2xl w-full bg-brand-alt border border-white/10 rounded-[32px] p-8 shadow-[0_32px_128px_-12px_rgba(0,0,0,0.85)]"
      >
        {pageInner}
      </motion.div>
    </div>
  );
}
