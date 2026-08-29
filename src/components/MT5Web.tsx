import React, { useEffect, useState } from 'react';

interface MT5WebProps {
  symbol?: string;
}

interface Mt5Broker {
  name: string;
  webUrl: string;
  server: string;
  demoLabel?: string;
}

interface Mt5Connection {
  id: string;
  brokerName: string;
  brokerUrl: string;
  server: string;
  login: string;
  password: string;
  createdAt: number;
}

const STORAGE_KEY = 'finalyze_mt5_connections';

const DEFAULT_BROKERS: Mt5Broker[] = [
  { name: 'MetaQuotes', webUrl: 'https://metatraderweb.app', server: 'MetaQuotes-Demo', demoLabel: 'MetaQuotes Demo' },
  { name: 'Exness', webUrl: 'https://mt5.exness.com/web-terminal', server: 'Exness-MT5Trial', demoLabel: 'Exness Trial' },
  { name: 'XM', webUrl: 'https://www.xm.com/mt5/webterminal', server: 'XMGlobal-MT5', demoLabel: 'XM Global Demo' },
  { name: 'IC Markets', webUrl: 'https://icmarkets.ebs.etrade.net', server: 'ICMarketsSC-Demo', demoLabel: 'ICMarkets Demo' },
  { name: 'Pepperstone', webUrl: 'https://platform.pepperstone.com', server: 'Pepperstone-Demo', demoLabel: 'Pepperstone Demo' },
  { name: 'OctaFX', webUrl: 'https://mt5.octafx.com', server: 'OctaFX-Demo', demoLabel: 'OctaFX Demo' },
  { name: 'FBS', webUrl: 'https://fbs.com/mt5', server: 'FBS-Demo', demoLabel: 'FBS Demo' },
  { name: 'HFM', webUrl: 'https://my.hfm.com/mt5', server: 'HF MarketsSVG-Demo', demoLabel: 'HFM Demo' },
];

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadConnections(): Mt5Connection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function MT5Web({ symbol }: MT5WebProps) {
  const [connections, setConnections] = useState<Mt5Connection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [broker, setBroker] = useState<Mt5Broker>(DEFAULT_BROKERS[0]);
  const [customBroker, setCustomBroker] = useState(false);
  const [webUrl, setWebUrl] = useState(DEFAULT_BROKERS[0].webUrl);
  const [server, setServer] = useState(DEFAULT_BROKERS[0].server);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setConnections(loadConnections());
  }, []);

  const persist = (list: Mt5Connection[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    setConnections(list);
  };

  const active = connections.find((c) => c.id === activeId) || null;

  const selectBroker = (b: Mt5Broker) => {
    setBroker(b);
    setCustomBroker(false);
    setWebUrl(b.webUrl);
    setServer(b.server);
  };

  const connect = () => {
    const loginVal = login.trim();
    const passVal = password.trim();
    const serverVal = server.trim();
    const urlVal = (webUrl || '').trim();

    if (!loginVal || !passVal) {
      setError('Please enter your MT5 account login and password.');
      return;
    }
    if (!serverVal) {
      setError('Please enter the broker server name.');
      return;
    }
    if (!urlVal) {
      setError('Please enter the broker web-terminal URL.');
      return;
    }

    const conn: Mt5Connection = {
      id: uid(),
      brokerName: (customBroker ? 'Custom' : broker.name) + (customBroker ? ` (${serverVal})` : ''),
      brokerUrl: urlVal,
      server: serverVal,
      login: loginVal,
      password: passVal,
      createdAt: Date.now(),
    };
    const next = [...connections, conn];
    persist(next);
    setActiveId(conn.id);
    setError('');
  };

  const logoutActive = () => {
    const next = connections.filter((c) => c.id !== activeId);
    persist(next);
    setActiveId(null);
  };

  const launchTerminal = (c: Mt5Connection) => {
    let url = c.brokerUrl;
    const query = `login=${encodeURIComponent(c.login)}&server=${encodeURIComponent(c.server)}`;
    url += (url.includes('?') ? '&' : '?') + query;
    window.open(url, '_blank', 'noopener,noreferrer,width=1200,height=800');
  };

  if (active) {
    const liveSymbol = symbol || '';
    return (
      <div className="h-full w-full flex flex-col bg-[#0a0f1a]">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[#0a0f1a] border-b border-white/10">
          <span className="text-xs font-bold text-brand-text/60">MT5 Web</span>
          <span className="text-xs font-bold text-white/25">|</span>
          <span className="text-xs font-bold text-sky-400">{active.brokerName}</span>
          <span className="text-xs font-bold text-white/25">|</span>
          <span className="text-xs font-bold text-emerald-400">{active.login}</span>
          {liveSymbol && (
            <span className="text-xs font-bold text-amber-400/90">● {liveSymbol}</span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {connections.length > 1 && (
              <div className="flex items-center gap-1">
                {connections.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`px-2 py-1 rounded-md text-[10px] font-black transition-all ${
                      c.id === active.id ? 'bg-sky-500 text-black' : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                    title={`${c.brokerName} · ${c.login}`}
                  >
                    {c.login}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => launchTerminal(active)}
              className="px-3 py-1.5 rounded-lg bg-sky-500 text-black text-[11px] font-black hover:bg-sky-400 transition-colors"
            >
              Open Terminal ↗
            </button>
            <button
              onClick={logoutActive}
              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-black hover:bg-red-500/30 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
        <div className="flex-1 w-full flex items-center justify-center p-6 bg-[#0a0f1a]">
          <div className="w-full max-w-md text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-sky-500/30 to-emerald-500/20 flex items-center justify-center">
              <span className="text-4xl">📈</span>
            </div>
            <div>
              <div className="text-xl font-black text-white">{active.brokerName}</div>
              <div className="text-sm font-bold text-emerald-400" dir="ltr">{active.login} · {active.server}</div>
            </div>
            <p className="text-sm text-white/50 leading-relaxed">
              The terminal opens in a <span className="text-sky-400 font-black">new browser tab</span>.
              Enter your MT5 account credentials there and trade freely.
            </p>
            <button
              onClick={() => launchTerminal(active)}
              className="w-full py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-black uppercase tracking-wider shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all"
            >
              Open MT5 Terminal in new tab ↗
            </button>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="text-[11px] font-black text-emerald-400">🔒 Demo only · no real funds</div>
              <p className="text-[10px] text-white/40 mt-1">
                Credentials are saved only in your own browser and never shared with other users.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[#0a0f1a]">
      <div className="w-full max-w-md mx-auto space-y-4 p-6">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-black text-white">MetaTrader 5 Web Terminal</h3>
          <p className="text-xs text-white/50">
            Log into your <span className="text-emerald-400">demo account</span> to trade live markets from inside this platform.
            Each client uses their own private account.
          </p>
        </div>

        {connections.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
            <div className="text-[10px] font-black uppercase text-white/40 tracking-wider">Saved accounts (this device)</div>
            <div className="space-y-1.5">
              {connections.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black text-white truncate">{c.brokerName}</div>
                    <div className="text-[10px] font-bold text-white/40" dir="ltr">
                      {c.login} · {c.server}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveId(c.id)}
                    className="px-2.5 py-1.5 rounded-md bg-sky-500 text-black text-[10px] font-black hover:bg-sky-400 transition-colors"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => persist(connections.filter((x) => x.id !== c.id))}
                    className="px-2.5 py-1.5 rounded-md bg-red-500/20 text-red-400 text-[10px] font-black hover:bg-red-500/30 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-black uppercase text-white/50 tracking-wider">Broker</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-1.5">
            {DEFAULT_BROKERS.map((b) => (
              <button
                key={b.name}
                onClick={() => selectBroker(b)}
                className={`py-2 rounded-lg text-xs font-black transition-all ${
                  !customBroker && broker.name === b.name ? 'bg-sky-500 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {b.name}
              </button>
            ))}
            <button
              onClick={() => setCustomBroker(true)}
              className={`py-2 rounded-lg text-xs font-black transition-all ${
                customBroker ? 'bg-sky-500 text-black' : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {customBroker && (
          <div>
            <label className="text-xs font-black uppercase text-white/50 tracking-wider">Broker web-terminal URL</label>
            <input
              type="text"
              value={webUrl}
              onChange={(e) => setWebUrl(e.target.value)}
              placeholder="e.g. https://yourbroker.com/mt5-web"
              dir="ltr"
              className="w-full h-11 mt-1 rounded-xl bg-black/40 border border-white/15 px-4 text-sm font-bold text-white outline-none focus:border-sky-500 placeholder:text-white/20"
            />
          </div>
        )}

        <div>
          <label className="text-xs font-black uppercase text-white/50 tracking-wider">Server</label>
          <input
            type="text"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="e.g. MetaQuotes-Demo"
            dir="ltr"
            className="w-full h-11 mt-1 rounded-xl bg-black/40 border border-white/15 px-4 text-sm font-bold text-white outline-none focus:border-sky-500 placeholder:text-white/20"
          />
        </div>

        <div>
          <label className="text-xs font-black uppercase text-white/50 tracking-wider">Login (Account #)</label>
          <input
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="e.g. 12345678"
            dir="ltr"
            className="w-full h-11 mt-1 rounded-xl bg-black/40 border border-white/15 px-4 text-sm font-bold text-white outline-none focus:border-sky-500 placeholder:text-white/20"
          />
        </div>

        <div>
          <label className="text-xs font-black uppercase text-white/50 tracking-wider">Password</label>
          <div className="relative mt-1">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-11 rounded-xl bg-black/40 border border-white/15 px-4 pr-12 text-sm font-bold text-white outline-none focus:border-sky-500 placeholder:text-white/20"
            />
            <button
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-white/10 text-white/60 text-[10px] font-black hover:bg-white/20 transition-colors"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-[11px] font-bold text-red-400 text-center">{error}</p>
        )}

        <button
          onClick={connect}
          disabled={!login.trim() || !password.trim()}
          className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-black font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all"
        >
          Connect to MT5
        </button>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="text-[11px] font-black text-emerald-400">🔒 Private &amp; safe</div>
          <p className="text-[10px] text-white/40 mt-1 leading-relaxed">
            Use a <span className="text-emerald-400">demo account</span> — it is separated from any real funds and cannot
            be used to spend real money. Your login details are stored only in your own browser and never shared with other users.
          </p>
        </div>
      </div>
    </div>
  );
}
