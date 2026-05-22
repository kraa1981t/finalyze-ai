import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Copy, Check, Edit3, Trash2, Plus, Lock, Unlock, ArrowLeft, ExternalLink } from 'lucide-react';

const DEFAULT_ADDRESSES = [
  { id: 'btc', name: 'Bitcoin (BTC)', address: '1QFZMm37yh15jy3dKgMWqmPj2MNvNqnsHe' },
  { id: 'eth', name: 'Ethereum (ETH)', address: '0x5FF1292b76002E97877e8d05D8e8FA15fdD65318' },
  { id: 'ltc', name: 'Litecoin (LTC)', address: 'ltc1qflq2drpe3vc9e3hvq0es97l7922ax7k5fnt4gs' },
  { id: 'trx', name: 'TRON (TRX)', address: 'TDhhmgVHEj8c8qe7za4eMtbQmXeL1oJcDB' },
  { id: 'sol', name: 'Solana (SOL)', address: '4TivXCgxtWWWRjCNFRqwzYEJ2kBG9qDqhH9ECXmM7oFp' },
  { id: 'usdt', name: 'USDT (TRC20)', address: 'TDhhmgVHEj8c8qe7za4eMtbQmXeL1oJcDB' },
];

const COINGECKO_MAP: Record<string, string> = {
  btc: 'bitcoin', eth: 'ethereum', ltc: 'litecoin', trx: 'tron', sol: 'solana',
};

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
}

export default function PaymentModal({ isOpen, onClose, planLabel, amount }: PaymentModalProps) {
  const [addresses, setAddresses] = useState<CryptoAddress[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_ADDRESSES;
    } catch { return DEFAULT_ADDRESSES; }
  });
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAmountId, setCopiedAmountId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editAddresses, setEditAddresses] = useState<CryptoAddress[]>([]);
  const [newAddress, setNewAddress] = useState({ name: '', address: '' });

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/crypto-prices')
      .then(r => r.json())
      .then(data => setPrices(data || {}))
      .catch(() => setPrices({}));
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setEditAddresses(JSON.parse(JSON.stringify(addresses)));
      setCopiedId(null);
      setNewAddress({ name: '', address: '' });
      setIsAdmin(false);
    }
  }, [isOpen]);

  const copyAddress = async (addr: string, id: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedId(id);
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
    setIsAdmin(false);
  };

  const addNewAddress = () => {
    if (!newAddress.name || !newAddress.address) return;
    const id = 'custom_' + Date.now();
    setEditAddresses([...editAddresses, { id, name: newAddress.name, address: newAddress.address }]);
    setNewAddress({ name: '', address: '' });
  };

  const calcCryptoAmount = (coinId: string): string => {
    const coin = COINGECKO_MAP[coinId];
    const usdPrice = coin ? prices[coin]?.usd : undefined;
    if (!usdPrice || usdPrice <= 0) return '...';
    return (amount / usdPrice).toFixed(coinId === 'trx' ? 2 : coinId === 'sol' ? 4 : 8);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative max-w-2xl w-full bg-brand-alt border border-white/10 rounded-[32px] p-8 shadow-[0_32px_128px_-12px_rgba(0,0,0,0.85)]"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h3 className="text-xl font-bold text-white">Complete Payment</h3>
              <p className="text-sm text-slate-400">{planLabel} Plan - ${amount} USD</p>
            </div>
          </div>
          <button
            onClick={() => setIsAdmin(!isAdmin)}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"
            title={isAdmin ? 'Lock addresses' : 'Edit addresses'}
          >
            {isAdmin ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6">
          <p className="text-sm text-amber-400 font-bold text-center">
            Send exactly <span className="text-lg">${amount} USD</span> worth of crypto to any address below.
            Your subscription activates automatically after 1 confirmation.
          </p>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
          {addresses.length === 0 && !isAdmin && (
            <p className="text-center text-slate-500 py-8">No payment addresses configured.</p>
          )}

          {(isAdmin ? editAddresses : addresses).map((item) => {
            const coin = COINGECKO_MAP[item.id];
            const usdPrice = coin ? prices[coin]?.usd : undefined;

            return (
              <div key={item.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 transition-all hover:border-white/20">
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
                      {calcCryptoAmount(item.id) !== '...' && (
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          <span className="text-[10px] font-bold text-emerald-400">≈ {calcCryptoAmount(item.id)} {item.name.split(' ').pop()?.replace(/[()]/g, '')}</span>
                          <button
                            onClick={() => copyAmount(`${calcCryptoAmount(item.id)} ${item.name.split(' ').pop()?.replace(/[()]/g, '')}`, 'amt_' + item.id)}
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

          <AnimatePresence>
            {isAdmin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-emerald-500/5 border border-dashed border-emerald-500/30 rounded-2xl p-4 space-y-3"
              >
                <h5 className="text-xs font-black uppercase text-emerald-400 tracking-widest">Add New Address</h5>
                <input
                  type="text"
                  placeholder="Coin name (e.g. Dogecoin DOGE)"
                  value={newAddress.name}
                  onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-500"
                />
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
        </div>

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

        <p className="text-center text-[10px] text-slate-500 mt-4">
          After sending, your subscription activates within 1-5 minutes. Contact support if delayed.
        </p>
      </motion.div>
    </div>
  );
}
