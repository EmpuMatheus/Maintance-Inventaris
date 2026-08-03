import type { HealthCategory, Recommendation, RiskLevel } from '../types';

const CATEGORY_STYLES: Record<HealthCategory, string> = {
  Excellent: 'bg-emerald-100 text-emerald-700',
  Good: 'bg-green-100 text-green-700',
  Fair: 'bg-yellow-100 text-yellow-700',
  Poor: 'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
};

export function HealthCategoryBadge({ category }: { category: HealthCategory }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[category]}`}>
      {category}
    </span>
  );
}

const RECOMMENDATION_STYLES: Record<Recommendation, string> = {
  Keep: 'bg-slate-100 text-slate-600',
  Monitor: 'bg-sky-100 text-sky-700',
  Repair: 'bg-yellow-100 text-yellow-700',
  'Replace Soon': 'bg-orange-100 text-orange-700',
  'Replace Immediately': 'bg-red-100 text-red-700',
};

export function RecommendationBadge({ recommendation }: { recommendation: Recommendation }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${RECOMMENDATION_STYLES[recommendation]}`}>
      {recommendation}
    </span>
  );
}

const RISK_STYLES: Record<RiskLevel, string> = {
  Low: 'bg-slate-100 text-slate-600',
  Medium: 'bg-yellow-100 text-yellow-700',
  High: 'bg-orange-100 text-orange-700',
  Critical: 'bg-red-100 text-red-700',
};

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${RISK_STYLES[risk]}`}>
      {risk}
    </span>
  );
}

export function HealthScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-emerald-500' : score >= 70 ? 'bg-green-500' : score >= 55 ? 'bg-yellow-500' : score >= 40 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex min-w-[90px] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600">{score}</span>
    </div>
  );
}
