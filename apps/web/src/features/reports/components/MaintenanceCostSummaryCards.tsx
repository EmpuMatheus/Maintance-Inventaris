import { Banknote, Coins, CircleDollarSign, Package, TrendingUp, Wallet, Wrench } from 'lucide-react';
import type { MaintenanceCostSummary } from '../types';

function currency(value?: number): string {
  const n = value ?? 0;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

const CARDS = [
  { key: 'totalCost', label: 'Total Cost', icon: <Wallet className="h-4 w-4" />, tone: 'bg-indigo-50 text-indigo-600' },
  { key: 'averageCost', label: 'Average Cost', icon: <TrendingUp className="h-4 w-4" />, tone: 'bg-blue-50 text-blue-600' },
  { key: 'highestCost', label: 'Highest Cost', icon: <Banknote className="h-4 w-4" />, tone: 'bg-violet-50 text-violet-600' },
  { key: 'totalLabor', label: 'Labor Cost', icon: <Wrench className="h-4 w-4" />, tone: 'bg-amber-50 text-amber-600' },
  { key: 'totalParts', label: 'Part Cost', icon: <Package className="h-4 w-4" />, tone: 'bg-green-50 text-green-600' },
  { key: 'totalOther', label: 'Other Cost', icon: <Coins className="h-4 w-4" />, tone: 'bg-slate-100 text-slate-600' },
] as const;

export default function MaintenanceCostSummaryCards({ summary }: { summary?: MaintenanceCostSummary }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {CARDS.map((card) => (
        <div key={card.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{card.label}</span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.tone}`}>{card.icon}</span>
          </div>
          <p className="truncate text-lg font-bold text-slate-900">{currency(summary?.[card.key])}</p>
        </div>
      ))}
      <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:col-span-3 lg:col-span-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <CircleDollarSign className="h-4 w-4 text-emerald-600" />
            Preventive: <strong className="text-slate-900">{currency(summary?.preventiveCost)}</strong>
          </span>
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <Wrench className="h-4 w-4 text-orange-600" />
            Corrective: <strong className="text-slate-900">{currency(summary?.correctiveCost)}</strong>
          </span>
          <span className="text-sm text-slate-500">· {summary?.totalMaintenance ?? 0} maintenance records</span>
        </div>
      </div>
    </div>
  );
}
