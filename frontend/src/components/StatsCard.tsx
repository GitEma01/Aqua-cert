import React from 'react';

interface Props {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  color: 'aqua' | 'blue' | 'green' | 'purple' | 'orange';
}

const colorClasses = {
  aqua: 'from-aqua-500/20 to-aqua-600/10 border-aqua-500/30 text-aqua-400',
  blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
  green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-400',
  purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
  orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400',
};

export default function StatsCard({ icon, title, value, subtitle, color }: Props) {
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-2xl p-6`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">{title}</p>
          <p className="text-white text-3xl font-bold">{value}</p>
          <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
        </div>
        <div className={`${colorClasses[color]} p-3 rounded-xl bg-slate-800/50`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
