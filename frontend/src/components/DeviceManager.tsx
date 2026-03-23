import { useState, useEffect } from 'react';
import { Cpu, Loader2, CheckCircle2, AlertCircle, Wifi, WifiOff, Activity, Droplets, ChevronRight } from 'lucide-react';

interface DeviceWithStats {
  device_id: string;
  name: string;
  location: string;
  device_type: string;
  device_cap_id: string | null;
  registered_at: number;
  active: number;
  readings: number;
  liters: number;
}

interface DeviceStats {
  device: DeviceWithStats;
  readings: number;
  liters: number;
  lastReading: {
    device_id: string;
    liters: number;
    timestamp: number;
    flow_rate: number;
    hash: string;
  } | null;
}

interface RecentReading {
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

interface RegisterForm {
  deviceId: string;
  name: string;
  location: string;
  deviceType: 'irrigation' | 'industrial' | 'datacenter';
}

interface Props {
  walletAddress: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const TYPE_LABELS: Record<string, string> = {
  irrigation: 'Irrigation',
  industrial: 'Industrial',
  datacenter: 'Data Center'
};

const TYPE_COLORS: Record<string, string> = {
  irrigation: 'text-green-400 bg-green-500/20 border-green-500/30',
  industrial: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
  datacenter: 'text-blue-400 bg-blue-500/20 border-blue-500/30'
};

export default function DeviceManager({ walletAddress }: Props) {
  const [devices, setDevices] = useState<DeviceWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [recentReadings, setRecentReadings] = useState<RecentReading[]>([]);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<RegisterForm>({
    deviceId: '',
    name: '',
    location: '',
    deviceType: 'irrigation'
  });

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/devices`);
      setDevices(await r.json());
    } catch (_) {}
    setLoading(false);
  };

  const fetchDeviceDetail = async (deviceId: string) => {
    const [statsRes, readingsRes] = await Promise.all([
      fetch(`${API_URL}/devices/${deviceId}/stats`),
      fetch(`${API_URL}/readings/${deviceId}?limit=5`)
    ]);
    setDeviceStats(await statsRes.json());
    setRecentReadings(await readingsRes.json());
  };

  useEffect(() => { fetchDevices(); }, []);

  useEffect(() => {
    if (selectedDevice) fetchDeviceDetail(selectedDevice);
  }, [selectedDevice]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.deviceId || !form.name || !form.location) return;
    setRegistering(true);
    setRegisterError(null);
    setRegisterSuccess(null);
    try {
      const r = await fetch(`${API_URL}/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const result = await r.json();
      if (result.success) {
        setRegisterSuccess(`Device registered on-chain. DeviceCap: ${result.objectId ?? 'pending'}`);
        setForm({ deviceId: '', name: '', location: '', deviceType: 'irrigation' });
        fetchDevices();
      } else {
        setRegisterError(result.error ?? 'Registration failed');
      }
    } catch (err: any) {
      setRegisterError('Cannot reach backend. Is it running?');
    }
    setRegistering(false);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Device list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: device list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-aqua-400" />
            <h2 className="text-lg font-semibold text-white">IoT Devices</h2>
            {loading && <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />}
          </div>

          {!loading && devices.length === 0 && (
            <p className="text-slate-500 text-sm">No devices found.</p>
          )}

          {devices.map(device => (
            <button
              key={device.device_id}
              onClick={() => setSelectedDevice(device.device_id)}
              className={`w-full text-left bg-slate-800/50 border rounded-xl p-4 hover:border-aqua-500/40 transition-colors
                ${selectedDevice === device.device_id ? 'border-aqua-500/60 bg-slate-800' : 'border-slate-700'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-aqua-400 font-mono text-xs truncate">{device.device_id}</span>
                    {device.device_cap_id
                      ? <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 shrink-0">On-Chain</span>
                      : <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">Simulator</span>
                    }
                  </div>
                  <p className="text-white text-sm font-medium truncate">{device.name}</p>
                  <p className="text-slate-500 text-xs truncate">{device.location}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 mt-1" />
              </div>

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-700/50">
                <span className={`text-xs px-2 py-0.5 rounded border ${TYPE_COLORS[device.device_type] ?? TYPE_COLORS.irrigation}`}>
                  {TYPE_LABELS[device.device_type] ?? device.device_type}
                </span>
                <span className="text-slate-500 text-xs">{device.readings} readings</span>
                <span className="text-slate-500 text-xs">{(device.liters / 1000).toFixed(1)} L</span>
              </div>
            </button>
          ))}
        </div>

        {/* Right: device detail */}
        <div className="lg:col-span-3">
          {!selectedDevice ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 bg-slate-800/30 border border-slate-700 rounded-2xl p-12 text-center">
              <Cpu className="w-10 h-10 text-slate-600" />
              <p className="text-slate-500 text-sm">Select a device to view details</p>
            </div>
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
              {/* Detail header */}
              <div className="p-5 border-b border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="bg-aqua-500/20 p-2 rounded-lg">
                    <Cpu className="w-5 h-5 text-aqua-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{deviceStats?.device.name ?? selectedDevice}</p>
                    <p className="text-slate-500 text-xs">{deviceStats?.device.location}</p>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 divide-x divide-slate-700 border-b border-slate-700">
                <div className="p-4 text-center">
                  <p className="text-slate-500 text-xs mb-1">Readings</p>
                  <p className="text-white font-bold text-xl">{deviceStats?.readings ?? '—'}</p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-slate-500 text-xs mb-1">Total Liters</p>
                  <p className="text-white font-bold text-xl">
                    {deviceStats ? (deviceStats.liters / 1000).toFixed(1) : '—'}
                  </p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-slate-500 text-xs mb-1">Last Flow</p>
                  <p className="text-white font-bold text-xl">
                    {deviceStats?.lastReading ? `${deviceStats.lastReading.flow_rate.toFixed(0)} L/h` : '—'}
                  </p>
                </div>
              </div>

              {/* Recent readings table */}
              <div className="p-5">
                <p className="text-slate-400 text-sm font-medium mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Recent Readings
                </p>
                {recentReadings.length === 0 ? (
                  <p className="text-slate-600 text-sm">No readings yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-500 text-xs border-b border-slate-700">
                        <th className="text-left pb-2">Time</th>
                        <th className="text-left pb-2">Liters</th>
                        <th className="text-left pb-2">Flow (L/h)</th>
                        <th className="text-left pb-2">Hash</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentReadings.map((r, i) => (
                        <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                          <td className="py-2 text-slate-400">{new Date(r.timestamp).toLocaleTimeString()}</td>
                          <td className="py-2 text-white">{(r.liters / 1000).toFixed(2)}</td>
                          <td className="py-2 text-slate-300">{r.rawData.flowRate.toFixed(1)}</td>
                          <td className="py-2 text-slate-600 font-mono text-xs">{r.hash.slice(0, 12)}…</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Register new device */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <Cpu className="w-5 h-5 text-aqua-400" />
          <h3 className="text-lg font-semibold text-white">Register New Device</h3>
          {!walletAddress && (
            <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded ml-2">
              Connect wallet to register
            </span>
          )}
        </div>

        <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 uppercase tracking-wider">Device ID</label>
            <input
              type="text"
              placeholder="e.g. SENSOR-IRR-003"
              value={form.deviceId}
              onChange={e => setForm(f => ({ ...f, deviceId: e.target.value }))}
              disabled={!walletAddress || registering}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-aqua-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 uppercase tracking-wider">Device Name</label>
            <input
              type="text"
              placeholder="e.g. North Irrigation Field"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              disabled={!walletAddress || registering}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-aqua-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 uppercase tracking-wider">Location</label>
            <input
              type="text"
              placeholder="e.g. Farm Sector C, Milan"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              disabled={!walletAddress || registering}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-aqua-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 uppercase tracking-wider">Device Type</label>
            <select
              value={form.deviceType}
              onChange={e => setForm(f => ({ ...f, deviceType: e.target.value as RegisterForm['deviceType'] }))}
              disabled={!walletAddress || registering}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-aqua-500 disabled:opacity-50"
            >
              <option value="irrigation">Irrigation</option>
              <option value="industrial">Industrial</option>
              <option value="datacenter">Data Center</option>
            </select>
          </div>

          <div className="md:col-span-2 flex flex-col gap-3">
            <button
              type="submit"
              disabled={!walletAddress || registering || !form.deviceId || !form.name || !form.location}
              className="flex items-center justify-center gap-2 w-full md:w-auto md:px-8 py-2.5 bg-aqua-500 hover:bg-aqua-400 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-medium text-sm transition-colors"
            >
              {registering ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Registering on-chain…</>
              ) : (
                <><Cpu className="w-4 h-4" /> Register Device</>
              )}
            </button>

            {registerSuccess && (
              <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg p-3 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-mono break-all">{registerSuccess}</span>
              </div>
            )}
            {registerError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-3 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {registerError}
              </div>
            )}
            <p className="text-slate-600 text-xs">
              The device will be registered on IOTA blockchain using the admin keypair. Once registered it will immediately start receiving simulator readings.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
