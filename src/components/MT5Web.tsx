import React, { useState } from 'react';

interface MT5WebProps {
  symbol?: string;
}

const BROKERS = [
  { name: 'MetaQuotes Demo', url: 'https://metatraderweb.app', server: 'MetaQuotes-Demo' },
  { name: 'Exness Trial', url: 'https://www.exness.com/trading/platforms/metatrader-5/web-terminal/', server: 'Exness-MT5Trial' },
  { name: 'XM Global Demo', url: 'https://www.xm.com/mt5/webterminal', server: 'XMGlobal-MT5' },
];

export default function MT5Web({ symbol }: MT5WebProps) {
  const [broker, setBroker] = useState(BROKERS[0]);
  const [showLogin, setShowLogin] = useState(true);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState(BROKERS[0].server);

  if (!showLogin) {
    return (
      <div className="h-full w-full flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 bg-[#0a0f1a] border-b border-white/10">
          <span className="text-xs font-bold text-brand-text/60">MT5 Web</span>
          <span className="text-xs font-bold text-white/30">|</span>
          <span className="text-xs font-bold text-sky-400">{broker.name}</span>
          <span className="text-xs font-bold text-white/30">|</span>
          <span className="text-xs font-bold text-emerald-400">{login || 'Demo'}</span>
          <button
            onClick={() => setShowLogin(true)}
            className="ml-auto px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-black hover:bg-red-500/30 transition-colors"
          >
            Logout
          </button>
        </div>
        <iframe
          src={`${broker.url}?login=${login}&password=${password}&server=${server}`}
          className="flex-1 w-full border-0 bg-black"
          title="MT5 Web Terminal"
          allow="clipboard-write; clipboard-read"
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-[#0a0f1a]">
      <div className="w-full max-w-sm space-y-4 p-6">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-black text-white">MetaTrader 5 Web Terminal</h3>
          <p className="text-xs text-white/50">Connect your demo account to trade manually</p>
        </div>

        <div>
          <label className="text-xs font-black uppercase text-white/50 tracking-wider">Broker</label>
          <div className="flex gap-1.5 mt-1">
            {BROKERS.map((b) => (
              <button
                key={b.name}
                onClick={() => { setBroker(b); setServer(b.server); }}
                className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${
                  broker.name === b.name ? 'bg-sky-500 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {b.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-black uppercase text-white/50 tracking-wider">Server</label>
          <input
            type="text"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            className="w-full h-11 mt-1 rounded-xl bg-black/40 border border-white/15 px-4 text-sm font-bold text-white outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label className="text-xs font-black uppercase text-white/50 tracking-wider">Login (Account #)</label>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="e.g. 12345678"
            className="w-full h-11 mt-1 rounded-xl bg-black/40 border border-white/15 px-4 text-sm font-bold text-white outline-none focus:border-sky-500 placeholder:text-white/20"
          />
        </div>

        <div>
          <label className="text-xs font-black uppercase text-white/50 tracking-wider">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 mt-1 rounded-xl bg-black/40 border border-white/15 px-4 text-sm font-bold text-white outline-none focus:border-sky-500"
          />
        </div>

        <button
          onClick={() => { if (login && password) setShowLogin(false); }}
          disabled={!login || !password}
          className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-black font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all"
        >
          Connect to MT5
        </button>

        <p className="text-[10px] text-white/30 text-center leading-relaxed">
          Get a free demo account from your broker first. Enter your demo login credentials above.
        </p>
      </div>
    </div>
  );
}
