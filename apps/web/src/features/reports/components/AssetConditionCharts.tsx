import type { ReactElement } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import type { AssetConditionAnalytics, AssetConditionSummary } from '../types';

const CONDITION_COLORS: Record<string, string> = {
  GOOD: '#22c55e',
  FAIR: '#eab308',
  NEED_ATTENTION: '#f97316',
  BROKEN: '#ef4444',
  CRITICAL: '#b91c1c',
  RETIRED: '#94a3b8',
};

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

function ChartCard({ title, children, empty }: { title: string; children: ReactElement; empty: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      {empty ? (
        <div className="flex h-48 items-center justify-center"><p className="text-sm text-slate-400">No data yet.</p></div>
      ) : (
        <ResponsiveContainer width="100%" height={190}>{children}</ResponsiveContainer>
      )}
    </div>
  );
}

export default function AssetConditionCharts({
  analytics,
  summary,
}: {
  analytics?: AssetConditionAnalytics;
  summary?: AssetConditionSummary;
}) {
  const navigate = useNavigate();

  const distribution = (Object.keys(CONDITION_COLORS) as string[])
    .map((c) => ({ name: c.replace(/_/g, ' '), value: (summary as unknown as Record<string, number> | undefined)?.[c.toLowerCase()] ?? 0 }))
    .filter((d) => d.value > 0);
  const byCategory = (analytics?.byCategory ?? []).map((b) => ({ name: b.name, value: b.value }));
  const byDepartment = (analytics?.byDepartment ?? []).map((b) => ({ name: b.name, value: b.value }));
  const recentChanges = analytics?.recentChanges ?? [];

  return (
    <div className="mb-4 grid gap-4 lg:grid-cols-3">
      <ChartCard title="Condition Distribution" empty={distribution.length === 0}>
        <PieChart>
          <Pie data={distribution} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
            {distribution.map((entry) => <Cell key={entry.name} fill={CONDITION_COLORS[entry.name.toUpperCase().replace(/ /g, '_')] ?? '#94a3b8'} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartCard>

      <ChartCard title="Assets by Category" empty={byCategory.length === 0}>
        <BarChart data={byCategory} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={46} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {byCategory.map((_e, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ChartCard>

      <ChartCard title="Assets by Department" empty={byDepartment.length === 0}>
        <BarChart data={byDepartment} margin={{ top: 4, right: 4, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={46} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#0ea5e9" />
        </BarChart>
      </ChartCard>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-3">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Recent Condition Changes</h2>
        {recentChanges.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No condition changes recorded.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentChanges.map((c, i) => (
              <button
                key={i}
                onClick={() => navigate(`/assets/${c.assetCode ?? ''}`)}
                className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${CONDITION_COLORS[c.newCondition ?? ''] ?? 'bg-slate-300'}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{c.assetName || c.assetCode || 'Asset'}</p>
                  <p className="text-xs text-slate-500">{c.previousCondition?.replace(/_/g, ' ') || '-'} → {c.newCondition?.replace(/_/g, ' ') || '-'}</p>
                  <p className="text-xs text-slate-400">by {c.changedBy || '—'} · {new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
