import { AlertTriangle, Boxes, CheckCircle2, CircleAlert, Package, ThumbsUp, XCircle } from 'lucide-react';
import type { AssetConditionSummary } from '../types';

const CARDS = [
  { key: 'total', label: 'Total Assets', icon: <Boxes className="h-4 w-4" />, tone: 'bg-indigo-50 text-indigo-600' },
  { key: 'good', label: 'Good', icon: <ThumbsUp className="h-4 w-4" />, tone: 'bg-green-50 text-green-600' },
  { key: 'fair', label: 'Fair', icon: <Package className="h-4 w-4" />, tone: 'bg-yellow-50 text-yellow-600' },
  { key: 'needAttention', label: 'Need Attention', icon: <CircleAlert className="h-4 w-4" />, tone: 'bg-orange-50 text-orange-600' },
  { key: 'broken', label: 'Broken', icon: <XCircle className="h-4 w-4" />, tone: 'bg-red-50 text-red-600' },
  { key: 'critical', label: 'Critical', icon: <AlertTriangle className="h-4 w-4" />, tone: 'bg-red-100 text-red-700' },
  { key: 'retired', label: 'Retired', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'bg-slate-100 text-slate-600' },
] as const;

export default function AssetConditionSummaryCards({ summary }: { summary?: AssetConditionSummary }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {CARDS.map((card) => (
        <div key={card.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{card.label}</span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.tone}`}>{card.icon}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{summary?.[card.key] ?? 0}</p>
        </div>
      ))}
    </div>
  );
}
