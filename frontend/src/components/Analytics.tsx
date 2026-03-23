import React, { useState, useEffect } from 'react';
import {
  Globe, Award, Droplets, Users, Activity,
  ExternalLink, RefreshCw, TrendingUp, BarChart3
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const EXPLORER = 'https://explorer.rebased.iota.org';
const NETWORK = 'testnet';

interface Analytics {
  totalCertificates: number;
  totalLitersCertified: number;
  totalOnChainReadings: number;
  uniqueOwners: number;
  footprintDistribution: Record<string, number>;
  recentCertEvents: CertEvent[];
  recentReadingEvents: ReadingEvent[];
}

interface GlobalCert {
  objectId: string;
  ownerAddress: string;
  certificateNumber: string;
  companyName: string;
  totalLiters: number;
  totalReadings: number;
  footprintClass: string;
  issuedAt: number;
}

interface CertEvent {
  certificateId: string;
  certificateNumber: string;
  companyName: string;
  totalLiters: number;
  footprintClass: string;
  issuedAt: number;
  timestamp: string;
  digest: string;
  senderAddress: string;
}

interface ReadingEvent {
  readingId: string;
  deviceId: string;
  liters: number;
  dataHash: string;
  timestamp: string;
  digest: string;
}

const CLASS_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#86efac', C: '#eab308', D: '#f97316', E: '#ef4444'
};

const CLASS_BG: Record<string, string> = {
  A: 'bg-green-500/20 text-green-400 border-green-500/30',
  B: 'bg-green-400/20 text-green-300 border-green-400/30',
  C: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  D: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  E: 'bg-red-500/20 text-red-400 border-red-500/30'
};

function truncate(addr: string, chars = 8) {
  return `${addr.slice(0, chars)}...${addr.slice(-4)}`;
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-aqua-400">{icon}</div>
        <span className="text-slate-400 text-sm">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [allCerts, setAllCerts] = useState<GlobalCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [certsLoading, setCertsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/graphql/analytics`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAnalytics(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCerts = async () => {
    setCertsLoading(true);
    try {
      const res = await fetch(`${API_URL}/graphql/certificates`);
      if (res.ok) setAllCerts(await res.json());
    } catch (_) {}
    finally { setCertsLoading(false); }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchAllCerts();
  }, []);

  const handleRefresh = () => {
    fetchAnalytics();
    fetchAllCerts();
  };

  const distributionData = analytics
    ? Object.entries(analytics.footprintDistribution)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([cls, count]) => ({ class: cls, count }))
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-aqua-400" />
            On-Chain Analytics
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Live data queried directly from IOTA via GraphQL — all certificates across every wallet, globally.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          GraphQL error: {error}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Award className="w-5 h-5" />}
          label="Certificates On-Chain"
          value={loading ? '...' : analytics?.totalCertificates.toString() ?? '0'}
          sub="All wallets globally"
        />
        <StatCard
          icon={<Droplets className="w-5 h-5" />}
          label="Total Liters Certified"
          value={loading ? '...' : `${((analytics?.totalLitersCertified ?? 0) / 1000).toLocaleString()} L`}
          sub="Globally verified"
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Unique Wallet Owners"
          value={loading ? '...' : analytics?.uniqueOwners.toString() ?? '0'}
          sub="Certificate holders"
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="On-Chain Readings"
          value={loading ? '...' : `${analytics?.totalOnChainReadings ?? 0}+`}
          sub="Last 50 events indexed"
        />
      </div>

      {/* Chart + Events row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Footprint distribution chart */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-aqua-400" />
            Footprint Class Distribution
          </h3>
          {distributionData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
              {loading ? 'Loading...' : 'No data yet'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={distributionData} barCategoryGap="30%">
                <XAxis dataKey="class" tick={{ fill: '#94a3b8', fontSize: 14, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  itemStyle={{ color: '#94a3b8' }}
                  formatter={(v: any) => [`${v} certificate${v !== 1 ? 's' : ''}`, 'Count']}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {distributionData.map(entry => (
                    <Cell key={entry.class} fill={CLASS_COLORS[entry.class] ?? '#38bdf8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent cert events timeline */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-aqua-400" />
            Recent Certificate Events
          </h3>
          <div className="space-y-3 overflow-y-auto max-h-52">
            {loading ? (
              <p className="text-slate-500 text-sm">Loading...</p>
            ) : (analytics?.recentCertEvents ?? []).length === 0 ? (
              <p className="text-slate-500 text-sm">No events found</p>
            ) : (
              (analytics!.recentCertEvents).map((ev, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`shrink-0 mt-0.5 px-2 py-0.5 rounded border text-xs font-bold ${CLASS_BG[ev.footprintClass] ?? ''}`}>
                    {ev.footprintClass}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm truncate">{ev.companyName}</p>
                    <p className="text-slate-400 text-xs">{(ev.totalLiters / 1000).toLocaleString()} L · {new Date(ev.timestamp).toLocaleString()}</p>
                  </div>
                  <a
                    href={`${EXPLORER}/transaction/${ev.digest}?network=${NETWORK}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-aqua-400 hover:text-aqua-300"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Global certificates grid */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
          <Globe className="w-4 h-4 text-aqua-400" />
          All Certificates — Global Ledger
        </h3>
        <p className="text-slate-500 text-xs mb-5">
          Every WaterCertificate NFT ever minted by this package, queried across all wallets via IOTA GraphQL.
        </p>

        {certsLoading ? (
          <div className="text-center py-12 text-slate-400">Loading from blockchain...</div>
        ) : allCerts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No certificates on-chain yet</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {allCerts.map(cert => (
              <div
                key={cert.objectId}
                className="bg-slate-900/60 border border-slate-700 hover:border-aqua-500/40 rounded-xl p-4 transition-colors"
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">{cert.companyName}</p>
                    <p className="text-slate-500 text-xs font-mono truncate">{cert.certificateNumber}</p>
                  </div>
                  <span className={`shrink-0 ml-2 px-2.5 py-1 rounded-lg border text-sm font-bold ${CLASS_BG[cert.footprintClass] ?? ''}`}>
                    {cert.footprintClass}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-slate-800 rounded-lg p-2">
                    <p className="text-slate-400 text-xs">Liters</p>
                    <p className="text-white text-sm font-semibold">{(cert.totalLiters / 1000).toLocaleString()} L</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-2">
                    <p className="text-slate-400 text-xs">Readings</p>
                    <p className="text-white text-sm font-semibold">{cert.totalReadings.toLocaleString()}</p>
                  </div>
                </div>

                {/* Owner + date */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono">{truncate(cert.ownerAddress)}</span>
                  <span>{new Date(cert.issuedAt).toLocaleDateString()}</span>
                </div>

                {/* Explorer link */}
                <a
                  href={`${EXPLORER}/object/${cert.objectId}?network=${NETWORK}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1 text-aqua-400 hover:text-aqua-300 text-xs"
                >
                  <ExternalLink className="w-3 h-3" />
                  View NFT on Explorer
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
