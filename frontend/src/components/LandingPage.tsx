import { useEffect, useRef, useState } from 'react';
import {
  Activity, Award, ShieldCheck, Zap, Globe,
  ArrowRight, Cpu, Droplets, ChevronDown
} from 'lucide-react';
import AquaCertLogo from './AquaCertLogo';

interface Props {
  onEnterApp: () => void;
}

const PACKAGE_ID = '0xe10923aa2872e4786d13fd427db50eec1841759ecb9b75b08375d27682202b56';
const EXPLORER = `https://explorer.rebased.iota.org/object/${PACKAGE_ID}?network=testnet`;

const FEATURES = [
  {
    icon: <Activity className="w-6 h-6" />,
    title: 'Real-time IoT Monitoring',
    desc: 'Live sensor data — flow rate, pressure, temperature — streamed via WebSocket and stored immutably on IOTA.',
    color: 'text-aqua-400',
    border: 'border-aqua-500/20',
    bg: 'bg-aqua-500/10',
  },
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    title: 'On-chain Notarization',
    desc: 'Every batch of readings is SHA-256 hashed and anchored as a Locked proof via IOTA Notarization — tamper-evident by design.',
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: <Award className="w-6 h-6" />,
    title: 'Water Certificate NFTs',
    desc: 'Verified consumption automatically triggers a WaterCertificate NFT (class A–E) minted on IOTA Move smart contracts.',
    color: 'text-yellow-400',
    border: 'border-yellow-500/20',
    bg: 'bg-yellow-500/10',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Gas-free Transfers',
    desc: 'IOTA Gas Station sponsors certificate transfers — users sign with their wallet, no IOTA needed for fees.',
    color: 'text-purple-400',
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/10',
  },
  {
    icon: <Cpu className="w-6 h-6" />,
    title: 'Device Management',
    desc: 'Register and monitor multiple IoT sensors on-chain. Track per-device consumption, readings, and history.',
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/10',
  },
  {
    icon: <Globe className="w-6 h-6" />,
    title: 'Global Analytics',
    desc: 'Cross-wallet certificate discovery via IOTA GraphQL. View total certified liters, footprint classes, and live events.',
    color: 'text-pink-400',
    border: 'border-pink-500/20',
    bg: 'bg-pink-500/10',
  },
];

const STEPS = [
  { icon: <Droplets className="w-5 h-5" />, label: 'IoT sensors stream water data' },
  { icon: <ShieldCheck className="w-5 h-5" />, label: 'Batches anchored via IOTA Notarization' },
  { icon: <Award className="w-5 h-5" />, label: 'Certificate NFT minted on IOTA Move' },
  { icon: <Zap className="w-5 h-5" />, label: 'Gas Station sponsors gas-free transfers' },
];

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let start = 0;
    const step = target / 60;
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setValue(target); clearInterval(timer); }
      else setValue(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target]);

  return <span ref={ref}>{value.toLocaleString()}{suffix}</span>;
}

export default function LandingPage({ onEnterApp }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-x-hidden">

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center">

        {/* Background radial glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-aqua-500/5 rounded-full blur-3xl" />
        </div>

        {/* IOTA badge */}
        <div
          className={`mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-aqua-500/30 bg-aqua-500/10 text-aqua-400 text-sm font-medium transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
        >
          <span className="w-2 h-2 rounded-full bg-aqua-400 animate-pulse" />
          Built on IOTA Testnet · MasterZ × IOTA Hackathon 2025
        </div>

        {/* Logo + title */}
        <div
          className={`flex flex-col items-center gap-4 transition-all duration-700 delay-100 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        >
          <AquaCertLogo size={96} />
          <h1 className="text-6xl md:text-7xl font-black tracking-tight">
            <span className="text-white">Aqua</span>
            <span className="text-aqua-400">Cert</span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 max-w-2xl leading-relaxed">
            Trustless water footprint certification — IoT sensors, on-chain proofs, and NFT certificates on <span className="text-aqua-400 font-semibold">IOTA</span>.
          </p>
        </div>

        {/* CTA buttons */}
        <div
          className={`mt-10 flex flex-col sm:flex-row gap-4 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        >
          <button
            onClick={onEnterApp}
            className="group flex items-center gap-2 px-8 py-4 bg-aqua-500 hover:bg-aqua-400 text-slate-900 font-bold text-lg rounded-xl transition-all duration-200 shadow-lg shadow-aqua-500/25 hover:shadow-aqua-400/40 hover:scale-105"
          >
            Launch App
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <a
            href={EXPLORER}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-8 py-4 border border-slate-600 hover:border-aqua-500/50 text-slate-300 hover:text-white font-semibold text-lg rounded-xl transition-all duration-200 hover:bg-slate-700/50"
          >
            <ShieldCheck className="w-5 h-5 text-aqua-400" />
            Smart Contract
          </a>
        </div>

        {/* Stat pills */}
        <div
          className={`mt-14 flex flex-wrap justify-center gap-6 transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
        >
          {[
            { value: 4, suffix: '', label: 'Move Modules' },
            { value: 5, suffix: '+', label: 'IOTA SDKs' },
            { value: 10, suffix: '', label: 'REST Endpoints' },
            { value: 100, suffix: '%', label: 'On-chain Proofs' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-black text-aqua-400">
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              </p>
              <p className="text-slate-400 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-slate-500 animate-bounce">
          <ChevronDown className="w-6 h-6" />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">How It Works</h2>
          <p className="text-center text-slate-400 mb-14">Four steps from raw sensor data to a certified on-chain proof.</p>
          <div className="relative">
            {/* Connector line */}
            <div className="absolute top-8 left-8 right-8 h-px bg-gradient-to-r from-transparent via-aqua-500/30 to-transparent hidden md:block" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {STEPS.map((step, i) => (
                <div key={i} className="relative flex flex-col items-center text-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-aqua-500/15 border border-aqua-500/30 flex items-center justify-center text-aqua-400 z-10">
                    {step.icon}
                  </div>
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-700 border border-slate-600 text-xs text-slate-400 flex items-center justify-center font-bold z-20">
                    {i + 1}
                  </span>
                  <p className="text-slate-300 text-sm font-medium">{step.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">Features</h2>
          <p className="text-center text-slate-400 mb-14">Everything needed for trustless water certification — in one dApp.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className={`rounded-xl border ${f.border} bg-slate-800/50 p-6 hover:bg-slate-700/50 transition-colors group`}
              >
                <div className={`w-12 h-12 rounded-lg ${f.bg} flex items-center justify-center ${f.color} mb-4 group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className={`font-semibold text-lg mb-2 ${f.color}`}>{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech stack ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Built with IOTA Technology</h2>
          <p className="text-slate-400 mb-12">Every layer of the stack is wired to the IOTA ecosystem.</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              '@iota/iota-sdk',
              '@iota/dapp-kit',
              '@iota/notarization',
              'IOTA Move',
              'IOTA Gas Station',
              'IOTA GraphQL API',
              'IOTA Testnet',
            ].map(tag => (
              <span
                key={tag}
                className="px-4 py-2 rounded-full bg-aqua-500/10 border border-aqua-500/20 text-aqua-400 text-sm font-mono font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-6 border-t border-slate-700/50">
        <div className="max-w-2xl mx-auto text-center">
          <AquaCertLogo size={64} className="mx-auto mb-6" />
          <h2 className="text-4xl font-black text-white mb-4">
            Ready to certify water?
          </h2>
          <p className="text-slate-400 mb-8">
            Connect your IOTA wallet and start monitoring IoT sensors, issuing certificates, and exploring on-chain proofs.
          </p>
          <button
            onClick={onEnterApp}
            className="group inline-flex items-center gap-2 px-10 py-4 bg-aqua-500 hover:bg-aqua-400 text-slate-900 font-bold text-lg rounded-xl transition-all duration-200 shadow-lg shadow-aqua-500/25 hover:shadow-aqua-400/40 hover:scale-105"
          >
            Launch App
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6 border-t border-slate-700/50 text-center text-slate-500 text-sm">
        <p>
          AquaCert · MasterZ × IOTA Hackathon 2025 ·{' '}
          <a href={EXPLORER} target="_blank" rel="noopener noreferrer" className="text-aqua-500/70 hover:text-aqua-400 transition-colors">
            View on IOTA Explorer
          </a>
        </p>
      </footer>
    </div>
  );
}
