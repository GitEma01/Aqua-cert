import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldOff, Zap, ExternalLink, RefreshCw } from 'lucide-react';

interface Notarization {
  id: number;
  batch_hash: string;
  description: string;
  object_id: string | null;
  tx_digest: string | null;
  anchored_at: number;
  gas_station: 0 | 1;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const EXPLORER = 'https://explorer.rebased.iota.org';
const NETWORK = 'testnet';

export default function NotarizationProofs() {
  const [notarizations, setNotarizations] = useState<Notarization[]>([]);
  const [loading, setLoading] = useState(true);
  const [gasStation, setGasStation] = useState<{ available: boolean; url: string | null }>({
    available: false,
    url: null
  });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [notarRes, gsRes] = await Promise.all([
        fetch(`${API_URL}/notarizations?limit=50`),
        fetch(`${API_URL}/gas-station/status`)
      ]);
      setNotarizations(await notarRes.json());
      setGasStation(await gsRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-green-400" />
            IOTA Notarization Proofs
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Every IoT batch is anchored on-chain as a Locked Notarization — immutable proof of data integrity.
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Gas Station status card */}
      <div className={`rounded-xl border p-4 mb-6 flex items-center gap-4
        ${gasStation.available
          ? 'bg-purple-500/10 border-purple-500/30'
          : 'bg-slate-800/50 border-slate-700'
        }`}
      >
        <div className={`p-2 rounded-lg ${gasStation.available ? 'bg-purple-500/20' : 'bg-slate-700'}`}>
          <Zap className={`w-5 h-5 ${gasStation.available ? 'text-purple-400' : 'text-slate-500'}`} />
        </div>
        <div>
          <p className={`font-semibold text-sm ${gasStation.available ? 'text-purple-300' : 'text-slate-400'}`}>
            Gas Station: {gasStation.available ? 'Active' : 'Not configured'}
          </p>
          <p className="text-xs text-slate-500">
            {gasStation.available
              ? `Notarizations are gas-sponsored via ${gasStation.url}`
              : 'Set GAS_STATION_URL in backend/.env to enable gas-free notarizations'
            }
          </p>
        </div>
      </div>

      {/* Notarization list */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading proofs...</div>
      ) : notarizations.length === 0 ? (
        <div className="text-center py-16">
          <ShieldOff className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg font-medium">No notarizations yet</p>
          <p className="text-slate-500 text-sm mt-2">
            Notarizations are created automatically after every 10 IoT readings are recorded on-chain.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notarizations.map(n => (
            <div
              key={n.id}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-green-500/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    <ShieldCheck className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-mono text-sm">
                        {n.batch_hash.slice(0, 24)}...
                      </span>
                      {n.gas_station === 1 && (
                        <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Gas Sponsored
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mt-1 truncate">{n.description}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {new Date(n.anchored_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  {n.tx_digest && (
                    <a
                      href={`${EXPLORER}/transaction/${n.tx_digest}?network=${NETWORK}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-aqua-400 hover:text-aqua-300 text-xs"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View TX
                    </a>
                  )}
                  {n.object_id && (
                    <a
                      href={`${EXPLORER}/object/${n.object_id}?network=${NETWORK}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-green-400 hover:text-green-300 text-xs"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Object
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
