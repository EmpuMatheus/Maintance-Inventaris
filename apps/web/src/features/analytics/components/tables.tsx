import { Link } from 'react-router-dom';
import type { AnalyticsDashboard, AssetHealth, AssetReplacement } from '../types';
import { HealthCategoryBadge, HealthScoreBar, RecommendationBadge, RiskBadge } from './badges';
import { EmptyState } from './ui';
import ConditionBadge from '@/components/ui/ConditionBadge';

const money = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

function MobileCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{children}</div>;
}

export function TopCriticalTable({ assets }: { assets: AssetHealth[] }) {
  if (assets.length === 0) return <EmptyState message="No assets to show." />;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <th className="py-2 pr-3 font-medium">Asset</th>
              <th className="py-2 pr-3 font-medium">Condition</th>
              <th className="py-2 pr-3 font-medium">Health</th>
              <th className="py-2 pr-3 font-medium">Failures</th>
              <th className="py-2 pr-3 font-medium">Downtime</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 last:border-0">
                <td className="py-2 pr-3">
                  <Link to={`/assets/${a.id}`} className="font-medium text-indigo-600 hover:underline">{a.assetCode}</Link>
                  <div className="text-xs text-slate-400">{a.assetName}</div>
                </td>
                <td className="py-2 pr-3"><ConditionBadge condition={a.condition} /></td>
                <td className="py-2 pr-3"><HealthScoreBar score={a.healthScore} /></td>
                <td className="py-2 pr-3 text-slate-600">{a.failures}</td>
                <td className="py-2 pr-3 text-slate-600">{a.downtimeDays}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {assets.slice(0, 6).map((a) => (
          <MobileCard key={a.id}>
            <div className="flex items-center justify-between">
              <Link to={`/assets/${a.id}`} className="font-medium text-indigo-600 hover:underline">{a.assetCode}</Link>
              <HealthScoreBar score={a.healthScore} />
            </div>
            <div className="mt-1 text-xs text-slate-400">{a.assetName}</div>
            <div className="mt-2 flex items-center gap-2">
              <ConditionBadge condition={a.condition} />
              <HealthCategoryBadge category={a.category} />
              <span className="text-xs text-slate-400">{a.failures} failures</span>
            </div>
          </MobileCard>
        ))}
      </div>
    </>
  );
}

export function ReplacementCandidatesTable({ assets }: { assets: AssetReplacement[] }) {
  if (assets.length === 0) return <EmptyState message="No replacement candidates right now." />;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <th className="py-2 pr-3 font-medium">Asset</th>
              <th className="py-2 pr-3 font-medium">Recommendation</th>
              <th className="py-2 pr-3 font-medium">Health</th>
              <th className="py-2 pr-3 font-medium">Risk</th>
              <th className="py-2 pr-3 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 last:border-0 align-top">
                <td className="py-2 pr-3">
                  <Link to={`/assets/${a.id}`} className="font-medium text-indigo-600 hover:underline">{a.assetCode}</Link>
                  <div className="text-xs text-slate-400">{a.assetName}</div>
                </td>
                <td className="py-2 pr-3"><RecommendationBadge recommendation={a.recommendation} /></td>
                <td className="py-2 pr-3">{a.healthScore}</td>
                <td className="py-2 pr-3"><RiskBadge risk={a.risk} /></td>
                <td className="py-2 pr-3 text-xs text-slate-500">{a.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {assets.slice(0, 6).map((a) => (
          <MobileCard key={a.id}>
            <div className="flex items-center justify-between">
              <Link to={`/assets/${a.id}`} className="font-medium text-indigo-600 hover:underline">{a.assetCode}</Link>
              <RecommendationBadge recommendation={a.recommendation} />
            </div>
            <div className="mt-1 text-xs text-slate-400">{a.assetName}</div>
            <p className="mt-2 text-xs text-slate-500">{a.reason}</p>
          </MobileCard>
        ))}
      </div>
    </>
  );
}

export function MostExpensiveTable({ assets }: { assets: AnalyticsDashboard['mostExpensive'] }) {
  if (assets.length === 0) return <EmptyState message="No maintenance cost data yet." />;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <th className="py-2 pr-3 font-medium">Asset</th>
              <th className="py-2 pr-3 font-medium">Condition</th>
              <th className="py-2 pr-3 font-medium">Total Cost</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 last:border-0">
                <td className="py-2 pr-3">
                  <Link to={`/assets/${a.id}`} className="font-medium text-indigo-600 hover:underline">{a.assetCode}</Link>
                  <div className="text-xs text-slate-400">{a.assetName}</div>
                </td>
                <td className="py-2 pr-3"><ConditionBadge condition={a.condition} /></td>
                <td className="py-2 pr-3 font-medium text-slate-700">{money(a.totalMaintenanceCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {assets.slice(0, 6).map((a) => (
          <MobileCard key={a.id}>
            <div className="flex items-center justify-between">
              <Link to={`/assets/${a.id}`} className="font-medium text-indigo-600 hover:underline">{a.assetCode}</Link>
              <span className="font-medium text-slate-700">{money(a.totalMaintenanceCost)}</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">{a.assetName}</div>
          </MobileCard>
        ))}
      </div>
    </>
  );
}

export function MostProblematicTable({ assets }: { assets: AnalyticsDashboard['mostProblematic'] }) {
  if (assets.length === 0) return <EmptyState message="No problematic assets detected." />;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <th className="py-2 pr-3 font-medium">Asset</th>
              <th className="py-2 pr-3 font-medium">Failures</th>
              <th className="py-2 pr-3 font-medium">Tickets</th>
              <th className="py-2 pr-3 font-medium">Downtime</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 last:border-0">
                <td className="py-2 pr-3">
                  <Link to={`/assets/${a.id}`} className="font-medium text-indigo-600 hover:underline">{a.assetCode}</Link>
                  <div className="text-xs text-slate-400">{a.assetName}</div>
                </td>
                <td className="py-2 pr-3"><span className="font-semibold text-orange-600">{a.failures}</span></td>
                <td className="py-2 pr-3 text-slate-600">{a.tickets}</td>
                <td className="py-2 pr-3 text-slate-600">{a.downtimeDays}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {assets.slice(0, 6).map((a) => (
          <MobileCard key={a.id}>
            <div className="flex items-center justify-between">
              <Link to={`/assets/${a.id}`} className="font-medium text-indigo-600 hover:underline">{a.assetCode}</Link>
              <span className="text-xs text-slate-400">{a.failures} failures</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">{a.assetName}</div>
          </MobileCard>
        ))}
      </div>
    </>
  );
}

const EVENT_SEVERITY_DOT: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  WARNING: 'bg-orange-500',
  INFO: 'bg-sky-500',
};

export function EventsTimeline({ events }: { events: AnalyticsDashboard['recentEvents'] }) {
  if (events.length === 0) return <EmptyState message="No analytics events yet." />;
  return (
    <ol className="space-y-4">
      {events.map((e) => (
        <li key={e.id} className="relative pl-5">
          <span className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${EVENT_SEVERITY_DOT[e.severity] ?? 'bg-slate-300'}`} />
          <p className="text-sm font-medium text-slate-800">{e.title}</p>
          {e.message && <p className="mt-0.5 text-xs text-slate-500">{e.message}</p>}
          <p className="mt-0.5 text-xs text-slate-400">
            {e.assetCode ?? 'System'} · {new Date(e.createdAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  );
}
