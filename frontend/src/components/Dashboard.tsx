import React, { useState, useEffect } from 'react';
import { ConnectButton, useCurrentAccount } from '@iota/dapp-kit';
import { Droplets, Activity, Award, Coins, TrendingDown, Leaf, ShieldCheck } from 'lucide-react';
import WaterFlowChart from './WaterFlowChart';
import CertificateCard from './CertificateCard';
import StatsCard from './StatsCard';

interface Stats {
  totalReadings: number;
  totalLiters: number;
  byDevice: Record<string, { readings: number; liters: number }>;
}

interface Reading {
  deviceId: string;
  liters: number;
  timestamp: number;
  rawData: {
    flowRate: number;
    pressure: number;
    temperature: number;
  };
  hash: string;
}

interface Notarization {
  id: number;
  batch_hash: string;
  description: string;
  object_id: string | null;
  tx_digest: string | null;
  anchored_at: number;
  gas_station: 0 | 1;
}

const API_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001';

interface DashboardProps {
  hideHeader?: boolean;
}

export default function Dashboard({ hideHeader = false }: DashboardProps) {
  const account = useCurrentAccount();
  const [stats, setStats] = useState<Stats | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [notarizations, setNotarizations] = useState<Notarization[]>([]);
  const [latestNotarization, setLatestNotarization] = useState<Notarization | null>(null);

  // WebSocket for real-time data
  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('🔌 Connected to WebSocket');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'reading') {
        setReadings(prev => [data.data, ...prev.slice(0, 99)]);
      } else if (data.type === 'notarization') {
        // Real-time notarization event — reload notarizations
        fetchNotarizations();
      }
    };

    ws.onclose = () => {
      console.log('🔌 Disconnected from WebSocket');
      setIsConnected(false);
    };

    return () => ws.close();
  }, []);

  // Initial stats fetch
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_URL}/stats`);
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  // Initial readings fetch
  useEffect(() => {
    const fetchReadings = async () => {
      try {
        const res = await fetch(`${API_URL}/readings?limit=50`);
        const data = await res.json();
        setReadings(data);
      } catch (error) {
        console.error('Error fetching readings:', error);
      }
    };

    fetchReadings();
  }, []);

  const fetchNotarizations = async () => {
    try {
      const res = await fetch(`${API_URL}/notarizations?limit=10`);
      const data: Notarization[] = await res.json();
      setNotarizations(data);
      setLatestNotarization(data[0] ?? null);
    } catch (error) {
      console.error('Error fetching notarizations:', error);
    }
  };

  useEffect(() => {
    fetchNotarizations();
    const interval = setInterval(fetchNotarizations, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate metrics
  const totalLiters = stats ? stats.totalLiters / 1000 : 0; // Convert to actual liters
  const totalReadings = stats?.totalReadings || 0;
  const avgPerReading = totalReadings > 0 ? totalLiters / totalReadings : 0;

  // Calculate efficiency class
  const getEfficiencyClass = (avg: number) => {
    if (avg <= 100) return { class: 'A', color: 'text-green-500', label: 'Excellent' };
    if (avg <= 500) return { class: 'B', color: 'text-green-400', label: 'Good' };
    if (avg <= 1000) return { class: 'C', color: 'text-yellow-500', label: 'Average' };
    if (avg <= 5000) return { class: 'D', color: 'text-orange-500', label: 'Poor' };
    return { class: 'E', color: 'text-red-500', label: 'Critical' };
  };

  const efficiency = getEfficiencyClass(avgPerReading);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      {!hideHeader && <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-aqua-500/20 p-2 rounded-lg">
                <Droplets className="w-8 h-8 text-aqua-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Aqua-Cert</h1>
                <p className="text-slate-400 text-sm">Water Footprint Verification on IOTA</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-sm">{isConnected ? 'Live' : 'Offline'}</span>
              </div>
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            icon={<Droplets className="w-6 h-6" />}
            title="Total Consumption"
            value={`${totalLiters.toLocaleString()} L`}
            subtitle="Registered liters"
            color="aqua"
          />
          <StatsCard
            icon={<Activity className="w-6 h-6" />}
            title="IoT Readings"
            value={totalReadings.toLocaleString()}
            subtitle="Data certified on IOTA"
            color="blue"
          />
          <StatsCard
            icon={<Leaf className={`w-6 h-6 ${efficiency.color}`} />}
            title="Efficiency Class"
            value={efficiency.class}
            subtitle={efficiency.label}
            color="green"
          />
          <StatsCard
            icon={<TrendingDown className="w-6 h-6" />}
            title="Avg/Reading"
            value={`${avgPerReading.toFixed(1)} L`}
            subtitle="Water efficiency"
            color="purple"
          />
        </div>

        {/* IOTA Notarization proof banner */}
        {latestNotarization && (
          <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-4">
            <div className="bg-green-500/20 p-2 rounded-lg shrink-0">
              <ShieldCheck className="w-6 h-6 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-green-400 font-semibold text-sm">
                Data Integrity Anchored on IOTA
                {latestNotarization.gas_station === 1 && (
                  <span className="ml-2 text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">Gas Sponsored</span>
                )}
              </p>
              <p className="text-slate-400 text-xs truncate mt-0.5">{latestNotarization.description}</p>
            </div>
            <div className="shrink-0 text-right">
              {latestNotarization.tx_digest && (
                <a
                  href={`https://explorer.rebased.iota.org/transaction/${latestNotarization.tx_digest}?network=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300 text-xs font-mono underline"
                >
                  {latestNotarization.tx_digest.slice(0, 16)}...
                </a>
              )}
              <p className="text-slate-500 text-xs mt-0.5">
                {notarizations.length} proofs anchored
              </p>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart - 2 columns */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-aqua-400" />
                Real-Time Water Flow
              </h2>
              <WaterFlowChart readings={readings} />
            </div>
          </div>

          {/* Certificate - 1 column */}
          <div>
            <CertificateCard 
              stats={stats}
              walletAddress={account?.address || ''}
            />
          </div>
        </div>

        {/* Recent Readings Table */}
        <div className="mt-8">
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-aqua-400" />
              Recent Readings (Blockchain-Verified)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-slate-400 text-sm border-b border-slate-700">
                    <th className="text-left py-3 px-4">Device</th>
                    <th className="text-left py-3 px-4">Liters</th>
                    <th className="text-left py-3 px-4">Flow Rate</th>
                    <th className="text-left py-3 px-4">Timestamp</th>
                    <th className="text-left py-3 px-4">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.slice(0, 10).map((reading, index) => (
                    <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-aqua-400 font-mono text-sm">{reading.deviceId}</span>
                      </td>
                      <td className="py-3 px-4 text-white">
                        {(reading.liters / 1000).toFixed(2)} L
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {reading.rawData.flowRate.toFixed(1)} L/h
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-sm">
                        {new Date(reading.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs text-slate-500">
                          {reading.hash.substring(0, 16)}...
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-slate-700">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            🌊 Aqua-Cert - Powered by IOTA Blockchain | MasterZ × IOTA Hackathon 2025
          </p>
        </div>
      </footer>
    </div>
  );
}
