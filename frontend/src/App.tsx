import { useState } from 'react';
import { Droplets, Award, Cpu, ShieldCheck, Globe } from 'lucide-react';
import { ConnectButton, useCurrentAccount } from '@iota/dapp-kit';
import Dashboard from './components/Dashboard';
import CertificateHistory from './components/CertificateHistory';
import DeviceManager from './components/DeviceManager';
import NotarizationProofs from './components/NotarizationProofs';
import Analytics from './components/Analytics';

type Tab = 'dashboard' | 'certificates' | 'devices' | 'notarizations' | 'analytics';

function TabButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
        ${active
          ? 'bg-aqua-500/20 text-aqua-400 border border-aqua-500/30'
          : 'text-slate-400 hover:text-white hover:bg-slate-700/50 border border-transparent'
        }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const account = useCurrentAccount();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Shared sticky header */}
      <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-aqua-500/20 p-2 rounded-lg">
                <Droplets className="w-8 h-8 text-aqua-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Aqua-Cert</h1>
                <p className="text-slate-400 text-sm">Water Footprint Verification on IOTA</p>
              </div>
            </div>

            {/* Tab navigation */}
            <nav className="flex gap-1 bg-slate-900/50 rounded-xl p-1">
              <TabButton
                active={activeTab === 'dashboard'}
                onClick={() => setActiveTab('dashboard')}
                icon={<Droplets className="w-4 h-4" />}
                label="Dashboard"
              />
              <TabButton
                active={activeTab === 'certificates'}
                onClick={() => setActiveTab('certificates')}
                icon={<Award className="w-4 h-4" />}
                label="Certificates"
              />
              <TabButton
                active={activeTab === 'devices'}
                onClick={() => setActiveTab('devices')}
                icon={<Cpu className="w-4 h-4" />}
                label="Devices"
              />
              <TabButton
                active={activeTab === 'notarizations'}
                onClick={() => setActiveTab('notarizations')}
                icon={<ShieldCheck className="w-4 h-4" />}
                label="Proofs"
              />
              <TabButton
                active={activeTab === 'analytics'}
                onClick={() => setActiveTab('analytics')}
                icon={<Globe className="w-4 h-4" />}
                label="Analytics"
              />
            </nav>

            {/* Wallet */}
            <div className="shrink-0">
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Tab content */}
      {activeTab === 'dashboard'      && <Dashboard hideHeader />}
      {activeTab === 'certificates'   && <CertificateHistory walletAddress={account?.address ?? ''} />}
      {activeTab === 'devices'        && <DeviceManager walletAddress={account?.address ?? ''} />}
      {activeTab === 'notarizations'  && <NotarizationProofs />}
      {activeTab === 'analytics'      && <Analytics />}
    </div>
  );
}
