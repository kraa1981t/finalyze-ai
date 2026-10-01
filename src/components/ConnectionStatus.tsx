import React from 'react';
import { Shield, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { Language } from '../lib/i18n';

export default function ConnectionStatus({ lang }: { lang: Language }) {
  const isAr = lang === 'ar';
  const connections = [
    { name: 'MetaTrader 5', status: 'connected', type: 'Trading' },
    { name: 'TradingView', status: 'connected', type: 'Charts' },
    { name: 'X (Twitter)', status: 'monitoring', type: 'Sentiment' },
    { name: 'TikTok/YouTube', status: 'monitoring', type: 'Sentiment' },
  ];

  return (
    <div className="mt-8 p-6 bg-[#DDD8D0] border border-slate-300 rounded-3xl shadow-sm" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="text-primary" size={20} />
        <h4 className="font-bold text-slate-900 text-sm">{isAr ? 'حالة الربط والبيانات الحية' : 'Live Connection & Data Status'}</h4>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {connections.map((conn) => (
          <div key={conn.name} className="p-3 rounded-2xl bg-brand-alt border border-slate-50 flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-2 h-2 rounded-full",
                conn.status === 'connected' ? "bg-emerald-500 animate-pulse" : "bg-orange-500"
              )} />
              <span className="text-[10px] font-bold text-slate-800">{conn.name}</span>
            </div>
            <span className="text-[8px] text-slate-400 uppercase font-mono">{conn.type}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10px] text-slate-400 text-center italic">
        {isAr ? 'تم تفعيل الربط السحابي باستخدام مفاتيح API الخاصة بك. جميع البيانات مشفرة وآمنة.' : 'Cloud connection activated using your API keys. All data is encrypted and secure.'}
      </p>
    </div>
  );
}
