import { useState, useEffect } from 'react';
import { Award, ExternalLink, Loader2, Droplets, Calendar, BarChart2, Zap, Send, CheckCircle2 } from 'lucide-react';
import { useSignTransaction } from '@iota/dapp-kit';
import { fromBase64 } from '@iota/iota-sdk/utils';

interface CertificateObject {
  objectId: string;
  certificateNumber: string;
  companyName: string;
  periodStart: number;
  periodEnd: number;
  totalLiters: number;
  totalReadings: number;
  footprintClass: string;
  certifier: string;
  issuedAt: number;
  registryId: string;
}

interface Props {
  walletAddress: string;
}

function classStyle(c: string): string {
  const map: Record<string, string> = {
    A: 'text-green-400 bg-green-500/20 border-green-500/30',
    B: 'text-green-300 bg-green-400/20 border-green-400/30',
    C: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
    D: 'text-orange-400 bg-orange-500/20 border-orange-500/30',
    E: 'text-red-400 bg-red-500/20 border-red-500/30'
  };
  return map[c] ?? 'text-slate-400 bg-slate-700/50 border-slate-600';
}

function classLabel(c: string): string {
  const map: Record<string, string> = {
    A: 'Excellent', B: 'Good', C: 'Average', D: 'Poor', E: 'Critical'
  };
  return map[c] ?? 'Unknown';
}

function formatDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const EXPLORER = 'https://explorer.rebased.iota.org';
const NETWORK = 'testnet';

// ── Gas-sponsored transfer hook ───────────────────────────────────────────────
function useGasStationTransfer(walletAddress: string) {
  const { mutateAsync: signTransaction } = useSignTransaction();
  const [state, setState] = useState<Record<string, 'idle' | 'signing' | 'done' | string>>({});

  const transfer = async (objectId: string, recipient: string) => {
    setState(s => ({ ...s, [objectId]: 'signing' }));
    try {
      // Step 1 — backend prepares tx + reserves gas
      const prepRes = await fetch(`${API_URL}/gas-station/prepare-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectId, recipient, sender: walletAddress })
      });
      if (!prepRes.ok) throw new Error((await prepRes.json()).error);
      const { txBytes, reservationId, sponsorAddress } = await prepRes.json();

      // Step 2 — user wallet signs (dapp-kit, no gas needed)
      const { signature } = await signTransaction({
        transaction: { toJSON: async () => ({ txBytes }) } as any
      });

      // Step 3 — backend relays signature to gas station
      const execRes = await fetch(`${API_URL}/gas-station/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId, txBytes, userSig: signature })
      });
      if (!execRes.ok) throw new Error((await execRes.json()).error);
      const { digest } = await execRes.json();

      setState(s => ({ ...s, [objectId]: `done:${digest}` }));
    } catch (e: any) {
      setState(s => ({ ...s, [objectId]: `error:${e.message}` }));
    }
  };

  return { transfer, state };
}

export default function CertificateHistory({ walletAddress }: Props) {
  const [certificates, setCertificates] = useState<CertificateObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gasStationActive, setGasStationActive] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Record<string, string>>({});
  const { transfer, state: transferState } = useGasStationTransfer(walletAddress);

  useEffect(() => {
    fetch(`${API_URL}/gas-station/status`)
      .then(r => r.json())
      .then(d => setGasStationActive(d.available && d.healthy))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/certificates/${walletAddress}`)
      .then(r => r.json())
      .then(data => {
        setCertificates(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load certificates. Is the backend running?');
        setLoading(false);
      });
  }, [walletAddress]);

  if (!walletAddress) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 flex flex-col items-center gap-4 text-center">
        <div className="bg-slate-700/50 p-6 rounded-full">
          <Award className="w-12 h-12 text-slate-500" />
        </div>
        <h2 className="text-xl font-semibold text-white">Connect your wallet</h2>
        <p className="text-slate-400 max-w-sm">Connect your IOTA wallet to view your Water Footprint certificates.</p>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Award className="w-6 h-6 text-aqua-400" />
        <h2 className="text-xl font-semibold text-white">My Certificates</h2>
        <span className="text-xs text-slate-500 font-mono ml-2 truncate max-w-xs">{walletAddress}</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-aqua-400 animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && certificates.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="bg-slate-700/50 p-6 rounded-full">
            <Award className="w-12 h-12 text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-white">No certificates yet</h3>
          <p className="text-slate-400 max-w-sm text-sm">
            Issue your first certificate from the Dashboard tab once you have at least 10 IoT readings.
          </p>
        </div>
      )}

      {!loading && certificates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map(cert => (
            <div
              key={cert.objectId}
              className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden hover:border-aqua-500/40 transition-colors"
            >
              {/* Card header */}
              <div className="bg-gradient-to-r from-aqua-600/30 to-aqua-500/20 border-b border-slate-700 p-5 flex items-start justify-between">
                <div>
                  <p className="text-aqua-400 text-xs font-medium uppercase tracking-wider mb-1">Water Certificate</p>
                  <p className="text-white font-mono text-sm font-semibold">{cert.certificateNumber}</p>
                </div>
                <div className={`px-3 py-1.5 rounded-lg border text-2xl font-bold ${classStyle(cert.footprintClass)}`}>
                  {cert.footprintClass}
                </div>
              </div>

              {/* Card body */}
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Company</p>
                  <p className="text-white font-medium">{cert.companyName}</p>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>{formatDate(cert.periodStart)} — {formatDate(cert.periodEnd)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Droplets className="w-3.5 h-3.5 text-aqua-400" />
                      <p className="text-slate-500 text-xs">Total Liters</p>
                    </div>
                    <p className="text-white font-semibold text-sm">
                      {(cert.totalLiters / 1000).toLocaleString()} L
                    </p>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <BarChart2 className="w-3.5 h-3.5 text-aqua-400" />
                      <p className="text-slate-500 text-xs">Readings</p>
                    </div>
                    <p className="text-white font-semibold text-sm">{cert.totalReadings}</p>
                  </div>
                </div>

                <div className={`text-xs px-3 py-1.5 rounded-lg border text-center ${classStyle(cert.footprintClass)}`}>
                  Efficiency Class {cert.footprintClass} — {classLabel(cert.footprintClass)}
                </div>

                <div className="pt-1 border-t border-slate-700 flex items-center justify-between">
                  <p className="text-slate-600 text-xs">Issued {formatDate(cert.issuedAt)}</p>
                  <a
                    href={`${EXPLORER}/object/${cert.objectId}?network=${NETWORK}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-aqua-400 hover:text-aqua-300 text-xs transition-colors"
                  >
                    View on-chain
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Gas-sponsored transfer — workshop demo flow */}
                {gasStationActive && (() => {
                  const ts = transferState[cert.objectId] ?? 'idle';
                  if (ts.startsWith('done:')) {
                    const digest = ts.slice(5);
                    return (
                      <div className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Transferred! </span>
                        <a href={`${EXPLORER}/transaction/${digest}?network=${NETWORK}`} target="_blank" rel="noopener noreferrer" className="underline truncate">{digest.slice(0, 12)}...</a>
                      </div>
                    );
                  }
                  if (ts.startsWith('error:')) {
                    return <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{ts.slice(6)}</p>;
                  }
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 text-purple-300 text-xs">
                        <Zap className="w-3 h-3" /> Gas-Free Transfer (Gas Station)
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Recipient address 0x..."
                          value={transferTarget[cert.objectId] ?? ''}
                          onChange={e => setTransferTarget(t => ({ ...t, [cert.objectId]: e.target.value }))}
                          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 min-w-0"
                        />
                        <button
                          onClick={() => transfer(cert.objectId, transferTarget[cert.objectId] ?? '')}
                          disabled={ts === 'signing' || !transferTarget[cert.objectId]}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs disabled:opacity-50 shrink-0 transition-colors"
                        >
                          {ts === 'signing'
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Send className="w-3 h-3" />}
                          {ts === 'signing' ? 'Signing...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
