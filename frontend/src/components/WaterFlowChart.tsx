import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface Reading {
  deviceId: string;
  liters: number;
  timestamp: number;
  rawData: {
    flowRate: number;
    pressure: number;
    temperature: number;
  };
}

interface Props {
  readings: Reading[];
}

export default function WaterFlowChart({ readings }: Props) {
  const chartData = useMemo(() => {
    // Group by timestamp (rounded to seconds)
    const grouped = readings.slice(0, 50).reduce((acc, reading) => {
      const timeKey = Math.floor(reading.timestamp / 1000) * 1000;
      if (!acc[timeKey]) {
        acc[timeKey] = {
          time: new Date(timeKey).toLocaleTimeString(),
          timestamp: timeKey,
          'irrigation': 0,
          'industrial': 0,
          'datacenter': 0,
          total: 0
        };
      }
      
      const liters = reading.liters / 1000;
      acc[timeKey].total += liters;
      
      if (reading.deviceId.includes('IRR')) {
        acc[timeKey]['irrigation'] += liters;
      } else if (reading.deviceId.includes('IND')) {
        acc[timeKey]['industrial'] += liters;
      } else if (reading.deviceId.includes('DC')) {
        acc[timeKey]['datacenter'] += liters;
      }
      
      return acc;
    }, {} as Record<number, any>);

    return Object.values(grouped)
      .sort((a: any, b: any) => a.timestamp - b.timestamp)
      .slice(-20);
  }, [readings]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(2)} L
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorIrrigation" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00e0ff" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#00e0ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorIndustrial" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorDatacenter" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis 
            dataKey="time" 
            stroke="#64748b" 
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis 
            stroke="#64748b" 
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            label={{ 
              value: 'Liters',
              angle: -90, 
              position: 'insideLeft',
              style: { fill: '#94a3b8' }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => <span className="text-slate-300 capitalize">{value}</span>}
          />
          <Area
            type="monotone"
            dataKey="irrigation"
            name="Irrigation"
            stackId="1"
            stroke="#00e0ff"
            fill="url(#colorIrrigation)"
          />
          <Area
            type="monotone"
            dataKey="industrial"
            name="Industrial"
            stackId="1"
            stroke="#8b5cf6"
            fill="url(#colorIndustrial)"
          />
          <Area
            type="monotone"
            dataKey="datacenter"
            name="Data Center"
            stackId="1"
            stroke="#22c55e"
            fill="url(#colorDatacenter)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
