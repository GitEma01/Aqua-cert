import React, { useState, useEffect } from 'react';
import { Award, Loader2, CheckCircle2, Zap } from 'lucide-react';
import { useCurrentAccount } from '@iota/dapp-kit';

interface Props {
  stats: { totalReadings: number; totalLiters: number } | null;
  walletAddress: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function CertificateCard({ stats, walletAddress }: Props) {
  const [isIssuing, setIsIssuing] = useState(false);
  const [certificateIssued, setCertificateIssued] = useState(false);
  const [gasStationAvailable, setGasStationAvailable] = useState(false);
  const account = useCurrentAccount();

  const canIssueCertificate = stats && stats.totalReadings >= 10;

  useEffect(() => {
    fetch(`${API_URL}/gas-station/status`)
      .then(r => r.json())
      .then(d => setGasStationAvailable(d.available))
      .catch(() => {});
  }, []);

  const handleIssueCertificate = async () => {
    if (!account) return;

    setIsIssuing(true);

    try {
      const response = await fetch(`${API_URL}/issue-certificate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificateNumber: `AQUA-${Date.now()}`,
          companyName: 'Demo Company',
          periodStart: Date.now() - 30 * 24 * 60 * 60 * 1000,
          periodEnd: Date.now(),
          imageUrl: '',
          recipient: account.address
        })
      });

      const result = await response.json();
      if (result.success) setCertificateIssued(true);
    } catch (error) {
      console.error('Error issuing certificate:', error);
    } finally {
      setIsIssuing(false);
    }
  };

  // Calculate efficiency class
  const getEfficiencyClass = () => {
    if (!stats || stats.totalReadings === 0) return { class: '-', color: 'text-slate-500' };
    const avg = (stats.totalLiters / 1000) / stats.totalReadings;
    if (avg <= 100) return { class: 'A', color: 'text-green-500', bg: 'bg-green-500/20' };
    if (avg <= 500) return { class: 'B', color: 'text-green-400', bg: 'bg-green-400/20' };
    if (avg <= 1000) return { class: 'C', color: 'text-yellow-500', bg: 'bg-yellow-500/20' };
    if (avg <= 5000) return { class: 'D', color: 'text-orange-500', bg: 'bg-orange-500/20' };
    return { class: 'E', color: 'text-red-500', bg: 'bg-red-500/20' };
  };

  const efficiency = getEfficiencyClass();

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      {/* Header with water pattern */}
      <div className="relative bg-gradient-to-r from-aqua-600 to-aqua-500 p-6 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <pattern id="water-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="2" fill="white"/>
            </pattern>
            <rect fill="url(#water-pattern)" width="100" height="100"/>
          </svg>
        </div>
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-aqua-100 text-sm font-medium">Water Footprint</p>
            <h3 className="text-white text-2xl font-bold">NFT Certificate</h3>
          </div>
          <div className="bg-white/20 p-3 rounded-xl">
            <Award className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Efficiency Class */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Efficiency Class</span>
          <div className={`${efficiency.bg} px-4 py-2 rounded-lg`}>
            <span className={`text-3xl font-bold ${efficiency.color}`}>
              {efficiency.class}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Total Liters</p>
            <p className="text-white text-xl font-bold">
              {stats ? (stats.totalLiters / 1000).toLocaleString() : '0'}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Readings</p>
            <p className="text-white text-xl font-bold">
              {stats?.totalReadings.toLocaleString() || '0'}
            </p>
          </div>
        </div>

        {/* Progress toward certification */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">Certification Progress</span>
            <span className="text-aqua-400">
              {stats ? Math.min(stats.totalReadings, 10) : 0}/10 readings
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-aqua-500 to-aqua-400 rounded-full transition-all duration-500"
              style={{ width: `${stats ? Math.min((stats.totalReadings / 10) * 100, 100) : 0}%` }}
            />
          </div>
        </div>

        {/* Gas Station badge */}
        {gasStationAvailable && (
          <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2">
            <Zap className="w-4 h-4 text-purple-400 shrink-0" />
            <p className="text-purple-300 text-xs">
              Gas Station active — notarizations are gas-sponsored
            </p>
          </div>
        )}

        {/* Action Button */}
        {certificateIssued ? (
          <div className="flex items-center justify-center gap-2 bg-green-500/20 text-green-400 py-3 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">Certificate Issued!</span>
          </div>
        ) : (
          <button
            onClick={handleIssueCertificate}
            disabled={!canIssueCertificate || isIssuing || !account}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all
              ${canIssueCertificate && account
                ? 'bg-aqua-500 hover:bg-aqua-400 text-white cursor-pointer'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
          >
            {isIssuing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Issuing...
              </>
            ) : (
              <>
                <Award className="w-5 h-5" />
                {!account
                  ? 'Connect Wallet'
                  : canIssueCertificate
                    ? 'Issue Water Certificate NFT'
                    : 'Min 10 readings required'
                }
              </>
            )}
          </button>
        )}

        {/* Info */}
        <p className="text-slate-500 text-xs text-center">
          Certificate NFT verifies your Water Footprint on IOTA Blockchain
          {gasStationAvailable && ' · Gas-free via Gas Station'}
        </p>
      </div>
    </div>
  );
}
